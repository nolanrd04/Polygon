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

def load_frontend_upgrades():
    """Load all frontend upgrade files"""
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

def load_backend_upgrades():
    """Load backend upgrades from JSON"""
    upgrades = {}
    upgrade_file = REPO_ROOT / "backend/app/core/data/upgrades.json"

    with open(upgrade_file) as f:
        upgrades = json.load(f)

    return upgrades

def load_backend_config():
    """Load backend configuration to see what it knows about"""
    # Read wave_service.py to understand what the backend validates
    wave_service = REPO_ROOT / "backend/app/services/wave_service.py"
    with open(wave_service) as f:
        content = f.read()

    # Parse what stats the backend knows about
    if "stat_mapping = {" in content:
        start = content.find("stat_mapping = {")
        end = content.find("}", start) + 1
        mapping_str = content[start:end]
        # Extract stat names (simple heuristic)
        known_stats = []
        for line in mapping_str.split('\n'):
            if ':' in line and '"' in line:
                parts = line.split(':')
                if len(parts) >= 2:
                    stat = parts[0].strip().strip('"').strip("'")
                    known_stats.append(stat)
        return known_stats

    return ["speed", "maxHealth", "health"]  # Defaults

def check_upgrade_coverage():
    """Check if backend can handle all frontend upgrades"""
    frontend = load_frontend_upgrades()
    backend = load_backend_upgrades()
    known_stats = load_backend_config()

    issues = []

    print(f"\n{BLUE}=== Upgrade System Coverage Analysis ==={NC}")
    print(f"Frontend upgrades: {len(frontend)}")
    print(f"Backend upgrades: {len(backend)}")

    # Check 1: Curses in regular rolls
    print(f"\n{YELLOW}1. Curse Handling:{NC}")
    backend_curses = [u for u in backend.values() if u.get("curse")]
    frontend_curse_files = [u for u in frontend.values() if u.get("_file") == "curses.json"]
    print(f"   Curses in backend: {len(backend_curses)}")
    print(f"   Curses in frontend (separate): {len(frontend_curse_files)}")
    if backend_curses:
        print(f"   ⚠️  Backend includes curses in UPGRADES dict (should be separate)")
        issues.append("Curses mixed with regular upgrades in backend")

    # Check 2: Missing upgrades
    print(f"\n{YELLOW}2. Coverage Comparison:{NC}")
    missing_in_backend = set(frontend.keys()) - set(backend.keys())
    extra_in_backend = set(backend.keys()) - set(frontend.keys())

    if missing_in_backend:
        print(f"   ⚠️  Missing in backend ({len(missing_in_backend)}): {list(missing_in_backend)[:3]}...")
        issues.append(f"Frontend upgrades not in backend: {missing_in_backend}")
    else:
        print(f"   ✓ All frontend upgrades in backend")

    if extra_in_backend:
        print(f"   ⚠️  Extra in backend ({len(extra_in_backend)}): {list(extra_in_backend)[:3]}...")
        issues.append(f"Backend has upgrades not in frontend: {extra_in_backend}")
    else:
        print(f"   ✓ No extra upgrades in backend")

    # Check 3: Stat coverage
    print(f"\n{YELLOW}3. Backend Stat Coverage:{NC}")
    print(f"   Backend knows about: {known_stats}")

    used_stats = set()
    for u in frontend.values():
        if u.get("type") == "stat_modifier" and u.get("stat"):
            used_stats.add(u["stat"])

    unknown_stats = used_stats - set(known_stats)
    if unknown_stats:
        print(f"   ⚠️  Unknown stats in frontend: {unknown_stats}")
        issues.append(f"Frontend uses stats backend doesn't handle: {unknown_stats}")
    else:
        print(f"   ✓ All frontend stats known to backend")

    # Check 4: Upgrade types
    print(f"\n{YELLOW}4. Upgrade Type Coverage:{NC}")
    frontend_types = set(u.get("type") for u in frontend.values())
    backend_handles = {"stat_modifier"}  # Only type backend validates

    unhandled_types = frontend_types - backend_handles
    print(f"   Frontend types: {frontend_types}")
    print(f"   Backend validates: {backend_handles}")

    if unhandled_types:
        count = sum(1 for u in frontend.values() if u.get("type") in unhandled_types)
        print(f"   ⚠️  Backend doesn't validate {len(unhandled_types)} upgrade types ({count} upgrades affected)")
        print(f"      Types: {unhandled_types}")
        issues.append(f"Backend doesn't validate upgrade types: {unhandled_types}")
    else:
        print(f"   ✓ Backend validates all upgrade types")

    # Check 5: Target coverage (for stat modifiers)
    print(f"\n{YELLOW}5. Upgrade Target Coverage:{NC}")
    frontend_targets = set()
    for u in frontend.values():
        if u.get("type") == "stat_modifier":
            target = u.get("target")
            if target:
                frontend_targets.add(target)

    backend_handles_targets = {"player"}  # Only target backend validates
    unhandled_targets = frontend_targets - backend_handles_targets

    if unhandled_targets:
        count = sum(1 for u in frontend.values()
                   if u.get("type") == "stat_modifier" and u.get("target") in unhandled_targets)
        print(f"   ⚠️  Backend only validates 'player' target, ignores: {unhandled_targets} ({count} upgrades)")
        issues.append(f"Backend doesn't validate targets: {unhandled_targets}")
    else:
        print(f"   ✓ Backend validates all targets")

    return issues

# Run analysis
issues = check_upgrade_coverage()

if issues:
    print(f"\n{RED}=== SYNC ISSUES FOUND ==={NC}")
    for i, issue in enumerate(issues, 1):
        print(f"{i}. {issue}")
    print(f"\n{YELLOW}Recommendation: These need manual backend updates or refactoring.${NC}")
else:
    print(f"\n{GREEN}✓ All upgrade systems appear in sync!${NC}")

PYTHON_SCRIPT

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review upgrade system analysis above"
echo "  2. Update backend to match frontend"
echo "  3. Run: ${BLUE}./sync-check.sh --mark${NC} to update sync marker"
echo ""
