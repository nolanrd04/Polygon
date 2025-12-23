from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import BaseRepository
from app.models.user import User


class UserRepository(BaseRepository[User]):
    """Repository for User collection with user-specific queries"""

    def __init__(self, database: AsyncIOMotorDatabase):
        super().__init__(database, "users", User)

    async def find_by_username(self, username: str) -> Optional[User]:
        """Find a user by username (case-insensitive)"""
        return await self.find_one({"username": username.lower()})

    async def username_exists(self, username: str) -> bool:
        """Check if a username already exists (case-insensitive)"""
        return await self.exists({"username": username.lower()})

    async def create_indexes(self):
        """Create indexes for the users collection"""
        await self.collection.create_index("username", unique=True)
        await self.collection.create_index("created_at")
