---
name: secret_scanning
description: Comprehensive secret detection, prevention, and remediation for fullstack applications. Covers regex patterns for API keys, passwords, private keys, and tokens across all file types. Includes gitignore templates, pre-commit hooks, and incident response procedures.
---

# Secret Scanning Skill

## Scan Targets

Scan ALL files in the workspace excluding:
- `node_modules/`
- `.git/`
- `__pycache__/`
- `dist/`, `build/`
- Binary files (images, fonts, etc.)

---

## Detection Patterns

### High Severity — Block Immediately

| Category | Regex Pattern | Example Match |
|---|---|---|
| **Firebase API Key** | `AIza[0-9A-Za-z_\-]{35}` | `AIzaSy...REDACTED...` |
| **AWS Access Key** | `AKIA[0-9A-Z]{16}` | `AKIA...REDACTED...` |
| **AWS Secret Key** | `(?i)aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"?[A-Za-z0-9/+=]{40}` | |
| **Private Key** | `-----BEGIN (RSA\|EC\|DSA\|OPENSSH )?PRIVATE KEY-----` | PEM files |
| **Stripe Key** | `sk_live_[0-9a-zA-Z]{24,}` | `sk_live_...REDACTED...` |
| **OpenAI Key** | `sk-[a-zA-Z0-9]{20,}` | `sk-proj-...REDACTED...` |
| **GitHub Token** | `gh[ps]_[A-Za-z0-9_]{36,}` | `ghp_...REDACTED...` |

### Medium Severity — Review Required

| Category | Regex Pattern |
|---|---|
| **Generic API Key** | `(?i)(api[_-]?key\|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?` |
| **Generic Token** | `(?i)(token\|bearer\|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_.\-]{20,}['"]?` |
| **Generic Password** | `(?i)(password\|passwd\|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?` |
| **Connection String** | `(?i)(mongodb\|postgres\|mysql\|redis):\/\/[^\s'"]+` |
| **CoinGecko Key** | `(?i)coingecko[_-]?api[_-]?key\s*[:=]\s*['"]?CG-[A-Za-z0-9]{20,}` |
| **vnstock Key** | `(?i)vnstock[_-]?api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9_\-]{10,}` |

### Low Severity — Informational

| Category | Regex Pattern |
|---|---|
| **Hardcoded IP** | `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` (excluding 127.0.0.1, 0.0.0.0) |
| **TODO/FIXME with security** | `(?i)(TODO\|FIXME\|HACK).*(?:security\|auth\|password\|secret)` |
| **Disabled SSL** | `(?i)verify\s*=\s*False` |

---

## Scanning Commands

### Quick Scan (grep-based)
```bash
# Scan for API keys
grep -rn --include="*.py" --include="*.js" --include="*.jsx" --include="*.md" --include="*.env*" --include="*.yml" --include="*.yaml" --include="*.json" \
  -E "(api[_-]?key|apikey|secret|password|token|bearer)(\s*[:=])" . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=__pycache__

# Scan for Firebase keys
grep -rn "AIza[0-9A-Za-z_\-]" . --exclude-dir=node_modules --exclude-dir=.git

# Scan for private keys
grep -rn "BEGIN.*PRIVATE KEY" . --exclude-dir=node_modules --exclude-dir=.git

# Scan for AWS keys
grep -rn "AKIA[0-9A-Z]" . --exclude-dir=node_modules --exclude-dir=.git

# Check if .env is tracked by git
git ls-files | grep -i "\.env"
```

### Using Antigravity grep_search tool
```
Tool: grep_search
Query: api_key|apikey|API_KEY|secret|password|PRIVATE KEY
SearchPath: <project_root>
Includes: ["*.py", "*.js", "*.jsx", "*.md", "*.env", "*.yml"]
CaseInsensitive: true
IsRegex: true
```

---

## Required .gitignore

Every project MUST have these entries:

