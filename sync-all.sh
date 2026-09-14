#!/usr/bin/env bash
python3 scripts/upgrade_defs_sync.py --write
python3 scripts/projectile_defs_sync.py --write
python3 scripts/enemy_defs_sync.py --write
python3 scripts/difficulty_defs_sync.py --write
python3 scripts/version_sync.py --write