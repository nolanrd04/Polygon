#!/bin/bash

set -e

MARKER_FILE=".sync-marker"
REPORTS_DIR="sync_reports"
REPORT_FILE="$REPORTS_DIR/sync-report.json"
REPO_ROOT=$(git rev-parse --show-toplevel)

# Create reports directory if it doesn't exist
mkdir -p "$REPORTS_DIR"

# Handle --mark flag to update marker after syncing
if [ "$1" = "--mark" ]; then
    git rev-parse HEAD > "$MARKER_FILE"
    echo "✓ Sync marker updated to $(cat $MARKER_FILE)"
    exit 0
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize marker if it doesn't exist
if [ ! -f "$MARKER_FILE" ]; then
    echo -e "${YELLOW}First run: Creating sync marker...${NC}"
    git rev-parse HEAD > "$MARKER_FILE"
    echo -e "${GREEN}Marker created. Run sync-check again to see what needs syncing.${NC}"
    exit 0
fi

LAST_SYNC_COMMIT=$(cat "$MARKER_FILE")

echo -e "${BLUE}=== Sync Check ===${NC}"
echo "Last sync marker: $LAST_SYNC_COMMIT"
echo "Comparing changes since then..."
echo ""

# Get changed files since last sync
CHANGED_UPGRADES=$(git diff $LAST_SYNC_COMMIT HEAD --name-only -- "frontend/src/game/data/upgrades/*.json" 2>/dev/null || true)
CHANGED_ENEMIES=$(git diff $LAST_SYNC_COMMIT HEAD --name-only -- "frontend/src/game/entities/enemies/*.ts" 2>/dev/null || true)
CHANGED_DIFFICULTY=$(git diff $LAST_SYNC_COMMIT HEAD --name-only -- "frontend/src/game/systems/difficulty/*.ts" 2>/dev/null || true)

# Build report object
REPORT="{
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"last_sync_commit\": \"$LAST_SYNC_COMMIT\",
  \"current_commit\": \"$(git rev-parse HEAD)\",
  \"changed_files\": {
    \"upgrades\": [],
    \"enemies\": [],
    \"difficulty\": []
  },
  \"summary\": {}
}
"

# Process upgrade changes
if [ -n "$CHANGED_UPGRADES" ]; then
    echo -e "${YELLOW}Upgrade Files Changed:${NC}"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            echo "  • $file"
            REPORT=$(echo "$REPORT" | jq --arg f "$file" '.changed_files.upgrades += [$f]')
        fi
    done <<< "$CHANGED_UPGRADES"
    echo ""
fi

# Process enemy changes
if [ -n "$CHANGED_ENEMIES" ]; then
    echo -e "${YELLOW}Enemy Files Changed:${NC}"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            echo "  • $file"
            REPORT=$(echo "$REPORT" | jq --arg f "$file" '.changed_files.enemies += [$f]')
        fi
    done <<< "$CHANGED_ENEMIES"
    echo ""
fi

# Process difficulty changes
if [ -n "$CHANGED_DIFFICULTY" ]; then
    echo -e "${YELLOW}Difficulty/Wave Settings Changed:${NC}"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            echo "  • $file"
            REPORT=$(echo "$REPORT" | jq --arg f "$file" '.changed_files.difficulty += [$f]')
        fi
    done <<< "$CHANGED_DIFFICULTY"
    echo ""
fi

# Check for specific upgrade changes
if [ -n "$CHANGED_UPGRADES" ]; then
    echo -e "${YELLOW}Upgrade Changes Detected:${NC}"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            # Show the diff
            echo "  File: $file"
            git diff $LAST_SYNC_COMMIT HEAD -- "$file" | head -50
            echo ""
        fi
    done <<< "$CHANGED_UPGRADES"
fi

# Check for enemy stat changes
if [ -n "$CHANGED_ENEMIES" ]; then
    echo -e "${YELLOW}Enemy Changes Detected:${NC}"
    while IFS= read -r file; do
        if [ -n "$file" ]; then
            echo "  File: $file"
            # Extract key stats (health, defense, bundleDropChance, color)
            git diff $LAST_SYNC_COMMIT HEAD -- "$file" | grep -E "(health|defense|bundleDropChance|color|teleport)" || true
            echo ""
        fi
    done <<< "$CHANGED_ENEMIES"
fi

# Summary
UPGRADE_COUNT=$(echo "$REPORT" | jq '.changed_files.upgrades | length')
ENEMY_COUNT=$(echo "$REPORT" | jq '.changed_files.enemies | length')
DIFFICULTY_COUNT=$(echo "$REPORT" | jq '.changed_files.difficulty | length')

SUMMARY="Changed: $UPGRADE_COUNT upgrade file(s), $ENEMY_COUNT enemy file(s), $DIFFICULTY_COUNT difficulty file(s)"
REPORT=$(echo "$REPORT" | jq --arg s "$SUMMARY" '.summary.text = $s')

# Write JSON report
echo "$REPORT" | jq '.' > "$REPORT_FILE"
echo -e "${GREEN}✓ Report saved to: ${BLUE}$REPORT_FILE${GREEN}${NC}"
echo ""
echo -e "${BLUE}Summary: $SUMMARY${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review changes above and in sync-report.json"
echo "  2. Update backend files accordingly"
echo "  3. Run: ${BLUE}./sync-check.sh --mark${NC} to update sync marker"
echo ""
