# Run Analytics System (GameRun)

A permanent, append-only balancing dataset: one `GameRun` document per playthrough, with one embedded `WaveSnapshot` appended per validated wave completion. It exists to answer trend questions across many runs — "how does damage taken change from wave 1 to wave 30?" — not to inspect single runs. Written from inside the existing anti-cheat pipeline, so every recorded number is the server's own validated/derived value.

Deliberately separate from `GameSave` (one-per-user, deleted on new game — the opposite of what a balancing dataset needs). `GameRun` documents are never deleted. There is deliberately **no query API** (no admin-auth concept exists in this backend); analysis runs locally via `scripts/analyze_runs.py`.

---

## Files

| File | Role |
|------|------|
| `app/models/game_run.py` | `GAME_VERSION` constant, `OfferRoll`, `WaveSnapshot`, `GameRun` models |
| `app/repositories/game_run_repository.py` | `find_active_by_user_id()`, `abandon_active_runs()`, `append_wave_snapshot()`, `finalize()`, indexes |
| `app/models/wave_token.py` | `RolledOffer`; token analytics fields `rerolls_used`, `reroll_points_spent`, `offers_rolled` |
| `app/services/wave_service.py` | All three capture hook points + `_record_wave_snapshot()` |
| `app/api/waves.py` | `RerollRequest.token`; reroll route passes token/cost/post-reroll points through |
| `app/core/enemy_data.py` | `calculate_expected_health_spawned(wave, difficulty)` |
| `app/main.py` | Registers `GameRunRepository().create_indexes()` on startup |
| `frontend/src/game/services/WaveValidation.ts` | Reroll request includes `token: this.waveToken` (the only frontend change) |
| `scripts/analyze_runs.py` | The entire consumption layer (tables / CSV / PNG plots) |

---

## Architecture — Call Chain

```
POST /api/waves/start  (wave 1, no save)
  → WaveService.start_wave()
      → game_run_repo.abandon_active_runs(user_id)     // retire stale run from a deleted save
      → game_run_repo.create(GameRun{seed, difficulty, game_version, status: "active"})
      → WaveValidationToken.create_for_wave(..., points_at_roll=current_points)
          → offers_rolled = [RolledOffer{upgrades: opening offer, points_at_roll}]

POST /api/waves/reroll
  → route: updated_points = current_points − reroll_cost   // computed BEFORE the service call
  → WaveService.reroll_upgrades(..., token_string, reroll_cost, points_after_reroll)
      → roll new offer, then ONE atomic update matched by exact token string:
          $inc  {rerolls_used, reroll_points_spent}
          $push {offers_rolled: {upgrades, points_at_roll}}

POST /api/waves/bundle-pickup            // pre-existing; relevant because grants land in
  → token.bundle_upgrades                // upgrades_obtained_free, never in pick rates

POST /api/waves/complete
  → WaveService.complete_wave()          // full anti-cheat validation, unchanged
      → _save_game_state(..., wave_duration_seconds, token, flags)
          → save updated as before
          → _record_wave_snapshot()
              → run = find_active_by_user_id()          // missing run → log + skip, never fail
              → build WaveSnapshot (see field sources below)
              → game_run_repo.append_wave_snapshot(run.id, snapshot)   // $push
              → if is_death: game_run_repo.finalize(run.id, final_wave, ended_at, totals)
```

---

## Data Model

```
GameRun (collection: game_runs)
  user_id, seed, difficulty_id
  game_version                 # stamped once at run creation
  status                       # "active" | "dead" | "abandoned"
  started_at, ended_at, final_wave
  death_cause                  # always None today — waits on a real death system
  total_kills / total_damage_dealt / total_damage_taken /
  total_points_earned / total_time_seconds     # denormalized at death; None until then
  wave_snapshots: [WaveSnapshot]

WaveSnapshot (embedded, one per completed wave)
  wave_number, wave_duration_seconds, game_version
  damage_dealt, damage_taken, kills, shots_fired, hits_primary, hits_explosion
  player_health_start, player_health_end, player_max_health,
  player_speed, player_polygon_sides, attack_type
  player_projectile_damage, player_explosion_damage
  enemy_total_health_spawned, enemy_health_multiplier
  points_earned, points_spent, rerolls, reroll_points_spent
  upgrade_offers: [OfferRoll], upgrades_purchased, upgrades_obtained_free
  flag_count, highest_flag_severity
  recorded_at

OfferRoll (embedded in upgrade_offers)
  upgrades: [str]              # the ids shown in this roll
  points_at_roll: int | None   # player's points when this roll appeared
  unaffordable: [str]          # slots whose cost > points_at_roll, resolved at write time
```

