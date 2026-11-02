# Gameplay

## Waves & progression
- [~] Fixed progression for first 30 waves — Normal.ts hardcodes 1-27; extend through 30
- [ ] Add difficulties beyond Normal (Difficulty interface is in place in systems/difficulty/)
- [ ] After wave 30 is complete, start adding bosses to the regular enemy pool
- [ ] Stat scaling balancing: right now, player stats outpace the rate of increase of enemy stats. Need to fix this somehow.

## Enemies
- [x] Super pentagon — sprints toward player, explodes, leaves behind a fire pool
- [x] Super hexagon
- [x] Super Octogon - Continuously and slowly moves toward the player. Spawns fast moving square enemies that explode into an acid explosion on death. When kills, it splits into two 'suspicious square' enemies that actively avoid the player and grow into a super octogon over time. Only the original octogon can drop bundles or score. Need to make sure the damage calculation on the backend account for dynamically updating max health like this. Actually we can just cap the re-grow to one. Set a variable in the super octogon class CanSplit so when the suspicious squares spawn the octogon (regrow) we just set CanSplit to false
- [ ] Hexagon: add visual indication for shield health
- [ ] Vampire (triangle?): if it hits the player the player can't regen health

## Bosses
- [ DONE ] First boss phase 1
- [ DONE ] First boss phase 2: dashes → idle → fixed-direction rapid-fire bullet storm → dashes → random teleport 

## Attacks
- [ ] **Laser:** slower hitscan-based projectile
-  [ ] **Zapper**: slower chain-damaging and high-veloctiy projectile
- [ ] Zapper (**variant: lightning rod**: *still shoots out normal bolts but for each polygon side, the same number of nearest enemies get shocked by a chain reaction lightning bolt*; **-> lord of thunder**: *lightning bolts now have a 50% chance to spawn but attack 3x as fast, and one will periodically spawn on the player to attack enemies nearby.*; -> **mjolnir**: *a lightning-charged hammer now circles the player and zaps nearby enemies. Hammer colisions spawn multiple thunderbolts.*)

- [ ] Flamer: closer-range, wide-spread, debuff-inflicting projectiles

- [ ] Spinner: 
- [ ] Healer: slower-firing projectiles with healing abilities
- [ ] Controller
- [ ] Viral (bullets inflict plague debuffs. Inflicts a base damage then damage over time. upgrade the debuff effects, spread, duration, etc.)
- [ ] Melee: player does contact damage. Need to focus on healing and life regen. Player can scale size, and get buffs that can absorb enemy health to buff the player further, temporarilly.
- [ ] 

## Sounds
- [ DONE ] Ability sound effects (dash, shield, etc)
- [ DONE ] Special attack sound effects
- [ DONE ] Enemy attack sound effects
- [ DONE ] Boss sound effects

## Curses
- [ BASE CLASS IMPLEMENTED ] Similar to upgrades but give a negative effect
- [x] Poison: temporarily slows the player and deals damage per second over time. Time and damage dependent on rarity.
- [ ] Frozen (DEFERRED): Disables all movement and attacking for 3 seconds. Damage taken reduced by 99%.
- [x] Coldness: temporarily slows the player over time. Slowness amount and time dependent on rarity.
- [x] Burning: does damage over time. Damage and time dependent on rarity.
- [ ] Bleeding: prevent healing for a time. Time dependent on rarity.

## Map Building (large scope)
- [ ] Pylon: Destructible environment objects that grant buffs/debuffs to nearby enemies/players
- [ ] Farms that can generate points for the players. Upgradeable and placeable (requires shop rework > points rework)
- [ ] Turrets to defend pylons/farms. Upgradeable and placeable
- [ ] Constructable polygons for map control
- [ ] A way to edit the map for building in between waves
- [ ] IMPORTANT: maybe we just have ONLY pylons? Then we can upgrade individual pylons to have different abilities, like turret abilites, structure abilities, resource abilities, buff/debuff abilities, etc? this might be the way to go.
- [ ] 

