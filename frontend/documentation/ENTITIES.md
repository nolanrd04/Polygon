# Entities

Entities are the active in-game objects that live inside the Phaser scene. They are not React components — they are plain TypeScript classes that Phaser manages via its physics and rendering pipeline.

All entities live under `frontend/src/game/entities/`.

---

## Entity types

| Entity | File(s) | Status |
|--------|---------|--------|
| [Player](PLAYER.md) | `entities/Player.ts` | Implemented |
| [Enemy](ENEMY.md) | `entities/enemies/` | Implemented |
| [Projectile](PROJECTILE.md) | `entities/projectiles/` | Implemented |
| [Particle](PARTICLE.md) | `entities/particles/Particle.ts` | Stub only – not yet active in game |
| [DroppedUpgradeBundle](UPGRADE_BUNDLE.md) | `entities/upgrades/DroppedUpgradeBundle.ts` | Stub only – not yet active in game |

---

## Common patterns

All entities that need physics use a **Phaser Container** as their root game object. This keeps visual children (sprites, graphics) grouped together while the `Phaser.Physics.Arcade.Body` is attached to the container itself for collision detection.

Both `Enemy` and `Projectile` use a three-hook rendering pipeline inspired by tModLoader:
- `PreDraw()` – return `false` to skip rendering this frame.
- `Draw()` – render the main sprite (default: update tint/scale).
- `PostDraw()` – render effects on top (trails, outlines, particles).

Textures are never drawn with `Phaser.GameObjects.Graphics` per frame. Instead, `TextureGenerator` pre-bakes and caches textures; entities reference them via sprite objects and update color/size through `setTint()` / `setScale()`. This provides 50–100× better render performance over per-frame Graphics drawing.
