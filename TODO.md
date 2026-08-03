# Gameplay

## Waves & progression
- [~] Fixed progression for first 30 waves — Normal.ts hardcodes 1-19; extend through 30
- [ ] Add difficulties beyond Normal (Difficulty interface is in place in systems/difficulty/)
- [ ] After wave 30 is complete, start adding bosses to the regular enemy pool

## Enemies
- [ DONE ] Super pentagon — sprints toward player, explodes, leaves behind a fire pool
- [ DONE ] Super hexagon
- [ ] Super Octogon
- [ ] Hexagon: add visual indication for shield health

## Bosses
- [ DONE ] First boss phase 1
- [ DONE ] First boss phase 2: dashes → idle → fixed-direction rapid-fire bullet storm → dashes → random teleport 

## Attacks
- [ ] Flame / laser / spinner / zapper implementations

## Sounds
- [ DONE ] Ability sound effects (dash, shield, etc)
- [ DONE ] Special attack sound effects
- [ DONE ] Enemy attack sound effects
- [ DONE ] Boss sound effects

## Curses
- [ BASE CLASS IMPLEMENTED] Similar to upgrades but give a negative effect
- [ ] Poison: temporarily slows the player and deals damage per second over time. Time and damage dependent on rarity.
- [ ] Frozen: Disables all movement and attacking for 3 seconds. Damage taken reduced by 99%.
- [ ] Coldness: temporarily slows the player over time. Slowness amount and time dependent on rarity.
- [ ] Burning: does damage over time. Damage and time dependent on rarity.
- [ ] Bleeding: prevent healing for a time. Time dependent on rarity.

## Upgrades/Bundles
- [ DONE ] Make enemies drop upgrade bundles
- [ DONE ] Upgrade bundles give random upgrades of the rarity with a chance to give a curse
- [ ] New "buffs" which are temporary upgrades to the player
- [ ] "Largenes": reduces damage taken but reduced movement speed and increases size. All values dependent on rarity. Cannot roll from bundles.
- [ ] "Lightweight: reduced size and increases speed but increases the damage taken. All values dependent on rarity. Cannot roll from bundles.

## Visuals
- [ ] Implement 'dusts' (see terraria)
- [ ] Ensure settings actually work
- [ ] Add color customization
- [ ] Lighting

## Bullet upgrades (future)
- [ ] Napalm (exploding bullets)
- [ DONE ] Buckshot bullet variante.

## MOBILE
- [ ] Remove Fullscreen button
- [ ] improve zoom
- [ ] add button layout customization

# Systems

## Leaderboard
- [~] Backend `PlayerStatsRepository.get_leaderboard` exists; frontend UI not built

## Per-game database tracking
- [~] PlayerStats (lifetime totals) + GameSave (current run: wave, kills, points, time_survived, ordered upgrade_history, death_state) are live
- [ ] GameSave is one-per-user and gets deleted on new game start — still no persistent per-game history collection (game id, full upgrade order, waves survived, enemies killed, points earned, total time spent, per completed run). Data GameSave already tracks would just need archiving into a new collection on death instead of being overwritten.

# Anti-cheat
- Damage validation (`_validate_damage` in wave_service.py) currently assumes bullet attack type only. When flame/laser/spinner/zapper are implemented, each will need its own damage profile accounted for in `calculate_minimum_damage_required`.

# Security

## Critical
1. [ DONE ] Hardcoded JWT Secret Key — `config.py` now requires `SECRET_KEY` from env, validates it's ≥32 chars, no insecure default. `.env` has a real generated secret.
2. [ ] No MongoDB Authentication (backend/docker-compose.yml, backend/.env) — still `mongodb://localhost:27017` with no credentials
3. [ DONE ] Debug Mode — `debug` flag in config.py is dead code (nothing reads `settings.debug`), and `FastAPI()` in main.py is never constructed with `debug=True`, so the verbose-error risk never applied. Flag can be deleted as cleanup.
4. [ DONE ] No Rate Limiting — slowapi wired up (`app/core/limiter.py` + `main.py`): login 10/min, register 5/hour, check-username 20/min, all per-IP

## High priority
5. [ INTENDED FOR NOW ] 24-hour JWT expiry (config.py:14) — still 1440 min, no refresh-token flow. Partial mitigation: logout now revokes tokens via `TokenBlacklistRepository`.
6. [~] CORS — origins now restricted via `CORS_ORIGINS` env var (main.py:38, defaults to localhost:3000 only), no longer `*`. `allow_methods`/`allow_headers` are still `["*"]`.
7. [ DONE ] Weak password policy — register now requires min 8 chars + at least one letter and one digit (`auth.py` `UserRegisterRequest.validate_password_strength`)
8. [ ] No HTTPS enforcement — should redirect HTTP to HTTPS in production
9. [ ] Missing security headers — no CSP, HSTS, X-Frame-Options, etc.
10. [~] No true account lockout, but login is now rate-limited to 10/min per IP (slowapi) as partial brute-force mitigation