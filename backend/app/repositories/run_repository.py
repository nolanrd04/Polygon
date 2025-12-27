"""
Run Repository - Data access layer for run documents.
"""
from typing import Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from pymongo import ReturnDocument
from app.repositories.base import BaseRepository
from app.models.run import Run, RunStatus, RunProgress, RunStats


class RunRepository(BaseRepository[Run]):
    """Repository for Run documents with run-specific operations"""

    def __init__(self, database: AsyncIOMotorDatabase):
        super().__init__(database, "runs", Run)

    async def find_by_user_id(self, user_id: ObjectId) -> Optional[Run]:
        """Find any run for user (active or dead)"""
        return await self.find_one({"user_id": user_id})

    async def find_active_by_user_id(self, user_id: ObjectId) -> Optional[Run]:
        """Find active run for user (only one can exist)"""
        return await self.find_one({
            "user_id": user_id,
            "status": RunStatus.ACTIVE.value
        })

    async def delete_by_user_id(self, user_id: ObjectId) -> bool:
        """Delete run for user (for starting new game)"""
        result = await self.collection.delete_one({"user_id": user_id})
        return result.deleted_count > 0

    async def atomic_save(
        self,
        run_id: str,
        user_id: ObjectId,
        progress: RunProgress,
        stats: RunStats
    ) -> bool:
        """
        Atomic save - replaces entire progress/stats objects.
        Only succeeds if run is active.
        """
        result = await self.collection.update_one(
            {
                "run_id": run_id,
                "user_id": user_id,
                "status": RunStatus.ACTIVE.value
            },
            {
                "$set": {
                    "progress": progress.model_dump(),
                    "stats": stats.model_dump(),
                    "last_saved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def mark_dead(
        self,
        run_id: str,
        user_id: ObjectId,
        final_progress: RunProgress,
        final_stats: RunStats
    ) -> bool:
        """
        Mark run as dead with final snapshot.
        Atomically updates status to dead (prevents race conditions).
        """
        result = await self.collection.update_one(
            {
                "run_id": run_id,
                "user_id": user_id,
                "status": RunStatus.ACTIVE.value
            },
            {
                "$set": {
                    "status": RunStatus.DEAD.value,
                    "progress": final_progress.model_dump(),
                    "stats": final_stats.model_dump(),
                    "last_saved_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        return result.modified_count > 0

    async def update_progress(
        self,
        run_id: str,
        user_id: ObjectId,
        **progress_fields
    ) -> Optional[Run]:
        """
        Update specific progress fields atomically.
        Only succeeds if run is active.
        Used for upgrade purchases and rerolls.
        """
        update_dict = {f"progress.{k}": v for k, v in progress_fields.items()}
        update_dict["last_saved_at"] = datetime.utcnow()
        update_dict["updated_at"] = datetime.utcnow()

        result = await self.collection.find_one_and_update(
            {
                "run_id": run_id,
                "user_id": user_id,
                "status": RunStatus.ACTIVE.value
            },
            {"$set": update_dict},
            return_document=ReturnDocument.AFTER
        )
        return Run.from_mongo(result) if result else None

    @staticmethod
    async def create_indexes(database: AsyncIOMotorDatabase):
        """Create indexes for runs collection"""
        collection = database["runs"]
        # One run per user (enforced at app level, but index helps queries)
        await collection.create_index("user_id")
        await collection.create_index("run_id", unique=True)
        await collection.create_index([("user_id", 1), ("status", 1)])
