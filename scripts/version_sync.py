#!/usr/bin/env python3
"""
Single source of truth for the game version: frontend/version.json.

Everything that shows or records a version reads a version.json rather than
carrying its own literal:
  - frontend: vite.config.ts inlines it into the bundle as __GAME_VERSION__
    (MainMenu.tsx's footer).
  - backend:  app/core/config.py -> settings.game_version, used for the
    FastAPI/API version and the GAME_VERSION stamped onto every run analytics
    snapshot.

The backend gets its own copy at backend/version.json because frontend and
backend deploy separately - neither can reach a shared repo-root file at
runtime. That copy is generated from the frontend's, exactly like the backend's
upgrade/projectile/enemy/difficulty data.

Also checked here, because it's the one version still written by hand: the
newest release entry in UpdateNotesPage.tsx. That entry is content (you write
the notes), so it isn't generated - but shipping notes headed v0.2.8 from a
build that calls itself v0.2.7 is exactly the drift this repo's sync scripts
exist to catch.

Used by:
  - `python3 scripts/version_sync.py --write`   regenerate the backend copy
  - `python3 scripts/version_sync.py`           parity check (exit 1 on drift)
  - `sync-check.sh`                             same check, wired into the repo's sync workflow
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_JSON = REPO_ROOT / "frontend/version.json"
BACKEND_JSON = REPO_ROOT / "backend/version.json"
UPDATE_NOTES_TSX = REPO_ROOT / "frontend/src/pages/UpdateNotesPage.tsx"


def read_version(path: Path) -> str:
    return json.loads(path.read_text())["version"]


def read_newest_notes_version() -> str | None:
    """
    The first `version: 'vX.Y.Z'` in the file. The notes array is newest-first,
    so the first match is the release being shipped.
    """
    match = re.search(r"version:\s*'v([^']+)'", UPDATE_NOTES_TSX.read_text())
    return match.group(1) if match else None


def write_backend_copy(version: str) -> None:
    BACKEND_JSON.write_text(json.dumps({"version": version}, indent=2) + "\n")
    print(f"Wrote version {version} to {BACKEND_JSON.relative_to(REPO_ROOT)}")


def main() -> int:
    source = read_version(FRONTEND_JSON)

    if "--write" in sys.argv:
        write_backend_copy(source)
        return 0

    mismatches = []

    backend = read_version(BACKEND_JSON) if BACKEND_JSON.exists() else None
    if backend != source:
        mismatches.append(
            f"  - backend/version.json: {backend if backend else 'missing'} "
            f"(frontend/version.json says {source})"
        )

    notes = read_newest_notes_version()
    if notes is None:
        mismatches.append(f"  - {UPDATE_NOTES_TSX.name}: no version entry found")
    elif notes != source:
        mismatches.append(
            f"  - {UPDATE_NOTES_TSX.name}: newest entry is v{notes} "
            f"(frontend/version.json says {source})"
        )

    if mismatches:
        print("Found version mismatch(es) against frontend/version.json:")
        print("\n".join(mismatches))
        return 1

    print(f"OK - version {source} matches the backend copy and the newest update-notes entry.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