## Upgrades/Bundles
- [x] Make enemies drop upgrade bundles
- [x] Upgrade bundles give random upgrades of the rarity with a chance to give a curse
- [x] New "buffs" which are temporary upgrades to the player
- [ ] "Largenes": reduces damage taken but reduced movement speed and increases size. All values dependent on rarity. Cannot roll from bundles.
- [ ] "Lightweight: reduced size and increases speed but increases the damage taken. All values dependent on rarity. Cannot roll from bundles.
- [x] Healing refactor: add a keybind to restore health instantly. Add upgrades below:
- [x] Healing refactor upgrade: Increase insta heal slots +1
- [x] Healing refactor upgrade: Decrease insta heal cooldown
- [x] Healing refactor upgrade: Increase insta heal amount (percentage based)
- [x] Healing refactor: change vampirism to heal per chance. upgrades increase chance but not value
- [ ] Healing refactor: New upgrade: syphon. Syphon will heal a killed enemy for x amount on kill.
- [ ] Radial healing: manual heal will apply healing to nearby allies in a radius. Radius upgradeable
- [ ] Healing aura: manual heal spawns a ring of healing aura that heals allies inside of it over time. Upgradable

## Visuals
- [x] Implement 'dusts' (see terraria)
- [ ~ ] Ensure settings actually work
- [ ] Add color customization for the player
- [x] Lighting

## Score system
- [x] Intermission phase between waves: roam freely, open the shop on demand, start the next wave manually

_______________
- [ ] enemies drop different tiered orbs (common - legendary). Orbs completely replace the current score system

### 1. Get Orb Values:
#### a. Purchase Cost In Orbs:

defined by me, not statistics

| Upgrade | orbs  (of same upgrade rarity)| 
|---|---|
| Common | **100** |
| Uncommon| 60 |
| Rare| 20 |
| Epic| 10 |
| Legendary| 5 |

#### b. Orb value from current upgrade prices:

Scale: 1 current point = 50 common orbs (a common upgrade costs 2 points = 100 commons). Prices from `backend/app/core/data/upgrades.json`. `polygon_upgrade` is priced specially and left out. Free upgrades stay free.

| Upgrade | Price ( current points) | × 50 = worth in common orbs | ÷ Orbs the upgrade costs | = 1 orb's value |
|---|---|---|---|---|
| Common | 2 | 100 | 100 | **1** |
| Uncommon | 6 | 300 | 60 | **5** |
| Rare | 10 | 500 | 20 | **25** |
| Epic | 20 | 1,000 | 10 | **100** |
| Legendary | 40 | 2,000 | 5 | **400** |

Every value is whole and each tier is a clean multiple of the one below it (×5, ×5, ×4, ×4).

### 2. Orb conversion

#### a. No penalty (converting down)

1 orb of the row's tier = this many orbs of the column's tier. Converting down is always fair, and with whole values it never needs rounding.

| 1 orb of | Common | Uncommon | Rare | Epic |
|---|---|---|---|---|
| Uncommon | 5 | - | - | - |
| Rare | 25 | 5 | - | - |
| Epic | 100 | 20 | 4 | - |
| Legendary | 400 | 80 | 16 | 4 |

#### b. Converting up with a flat 20% penalty

Penalized orb values in commons: 6, 30, 120, 480 (instead of 5, 25, 100, 400).

Orbs of the row's tier needed to make 1 orb of the column's tier (no-penalty amount in brackets):

| From | to Uncommon | to Rare | to Epic | to Legendary |
|---|---|---|---|---|
| Common | 6 (5) | 30 (25) | 120 (100) | 480 (400) |
| Uncommon | - | 6 (5) | 24 (20) | 96 (80) |
| Rare | - | - | 4.8 (4) | 19.2 (16) |
| Epic | - | - | - | 4.8 (4) |

#### c. Rounding against the player

Round up once on the total cost, not per orb: 1 epic from rares costs ⌈4.8⌉ = 5, but 5 epics cost ⌈24⌉ = 24.

Orbs of the row's tier needed to make 1 orb of the column's tier, rounded up (rounded cells show the 2b value in brackets):

| From | to Uncommon | to Rare | to Epic | to Legendary |
|---|---|---|---|---|
| Common | 6 | 30 | 120 | 480 |
| Uncommon | - | 6 | 24 | 96 |
| Rare | - | - | 5 (4.8) | 20 (19.2) |
| Epic | - | - | - | 5 (4.8) |

Bulk cost for the rates that need rounding (exact total in brackets):

| Orbs made | Rare → Epic / Epic → Legendary (×4.8) | Rare → Legendary (×19.2) |
|---|---|---|
| 1 | 5 (4.8) | 20 (19.2) |
| 2 | 10 (9.6) | 39 (38.4) |
| 3 | 15 (14.4) | 58 (57.6) |
| 4 | 20 (19.2) | 77 (76.8) |
| 5 | 24 | 96 |

