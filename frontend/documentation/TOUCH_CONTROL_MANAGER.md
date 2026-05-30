# TouchControlManager

**File:** `frontend/src/game/systems/TouchControlManager.ts`

Provides a full mobile touch interface layered on top of the Phaser canvas. Only activates on devices that match the mobile user-agent string.

---

## Layout

On mobile, the following controls are rendered as fixed-position Phaser game objects (`setScrollFactor(0)` so they don't move with the camera):

| Control | Position | Purpose |
|---------|----------|---------|
| Left joystick | Bottom-left | Movement |
| Right joystick | Bottom-right | Aiming + shooting |
| DASH button | Above joysticks (center-left) | Triggers `player.dash()` |
| SHIELD button | Above joysticks (center-right) | Triggers `player.activateShield()` |
| Pause button | Top-center | Emits `game-pause` |

Layout adapts to screen aspect ratio: "tall" screens (portrait phones) move ability buttons above the joysticks; "short" screens (landscape phones) place them between the joystick pairs.

Positions are recalculated on every `resize` event from `this.scene.scale`.

---

## VirtualJoystick (inner class)

Each joystick uses raw DOM `touchstart`, `touchmove`, `touchend`, `touchcancel` events rather than Phaser pointer events. This ensures the coordinate space always matches `canvas.getBoundingClientRect()`, avoiding offset bugs from CSS scaling or the lack of `autoCenter`.

**`clientToGame(clientX, clientY)`**  
Converts a DOM client coordinate to game-space: `(clientX − rect.left) × (gameWidth / rect.width)`. This is the key to correct touch-to-game alignment.

**`getForce()`**  
Returns `{ x, y, magnitude, angle }` where x/y are normalized (−1 to 1) and magnitude is the total joystick deflection (0 = center, 1 = edge). Used by `updateJoystickInput()` to drive player movement and aiming.

The right joystick triggers shooting when `magnitude > 0.5`, giving a deadzone so accidental nudges don't fire.

---

## update()

Called every frame by `MainScene.update()`:

1. Updates both joystick instances.
2. Reads left joystick force → calls `player.move(fx, fy)`.
3. Reads right joystick force → calls `player.rotateTowards()` and `player.shoot()` if magnitude exceeds 0.5.
4. Sets DASH button visibility based on `UpgradeEffectSystem.hasAbility('dash')`.
5. Sets SHIELD button visibility based on `UpgradeEffectSystem.getEffectValue('shield') > 0`.

---

## isMobile() / isTouchingJoystick()

`MainScene.update()` uses these to suppress keyboard and mouse shooting when on mobile or when a joystick is active, preventing input conflicts.

---

## destroy()

Removes all DOM event listeners and destroys all Phaser game objects. Called on scene shutdown.

---

## TouchButton (inner class)

A simple rectangular Phaser button with a text label. Supports `pointerdown`, `pointerup`, and `pointerout` events for visual press feedback (alpha 0.6 when pressed). `setVisible()` and `reposition()` are used by `TouchControlManager` to show/hide and reposition buttons on orientation change.
