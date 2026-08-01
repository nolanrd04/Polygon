from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase


class TokenBlacklistRepository:
    """Tracks revoked JWT ids (jti) so logged-out tokens can't be reused until they expire naturally."""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.collection = database["revoked_tokens"]

    async def revoke(self, jti: str, expires_at: datetime) -> None:
        await self.collection.update_one(
            {"jti": jti},
            {"$set": {"jti": jti, "expires_at": expires_at}},
            upsert=True,
        )

    async def is_revoked(self, jti: str) -> bool:
        return await self.collection.count_documents({"jti": jti}, limit=1) > 0

    async def create_indexes(self):
        await self.collection.create_index("jti", unique=True)
        # TTL index: MongoDB automatically deletes the doc once expires_at is in the past,
        # so the blacklist never grows unbounded with stale entries.
        await self.collection.create_index("expires_at", expireAfterSeconds=0)
