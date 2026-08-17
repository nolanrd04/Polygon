"""
Run-analytics consumption layer: graph any per-wave metric as a trend line
across every recorded GameRun (see app/models/game_run.py), for balancing
decisions - "how does damage taken change from wave 1 to wave 30, across
hundreds of runs", not "what happened in this one run".

Reads MongoDB directly (no API, no auth) - run it from backend/ with the
venv python. Plots need matplotlib (dev-only, not in requirements.txt:
`venv/bin/pip install matplotlib`); the table/CSV output has no extra deps.

Usage (from backend/):
  venv/bin/python scripts/analyze_runs.py summary
  venv/bin/python scripts/analyze_runs.py metrics
  venv/bin/python scripts/analyze_runs.py metric damage_taken
  venv/bin/python scripts/analyze_runs.py metric dps --from-wave 5 --to-wave 30 --plot dps.png
  venv/bin/python scripts/analyze_runs.py metric points_earned --cumulative --csv points.csv
  venv/bin/python scripts/analyze_runs.py metric damage_taken --exclude-flags high
  venv/bin/python scripts/analyze_runs.py survival --plot survival.png
  venv/bin/python scripts/analyze_runs.py pick-rate --from-wave 5 --to-wave 15
  venv/bin/python scripts/analyze_runs.py pick-rate --by-wave --csv picks.csv

Filters (all subcommands): --difficulty, --game-version, --from-wave,
--to-wave, --exclude-abandoned (abandoned runs COUNT by default - restarting
instead of dying is the normal playtest flow), --exclude-flags SEVERITY
(drops snapshots whose highest anti-cheat flag is >= SEVERITY; the threshold
is deliberately a query-time choice - see the GameRun model notes).
"""

import argparse
import csv
import os
import statistics
import sys
from collections import defaultdict

from pymongo import MongoClient

MONGODB_URL = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DATABASE = os.environ.get("MONGODB_DATABASE", "polygon_game")

SEVERITY_ORDER = ["low", "medium", "high", "critical"]

# metric name -> (description, fn(snapshot_dict) -> float | None).
# None means "this snapshot contributes nothing" (e.g. accuracy with zero
# shots) rather than contributing a fake zero. Every "between wave X and Y"
# question from the plan is --from-wave/--to-wave (+ --cumulative for sums)
# over these same per-wave values - nothing needs separate storage.
def _ratio(num, den):
    return (num / den) if den else None


