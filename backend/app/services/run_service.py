"""
Run Service - Business logic for run management.

Handles run lifecycle: creation, saving, death, and retrieval.
Enforces invariants: one active run per user, immutability after death.
"""
from typing import Optional, Dict, Any
from datetime import datetime
import random
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.run import Run, RunStatus, RunProgress, RunStats, RunResponse, RunProgressResponse, RunStatsResponse
from app.repositories.run_repository import RunRepository
from app.repositories.player_stats_repository import PlayerStatsRepository


class RunService:
    """Service for run-related operations"""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.db = database
        self.run_repo = RunRepository(database)
        self.player_stats_repo = PlayerStatsRepository(database)

    async def get_active_run(self, user_id: ObjectId) -> Optional[Run]:
        """Get the active run for a user (if any)"""
        return await self.run_repo.find_active_by_user_id(user_id)

    async def get_run(self, user_id: ObjectId) -> Optional[Run]:
        """Get any run for a user (active or dead)"""
        return await self.run_repo.find_by_user_id(user_id)

    async def start_new_run(self, user_id: ObjectId, seed: Optional[int] = None) -> Run:
        """
        Start a new run for a user.
        Deletes any existing run first (active or dead).

        Args:
            user_id: User ID
            seed: Optional seed for RNG. If not provided, generates random.

        Returns:
            The newly created Run
        """
        # Delete any existing run (whether active or dead)
        await self.run_repo.delete_by_user_id(user_id)

        # Generate seed if not provided
        if seed is None:
            seed = random.randint(0, 2**31 - 1)

        # Create new run
        new_run = Run(
            user_id=user_id,
            seed=seed,
            status=RunStatus.ACTIVE,
            progress=RunProgress(),
            stats=RunStats()
        )

        created_run = await self.run_repo.create(new_run)

        # Increment games_played in player stats
        player_stats = await self.player_stats_repo.find_by_user_id(user_id)
        if player_stats:
            await self.player_stats_repo.update_by_id(
                player_stats.id,
                {"games_played": player_stats.games_played + 1}
            )

        print(f"[RUN] Started new run {created_run.run_id} for user {user_id} with seed {seed}")
        return created_run

    async def save_progress(
        self,
        user_id: ObjectId,
        run_id: str,
        progress: Dict[str, Any],
        stats: Dict[str, Any]
    ) -> bool:
        """
        Save run progress atomically.
        Only succeeds if run is active and belongs to user.

        Args:
            user_id: User ID
            run_id: Run ID to update
            progress: Progress data (wave, points, upgrades, kills)
            stats: Stats data (totalDamage, totalTimeSurvived)

        Returns:
            True if save succeeded, False otherwise
        """
        # Validate and construct progress/stats objects
        run_progress = RunProgress(
            wave=progress.get("wave", 0),
            points=progress.get("points", 0),
            upgrades=progress.get("upgrades", []),
            kills=progress.get("kills", 0)
        )

        run_stats = RunStats(
            totalDamage=stats.get("totalDamage", 0),
            totalTimeSurvived=stats.get("totalTimeSurvived", 0)
        )

        success = await self.run_repo.atomic_save(
            run_id=run_id,
            user_id=user_id,
            progress=run_progress,
            stats=run_stats
        )

        if success:
            print(f"[RUN] Saved progress for run {run_id}: wave={run_progress.wave}, points={run_progress.points}")
        else:
            print(f"[RUN] Failed to save progress for run {run_id} - run may be dead or not found")

        return success

    async def end_run(
        self,
        user_id: ObjectId,
        run_id: str,
        final_progress: Dict[str, Any],
        final_stats: Dict[str, Any]
    ) -> bool:
        """
        Mark run as dead with final snapshot.
        Atomically transitions status to dead.

        Args:
            user_id: User ID
            run_id: Run ID to end
            final_progress: Final progress data
            final_stats: Final stats data

        Returns:
            True if ended successfully, False otherwise
        """
        run_progress = RunProgress(
            wave=final_progress.get("wave", 0),
            points=final_progress.get("points", 0),
            upgrades=final_progress.get("upgrades", []),
            kills=final_progress.get("kills", 0)
        )

        run_stats = RunStats(
            totalDamage=final_stats.get("totalDamage", 0),
            totalTimeSurvived=final_stats.get("totalTimeSurvived", 0)
        )

        success = await self.run_repo.mark_dead(
            run_id=run_id,
            user_id=user_id,
            final_progress=run_progress,
            final_stats=run_stats
        )

        if success:
            print(f"[RUN] Ended run {run_id}: wave={run_progress.wave}, kills={run_progress.kills}")
            # Update player stats with run results
            await self._update_player_stats_on_death(user_id, run_progress, run_stats)
        else:
            print(f"[RUN] Failed to end run {run_id} - already dead or not found")

        return success

    async def add_upgrade(
        self,
        user_id: ObjectId,
        run_id: str,
        upgrade_id: str,
        cost: int
    ) -> Optional[Run]:
        """
        Add an upgrade to the run and deduct points.
        Appends to upgrades list (append-only).

        Args:
            user_id: User ID
            run_id: Run ID
            upgrade_id: Upgrade to add
            cost: Points to deduct

        Returns:
            Updated Run if successful, None otherwise
        """
        # Get current run
        run = await self.run_repo.find_active_by_user_id(user_id)
        if not run or run.run_id != run_id:
            return None

        # Check if user has enough points
        if run.progress.points < cost:
            return None

        # Append upgrade and deduct points
        new_upgrades = run.progress.upgrades + [upgrade_id]
        new_points = run.progress.points - cost

        updated_run = await self.run_repo.update_progress(
            run_id=run_id,
            user_id=user_id,
            upgrades=new_upgrades,
            points=new_points
        )

        if updated_run:
            print(f"[RUN] Added upgrade {upgrade_id} to run {run_id}, points: {run.progress.points} -> {new_points}")

        return updated_run

    async def _update_player_stats_on_death(
        self,
        user_id: ObjectId,
        progress: RunProgress,
        stats: RunStats
    ):
        """Update permanent player stats when a run ends"""
        player_stats = await self.player_stats_repo.find_by_user_id(user_id)
        if not player_stats:
            return

        await self.player_stats_repo.update_by_id(
            player_stats.id,
            {
                "total_kills": player_stats.total_kills + progress.kills,
                "total_damage_dealt": player_stats.total_damage_dealt + stats.totalDamage,
                "highest_wave_ever": max(player_stats.highest_wave_ever, progress.wave),
                "total_playtime_seconds": player_stats.total_playtime_seconds + stats.totalTimeSurvived
            }
        )

    @staticmethod
    def to_response(run: Run) -> RunResponse:
        """Convert Run model to API response"""
        progress_response = RunProgressResponse(
            wave=run.progress.wave,
            points=run.progress.points,
            upgrades=run.progress.upgrades,
            kills=run.progress.kills
        )
        stats_response = RunStatsResponse(
            totalDamage=run.stats.totalDamage,
            totalTimeSurvived=run.stats.totalTimeSurvived
        )
        return RunResponse(
            runId=run.run_id,
            status=run.status.value,
            seed=run.seed,
            progress=progress_response,
            stats=stats_response,
            createdAt=run.created_at.isoformat() if run.created_at else datetime.utcnow().isoformat(),
            lastSavedAt=run.last_saved_at.isoformat() if run.last_saved_at else None
        )
