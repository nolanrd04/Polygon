from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.models.game_save import (
    GameSave, GameSaveResponse, OfferedUpgrade, UpgradeEntry, DeathFrozenState,
    GameStatsResponse, PointsResponse, UpgradesResponse, PlayerStateResponse,
    FullGameSaveResponse
)
from app.repositories.game_save_repository import GameSaveRepository
from app.repositories.player_stats_repository import PlayerStatsRepository

router = APIRouter()


# ==========================================
# REQUEST MODELS
# ==========================================

class GameSaveCreate(BaseModel):
    """Legacy: Full save request"""
    current_wave: int = Field(..., ge=1)
    current_points: int = Field(..., ge=0)
    seed: int = Field(...)
    current_health: float = Field(..., ge=0)
    current_max_health: float = Field(..., ge=1)
    current_speed: int = Field(..., ge=0)
    current_polygon_sides: int = Field(..., ge=3, le=12)
    current_kills: int = Field(default=0, ge=0)
    current_damage_dealt: int = Field(default=0, ge=0)  # Legacy, ignored
    current_upgrades: List[str] = Field(default_factory=list)
    offered_upgrades: List[OfferedUpgrade] = Field(default_factory=list)
    attack_stats: Dict[str, Any] = Field(default_factory=dict)  # Legacy, ignored
    unlocked_attacks: List[str] = Field(default_factory=list)
    game_over: bool = Field(default=False)


class PointsSaveRequest(BaseModel):
    """Save points only"""
    current_points: int = Field(..., ge=0)


class UpgradesSaveRequest(BaseModel):
    """Save upgrade history"""
    purchase_history: List[UpgradeEntry] = Field(...)


class GameStatsSaveRequest(BaseModel):
    """Save game stats and player state"""
    current_wave: int = Field(..., ge=1)
    current_kills: int = Field(..., ge=0)
    seed: int = Field(...)
    time_survived: int = Field(default=0, ge=0)
    # Player state bundled with game stats
    current_health: float = Field(..., ge=0)
    current_max_health: float = Field(..., ge=1)
    current_speed: int = Field(..., ge=0)
    current_polygon_sides: int = Field(..., ge=3, le=12)
    unlocked_attacks: List[str] = Field(default_factory=list)


class DeathStateSaveRequest(BaseModel):
    """Save death frozen state"""
    frozen_at: int = Field(...)
    waves_completed: int = Field(..., ge=0)
    enemies_killed: int = Field(..., ge=0)
    time_survived: int = Field(..., ge=0)
    points_at_death: int = Field(..., ge=0)


# ==========================================
# LEGACY ENDPOINTS (For backward compatibility)
# ==========================================