METRICS = {
    # Combat output
    "damage_dealt": ("Damage dealt", lambda s: s.get("damage_dealt", 0)),
    "dps": ("Damage dealt / wave duration", lambda s: _ratio(s.get("damage_dealt", 0), s.get("wave_duration_seconds", 0))),
    "damage_taken": ("Damage taken", lambda s: s.get("damage_taken", 0)),
    "incoming_dps": ("Damage taken / wave duration", lambda s: _ratio(s.get("damage_taken", 0), s.get("wave_duration_seconds", 0))),
    "accuracy": ("Primary hits / shots fired", lambda s: _ratio(s.get("hits_primary", 0), s.get("shots_fired", 0))),
    "kills": ("Kills", lambda s: s.get("kills", 0)),
    "overkill_ratio": ("Damage dealt / enemy health spawned (proxy for overkill; >1 = damage beyond the spawned pool)",
                       lambda s: _ratio(s.get("damage_dealt", 0), s.get("enemy_total_health_spawned", 0))),
    # Player damage OUTPUT (theoretical, from the upgrade list - not realized
    # damage_dealt above, which only counts what landed). Use these to check
    # whether the *stat* is outrunning enemy health, independent of hit rate -
    # e.g. a damage-scaled healing upgrade snowballs off this, not off landed hits.
    "projectile_damage": ("Player projectile damage per discharge (max_primary * polygon_sides)",
                          lambda s: s.get("player_projectile_damage", 0)),
    "explosion_damage": ("Player explosion damage per hit", lambda s: s.get("player_explosion_damage", 0)),
    "player_damage_total": ("Projectile + explosion damage output",
                            lambda s: s.get("player_projectile_damage", 0) + s.get("player_explosion_damage", 0)),
    "damage_stat_vs_enemy_health": ("Player damage output / enemy health spawned (uncapped by hit rate, unlike overkill_ratio)",
                                    lambda s: _ratio(s.get("player_projectile_damage", 0) + s.get("player_explosion_damage", 0),
                                                     s.get("enemy_total_health_spawned", 0))),
    # enemy_total_health_spawned conflates the per-unit health curve with
    # enemy count/composition (more enemies + bigger types unlock at higher
    # waves) - compare against enemy_health_multiplier instead to isolate
    # "is my damage stat outscaling the official per-enemy difficulty curve"
    # from "is it outscaling total wave pressure". Take the RATIO of two
    # runs' values at different waves (not a raw per-wave number) to read
    # the growth-rate comparison: e.g. player_damage_total at wave 27 /
    # wave 1 vs enemy_health_multiplier at wave 27 / wave 1.
    "enemy_health_multiplier": ("Per-unit enemy health curve (Difficulty.get_health_multiplier), independent of enemy count/composition",
                                lambda s: s.get("enemy_health_multiplier", 1.0)),
    "damage_stat_vs_health_curve": ("Player damage output / per-unit enemy health curve (growth-rate-comparable, unlike damage_stat_vs_enemy_health)",
                                    lambda s: _ratio(s.get("player_projectile_damage", 0) + s.get("player_explosion_damage", 0),
                                                     s.get("enemy_health_multiplier", 1.0))),
    # Player build state
    "max_health": ("Player max health", lambda s: s.get("player_max_health", 0)),
    "health_margin": ("Wave-end HP / max HP", lambda s: _ratio(s.get("player_health_end", 0), s.get("player_max_health", 0))),
    "speed": ("Player speed", lambda s: s.get("player_speed", 0)),
    "polygon_sides": ("Polygon sides", lambda s: s.get("player_polygon_sides", 0)),
    # Enemy pressure
    "enemy_health_spawned": ("Total enemy health spawned", lambda s: s.get("enemy_total_health_spawned", 0)),
    # Pacing
    "wave_duration": ("Wave duration (seconds)", lambda s: s.get("wave_duration_seconds", 0)),
    # Economy
    "points_earned": ("Points earned", lambda s: s.get("points_earned", 0)),
    "points_spent": ("Points spent on shop upgrades", lambda s: s.get("points_spent", 0)),
    "net_points": ("Earned - spent (shop + rerolls)",
                   lambda s: s.get("points_earned", 0) - s.get("points_spent", 0) - s.get("reroll_points_spent", 0)),
    "rerolls": ("Rerolls used", lambda s: s.get("rerolls", 0)),
    "reroll_points_spent": ("Points spent on rerolls", lambda s: s.get("reroll_points_spent", 0)),
    # Upgrades / build trajectory
    "upgrades_purchased": ("Shop upgrades bought", lambda s: len(s.get("upgrades_purchased", []))),
    "upgrades_free": ("Free upgrades (bundles + milestones)", lambda s: len(s.get("upgrades_obtained_free", []))),
    "pick_rate": ("Shop buys / affordable offer slots shown (all rolls, unaffordable slots excluded)",
                  lambda s: _ratio(len(s.get("upgrades_purchased", [])),
                                   sum(len(o.get("upgrades", [])) - len(o.get("unaffordable", []))
                                       for o in s.get("upgrade_offers", [])))),
    "unaffordable_offers": ("Offer slots the player couldn't afford when rolled",
                            lambda s: sum(len(o.get("unaffordable", [])) for o in s.get("upgrade_offers", []))),
    # Anti-cheat context
    "flag_count": ("Anti-cheat flags raised", lambda s: s.get("flag_count", 0)),
}

CUMULATIVE_OK = {"wave_duration", "points_earned", "points_spent", "net_points",
                 "rerolls", "reroll_points_spent", "damage_dealt", "damage_taken",
                 "kills", "upgrades_purchased", "upgrades_free", "flag_count"}


def build_run_filter(args, version_at_run_level=False):
    """
    version_at_run_level: snapshot-based reports (metric/pick-rate) match
    --game-version per snapshot instead (see fetch_snapshots), so a run that
    straddled a deploy contributes each wave to the version it was actually
    played under. Run-based reports (survival) match at the run level.
    """
    f = {}
    if args.exclude_abandoned:
        f["status"] = {"$in": ["active", "dead"]}
    if args.difficulty:
        f["difficulty_id"] = args.difficulty
    if version_at_run_level and args.game_version:
        f["game_version"] = args.game_version
    return f


def snapshot_excluded(snapshot, exclude_flags):
    if not exclude_flags:
        return False
    sev = snapshot.get("highest_flag_severity")
    if sev is None:
        return False
    return SEVERITY_ORDER.index(sev) >= SEVERITY_ORDER.index(exclude_flags)