- Loops always lose orbs: 6 commons → 1 uncommon → 5 commons.
- Converting in steps always costs more than converting directly: common → rare costs 36 in steps (6 × 6) vs 30 directly; rare → legendary costs 25 through epic (5 × 5) vs 20 directly.

### 2. Game economy

#### a. Current rarity pool. This comes from the upgrades rolled + upgrades rolled from bundles. It has nothing to do with upgrades the player picks

Source: local `game_runs`, 27 runs, 426 wave snapshots, Normal, v0.1.0–0.3.1. Counts every shop slot shown (wave-start roll + rerolls) plus every bundle grant; the `polygon_upgrade` milestone is excluded. Rarities use the current `upgrades.json`. Bundles picked up between waves count toward the next wave, so boss drops from waves 10/20 land in 11/21. Waves 26+ have 5 or fewer runs.

| Wave | Runs | Upgrades | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|---|---|
| 1 | 26 | 1035 | 53.0% | 31.8% | 14.9% | 0.3% | 0.0% |
| 2 | 25 | 813 | 57.8% | 29.9% | 12.2% | 0.1% | 0.0% |
| 3 | 24 | 690 | 56.7% | 30.3% | 12.8% | 0.3% | 0.0% |
| 4 | 23 | 823 | 55.8% | 31.8% | 12.0% | 0.4% | 0.0% |
| 5 | 20 | 572 | 53.0% | 30.8% | 12.2% | 4.0% | 0.0% |
| 6 | 20 | 598 | 54.5% | 28.4% | 14.5% | 2.5% | 0.0% |
| 7 | 20 | 537 | 54.7% | 28.7% | 13.2% | 3.4% | 0.0% |
| 8 | 20 | 584 | 48.5% | 35.1% | 12.8% | 3.6% | 0.0% |
| 9 | 20 | 765 | 51.8% | 29.7% | 15.7% | 2.9% | 0.0% |
| 10 | 19 | 608 | 41.9% | 33.9% | 16.0% | 7.7% | 0.5% |
| 11 | 15 | 875 | 45.3% | 32.7% | 14.6% | 5.7% | 1.7% |
| 12 | 15 | 550 | 50.0% | 31.3% | 13.6% | 4.2% | 0.9% |
| 13 | 14 | 653 | 46.2% | 35.2% | 14.1% | 3.5% | 0.9% |
| 14 | 14 | 637 | 45.1% | 33.4% | 16.6% | 4.6% | 0.3% |
| 15 | 14 | 633 | 39.3% | 37.4% | 16.4% | 5.5% | 1.3% |
| 16 | 14 | 497 | 39.2% | 36.6% | 16.7% | 4.6% | 2.8% |
| 17 | 13 | 627 | 43.5% | 34.1% | 16.3% | 4.8% | 1.3% |
| 18 | 13 | 659 | 37.6% | 37.3% | 19.6% | 4.1% | 1.4% |
| 19 | 12 | 590 | 39.5% | 35.4% | 17.6% | 6.8% | 0.7% |
| 20 | 12 | 477 | 38.8% | 35.6% | 16.8% | 6.7% | 2.1% |
| 21 | 12 | 610 | 41.6% | 33.9% | 16.1% | 6.4% | 2.0% |
| 22 | 12 | 562 | 34.5% | 38.1% | 19.2% | 5.9% | 2.3% |
| 23 | 11 | 435 | 46.0% | 30.8% | 17.0% | 4.4% | 1.8% |
| 24 | 9 | 338 | 32.8% | 33.4% | 21.6% | 8.6% | 3.6% |
| 25 | 8 | 350 | 32.0% | 35.7% | 24.0% | 6.6% | 1.7% |
| 26 | 5 | 309 | 33.7% | 40.1% | 19.1% | 4.9% | 2.3% |
| 27 | 5 | 247 | 30.4% | 40.9% | 20.6% | 6.5% | 1.6% |
| 28 | 4 | 291 | 40.9% | 30.9% | 19.2% | 7.6% | 1.4% |
| 29 | 3 | 130 | 27.7% | 40.0% | 19.2% | 10.0% | 3.1% |
| 30 | 3 | 274 | 38.7% | 31.0% | 15.3% | 9.9% | 5.1% |
| 31 | 1 | 25 | 40.0% | 44.0% | 8.0% | 8.0% | 0.0% |
| **All** | 426 | 16794 | 45.8% | 33.3% | 15.7% | 4.2% | 1.0% |

