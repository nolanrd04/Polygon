import asyncio
import logging
from datetime import datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

INACTIVE_ACCOUNT_DAYS = 30
CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60

# flagged_waves is deliberately kept as anti-cheat history.
USER_OWNED_COLLECTIONS = ["player_stats", "game_saves", "game_runs", "wave_validation_tokens"]


async def delete_inactive_accounts(db: AsyncIOMotorDatabase) -> int:
    """Delete accounts older than INACTIVE_ACCOUNT_DAYS that never completed a wave."""
    cutoff = datetime.utcnow() - timedelta(days=INACTIVE_ACCOUNT_DAYS)
    old_ids = [u["_id"] async for u in db["users"].find({"created_at": {"$lt": cutoff}}, {"_id": 1})]
    if not old_ids:
        return 0

    active_ids = {
        s["user_id"]
        async for s in db["player_stats"].find(
            {"user_id": {"$in": old_ids}, "highest_wave_ever": {"$gt": 0}}, {"user_id": 1}
        )
    }
    inactive_ids = [i for i in old_ids if i not in active_ids]
    if not inactive_ids:
        return 0

    # Owned data first, user last: if this is interrupted, the user still
    # matches next run and the rest gets retried.
    for name in USER_OWNED_COLLECTIONS:
        await db[name].delete_many({"user_id": {"$in": inactive_ids}})
    result = await db["users"].delete_many({"_id": {"$in": inactive_ids}})
    return result.deleted_count


async def run_cleanup_forever(db: AsyncIOMotorDatabase) -> None:
    """Run the cleanup now and then once per interval, for as long as the server is up."""
    while True:
        try:
            deleted = await delete_inactive_accounts(db)
            if deleted:
                # print, not logger.info: app loggers below WARNING aren't shown under uvicorn
                print(f"Deleted {deleted} inactive account(s)", flush=True)
        except Exception:
            logger.exception("Inactive account cleanup failed")
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)