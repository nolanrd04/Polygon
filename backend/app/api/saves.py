from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.models.game_save import (
    UpgradeEntry, DeathFrozenState,
    GameStatsResponse, PointsResponse, UpgradesResponse, PlayerStateResponse,
    FullGameSaveResponse
)
from app.repositories.game_save_repository import GameSaveRepository
from app.repositories.player_stats_repository import PlayerStatsRepository

router = APIRouter()


# NOTE: Points, upgrades, game-stats, and death-state are no longer accepted
# as direct client saves. All of it is now written server-side by
# wave_service.complete_wave() (normal completion AND death, via is_death) and
# waves.py's select_upgrade/reroll — the only endpoints with a legitimate,
# validated view of these fields. See handoffs/2026-07-29.2-* and the
# persistence-anti-cheat-redesign plan for why the old client-writable
# endpoints (/points, /upgrades, /game-stats, /death-state) were removed.


# ==========================================
# UTILITY ENDPOINTS
# ==========================================

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