def fetch_snapshots(db, args):
    """Yield (run_id, snapshot) for every snapshot passing the filters."""
    for run in db.game_runs.find(build_run_filter(args), {"wave_snapshots": 1, "game_version": 1}):
        for s in run.get("wave_snapshots", []):
            w = s.get("wave_number", 0)
            if args.from_wave and w < args.from_wave:
                continue
            if args.to_wave and w > args.to_wave:
                continue
            if snapshot_excluded(s, args.exclude_flags):
                continue
            # Per-snapshot version stamp; pre-stamp snapshots fall back to
            # the run's version.
            if args.game_version and (s.get("game_version") or run.get("game_version")) != args.game_version:
                continue
            yield run["_id"], s


def cmd_summary(db, args):
    total = db.game_runs.count_documents({})
    print(f"game_runs: {total} total")
    for status in ["active", "dead", "abandoned"]:
        print(f"  {status}: {db.game_runs.count_documents({'status': status})}")
    print("by game_version:", {d["_id"]: d["n"] for d in db.game_runs.aggregate(
        [{"$group": {"_id": "$game_version", "n": {"$sum": 1}}}])})
    print("by difficulty:", {d["_id"]: d["n"] for d in db.game_runs.aggregate(
        [{"$group": {"_id": "$difficulty_id", "n": {"$sum": 1}}}])})
    snaps = list(db.game_runs.aggregate([
        {"$unwind": "$wave_snapshots"},
        {"$group": {"_id": None, "n": {"$sum": 1}, "max_wave": {"$max": "$wave_snapshots.wave_number"}}}
    ]))
    if snaps:
        print(f"wave snapshots: {snaps[0]['n']} (deepest wave recorded: {snaps[0]['max_wave']})")
    else:
        print("wave snapshots: none recorded yet")


def cmd_metrics(db, args):
    width = max(len(m) for m in METRICS)
    for name, (desc, _) in METRICS.items():
        print(f"  {name:<{width}}  {desc}")
    print("\nplus: `survival` subcommand (deaths per wave + cumulative survival rate)")


def aggregate_metric(db, args):
    """-> sorted list of rows {wave, n, mean, median, p25, p75, min, max}."""
    _, fn = METRICS[args.name]
    by_wave = defaultdict(list)
    for _, s in fetch_snapshots(db, args):
        v = fn(s)
        if v is not None:
            by_wave[s["wave_number"]].append(v)

    rows = []
    for wave in sorted(by_wave):
        vals = sorted(by_wave[wave])
        q = statistics.quantiles(vals, n=4) if len(vals) >= 2 else [vals[0]] * 3
        rows.append({
            "wave": wave, "n": len(vals),
            "mean": statistics.fmean(vals), "median": statistics.median(vals),
            "p25": q[0], "p75": q[2], "min": vals[0], "max": vals[-1],
        })

    if args.cumulative:
        if args.name not in CUMULATIVE_OK:
            sys.exit(f"--cumulative only makes sense for additive metrics: {sorted(CUMULATIVE_OK)}")
        running = dict.fromkeys(("mean", "median", "p25", "p75", "min", "max"), 0.0)
        for row in rows:
            for k in running:
                running[k] += row[k]
                row[k] = running[k]
    return rows


def cmd_metric(db, args):
    if args.name not in METRICS:
        sys.exit(f"Unknown metric '{args.name}'. Run: analyze_runs.py metrics")
    rows = aggregate_metric(db, args)
    if not rows:
        sys.exit("No matching snapshots. Record some runs first (or loosen filters).")

    label = ("cumulative " if args.cumulative else "") + args.name
    print(f"{'wave':>4}  {'n':>4}  {'mean':>10}  {'median':>10}  {'p25':>10}  {'p75':>10}")
    for r in rows:
        print(f"{r['wave']:>4}  {r['n']:>4}  {r['mean']:>10.2f}  {r['median']:>10.2f}  {r['p25']:>10.2f}  {r['p75']:>10.2f}")

    if args.csv:
        write_csv(args.csv, rows)
    if args.plot:
        plot_metric(rows, label, METRICS[args.name][0], args)


