from typing import List, Dict, Any, Optional, Union
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


class GameSave(BaseMongoModel):
    """
    Game save model for storing current run progress - one save per user.
    This is temporary data that gets deleted when starting a new game.
    All permanent stats are stored in PlayerStats.
    """

    user_id: PyObjectId = Field(...)

    # Current run state (temporary - reset on new game)
    current_wave: int = Field(default=1, ge=1)
    current_points: int = Field(default=0, ge=0)
    seed: int = Field(...)

    # Current player stats for this run (temporary)
    current_health: int = Field(default=100, ge=0)
    current_max_health: int = Field(default=100, ge=1)
    current_speed: int = Field(default=200, ge=0)
    current_polygon_sides: int = Field(default=3, ge=3, le=8)

    # Current run kill/damage tracking (resets on new game)
    current_kills: int = Field(default=0, ge=0)
    current_damage_dealt: int = Field(default=0, ge=0)

    # Upgrades applied in this run (resets on new game)
    current_upgrades: List[str] = Field(default_factory=list)

    # Upgrades currently offered (for preventing reroll exploit)
    # Each upgrade tracks whether it's been purchased
    offered_upgrades: List[OfferedUpgrade] = Field(default_factory=list)

    @field_validator('offered_upgrades', mode='before')
    @classmethod
    def convert_offered_upgrades(cls, v):
        """Convert old string format to new OfferedUpgrade objects"""
        if not v:
            return []

        # Check if already in correct format
        if isinstance(v, list) and len(v) > 0:
            first_item = v[0]
            # Old format: list of strings
            if isinstance(first_item, str):
                return [OfferedUpgrade(id=upgrade_id, purchased=False) for upgrade_id in v]
            # New format: list of dicts or OfferedUpgrade objects
            elif isinstance(first_item, dict):
                return [OfferedUpgrade(**item) if isinstance(item, dict) else item for item in v]

        return v

    # Attack stats per attack type
    attack_stats: Dict[str, Any] = Field(default_factory=lambda: {
        "bullet": {
            "damage": 10,
            "speed": 400,
            "cooldown": 200,
            "size": 1,
            "pierce": 0
        }
    })

    # Unlocked attacks
    unlocked_attacks: List[str] = Field(default_factory=lambda: ["bullet"])

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
                "current_damage_dealt": 1200,
                "current_upgrades": ["health_1", "speed_1"],
                "attack_stats": {
                    "bullet": {
                        "damage": 15,
                        "speed": 450,
                        "cooldown": 180,
                        "size": 1.2,
                        "pierce": 1
                    }
                },
                "unlocked_attacks": ["bullet", "laser"]
            }
        }


class GameSaveResponse(BaseMongoModel):
    """Game save response model"""

    user_id: PyObjectId
    current_wave: int
    current_points: int
    seed: int
    current_health: int
    current_max_health: int
    current_speed: int
    current_polygon_sides: int
    current_kills: int
    current_damage_dealt: int
    current_upgrades: List[str]
    offered_upgrades: List[OfferedUpgrade]
    attack_stats: Dict[str, Any]
    unlocked_attacks: List[str]
