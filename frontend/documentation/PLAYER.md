# Player

**File:** `frontend/src/game/entities/Player.ts`  
**Extends:** `Phaser.GameObjects.Container`

The player character. Rendered as a polygon whose number of sides grows with the `polygon_upgrade` evolution milestone. Controlled via keyboard (WASD/arrows) or the left virtual joystick on mobile.

---

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `sides` | `number` | Current polygon side count (starts at 3, increases with evolution) |
| `radius` | `number` | Visual radius in pixels (fixed at 25) |
| `attackType` | `AttackType` | Which projectile class to spawn on shoot |
| `hitboxSize` | `number` (getter) | Circular collision radius as a fraction of `radius`. Scales linearly from 0.65 (3 sides) to 1.0 (8+ sides) |
| `positionX` / `positionY` | `number` | World-space position, synced from physics body each frame |
| `body` | `Phaser.Physics.Arcade.Body` | Arcade physics body used for movement and collision |

### Private fields

| Field | Description |
|-------|-------------|
| `sprite` | Main polygon sprite |
| `headIndicator` | Small white circle at the front vertex, shows facing direction |
| `projectiles` | Array of active projectiles owned by this player |
| `projectileGroup` | Phaser `Group` of projectile containers (used by `CollisionManager`) |
| `lastFireTime` | Timestamp of last shot for cooldown enforcement |
| `activeSpinner` | Reference to the currently active `Spinner` projectile (only one allowed at a time) |
| `activeFlame` | Reference to the currently active `Flame` projectile (continuous beam) |
| `shielded` | Whether the shield ability is currently active |
| `shieldSprite` | Cyan semi-transparent circle rendered when shield is active |
| `isDashing` / `dashEndTime` | Dash state tracking |
| `dashSpeed` | Base dash speed (500 px/s) |
| `dashDuration` | How long each dash lasts (200 ms) |
| `dashCooldown` | Base cooldown between dash charges (1500 ms) |
| `maxDashCharges` | Number of available dash charges (1 base, up to 3 with upgrades) |
| `dashChargeReadyTimes` | Array of timestamps when each charge becomes available |
| `dashChargeRechargeStartTimes` | Array of timestamps when each charge started recharging (for progress calculation) |
| `lastChargeReadyTime` | Latest ready time across all charges; used to queue sequential recharges |

---

## Methods

### Drawing

| Method | Description |
|--------|-------------|
| `Draw()` | Checks if `polygonSides` changed; if so, regenerates the polygon sprite via `TextureGenerator` and updates the circular hitbox. |
| `DrawWithColor(color)` | Temporarily swaps to a flash-color texture (red on damage). Restored after 100 ms. |
| `updatePolygon()` | Public wrapper for `Draw()` + hitbox update. Called when side count changes. |

### Movement

| Method | Description |
|--------|-------------|
| `move(vx, vy)` | Sets physics velocity. Input values are normalized so diagonal movement isn't faster. Speed is read from `GameManager.getPlayerStats().speed`. |
| `rotateTowards(x, y)` | Rotates the container to face a world-space point (mouse or right joystick). |

### Shooting

| Method | Description |
|--------|-------------|
| `shoot(targetX, targetY)` | Checks cooldown, then spawns projectiles from every polygon vertex, each pointing in the direction that vertex faces. Multishot from upgrades spawns multiple projectiles per vertex with spread. |
| `spawnProjectile(sx, sy, tx, ty)` | Selects the correct class (`Bullet` / variant, `Laser`, `Zapper`, `Flame`, `Spinner`), instantiates it, applies upgrade modifiers, then calls `scene.spawnProjectile()`. |
| `getBulletVariantClass()` | Reads active variant from `UpgradeSystem.getVariant('bullet')` and returns the corresponding class. |
| `applyUpgradeModifiers(projectile)` | Applies additive + multiplicative modifiers from `UpgradeModifierSystem` to `damage`, `speed`, `size`, `pierce`, and `timeLeft`. Global `attack` damage modifiers are applied on top of attack-specific ones. |
| `getCooldown()` | Returns fire cooldown per attack type: bullet 300 ms, laser 300 ms, zapper 400 ms, flamer 50 ms, spinner 1000 ms. |

### Damage & Abilities

| Method | Description |
|--------|-------------|
| `takeDamage(amount)` | No-ops if shielded. Otherwise passes damage through `UpgradeEffectSystem.onPlayerDamage()` (armor reduction), records it for wave validation, triggers a red flash, and calls `GameManager.takeDamage()`. |
| `activateShield()` | Consumes one shield charge from `UpgradeEffectSystem`, sets `shielded = true`, renders the shield sprite, and schedules `deactivateShield()` after 3 seconds. |
| `dash()` | Checks for the `dash` ability via `UpgradeEffectSystem.hasAbility('dash')` and that a charge is available. Uses current velocity direction (or facing angle if stationary). Charges recharge sequentially — the second charge begins recharging only after the first finishes. |
| `getDashCooldownProgress()` | Returns 0–1 progress for the earliest still-recharging charge (1 = ready). |
| `getDashQueueProgress()` | Returns 0–1 progress for the next charge in queue (used for the multi-charge visual bar). |
| `getReadyDashCharges()` | Count of charges whose ready time has already passed. |
| `setMaxDashCharges(n)` | Called by `MainScene` when double_dash / triple_dash upgrades are applied. Resets all charge timers to ready. |

### Lifecycle

| Method | Description |
|--------|-------------|
| `update()` | Called every frame by `MainScene`. Syncs position, updates dash state, updates spinner position, and ticks/cleans up all owned projectiles. |
| `clearProjectiles()` | Destroys all active projectiles. Called at wave end via the `clear-projectiles` scene event. |
| `getProjectiles()` | Returns the current projectile array. |
| `addProjectile(p)` | Registers an externally-spawned projectile for update tracking. |
| `getProjectileGroup()` | Returns the Phaser Group used by `CollisionManager` for overlap detection. |
