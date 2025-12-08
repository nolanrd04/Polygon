from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.game_save import GameSave

router = APIRouter()


class PlayerStatsSchema(BaseModel):
    health: int
    maxHealth: int
    speed: int
    polygonSides: int


class AttackStatsSchema(BaseModel):
    damage: int
    speed: Optional[int] = None
    cooldown: int
    size: Optional[float] = None
    pierce: Optional[int] = None
    chains: Optional[int] = None
    range: Optional[int] = None


class GameSaveCreate(BaseModel):
    slot: int = 1
    wave: int
    points: int
    seed: int
    player_stats: dict
    applied_upgrades: List[str]
    attack_stats: dict
    unlocked_attacks: List[str]


class GameSaveResponse(BaseModel):
    id: int
    slot: int
    wave: int
    points: int
    seed: int
    player_stats: dict
    applied_upgrades: List[str]
    attack_stats: dict
    unlocked_attacks: List[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[GameSaveResponse])
async def get_all_saves(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GameSave).where(GameSave.user_id == current_user.id)
    )
    saves = result.scalars().all()
    return saves


@router.get("/{slot}", response_model=GameSaveResponse)
async def get_save(
    slot: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GameSave).where(
            GameSave.user_id == current_user.id,
            GameSave.slot == slot
        )
    )
    save = result.scalar_one_or_none()

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )

    return save


@router.post("/", response_model=GameSaveResponse)
async def create_or_update_save(
    save_data: GameSaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if save exists for this slot
    result = await db.execute(
        select(GameSave).where(
            GameSave.user_id == current_user.id,
            GameSave.slot == save_data.slot
        )
    )
    existing_save = result.scalar_one_or_none()

    if existing_save:
        # Update existing save
        existing_save.wave = save_data.wave
        existing_save.points = save_data.points
        existing_save.seed = save_data.seed
        existing_save.player_stats = save_data.player_stats
        existing_save.applied_upgrades = save_data.applied_upgrades
        existing_save.attack_stats = save_data.attack_stats
        existing_save.unlocked_attacks = save_data.unlocked_attacks
        await db.commit()
        await db.refresh(existing_save)
        return existing_save
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
        db.add(new_save)
        await db.commit()
        await db.refresh(new_save)
        return new_save


@router.delete("/{slot}")
async def delete_save(
    slot: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GameSave).where(
            GameSave.user_id == current_user.id,
            GameSave.slot == slot
        )
    )
    save = result.scalar_one_or_none()

    if not save:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save not found"
        )

    await db.delete(save)
    await db.commit()

    return {"message": "Save deleted successfully"}


@router.post("/autosave", response_model=GameSaveResponse)
async def autosave(
    save_data: GameSaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Autosave endpoint called after each wave completion.
    This prevents reroll exploitation by saving progress immediately.
    """
    return await create_or_update_save(save_data, current_user, db)
