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
from app.models.game_save import GameSave
from app.repositories.player_stats_repository import PlayerStatsRepository
from app.repositories.game_save_repository import GameSaveRepository
from app.core.upgrade_data import UPGRADES, RARITY_WEIGHTS, can_apply_upgrade, get_upgrade
from app.core.enemy_data import calculate_minimum_damage_required, get_expected_enemy_count


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
                attack_type="bullet"  # TODO: Get from game save
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
            current_upgrades=current_upgrades,
            offered_upgrades=[u["id"] for u in offered_upgrades],
            seed=seed,
            expiry_seconds=30
        )

        # Save token to database
        token_dict = token.to_dict(exclude_none=True)
        await self.wave_tokens_collection.insert_one(token_dict)

        # Create game save if it doesn't exist (for wave 1)
        if wave_number == 1 and not game_save:
            new_save = GameSave(
                user_id=user_id,
                current_wave=1,
                current_points=0,
                seed=seed,
                current_health=100,
                current_max_health=100,
                current_speed=200,
                current_polygon_sides=3,
                current_kills=0,
                current_damage_dealt=0,
                current_upgrades=[],
                offered_upgrades=offered_upgrade_objs,
                attack_stats={
                    "bullet": {
                        "damage": 10,
                        "speed": 400,
                        "cooldown": 200,
                        "size": 1,
                        "pierce": 0
                    }
                },
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
        print(f"=== WAVE COMPLETION START ===", flush=True)
        print(f"Wave data received: kills={wave_data.get('kills')}, damage={wave_data.get('total_damage')}, wave={wave_data.get('wave')}", flush=True)

        # Find and validate token
        token_doc = await self.wave_tokens_collection.find_one({"token": token_string})
        if not token_doc:
            print("ERROR: Token not found", flush=True)
            return False, ["Invalid or missing wave token"]

        token = WaveValidationToken.from_mongo(token_doc)
        print(f"Token found for wave {token.wave_number}", flush=True)

        if not token.is_valid():
            print(f"Token invalid: expired={token.expires_at}, used={token.used}", flush=True)
            return False, ["Token expired or already used"]

        if str(token.user_id) != str(user_id):
            print(f"User ID mismatch: token={token.user_id}, user={user_id}", flush=True)
            return False, ["Token user mismatch"]

        print(f"Starting validations...", flush=True)

        # Perform validations
        flags: List[FlagReason] = []

        # 1. Validate upgrades used
        upgrades_used = wave_data.get("upgrades_used", [])
        # Valid upgrades = previously allowed + newly offered this wave
        valid_upgrades = set(token.allowed_upgrades + token.offered_upgrades)
        print(f"Validating upgrades: {upgrades_used} vs valid: {valid_upgrades}")
        for upgrade_id in upgrades_used:
            if upgrade_id not in valid_upgrades:
                flags.append(FlagReason(
                    category="upgrades",
                    severity="high",
                    description=f"Unauthorized upgrade used: {upgrade_id}",
                    expected=list(valid_upgrades),
                    actual=upgrades_used
                ))

        # 2. Validate damage
        damage_flags = self._validate_damage(
            wave_data.get("total_damage", 0),
            wave_data.get("kills", 0),
            wave_data.get("enemy_deaths", []),
            token.wave_number
        )
        print(f"Damage validation flags: {len(damage_flags)}")
        flags.extend(damage_flags)

        # 3. Validate movement (frame-by-frame)
        movement_flags = self._validate_movement(
            wave_data.get("frame_samples", []),
            token.expected_player_stats.get("speed", 200)
        )
        print(f"Movement validation flags: {len(movement_flags)}")
        flags.extend(movement_flags)

        # 4. Validate kill counts
        kill_flags = self._validate_kills(
            wave_data.get("kills", 0),
            token.wave_number
        )
        print(f"Kill validation flags: {len(kill_flags)}")
        flags.extend(kill_flags)

        print(f"Total flags: {len(flags)}, High severity: {len([f for f in flags if f.severity in ['high', 'critical']])}")

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
        critical_flags = [f for f in flags if f.severity == "critical"]

        # Update player stats even if there are some flags (unless critical)
        # This prevents legitimate players from losing progress due to minor validation issues
        if not critical_flags:
            kills = wave_data.get("kills", 0)
            damage = wave_data.get("total_damage", 0)
            print(f"Updating stats - Kills: {kills}, Damage: {damage}, Wave: {token.wave_number}")

            await self._update_player_stats_after_wave(
                user_id,
                kills,
                damage,
                token.wave_number
            )

            # Create/update game save after wave completion
            await self._save_game_state(user_id, wave_data, token.wave_number)
        else:
            print(f"CRITICAL FLAGS DETECTED - Stats not updated: {critical_flags}")

        # Return validation result
        if high_severity_flags:
            print(f"Wave validation FAILED: {[f.description for f in high_severity_flags]}")
            return False, [f.description for f in high_severity_flags]

        print(f"=== WAVE COMPLETION SUCCESS ===")
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
        """Update permanent account stats after successful wave completion"""
        stats = await self.player_stats_repo.find_by_user_id(user_id)
        if stats:
            await self.player_stats_repo.update_by_id(
                stats.id,
                {
                    "total_kills": stats.total_kills + kills,
                    "total_damage_dealt": stats.total_damage_dealt + damage,
                    "highest_wave_ever": max(stats.highest_wave_ever, wave),
                    "games_won": stats.games_won + 1
                }
            )

    async def _save_game_state(
        self,
        user_id: ObjectId,
        wave_data: Dict[str, Any],
        wave_number: int
    ):
        """Save/update temporary game state after wave completion"""
        # Check if a save already exists for this user (one save per user)
        existing_save = await self.game_save_repo.find_by_user_id(user_id)

        if existing_save:
            # Update existing save - ACCUMULATE kills and damage
            # Increment to NEXT wave (after completing wave_number, player advances to wave_number + 1)
            save_data = {
                "current_wave": wave_number + 1,
                "current_kills": existing_save.current_kills + wave_data.get("kills", 0),
                "current_damage_dealt": existing_save.current_damage_dealt + wave_data.get("total_damage", 0),
                "current_upgrades": wave_data.get("upgrades_used", existing_save.current_upgrades),
                "offered_upgrades": [],  # Clear offered upgrades after wave completion
                # Keep other fields as-is - don't overwrite what autosave set
                # NOTE: Points are updated by autosave and upgrade purchases, keep existing value
                # "current_points": existing_save.current_points,  # Removed - keep what's in DB
                "current_health": wave_data.get("current_health", existing_save.current_health),
                "current_max_health": existing_save.current_max_health,  # TODO: Update from frontend
                "current_speed": existing_save.current_speed,
                "current_polygon_sides": existing_save.current_polygon_sides,
            }
            save_data["seed"] = existing_save.seed  # Keep existing seed

            await self.game_save_repo.update_by_id(
                existing_save.id,
                save_data
            )
        else:
            # Create new save (shouldn't happen since wave 1 creates it)
            save_data = {
                "current_wave": wave_number,
                "current_points": 0,
                "current_health": 100,
                "current_max_health": 100,
                "current_speed": 200,
                "current_polygon_sides": 3,
                "current_kills": wave_data.get("kills", 0),
                "current_damage_dealt": wave_data.get("total_damage", 0),
                "current_upgrades": wave_data.get("upgrades_used", []),
                "attack_stats": {
                    "bullet": {
                        "damage": 10,
                        "speed": 400,
                        "cooldown": 200,
                        "size": 1,
                        "pierce": 0
                    }
                },
                "unlocked_attacks": ["bullet"],
                "seed": wave_data.get("seed", 0)
            }
            new_save = GameSave(
                user_id=user_id,
                **save_data
            )
            await self.game_save_repo.create(new_save)
