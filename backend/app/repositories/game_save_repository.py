from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import BaseRepository
from app.models.game_save import GameSave


class GameSaveRepository(BaseRepository[GameSave]):
    """Repository for GameSave collection"""

    def __init__(self, database: AsyncIOMotorDatabase):
        super().__init__(database, "game_saves", GameSave)

    async def find_by_user_id(self, user_id: str | ObjectId) -> List[GameSave]:
        """Find all game saves for a user"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        return await self.find_many({"user_id": user_id})

    async def find_by_user_and_slot(self, user_id: str | ObjectId, slot: int) -> Optional[GameSave]:
        """Find a specific save slot for a user"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        return await self.find_one({"user_id": user_id, "slot": slot})

    async def delete_by_user_and_slot(self, user_id: str | ObjectId, slot: int) -> bool:
        """Delete a specific save slot for a user"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        result = await self.collection.delete_one({"user_id": user_id, "slot": slot})
        return result.deleted_count > 0

    async def create_indexes(self):
        """Create indexes for the game_saves collection"""
        await self.collection.create_index([("user_id", 1), ("slot", 1)], unique=True)
        await self.collection.create_index("user_id")
        await self.collection.create_index("created_at")
