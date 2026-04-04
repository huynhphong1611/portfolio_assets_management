---
name: secret_scanning
description: Detect secrets and configure gitignore to prevent leaks.
---

# Secret Scanning Checkmarks

1. **Grep Search Syntax**: Scan workspace for common key patterns:
   - `API_KEY`
   - `password=`
   - `sk-` (Stripe/OpenAI keys)
   - `.env` files mistakenly tracked.

2. **Environment Template**: Ensure `.env.example` exists without the actual values. This is the only `.env` variation allowed in Git.

3. **Firebase Protection**: Before deployment, ensure `firebase.json` restricts public access and `firestore.rules` enforces `allow read, write: if request.auth != null;` appropriately based on collections.
