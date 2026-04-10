"""
Portfolio Management Backend — FastAPI Application.

Unified backend handling:
- Authentication (Guest + Firebase Auth)
- Firestore CRUD (transactions, funds, assets, liabilities, snapshots)
- Price fetching (vnstock, CoinGecko)
- Portfolio calculations
- Dashboard aggregation
"""
import os
import logging
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings

# ── Logging ──

LOG_FILE = os.getenv("LOG_FILE", "logs/backend.log")
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger("backend")

# ── App ──

app = FastAPI(
    title="Portfolio Management API",
    description="Backend API for Portfolio Assets Management v5.0",
    version="2.0.0",
)

# ── CORS ──

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global Error Handler ──

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "detail": str(exc)},
    )

# ── Routers ──

from app.routers import auth, transactions, funds, external_assets, liabilities
from app.routers import prices, snapshots, settings as settings_router, dashboard
from app.routers import scheduler as scheduler_router

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(funds.router)
app.include_router(external_assets.router)
app.include_router(liabilities.router)
app.include_router(prices.router)
app.include_router(snapshots.router)
app.include_router(settings_router.router)
app.include_router(dashboard.router)
app.include_router(scheduler_router.router)

# ── Scheduler Lifecycle ──

@app.on_event("startup")
def startup_event():
    """Start the background scheduler on app startup."""
    try:
        from app.services.scheduler import start_scheduler
        start_scheduler()
        logger.info("✅ Background scheduler started")
    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {e}", exc_info=True)


@app.on_event("shutdown")
def shutdown_event():
    """Stop the scheduler on shutdown."""
    try:
        from app.services.scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass

# ── Health Check ──

@app.get("/")
def health():
    """Health check and config status."""
    return {
        "status": "ok",
        "api_enabled": settings.VNSTOCK_API_ENABLED,
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
    }


@app.get("/api/status")
def api_status():
    """Check service status and capabilities."""
    checks = {
        "firebase": "unknown",
        "vnstock": "unknown",
    }

    try:
        from app.firebase_init import get_db
        get_db()
        checks["firebase"] = "ok"
    except Exception as e:
        checks["firebase"] = f"error: {e}"

    try:
        import vnstock
        checks["vnstock"] = "ok"
    except ImportError:
        checks["vnstock"] = "not installed"

    return {
        "enabled": settings.VNSTOCK_API_ENABLED,
        "checks": checks,
    }
