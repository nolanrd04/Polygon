"""
Run Model - Canonical run save system.

Each user has at most one active run at a time.
A run is either 'active' (backend-authoritative) or 'dead' (read-only).
"""
from typing import List, Optional
from datetime import datetime
from enum import Enum
from uuid import uuid4
from pydantic import Field, BaseModel
from app.models.base import BaseMongoModel, PyObjectId


class RunStatus(str, Enum):
    """Run lifecycle status"""
    ACTIVE = "active"
    DEAD = "dead"


class RunProgress(BaseModel):
    """Progress data - core game state"""
    wave: int = Field(default=0, ge=0)
    points: int = Field(default=0, ge=0)
    upgrades: List[str] = Field(default_factory=list)  # Append-only
    kills: int = Field(default=0, ge=0)


class RunStats(BaseModel):
    """Accumulated statistics over the run"""
    totalDamage: int = Field(default=0, ge=0)
    totalTimeSurvived: int = Field(default=0, ge=0)


class Run(BaseMongoModel):
    """
    Single run document per user. Immutable after death.

    Invariants:
    - wave only increases
    - points >= 0
    - upgrades is append-only
    - status === dead means document is read-only
    """
    user_id: PyObjectId = Field(...)
    run_id: str = Field(default_factory=lambda: str(uuid4()))
    status: RunStatus = Field(default=RunStatus.ACTIVE)
    seed: int = Field(...)

    progress: RunProgress = Field(default_factory=RunProgress)
    stats: RunStats = Field(default_factory=RunStats)

    last_saved_at: Optional[datetime] = Field(default=None)

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "user_id": "507f1f77bcf86cd799439011",
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "status": "active",
                "seed": 123456789,
                "progress": {
                    "wave": 5,
                    "points": 340,
                    "upgrades": ["bullet_damage_1", "health_1"],
                    "kills": 120
                },
                "stats": {
                    "totalDamage": 50000,
                    "totalTimeSurvived": 300
                }
            }
        }


# Response models
class RunProgressResponse(BaseModel):
    """Progress data for API response"""
    wave: int
    points: int
    upgrades: List[str]
    kills: int


class RunStatsResponse(BaseModel):
    """Stats data for API response"""
    totalDamage: int
    totalTimeSurvived: int


class RunResponse(BaseModel):
    """Full run response for API"""
    runId: str
    status: str
    seed: int
    progress: RunProgressResponse
    stats: RunStatsResponse
    createdAt: str
    lastSavedAt: Optional[str]
