#!/bin/bash
set -e

MARKER_FILE=".sync-marker"
REPORTS_DIR="sync_reports"
REPORT_FILE="$REPORTS_DIR/sync-report.json"
REPO_ROOT=$(git rev-parse --show-toplevel)

mkdir -p "$REPORTS_DIR"

# Handle --mark flag
if [ "$1" = "--mark" ]; then
    git rev-parse HEAD > "$MARKER_FILE"
    echo "✓ Sync marker updated to $(cat $MARKER_FILE)"
    exit 0
fi

# Run Python upgrade system validator
python3 << 'PYTHON_SCRIPT'
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.resolve()

# Colors
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'

def find_class_based_upgrades():
    """Find all class-based upgrade implementations"""
    frontend_upgrades = {}
    backend_upgrades = {}

    # Frontend: find all .ts files in upgrades/ subdirectories
    frontend_dir = REPO_ROOT / "frontend/src/game/upgrades"
    if frontend_dir.exists():
        for ts_file in frontend_dir.rglob("*.ts"):
            # Skip base class and index files
            if ts_file.name in ("Upgrade.ts", "index.ts"):
                continue
            # Extract upgrade ID from filename (e.g., damage_1.ts -> damage_1)
            upgrade_id = ts_file.stem
            frontend_upgrades[upgrade_id] = ts_file.relative_to(REPO_ROOT)

    # Backend: find all .py files in upgrades/ subdirectories
    backend_dir = REPO_ROOT / "backend/app/core/upgrades"
    if backend_dir.exists():
        for py_file in backend_dir.rglob("*.py"):
            # Skip base class and __init__ files
            if py_file.name in ("upgrade_implementation.py", "__init__.py"):
                continue
            # Extract upgrade ID from filename (e.g., damage_1.py -> damage_1)
            upgrade_id = py_file.stem
            backend_upgrades[upgrade_id] = py_file.relative_to(REPO_ROOT)

    return frontend_upgrades, backend_upgrades

def check_class_based_coverage():
    """Check if all class-based upgrades are synced between frontend and backend"""
    frontend, backend = find_class_based_upgrades()
    issues = []

    print(f"\n{BLUE}=== Class-Based Upgrade System Status ==={NC}")
    print(f"Frontend class-based upgrades: {len(frontend)}")
    print(f"Backend class-based upgrades: {len(backend)}")

    if len(frontend) == 0 and len(backend) == 0:
        print(f"\n{YELLOW}No class-based upgrades found yet.${NC}")
        print(f"Migration in progress. Class-based upgrades will be added in Phase 2+.")
        return []

    # Check for mismatches
    frontend_only = set(frontend.keys()) - set(backend.keys())
    backend_only = set(backend.keys()) - set(frontend.keys())

    if frontend_only:
        print(f"\n{RED}✗ Missing in backend ({len(frontend_only)}):${NC}")
        for upgrade_id in sorted(frontend_only):
            print(f"    {upgrade_id} ({frontend[upgrade_id]})")
        issues.append(f"Frontend upgrades missing in backend: {frontend_only}")

    if backend_only:
        print(f"\n{RED}✗ Missing in frontend ({len(backend_only)}):${NC}")
        for upgrade_id in sorted(backend_only):
            print(f"    {upgrade_id} ({backend[upgrade_id]})")
        issues.append(f"Backend upgrades missing in frontend: {backend_only}")

    if not frontend_only and not backend_only and len(frontend) > 0:
        print(f"\n{GREEN}✓ All class-based upgrades are synced!${NC}")
        for upgrade_id in sorted(frontend.keys()):
            print(f"    ✓ {upgrade_id}")

    return issues

# First check class-based system
class_issues = check_class_based_coverage()

# Also run legacy JSON analysis for now (during migration)
def load_frontend_upgrades():
    """Load all frontend upgrade files (legacy JSON)"""
    upgrades = {}
    upgrade_dir = REPO_ROOT / "frontend/src/game/data/upgrades"

    for json_file in upgrade_dir.glob("*.json"):
        if json_file.name == "curses.json":
            with open(json_file) as f:
                data = json.load(f)
                for u in data.get("curses", []):
                    upgrades[u["id"]] = {**u, "_file": "curses.json"}
        else:
            with open(json_file) as f:
                data = json.load(f)
                for u in data.get("upgrades", []):
                    upgrades[u["id"]] = {**u, "_file": json_file.name}

    return upgrades

print(f"\n{BLUE}=== Legacy JSON Upgrade System Status ==={NC}")
frontend_json = load_frontend_upgrades()
print(f"Legacy JSON upgrades: {len(frontend_json)}")
print(f"Status: {YELLOW}Currently in use during migration phase.${NC}")
print(f"Plan: Delete these files once all upgrades are migrated to class-based system.")

if class_issues:
    print(f"\n{RED}=== MIGRATION ISSUES ==={NC}")
    for i, issue in enumerate(class_issues, 1):
        print(f"{i}. {issue}")
else:
    if len(find_class_based_upgrades()[0]) == 0:
        print(f"\n{YELLOW}=== MIGRATION STATUS ===${NC}")
        print(f"Phase 1 (Infrastructure): In progress")
        print(f"Next: Implement Phase 2 (Stat Modifiers)")

PYTHON_SCRIPT

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review upgrade system analysis above"
echo "  2. Update backend to match frontend"
echo "  3. Run: ${BLUE}./sync-check.sh --mark${NC} to update sync marker"
echo ""
