#!/usr/bin/env python3
"""
Generates FRAGMENT_VALUE_SPLIT_BY_WAVE (and its fallback row) in
frontend/src/game/systems/difficulty/Normal.ts from the shop and bundle rarity
tables in the same file, then regenerates the backend copy.

Each number is a tier's share of a wave's fragment *value*: shop slots' share
of all upgrades x the shop weights, plus the rest x what bundles hand out
(a bundle of a tier plus its extra items, capped at that tier).

Used by:
  - `python3 scripts/fragment_table_sync.py --write`   regenerate Normal.ts + backend json
  - `python3 scripts/fragment_table_sync.py`           warn if the split is out of date

A stale split only warns, because it can be deliberate. Normal.ts vs backend
parity for these tables is checked by difficulty_defs_sync.py, which fails.
"""

from __future__ import annotations

import re
import sys

from difficulty_defs_sync import (
    BACKEND_JSON,
    NORMAL_TS,
    REPO_ROOT,
    _extract_balanced,
    _kv_number_pairs,
    _named_object,
    _render,
    _wave_entries,
    parse_frontend,
)

TIERS = ["common", "uncommon", "rare", "epic", "legendary"]
SHOP_SHARE = 0.54  # shop slots' share of all upgrades in run data
EXTRA_ITEMS = 1.5 * 0.85  # a bundle's extra slots x share that are upgrades/curses

SPLIT_TABLE = "FRAGMENT_VALUE_SPLIT_BY_WAVE"
SPLIT_FALLBACK = "FALLBACK_FRAGMENT_VALUE_SPLIT"


def _row(raw: str) -> list[float]:
    pairs = _kv_number_pairs(raw)
    return [pairs[t] for t in TIERS]


def _table(text: str, name: str) -> dict[int, list[float]]:
    return {wave: _row(raw) for wave, raw in _wave_entries(_named_object(text, name))}


def bundle_split(shop: list[float], bundle: list[float]) -> list[float]:
    out = [0.0] * 5
    for t, chance in enumerate(bundle):
        if chance == 0:
            continue
        capped = shop[: t + 1]
        total = sum(capped)
        extras = [x / total * EXTRA_ITEMS for x in capped] if total else [0.0] * (t + 1)
        for i, x in enumerate(extras):
            out[i] += chance * x
        out[t] += chance
    size = sum(out)
    return [x / size for x in out]


def value_split(shop: list[float], bundle: list[float]) -> list[float]:
    b = bundle_split(shop, bundle)
    raw = [SHOP_SHARE * x + (1 - SHOP_SHARE) * y for x, y in zip(shop, b)]
    rounded = [round(x, 3) for x in raw]
    rounded[0] = round(rounded[0] + 1 - sum(rounded), 3)  # remainder on common, so the row sums to 1
    return rounded


def compute(text: str) -> tuple[dict[int, list[float]], list[float]]:
    shop = _table(text, "RARITY_WEIGHTS_BY_WAVE")
    bundle = _table(text, "BUNDLE_RARITY_WEIGHTS_BY_WAVE")
    table = {wave: value_split(shop[wave], bundle[wave]) for wave in sorted(shop)}
    fallback = value_split(
        _row(_named_object(text, "FALLBACK_RARITY_WEIGHTS")),
        _row(_named_object(text, "FALLBACK_BUNDLE_RARITY_WEIGHTS")),
    )
    return table, fallback


def _render_row(row: list[float]) -> str:
    return "{ " + ", ".join(f"{t}: {x:.3f}" for t, x in zip(TIERS, row)) + " }"


def _replace_object(text: str, name: str, body: str) -> str:
    m = re.search(rf"const {name}\b[^=]*=\s*\{{", text)
    if not m:
        raise ValueError(f"{name} not found")
    start = m.end() - 1
    end = start + len(_extract_balanced(text, start, "{", "}"))
    return text[:start] + body + text[end:]


def main() -> int:
    text = NORMAL_TS.read_text()
    table, fallback = compute(text)

    if "--write" in sys.argv:
        rows = "\n".join(f"  {f'{wave}:':<3} {_render_row(table[wave])}," for wave in sorted(table))
        text = _replace_object(text, SPLIT_TABLE, "{\n" + rows + "\n}")
        text = _replace_object(text, SPLIT_FALLBACK, _render_row(fallback))
        NORMAL_TS.write_text(text)
        BACKEND_JSON.write_text(_render(parse_frontend()))
        print(f"Wrote {len(table)} fragment split row(s) + fallback to Normal.ts and {BACKEND_JSON.relative_to(REPO_ROOT)}")
        return 0

    stale = [wave for wave, row in table.items() if _table(text, SPLIT_TABLE).get(wave) != row]
    if _row(_named_object(text, SPLIT_FALLBACK)) != fallback:
        stale.append("fallback")
    if stale:
        print(f"WARNING - fragment value split is out of date with the shop/bundle tables for: {stale}")
        print("  Run `python3 scripts/fragment_table_sync.py --write` unless this is deliberate.")
    else:
        print(f"OK - fragment value split matches the shop/bundle tables ({len(table)} waves + fallback).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())