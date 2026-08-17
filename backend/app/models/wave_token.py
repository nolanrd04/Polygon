from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from app.models.base import BaseMongoModel, PyObjectId


class RolledOffer(BaseModel):
    """One shop offer shown against a wave (the wave-start roll or a reroll)."""
    upgrades: List[str] = Field(default_factory=list)
    # Points the player had at the moment this roll appeared (post reroll-cost
    # for rerolls). Points only ever decrease during a shop phase, so this is
    # the most the player could have put toward any one upgrade in this roll -
    # the affordability baseline for pick-rate analysis. None on offers
    # recorded before this field existed.
    points_at_roll: Optional[int] = Field(default=None)


class WaveValidationToken(BaseMongoModel):
    """Token for validating wave completion submissions"""

    user_id: PyObjectId = Field(...)
    wave_number: int = Field(..., ge=1)
    token: str = Field(...)  # JWT-style token
    expires_at: datetime = Field(...)

    # Expected game state
    expected_player_stats: Dict[str, Any] = Field(...)
    allowed_upgrades: List[str] = Field(default_factory=list)  # upgrade IDs
    offered_upgrades: List[str] = Field(default_factory=list)  # Upgrades offered this wave
    seed: int = Field(...)

    # Validation tracking
    used: bool = Field(default=False)
    used_at: datetime | None = Field(default=None)

    # Mid-wave upgrade-bundle pickups granted against this wave (see
    # WaveService.collect_upgrade_bundle) - capped independently of `used`
    # since bundles are collected before the wave completes.
    bundles_granted: int = Field(default=0)

    # Upgrade ids granted via mid-wave bundle pickups on THIS wave's token.
    # Deliberately NOT written to the game save at grant time - only
    # authorized for this wave's own complete_wave() upgrade check (see
    # valid_upgrades there). They only become permanent when complete_wave
    # actually persists them via _save_game_state, exactly like every other
    # upgrade source - so quitting mid-wave without completing it (or dying,
    # which does complete it) drops them, the same as it drops in-progress
    # kills/damage.
    bundle_upgrades: List[str] = Field(default_factory=list)

    # Reroll usage against this wave's offer (see WaveService.reroll_upgrades)
    # - incremented via $inc on the exact token string, same pattern as
    # bundles_granted above. Pure analytics for the wave's GameRun snapshot;
    # nothing here gates or validates the reroll itself (point costs are
    # already enforced in the reroll route against the save's own balance).
    rerolls_used: int = Field(default=0)
    reroll_points_spent: int = Field(default=0)

    # Every shop offer shown against this wave, in roll order: the offer the
    # token was created with (first entry, set in create_for_wave), plus one
    # entry $push-ed per reroll. This is the pick-rate denominator - a
    # rerolled-away offer is a "seen and not picked" event that
    # offered_upgrades alone (final offer only) can't represent. Bundle and
    # milestone grants are deliberately absent: those are forced random
    # grants, not choices, so they don't belong in a pick rate.
    offers_rolled: List[RolledOffer] = Field(default_factory=list)

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "wave_number": 5,
                "token": "eyJhbGc...",
                "expires_at": "2024-01-01T00:00:30",
                "expected_player_stats": {
                    "health": 100,
                    "max_health": 100,
                    "speed": 200,
                    "damage": 10
                },
                "allowed_upgrades": ["health_1", "speed_1"],
                "offered_upgrades": ["damage_1", "fire_rate_1", "pierce_1"],
                "seed": 12345,
                "used": False
            }
        }

    @staticmethod
    def create_token_string(user_id: str, wave_number: int) -> str:
        """Create a unique token string"""
        import hashlib
        import secrets

        nonce = secrets.token_hex(16)
        data = f"{user_id}:{wave_number}:{nonce}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()

    @classmethod
    def create_for_wave(
        cls,
        user_id: PyObjectId,
        wave_number: int,
        player_stats: Dict[str, Any],
        current_upgrades: List[str],
        offered_upgrades: List[str],
        seed: int,
        expiry_seconds: int = 30,
        points_at_roll: Optional[int] = None
    ) -> "WaveValidationToken":
        """Create a new wave validation token"""
        token_string = cls.create_token_string(str(user_id), wave_number)
        expires_at = datetime.utcnow() + timedelta(seconds=expiry_seconds)

        return cls(
            user_id=user_id,
            wave_number=wave_number,
            token=token_string,
            expires_at=expires_at,
            expected_player_stats=player_stats,
            allowed_upgrades=current_upgrades,
            offered_upgrades=offered_upgrades,
            seed=seed,
            # The offer this wave opens with (rolled fresh or reused on a
            # reload) - rerolls append their new offers after it.
            offers_rolled=(
                [RolledOffer(upgrades=list(offered_upgrades), points_at_roll=points_at_roll)]
                if offered_upgrades else []
            )
        )

    def is_valid(self) -> bool:
        """Check if token is still valid (not used, not expired)"""
        return not self.used and datetime.utcnow() < self.expires_at

    def mark_used(self):
        """Mark token as used"""
        self.used = True
        self.used_at = datetime.utcnow()
