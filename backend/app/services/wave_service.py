"""
Wave validation and anti-cheat service.
Handles wave start, completion validation, and suspicious activity flagging.
"""

from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import math
import random
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.wave_token import WaveValidationToken
from app.models.player_stats import PlayerStats
from app.models.flagged_wave import FlaggedWave, FlagReason
from app.models.game_save import GameSave, DeathFrozenState
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.repositories.game_save_repository import GameSaveRepository
from app.core.upgrade_data import UPGRADES, can_apply_upgrade, get_upgrade
from app.core.enemy_data import calculate_minimum_damage_required, validate_enemy_spawn, get_enemy_score_chance, get_split_children, get_enemy_bundle_drop_chance
from app.core.projectile_data import (
    resolve_active_projectile,
    get_fire_cooldown_ms,
    get_base_damage,
    get_base_pierce,
    get_pellet_range,
    get_explosion_defaults,
)
from app.core.difficulty import get_difficulty
from app.core.difficulty.base import Difficulty


class WaveService:
    """Service for wave-related operations and validation"""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.db = database
        self.wave_tokens_collection = database["wave_validation_tokens"]
        self.flagged_waves_collection = database["flagged_waves"]
        self.player_stats_repo = PlayerStatsRepository(database)
        self.game_save_repo = GameSaveRepository(database)

    async def start_wave(
        self,
        user_id: ObjectId,
        username: str,
        wave_number: int,
        seed: int
    ) -> Tuple[WaveValidationToken, List[Dict[str, Any]]]:
        """
        Start a new wave - generate token and roll upgrades.

        Returns:
            (validation_token, offered_upgrades)
        """
        # Get player stats (create if doesn't exist)
        player_stats = await self.player_stats_repo.find_by_user_id(user_id)
        if not player_stats:
            # Auto-create player stats if missing (e.g., after database clear)
            from app.models.player_stats import PlayerStats
            player_stats = PlayerStats(user_id=user_id)
            player_stats = await self.player_stats_repo.create(player_stats)
            print(f"Auto-created player stats for user {user_id}")

        # Get current game save to check current upgrades
        game_save = await self.game_save_repo.find_by_user_id(user_id)
        current_upgrades = game_save.current_upgrades if game_save else []
        difficulty = get_difficulty(game_save.difficulty_id if game_save else "normal")

        # Check if upgrades have already been offered for this wave (prevent reroll exploit)
        if game_save and game_save.current_wave == wave_number and game_save.offered_upgrades:
            # Use existing offered upgrades (player is resuming/reloading)
            print(f"Using existing offered upgrades for wave {wave_number}: {[u.id for u in game_save.offered_upgrades]}")
            from app.core.upgrade_data import get_upgrade
            from app.models.game_save import OfferedUpgrade
            # Return full upgrade data WITH purchased status
            offered_upgrades = [
                {**get_upgrade(u.id), "purchased": u.purchased}
                for u in game_save.offered_upgrades
            ]
            # Store the OfferedUpgrade objects for later use
            offered_upgrade_objs = game_save.offered_upgrades
        else:
            # Roll new upgrades (first time starting this wave)
            offered_upgrades = self._roll_upgrades(
                current_upgrades=current_upgrades,
                attack_type=game_save.current_attack_type if game_save else "bullet",
                wave_number=wave_number,
                difficulty=difficulty
            )
            print(f"Rolled new upgrades for wave {wave_number}: {[u['id'] for u in offered_upgrades]}")

            # Create OfferedUpgrade objects with purchased=False
            from app.models.game_save import OfferedUpgrade
            offered_upgrade_objs = [
                OfferedUpgrade(id=u["id"], purchased=False)
                for u in offered_upgrades
            ]

            # Save the offered upgrades to prevent reroll
            if game_save:
                await self.game_save_repo.update_by_id(
                    game_save.id,
                    {"offered_upgrades": [u.model_dump() for u in offered_upgrade_objs]}
                )
            # Note: For wave 1, we'll save it when creating the game save below

        # Create validation token with actual player stats based on upgrades
        player_stats_dict = self._calculate_player_stats_from_upgrades(current_upgrades)

        token = WaveValidationToken.create_for_wave(
            user_id=user_id,
            wave_number=wave_number,
            player_stats=player_stats_dict,
            current_upgrades=current_upgrades,
            offered_upgrades=[u["id"] for u in offered_upgrades],
            seed=seed,
            # No point outliving the user's own login session - a request
            # after this would already be rejected by get_current_user first.
            # Real anti-cheat protection against "hold the token open to
            # inflate my apparent play time" lives in the capped elapsed-time
            # fed to the fire-rate ceiling in complete_wave(), not here.
            expiry_seconds=self.WAVE_TOKEN_LIFETIME_SECONDS
        )

        # Save token to database
        token_dict = token.to_dict(exclude_none=True)
        await self.wave_tokens_collection.insert_one(token_dict)

        # Create game save if it doesn't exist (for wave 1)
        if wave_number == 1 and not game_save:
            new_save = GameSave(
                user_id=user_id,
                current_wave=1,
                current_points=70,  # matches the client's new-game starting bonus
                seed=seed,
                current_health=100,
                current_max_health=100,
                current_speed=200,
                current_polygon_sides=3,
                current_kills=0,
                current_upgrades=[],
                offered_upgrades=offered_upgrade_objs,
                unlocked_attacks=["bullet"]
            )
            await self.game_save_repo.create(new_save)
            print(f"Created new game save for user {user_id} at wave 1 with offered upgrades")

        return token, offered_upgrades

    async def complete_wave(
        self,
        user_id: ObjectId,
        username: str,
        token_string: str,
        wave_data: Dict[str, Any],
        is_death: bool = False
    ) -> Tuple[bool, List[str], Optional[int]]:
        """
        Validate and complete a wave submission.

        Args:
            user_id: User ID
            username: Username for flagging
            token_string: Wave validation token
            wave_data: Submitted wave data (kills, damage, frames, etc.)

        Returns:
            (is_valid, error_messages, current_points)
            current_points is the authoritative post-credit total on success,
            None on any failure path (nothing was credited).
        """
        print(f"=== WAVE COMPLETION START ===", flush=True)
        print(f"Wave data received: kills={wave_data.get('kills')}, damage={wave_data.get('total_damage')}, wave={wave_data.get('wave')}", flush=True)

        # Atomically find-and-mark-used so two concurrent /complete calls with
        # the same token can't both pass validation before either is marked
        # used (the old find_one + separate update_one had a TOCTOU race).
        # The filter also enforces expiry here, since expires_at was
        # previously stored but never actually checked.
        now = datetime.utcnow()
        token_doc = await self.wave_tokens_collection.find_one_and_update(
            {"token": token_string, "used": False, "expires_at": {"$gt": now}},
            {"$set": {"used": True, "used_at": now}}
        )
        if not token_doc:
            existing = await self.wave_tokens_collection.find_one({"token": token_string})
            if not existing:
                print("ERROR: Token not found", flush=True)
                return False, ["Invalid or missing wave token"], None
            print(f"Token invalid: expired={existing.get('expires_at')}, used={existing.get('used')}", flush=True)
            return False, ["Token expired or already used"], None

        token = WaveValidationToken.from_mongo(token_doc)
        print(f"Token found for wave {token.wave_number}", flush=True)

        if str(token.user_id) != str(user_id):
            print(f"User ID mismatch: token={token.user_id}, user={user_id}", flush=True)
            return False, ["Token user mismatch"], None

        print(f"Starting validations...", flush=True)

        wave_duration_seconds = (now - token.created_at).total_seconds()

        # Perform validations
        flags: List[FlagReason] = []

        # 1. Validate upgrades used
        upgrades_used = wave_data.get("upgrades_used", [])
        # Valid upgrades = the server's own record of what this user has
        # legitimately purchased (app/api/waves.py:select_upgrade already
        # validates every purchase against the offered set + can_apply_upgrade
        # at buy time). token.allowed_upgrades/offered_upgrades are only a
        # snapshot from /waves/start — stale the moment a player rerolls and
        # buys from a later offer, which flagged perfectly legitimate
        # purchases as "unauthorized". Fall back to the token snapshot only
        # if no game save exists yet (e.g. the very first wave).
        game_save = await self.game_save_repo.find_by_user_id(user_id)
        if game_save:
            # Union in this wave's own bundle grants (see
            # collect_upgrade_bundle) - they're intentionally never written
            # to the save until this very completion persists them below,
            # so they wouldn't otherwise show up in current_upgrades yet.
            valid_upgrades = set(game_save.current_upgrades) | set(token.bundle_upgrades)
        else:
            valid_upgrades = set(token.allowed_upgrades + token.offered_upgrades) | set(token.bundle_upgrades)
        difficulty = get_difficulty(game_save.difficulty_id if game_save else "normal")
        print(f"Validating upgrades: {upgrades_used} vs valid: {valid_upgrades}")
        print(f"DEBUG - Token allowed_upgrades: {token.allowed_upgrades}")
        print(f"DEBUG - Token offered_upgrades: {token.offered_upgrades}")
        for upgrade_id in upgrades_used:
            if upgrade_id not in valid_upgrades:
                print(f"DEBUG - Unauthorized upgrade '{upgrade_id}' - exists in UPGRADES: {upgrade_id in UPGRADES}")
                flags.append(FlagReason(
                    category="upgrades",
                    severity="high",
                    description=f"Unauthorized upgrade used: {upgrade_id}",
                    expected=list(valid_upgrades),
                    actual=upgrades_used
                ))

        # Drop unauthorized upgrades before they influence anything downstream
        # (movement/damage capability calculations, and the save itself) —
        # the wave's legitimate progress shouldn't be lost over one bad entry,
        # but the unauthorized upgrade itself must never be credited.
        authorized_upgrades_used = [u for u in upgrades_used if u in valid_upgrades]
        wave_data["upgrades_used"] = authorized_upgrades_used

        # 2. Validate fire rate - each shots_fired entry must be spaced by at
        # least the weapon's cooldown. This gates the hit-count ceiling below
        # (shot_count is only trustworthy once this passes) and is itself
        # independent of elapsed real time, so it can't be gamed by simply
        # holding a token open.
        shots_fired = wave_data.get("shots_fired", [])
        attack_type = game_save.current_attack_type if game_save else "bullet"
        active_projectile = resolve_active_projectile(attack_type, authorized_upgrades_used)
        fire_rate_flags = self._validate_fire_rate(shots_fired, active_projectile)
        print(f"Fire rate validation flags: {len(fire_rate_flags)}")
        flags.extend(fire_rate_flags)

        # 3. Validate damage
        damage_flags = self._validate_damage(
            wave_data.get("total_damage", 0),
            wave_data.get("kills", 0),
            wave_data.get("enemy_deaths", []),
            token.wave_number,
            difficulty,
            wave_data.get("hits", {}),
            authorized_upgrades_used,
            len(shots_fired)
        )
        print(f"Damage validation flags: {len(damage_flags)}")
        flags.extend(damage_flags)

        # 4. Validate movement (frame-by-frame)
        # Recalculate player speed based on upgrades used (not token's initial speed)
        actual_player_stats = self._calculate_player_stats_from_upgrades(authorized_upgrades_used)
        dash_stats = self._calculate_dash_stats_from_upgrades(authorized_upgrades_used)
        print(f"DEBUG - Validating movement with speed: {actual_player_stats.get('speed', 200)} (from {len(authorized_upgrades_used)} upgrades), dash={dash_stats}")
        movement_flags = self._validate_movement(
            wave_data.get("frame_samples", []),
            actual_player_stats.get("speed", 200),
            dash_stats
        )
        print(f"Movement validation flags: {len(movement_flags)}")
        flags.extend(movement_flags)

        # 5. Validate kill counts
        kill_flags = self._validate_kills(
            wave_data.get("kills", 0),
            token.wave_number,
            difficulty,
            wave_data.get("enemy_deaths", [])
        )
        print(f"Kill validation flags: {len(kill_flags)}")
        flags.extend(kill_flags)

        # 6. Validate that every reported enemy type could actually spawn on
        # this wave (min_wave / boss-only gating) — closes the gap where an
        # arbitrary/impossible enemy type in enemy_deaths passed silently.
        enemy_type_flags = self._validate_enemy_types(
            wave_data.get("enemy_deaths", []),
            token.wave_number
        )
        print(f"Enemy type validation flags: {len(enemy_type_flags)}")
        flags.extend(enemy_type_flags)

        # 7. Validate/clamp reported score against a 100%-drop-rate ceiling
        # computed from the same validated enemy_deaths, and flag (never
        # block) implausible divergence from expected drop odds.
        points_flags, credited_points = self._validate_points(
            wave_data.get("points_earned", 0),
            wave_data.get("enemy_deaths", [])
        )
        print(f"Points validation flags: {len(points_flags)}, credited: {credited_points}")
        flags.extend(points_flags)

        print(f"Total flags: {len(flags)}, High severity: {len([f for f in flags if f.severity in ['high', 'critical']])}")

        # Token was already atomically marked used above.

        # If flags detected, save to flagged_waves
        if flags:
            await self._flag_wave(user_id, username, token.wave_number, flags, wave_data, token.to_dict())

        # Determine if wave is valid (allow minor flags)
        high_severity_flags = [f for f in flags if f.severity in ["high", "critical"]]
        critical_flags = [f for f in flags if f.severity == "critical"]

        # Update player stats even if there are some flags (unless critical)
        # This prevents legitimate players from losing progress due to minor validation issues
        new_current_points = None
        if not critical_flags:
            kills = wave_data.get("kills", 0)
            damage = wave_data.get("total_damage", 0)
            damage_taken = wave_data.get("damage_taken", 0)
            print(f"Updating stats - Kills: {kills}, Damage: {damage}, Wave: {token.wave_number}, Duration: {wave_duration_seconds}s, Damage Taken: {damage_taken}")

            await self._update_player_stats_after_wave(
                user_id,
                kills,
                damage,
                token.wave_number,
                int(wave_duration_seconds),
                damage_taken
            )

            # Wave-completion bonus is a pure function of the (already
            # authoritative) wave number, so it's computed server-side rather
            # than trusted from the client. Skipped on death since a died-in
            # wave was never completed.
            wave_bonus = 0 if is_death else min(55, 25 + token.wave_number * 2)
            points_earned_total = wave_bonus + credited_points

            # Evolution milestone (WaveManager.ts: every 6th completed wave
            # grants +1 polygon side for free, no purchase). It's a pure
            # function of wave_number so it's computed server-side rather
            # than trusted from the client - same reasoning as wave_bonus
            # above, and skipped on death for the same reason. The client
            # applies it locally *after* submitting the wave it fires on, so
            # it's never in that wave's own upgrades_used - it only needs to
            # be authorized starting the NEXT wave, which is exactly when
            # _save_game_state below folds it into current_upgrades.
            milestone_upgrade = (
                "polygon_upgrade" if not is_death and token.wave_number % 6 == 0 else None
            )

            # Create/update game save after wave completion
            new_current_points = await self._save_game_state(
                user_id, wave_data, token.wave_number, points_earned_total, is_death,
                token.bundle_upgrades, milestone_upgrade
            )
        else:
            print(f"CRITICAL FLAGS DETECTED - Stats not updated: {critical_flags}")

        # Return validation result
        if high_severity_flags:
            print(f"Wave validation FAILED: {[f.description for f in high_severity_flags]}")
            return False, [f.description for f in high_severity_flags], new_current_points

        print(f"=== WAVE COMPLETION SUCCESS ===")
        return True, [], new_current_points

    async def reroll_upgrades(
        self,
        user_id: ObjectId,
        current_upgrades: List[str],
        attack_type: str,
        wave_number: int,
        difficulty_id: str = "normal"
    ) -> Dict[str, Any]:
        """
        Reroll upgrades for the current wave.
        Returns both the upgrade dicts and the OfferedUpgrade objects.
        """
        difficulty = get_difficulty(difficulty_id)

        # Roll new upgrades
        offered_upgrades = self._roll_upgrades(
            current_upgrades=current_upgrades,
            attack_type=attack_type,
            wave_number=wave_number,
            difficulty=difficulty
        )
        print(f"Rerolled upgrades for user {user_id}: {[u['id'] for u in offered_upgrades]}")

        # Create OfferedUpgrade objects with purchased=False
        from app.models.game_save import OfferedUpgrade
        offered_upgrade_objs = [
            OfferedUpgrade(id=u["id"], purchased=False)
            for u in offered_upgrades
        ]

        return {
            "offered_upgrades": offered_upgrades,
            "offered_upgrade_objs": [u.model_dump() for u in offered_upgrade_objs]
        }

    def _roll_upgrades(
        self,
        current_upgrades: List[str],
        attack_type: str,
        wave_number: int,
        difficulty: Difficulty,
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Roll random upgrades based on per-wave rarity weights"""
        # Curses and visual effects are never part of the wave-start offer:
        # curses only surface through the client-side mid-wave bundle pickup,
        # and the frontend's offer-screen lookup table excludes both (see
        # UpgradeModal.loadBackendUpgrades / WaveValidation's offline roll) —
        # rolling them here made the backend hand out ids the frontend
        # couldn't resolve, silently shrinking the offer below `count`.
        available_upgrades = [
            upgrade for upgrade in UPGRADES.values()
            if not upgrade.get("curse")
            and upgrade.get("type") != "visual_effect"
            and can_apply_upgrade(upgrade["id"], current_upgrades, attack_type)
        ]

        if not available_upgrades:
            return []

        selected = []
        attempts = 0
        max_attempts = 100

        while len(selected) < count and attempts < max_attempts:
            # Pick rarity
            rarity = self._pick_rarity(wave_number, difficulty)

            # Filter by rarity
            rarity_upgrades = [u for u in available_upgrades if u["rarity"] == rarity]

            if rarity_upgrades:
                upgrade = random.choice(rarity_upgrades)

                # Avoid duplicates (unless stackable)
                if upgrade not in selected or upgrade.get("stackable"):
                    selected.append(upgrade)

            attempts += 1

        return selected[:count]

    def _pick_rarity(self, wave_number: int, difficulty: Difficulty) -> str:
        """Pick a rarity based on the per-wave rarity weights"""
        return self._weighted_rarity_choice(difficulty.get_rarity_weights(wave_number))

    def _weighted_rarity_choice(self, weights: Dict[str, float]) -> str:
        """Pick a rarity from an arbitrary weights dict (rarity -> probability)"""
        rand = random.random()
        cumulative = 0.0

        for rarity, weight in weights.items():
            cumulative += weight
            if rand < cumulative:
                return rarity

        return "common"

    def _sum_stat_modifiers(
        self,
        current_upgrades: List[str],
        target: str,
        stat: str
    ) -> Tuple[float, float]:
        """
        Sum flat and percent stat_modifier upgrades for a given (target, stat)
        pair. Mirrors UpgradeModifierSystem.addModifier's linear-sum semantics
        for ordinary multiplicative stats ("5%+5%=10%, not 10.25%") — this is
        the accumulation rule every stat_modifier upgrade follows UNLESS its
        class overrides onApply() with a custom hook. The one confirmed
        exception (explosion_damage_percent_* compounding per stack instead)
        is deliberately NOT routed through this helper — see
        _calculate_max_damage_per_hit.

        Returns (flat_total, percent_total). Caller combines as
        (base + flat_total) * (1 + percent_total).
        """
        flat_total = 0.0
        percent_total = 0.0

        for upgrade_id in current_upgrades:
            upgrade = UPGRADES.get(upgrade_id)
            if not upgrade or upgrade.get("type") != "stat_modifier":
                continue
            if upgrade.get("target") != target or upgrade.get("stat") != stat:
                continue

            value = upgrade.get("value", 0)
            if upgrade.get("isMultiplier", False):
                percent_total += value
            else:
                flat_total += value

        return flat_total, percent_total

    # Player stats this method derives, and the upgrade `stat` name each maps
    # to (see _sum_stat_modifiers).
    PLAYER_STAT_MAPPING = {
        "speed": "speed",
        "maxHealth": "max_health",
        "health": "health",
        "polygonSides": "polygon_sides"
    }

    def _calculate_player_stats_from_upgrades(self, current_upgrades: List[str]) -> Dict[str, float]:
        """Calculate player stats based on applied upgrades"""
        stats = {
            "health": 100,
            "max_health": 100,
            "speed": 200,
            "damage": 10,
            "polygon_sides": 3
        }

        for player_stat, stat_key in self.PLAYER_STAT_MAPPING.items():
            flat, percent = self._sum_stat_modifiers(current_upgrades, "player", player_stat)
            stats[stat_key] = (stats[stat_key] + flat) * (1 + percent)

        print(f"Calculated player stats from {len(current_upgrades)} upgrades: speed={stats['speed']}, max_health={stats['max_health']}")
        return stats

    # Dash mechanics mirror frontend/src/game/entities/Player.ts exactly (base
    # values + charge/cooldown recurrence at Player.ts:632-692) — see
    # dash_ability/dash_speed_*/dash_cooldown_*/double_dash/triple_dash in
    # app/core/data/upgrades.json for the upgrade values applied below.
    DASH_BASE_SPEED = 500.0
    DASH_BASE_COOLDOWN_MS = 1500.0
    DASH_DURATION_MS = 200.0

    def _calculate_dash_stats_from_upgrades(self, current_upgrades: List[str]) -> Dict[str, float]:
        """
        Calculate the player's max legitimate dash burst speed, cooldown, and
        charge count from owned upgrades. Dash is entirely gated on owning
        dash_ability (Player.ts:634, UpgradeEffectSystem.hasAbility('dash')) —
        without it, max_dash_charges is 0 and dash contributes nothing.
        """
        if "dash_ability" not in current_upgrades:
            return {
                "max_dash_speed": 0.0,
                "dash_cooldown_ms": self.DASH_BASE_COOLDOWN_MS,
                "dash_duration_ms": 0.0,
                "max_dash_charges": 0,
            }

        _, speed_percent = self._sum_stat_modifiers(current_upgrades, "player", "dashSpeed")
        _, cooldown_percent = self._sum_stat_modifiers(current_upgrades, "player", "dashCooldown")

        max_dash_charges = 1
        if "triple_dash" in current_upgrades:
            max_dash_charges = 3
        elif "double_dash" in current_upgrades:
            max_dash_charges = 2

        return {
            "max_dash_speed": self.DASH_BASE_SPEED * (1 + speed_percent),
            "dash_cooldown_ms": self.DASH_BASE_COOLDOWN_MS * (1 + cooldown_percent),
            "dash_duration_ms": self.DASH_DURATION_MS,
            "max_dash_charges": max_dash_charges,
        }

    def _try_consume_dash_bursts(
        self,
        count: int,
        window_start_ms: float,
        window_end_ms: float,
        slot_ready_times: List[float],
        queue_tail_ms: float,
        cooldown_ms: float
    ) -> Tuple[bool, List[float], float]:
        """
        Attempt to consume `count` dash charges with each use's earliest
        possible time falling within [window_start_ms, window_end_ms].

        Mirrors Player.ts:674-684's recharge queue exactly: every charge use
        (regardless of which of the up-to-3 slots is used) schedules its next
        ready time off the shared queue tail, not off "now" — so charges
        cannot all recharge in parallel even with 3 max charges. Returns
        (ok, new_slot_ready_times, new_queue_tail); state is unchanged if not ok.
        """
        slots = list(slot_ready_times)
        tail = queue_tail_ms
        cursor = window_start_ms

        for _ in range(count):
            idx = min(range(len(slots)), key=lambda i: slots[i])
            available_at = max(cursor, slots[idx])
            if available_at > window_end_ms:
                return False, slot_ready_times, queue_tail_ms
            new_ready = max(available_at, tail) + cooldown_ms
            slots[idx] = new_ready
            tail = new_ready
            cursor = available_at

        return True, slots, tail

    # Per-projectile damage/pierce/cooldown/pellet-count all come from
    # app/core/projectile_data.py / app/core/data/projectiles.json - only
    # bullet is currently selectable, and no upgrade currently changes fire
    # rate for any projectile.
    # Grace on the minimum gap between consecutive shots, for client clock/
    # event-loop jitter - same spirit as the movement check's 10% tolerance.
    FIRE_RATE_TOLERANCE = 0.15

    # A wave token's own expiry doesn't need to model wave-specific timing at
    # all - there's no benefit to it outliving the user's own login session
    # (a stale auth token would already be rejected first), so it's just set
    # to match access_token_expire_minutes. The fire-rate ceiling no longer
    # depends on elapsed real time at all (see _validate_fire_rate /
    # shots_fired below), so there's nothing left for a long-lived token to
    # exploit by sitting unsubmitted.
    WAVE_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60

    # Bundles are luck-based bonus loot, not a metered resource like kills or
    # shots, so there's no exact count to validate against. Instead we cap
    # grants per wave against a generous multiple of the expected count
    # (enemy_count * drop_chance) - comfortably covers legitimate variance
    # while still bounding a script hammering this endpoint to a small,
    # fixed number of free upgrades instead of unlimited.
    BUNDLE_GRANT_SAFETY_MULTIPLIER = 4
    MIN_BUNDLE_GRANTS_PER_WAVE = 2
    BUNDLE_RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"]

    async def collect_upgrade_bundle(
        self,
        user_id: ObjectId,
        wave_number: int,
        client_bundle_tier: int,
        token_string: str
    ) -> Tuple[bool, List[str], Optional[str]]:
        """
        Roll and grant a mid-wave upgrade-bundle pickup.

        Mirrors MainScene.ts's client-side bundle roll (first slot is a
        regular upgrade at the bundle's tier, remaining slots are 30% curse /
        70% regular at a re-rolled tier <= the bundle's, 1-4 items, no
        duplicate ids within one bundle) so the "at least one item matches
        the bundle's own rarity" guarantee the client displayed still holds.
        The bundle's tier is the client's own claim (it was rolled at drop
        time, before pickup), but clamped to the highest tier this wave's
        difficulty can actually drop - a client can't claim e.g. legendary on
        wave 1. What actually bounds abuse is the per-wave grant cap (see
        BUNDLE_GRANT_SAFETY_MULTIPLIER) via an atomic counter on the wave's
        own (still-open) validation token, not the claimed tier - a
        malicious client always claiming the best plausible tier still only
        gets a handful of grants per wave.

        Free - no cost deducted, same as dev-tool upgrade grants. Recorded
        against this wave's own validation token (bundle_upgrades), NOT the
        game save - it only becomes a permanent part of the save once
        complete_wave() actually completes this wave (success or death),
        same as every other upgrade source. This is deliberate: it lets the
        upgrade apply for the rest of THIS run immediately (the client
        applies it locally right away), while quitting mid-wave without ever
        completing it drops the grant entirely, same as it drops in-progress
        kills/damage - so bundle pickups can't be used to farm permanent
        upgrades by repeatedly grabbing loot and quitting before the wave
        completes.
        """
        game_save = await self.game_save_repo.find_by_user_id(user_id)
        if not game_save:
            return False, [], "No active game found"

        difficulty = get_difficulty(game_save.difficulty_id)

        # Bundle drop chance is per-enemy-type (mirrors Enemy.ts's own
        # bundleDropChance, e.g. hexagon=0.16 vs triangle=0.08), not a single
        # flat wave-level rate - difficulty.get_bundle_drop_chance() is only
        # the fallback for enemy types with no chance of their own. Weight
        # each type's share of this wave's spawn pool by its real drop chance.
        enemy_count = difficulty.get_enemy_count(wave_number)
        spawn_weights = difficulty.get_spawn_weights(wave_number)
        total_weight = sum(w["weight"] for w in spawn_weights) or 1.0
        expected = sum(
            enemy_count * (w["weight"] / total_weight) * get_enemy_bundle_drop_chance(w["type"], difficulty, wave_number)
            for w in spawn_weights
        )
        max_grants = max(
            self.MIN_BUNDLE_GRANTS_PER_WAVE,
            math.ceil(expected * self.BUNDLE_GRANT_SAFETY_MULTIPLIER)
        )

        # Matched by the exact token string (not just user_id + wave_number,
        # which isn't guaranteed unique - a mid-wave reload can leave a
        # second, never-completed token sitting unused for the same wave).
        # Matching the token the client is actually holding guarantees the
        # grant lands where /waves/complete will later look for it.
        token_doc = await self.wave_tokens_collection.find_one_and_update(
            {
                "token": token_string,
                "user_id": user_id,
                "wave_number": wave_number,
                "used": False,
                "bundles_granted": {"$lt": max_grants}
            },
            {"$inc": {"bundles_granted": 1}}
        )
        if not token_doc:
            return False, [], "Bundle grant limit reached for this wave, or wave token invalid/expired"

        token = WaveValidationToken.from_mongo(token_doc)

        # Include this token's own already-granted bundle upgrades (not yet
        # persisted to the save) so back-to-back pickups in the same wave
        # still see each other for dependency/duplicate checks.
        current_upgrades = list(game_save.current_upgrades) + list(token.bundle_upgrades)
        attack_type = game_save.current_attack_type
        picked: List[str] = []

        def pick_from_pool(curse: bool, max_tier: int) -> Optional[str]:
            for tier in range(max_tier, -1, -1):
                rarity = self.BUNDLE_RARITY_ORDER[tier]
                candidates = [
                    u["id"] for u in UPGRADES.values()
                    if bool(u.get("curse")) == curse
                    and u["rarity"] == rarity
                    and u["id"] not in picked
                    and can_apply_upgrade(u["id"], current_upgrades + picked, attack_type)
                ]
                if candidates:
                    return random.choice(candidates)
            return None

        weights = difficulty.get_bundle_rarity_weights(wave_number)
        max_possible_tier = max(
            (t for t, rarity in enumerate(self.BUNDLE_RARITY_ORDER) if weights.get(rarity, 0) > 0),
            default=0
        )
        bundle_tier = max(0, min(client_bundle_tier, max_possible_tier))

        # First slot always a regular upgrade at the bundle's own tier
        # (falls back to lower tiers if that pool is exhausted).
        first = pick_from_pool(curse=False, max_tier=bundle_tier)
        if first:
            picked.append(first)

        weight_sum = sum(weights[self.BUNDLE_RARITY_ORDER[t]] for t in range(bundle_tier + 1)) or 1.0

        def roll_item_tier() -> int:
            roll = random.random() * weight_sum
            for t in range(bundle_tier + 1):
                roll -= weights[self.BUNDLE_RARITY_ORDER[t]]
                if roll <= 0:
                    return t
            return 0

        count = random.randint(1, 4)
        for _ in range(1, count):
            tier = roll_item_tier()
            is_curse = random.random() < 0.3
            item = pick_from_pool(curse=is_curse, max_tier=tier)
            if item:
                picked.append(item)

        if not picked:
            return True, [], None

        await self.wave_tokens_collection.update_one(
            {"_id": token_doc["_id"]},
            {"$push": {"bundle_upgrades": {"$each": picked}}}
        )

        return True, picked, None

    def _calculate_max_damage_per_hit(self, current_upgrades: List[str]) -> Dict[str, float]:
        """
        Max legitimate damage for a single primary hit and a single explosion
        hit, from owned upgrades. Mirrors CollisionManager.ts's damage
        pipeline, which applies two independent modifier pools in sequence:

        1. A "bullet"-target pool (bullet_damage_*: flat, e.g. "+1 bullet
           damage"; shattered_bullet_* curses) - this is the primary hit's OWN
           damage, and is NOT applied to explosions (CollisionManager gates it
           on `projectile.damageSource !== 'explosion'` - explosions already
           got their own damage from the modifyExplosion hook below, and
           re-adding the primary's own bullet-specific bonus would double it).
        2. An "attack"-target pool (damage_*: percent, genuinely universal -
           no attack-type restriction on purchase; damage_reduc_* curses) -
           applied to BOTH the primary hit and the explosion, since this one
           really is meant to buff all damage sources equally.

        Explosion damage additionally has its own upgrades that bypass both
        generic pools entirely: each owned instance's modifyExplosion hook
        runs sequentially against a shared explosion object
        (explosion_damage_*.ts: flat variants do `explosion.damage += value`,
        percent variants do `explosion.damage *= 1 + value`). Percent
        instances therefore COMPOUND per stack rather than summing into one
        combined percentage - two 5% stacks yield 1.05*1.05=1.1025x, not
        1.10x. The ceiling-maximizing order (given any purchase-order
        interleaving) is flats-first-then-percents, since adding before
        multiplying never decreases the result for positive values.
        NOTE: Currently assumes bullet attack type, like _validate_damage.
        """
        active_projectile = resolve_active_projectile("bullet", current_upgrades)
        primary_base = get_base_damage(active_projectile)

        flat_bullet, percent_bullet = self._sum_stat_modifiers(current_upgrades, "bullet", "damage")
        flat_attack, percent_attack = self._sum_stat_modifiers(current_upgrades, "attack", "damage")

        # Flat explosion-damage upgrades follow the generic linear-sum rule
        # (safe to route through the shared helper); percent ones don't -
        # see the compounding note above - so they're accumulated separately.
        flat_explosion, _ = self._sum_stat_modifiers(current_upgrades, "bullet", "explosionDamage")
        explosion_multiplier = 1.0
        for upgrade_id in current_upgrades:
            upgrade = UPGRADES.get(upgrade_id)
            if (
                upgrade
                and upgrade.get("type") == "stat_modifier"
                and upgrade.get("target") == "bullet"
                and upgrade.get("stat") == "explosionDamage"
                and upgrade.get("isMultiplier", False)
            ):
                explosion_multiplier *= (1 + upgrade.get("value", 0))

        max_primary = (primary_base + flat_bullet) * (1 + percent_bullet)
        max_primary = (max_primary + flat_attack) * (1 + percent_attack)

        max_explosion = (get_explosion_defaults()["damage"] + flat_explosion) * explosion_multiplier
        max_explosion = (max_explosion + flat_attack) * (1 + percent_attack)

        return {
            "max_primary": max_primary,
            "max_explosion": max_explosion,
        }

    def _calculate_max_hits_per_shot(self, current_upgrades: List[str]) -> int:
        """
        Max enemies a single cooldown-gated Player.shoot() discharge could
        legitimately hit: one projectile per polygon side (Player.ts's vertex
        fanout - polygon_sides itself, not a separate upgrade multiplier),
        times pellets-per-vertex (base max_pellets from projectile data, plus
        denser_shells stacks - only meaningful when buckshot_bullets is
        active, and denser_shells' purchase-time dependency already
        guarantees that), times max unique enemies each projectile can
        pierce (base pierce from projectile data; bullet_pierce_1 stacks add
        +1 each, up to its own maxStacks).
        """
        derived_stats = self._calculate_player_stats_from_upgrades(current_upgrades)
        sides = max(3, min(12, int(derived_stats["polygon_sides"])))

        active_projectile = resolve_active_projectile("bullet", current_upgrades)

        _, base_pellets = get_pellet_range(active_projectile)
        flat_pellets, _ = self._sum_stat_modifiers(current_upgrades, "bullet", "maxPellets")
        pellets = base_pellets + flat_pellets

        flat_pierce, _ = self._sum_stat_modifiers(current_upgrades, "bullet", "pierce")
        pierce = get_base_pierce(active_projectile) + flat_pierce

        return int(sides * pellets * pierce)

    def _validate_fire_rate(self, shots_fired: List[float], projectile: str) -> List[FlagReason]:
        """
        Validate that consecutive weapon discharges respect the active
        projectile's fire cooldown (app/core/projectile_data.py - mirrors
        that projectile class's own SetDefaults() cooldown; see
        resolve_active_projectile for how the active projectile is
        determined from attack_type + owned upgrades). shots_fired is a list
        of ms-since-wave-start timestamps, one per Player.shoot() call that
        passed its own cooldown check client-side (see Player.ts) - NOT one
        per hit (a single discharge can produce many hits at once, see
        _calculate_max_hits_per_shot).
        """
        flags = []
        cooldown_ms = get_fire_cooldown_ms(projectile)
        min_gap_ms = cooldown_ms * (1 - self.FIRE_RATE_TOLERANCE)

        ordered = sorted(shots_fired)
        for i in range(1, len(ordered)):
            gap = ordered[i] - ordered[i - 1]
            if gap < min_gap_ms:
                deviation = ((min_gap_ms - gap) / min_gap_ms) * 100
                flags.append(FlagReason(
                    category="fire_rate",
                    severity="critical" if deviation > 100 else "high",
                    description="Consecutive shots fired faster than the weapon's cooldown allows",
                    expected=min_gap_ms,
                    actual=gap,
                    deviation_percent=deviation
                ))

        return flags

    def _validate_damage(
        self,
        reported_damage: int,
        kills: int,
        enemy_deaths: List[Dict[str, Any]],
        wave: int,
        difficulty: Difficulty,
        hits: Dict[str, int],
        upgrades_used: List[str],
        shot_count: int
    ) -> List[FlagReason]:
        """
        Validate damage dealt is reasonable.
        NOTE: Currently assumes bullet attack type. When other attack types
        (flame, laser, spinner, zapper) are added, minimum-damage calculation
        will need to account for their damage profiles.
        """
        flags = []

        # Calculate enemy type counts
        enemy_counts = {}
        for death in enemy_deaths:
            enemy_type = death.get("type", "triangle")
            enemy_counts[enemy_type] = enemy_counts.get(enemy_type, 0) + 1

        # Calculate minimum required damage
        min_damage = calculate_minimum_damage_required(wave, enemy_counts, difficulty)

        if reported_damage < min_damage * 0.8:
            deviation = ((min_damage - reported_damage) / min_damage) * 100
            flags.append(FlagReason(
                category="damage",
                severity="high" if deviation > 50 else "medium",
                description="Damage dealt is suspiciously low for kills reported",
                expected=min_damage,
                actual=reported_damage,
                deviation_percent=deviation
            ))

        # Hit-count-based ceiling: overkill and AoE fan-out mean total_damage
        # has no meaningful bound relative to enemy health (a single hit can
        # legitimately deal far more than the enemy's remaining HP, and one
        # explosion independently damages every enemy in its radius) — so the
        # ceiling is bounded by how many hits were reported and the max
        # per-hit damage the player's build could produce, not by enemy stats.
        primary_hits = hits.get("primary", 0)
        explosion_hits = hits.get("explosion", 0)
        max_damage_per_hit = self._calculate_max_damage_per_hit(upgrades_used)

        tolerance = 1.2  # Same overkill margin as the floor check above.
        damage_ceiling = tolerance * (
            primary_hits * max_damage_per_hit["max_primary"]
            + explosion_hits * max_damage_per_hit["max_explosion"]
        )

        if reported_damage > damage_ceiling:
            deviation = (
                ((reported_damage - damage_ceiling) / damage_ceiling) * 100
                if damage_ceiling > 0 else 100.0
            )
            flags.append(FlagReason(
                category="damage",
                severity="critical" if deviation > 100 else "high",
                description="Damage dealt exceeds what the reported hits could produce",
                expected=damage_ceiling,
                actual=reported_damage,
                deviation_percent=deviation
            ))

        # Hit-count plausibility: bound primary_hits by the number of
        # validated shots fired (shot_count - already checked for legitimate
        # spacing by _validate_fire_rate, so it can't be inflated without
        # tripping that blocking check first) times the max enemies one
        # discharge could hit given the player's build, so a cheater can't
        # just inflate the `hits` field directly to raise their own ceiling.
        max_hits_per_shot = self._calculate_max_hits_per_shot(upgrades_used)
        max_possible_primary_hits = int(
            shot_count * max_hits_per_shot * tolerance
        ) + 5  # small flat buffer for rounding/edge hits

        if primary_hits > max_possible_primary_hits:
            deviation = (
                ((primary_hits - max_possible_primary_hits) / max_possible_primary_hits) * 100
                if max_possible_primary_hits > 0 else 100.0
            )
            flags.append(FlagReason(
                category="damage",
                severity="critical" if deviation > 100 else "high",
                description="Reported hit count exceeds what fire rate allows",
                expected=max_possible_primary_hits,
                actual=primary_hits,
                deviation_percent=deviation
            ))

        return flags

    def _validate_movement(
        self,
        frame_samples: List[Dict[str, Any]],
        player_speed: float,
        dash_stats: Dict[str, float]
    ) -> List[FlagReason]:
        """
        Validate player movement frame-by-frame, allowing for legitimate dash
        bursts. A single pass walks the frame samples in order and simulates
        the player's dash-charge queue forward through time (see
        _try_consume_dash_bursts) rather than checking each interval in
        isolation — an isolated per-interval check would let a cheater
        "reset" the charge assumption every interval.
        """
        flags = []

        if len(frame_samples) < 2:
            return flags  # Not enough data

        tolerance = 1.10
        max_dash_speed = dash_stats["max_dash_speed"]
        dash_cooldown_ms = dash_stats["dash_cooldown_ms"]
        dash_duration_ms = dash_stats["dash_duration_ms"]
        max_dash_charges = int(dash_stats["max_dash_charges"])

        # Charges assumed fully ready at wave start (idle time between waves).
        slot_ready_times = [0.0] * max_dash_charges
        queue_tail_ms = 0.0

        for i in range(1, len(frame_samples)):
            prev_frame = frame_samples[i - 1]
            curr_frame = frame_samples[i]

            prev_player = prev_frame.get("player", {})
            curr_player = curr_frame.get("player", {})

            # Calculate distance moved
            dx = curr_player.get("x", 0) - prev_player.get("x", 0)
            dy = curr_player.get("y", 0) - prev_player.get("y", 0)
            distance = (dx ** 2 + dy ** 2) ** 0.5

            t_start = prev_frame.get("timestamp", 0)
            t_end = curr_frame.get("timestamp", 0)
            time_delta = (t_end - t_start) / 1000.0

            if time_delta <= 0:
                continue

            base_max_distance = player_speed * time_delta * tolerance

            if distance <= base_max_distance:
                continue  # Explained by base movement alone, no dash needed.

            if max_dash_charges == 0 or max_dash_speed <= player_speed:
                deviation = ((distance - base_max_distance) / base_max_distance) * 100
                flags.append(FlagReason(
                    category="movement",
                    severity="critical" if deviation > 100 else "high",
                    description=f"Player moved faster than possible (frame {curr_frame.get('frame')})",
                    expected=base_max_distance,
                    actual=distance,
                    deviation_percent=deviation
                ))
                continue

            # How much dash-time (bounded by [0, time_delta]) would be needed
            # to explain the reported distance, given base_speed for the rest
            # of the interval and max_dash_speed while dashing.
            dash_time_s = (distance / tolerance - player_speed * time_delta) / (max_dash_speed - player_speed)
            dash_time_s = max(0.0, min(time_delta, dash_time_s))

            # A handful of ms of "dash time" (a couple % over the base
            # tolerance) is ordinary position-sampling noise, not a real
            # dash - a real dash can't be feathered shorter than
            # dash_duration_ms. Without this floor, `max(1, ceil(...))` below
            # would force a full dash-charge availability check to explain
            # noise-level overage, and spuriously fail whenever the player's
            # charge happens to be on cooldown from an earlier, unrelated,
            # perfectly legitimate dash.
            if dash_time_s < (dash_duration_ms / 1000.0) * 0.25:
                continue

            bursts_needed = max(1, math.ceil(dash_time_s / (dash_duration_ms / 1000.0)))

            max_dash_distance = tolerance * (
                max_dash_speed * min(time_delta, bursts_needed * dash_duration_ms / 1000.0)
                + player_speed * max(0.0, time_delta - bursts_needed * dash_duration_ms / 1000.0)
            )

            ok, new_slots, new_tail = False, slot_ready_times, queue_tail_ms
            if distance <= max_dash_distance:
                ok, new_slots, new_tail = self._try_consume_dash_bursts(
                    bursts_needed, t_start, t_end, slot_ready_times, queue_tail_ms, dash_cooldown_ms
                )

            if not ok:
                deviation = ((distance - base_max_distance) / base_max_distance) * 100
                flags.append(FlagReason(
                    category="movement",
                    severity="critical" if deviation > 100 else "high",
                    description=f"Player moved faster than dash charges allow (frame {curr_frame.get('frame')})",
                    expected=base_max_distance,
                    actual=distance,
                    deviation_percent=deviation
                ))
            else:
                slot_ready_times, queue_tail_ms = new_slots, new_tail

        return flags

    def _validate_kills(
        self,
        kills: int,
        wave: int,
        difficulty: Difficulty,
        enemy_deaths: List[Dict[str, Any]]
    ) -> List[FlagReason]:
        """
        Check kill count against the real per-wave spawn count (plus scheduled
        boss spawns, plus a small margin for enemies left over from the
        previous wave), instead of a flat heuristic unrelated to actual spawns.

        Enemies that split on death (Octogon.ts: always spawns exactly 2
        'square' on death, no RNG) are real, separately-killable enemies that
        were never part of the wave's own raw spawn count - each split
        parent's own reported death credits exactly its own children (see
        get_split_children), so a wave full of splitting enemies doesn't
        false-flag as exceeding the ceiling.
        """
        flags = []

        boss_spawns = difficulty.get_scheduled_boss_spawns(wave) or []
        base_ceiling = int((difficulty.get_enemy_count(wave) + len(boss_spawns)) * 1.15) + 10
        split_bonus = sum(
            len(get_split_children(death.get("type", "triangle")))
            for death in enemy_deaths
        )
        max_reasonable = base_ceiling + split_bonus

        if kills > max_reasonable:
            deviation = ((kills - max_reasonable) / max_reasonable) * 100
            flags.append(FlagReason(
                category="kills",
                severity="high",
                description="Kill count exceeds wave-scaled ceiling",
                expected=max_reasonable,
                actual=kills,
                deviation_percent=deviation
            ))

        return flags

    def _validate_enemy_types(self, enemy_deaths: List[Dict[str, Any]], wave: int) -> List[FlagReason]:
        """
        Check that every reported enemy type could actually spawn on this
        wave (min_wave gating, and boss-only types restricted to boss waves).
        """
        flags = []

        invalid_types = sorted({
            death.get("type", "triangle")
            for death in enemy_deaths
            if not validate_enemy_spawn(death.get("type", "triangle"), wave)
        })

        if invalid_types:
            flags.append(FlagReason(
                category="enemy_type",
                severity="high",
                description=f"Enemy type(s) reported that couldn't spawn on wave {wave}: {invalid_types}",
                expected=[],
                actual=invalid_types
            ))

        return flags

    def _calculate_points_ceiling(self, enemy_deaths: List[Dict[str, Any]]) -> int:
        """
        Hard ceiling on per-wave score: 1 point per kill, assuming a (highly
        unlikely but technically possible) 100% drop rate, counting only
        enemy types with a nonzero score_chance. Enemies with score_chance=0
        (e.g. future composite-enemy sub-parts) never contribute.
        """
        return sum(
            1 for death in enemy_deaths
            if get_enemy_score_chance(death.get("type", "triangle")) > 0
        )

    def _calculate_points_expected(self, enemy_deaths: List[Dict[str, Any]]) -> float:
        """Expected score value: sum of each kill's real score_chance."""
        return sum(
            get_enemy_score_chance(death.get("type", "triangle"))
            for death in enemy_deaths
        )

    def _validate_points(
        self,
        reported_points: int,
        enemy_deaths: List[Dict[str, Any]]
    ) -> Tuple[List[FlagReason], int]:
        """
        Clamp the client-reported per-wave score to what's possible given the
        validated enemy_deaths, and flag (without blocking) when the reported
        total is statistically implausible relative to real drop odds. Points
        flags are always "medium" severity so they're recorded for review but
        never fail validation or block the stats update (unlike movement/
        damage/kills/upgrades, a bad score roll isn't proof of cheating).
        """
        flags = []
        ceiling = self._calculate_points_ceiling(enemy_deaths)
        credited = min(reported_points, ceiling)

        if reported_points > ceiling:
            flags.append(FlagReason(
                category="points",
                severity="medium",
                description="Reported score exceeds 100%-drop-rate ceiling for kills reported",
                expected=ceiling,
                actual=reported_points
            ))
        else:
            expected = self._calculate_points_expected(enemy_deaths)
            if expected > 0:
                deviation = abs(reported_points - expected) / expected
                if deviation > 0.5:
                    flags.append(FlagReason(
                        category="points",
                        severity="medium",
                        description="Reported score diverges from expected drop-chance simulation by >50%",
                        expected=expected,
                        actual=reported_points,
                        deviation_percent=deviation * 100
                    ))

        return flags, credited

    async def _flag_wave(
        self,
        user_id: ObjectId,
        username: str,
        wave: int,
        flags: List[FlagReason],
        submitted_data: Dict[str, Any],
        expected_data: Dict[str, Any]
    ):
        """Save flagged wave for admin review"""
        highest_severity = max(
            (f.severity for f in flags),
            key=lambda s: ["low", "medium", "high", "critical"].index(s)
        )

        auto_ban = any(f.severity == "critical" for f in flags)

        flagged_wave = FlaggedWave(
            user_id=user_id,
            username=username,
            wave_number=wave,
            total_flags=len(flags),
            highest_severity=highest_severity,
            auto_ban=auto_ban,
            reasons=flags,
            submitted_data=submitted_data,
            expected_data=expected_data
        )

        await self.flagged_waves_collection.insert_one(flagged_wave.to_dict(exclude_none=True))

    async def _update_player_stats_after_wave(
        self,
        user_id: ObjectId,
        kills: int,
        damage: int,
        wave: int,
        duration_seconds: int,
        damage_taken: int
    ):
        """Update permanent account stats after successful wave completion"""
        stats = await self.player_stats_repo.find_by_user_id(user_id)
        if stats:
            # Check for perfect wave (no damage taken, wave > 5)
            is_perfect_wave = damage_taken == 0 and wave > 5
            experience_gain = 1 if is_perfect_wave else 0

            if is_perfect_wave:
                print(f"🌟 PERFECT WAVE! No damage taken on wave {wave}. Experience +1")

            await self.player_stats_repo.update_by_id(
                stats.id,
                {
                    "total_kills": stats.total_kills + kills,
                    "total_damage_dealt": stats.total_damage_dealt + damage,
                    "highest_wave_ever": max(stats.highest_wave_ever, wave),
                    "games_won": stats.games_won + 1,
                    "total_playtime_seconds": stats.total_playtime_seconds + duration_seconds,
                    "experience": stats.experience + experience_gain
                }
            )

    async def _save_game_state(
        self,
        user_id: ObjectId,
        wave_data: Dict[str, Any],
        wave_number: int,
        points_earned: int,
        is_death: bool,
        bundle_upgrades: Optional[List[str]] = None,
        milestone_upgrade: Optional[str] = None
    ) -> int:
        """
        Save/update game state after a validated wave submission (normal
        completion or death). current_speed/current_max_health/
        current_polygon_sides/unlocked_attacks are always recomputed from the
        authorized upgrade list rather than trusted from the client.

        bundle_upgrades are this wave's mid-wave loot-bundle grants (see
        collect_upgrade_bundle) - never written to the save at grant time, so
        they're recorded into upgrade_history here, at the same moment
        they're first folded into current_upgrades, same as every other
        upgrade source becoming permanent.

        milestone_upgrade is the evolution-milestone grant for this
        completion, if any (see complete_wave) - folded into
        current_upgrades/upgrade_history here too, gated on can_apply_upgrade
        so it's silently skipped once polygon_upgrade's own maxStacks is hit,
        same as the client's local apply would no-op.

        Returns the resulting current_points, so callers can report an
        authoritative total back to the client.
        """
        existing_save = await self.game_save_repo.find_by_user_id(user_id)
        authorized_upgrades = wave_data.get("upgrades_used", existing_save.current_upgrades if existing_save else [])

        milestone_recorded = None
        if milestone_upgrade:
            attack_type = existing_save.current_attack_type if existing_save else "bullet"
            if can_apply_upgrade(milestone_upgrade, authorized_upgrades, attack_type):
                authorized_upgrades = authorized_upgrades + [milestone_upgrade]
                milestone_recorded = milestone_upgrade

        derived_stats = self._calculate_player_stats_from_upgrades(authorized_upgrades)
        polygon_sides = max(3, min(12, int(derived_stats["polygon_sides"])))

        if existing_save:
            new_points = existing_save.current_points + points_earned
            new_kills = existing_save.current_kills + wave_data.get("kills", 0)

            save_data = {
                "current_kills": new_kills,
                "current_upgrades": authorized_upgrades,
                "current_points": new_points,
                "current_health": wave_data.get("current_health", existing_save.current_health),
                "current_max_health": derived_stats["max_health"],
                "current_speed": int(derived_stats["speed"]),
                "current_polygon_sides": polygon_sides,
                "unlocked_attacks": ["bullet"],
                "seed": existing_save.seed,
            }

            # Record this wave's bundle grants (and any evolution-milestone
            # grant) into upgrade_history now that they're actually becoming
            # permanent - bundle ids only count if the client still reported
            # them as applied (authorized_upgrades already dropped anything
            # unauthorized above in complete_wave); the milestone grant was
            # already gated on can_apply_upgrade above.
            newly_recorded = [u for u in (bundle_upgrades or []) if u in authorized_upgrades]
            if milestone_recorded:
                newly_recorded = newly_recorded + [milestone_recorded]
            if newly_recorded:
                now_ms = int(datetime.utcnow().timestamp() * 1000)
                from app.models.game_save import UpgradeEntry
                save_data["upgrade_history"] = [
                    e.model_dump() for e in existing_save.upgrade_history
                ] + [
                    UpgradeEntry(upgrade_id=uid, purchased_at=now_ms, wave_number=wave_number).model_dump()
                    for uid in newly_recorded
                ]

            if is_death:
                # The died-in wave was never completed: don't advance
                # current_wave or clear offered_upgrades. Freeze death_state
                # from these same server-computed totals.
                now = datetime.utcnow()
                death_state = DeathFrozenState(
                    frozen_at=int(now.timestamp() * 1000),
                    waves_completed=wave_number,
                    enemies_killed=new_kills,
                    time_survived=int((now - existing_save.created_at).total_seconds()),
                    points_at_death=new_points
                )
                save_data["death_state"] = death_state.model_dump()
                save_data["game_over"] = True
            else:
                # Increment to NEXT wave (after completing wave_number, player advances to wave_number + 1)
                save_data["current_wave"] = wave_number + 1
                save_data["offered_upgrades"] = []  # Clear offered upgrades after wave completion

            await self.game_save_repo.update_by_id(
                existing_save.id,
                save_data
            )
            return new_points
        else:
            # Create new save (shouldn't happen since wave 1 creates it)
            save_data = {
                "current_wave": wave_number,
                "current_points": points_earned,
                "current_health": 100,
                "current_max_health": derived_stats["max_health"],
                "current_speed": int(derived_stats["speed"]),
                "current_polygon_sides": polygon_sides,
                "current_kills": wave_data.get("kills", 0),
                "current_upgrades": authorized_upgrades,
                "unlocked_attacks": ["bullet"],
                "seed": wave_data.get("seed", 0)
            }
            new_save = GameSave(
                user_id=user_id,
                **save_data
            )
            await self.game_save_repo.create(new_save)
            return points_earned
