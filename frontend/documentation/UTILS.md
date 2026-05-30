# Utils

Utility classes live in `frontend/src/game/utils/`. They provide performance-critical rendering helpers used by entities and systems.

---

## TextureGenerator

**File:** `TextureGenerator.ts`

On-demand, cached texture generation for circles, polygons, and diamonds. See [TEXTURE_GENERATOR.md](TEXTURE_GENERATOR.md) for full documentation.

**Why it exists:** Drawing shapes with `Phaser.GameObjects.Graphics` every frame is CPU-intensive. TextureGenerator draws once to an off-screen canvas, saves the result as a named texture, and all subsequent entities use a lightweight `Sprite` reference to the cached texture. This yields 50–100× better performance for entities with many instances.

---

## TrailRenderer

**File:** `TrailRenderer.ts`

Sprite-based trail effect renderer. See [TRAIL_RENDERER.md](TRAIL_RENDERER.md) for full documentation.

**Why it exists:** The old approach was to redraw trail circles with `Graphics` every frame. The new approach spawns short-lived sprites at historical positions that fade out via Phaser tweens. This is 10–20× faster because tween-driven alpha changes are GPU-accelerated and the sprites self-destroy without any per-frame bookkeeping.