```gitignore
# ══════════════════════════════════════════════
# SECRETS & CREDENTIALS — NEVER COMMIT
# ══════════════════════════════════════════════
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.pem
*.key
*.p12
*.pfx
credentials.json
service-account*.json
*-credentials.json
firebase-adminsdk*.json

# ══════════════════════════════════════════════
# PYTHON
# ══════════════════════════════════════════════
__pycache__/
*.py[cod]
*$py.class
*.so
.venv/
venv/
env/
*.egg-info/
dist/
build/
.pytest_cache/
.coverage
htmlcov/
*.egg

# ══════════════════════════════════════════════
# NODE
# ══════════════════════════════════════════════
node_modules/
dist/
build/
.cache/
*.tsbuildinfo
coverage/

# ══════════════════════════════════════════════
# IDE & OS
# ══════════════════════════════════════════════
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db
desktop.ini

# ══════════════════════════════════════════════
# LOGS
# ══════════════════════════════════════════════
logs/
*.log
npm-debug.log*
yarn-debug.log*

# ══════════════════════════════════════════════
# DOCKER
# ══════════════════════════════════════════════
docker-compose.override.yml
```

---

## Environment Template (.env.example)

This is the ONLY `.env` variant allowed in Git:

```bash
# Firebase Config (frontend — these are public keys, OK to expose)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# Backend API URL (frontend)
VITE_API_URL=http://localhost:8000/api

# Backend Configuration
VNSTOCK_API_ENABLED=true
LOG_LEVEL=INFO

# External API Keys (backend only — NEVER prefix with VITE_)
VNSTOCK_API_KEY=
COINGECKO_API_KEY=

# Firebase Admin (backend only)
FIREBASE_ADMIN_CREDENTIALS=
```

---

## Remediation Procedures

### If a Secret is Found in Code (Not Yet Committed)
1. Remove the secret from the file.
2. Move it to `.env` file.
3. Access via `os.getenv("KEY")` (Python) or `import.meta.env.VITE_KEY` (Vite).
4. Verify `.env` is in `.gitignore`.

### If a Secret Was Already Committed to Git
1. **IMMEDIATELY rotate the key** — generate a new one from the service provider.
2. Update `.env` with the new key.
3. Remove from Git history:
   ```bash
   # Option A: BFG Repo Cleaner (recommended)
   bfg --replace-text passwords.txt repo.git

   # Option B: git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
4. Force push: `git push --force-with-lease`
5. Notify team members to re-clone.
6. Document the incident.

### If a Secret Was Pushed to a Public Repository
1. **IMMEDIATELY** rotate ALL exposed credentials.
2. Check service logs for unauthorized usage during the exposure window.
3. Remove from Git history (see above).
4. Enable GitHub Secret Scanning alerts for the repository.
5. File an incident report.

---

## Firebase-Specific Security

### Rules Audit Checklist
- [ ] No `allow read, write: if true` on user data collections
- [ ] `system_users/{userId}/**` requires `request.auth.uid == userId`
- [ ] `marketPrices` is read-only (write: false)
- [ ] No wildcard rules at root level
- [ ] `users` collection has restricted write access

### Firebase Config Keys Are Public
Firebase `apiKey`, `authDomain`, `projectId` — these are **designed to be public**. They are NOT secrets. Security is enforced by Firestore Security Rules, not by hiding these keys.

However:
- **Firebase Admin SDK credentials** (service account JSON) → ARE secrets → backend only.
- **Firebase Auth custom tokens** → ARE secrets → backend only.

---

## Pre-Commit Workflow

Before every commit, run:
1. Secret pattern scan (see Commands above)
2. Verify `.gitignore` contains all required entries
3. Check that no `.env` file is staged: `git diff --cached --name-only | grep -i "\.env"`
4. Review `git diff --cached` for any suspicious strings

Use the `/pre_commit_scan` workflow to automate this.
