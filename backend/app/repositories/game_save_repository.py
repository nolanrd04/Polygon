from typing import Optional, List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import BaseRepository
from app.models.game_save import GameSave


class GameSaveRepository(BaseRepository[GameSave]):
    """Repository for GameSave collection"""

    def __init__(self, database: AsyncIOMotorDatabase):
        super().__init__(database, "game_saves", GameSave)

    async def find_by_user_id(self, user_id: str | ObjectId) -> Optional[GameSave]:
        """Find the game save for a user (one save per user)"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        return await self.find_one({"user_id": user_id})

    async def delete_by_user_id(self, user_id: str | ObjectId) -> bool:
        """Delete the game save for a user"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        result = await self.collection.delete_one({"user_id": user_id})
        return result.deleted_count > 0

    async def create_indexes(self):
        """Create indexes for the game_saves collection"""
        # Get list of existing indexes
        existing_indexes = await self.collection.list_indexes().to_list(None)
        index_names = [idx["name"] for idx in existing_indexes]

        # Drop old indexes if they exist to avoid conflicts
        if "user_id_1_slot_1" in index_names:
            await self.collection.drop_index("user_id_1_slot_1")

        if "user_id_1" in index_names:
            await self.collection.drop_index("user_id_1")

        # Clean up duplicate saves (from old slot system)
        # Keep only the most recent save per user
        pipeline = [
            {"$sort": {"updated_at": -1}},  # Sort by most recent first
            {"$group": {
                "_id": "$user_id",
                "latest_save": {"$first": "$$ROOT"},
                "all_ids": {"$push": "$_id"}
            }}
        ]

        async for group in self.collection.aggregate(pipeline):
            # If user has multiple saves, delete all except the latest
            if len(group["all_ids"]) > 1:
                latest_id = group["latest_save"]["_id"]
                ids_to_delete = [id for id in group["all_ids"] if id != latest_id]
                await self.collection.delete_many({"_id": {"$in": ids_to_delete}})

        # Create new unique index on user_id (only if it doesn't exist)
        if "user_id_unique" not in index_names:
            await self.collection.create_index("user_id", unique=True, name="user_id_unique")

        if "created_at_1" not in index_names:
            await self.collection.create_index("created_at")
