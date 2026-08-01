from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.core.limiter import limiter
from app.core.security import decode_token, oauth2_scheme, get_current_user
from app.repositories.token_blacklist_repository import TokenBlacklistRepository
from app.services.auth_service import AuthService
from app.models.user import User, UserResponse

router = APIRouter()


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes long")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        return v


class UserLoginRequest(BaseModel):
    username: str = Field(...)
    password: str = Field(...)


class Token(BaseModel):
    access_token: str
    token_type: str


class UsernameCheckRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)


class UsernameCheckResponse(BaseModel):
    available: bool
    username: str


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("5/hour")
async def register(
    request: Request,
    user_data: UserRegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Register a new user"""
    auth_service = AuthService(db)
    user = await auth_service.register_user(
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        password=user_data.password
    )
    return UserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request,
    login_data: UserLoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Login with username and password"""
    auth_service = AuthService(db)
    access_token = await auth_service.authenticate_user(
        username=login_data.username,
        password=login_data.password
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/check-username/{username}", response_model=UsernameCheckResponse)
@limiter.limit("20/minute")
async def check_username_availability(
    request: Request,
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Check if a username is available (for real-time validation)"""
    auth_service = AuthService(db)
    available = await auth_service.check_username_availability(username)
    return {"available": available, "username": username}


@router.post("/logout", status_code=204)
async def logout(
    current_user: User = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Revoke the current access token so it can't be reused before it naturally expires"""
    payload = decode_token(token)
    blacklist_repo = TokenBlacklistRepository(db)
    await blacklist_repo.revoke(
        jti=payload["jti"],
        expires_at=datetime.utcfromtimestamp(payload["exp"])
    )
