"""
Run API Routes - Endpoints for the canonical run save system.

Each user has at most one active run at a time.
Runs are either 'active' (backend-authoritative) or 'dead' (read-only).
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from app.core.database import get_database
from app.core.security import get_current_user
from app.models.user import User
from app.models.run import RunResponse, RunProgressResponse, RunStatsResponse
from app.services.run_service import RunService

router = APIRouter()


# ==========================================
# REQUEST MODELS
# ==========================================

class StartRunRequest(BaseModel):
    """Request to start a new run"""
    seed: Optional[int] = Field(default=None, description="Optional seed for RNG")


class SaveProgressRequest(BaseModel):
    """Request to save run progress"""
    runId: str = Field(..., description="Run ID to update")
    progress: Dict[str, Any] = Field(..., description="Progress data")
    stats: Dict[str, Any] = Field(..., description="Stats data")


class EndRunRequest(BaseModel):
    """Request to end a run (player died)"""
    runId: str = Field(..., description="Run ID to end")
    finalProgress: Dict[str, Any] = Field(..., description="Final progress snapshot")
    finalStats: Dict[str, Any] = Field(..., description="Final stats snapshot")


class AddUpgradeRequest(BaseModel):
    """Request to add an upgrade to the run"""
    runId: str = Field(..., description="Run ID")
    upgradeId: str = Field(..., description="Upgrade to add")
    cost: int = Field(..., ge=0, description="Points cost")


# ==========================================
# RESPONSE MODELS
# ==========================================

class RunStatusResponse(BaseModel):
    """Response for run status check"""
    hasRun: bool
    isActive: bool
    run: Optional[RunResponse] = None


class SaveSuccessResponse(BaseModel):
    """Response for save operation"""
    success: bool
    message: str


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("/", response_model=RunStatusResponse)
async def get_run_status(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current run status for the user.
    Returns whether they have a run and if it's active.
    """
    service = RunService(db)
    run = await service.get_run(current_user.id)

    if not run:
        return RunStatusResponse(hasRun=False, isActive=False, run=None)

    return RunStatusResponse(
        hasRun=True,
        isActive=run.status.value == "active",
        run=RunService.to_response(run)
    )


@router.get("/active", response_model=Optional[RunResponse])
async def get_active_run(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get the active run for the current user.
    Returns None if no active run exists.
    """
    service = RunService(db)
    run = await service.get_active_run(current_user.id)

    if not run:
        return None

    return RunService.to_response(run)


@router.post("/start", response_model=RunResponse)
async def start_new_run(
    request: StartRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Start a new run for the current user.
    Deletes any existing run (active or dead).
    """
    service = RunService(db)
    run = await service.start_new_run(current_user.id, request.seed)
    return RunService.to_response(run)


@router.post("/save", response_model=SaveSuccessResponse)
async def save_progress(
    request: SaveProgressRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Save run progress.
    Only succeeds if run is active and belongs to user.
    """
    service = RunService(db)
    success = await service.save_progress(
        user_id=current_user.id,
        run_id=request.runId,
        progress=request.progress,
        stats=request.stats
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to save progress - run may be dead or not found"
        )

    return SaveSuccessResponse(success=True, message="Progress saved")


@router.post("/end", response_model=SaveSuccessResponse)
async def end_run(
    request: EndRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    End a run (player died).
    Marks run as dead with final snapshot - immutable after this.
    """
    service = RunService(db)
    success = await service.end_run(
        user_id=current_user.id,
        run_id=request.runId,
        final_progress=request.finalProgress,
        final_stats=request.finalStats
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to end run - already dead or not found"
        )

    return SaveSuccessResponse(success=True, message="Run ended")


@router.post("/upgrade", response_model=RunResponse)
async def add_upgrade(
    request: AddUpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Add an upgrade to the current run.
    Deducts points and appends upgrade to the list.
    """
    service = RunService(db)
    run = await service.add_upgrade(
        user_id=current_user.id,
        run_id=request.runId,
        upgrade_id=request.upgradeId,
        cost=request.cost
    )

    if not run:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to add upgrade - insufficient points, run dead, or not found"
        )

    return RunService.to_response(run)


@router.delete("/")
async def delete_run(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Delete the current run (for starting fresh).
    This is typically called before starting a new run.
    """
    service = RunService(db)
    from app.repositories.run_repository import RunRepository
    repo = RunRepository(db)
    deleted = await repo.delete_by_user_id(current_user.id)

    return {"deleted": deleted, "message": "Run deleted" if deleted else "No run to delete"}
