# Gameplay

## Waves & progression
- [~] Fixed progression for first 30 waves — Normal.ts hardcodes 1-19; extend through 30
- [ ] Add difficulties beyond Normal (Difficulty interface is in place in systems/difficulty/)
- [ ] After wave 30 is complete, start adding bosses to the regular enemy pool

## Enemies
- [ ] Super pentagon — sprints toward player, explodes, leaves behind a fire pool
- [ ] Super hexagon — still shielded, sprays magic in direction of player, explodes on death
- [ ] Hexagon: add visual indication for shield health

## Bosses
- [x] First boss phase 1
- [ ] First boss phase 2: dashes → idle → fixed-direction rapid-fire bullet storm → dashes → random teleport → death laser → idle

## Attacks
- [x] Flame / laser / spinner / zapper implementations

## Sounds
- [~] Ability sound effects (dash, shield, etc)
- [ ] Special attack sound effects
- [ ] Enemy attack sound effects
- [ ] Boss sound effects

## Visuals
- [ ] Implement 'dusts' (see terraria)
- [ ] Ensure settings actually work
- [ ] Add color customization

## Bullet upgrades (future)
- [ ] Napalm (exploding bullets)
- [ ] Mini nuke — unlocks after all exploding-bullet upgrades
- [ ] Drone swarm — unlocks after all homing upgrades

## MOBILE
- [ ] Remove Fullscreen button
- [ ] improve joystick padding
- [ ] remove slow movement capabilities for left joystick
- [ ] improve zoom
- [ ] add button layout customization

# Systems

## Leaderboard
- [~] Backend `PlayerStatsRepository.get_leaderboard` exists; frontend UI not built

## Per-game database tracking
- [~] PlayerStats + GameSave + ordered upgrade_history are live
- [ ] Still missing per-game record: game id, full upgrade order for that run, waves survived, enemies killed, points earned, total time spent

# Anti-cheat
- Damage validation (`_validate_damage` in wave_service.py) currently assumes bullet attack type only. When flame/laser/spinner/zapper are implemented, each will need its own damage profile accounted for in `calculate_minimum_damage_required`.

# Security

## Critical
1. Hardcoded JWT Secret Key (backend/app/core/config.py:11)

   secret_key: str = "your-secret-key-change-in-production"
   Impact: Anyone can forge JWT tokens and impersonate users
   Fix:
   # In .env file:
   JWT_SECRET_KEY=<generate-with: openssl rand -hex 32>

   # In config.py:
   secret_key: str = Field(..., env="JWT_SECRET_KEY")

2. No MongoDB Authentication (backend/.env:1)

   MONGODB_URL=mongodb://localhost:27017
   Impact: Database accessible without credentials
   Fix: Enable MongoDB auth in docker-compose.yml and use authenticated connection string

3. Debug Mode Enabled (backend/app/core/config.py:16)

   debug: bool = True
   Impact: Verbose error messages leak system information
   Fix: Set debug: bool = False in production

4. No Rate Limiting

   Impact: Vulnerable to brute-force login attacks
   Fix: Add slowapi or similar rate limiting middleware

## High priority
5. 24-hour JWT expiry (config.py:13) — too long, use 1-2 hours + refresh tokens
6. CORS wildcards (main.py:19-20) — restrict methods and headers in production
7. Weak password policy — only 6 characters minimum, no complexity requirements
8. No HTTPS enforcement — should redirect HTTP to HTTPS in production
9. Missing security headers — no CSP, HSTS, X-Frame-Options, etc.
10. No account lockout — unlimited login attempts possible

## Security score summary

| Category             | Score | Notes                                           |
|----------------------|-------|-------------------------------------------------|
| SQL/NoSQL Injection  | 9/10  | Excellent - parameterized queries throughout    |
| XSS Protection       | 8/10  | Good - React auto-escaping, no unsafe patterns  |
| Authentication       | 3/10  | CRITICAL - Hardcoded secret, weak policy        |
| Anti-Cheat           | 10/10 | Outstanding - multi-layered validation          |
| Input Validation     | 9/10  | Excellent - Pydantic models with validators     |
| Session Management   | 5/10  | Works but lacks refresh tokens, too long expiry |
| Database Security    | 4/10  | CRITICAL - No authentication enabled            |
| Production Hardening | 2/10  | CRITICAL - Debug mode, missing headers          |

Overall Score: 6.25/10