from typing import Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.user_repository import UserRepository
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.models.user import User
from app.models.player_stats import PlayerStats


class UserService:
    """Service for user-related business logic"""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(database)
        self.player_stats_repo = PlayerStatsRepository(database)

    async def get_user_by_id(self, user_id: str | ObjectId) -> User:
        """Get user by ID"""
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    async def get_user_by_username(self, username: str) -> User:
        """Get user by username"""
        user = await self.user_repo.find_by_username(username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user

    async def get_player_stats(self, user_id: str | ObjectId) -> Optional[PlayerStats]:
        """Get player stats for a user"""
        return await self.player_stats_repo.find_by_user_id(user_id)

    async def update_player_stats(
        self,
        user_id: str | ObjectId,
        stats_update: dict
    ) -> PlayerStats:
        """Update player stats"""
        stats = await self.player_stats_repo.find_by_user_id(user_id)
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Player stats not found"
            )

        updated_stats = await self.player_stats_repo.update_by_id(
            stats.id,
            stats_update
        )
        return updated_stats
