# ProjectileManager

**File:** `frontend/src/game/systems/ProjectileManager.ts`

> **Legacy — mostly unused.** `Player.ts` now manages its own projectiles directly. `ProjectileManager` is kept for backward compatibility but is not part of the active game loop.

---

## Current status

`MainScene` instantiates `ProjectileManager` but does not call `update()` on it, and `Player` never delegates to it. The class contains stub implementations for visual rendering of lasers, zappers, flamers, and spinners using `Graphics` objects — but these are separate from the actual `Projectile` subclasses (`Laser.ts`, `Zapper.ts`, etc.) that are used in gameplay.

## Remaining methods (for reference)

| Method | Description |
|--------|-------------|
| `fireLaser(x, y, tx, ty, stats)` | Draws a fading line with a glow using Graphics — visual only, no collision |
| `fireZapper(x, y, tx, ty, stats)` | Placeholder lightning visual — no chain logic |
| `activateFlamer(x, y, angle, stats)` | Draws a filled cone arc — visual only |
| `activateSpinner(x, y, radius, duration)` | Draws animated spinning lines — visual only |
| `update()` | No-op |
| `getProjectiles()` | Returns the (empty) Phaser group |
| `clear()` | Clears the group |

These methods may be removed or replaced in a future cleanup pass.
