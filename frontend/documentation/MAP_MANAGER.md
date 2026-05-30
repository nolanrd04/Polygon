# MapManager

**File:** `frontend/src/game/systems/MapManager.ts`

Generates and renders the static game world: obstacles and the background grid. The world is seeded for reproducibility across sessions.

---

## Constructor

```ts
new MapManager(scene, seed?)
```

Creates the obstacle Phaser group. If no seed is provided, uses `Date.now()`.

---

## `generateMap(biome?)`

Called once in `MainScene.create()`. Clears any existing map and generates a new one.

**Steps:**
1. Initializes a seeded pseudo-random function (`Math.sin(s) × 10000` — the fractional part).
2. Reads biome config (default biome has 60 obstacles, size 40, color `0x333344`).
3. Places obstacles one at a time:
   - Picks a random position inside world bounds.
   - Rejects positions within 150 px of world center (safe spawn zone) or overlapping existing obstacles.
   - Selects a random polygon shape (3–6 sides).
   - Randomizes radius within `obstacleSize × [0.5, 1.0]`.
   - Calculates `hitboxSize` via linear interpolation (same formula as the player: 0.65 for triangles → 1.0 for octagons).
4. Draws each obstacle using Phaser `Graphics` (polygon outline + fill).
5. Adds an invisible static circle physics body at the obstacle center for collision.
6. Draws the background: solid fill + a 50 px grid at 30% opacity.

---

## Biomes

| Biome | Obstacles | Size | Color | Background |
|-------|-----------|------|-------|------------|
| `default` | 60 | 40 | `0x333344` (dark blue-gray) | `0x0a0a0f` / grid `0x1a1a2f` |
| `void` | 20 | 35 | `0x220033` (dark purple) | `0x050508` / grid `0x110022` |
| `neon` | 12 | 45 | `0x002244` (dark teal) | `0x000510` / grid `0x003355` |

Only the `default` biome is used in the current implementation.

---

## Methods

| Method | Description |
|--------|-------------|
| `generateMap(biome?)` | Full map generation (described above) |
| `getObstacles()` | Returns the Phaser group (used by `CollisionManager`) |
| `getObstacleData()` | Returns raw `Obstacle[]` array with position, radius, sides, color |
| `setSeed(seed)` | Updates the seed (used by save/load to restore map) |
| `clear()` | Destroys all obstacle game objects and resets the data array |

---

## Notes

Obstacles are drawn with `Phaser.GameObjects.Graphics` (not sprites), which is acceptable because they are drawn only once at map generation, not every frame. The invisible static physics circles are separate game objects added to the same group so `CollisionManager` can detect collisions against them.
