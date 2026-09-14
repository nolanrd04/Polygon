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

---

## ScreenSpaceLayer

**File:** `ScreenSpaceLayer.ts`

A container whose children are laid out in **screen pixels** and stay that size regardless of `camera.zoom`.

**Why it exists:** `setScrollFactor(0)` pins an object against camera *scroll*, but not camera *zoom* — Phaser runs every object through the camera matrix, pinned or not. Once mobile started zooming out (`MOBILE_CAMERA_ZOOM`, see [CORE.md](CORE.md)) that meant the joysticks shrank and slid toward the middle of the screen while the raw DOM touch listeners, which read real client pixels, kept reading the old positions. The layer applies the exact inverse transform (`scale = 1/zoom`, `pos = c * (1 - 1/zoom)`, `c` = half the camera width), so a child authored at `(x, y)` renders at screen pixel `(x, y)`. Phaser walks the same parent-matrix chain when hit-testing, so pointer input follows for free.

**Users:** `TouchControlManager` (all controls, depth 500) and `MainScene` (death message, depth 10000).

**Gotchas:**
- Containers render children in insertion order and do **not** sort by depth. Add back to front.
- Children must keep their own `setScrollFactor(0)`; a stray `1` reintroduces the camera scroll the layer exists to cancel.
- The layer re-pins itself on `resize`, but a bare zoom change needs a manual `sync()`. `MainScene.applyCameraZoom()` does this for both layers, in order, right after `setZoom`.
