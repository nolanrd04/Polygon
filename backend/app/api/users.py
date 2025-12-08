from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class UserProfile(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user
