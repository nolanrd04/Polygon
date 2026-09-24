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
- [ ] Laser
-  [ ] Zapper
- [ ] Zapper (**variant: lightning rod**: *still shoots out normal bolts but for each polygon side, the same number of nearest enemies get shocked by a chain reaction lightning bolt*; **-> lord of thunder**: *lightning bolts now have a 50% chance to spawn but attack 3x as fast, and one will periodically spawn on the player to attack enemies nearby.*; -> **mjolnir**: *a lightning-charged hammer now circles the player and zaps nearby enemies. Hammer colisions spawn multiple thunderbolts.*)

- [ ] Flamer

- [ ] Spinner
- [ ] Healer
- [ ] Controller

## Sounds
- [ DONE ] Ability sound effects (dash, shield, etc)
- [ DONE ] Special attack sound effects
- [ DONE ] Enemy attack sound effects
- [ DONE ] Boss sound effects

## Curses
- [ BASE CLASS IMPLEMENTED ] Similar to upgrades but give a negative effect
- [ ] Poison: temporarily slows the player and deals damage per second over time. Time and damage dependent on rarity.
- [ ] Frozen (DEFERRED): Disables all movement and attacking for 3 seconds. Damage taken reduced by 99%.
- [ ] Coldness: temporarily slows the player over time. Slowness amount and time dependent on rarity.
- [ ] Burning: does damage over time. Damage and time dependent on rarity.
- [ ] Bleeding: prevent healing for a time. Time dependent on rarity.

## Upgrades/Bundles
- [ DONE ] Make enemies drop upgrade bundles
- [ DONE ] Upgrade bundles give random upgrades of the rarity with a chance to give a curse
- [ ] New "buffs" which are temporary upgrades to the player
- [ ] "Largenes": reduces damage taken but reduced movement speed and increases size. All values dependent on rarity. Cannot roll from bundles.
- [ ] "Lightweight: reduced size and increases speed but increases the damage taken. All values dependent on rarity. Cannot roll from bundles.
- [x] Healing refactor: add a keybind to restore health instantly. Add upgrades below:
- [x] Healing refactor upgrade: Increase insta heal slots +1
- [x] Healing refactor upgrade: Decrease insta heal cooldown
- [x] Healing refactor upgrade: Increase insta heal amount (percentage based)
- [x] Healing refactor: change vampirism to heal per chance. upgrades increase chance but not value
- [ ] Healing refactor: New upgrade: syphon. Syphon will heal a killed enemy for x amount on kill.

## Visuals
- [x] Implement 'dusts' (see terraria)
- [ ~ ] Ensure settings actually work
- [ ] Add color customization for the player
- [ DONE ] Lighting

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
- [ ] Backend: update `.env.example` to match the LOCAL / CLOUD block layout
- [x] Frontend: make the Vite dev proxy target env-driven in `vite.config.ts` (`env.API_TARGET || 'http://127.0.0.1:8000'`, via `loadEnv`) so `API_TARGET=https://<render-url> npm run dev` runs the local frontend against the cloud backend
- [ ] Frontend: keep all API calls as relative `/api/...` paths. Never put the DB URL or secrets in `VITE_*` vars (they get baked into the public bundle).

### Frontend → backend routing in production
- [ ] Add `vercel.json` rewrite: `/api/:path*` → `https://<render-url>/api/:path*` (plus the SPA fallback `/(.*)` → `/index.html` if it isn't already configured). The browser only talks to the Vercel domain, so no CORS needed.
- [ ] Alternative if the rewrite doesn't work out: set axios `baseURL` from `VITE_API_URL` in `frontend/src/config/axios.ts` and set `CORS_ORIGINS` to the Vercel domain

### Hosting setup
- [ ] Create Atlas M0 cluster, DB user with password, network access rules. Separate databases for prod (`polygon_game`) and dev (`polygon_game_dev`). (Resolves Security #2.)
- [ ] Create Render web service from the GitHub repo (root dir `backend/`)
- [ ] Production start command (not `start.sh`, which uses `--reload`): `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'`
- [ ] Set env vars in the Render dashboard: fresh `SECRET_KEY` (don't reuse the dev one), `MONGODB_URL`, `MONGODB_DATABASE`, `CORS_ORIGINS`
- [ ] HTTPS comes free from Render/Vercel (resolves most of Security #8)

### Things that break behind a hosted proxy
- [ ] Rate limiting: slowapi keys by client IP. Behind Render's proxy (and Vercel's rewrite), every request looks like it comes from the proxy's IP, so all players would share one login limit (10/min) unless `--proxy-headers` is set. After deploying, check that the real client IP comes through the Vercel → Render chain.
- [ ] Cold starts: the Render free tier sleeps after ~15 min idle, and the first request after that takes ~30-60s. Make sure the game doesn't soft-lock when `/api/waves/start` / `complete` / `select-upgrade` is slow or fails, and that a cold start can't eat the 30s wave-token window.

### Docs
- [ ] Write a deploy guide in `backend/documentation` (hosts, env vars, start command, how to switch local/cloud backend + DB) and note the frontend proxy/rewrite setup in `frontend/documentation`

# Anti-cheat
- Damage validation (`_validate_damage` in wave_service.py) currently assumes bullet attack type only. When flame/laser/spinner/zapper are implemented, each will need its own damage profile accounted for in `calculate_minimum_damage_required`.

# Security

## Critical
1. [ DONE ] Hardcoded JWT Secret Key — `config.py` now requires `SECRET_KEY` from env, validates it's ≥32 chars, no insecure default. `.env` has a real generated secret.
2. [ ] No MongoDB Authentication (backend/docker-compose.yml, backend/.env) — still `mongodb://localhost:27017` with no credentials. Will be resolved by moving to Atlas (see Backend deployment).
3. [ DONE ] Debug Mode — `debug` flag in config.py is dead code (nothing reads `settings.debug`), and `FastAPI()` in main.py is never constructed with `debug=True`, so the verbose-error risk never applied. Flag can be deleted as cleanup.
4. [ DONE ] No Rate Limiting — slowapi wired up (`app/core/limiter.py` + `main.py`): login 10/min, register 5/hour, check-username 20/min, all per-IP

## High priority
5. [ INTENDED FOR NOW ] 24-hour JWT expiry (config.py:14) — still 1440 min, no refresh-token flow. Partial mitigation: logout now revokes tokens via `TokenBlacklistRepository`.
6. [~] CORS — origins now restricted via `CORS_ORIGINS` env var (main.py:38, defaults to localhost:3000 only), no longer `*`. `allow_methods`/`allow_headers` are still `["*"]`.
7. [ DONE ] Weak password policy — register now requires min 8 chars + at least one letter and one digit (`auth.py` `UserRegisterRequest.validate_password_strength`)
8. [ ] No HTTPS enforcement — should redirect HTTP to HTTPS in production. Render/Vercel provide TLS automatically (see Backend deployment).
9. [ ] Missing security headers — no CSP, HSTS, X-Frame-Options, etc.
10. [~] No true account lockout, but login is now rate-limited to 10/min per IP (slowapi) as partial brute-force mitigation