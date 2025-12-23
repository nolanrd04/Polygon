from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import BaseRepository
from app.models.player_stats import PlayerStats


class PlayerStatsRepository(BaseRepository[PlayerStats]):
    """Repository for PlayerStats collection with player-specific queries"""

    def __init__(self, database: AsyncIOMotorDatabase):
        super().__init__(database, "player_stats", PlayerStats)

    async def find_by_user_id(self, user_id: str | ObjectId) -> Optional[PlayerStats]:
        """Find player stats by user ID"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        return await self.find_one({"user_id": user_id})

    async def get_leaderboard(self, limit: int = 10) -> list[PlayerStats]:
        """Get top players by highest wave"""
        return await self.find_many(
            filter={},
            limit=limit,
            sort=[("highest_wave", -1), ("level", -1)]
        )

    async def create_indexes(self):
        """Create indexes for the player_stats collection"""
        await self.collection.create_index("user_id", unique=True)
        await self.collection.create_index([("highest_wave", -1)])
        await self.collection.create_index([("level", -1)])
