from typing import Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import BaseRepository
from app.models.game_run import GameRun, WaveSnapshot


class GameRunRepository(BaseRepository[GameRun]):
    """Repository for the permanent per-run analytics collection"""

    def __init__(self, database: AsyncIOMotorDatabase):
        super().__init__(database, "game_runs", GameRun)

    async def find_active_by_user_id(self, user_id: str | ObjectId) -> Optional[GameRun]:
        """
        Find the user's active run. Newest-first so that if stale active runs
        ever exist (crash before abandon_active_runs ran), snapshots still
        land on the run actually being played.
        """
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        docs = await (
            self.collection
            .find({"user_id": user_id, "status": "active"})
            .sort("started_at", -1)
            .to_list(1)
        )
        return GameRun.from_mongo(docs[0]) if docs else None

    async def abandon_active_runs(self, user_id: str | ObjectId) -> int:
        """
        Mark any still-active runs abandoned. Called when a new run starts:
        a save deleted mid-run never gets a death submission, so its run
        would otherwise sit "active" forever and steal the new run's pushes.
        """
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        now = datetime.utcnow()
        result = await self.collection.update_many(
            {"user_id": user_id, "status": "active"},
            {"$set": {"status": "abandoned", "ended_at": now, "updated_at": now}}
        )
        return result.modified_count

    async def append_wave_snapshot(self, run_id: ObjectId, snapshot: WaveSnapshot) -> None:
        await self.collection.update_one(
            {"_id": run_id},
            {
                "$push": {"wave_snapshots": snapshot.model_dump()},
                "$set": {"updated_at": datetime.utcnow()},
            }
        )

    async def finalize(
        self,
        run_id: ObjectId,
        final_wave: int,
        ended_at: datetime,
        totals: Dict[str, Any],
    ) -> None:
        """Seal a run on death: status, end markers, denormalized totals."""
        await self.collection.update_one(
            {"_id": run_id},
            {"$set": {
                "status": "dead",
                "ended_at": ended_at,
                "final_wave": final_wave,
                "updated_at": datetime.utcnow(),
                **totals,
            }}
        )

    async def create_indexes(self):
        """Create indexes for the game_runs collection"""
        # Active-run lookup on every wave completion.
        await self.collection.create_index([("user_id", 1), ("status", 1)])
        # Cross-run per-wave aggregation ($unwind + match on wave number).
        await self.collection.create_index("wave_snapshots.wave_number")
