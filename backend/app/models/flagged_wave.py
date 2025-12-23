from typing import List, Dict, Any
from datetime import datetime
from pydantic import Field
from app.models.base import BaseMongoModel, PyObjectId


class FlagReason(BaseMongoModel):
    """Individual flag reason with severity and details"""

    category: str = Field(...)  # movement, damage, upgrades, kills, etc.
    severity: str = Field(...)  # low, medium, high, critical
    description: str = Field(...)
    expected: Any = Field(default=None)
    actual: Any = Field(default=None)
    deviation_percent: float | None = Field(default=None)


class FlaggedWave(BaseMongoModel):
    """Flagged wave submission for admin review"""

    user_id: PyObjectId = Field(...)
    username: str = Field(...)  # For easy admin reference
    wave_number: int = Field(..., ge=1)

    # Overall flag info
    total_flags: int = Field(..., ge=1)
    highest_severity: str = Field(...)  # low, medium, high, critical
    auto_ban: bool = Field(default=False)  # Critical violations trigger auto-ban

    # Flag reasons
    reasons: List[FlagReason] = Field(default_factory=list)

    # Submitted data for review
    submitted_data: Dict[str, Any] = Field(...)
    expected_data: Dict[str, Any] = Field(...)

    # Admin review
    reviewed: bool = Field(default=False)
    reviewed_at: datetime | None = Field(default=None)
    reviewed_by: str | None = Field(default=None)
    admin_action: str | None = Field(default=None)  # dismissed, warned, banned
    admin_notes: str | None = Field(default=None)

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "username": "johndoe123",
                "wave_number": 5,
                "total_flags": 3,
                "highest_severity": "high",
                "auto_ban": False,
                "reasons": [
                    {
                        "category": "movement",
                        "severity": "high",
                        "description": "Player movement exceeds maximum possible speed",
                        "expected": 200,
                        "actual": 450,
                        "deviation_percent": 125.0
                    },
                    {
                        "category": "damage",
                        "severity": "medium",
                        "description": "Damage dealt significantly higher than expected",
                        "expected": 1000,
                        "actual": 1500,
                        "deviation_percent": 50.0
                    }
                ]
            }
        }