@router.get("/", response_model=Optional[GameSaveResponse])
async def get_save(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get the game save for the current user (one save per user)"""
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        return None

    return GameSaveResponse(
        id=save.id,
        user_id=save.user_id,
        current_wave=save.current_wave,
        current_points=save.current_points,
        seed=save.seed,
        current_health=save.current_health,
        current_max_health=save.current_max_health,
        current_speed=save.current_speed,
        current_polygon_sides=save.current_polygon_sides,
        current_kills=save.current_kills,
        current_upgrades=save.current_upgrades,
        offered_upgrades=save.offered_upgrades,
        unlocked_attacks=save.unlocked_attacks,
        game_over=save.game_over,
        created_at=save.created_at,
        updated_at=save.updated_at
    )


@router.post("/", response_model=GameSaveResponse)
async def create_or_update_save(
    save_data: GameSaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create or update the game save for the current user (legacy endpoint)"""
    repo = GameSaveRepository(db)

    existing_save = await repo.find_by_user_id(current_user.id)

    if existing_save:
        print(f"[SAVE DEBUG] Received current_kills: {save_data.current_kills}, wave: {save_data.current_wave}, points: {save_data.current_points}")

        update_data = {
            "current_wave": save_data.current_wave,
            "current_points": save_data.current_points,
            "seed": save_data.seed,
            "current_health": save_data.current_health,
            "current_max_health": save_data.current_max_health,
            "current_speed": save_data.current_speed,
            "current_polygon_sides": save_data.current_polygon_sides,
            "current_kills": save_data.current_kills,
            "current_upgrades": save_data.current_upgrades,
            "unlocked_attacks": save_data.unlocked_attacks,
            "game_over": save_data.game_over,
            "last_saved_at": datetime.utcnow()
        }

        if save_data.offered_upgrades:
            update_data["offered_upgrades"] = save_data.offered_upgrades

        updated_save = await repo.update_by_id(existing_save.id, update_data)
        save = updated_save
    else:
        new_save = GameSave(
            user_id=current_user.id,
            current_wave=save_data.current_wave,
            current_points=save_data.current_points,
            seed=save_data.seed,
            current_health=save_data.current_health,
            current_max_health=save_data.current_max_health,
            current_speed=save_data.current_speed,
            current_polygon_sides=save_data.current_polygon_sides,
            current_kills=save_data.current_kills,
            current_upgrades=save_data.current_upgrades,
            offered_upgrades=save_data.offered_upgrades,
            unlocked_attacks=save_data.unlocked_attacks,
            game_over=save_data.game_over,
            last_saved_at=datetime.utcnow()
        )
        save = await repo.create(new_save)

    return GameSaveResponse(
        id=save.id,
        user_id=save.user_id,
        current_wave=save.current_wave,
        current_points=save.current_points,
        seed=save.seed,
        current_health=save.current_health,
        current_max_health=save.current_max_health,
        current_speed=save.current_speed,
        current_polygon_sides=save.current_polygon_sides,
        current_kills=save.current_kills,
        current_upgrades=save.current_upgrades,
        offered_upgrades=save.offered_upgrades,
        unlocked_attacks=save.unlocked_attacks,
        game_over=save.game_over,
        created_at=save.created_at,
        updated_at=save.updated_at
    )


@router.delete("/")
async def delete_save(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete the game save for the current user"""
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )

    deleted = await repo.delete_by_user_id(current_user.id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete save"
        )

    # Increment games_played when starting a new game
    stats_repo = PlayerStatsRepository(db)
    stats = await stats_repo.find_by_user_id(current_user.id)
    if stats:
        await stats_repo.update_by_id(
            stats.id,
            {"games_played": stats.games_played + 1}
        )

    return {"message": "Save deleted successfully"}


@router.post("/autosave", response_model=GameSaveResponse)
async def autosave(
    save_data: GameSaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Autosave endpoint (legacy)"""
    return await create_or_update_save(save_data, current_user, db)


@router.get("/validate-load", response_model=dict)
async def validate_load_save(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Validate that the user's save can be loaded (not marked as game over)"""
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        return {"can_load": False, "can_continue": False, "reason": "No save found"}

    # Check both death_state and legacy game_over flag
    if save.death_state is not None or save.game_over:
        return {"can_load": False, "can_continue": False, "reason": "Save is marked as game over", "current_wave": save.current_wave}

    return {"can_load": True, "can_continue": True, "current_wave": save.current_wave}


# ==========================================
# MODULAR SAVE ENDPOINTS
# ==========================================

@router.post("/points", response_model=PointsResponse)
async def save_points(
    data: PointsSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save current points.
    ALWAYS ALLOWED - even after death (points persist for upgrades).
    """
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No save found - start a game first"
        )

    print(f"[SAVE POINTS] User {current_user.id}: {data.current_points} points")

    await repo.update_by_id(save.id, {
        "current_points": data.current_points,
        "last_saved_at": datetime.utcnow()
    })

    return PointsResponse(current_points=data.current_points)


@router.post("/upgrades", response_model=UpgradesResponse)
async def save_upgrades(
    data: UpgradesSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save upgrade purchase history.
    ALWAYS ALLOWED - even after death (upgrades persist).
    Order is preserved for correct stat reconstruction on load.
    """
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No save found - start a game first"
        )

    # Convert to list of dicts for MongoDB
    upgrade_history = [entry.model_dump() for entry in data.purchase_history]

    # Also update legacy current_upgrades for backward compatibility
    current_upgrades = [entry.upgrade_id for entry in data.purchase_history]

    print(f"[SAVE UPGRADES] User {current_user.id}: {len(upgrade_history)} upgrades")

    await repo.update_by_id(save.id, {
        "upgrade_history": upgrade_history,
        "current_upgrades": current_upgrades,
        "last_saved_at": datetime.utcnow()
    })

    return UpgradesResponse(purchase_history=data.purchase_history)


@router.post("/game-stats", response_model=GameStatsResponse)
async def save_game_stats(
    data: GameStatsSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save game statistics and player state.
    BLOCKED if death_state exists (game stats freeze on death).
    """
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No save found - start a game first"
        )

    # GUARD: Block game stats save if player is dead
    if save.death_state is not None or save.game_over:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update game stats after death"
        )

    print(f"[SAVE GAME STATS] User {current_user.id}: Wave {data.current_wave}, Kills {data.current_kills}")

    await repo.update_by_id(save.id, {
        "current_wave": data.current_wave,
        "current_kills": data.current_kills,
        "seed": data.seed,
        "time_survived": data.time_survived,
        "current_health": data.current_health,
        "current_max_health": data.current_max_health,
        "current_speed": data.current_speed,
        "current_polygon_sides": data.current_polygon_sides,
        "unlocked_attacks": data.unlocked_attacks,
        "last_saved_at": datetime.utcnow()
    })

    return GameStatsResponse(
        current_wave=data.current_wave,
        current_kills=data.current_kills,
        seed=data.seed,
        time_survived=data.time_survived
    )


@router.post("/death-state")
async def save_death_state(
    data: DeathStateSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save death frozen state.
    CAN ONLY BE CALLED ONCE - rejects if death_state already exists.
    This prevents the exploit of overwriting the death state.
    """
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No save found - start a game first"
        )

    # GUARD: Death state can only be set once
    if save.death_state is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Death state already frozen - cannot overwrite"
        )

    death_state = DeathFrozenState(
        frozen_at=data.frozen_at,
        waves_completed=data.waves_completed,
        enemies_killed=data.enemies_killed,
        time_survived=data.time_survived,
        points_at_death=data.points_at_death
    )

    print(f"[SAVE DEATH STATE] User {current_user.id}: Wave {data.waves_completed}, Kills {data.enemies_killed}")

    await repo.update_by_id(save.id, {
        "death_state": death_state.model_dump(),
        "game_over": True,  # Also set legacy flag
        "last_saved_at": datetime.utcnow()
    })

    return {"message": "Death state saved", "death_state": death_state.model_dump()}


@router.get("/full", response_model=FullGameSaveResponse)
async def load_full_game(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Load complete game save in modular format.
    Returns all save categories combined for continue/load functionality.
    """
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_id(current_user.id)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No save found"
        )

    # Build modular response
    game_stats = GameStatsResponse(
        current_wave=save.current_wave,
        current_kills=save.current_kills,
        seed=save.seed,
        time_survived=getattr(save, 'time_survived', 0)
    )

    points = PointsResponse(current_points=save.current_points)

    # Get upgrade history (prefer new format, fallback to legacy)
    upgrade_history = getattr(save, 'upgrade_history', None)
    if upgrade_history:
        upgrades = UpgradesResponse(purchase_history=[
            UpgradeEntry(**entry) if isinstance(entry, dict) else entry
            for entry in upgrade_history
        ])
    else:
        # Convert legacy current_upgrades to upgrade_history format
        upgrades = UpgradesResponse(purchase_history=[
            UpgradeEntry(upgrade_id=uid, purchased_at=0, wave_number=1)
            for uid in save.current_upgrades
        ])

    player_state = PlayerStateResponse(
        current_health=save.current_health,
        current_max_health=save.current_max_health,
        current_speed=save.current_speed,
        current_polygon_sides=save.current_polygon_sides,
        unlocked_attacks=save.unlocked_attacks
    )

    # Get death state if it exists
    death_state = None
    if save.death_state:
        if isinstance(save.death_state, dict):
            death_state = DeathFrozenState(**save.death_state)
        else:
            death_state = save.death_state

    # Determine if player can continue
    can_continue = save.death_state is None and not save.game_over

    # Get last saved timestamp
    last_saved_at = None
    if save.updated_at:
        last_saved_at = int(save.updated_at.timestamp() * 1000)
    elif getattr(save, 'last_saved_at', None):
        last_saved_at = int(save.last_saved_at.timestamp() * 1000)

    return FullGameSaveResponse(
        game_stats=game_stats,
        points=points,
        upgrades=upgrades,
        player_state=player_state,
        death_state=death_state,
        can_continue=can_continue,
        last_saved_at=last_saved_at
    )