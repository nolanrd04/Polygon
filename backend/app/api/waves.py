from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.services.wave_service import WaveService
from app.repositories.player_stats_repository import PlayerStatsRepository

router = APIRouter()


class WaveStartRequest(BaseModel):
    wave_number: int = Field(..., ge=1)
    seed: int = Field(...)


class WaveStartResponse(BaseModel):
    token: str
    expires_in: int  # seconds
    offered_upgrades: List[Dict[str, Any]]


class FrameSample(BaseModel):
    frame: int
    timestamp: int  # milliseconds
    player: Dict[str, Any]  # {x, y, vx, vy, health}


class EnemyDeath(BaseModel):
    type: str
    x: float
    y: float
    frame: int


class HitCounts(BaseModel):
    primary: int = Field(default=0, ge=0)
    explosion: int = Field(default=0, ge=0)


class WaveCompleteRequest(BaseModel):
    token: str
    wave: int
    kills: int
    total_damage: int
    hits: HitCounts = Field(default_factory=HitCounts)
    current_health: float
    damage_taken: int = Field(default=0, ge=0)
    frame_samples: List[FrameSample]
    enemy_deaths: List[EnemyDeath]
    upgrades_used: List[str]
    points_earned: int = Field(default=0, ge=0)
    shots_fired: List[float] = Field(default_factory=list)
    is_death: bool = Field(default=False)


class WaveCompleteResponse(BaseModel):
    success: bool
    message: str
    errors: List[str] = Field(default_factory=list)
    current_points: Optional[int] = None


class UpgradeSelectRequest(BaseModel):
    upgrade_id: str
    wave: int


class RerollRequest(BaseModel):
    wave: int
    reroll_cost: int = Field(..., ge=0)


class RerollResponse(BaseModel):
    success: bool
    offered_upgrades: List[Dict[str, Any]]
    current_points: int


class BundlePickupRequest(BaseModel):
    wave: int = Field(..., ge=1)
    # The bundle's displayed tier (0=common .. 4=legendary), rolled
    # client-side at drop time so the pickup grants what the player actually
    # saw - clamped server-side against this wave's own bundle rarity
    # weights, so it can't be used to claim a rarity this wave can't
    # legitimately drop (see WaveService.collect_upgrade_bundle).
    bundle_tier: int = Field(..., ge=0, le=4)
    # The client's own active wave-validation token (same one /waves/complete
    # will eventually be called with). (user_id, wave) alone isn't unique
    # enough to find "the" token - a mid-wave reload can leave a second,
    # never-completed token for the same wave sitting unused (e.g. the
    # pre-loaded next-wave token from the previous wave's completion, plus a
    # fresh one from MainScene re-running startWave on reload). Matching the
    # exact token string this pickup is happening against guarantees the
    # grant lands on the token that will actually be submitted at
    # wave-complete, instead of an indeterminate one of possibly several.
    token: str = Field(...)


class BundlePickupResponse(BaseModel):
    success: bool
    upgrade_ids: List[str] = Field(default_factory=list)
    message: Optional[str] = None


