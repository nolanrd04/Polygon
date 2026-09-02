"""
Per-run gameplay analytics: one GameRun document per run, with one embedded
WaveSnapshot appended per validated wave completion.

This is a permanent, append-only balancing dataset - deliberately separate
from GameSave, which is one-per-user and gets deleted whenever a new game
starts. GameRun documents are created at wave 1 (WaveService.start_wave),
grown by $push on every completion (WaveService._save_game_state), finalized
on death, and never deleted.

Every "between wave X and Y" metric is a range-sum over wave_snapshots at
analysis time - nothing here stores interval data separately. See
backend/scripts/analyze_runs.py for the consumption side.
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.base import BaseMongoModel, PyObjectId


# Bump manually whenever a balance-relevant change ships (difficulty curves,
# enemy stats, upgrade values, economy), so runs recorded under different
# tuning don't silently blend together at analysis time.
GAME_VERSION = "0.2.4"


class OfferRoll(BaseModel):
    """One shop offer as recorded into a WaveSnapshot."""
    upgrades: List[str] = Field(default_factory=list)
    # Points held when this roll appeared (see RolledOffer.points_at_roll on
    # the wave token). None for offers recorded before points tracking.
    points_at_roll: Optional[int] = Field(default=None)
    # Slots whose cost exceeded points_at_roll - resolved once at snapshot
    # write time with the costs that were live for THIS run (same
    # historical-correctness reasoning as enemy_total_health_spawned: a
    # future cost rebalance must not rewrite old runs' affordability).
    # Pick-rate analysis excludes these from the denominator - not buying
    # what you couldn't afford isn't a preference signal - and they feed the
    # unaffordable_offers metric. Empty when points_at_roll is unknown.
    unaffordable: List[str] = Field(default_factory=list)


class WaveSnapshot(BaseModel):
    """One completed wave's worth of gameplay data, embedded in a GameRun."""

    wave_number: int = Field(..., ge=1)
    wave_duration_seconds: float = Field(..., ge=0)

    # Stamped at write time (see _record_wave_snapshot), independent of the
    # run's own game_version: a run that straddles a deploy records each wave
    # under the version actually live when it was played. None only in
    # theory (the write path always stamps it) - analysis falls back to the
    # run's version when absent.
    game_version: Optional[str] = Field(default=None)

    # Combat output
    damage_dealt: int = Field(default=0, ge=0)
    damage_taken: int = Field(default=0, ge=0)
    kills: int = Field(default=0, ge=0)
    shots_fired: int = Field(default=0, ge=0)
    hits_primary: int = Field(default=0, ge=0)
    hits_explosion: int = Field(default=0, ge=0)

    # Player build state at wave end (health_start is the value the save
    # carried into the wave; the rest are the server's own derived stats,
    # never client-reported).
    player_health_start: float = Field(default=0)
    player_health_end: float = Field(default=0)
    player_max_health: float = Field(default=100)
    player_speed: int = Field(default=200)
    player_polygon_sides: int = Field(default=3)
    attack_type: str = Field(default="bullet")

    # Theoretical damage OUTPUT from the authorized upgrade list - not
    # realized in-combat damage (that's damage_dealt above, which only
    # counts what actually landed). This is what the build is capable of per
    # discharge: player_projectile_damage is one primary hit's damage
    # (_calculate_max_damage_per_hit's max_primary) times polygon_sides,
    # since Player.shoot() fires one projectile per vertex; player_explosion_damage
    # is max_explosion as-is. Exists to separate "damage stat is scaling too
    # fast" from "landed damage is scaling too fast" - e.g. when a
    # damage-scaled healing upgrade snowballs off the former even while hit
    # rate stays flat.
    player_projectile_damage: float = Field(default=0, ge=0)
    player_explosion_damage: float = Field(default=0, ge=0)

    # Enemy pressure - computed once at write time from the difficulty curve
    # that was actually active for THIS run, so the value stays historically
    # correct across future balance patches (recomputing on demand would
    # silently apply today's formula to old runs).
    enemy_total_health_spawned: int = Field(default=0, ge=0)

    # Difficulty.get_health_multiplier(wave-1) - the PER-UNIT enemy health
    # curve (exp(wave/8) on Normal), independent of enemy count/composition.
    # enemy_total_health_spawned conflates this with how many enemies spawn
    # and which (bigger) types unlock at higher waves, which dominates its
    # growth - comparing player_projectile_damage/player_explosion_damage
    # against THIS instead isolates "is my damage stat outscaling the
    # official per-enemy difficulty curve" from "is it outscaling total wave
    # pressure", which conflates enemy-count/composition design choices in.
    enemy_health_multiplier: float = Field(default=1.0, ge=0)

    # Economy
    points_earned: int = Field(default=0, ge=0)
    points_spent: int = Field(default=0, ge=0)  # shop upgrade costs paid this wave
    rerolls: int = Field(default=0, ge=0)
    reroll_points_spent: int = Field(default=0, ge=0)

    # Build trajectory. upgrade_offers is every shop offer shown this wave in
    # roll order - the wave-start roll plus one entry per reroll (mirrored
    # from the token's offers_rolled, with affordability resolved - see
    # OfferRoll) - so pick rate can count rerolled-away offers as "seen and
    # not picked". Bundle/milestone grants are forced random upgrades, not
    # choices, so they appear only in upgrades_obtained_free and never in
    # offers or pick rates.
    upgrade_offers: List[OfferRoll] = Field(default_factory=list)
    upgrades_purchased: List[str] = Field(default_factory=list)  # shop buys
    upgrades_obtained_free: List[str] = Field(default_factory=list)  # bundles + milestones

    # Anti-cheat context, recorded rather than filtered - the analysis-time
    # exclusion threshold (e.g. "drop high/critical only") stays a query-time
    # decision instead of being locked in at write time. Note critical-flagged
    # submissions never reach the snapshot writer at all (complete_wave skips
    # the whole save path), so "critical" only appears here alongside a
    # non-blocking severity mix that still validated.
    flag_count: int = Field(default=0, ge=0)
    highest_flag_severity: Optional[str] = Field(default=None)  # low|medium|high|critical

    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class GameRun(BaseMongoModel):
    """One playthrough, from wave 1 until death (or abandonment)."""

    user_id: PyObjectId = Field(...)
    seed: int = Field(...)
    difficulty_id: str = Field(default="normal")
    game_version: str = Field(default=GAME_VERSION)

    # "active" while being played; "dead" once finalized by a death
    # submission; "abandoned" when a new run starts while this one was still
    # active (save deleted mid-run) - abandoned runs keep their snapshots but
    # never get death-time totals.
    status: str = Field(default="active")

    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = Field(default=None)
    final_wave: Optional[int] = Field(default=None)  # mirrors DeathFrozenState.waves_completed

    # Not populated yet - waits on a proper death system that records what
    # killed the player (today a death is just is_death=True). Field exists
    # now so no migration is needed when that ships.
    death_cause: Optional[str] = Field(default=None)

    # Denormalized at finalize time for cheap listing - authoritative values
    # are always derivable from wave_snapshots.
    total_kills: Optional[int] = Field(default=None)
    total_damage_dealt: Optional[int] = Field(default=None)
    total_damage_taken: Optional[int] = Field(default=None)
    total_points_earned: Optional[int] = Field(default=None)
    total_time_seconds: Optional[int] = Field(default=None)  # wall clock, mirrors DeathFrozenState.time_survived

    wave_snapshots: List[WaveSnapshot] = Field(default_factory=list)
