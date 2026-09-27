"""
Backend unit tests run without Firebase: the Firebase bootstrap module and the
Firestore service are replaced by in-memory stand-ins before the app is imported.
"""
import pathlib
import sys
import types

BACKEND = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from tests import fake_firestore  # noqa: E402

_firebase = types.ModuleType("app.firebase_init")


def _unavailable(*args, **kwargs):
    raise RuntimeError("Firebase is not available in unit tests")


_firebase.get_db = _unavailable
_firebase.get_firebase_auth = _unavailable
sys.modules["app.firebase_init"] = _firebase
sys.modules["app.services.firestore_service"] = fake_firestore.as_module()

import app.services  # noqa: E402

app.services.firestore_service = sys.modules["app.services.firestore_service"]

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_store():
    fake_firestore.reset()
    yield
