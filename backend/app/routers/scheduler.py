"""
Scheduler router — Check status and trigger manual runs.
"""
from fastapi import APIRouter

from app.models.schemas import APIResponse
from app.services.scheduler import get_scheduler_status, daily_price_snapshot_job

import threading
import logging

logger = logging.getLogger("scheduler_router")

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.get("/status", response_model=APIResponse)
async def scheduler_status():
    """Get current scheduler status and next run time."""
    status = get_scheduler_status()
    return APIResponse(data=status)


@router.post("/run-now", response_model=APIResponse)
async def trigger_manual_run():
    """Trigger immediate scheduler run (non-blocking)."""
    logger.info("🔄 Manual scheduler trigger requested")

    # Run in background thread to avoid blocking the API
    thread = threading.Thread(
        target=daily_price_snapshot_job,
        name="manual_scheduler_run",
        daemon=True,
    )
    thread.start()

    return APIResponse(data={
        "message": "Scheduler job triggered in background",
        "status": "running",
    })
