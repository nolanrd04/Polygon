#!/bin/bash
set -e

MARKER_FILE=".sync-marker"
REPO_ROOT=$(git rev-parse --show-toplevel)

# Handle --mark flag
if [ "$1" = "--mark" ]; then
    git rev-parse HEAD > "$MARKER_FILE"
    echo "✓ Sync marker updated to $(cat $MARKER_FILE)"
    exit 0
fi

# Value-parity check: parses every frontend UpgradeDef and diffs it,
# field-by-field, against the live backend/app/core/data/upgrades.json.
# See scripts/upgrade_defs_sync.py for the parser/diff logic.
if python3 "$REPO_ROOT/scripts/upgrade_defs_sync.py"; then
    STATUS=0
else
    STATUS=1
fi

echo ""
if [ "$STATUS" -ne 0 ]; then
    echo "Next steps:"
    echo "  1. If the frontend defs are correct, regenerate the backend copy:"
    echo "       python3 scripts/upgrade_defs_sync.py --write"
    echo "  2. If a mismatch is unintentional, fix the source (usually the frontend def)"
    echo "     and re-run this script."
fi

exit "$STATUS"
