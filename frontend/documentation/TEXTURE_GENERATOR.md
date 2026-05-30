# TextureGenerator

**File:** `frontend/src/game/utils/TextureGenerator.ts`

A static utility class that generates Phaser textures on demand and caches them for reuse across all entities in the scene.

---

## How it works

1. A caller requests a texture by passing a set of visual parameters (shape, radius, colors, stroke, glow).
2. `TextureGenerator` constructs a deterministic cache key from the parameters.
3. If the texture already exists in `scene.textures`, the key is returned immediately.
4. Otherwise, a temporary `Phaser.GameObjects.Graphics` object draws the shape onto a `RenderTexture` at `4×` resolution (`TEXTURE_SCALE = 4`).
5. The `RenderTexture` calls `saveTexture(key)` to persist it to the scene's texture manager.
6. Both the `Graphics` and `RenderTexture` objects are destroyed — only the GPU texture remains.
7. The caller creates a `Sprite` referencing the key and calls `setScale(TextureGenerator.getDisplayScale())` to display it at the correct `1×` size.

---

## Resolution scaling

All textures are generated at 4× the requested radius. Sprites are then displayed at `1/4` scale (`getDisplayScale() = 0.25`). This prevents pixelation on high-DPI displays and allows smooth rotation without aliasing artifacts. The key uses the original (un-scaled) radius so the cache is consistent across calls.

---

## Methods

### `getOrCreateCircle(scene, options)`

Generates a circle texture.

| Option | Default | Description |
|--------|---------|-------------|
| `radius` | required | Circle radius in pixels |
| `fillColor` | `0xffffff` | Fill color |
| `fillAlpha` | `1.0` | Fill opacity |
| `strokeWidth` | `0` | Stroke width (0 = no stroke) |
| `strokeColor` | `0xffffff` | Stroke color |
| `strokeAlpha` | `1.0` | Stroke opacity |
| `glowRadius` | `0` | Outer glow radius (0 = no glow) |
| `glowAlpha` | `0.3` | Glow opacity |

When `glowRadius > 0`, a slightly larger semi-transparent circle is drawn first, then the main circle on top, creating a soft glow effect with no extra draw calls at runtime.

Returns the texture key string.

---

### `getOrCreatePolygon(scene, options)`

Generates a regular polygon texture.

| Option | Default | Description |
|--------|---------|-------------|
| `sides` | required | Number of sides |
| `radius` | required | Circumradius in pixels |
| `fillColor` | `0xffffff` | Fill color |
| `fillAlpha` | `1.0` | Fill opacity |
| `strokeWidth` | `0` | Stroke width |
| `strokeColor` | `0xffffff` | Stroke color |
| `strokeAlpha` | `1.0` | Stroke opacity |
| `rotation` | `-Math.PI/2` | Initial vertex rotation offset (default points upward) |

Vertices are calculated from `angleStep × i + rotation`, then drawn as a filled path. Returns the texture key string.

---

### `getOrCreateDiamond(scene, options)`

Generates a rhombus (diamond) texture. Uses four hardcoded vertices: top, right, bottom, left. Width is controlled by `horizontalScale` (default `0.6`), making it taller than wide.

Used exclusively by the `Diamond` enemy type.

---

### `getCircleTextureWithScale(scene, desiredRadius, options?)`

Returns `{ key, scale }` — smart sizing helper. Checks if the desired radius is within 20% of a pre-defined common size (`[5, 10, 20, 40, 80]`). If so, returns the nearest common size with a scale adjustment instead of generating a new texture. This reduces the total number of cached textures for projectiles that come in many sizes.

---

### `getPolygonTextureKey(sides, isPlayer?)`

Returns the key that would be used for a polygon of the given side count. Useful for referencing textures by name without calling the full generation pipeline.

---

### `generateCommonTextures(scene)`

Called once in `MainScene.create()`. Pre-generates:
- Polygon textures (sides 3–20) with gray fill and white stroke.
- Outline-only polygon textures (for Super enemy variants).
- Common projectile circle sizes (`[5, 8, 10, 15, 20, 40]`).
- Diamond shapes (solid + outline).
- Semi-transparent explosion circle.

Pre-generation ensures these textures are available immediately when the first entity spawns, avoiding any one-frame hitches.

---

## Cache key format

### Circle
```
circle_{radius}_f{fillColorHex}_{fillAlpha}_s{strokeWidth}_{strokeColorHex}_{strokeAlpha}_g{glowRadius}_{glowAlpha}
```

### Polygon
```
poly_{sides}_{radius}_f{fillColorHex}_{fillAlpha}_s{strokeWidth}_{strokeColorHex}_{strokeAlpha}_r{rotation}
```

### Diamond
```
diamond_{radius}_f{fillColorHex}_{fillAlpha}_s{strokeWidth}_{strokeColorHex}_{strokeAlpha}_h{horizontalScale}
```
