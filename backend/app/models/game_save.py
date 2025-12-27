from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import Field, BaseModel, field_validator
from app.models.base import BaseMongoModel, PyObjectId


class OfferedUpgrade(BaseModel):
    """Tracks an offered upgrade and whether it's been purchased"""
    id: str = Field(..., description="Upgrade ID")
    purchased: bool = Field(default=False, description="Whether player purchased this upgrade")

    @classmethod
    def from_string(cls, upgrade_id: str) -> "OfferedUpgrade":
        """Create OfferedUpgrade from old string format"""
        return cls(id=upgrade_id, purchased=False)


class UpgradeEntry(BaseModel):
    """Tracks an upgrade purchase with timestamp for ordering"""
    upgrade_id: str = Field(..., description="Upgrade ID")
    purchased_at: int = Field(..., description="Timestamp of purchase (ms)")
    wave_number: int = Field(..., description="Wave when purchased")


class DeathFrozenState(BaseModel):
    """Frozen game state at moment of death - immutable once set"""
    frozen_at: int = Field(..., description="Timestamp of death (ms)")
    waves_completed: int = Field(..., description="Waves completed at death")
    enemies_killed: int = Field(..., description="Enemies killed at death")
    time_survived: int = Field(..., description="Seconds survived")
    points_at_death: int = Field(..., description="Points at death")


class GameSave(BaseMongoModel):
    """
    Game save model for storing current run progress - one save per user.
    This is temporary data that gets deleted when starting a new game.
    All permanent stats are stored in PlayerStats.

    MODULAR SAVE CATEGORIES:
    1. Game Stats (wave, kills, seed) - frozen on death
    2. Points - persists after death
    3. Upgrades - ordered purchase history, persists after death
    4. Death State - frozen at death, immutable
    5. Player State - health, speed, etc.
    """

    user_id: PyObjectId = Field(...)

    # ==========================================
    # GAME STATS (frozen on death)
    # ==========================================
    current_wave: int = Field(default=1, ge=1)
    current_kills: int = Field(default=0, ge=0)
    seed: int = Field(...)
    time_survived: int = Field(default=0, ge=0, description="Seconds since game start")

    # ==========================================
    # POINTS (persists after death)
    # ==========================================
    current_points: int = Field(default=0, ge=0)

    # ==========================================
    # UPGRADES (ordered, persists after death)
    # ==========================================
    # New: Ordered upgrade history with timestamps
    upgrade_history: List[UpgradeEntry] = Field(default_factory=list)

    # Legacy: Keep for backward compatibility during migration
    current_upgrades: List[str] = Field(default_factory=list)

    # Upgrades currently offered (for preventing reroll exploit)
    offered_upgrades: List[OfferedUpgrade] = Field(default_factory=list)

    @field_validator('offered_upgrades', mode='before')
    @classmethod
    def convert_offered_upgrades(cls, v):
        """Convert old string format to new OfferedUpgrade objects"""
        if not v:
            return []

        if isinstance(v, list) and len(v) > 0:
            first_item = v[0]
            # Old format: list of strings
            if isinstance(first_item, str):
                return [OfferedUpgrade(id=upgrade_id, purchased=False) for upgrade_id in v]
            # New format: list of dicts or OfferedUpgrade objects
            elif isinstance(first_item, dict):
                return [OfferedUpgrade(**item) if isinstance(item, dict) else item for item in v]

        return v

    # ==========================================
    # PLAYER STATE (computed from upgrades)
    # ==========================================
    current_health: float = Field(default=100, ge=0)
    current_max_health: float = Field(default=100, ge=1)
    current_speed: int = Field(default=200, ge=0)
    current_polygon_sides: int = Field(default=3, ge=3, le=12)
    unlocked_attacks: List[str] = Field(default_factory=lambda: ["bullet"])

    # ==========================================
    # DEATH STATE (null if alive, immutable once set)
    # ==========================================
    death_state: Optional[DeathFrozenState] = Field(default=None)

    # Legacy: Keep for backward compatibility
    game_over: bool = Field(default=False)

    # ==========================================
    # META
    # ==========================================
    last_saved_at: Optional[datetime] = Field(default=None)

    @property
    def can_continue(self) -> bool:
        """Check if player can continue this save (not dead)"""
        return self.death_state is None and not self.game_over

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "current_wave": 5,
                "current_points": 1500,
                "seed": 12345,
                "current_health": 120,
                "current_max_health": 120,
                "current_speed": 220,
                "current_polygon_sides": 4,
                "current_kills": 50,
                "upgrade_history": [
                    {"upgrade_id": "health_1", "purchased_at": 1234567890000, "wave_number": 1},
                    {"upgrade_id": "speed_1", "purchased_at": 1234567900000, "wave_number": 2}
                ],
                "current_upgrades": ["health_1", "speed_1"],
                "unlocked_attacks": ["bullet"],
                "death_state": None,
                "game_over": False
            }
        }


# ==========================================
# RESPONSE MODELS
# ==========================================

class GameSaveResponse(BaseMongoModel):
    """Game save response model (legacy format)"""

    user_id: PyObjectId
    current_wave: int
    current_points: int
    seed: int
    current_health: float
    current_max_health: float
    current_speed: int
    current_polygon_sides: int
    current_kills: int
    current_upgrades: List[str]
    offered_upgrades: List[OfferedUpgrade]
    unlocked_attacks: List[str]
    game_over: bool = False


class GameStatsResponse(BaseModel):
    """Response for game stats only"""
    current_wave: int
    current_kills: int
    seed: int
    time_survived: int


class PointsResponse(BaseModel):
    """Response for points only"""
    current_points: int


class UpgradesResponse(BaseModel):
    """Response for upgrades only"""
    purchase_history: List[UpgradeEntry]


class PlayerStateResponse(BaseModel):
    """Response for player state"""
    current_health: float
    current_max_health: float
    current_speed: int
    current_polygon_sides: int
    unlocked_attacks: List[str]


class FullGameSaveResponse(BaseModel):
    """Full game save response (modular format)"""
    game_stats: GameStatsResponse
    points: PointsResponse
    upgrades: UpgradesResponse
    player_state: PlayerStateResponse
    death_state: Optional[DeathFrozenState]
    can_continue: bool
    last_saved_at: Optional[int]  # Timestamp in ms