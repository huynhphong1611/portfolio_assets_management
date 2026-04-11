"""
Application configuration via environment variables.
"""
import os
from dotenv import load_dotenv

# Load .env from project root (parent of backend/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv()  # Also try local .env


class Settings:
    """Application settings loaded from environment variables."""

    # Firebase
    FIREBASE_SERVICE_ACCOUNT_PATH: str = os.getenv(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        os.path.join(os.path.dirname(__file__), '..', 'firebase-service-account.json')
    )
    FIREBASE_PROJECT_ID: str = os.getenv("VITE_FIREBASE_PROJECT_ID", "")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "portfolio-mgmt-jwt-secret-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = int(os.getenv("JWT_EXPIRE_HOURS", "72"))

    # External APIs
    VNSTOCK_API_ENABLED: bool = os.getenv("VNSTOCK_API_ENABLED", "true").lower() == "true"
    VNSTOCK_API_KEY: str = os.getenv("VNSTOCK_API_KEY", "")
    COINGECKO_API_KEY: str = os.getenv("COINGECKO_API_KEY", "")

    # Deployment mode: "standalone" (VPS/local) or "serverless" (Cloud Run/Functions)
    # - standalone: APScheduler runs in-process as background thread
    # - serverless: APScheduler disabled, use external cron (e.g. Google Cloud Scheduler)
    DEPLOYMENT_MODE: str = os.getenv("DEPLOYMENT_MODE", "standalone").lower()

    # Secret key for external cron trigger endpoint (serverless mode)
    # External scheduler must send this key to authenticate cron requests
    CRON_AUTH_KEY: str = os.getenv("CRON_AUTH_KEY", os.getenv("JWT_SECRET", ""))

    # App
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    @property
    def is_serverless(self) -> bool:
        """Check if running in serverless mode."""
        return self.DEPLOYMENT_MODE == "serverless"


settings = Settings()
