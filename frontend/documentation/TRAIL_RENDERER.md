# TrailRenderer

**File:** `frontend/src/game/utils/TrailRenderer.ts`

A static utility class that creates motion trail effects using GPU-accelerated sprite instances instead of per-frame Graphics redraws.

---

## How it works

Entities that want a trail opt in by setting `doOldPositionTracking = true` and configuring `oldTrackingCounter` (number of history positions) and `oldTrackingInterval` (ms between samples). The `Enemy._update()` and `Projectile._update()` loops maintain ring buffers (`oldPositionX[]`, `oldPositionY[]`) at this interval.

In `PostDraw()`, the entity calls `TrailRenderer.renderTrail()` with those position arrays. For each historical position:

1. A new `Phaser.GameObjects.Sprite` is created at that position.
2. It is tinted with `tint`, given an alpha proportional to its position in the array (newest = more opaque).
3. Its depth is set to -1 (renders behind the main entity).
4. A Phaser `tween` is started that fades `alpha` to 0 over `duration` ms, then calls `sprite.destroy()`.

Once the tween completes, the sprite is gone. No per-frame bookkeeping is needed after spawn.

---

## `renderTrail(scene, options)`

Creates trail sprites for an array of positions.

| Option | Default | Description |
|--------|---------|-------------|
| `positions` | required | Array of `{ x, y }` positions, oldest first |
| `rotations?` | — | Optional array of rotation angles per position |
| `textureKey` | required | Phaser texture key for trail sprites |
| `tint` | required | Color tint |
| `maxAlpha` | `0.3` | Alpha of the newest (most opaque) sprite |
| `duration` | `200` | Fade-out duration in ms |
| `scale` | `1.0` | Scale multiplier |
| `scaleDecay` | `true` | Whether to also shrink sprites as they fade |
| `minScale` | `0.3` | Final scale when `scaleDecay = true` |

Alpha is distributed linearly: oldest position gets `(1/n) × maxAlpha`, newest gets `maxAlpha`.

The display scale from `TextureGenerator.getDisplayScale()` (0.25) is applied on top of the `scale` option to account for high-resolution textures.

---

## `addTrailSprite(scene, x, y, textureKey, tint, alpha, scale, duration)`

Convenience method to add a single trail sprite at an arbitrary position. Useful for entities that want to add one trail sprite per frame rather than batch-processing a history array.

---

## Usage example

```ts
// In an enemy subclass:
SetDefaults(): void {
  this.doOldPositionTracking = true
  this.oldTrackingCounter = 8      // Keep 8 historical positions
  this.oldTrackingInterval = 50    // Sample every 50ms
}

PostDraw(): void {
  if (this.oldPositionX.length > 0) {
    const textureKey = TextureGenerator.getOrCreateCircle(this.scene, {
      radius: this.radius * 0.8,
      fillColor: 0xffffff,
      fillAlpha: 1.0
    })
    TrailRenderer.renderTrail(this.scene, {
      positions: this.oldPositionX.map((x, i) => ({ x, y: this.oldPositionY[i] })),
      textureKey,
      tint: this.color,
      maxAlpha: 0.25,
      duration: 300
    })
  }
}
```

---

## Performance notes

- Each call to `renderTrail` creates `positions.length` Phaser Sprite objects and starts `positions.length` tweens.
- Tweens are handled by the GPU-accelerated Phaser tween manager — no per-frame JavaScript cost after spawn.
- Keep `oldTrackingCounter` low (4–10) for entities that appear in large numbers. High history counts on many simultaneous enemies can accumulate many live sprites.
