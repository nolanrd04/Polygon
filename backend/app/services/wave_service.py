"""
Wave validation and anti-cheat service.
Handles wave start, completion validation, and suspicious activity flagging.
"""

from typing import List, Dict, Any, Tuple
from datetime import datetime
import random
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.wave_token import WaveValidationToken
from app.models.player_stats import PlayerStats
from app.models.flagged_wave import FlaggedWave, FlagReason
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.core.upgrade_data import UPGRADES, RARITY_WEIGHTS, can_apply_upgrade, get_upgrade
from app.core.enemy_data import calculate_minimum_damage_required, get_expected_enemy_count


class WaveService:
    """Service for wave-related operations and validation"""

    def __init__(self, database: AsyncIOMotorDatabase):
        self.db = database
        self.wave_tokens_collection = database["wave_validation_tokens"]
        self.flagged_waves_collection = database["flagged_waves"]
        self.player_stats_repo = PlayerStatsRepository(database)

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
        # Get player stats
        player_stats = await self.player_stats_repo.find_by_user_id(user_id)
        if not player_stats:
            raise ValueError("Player stats not found")

        # Roll 3 upgrades
        offered_upgrades = self._roll_upgrades(
            current_upgrades=player_stats.current_upgrades,
            attack_type="bullet"  # TODO: Get from player stats
        )

        # Create validation token
        player_stats_dict = {
            "health": 100,  # TODO: Get actual from player stats
            "max_health": 100,
            "speed": 200,
            "damage": 10
        }

        token = WaveValidationToken.create_for_wave(
            user_id=user_id,
            wave_number=wave_number,
            player_stats=player_stats_dict,
            current_upgrades=player_stats.current_upgrades,
            offered_upgrades=[u["id"] for u in offered_upgrades],
            seed=seed,
            expiry_seconds=30
        )

        # Save token to database
        token_dict = token.to_dict(exclude_none=True)
        await self.wave_tokens_collection.insert_one(token_dict)

        return token, offered_upgrades

    async def complete_wave(
        self,
        user_id: ObjectId,
        username: str,
        token_string: str,
        wave_data: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """
        Validate and complete a wave submission.

        Args:
            user_id: User ID
            username: Username for flagging
            token_string: Wave validation token
            wave_data: Submitted wave data (kills, damage, frames, etc.)

        Returns:
            (is_valid, error_messages)
        """
        # Find and validate token
        token_doc = await self.wave_tokens_collection.find_one({"token": token_string})
        if not token_doc:
            return False, ["Invalid or missing wave token"]

        token = WaveValidationToken.from_mongo(token_doc)

        if not token.is_valid():
            return False, ["Token expired or already used"]

        if str(token.user_id) != str(user_id):
            return False, ["Token user mismatch"]

        # Perform validations
        flags: List[FlagReason] = []

        # 1. Validate upgrades used
        upgrades_used = wave_data.get("upgrades_used", [])
        for upgrade_id in upgrades_used:
            if upgrade_id not in token.allowed_upgrades:
                flags.append(FlagReason(
                    category="upgrades",
                    severity="high",
                    description=f"Unauthorized upgrade used: {upgrade_id}",
                    expected=token.allowed_upgrades,
                    actual=upgrades_used
                ))

        # 2. Validate damage
        damage_flags = self._validate_damage(
            wave_data.get("total_damage", 0),
            wave_data.get("kills", 0),
            wave_data.get("enemy_deaths", []),
            token.wave_number
        )
        flags.extend(damage_flags)

        # 3. Validate movement (frame-by-frame)
        movement_flags = self._validate_movement(
            wave_data.get("frame_samples", []),
            token.expected_player_stats.get("speed", 200)
        )
        flags.extend(movement_flags)

        # 4. Validate kill counts
        kill_flags = self._validate_kills(
            wave_data.get("kills", 0),
            token.wave_number
        )
        flags.extend(kill_flags)

        # Mark token as used
        await self.wave_tokens_collection.update_one(
            {"_id": token_doc["_id"]},
            {"$set": {"used": True, "used_at": datetime.utcnow()}}
        )

        # If flags detected, save to flagged_waves
        if flags:
            await self._flag_wave(user_id, username, token.wave_number, flags, wave_data, token.to_dict())

        # Determine if wave is valid (allow minor flags)
        high_severity_flags = [f for f in flags if f.severity in ["high", "critical"]]

        if high_severity_flags:
            return False, [f.description for f in high_severity_flags]

        # Update player stats
        await self._update_player_stats_after_wave(
            user_id,
            wave_data.get("kills", 0),
            wave_data.get("total_damage", 0),
            token.wave_number
        )

        return True, []

    def _roll_upgrades(
        self,
        current_upgrades: List[str],
        attack_type: str,
        count: int = 3
    ) -> List[Dict[str, Any]]:
        """Roll random upgrades based on rarity weights"""
        available_upgrades = [
            upgrade for upgrade in UPGRADES.values()
            if can_apply_upgrade(upgrade["id"], current_upgrades, attack_type)
        ]

        if not available_upgrades:
            return []

        selected = []
        attempts = 0
        max_attempts = 100

        while len(selected) < count and attempts < max_attempts:
            # Pick rarity
            rarity = self._pick_rarity()

            # Filter by rarity
            rarity_upgrades = [u for u in available_upgrades if u["rarity"] == rarity]

            if rarity_upgrades:
                upgrade = random.choice(rarity_upgrades)

                # Avoid duplicates (unless stackable)
                if upgrade not in selected or upgrade.get("stackable"):
                    selected.append(upgrade)

            attempts += 1

        return selected[:count]

    def _pick_rarity(self) -> str:
        """Pick a rarity based on weights"""
        rand = random.random()
        cumulative = 0.0

        for rarity, weight in RARITY_WEIGHTS.items():
            cumulative += weight
            if rand < cumulative:
                return rarity

        return "common"

    def _validate_damage(
        self,
        reported_damage: int,
        kills: int,
        enemy_deaths: List[Dict[str, Any]],
        wave: int
    ) -> List[FlagReason]:
        """Validate damage dealt is reasonable"""
        flags = []

        # Calculate enemy type counts
        enemy_counts = {}
        for death in enemy_deaths:
            enemy_type = death.get("type", "triangle")
            enemy_counts[enemy_type] = enemy_counts.get(enemy_type, 0) + 1

        # Calculate minimum required damage
        min_damage = calculate_minimum_damage_required(wave, enemy_counts)

        # Allow 20% margin for overkill
        max_reasonable_damage = min_damage * 1.2

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

        return flags

    def _validate_movement(
        self,
        frame_samples: List[Dict[str, Any]],
        player_speed: float
    ) -> List[FlagReason]:
        """Validate player movement frame-by-frame"""
        flags = []

        if len(frame_samples) < 2:
            return flags  # Not enough data

        for i in range(1, len(frame_samples)):
            prev_frame = frame_samples[i - 1]
            curr_frame = frame_samples[i]

            prev_player = prev_frame.get("player", {})
            curr_player = curr_frame.get("player", {})

            # Calculate distance moved
            dx = curr_player.get("x", 0) - prev_player.get("x", 0)
            dy = curr_player.get("y", 0) - prev_player.get("y", 0)
            distance = (dx ** 2 + dy ** 2) ** 0.5

            # Calculate time elapsed (in seconds)
            time_delta = (curr_frame.get("timestamp", 0) - prev_frame.get("timestamp", 0)) / 1000.0

            if time_delta <= 0:
                continue

            # Calculate max possible distance (with 10% tolerance for framerate variance)
            max_distance = player_speed * time_delta * 1.10

            if distance > max_distance:
                deviation = ((distance - max_distance) / max_distance) * 100
                flags.append(FlagReason(
                    category="movement",
                    severity="critical" if deviation > 100 else "high",
                    description=f"Player moved faster than possible (frame {curr_frame.get('frame')})",
                    expected=max_distance,
                    actual=distance,
                    deviation_percent=deviation
                ))

        return flags

    def _validate_kills(self, kills: int, wave: int) -> List[FlagReason]:
        """Validate kill count is reasonable"""
        flags = []

        expected_count = get_expected_enemy_count(wave)
        max_reasonable = expected_count * 1.2  # Allow 20% variance

        if kills > max_reasonable:
            deviation = ((kills - expected_count) / expected_count) * 100
            flags.append(FlagReason(
                category="kills",
                severity="high",
                description="Kill count exceeds expected enemy spawns",
                expected=expected_count,
                actual=kills,
                deviation_percent=deviation
            ))

        return flags

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
        wave: int
    ):
        """Update player stats after successful wave completion"""
        stats = await self.player_stats_repo.find_by_user_id(user_id)
        if stats:
            await self.player_stats_repo.update_by_id(
                stats.id,
                {
                    "total_kills": stats.total_kills + kills,
                    "total_damage_dealt": stats.total_damage_dealt + damage,
                    "current_wave": wave,
                    "highest_wave": max(stats.highest_wave, wave)
                }
            )