#### b. calculated rarity pool.

we can just get the rarity weights using our current weights and calculate. We need to make sure we are adjusting to fit the orb values though, so where as common upgrades make up a calculated 62% of wave 1 upgrades, to get that we need 91% of the orbs to be common:

Method (inputs are the tables in `frontend/src/game/systems/difficulty/Normal.ts`):
1. **Shop slot split** = `RARITY_WEIGHTS_BY_WAVE[wave]`.
2. **Bundle item split**: the bundle's tier T comes from `BUNDLE_RARITY_WEIGHTS_BY_WAVE[wave]`. The first item is always tier T. On top of that, a bundle averages 1.5 extra slots (1–4 items), 85% of which are upgrades/curses (15% are buffs). Each extra rolls from the shop weights with tiers above T removed and the rest rescaled to sum to 1.
3. **Value split** = `0.54 × shop + 0.46 × bundle`. 0.54 is the share of shop slots across all runs in 2a (9,000 shop slots vs 7,794 bundle grants), and it's the only input that comes from run data.
4. **Orb split**: divide each tier's value share by its orb value (1 / 5 / 25 / 100 / 400), then rescale so the tiers sum to 100%.

Check: for wave 1 the calculated bundle item split is 76.0 / 18.7 / 4.8 / 0.4, and the runs show 77 / 14 / 7 / 2.

