# Particle

**File:** `frontend/src/game/entities/particles/Particle.ts`

> **Not yet implemented.** The `Particle` class is a stub with no active integration in the game loop.

The abstract class defines the expected interface for future visual particle effects:

| Field | Type | Description |
|-------|------|-------------|
| `posX` / `posY` | `number` | World-space position |
| `velocityX` / `velocityY` | `number` | Per-frame movement |
| `lifespan` | `number` | Milliseconds before the particle disappears |
| `color` | `number` | Hex color |
| `size` | `number` | Radius in pixels |
| `scale` | `number` | Visual scale multiplier |
| `rotation` | `number` | Angle in radians |
| `alpha` | `number` | Opacity (0–1) |
| `shape` | `string` | Shape identifier (e.g. `'circle'`) |

`SetDefaults()` is declared abstract and must be implemented by any concrete particle type.

Currently, visual death effects use `TrailRenderer` and Phaser tweens directly on sprites rather than this class. When particle effects are implemented, this will serve as the base class for a managed particle pool.
