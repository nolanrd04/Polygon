from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.models.game_save import GameSave, GameSaveResponse, OfferedUpgrade
from app.repositories.game_save_repository import GameSaveRepository

router = APIRouter()


class GameSaveCreate(BaseModel):
    current_wave: int = Field(..., ge=1)
    current_points: int = Field(..., ge=0)
    seed: int = Field(...)
    current_health: int = Field(..., ge=0)
    current_max_health: int = Field(..., ge=1)
    current_speed: int = Field(..., ge=0)
    current_polygon_sides: int = Field(..., ge=3, le=8)
    current_kills: int = Field(default=0, ge=0)
    current_damage_dealt: int = Field(default=0, ge=0)
    current_upgrades: List[str] = Field(default_factory=list)
    offered_upgrades: List[OfferedUpgrade] = Field(default_factory=list)
    attack_stats: Dict[str, Any] = Field(...)
    unlocked_attacks: List[str] = Field(default_factory=list)
    game_over: bool = Field(default=False)


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
        current_damage_dealt=save.current_damage_dealt,
        current_upgrades=save.current_upgrades,
        offered_upgrades=save.offered_upgrades,
        attack_stats=save.attack_stats,
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
    """Create or update the game save for the current user (one save per user)"""
    repo = GameSaveRepository(db)

    # Check if save exists for this user
    existing_save = await repo.find_by_user_id(current_user.id)

    if existing_save:
        # Update existing save
        # NOTE: Do NOT update offered_upgrades here - it should only be modified by:
        # 1. Wave start (rolling new upgrades)
        # 2. Select upgrade (marking as purchased)
        # 3. Wave completion (clearing after wave completes)
        update_data = {
            "current_points": save_data.current_points,
            "seed": save_data.seed,
            "current_health": save_data.current_health,
            "current_max_health": save_data.current_max_health,
            "current_speed": save_data.current_speed,
            "current_polygon_sides": save_data.current_polygon_sides,
            "current_kills": save_data.current_kills,
            "current_damage_dealt": save_data.current_damage_dealt,
            "current_upgrades": save_data.current_upgrades,
            "attack_stats": save_data.attack_stats,
            "unlocked_attacks": save_data.unlocked_attacks,
            "game_over": save_data.game_over
        }

        # Only update current_wave if it's greater than existing (prevent going backwards)
        # Wave progression should be driven by wave completion, not autosave
        if save_data.current_wave > existing_save.current_wave:
            update_data["current_wave"] = save_data.current_wave

        # Only update offered_upgrades if explicitly provided (not empty)
        # This prevents autosave from clearing the offered upgrades
        if save_data.offered_upgrades:
            update_data["offered_upgrades"] = save_data.offered_upgrades

        updated_save = await repo.update_by_id(
            existing_save.id,
            update_data
        )
        save = updated_save
    else:
        # Create new save
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
            current_damage_dealt=save_data.current_damage_dealt,
            current_upgrades=save_data.current_upgrades,
            offered_upgrades=save_data.offered_upgrades,
            attack_stats=save_data.attack_stats,
            unlocked_attacks=save_data.unlocked_attacks,
            game_over=save_data.game_over
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
        current_damage_dealt=save.current_damage_dealt,
        current_upgrades=save.current_upgrades,
        offered_upgrades=save.offered_upgrades,
        attack_stats=save.attack_stats,
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

    return {"message": "Save deleted successfully"}


@router.post("/autosave", response_model=GameSaveResponse)
async def autosave(
    save_data: GameSaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Autosave endpoint called after each wave completion.
    This prevents reroll exploitation by saving progress immediately.
    """
    return await create_or_update_save(save_data, current_user, db)