| Wave | Value split C / U / R / E / L | Orbs Common | Uncommon | Rare | Epic | Legendary | Avg orb (commons) |
|---|---|---|---|---|---|---|---|
| 1 | 62.0 / 27.5 / 10.3 / 0.2 / 0.0 | 91.3% | 8.1% | 0.6% | 0.003% | 0% | 1.47 |
| 2 | 61.7 / 27.8 / 10.3 / 0.2 / 0.0 | 91.2% | 8.2% | 0.6% | 0.003% | 0% | 1.48 |
| 3 | 60.0 / 28.9 / 10.9 / 0.2 / 0.0 | 90.6% | 8.7% | 0.7% | 0.003% | 0% | 1.51 |
| 4 | 57.2 / 30.7 / 11.7 / 0.4 / 0.0 | 89.6% | 9.6% | 0.7% | 0.006% | 0% | 1.57 |
| 5 | 56.1 / 30.1 / 11.2 / 2.6 / 0.0 | 89.6% | 9.6% | 0.7% | 0.041% | 0% | 1.60 |
| 6 | 53.9 / 31.0 / 12.6 / 2.6 / 0.0 | 88.9% | 10.2% | 0.8% | 0.043% | 0% | 1.65 |
| 7 | 52.5 / 31.8 / 12.9 / 2.8 / 0.0 | 88.4% | 10.7% | 0.9% | 0.047% | 0% | 1.68 |
| 8 | 51.5 / 32.9 / 12.9 / 2.8 / 0.0 | 87.9% | 11.2% | 0.9% | 0.048% | 0% | 1.71 |
| 9 | 49.5 / 33.2 / 13.8 / 3.6 / 0.0 | 87.3% | 11.7% | 1.0% | 0.063% | 0% | 1.76 |
| 10 | 48.2 / 33.7 / 14.0 / 3.6 / 0.5 | 86.8% | 12.1% | 1.0% | 0.064% | 0.002% | 1.80 |
| 11 | 45.4 / 35.6 / 14.7 / 3.6 / 0.7 | 85.4% | 13.4% | 1.1% | 0.067% | 0.004% | 1.88 |
| 12 | 43.3 / 36.6 / 15.8 / 3.6 / 0.7 | 84.4% | 14.3% | 1.2% | 0.070% | 0.004% | 1.95 |
| 13 | 42.2 / 37.4 / 15.8 / 3.8 / 0.7 | 83.8% | 14.9% | 1.3% | 0.075% | 0.004% | 1.99 |
| 14 | 40.5 / 37.7 / 16.7 / 4.3 / 0.7 | 83.1% | 15.5% | 1.4% | 0.089% | 0.004% | 2.05 |
| 15 | 39.0 / 38.9 / 16.8 / 4.4 / 0.9 | 82.1% | 16.4% | 1.4% | 0.092% | 0.005% | 2.10 |
| 16 | 38.8 / 37.8 / 17.6 / 4.4 / 1.5 | 82.4% | 16.0% | 1.5% | 0.093% | 0.008% | 2.13 |
| 17 | 38.4 / 37.2 / 17.7 / 5.1 / 1.5 | 82.4% | 16.0% | 1.5% | 0.1% | 0.008% | 2.14 |
| 18 | 36.6 / 38.2 / 18.6 / 5.1 / 1.5 | 81.3% | 16.9% | 1.7% | 0.1% | 0.008% | 2.22 |
| 19 | 35.5 / 38.4 / 19.3 / 5.4 / 1.5 | 80.7% | 17.4% | 1.8% | 0.1% | 0.008% | 2.27 |
| 20 | 34.5 / 37.9 / 19.6 / 5.9 / 2.0 | 80.4% | 17.7% | 1.8% | 0.1% | 0.012% | 2.33 |
| 21 | 34.2 / 37.6 / 20.2 / 5.9 / 2.0 | 80.3% | 17.7% | 1.9% | 0.1% | 0.012% | 2.35 |
| 22 | 33.9 / 37.1 / 21.1 / 5.9 / 2.0 | 80.3% | 17.6% | 2.0% | 0.1% | 0.012% | 2.37 |
| 23 | 32.8 / 36.6 / 21.8 / 6.7 / 2.0 | 79.9% | 17.8% | 2.1% | 0.2% | 0.012% | 2.43 |
| 24 | 31.7 / 36.8 / 22.7 / 6.7 / 2.0 | 79.2% | 18.4% | 2.3% | 0.2% | 0.013% | 2.50 |
| 25 | 31.4 / 36.2 / 23.5 / 6.9 / 2.0 | 79.2% | 18.3% | 2.4% | 0.2% | 0.013% | 2.52 |
| 26 | 30.2 / 36.4 / 23.6 / 7.0 / 2.8 | 78.4% | 18.9% | 2.4% | 0.2% | 0.018% | 2.59 |
| 27 | 29.2 / 36.0 / 24.5 / 7.5 / 2.8 | 77.9% | 19.2% | 2.6% | 0.2% | 0.019% | 2.67 |
| 28 | 28.8 / 35.4 / 25.2 / 7.8 / 2.8 | 77.9% | 19.1% | 2.7% | 0.2% | 0.019% | 2.70 |
| 29 | 28.5 / 34.8 / 25.6 / 8.3 / 2.8 | 77.9% | 19.0% | 2.8% | 0.2% | 0.019% | 2.73 |
| 30 | 28.3 / 33.5 / 26.3 / 8.6 / 3.3 | 78.3% | 18.5% | 2.9% | 0.2% | 0.023% | 2.77 |


-----
- [ ] new shop for making purchases with orbs.
- [ ] Purchases include rerolls, upgrades, buildables, and more

## Bullet upgrades (future)
### tier 2 variant upgrade ideas
**Homing Bullets**
- [ ] Stickies: Homing bullets leave behing projectiles that stick to the enemy to deal weaker continuous damage.
Requires: Homing bullets, 2 pierce upgrades
Upgrades: Freezing stickies (sticky projectiles slow enemies while attached), Weakening stickies (reduces the damage of enemies they are stuck to), Stronger stickies (stickies deal damage based on a percent of the homing bullet, increase the minimum possible damage of the stickies)

- [ ] Speed Seekers: Greatly increases the velocity and fire rate of homing bullets but decreases power (size) (DOUBLE FIRE RATE, REDUCE DAMAGE BY 50%)
- Requires: Homing bullets, 10 velocity upgrades
- Upgrades: Fire rate, Velocity

**Explosive Bullets**
- [ ] STA Missle: Explosive Bullets now have a chance to be a high velocity missle that shoots toward the mouse cursor with increased explosive power.
Requires: explosive bullets, 10 bullet velocity upgrades, 5 explosion radius upgrades
Upgrades: increased velocity, increased missle spawn chance, increased blast power (size + knockback)

- [ ] Cluster Bombs: Explosive bullets now explode into smaller explosives. Explosives dont do contact damage but explode after a time.
Requires: explosive bullets, 10 explosion radius upgrades
Upgrades: More cluster bombs, higher cluster bomb explosion radius, decreased detonation time