def cmd_survival(db, args):
    """Deaths per wave + % of runs still alive entering each wave."""
    run_filter = build_run_filter(args, version_at_run_level=True)
    deepest = {}   # run_id -> deepest wave with a snapshot
    deaths = defaultdict(int)
    total_runs = 0
    for run in db.game_runs.find(run_filter, {"wave_snapshots.wave_number": 1, "status": 1, "final_wave": 1}):
        waves = [s["wave_number"] for s in run.get("wave_snapshots", [])]
        if not waves:
            continue
        total_runs += 1
        deepest[run["_id"]] = max(waves)
        if run.get("status") == "dead" and run.get("final_wave"):
            deaths[run["final_wave"]] += 1
    if not total_runs:
        sys.exit("No runs with snapshots yet.")

    max_wave = max(deepest.values())
    lo = args.from_wave or 1
    hi = min(args.to_wave or max_wave, max_wave)
    rows = []
    print(f"{'wave':>4}  {'alive_entering':>14}  {'survival_%':>10}  {'deaths':>6}")
    for wave in range(lo, hi + 1):
        alive = sum(1 for d in deepest.values() if d >= wave)
        rows.append({"wave": wave, "n": alive, "mean": 100.0 * alive / total_runs,
                     "deaths": deaths.get(wave, 0)})
        print(f"{wave:>4}  {alive:>14}  {rows[-1]['mean']:>10.1f}  {deaths.get(wave, 0):>6}")

    if args.csv:
        write_csv(args.csv, rows)
    if args.plot:
        plot_metric(rows, "survival", "% of runs still alive entering wave", args, unit="%")


def cmd_pick_rate(db, args):
    """
    Per-upgrade shop pick rate: of the times an upgrade appeared in an offer
    (any roll - the wave-start offer and every reroll count as separate
    showings) AND was affordable at that moment, how often was it actually
    bought. Unaffordable showings aren't preference signal - the player
    couldn't have bought them - so they come out of the denominator and get
    their own column instead. Bundle/milestone grants are forced random
    upgrades, not choices, so they're excluded by construction (they never
    appear in upgrade_offers or upgrades_purchased).
    """
    offered = defaultdict(int)        # affordable showings (the denominator)
    unaffordable = defaultdict(int)   # priced-out showings, reported alongside
    picked = defaultdict(int)

    def key(uid, wave):
        return (uid, wave) if args.by_wave else (uid, None)

    for _, s in fetch_snapshots(db, args):
        w = s["wave_number"]
        for offer in s.get("upgrade_offers", []):
            priced_out = list(offer.get("unaffordable", []))
            for uid in offer.get("upgrades", []):
                if uid in priced_out:
                    priced_out.remove(uid)  # handle duplicate ids one-for-one
                    unaffordable[key(uid, w)] += 1
                else:
                    offered[key(uid, w)] += 1
        for uid in s.get("upgrades_purchased", []):
            picked[key(uid, w)] += 1

    keys = set(offered) | set(unaffordable)
    if not keys:
        sys.exit("No offers recorded in matching snapshots.")

    # Overall mode: most-shown upgrades first. Per-wave mode: group by wave,
    # then most-shown first within each wave.
    shown = lambda k: offered.get(k, 0) + unaffordable.get(k, 0)
    sort_key = (lambda k: (k[1], -shown(k), k[0])) if args.by_wave else \
               (lambda k: (-shown(k), k[0]))
    rows = []
    for k in sorted(keys, key=sort_key):
        uid, wave = k
        rows.append({
            **({"wave": wave} if args.by_wave else {}),
            "upgrade": uid, "offered": offered.get(k, 0),
            "unaffordable": unaffordable.get(k, 0), "picked": picked.get(k, 0),
            "pick_rate": _ratio(picked.get(k, 0), offered.get(k, 0)),
        })

    width = max(len(r["upgrade"]) for r in rows)
    header = ((f"{'wave':>4}  " if args.by_wave else "")
              + f"{'upgrade':<{width}}  {'offered':>7}  {'unafford.':>9}  {'picked':>6}  {'rate':>6}")
    print(header)
    for r in rows:
        prefix = f"{r['wave']:>4}  " if args.by_wave else ""
        rate = f"{r['pick_rate']:>6.1%}" if r["pick_rate"] is not None else f"{'-':>6}"
        print(f"{prefix}{r['upgrade']:<{width}}  {r['offered']:>7}  {r['unaffordable']:>9}  {r['picked']:>6}  {rate}")

    # Buys with no recorded offer (data captured before offer-history
    # tracking shipped) would silently skew nothing above - but say so.
    orphans = sorted({k[0] for k in picked if k not in offered})
    if orphans:
        print(f"\nnote: {len(orphans)} upgrade(s) were bought in snapshots with no matching "
              f"offer recorded (pre-offer-history data): {orphans}")

    if args.csv:
        write_csv(args.csv, rows)


