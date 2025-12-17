from typing import Optional
from pydantic import Field, field_validator
from app.models.base import BaseMongoModel


class User(BaseMongoModel):
    """User model for authentication and profile data"""

    username: str = Field(..., min_length=3, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    hashed_password: str = Field(...)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username can only contain letters, numbers, underscores, and hyphens")
        return v.lower()

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Validate and capitalize names"""
        return v.strip().title()

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "username": "johndoe123",
                "first_name": "John",
                "last_name": "Doe",
                "hashed_password": "$2b$12$..."
            }
        }


class UserResponse(BaseMongoModel):
    """User response model (excludes sensitive data)"""

    username: str
    first_name: str
    last_name: str

    class Config(BaseMongoModel.Config):
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "username": "johndoe123",
                "first_name": "John",
                "last_name": "Doe",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