@router.post("/start", response_model=WaveStartResponse)
async def start_wave(
    request: WaveStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Start a new wave - generates validation token and rolls upgrades.

    This endpoint:
    - Creates a long-lived validation token (matches the auth token's own
      session length - see WaveService.WAVE_TOKEN_LIFETIME_SECONDS)
    - Rolls 3 random upgrades based on rarity weights
    - Returns token and offered upgrades to client
    """
    wave_service = WaveService(db)

    try:
        token, offered_upgrades = await wave_service.start_wave(
            user_id=current_user.id,
            username=current_user.username,
            wave_number=request.wave_number,
            seed=request.seed
        )

        expires_in = int((token.expires_at - datetime.utcnow()).total_seconds())

        return WaveStartResponse(
            token=token.token,
            expires_in=expires_in,
            offered_upgrades=offered_upgrades
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/complete", response_model=WaveCompleteResponse)
async def complete_wave(
    request: WaveCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Submit wave completion data for validation.

    This endpoint performs comprehensive anti-cheat validation:
    - Token validity (not expired, not reused)
    - Player movement (frame-by-frame, 10% tolerance)
    - Damage dealt vs enemy health requirements
    - Kill counts vs expected spawns
    - Only allowed upgrades were used

    Suspicious activity is flagged for admin review.
    """
    wave_service = WaveService(db)

    # Convert Pydantic models to dicts
    wave_data = {
        "wave": request.wave,
        "kills": request.kills,
        "total_damage": request.total_damage,
        "hits": request.hits.model_dump(),
        "current_health": request.current_health,
        "damage_taken": request.damage_taken,
        "frame_samples": [f.model_dump() for f in request.frame_samples],
        "enemy_deaths": [e.model_dump() for e in request.enemy_deaths],
        "upgrades_used": request.upgrades_used,
        "points_earned": request.points_earned,
        "shots_fired": request.shots_fired
    }

    is_valid, errors, current_points = await wave_service.complete_wave(
        user_id=current_user.id,
        username=current_user.username,
        token_string=request.token,
        wave_data=wave_data,
        is_death=request.is_death
    )

    if is_valid:
        return WaveCompleteResponse(
            success=True,
            message="Wave completed successfully",
            current_points=current_points
        )
    else:
        return WaveCompleteResponse(
            success=False,
            message="Wave validation failed",
            errors=errors,
            current_points=current_points
        )


@router.post("/select-upgrade")
async def select_upgrade(
    request: UpgradeSelectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Apply a selected upgrade to the player.

    Validates that:
    - Upgrade was actually offered in the most recent wave token
    - Upgrade dependencies are met
    - Stack limits not exceeded
    """
    from app.repositories.game_save_repository import GameSaveRepository
    from app.core.upgrade_data import get_upgrade, can_apply_upgrade

    game_save_repo = GameSaveRepository(db)

    # Get game save to check current upgrades
    game_save = await game_save_repo.find_by_user_id(current_user.id)
    if not game_save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active game found"
        )

    # Validate upgrade was offered in the current wave
    offered_upgrade_ids = [u.id for u in game_save.offered_upgrades]
    if request.upgrade_id not in offered_upgrade_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upgrade was not offered this wave"
        )

    # Check if upgrade was already purchased (find first unpurchased instance)
    upgrade_index = next((i for i, u in enumerate(game_save.offered_upgrades) if u.id == request.upgrade_id and not u.purchased), None)
    if upgrade_index is None:
        # All instances of this upgrade have been purchased (or it wasn't offered)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upgrade already purchased or not offered"
        )

    upgrade = get_upgrade(request.upgrade_id)
    if not upgrade:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid upgrade ID"
        )

    # Check if can apply (using current upgrades from game save)
    if not can_apply_upgrade(request.upgrade_id, game_save.current_upgrades):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply this upgrade (dependencies not met or max stacks reached)"
        )

    # Mark upgrade as purchased in offered_upgrades (only mark the specific instance found above)
    updated_offered_upgrades = []
    for i, u in enumerate(game_save.offered_upgrades):
        if i == upgrade_index:
            from app.models.game_save import OfferedUpgrade
            updated_offered_upgrades.append(OfferedUpgrade(id=u.id, purchased=True))
        else:
            updated_offered_upgrades.append(u)

    # Add upgrade to current upgrades in game save
    updated_upgrades = game_save.current_upgrades + [request.upgrade_id]

    # Deduct upgrade cost from points
    upgrade_cost = upgrade.get('cost', 0)
    updated_points = max(0, game_save.current_points - upgrade_cost)

    # Server-timestamped append to the ordered purchase history, so it's
    # authoritative (this is what /api/saves/full's load path reconstructs
    # build state from) instead of trusting a client-submitted history.
    from datetime import datetime
    from app.models.game_save import UpgradeEntry
    updated_history = game_save.upgrade_history + [UpgradeEntry(
        upgrade_id=request.upgrade_id,
        purchased_at=int(datetime.utcnow().timestamp() * 1000),
        wave_number=request.wave
    )]

    await game_save_repo.update_by_id(
        game_save.id,
        {
            "current_upgrades": updated_upgrades,
            "offered_upgrades": [u.model_dump() for u in updated_offered_upgrades],
            "current_points": updated_points,
            "upgrade_history": [e.model_dump() for e in updated_history]
        }
    )

    return {
        "success": True,
        "message": f"Upgrade {upgrade['name']} applied",
        "current_upgrades": updated_upgrades,
        "current_points": updated_points
    }


@router.post("/bundle-pickup", response_model=BundlePickupResponse)
async def bundle_pickup(
    request: BundlePickupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Grant a mid-wave upgrade-bundle pickup.

    Free (no cost, same as a dev-tool grant) - but rolled and recorded
    server-side (see WaveService.collect_upgrade_bundle) instead of trusting
    whatever upgrade ids the client claims it rolled, and capped per-wave so
    the endpoint can't be farmed for unlimited free upgrades.

    The grant applies for the rest of this run immediately, but is only
    recorded against the current wave's validation token - it isn't written
    to the permanent save until this wave is actually completed (win or
    death) via /api/waves/complete. Quitting mid-wave without completing it
    drops the grant, same as it drops in-progress kills/damage.
    """
    wave_service = WaveService(db)
    success, upgrade_ids, error = await wave_service.collect_upgrade_bundle(
        user_id=current_user.id,
        wave_number=request.wave,
        client_bundle_tier=request.bundle_tier,
        token_string=request.token
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error or "Could not grant bundle"
        )

    return BundlePickupResponse(success=True, upgrade_ids=upgrade_ids)


@router.post("/reroll", response_model=RerollResponse)
async def reroll_upgrades(
    request: RerollRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Reroll the offered upgrades for the current wave.

    Validates that:
    - User has enough points for reroll
    - Game save exists
    - Deducts reroll cost
    - Rolls new upgrades
    """
    from app.repositories.game_save_repository import GameSaveRepository

    game_save_repo = GameSaveRepository(db)
    wave_service = WaveService(db)

    # Get game save
    game_save = await game_save_repo.find_by_user_id(current_user.id)
    if not game_save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active game found"
        )

    # Check if user has enough points
    if game_save.current_points < request.reroll_cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough points. Need {request.reroll_cost}, have {game_save.current_points}"
        )

    # Deduct reroll cost
    updated_points = game_save.current_points - request.reroll_cost

    # Roll new upgrades
    new_upgrades = await wave_service.reroll_upgrades(
        user_id=current_user.id,
        current_upgrades=game_save.current_upgrades,
        attack_type=game_save.current_attack_type,
        wave_number=game_save.current_wave,
        difficulty_id=game_save.difficulty_id
    )

    # Update game save with new points and new offered upgrades
    await game_save_repo.update_by_id(
        game_save.id,
        {
            "current_points": updated_points,
            "offered_upgrades": new_upgrades["offered_upgrade_objs"]
        }
    )

    return RerollResponse(
        success=True,
        offered_upgrades=new_upgrades["offered_upgrades"],
        current_points=updated_points
    )