- [ ] Napalm: Explosive bullets leave behind a constant-damaging area of napalm on detonation.
Requires: explosive bullets, 2 piercing shot upgrades
Upgrades: Larger radius, longer duration

**Buckshot Bullets**
- [ ] Tactical Marker: has a chance to temporarily mark an enemy. Hitting marked enemies deals increased damage
Requires: buckshot bullets, 2 denser shell upgrades
Upgrades: increased marker chance, increased marker duration, increase marker damage

- [ ] Slug Shells: Shoots the pellets together in a high velocity bullet that separates on impact or after a certain range
Requires: buckshot bullets, 10 velocity upgrades, 2 bullet choke upgrades
Upgrades: increased velocity, increase distance before separation, increased pellets on separation

- [ ] Shredder: Fires smaller, weaker pellets, but fires more of them with an increased fire rate.
Requires: buckshot bullets, 2 longer shell upgrades
Upgrades: increased pellet count, increased fire rate, increased close-quarters damage (show visibly with a 0 damage projectile around the player)

## MOBILE
- [x] Remove Fullscreen button
- [x] improve zoom
- [ ] add button layout customization

# Systems

## Leaderboard
- [~] Backend `PlayerStatsRepository.get_leaderboard` exists; frontend UI not built

## Per-game database tracking
- [~] PlayerStats (lifetime totals) + GameSave (current run: wave, kills, points, time_survived, ordered upgrade_history, death_state) are live
- [ ] GameSave is one-per-user and gets deleted on new game start — still no persistent per-game history collection (game id, full upgrade order, waves survived, enemies killed, points earned, total time spent, per completed run). Data GameSave already tracks would just need archiving into a new collection on death instead of being overwritten.

## Backend deployment (frontend already on Vercel)
Plan: MongoDB Atlas (free M0) for the DB + Render free web service for FastAPI (move to Google Cloud Run if cold starts become a problem). Other free/cheap options considered: Koyeb, Oracle Cloud Always Free VM, Fly.io/Railway (~$5/mo).

### Environment config (no hardcoded links)
Design: one variable per setting (`MONGODB_URL`, `API_TARGET`, ...), no `PRODUCTION` flag branching. Switch environments by swapping which values get loaded, not with if/else in code.
- [x] Backend: single `.env` with LOCAL / CLOUD blocks toggled by commenting. The CLOUD block uses `MONGODB_DATABASE=polygon_game_dev` so local testing never writes into real player data.
- [x] Backend: update `.env.example` to match the LOCAL / CLOUD block layout
- [x] Frontend: make the Vite dev proxy target env-driven in `vite.config.ts` (`env.API_TARGET || 'http://127.0.0.1:8000'`, via `loadEnv`) so `API_TARGET=https://<render-url> npm run dev` runs the local frontend against the cloud backend
- [x] Frontend: keep all API calls as relative `/api/...` paths. Never put the DB URL or secrets in `VITE_*` vars (they get baked into the public bundle).

