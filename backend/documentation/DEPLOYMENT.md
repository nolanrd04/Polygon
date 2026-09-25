# Deployment

How the game is hosted, which settings live where, and how to switch between local and cloud services. The frontend side of the connection is in `frontend/documentation/BACKEND_CONNECTION.md`.

---

## Overview

```
Browser ── game files ──▶ Vercel (frontend, static build of frontend/)
   │
   └──── /api/... calls ──▶ Render (FastAPI backend, backend/)
                                │
                                ▼
                        MongoDB Atlas (database)
```

The browser calls the backend directly (cross-origin). Vercel only serves the built game files.

| Piece | Host | Deploys from |
|-------|------|--------------|
| Frontend | Vercel | GitHub push, configured by root `vercel.json` |
| Backend | Render web service (free tier) | GitHub push, root directory `backend/` |
| Database | MongoDB Atlas (M0 free cluster) | n/a |

Both Vercel and Render redeploy automatically when the branch they watch is pushed.

---

## Where settings live

`.env` files are gitignored and never leave your machine. Hosts get their values from their own dashboards.

| Setting | Local | Production |
|---------|-------|------------|
| `MONGODB_URL`, `MONGODB_DATABASE` | `backend/.env` | Render → Environment |
| `SECRET_KEY` | `backend/.env` (dev key) | Render → Environment (a **different** key) |
| `CORS_ORIGINS` | `backend/.env` (`http://localhost:3000`) | Render → Environment (the Vercel domain) |
| `API_TARGET` (dev proxy target) | `frontend/.env` or shell | not used |
| `VITE_API_URL` (backend address baked into the build) | unset | Vercel → project Environment Variables |

Templates: `backend/.env.example`, `frontend/.env.example`.

**Secret vs. address:** anything that grants access (`MONGODB_URL` contains the DB password, `SECRET_KEY` signs login tokens) stays out of git and out of `VITE_*` variables. Addresses like the Render URL are not secrets.

**Rotating `SECRET_KEY`** logs every player out (existing tokens stop validating). Generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`.

---

## Render (backend)

| Field | Value |
|-------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-proxy-headers` |
| Python version | from `backend/.python-version` |

Start command notes:
- `--host 0.0.0.0` listens for outside connections (the default only accepts same-machine requests).
- `$PORT` is assigned by Render.
- No `--reload`; that's for local development only (`start.sh`).
- **Keep `--no-proxy-headers`.** The backend's abuse protection works out client addresses itself (`app/core/limiter.py`) and relies on uvicorn not doing its own forwarded-header handling.

Environment variables: `MONGODB_URL`, `MONGODB_DATABASE`, `SECRET_KEY`, `CORS_ORIGINS`.

### Free tier behavior
- **Cold starts:** the service sleeps after ~15 minutes idle; the next request takes ~30–60s while it wakes.
- **Restarts clear memory:** anything held in process memory (e.g. rate-limit counters) resets on every deploy, restart, or wake-up.
- **Background jobs run only while awake.** There are no scheduled jobs on the free tier, so periodic maintenance runs from startup (see below).

### Background maintenance
On startup the backend launches a background task (`app/services/account_cleanup_service.py`) that removes accounts which never played, after a grace period, along with their owned data. It repeats periodically while the server is running. Anti-cheat records are kept. This also runs against your local database when you run the backend locally.

---

## Vercel (frontend)

Root `vercel.json` builds `frontend/` and serves `frontend/dist`. Its only rewrite is the SPA fallback (`/(.*)` → `/index.html`) so client-side routes like `/login` work on refresh. There is intentionally no `/api` rewrite.

`VITE_API_URL` must be set (Production, and Preview if used) to the Render URL: `https://` and no trailing slash or `/api`. It is inlined at build time, so changing it requires a redeploy.

---

## MongoDB Atlas

- **Database user:** its username and password are inside `MONGODB_URL`.
- **Network Access:** must include `0.0.0.0/0` (allow from anywhere). Render's free tier has no fixed outbound IP. The database password is what protects the cluster.
- **Database name:** `MONGODB_DATABASE` picks the database inside the cluster. Databases are created on first write, so a typo silently creates a new empty one.

---

## Switching between local and cloud

| Setup | How |
|-------|-----|
| Everything local | `docker compose up -d` in `backend/`, LOCAL block active in `backend/.env`, `npm run dev` |
| Local backend, cloud database | Uncomment the CLOUD block in `backend/.env` instead of LOCAL |
| Local frontend, cloud backend | `API_TARGET=https://<render-url> npm run dev` |

⚠️ The cloud backend and the cloud database hold **real player data**. Anything done in the last two setups (test accounts, runs) lands there.

---

## Rolling out changes that span hosts

A setting must exist before (or together with) the code that depends on it:
- New `VITE_*` variable → set it in Vercel **before** pushing the code that reads it (it's baked in at build).
- New backend env var → add it in Render before or with the push.
- Changing the Render start command → consider what the *currently deployed* code expects, since saving can restart the old code with the new command.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Deploy log: `SSL handshake failed` / `ServerSelectionTimeoutError` to `*.mongodb.net` | Atlas Network Access doesn't allow Render (add `0.0.0.0/0`) |
| Deploy log: `No open ports detected` after a traceback | The app crashed during startup; read the traceback above it |
| App refuses to start: `SECRET_KEY` error | Missing or shorter than 32 characters |
| Browser console: CORS error; preflight returns `400 Disallowed CORS origin` | `CORS_ORIGINS` doesn't exactly match the site origin (watch for a trailing slash) |
| Live site's API calls return HTML | `VITE_API_URL` unset at build time, so calls hit Vercel's SPA fallback; set it and redeploy |
| First request after idle is very slow | Render cold start |