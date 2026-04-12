"""
Scheduler router — Check status, trigger manual runs, and external cron endpoint.

Supports dual deployment modes:
- standalone: APScheduler runs in-process, /run-now for manual triggers
- serverless: APScheduler disabled, /trigger for external cron (e.g. Google Cloud Scheduler)
"""
from fastapi import APIRouter, Header, HTTPException
from typing import Optional

from app.config import settings
from app.models.schemas import APIResponse
from app.services.scheduler import get_scheduler_status, daily_price_snapshot_job

import threading
import logging

logger = logging.getLogger("scheduler_router")

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


@router.get("/status", response_model=APIResponse)
async def scheduler_status():
    """Get current scheduler status, deployment mode, and next run time."""
    status = get_scheduler_status()
    status["deployment_mode"] = settings.DEPLOYMENT_MODE
    return APIResponse(data=status)


@router.post("/run-now", response_model=APIResponse)
async def trigger_manual_run():
    """Trigger immediate scheduler run (non-blocking). Works in both modes."""
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


@router.post("/trigger", response_model=APIResponse)
async def external_cron_trigger(x_cron_key: Optional[str] = Header(None)):
    """
    External cron trigger endpoint — designed for serverless deployments.

    Google Cloud Scheduler (or any external cron) sends a POST request here
    with the secret key in the X-Cron-Key header to authenticate.

    IMPORTANT: Runs SYNCHRONOUSLY so that Cloud Run keeps the container alive
    until the job finishes. Daemon threads get killed when Cloud Run scales
    down after the HTTP response is sent.

    Cloud Scheduler supports up to 30 min timeout — more than enough.

    Example Cloud Scheduler config:
      URL:    https://your-cloud-run-url/api/scheduler/trigger
      Method: POST
      Header: X-Cron-Key: <your-cron-auth-key>
      Cron:   0 9 * * * (daily at 9:00 AM)
      Timeout: 300s (5 minutes recommended)
    """
    # Authenticate the cron request
    if not settings.CRON_AUTH_KEY:
        raise HTTPException(
            status_code=500,
            detail="CRON_AUTH_KEY not configured. Set it in environment variables.",
        )

    if x_cron_key != settings.CRON_AUTH_KEY:
        logger.warning("⚠️ External cron trigger: invalid or missing X-Cron-Key")
        raise HTTPException(status_code=403, detail="Invalid cron authentication key")

    logger.info("🕘 External cron trigger: authenticated, starting daily job...")

    # Run SYNCHRONOUSLY — Cloud Run keeps the container alive while
    # the request is in progress. Using a daemon thread here would risk
    # the container being killed before the job completes.
    try:
        daily_price_snapshot_job()
        return APIResponse(data={
            "message": "Daily job completed successfully",
            "status": "done",
            "deployment_mode": settings.DEPLOYMENT_MODE,
        })
    except Exception as e:
        logger.error(f"❌ Daily job failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Daily job failed: {str(e)}",
        )