### Frontend → backend routing in production
- [x] Add `vercel.json` rewrite: `/api/:path*` → `https://<render-url>/api/:path*` (plus the SPA fallback `/(.*)` → `/index.html` if it isn't already configured). The browser only talks to the Vercel domain, so no CORS needed.
- [x] (Adopted; the `/api` rewrite above was removed.) Alternative if the rewrite doesn't work out: set axios `baseURL` from `VITE_API_URL` in `frontend/src/config/axios.ts` and set `CORS_ORIGINS` to the Vercel domain

### Hosting setup
- [x] Create Atlas M0 cluster, DB user with password, network access rules. Separate databases for prod (`polygon_game`) and dev (`polygon_game_dev`). (Resolves Security #2.)
- [x] Create Render web service from the GitHub repo (root dir `backend/`)
- [x] Production start command (not `start.sh`, which uses `--reload`): `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`
- [x] Set env vars in the Render dashboard: fresh `SECRET_KEY` (don't reuse the dev one), `MONGODB_URL`, `MONGODB_DATABASE`, `CORS_ORIGINS`
- [x] HTTPS comes free from Render/Vercel (resolves most of Security #8)

### Things that break behind a hosted proxy
- [x] (Resolved: browser calls Render directly, limiter keys on `True-Client-IP`, uvicorn runs with `--no-proxy-headers`.) Rate limiting: slowapi keys by client IP. Behind Render's proxy (and Vercel's rewrite), every request looks like it comes from the proxy's IP, so all players would share one login limit (10/min) unless `--proxy-headers` is set. After deploying, check that the real client IP comes through the Vercel → Render chain.
- [ ] Cold starts: the Render free tier sleeps after ~15 min idle, and the first request after that takes ~30-60s. Make sure the game doesn't soft-lock when `/api/waves/start` / `complete` / `select-upgrade` is slow or fails, and that a cold start can't eat the 30s wave-token window.

### Docs
- [x] Write a deploy guide in `backend/documentation` (hosts, env vars, start command, how to switch local/cloud backend + DB) and note the frontend proxy/rewrite setup in `frontend/documentation`

# Anti-cheat
- [ ] Movement validation: tighten how small speed overages are treated for players with dash upgrades, so sustained overage always has to be explained by dash charges. Measure honest sample noise first.
- [ ] Buff-aware validation: movement, fire rate and damage checks account for server-granted buffs (buff system phase 6).
- [ ] Damage validation (`_validate_damage` in wave_service.py) currently assumes bullet attack type only. When flame/laser/spinner/zapper are implemented, each will need its own damage profile accounted for in `calculate_minimum_damage_required`.
- [ ] Track player health vs damage taken. Should even out to track when they should die
- [ ] Track player healing. We need to know if the player should of died, but healing and damage happen over time so we cant just use an accumulator. We probably need methods for healing, which allows us to implement a bleeding debuff to stop healing.
- [ ] For damage reduction buffs and upgrades, we need to account for that in the equation we decide for #2. Not sure how to do that yet.
# Player progression

- [ ] account-based player progression so the player can level up and unlock new attacks, difficulties, and upgrades.
- [ ] An in-game currency for purchasing upgrades

# Security

## Critical
1. [ DONE ] Hardcoded JWT Secret Key — `config.py` now requires `SECRET_KEY` from env, validates it's ≥32 chars, no insecure default. `.env` has a real generated secret.
2. [x] No MongoDB Authentication (backend/docker-compose.yml, backend/.env) — still `mongodb://localhost:27017` with no credentials. Will be resolved by moving to Atlas (see Backend deployment).
3. [ DONE ] Debug Mode — `debug` flag in config.py is dead code (nothing reads `settings.debug`), and `FastAPI()` in main.py is never constructed with `debug=True`, so the verbose-error risk never applied. Flag can be deleted as cleanup.
4. [ DONE ] No Rate Limiting — slowapi wired up (`app/core/limiter.py` + `main.py`): login 10/min, register 5/hour, check-username 20/min, all per-IP

## High priority
5. [ INTENDED FOR NOW ] 24-hour JWT expiry (config.py:14) — still 1440 min, no refresh-token flow. Partial mitigation: logout now revokes tokens via `TokenBlacklistRepository`.
6. [~] CORS — origins now restricted via `CORS_ORIGINS` env var (main.py:38, defaults to localhost:3000 only), no longer `*`. `allow_methods`/`allow_headers` are still `["*"]`.
7. [ DONE ] Weak password policy — register now requires min 8 chars + at least one letter and one digit (`auth.py` `UserRegisterRequest.validate_password_strength`)
8. [ ] No HTTPS enforcement — should redirect HTTP to HTTPS in production. Render/Vercel provide TLS automatically (see Backend deployment).
9. [ ] Missing security headers — no CSP, HSTS, X-Frame-Options, etc.
10. [~] No true account lockout, but failed logins are rate-limited as brute-force mitigation

## Rate limiting & account abuse
Shared networks with multiple users look identical to one attacker with an automation script, so IP limits are speed bumps; inactive-account cleanup caps the total damage.
- [x] Limiter keys on `True-Client-IP` (set by Render's edge, unspoofable) with moving-window strategy
- [x] IPv6 addresses grouped by /64 so rotating addresses count as one client
- [x] Login: failed attempts are rate-limited so shared networks aren't blocked together
- [x] Register and username-check limits loosened for shared networks
- [x] Inactive-account cleanup: accounts that never play are removed after a grace period
- [ ] FUTURE (not planned now): Cloudflare Turnstile on the register form. The only defense that tells many humans from one bot on the same IP. Add if automated sign-ups show up.