from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.models.game_save import GameSave, GameSaveResponse
from app.repositories.game_save_repository import GameSaveRepository

router = APIRouter()


class GameSaveCreate(BaseModel):
    slot: int = Field(default=1, ge=1, le=5)
    wave: int = Field(..., ge=1)
    points: int = Field(..., ge=0)
    seed: int = Field(...)
    player_stats: Dict[str, Any] = Field(...)
    applied_upgrades: List[str] = Field(default_factory=list)
    attack_stats: Dict[str, Any] = Field(...)
    unlocked_attacks: List[str] = Field(default_factory=list)


@router.get("/", response_model=List[GameSaveResponse])
async def get_all_saves(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get all game saves for the current user"""
    repo = GameSaveRepository(db)
    saves = await repo.find_by_user_id(current_user.id)
    return [
        GameSaveResponse(
            id=save.id,
            user_id=save.user_id,
            slot=save.slot,
            wave=save.wave,
            points=save.points,
            seed=save.seed,
            player_stats=save.player_stats,
            applied_upgrades=save.applied_upgrades,
            attack_stats=save.attack_stats,
            unlocked_attacks=save.unlocked_attacks,
            created_at=save.created_at,
            updated_at=save.updated_at
        )
        for save in saves
    ]


@router.get("/{slot}", response_model=GameSaveResponse)
async def get_save(
    slot: int,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get a specific save slot for the current user"""
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_and_slot(current_user.id, slot)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )

    return GameSaveResponse(
        id=save.id,
        user_id=save.user_id,
        slot=save.slot,
        wave=save.wave,
        points=save.points,
        seed=save.seed,
        player_stats=save.player_stats,
        applied_upgrades=save.applied_upgrades,
        attack_stats=save.attack_stats,
        unlocked_attacks=save.unlocked_attacks,
        created_at=save.created_at,
        updated_at=save.updated_at
    )


@router.post("/", response_model=GameSaveResponse)
async def create_or_update_save(
    save_data: GameSaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create or update a game save"""
    repo = GameSaveRepository(db)

    # Check if save exists for this slot
    existing_save = await repo.find_by_user_and_slot(current_user.id, save_data.slot)

    if existing_save:
        # Update existing save
        updated_save = await repo.update_by_id(
            existing_save.id,
            {
                "wave": save_data.wave,
                "points": save_data.points,
                "seed": save_data.seed,
                "player_stats": save_data.player_stats,
                "applied_upgrades": save_data.applied_upgrades,
                "attack_stats": save_data.attack_stats,
                "unlocked_attacks": save_data.unlocked_attacks
            }
        )
        save = updated_save
    else:
        # Create new save
        new_save = GameSave(
            user_id=current_user.id,
            slot=save_data.slot,
            wave=save_data.wave,
            points=save_data.points,
            seed=save_data.seed,
            player_stats=save_data.player_stats,
            applied_upgrades=save_data.applied_upgrades,
            attack_stats=save_data.attack_stats,
            unlocked_attacks=save_data.unlocked_attacks
        )
        save = await repo.create(new_save)

    return GameSaveResponse(
        id=save.id,
        user_id=save.user_id,
        slot=save.slot,
        wave=save.wave,
        points=save.points,
        seed=save.seed,
        player_stats=save.player_stats,
        applied_upgrades=save.applied_upgrades,
        attack_stats=save.attack_stats,
        unlocked_attacks=save.unlocked_attacks,
        created_at=save.created_at,
        updated_at=save.updated_at
    )


@router.delete("/{slot}")
async def delete_save(
    slot: int,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a specific save slot"""
    repo = GameSaveRepository(db)
    save = await repo.find_by_user_and_slot(current_user.id, slot)

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )

    deleted = await repo.delete_by_user_and_slot(current_user.id, slot)

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