### Status semantics

| Status | Meaning | Set by |
|--------|---------|--------|
| `active` | Being played | `start_wave()` at run creation |
| `dead` | Finalized by a death submission — the only path that sets `final_wave`/totals | `_record_wave_snapshot()` on `is_death` |
| `abandoned` | Save was deleted mid-run and a new run started | `abandon_active_runs()` in `start_wave()`'s new-run branch |

Abandoned runs keep their snapshots and **count in analysis by default** (restart-instead-of-die is the normal playtest flow); `--exclude-abandoned` opts out. Without the abandonment sweep, a stale active run would steal the new run's snapshot pushes — the active-run lookup is by `user_id + status`, newest-first as a crash-safety net.

### Where each snapshot field comes from

| Field(s) | Source |
|----------|--------|
| `wave_duration_seconds` | Server-computed in `complete_wave()` (token creation → submission) |
| `damage_dealt/taken`, `kills`, `shots_fired`, `hits_*` | Validated `wave_data` (post anti-cheat) |
| `player_health_start` | `existing_save.current_health` — the value carried in from last wave's end (chains wave-to-wave) |
| `player_max_health/speed/polygon_sides` | Server's own `derived_stats` from the authorized upgrade list, never client-reported |
| `player_projectile_damage/player_explosion_damage` | Theoretical damage *output* from the authorized upgrade list, not realized damage — reuses the anti-cheat ceiling calc `_calculate_max_damage_per_hit()`; `player_projectile_damage` is one primary hit's damage × `polygon_sides` (`Player.shoot()` fires one projectile per vertex). Exists to separate "the damage stat is outrunning enemy health" from "landed damage is outrunning enemy health" (`damage_dealt`/`overkill_ratio` only count what actually hit) — e.g. a damage-scaled healing upgrade snowballs off the stat, not off hit rate. `player_explosion_damage` is force-zeroed unless `explosion_on_kill`/`explosive_bullets` is owned — `_calculate_max_damage_per_hit()`'s `max_explosion` is nonzero even with neither owned (it's a validation ceiling, only ever consulted when `hits.explosion > 0`), which would otherwise phantom-inflate every non-explosion build's damage total |
| `enemy_total_health_spawned` | `calculate_expected_health_spawned()` at write time — see below |
| `enemy_health_multiplier` | `Difficulty.get_health_multiplier(wave_number - 1)` at write time — the per-unit enemy health curve (`exp(wave/8)` on Normal) alone, independent of enemy count/composition. `enemy_total_health_spawned` conflates the curve with how many enemies spawn and which (bigger) types unlock at higher waves, which dominates its growth — compare player damage output against this instead to isolate "is my damage stat outscaling the official per-enemy curve" from "is it outscaling total wave pressure" |
| `points_earned` | Server-credited total (wave bonus + validated drops) |
| `points_spent`, `upgrades_purchased` | `existing_save.upgrade_history` filtered by `wave_number == this wave` — exact because the save is read *before* this completion appends anything (this wave's shop buys are already there from `select_upgrade`; this wave's free grants are not yet; prior waves' entries carry prior wave numbers) |
| `upgrades_obtained_free` | The `newly_recorded` bundle + milestone list `_save_game_state` already builds |
| `rerolls`, `reroll_points_spent`, `upgrade_offers` | Copied off the wave's own token (`offers_rolled`), affordability resolved during the copy |
| `flag_count`, `highest_flag_severity` | This submission's anti-cheat flags (same severity ordering as `_flag_wave`) |
| `game_version` | The `GAME_VERSION` constant live at write time |

---

## Offer History & Affordability (pick rates)

The wave's `WaveValidationToken` doubles as the per-wave analytics accumulator, reusing the exact pattern `bundles_granted`/`bundle_upgrades` established: **atomic `$inc`/`$push` matched by exact token string**. `(user_id, wave_number)` is not unique — a mid-wave reload can leave two open tokens for one wave — and the exact match guarantees writes land on the token that will actually be submitted at `/waves/complete`.

- The opening offer (fresh roll *or* reused offer on a reload) is recorded at token creation with the player's current points (70-point new-game bonus when no save exists yet).
- Each reroll appends its new offer with the player's balance *after* the reroll cost.
- **Points-at-roll is the affordability baseline** because points only ever decrease during a shop phase (buys and rerolls deduct; earning happens mid-wave). So `points_at_roll ≥ cost` means "could have bought it if prioritized." An upgrade that became unaffordable only after another buy still counts as a real choice against it.
- `unaffordable` is resolved at **snapshot-write time with the costs live for that run** — a future cost rebalance must not rewrite which upgrades old players could afford (same reasoning as `enemy_total_health_spawned`).
- Pick-rate analysis drops unaffordable showings from the denominator (not buying what you couldn't afford isn't preference signal) and reports them in their own column. An upgrade with only unaffordable showings gets rate `-`, not 0%.
- **Bundle/milestone grants never enter offers or pick rates** — they're forced random upgrades, not choices, and live only in `upgrades_obtained_free`.

Shop timing note: "wave N's" offers/purchases are the shop shown *after completing wave N−1, before playing wave N* — recorded on wave N's snapshot (the wave they're bought for).

---

## Version Awareness

`GAME_VERSION` (module constant in `app/models/game_run.py`) must be **bumped manually** whenever a balance-relevant change ships (difficulty curves, enemy stats, upgrade values/costs, economy). It's a code constant, not env config — it changes atomically with the balance data it tracks, in version control.

It's stamped at **two levels**: once on the `GameRun` at creation, and independently on **every `WaveSnapshot`** at write time. They differ only when a run straddles a deploy that bumped the version mid-run — then each wave carries the version actually live when it was played. Snapshot-based reports (`metric`, `pick-rate`) filter `--game-version` against the snapshot's own stamp (falling back to the run's for pre-stamp data); the run-based `survival` report filters at the run level, since alive-at-wave-X is a whole-run property.

Values immune to version blending even without the stamp, because they're resolved at write time from live balance data: `enemy_total_health_spawned`, `OfferRoll.unaffordable`.

---

## `calculate_expected_health_spawned(wave, difficulty)`

Expected total enemy health a wave puts on the field (`app/core/enemy_data.py`) — the denominator for damage-vs-pressure ratios. Built from the same blocks `collect_upgrade_bundle` uses for its expected-bundle math:

```
Σ over spawn_weights:  enemy_count × (weight / total_weight) × effective_health(type)
+ Σ over scheduled boss spawns: effective_health(boss_type)

effective_health(type) =
  wave-scaled health (get_enemy_health)
  + shield surcharge for hexagon/super_hexagon       // mirrors calculate_minimum_damage_required
  + Σ children's health for deterministic splits      // Octogon → 2 squares; one level deep,
                                                      // mirrors _validate_kills' split credit
```

---

## Analysis Script — `scripts/analyze_runs.py`

Standalone pymongo script (no app imports, no auth). Run from `backend/`: `venv/bin/python scripts/analyze_runs.py …`. Honors `MONGODB_URL` / `MONGODB_DATABASE` env vars. Plots need matplotlib — installed in the venv but deliberately **not** in `requirements.txt` (dev-only; script degrades gracefully to tables/CSV).

| Subcommand | Output |
|------------|--------|
| `summary` | Dataset overview: runs by status/version/difficulty, snapshot count, deepest wave |
| `metrics` | Lists all metric names with descriptions |
| `metric <name>` | Per-wave mean/median/p25/p75 across runs; `--cumulative` for running sums (additive metrics only) |
| `survival` | % of runs still alive entering each wave + deaths per wave |
| `pick-rate` | Per-upgrade: affordable showings, priced-out showings, buys, rate; `--by-wave` groups per wave |

Metrics cover combat (`damage_dealt`, `dps`, `damage_taken`, `incoming_dps`, `accuracy`, `kills`, `overkill_ratio`), damage output potential (`projectile_damage`, `explosion_damage`, `player_damage_total`, `damage_stat_vs_enemy_health`, `damage_stat_vs_health_curve` — theoretical from the upgrade list, uncapped by hit rate, unlike `overkill_ratio`; the `_vs_health_curve` variant compares against the per-unit `enemy_health_multiplier` curve rather than the count/composition-conflated `enemy_total_health_spawned` pool — read it as a wave-X/wave-Y growth-rate ratio, not a raw per-wave number), build state (`max_health`, `health_margin`, `speed`, `polygon_sides`), pressure (`enemy_health_spawned`, `enemy_health_multiplier`), pacing (`wave_duration`), economy (`points_earned/spent`, `net_points`, `rerolls`, `reroll_points_spent`, `unaffordable_offers`), upgrades (`upgrades_purchased/free`, `pick_rate`), and anti-cheat (`flag_count`). Ratio metrics return nothing (not fake zeros) on zero denominators.

Shared filters: `--from-wave/--to-wave`, `--difficulty`, `--game-version`, `--exclude-flags <severity>` (drops snapshots at/above that severity), `--exclude-abandoned`, `--csv <path>`, `--plot <path.png>`.

Every "between wave X and Y" question is `--from-wave/--to-wave` (+ `--cumulative`) over per-wave data — nothing stores interval data separately. Aggregation happens client-side in Python (version-proof vs. Mongo `$percentile`, fine at playtesting volume).

```bash
# Examples
venv/bin/python scripts/analyze_runs.py metric damage_taken --from-wave 1 --to-wave 30 --plot dmg.png
venv/bin/python scripts/analyze_runs.py metric points_earned --cumulative --csv points.csv
venv/bin/python scripts/analyze_runs.py pick-rate --by-wave --game-version 0.2.2
venv/bin/python scripts/analyze_runs.py survival --exclude-flags high
```

---

## Key Design Decisions

**The wave token is the per-wave analytics accumulator, matched by exact token string.**
The only correct "which wave does this belong to" identity under mid-wave reloads (two open tokens for one wave are possible; only one gets submitted). Any new per-wave counter should follow the same `$inc`/`$push`-on-exact-token pattern — see `bundles_granted` for the precedent.

**Analytics never blocks gameplay.**
A missing run logs and skips the snapshot; a stale reroll token logs and the paid reroll still succeeds (`RerollRequest.token` is `Optional`). Unlike bundle pickup — where the token match is anti-cheat load-bearing via grant caps — nothing here validates anything.

**Balance-derived values are computed at write time and stored, never recomputed at analysis time.**
`enemy_total_health_spawned` and `OfferRoll.unaffordable` travel with the run. Recomputing on demand would silently apply today's formulas/costs to old runs — corrupting exactly the cross-version comparisons `game_version` exists to protect.

**Snapshots are recorded on flagged waves, not filtered.**
`flag_count` + `highest_flag_severity` instead of a boolean or a write-time filter, so the exclusion threshold (e.g. "drop high/critical, keep tolerance-edge noise") stays a query-time decision made against real data. Exception: critical-flagged submissions never reach the snapshot writer at all — `complete_wave` skips the whole save path, so no credit means no snapshot.

**Unaffordable ≠ skipped.**
A showing the player couldn't pay for is removed from the pick-rate denominator and surfaced separately (`unafford.` column, `unaffordable_offers` metric). An upgrade with only unaffordable showings has rate `-`, never 0%.

**One `GameRun` per run, snapshots embedded.**
Matches the `upgrade_history` append-only pattern, and playtesting volume doesn't justify a flat per-wave collection. Mongo can index into the array (`wave_snapshots.wave_number`) and `$unwind` for cross-run aggregation. If volume ever demands it, splitting out is a mechanical migration, not a redesign.

**Denormalized totals on death are convenience, not truth.**
`total_*` fields are set once at finalize for cheap listing; authoritative values are always derivable from `wave_snapshots`.

---

## Known Issues / Follow-up Work

- **`death_cause` is always `None`.** Nothing records what killed the player (a death is just `is_death=True`). The field exists so no migration is needed once a proper death system ships (frontend death submission would gain a `killed_by`). `ended_at`/`final_wave` are not blocked — they mirror `DeathFrozenState`.
- **`GAME_VERSION` bump is a manual obligation.** Forgetting it on a balance patch blends incompatible runs under one version tag. Per-wave stamping means even a mid-run bump lands each wave correctly; the bump itself is the only thing that can't be automated away.
- **Pre-history dev data is partial.** Runs recorded during the feature's own rollout (2026-08-11, all `0.1.0`) have final-offer-only or points-unknown offer history; their pick rates overcount. The `pick-rate` orphan-buys note flags this, and `--game-version` filtering ages it out naturally.
- **Old wave tokens accumulate.** `wave_validation_tokens` has no TTL; unused tokens pile up harmlessly. A TTL index on `expires_at` would clean them (mirror the `revoked_tokens` pattern).
- **Per-wave-per-upgrade pick-rate slices are thin** until run count grows — trust the overall view first.
- **`survival` semantics under the abandoned-runs-count default:** abandoned runs count as "alive" up to their deepest wave and never register a death, so the curve reads as "% of runs that reached wave X"; the deaths column only counts real deaths.