def write_csv(path, rows):
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nwrote {path}")


def plot_metric(rows, name, description, args, unit=""):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        sys.exit("Plotting needs matplotlib: venv/bin/pip install matplotlib")

    # Single-series line on a light surface: one hue (no legend needed - the
    # title names the series), quartile band in the same hue, recessive grid.
    BLUE, INK, MUTED = "#2a78d6", "#0b0b0b", "#52514e"
    waves = [r["wave"] for r in rows]
    means = [r["mean"] for r in rows]

    fig, ax = plt.subplots(figsize=(9, 4.5), dpi=150)
    fig.patch.set_facecolor("#fcfcfb")
    ax.set_facecolor("#fcfcfb")

    if "p25" in rows[0]:
        ax.fill_between(waves, [r["p25"] for r in rows], [r["p75"] for r in rows],
                        color=BLUE, alpha=0.14, linewidth=0, label="_")
    ax.plot(waves, means, color=BLUE, linewidth=2)
    if len(waves) <= 40:
        ax.plot(waves, means, "o", color=BLUE, markersize=4)
    # Direct label on the last point only - selective, not a number per point.
    ax.annotate(f"{means[-1]:,.1f}{unit}", (waves[-1], means[-1]),
                textcoords="offset points", xytext=(6, 0), va="center",
                fontsize=9, color=INK)

    filt = [s for s in [
        f"difficulty={args.difficulty}" if args.difficulty else None,
        f"version={args.game_version}" if args.game_version else None,
        f"flags<{args.exclude_flags}" if args.exclude_flags else None,
    ] if s]
    n_lo, n_hi = min(r["n"] for r in rows), max(r["n"] for r in rows)
    sub = f"{description}  ·  n per wave: {n_lo}" + (f"–{n_hi}" if n_hi != n_lo else "")
    if filt:
        sub += "  ·  " + ", ".join(filt)

    ax.set_title(name, loc="left", fontsize=13, color=INK, pad=18, fontweight="bold")
    ax.text(0, 1.02, sub, transform=ax.transAxes, fontsize=8.5, color=MUTED)
    ax.set_xlabel("wave", fontsize=9, color=MUTED)
    ax.grid(axis="y", color="#e7e6e3", linewidth=0.8)
    ax.set_axisbelow(True)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color("#d8d7d3")
    ax.tick_params(colors=MUTED, labelsize=8.5)
    ax.margins(x=0.02)
    ax.set_ylim(bottom=0)

    fig.tight_layout()
    fig.savefig(args.plot, bbox_inches="tight")
    print(f"\nwrote {args.plot}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def add_filters(p):
        p.add_argument("--from-wave", type=int, default=None)
        p.add_argument("--to-wave", type=int, default=None)
        p.add_argument("--difficulty", default=None)
        p.add_argument("--game-version", default=None)
        p.add_argument("--exclude-abandoned", action="store_true",
                       help="drop runs abandoned mid-game (included by default - restarting "
                            "instead of dying is the normal playtest flow)")
        p.add_argument("--exclude-flags", choices=SEVERITY_ORDER, default=None,
                       help="drop snapshots whose highest flag severity is >= this")
        p.add_argument("--csv", default=None, help="also write rows to this CSV path")
        p.add_argument("--plot", default=None, help="also write a PNG chart to this path")

    sub.add_parser("summary", help="dataset overview")
    sub.add_parser("metrics", help="list available metrics")

    p_metric = sub.add_parser("metric", help="per-wave trend of one metric across runs")
    p_metric.add_argument("name")
    p_metric.add_argument("--cumulative", action="store_true",
                          help="running sum up to each wave (additive metrics only)")
    add_filters(p_metric)

    p_survival = sub.add_parser("survival", help="deaths per wave + cumulative survival rate")
    add_filters(p_survival)

    p_pick = sub.add_parser("pick-rate", help="per-upgrade shop pick rate (bought / times offered, all rolls)")
    p_pick.add_argument("--by-wave", action="store_true", help="break rates out per wave instead of overall")
    add_filters(p_pick)

    args = parser.parse_args()
    db = MongoClient(MONGODB_URL)[MONGODB_DATABASE]
    {"summary": cmd_summary, "metrics": cmd_metrics,
     "metric": cmd_metric, "survival": cmd_survival,
     "pick-rate": cmd_pick_rate}[args.command](db, args)


if __name__ == "__main__":
    main()
