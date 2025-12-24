1. Add fixed progression for first 30 waves
2. Add new enemies to add difficulty
3. implement flame, laser, spinner, and zapper.
4. add upgrades for projectiles
7. improve waves/enemy spawns
8. Add difficulties
9. Add leaderboard

security:
---
  🚨 CRITICAL Security Issues

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

  ---
  ⚠️ High Priority Issues

  5. 24-hour JWT expiry (config.py:13) - Too long, use 1-2 hours + refresh tokens
  6. CORS wildcards (main.py:19-20) - Restrict methods and headers in production
  7. Weak password policy - Only 6 characters minimum, no complexity requirements
  8. No HTTPS enforcement - Should redirect HTTP to HTTPS in production
  9. Missing security headers - No CSP, HSTS, X-Frame-Options, etc.
  10. No account lockout - Unlimited login attempts possible

  ---
  📊 Security Score Summary

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