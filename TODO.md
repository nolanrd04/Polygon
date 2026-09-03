# Gameplay

## Waves & progression
- [~] Fixed progression for first 30 waves — Normal.ts hardcodes 1-27; extend through 30
- [ ] Add difficulties beyond Normal (Difficulty interface is in place in systems/difficulty/)
- [ ] After wave 30 is complete, start adding bosses to the regular enemy pool
- [ ] Stat scaling balancing: right now, player stats outpace the rate of increase of enemy stats. Need to fix this somehow.

## Enemies
- [ DONE ] Super pentagon — sprints toward player, explodes, leaves behind a fire pool
- [ DONE ] Super hexagon
- [ ] Super Octogon
- [ ] Hexagon: add visual indication for shield health
- [ ] Vampire (triangle?): if it hits the player the player can't regen health

## Bosses
- [ DONE ] First boss phase 1
- [ DONE ] First boss phase 2: dashes → idle → fixed-direction rapid-fire bullet storm → dashes → random teleport 

## Attacks
- [ ] Laser
- [ ] FLamer
- [ ] Zapper
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
- [ ] Healing refactor: add a keybind to restore health instantly. Add upgrades below:
- [ ] Healing refactor upgrade: Increase insta heal slots +1
- [ ] Healing refactor upgrade: Decrease insta heal cooldown
- [ ] Healing refactor upgrade: Increase insta heal amount (percentage based)
- [ ] Healing refactor: change vampirism to heal per chance. upgrades increase chance but not value
- [ ] Healing refactor: New upgrade: syphon. Syphon will heal a killed enemy for x amount on kill.

## Visuals
- [ DONE ] Implement 'dusts' (see terraria)
- [ ~ ] Ensure settings actually work
- [ ] Add color customization for the player
- [ DONE ] Lighting

## Bullet upgrades (future)
### tier 2 variant upgrade ideas
**Homing Bullets**

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