"""
Firebase Admin SDK initialization — singleton pattern.
"""
import os
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from app.config import settings

_app = None
_db = None


def _initialize():
    """Initialize Firebase Admin SDK if not already done."""
    global _app, _db
    if _app is not None:
        return

    sa_path = settings.FIREBASE_SERVICE_ACCOUNT_PATH
    if os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
        _app = firebase_admin.initialize_app(cred)
    else:
        # Try Application Default Credentials (for cloud environments)
        try:
            _app = firebase_admin.initialize_app()
        except Exception as e:
            raise RuntimeError(
                f"Firebase init failed. Service account not found at '{sa_path}' "
                f"and Application Default Credentials not available: {e}"
            )
    _db = firestore.client()


def get_db() -> firestore.Client:
    """Get Firestore client instance."""
    if _db is None:
        _initialize()
    return _db


def get_firebase_auth():
    """Get Firebase Auth module (for verifying ID tokens)."""
    if _app is None:
        _initialize()
    return firebase_auth
