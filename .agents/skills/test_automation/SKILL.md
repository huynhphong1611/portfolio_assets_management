---
name: test_automation
description: Creating mock data and executing cross-environment tests.
---

# Test Automation Workflow

1. **Mock Data Engine**:
   - For JavaScript, create functions using `@faker-js/faker` or hardcoded realistic arrays to mock API responses and Firestore documents.
   - For Python `vnstock` mock data, use `pandas` to generate dummy DataFrame OHLCV data.

2. **Structure (AAA)**:
   - Arrange: Setup mock data and initialize components.
   - Act: Trigger user events or logic functions.
   - Assert: Check the exact expected outcome.

3. **Firebase Mocks**: Never hit the production Firestore during unit tests. Use a local emulators suite or mock implementations of `firestoreService.js`.
