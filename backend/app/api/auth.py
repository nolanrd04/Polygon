from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.services.auth_service import AuthService
from app.models.user import UserResponse

router = APIRouter()


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)


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
async def register(
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
async def login(
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
async def check_username_availability(
    username: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Check if a username is available (for real-time validation)"""
    auth_service = AuthService(db)
    available = await auth_service.check_username_availability(username)
    return {"available": available, "username": username}
