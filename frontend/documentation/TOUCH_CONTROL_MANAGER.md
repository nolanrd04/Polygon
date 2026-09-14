# TouchControlManager

**File:** `frontend/src/game/systems/TouchControlManager.ts`

Provides a full mobile touch interface layered on top of the Phaser canvas. Only activates when `IS_MOBILE` (see [CORE.md](CORE.md) — `?mobile=1` forces it on for desktop testing).

---

## Screen-space layer

Every control lives on a [`ScreenSpaceLayer`](UTILS.md) at depth 500, so all the layout below is authored in plain **screen pixels** and stays that size no matter how far the mobile camera is zoomed out.

`setScrollFactor(0)` alone would not do it: it defeats camera *scroll*, but not camera *zoom*. Once the camera pulls back for mobile, pinned objects shrink and slide toward the middle of the screen — while `clientToGame()` below, which reads real DOM client pixels, carries no camera terms at all. The layer is what keeps those two coordinate spaces in agreement.

Two consequences for anything added here:
- The layer's container renders children in **insertion order** and does not sort by depth, so attach objects back to front (`attachTo()` on `VirtualJoystick` handles its own ordering).
- Children still need their own `setScrollFactor(0)`.

---

## Layout

On mobile, the following controls are rendered as fixed-position Phaser game objects:

| Control | Position | Purpose |
|---------|----------|---------|
| Left joystick | Bottom-left | Movement |
| Right joystick | Bottom-right | Aiming + shooting |
| Pause button | Top-center | Emits `game-pause` |

Positions are recalculated on every `resize` event from `this.scene.scale`.

### Abilities are not here

Ability activation is a **DOM** control: the square pads rendered by `AbilityDisplay.tsx`, which on mobile is both the readout and the button. Tapping one emits `activate-ability`, which `MainScene` turns into `AbilitySystem.activate(id)`.

This file used to draw a second, parallel set of on-canvas ability buttons. They repeated everything the DOM cards already showed — name, colour, cooldown, charges — differing only in the key label, which means nothing without a keyboard. Worse, the two then had to be laid out around each other, which is what a whole apparatus of stack compression and clamping existed to manage. One control does both jobs now and that apparatus is gone.

The pads still sit exactly where those buttons did, because the geometry they are positioned from is shared, not copied — see **TouchLayout** in [CORE.md](CORE.md). `TouchControlManager`'s own joystick and pause constants read from the same `TOUCH_LAYOUT` object, so tuning a joystick pad moves the ability pads with it.

---

## VirtualJoystick (inner class)

Each joystick uses raw DOM `touchstart`, `touchmove`, `touchend`, `touchcancel` events rather than Phaser pointer events. This ensures the coordinate space always matches `canvas.getBoundingClientRect()`, avoiding offset bugs from CSS scaling or the lack of `autoCenter`.

**`clientToGame(clientX, clientY)`**  
Converts a DOM client coordinate to screen-pixel game space: `(clientX − rect.left) × (gameWidth / rect.width)`. This is the key to correct touch-to-game alignment. It carries **no camera terms**, which is exactly why the circles have to sit on the screen-space layer described above.

**`getForce()`**  
Returns `{ x, y, magnitude, angle }` where x/y are normalized (−1 to 1) and magnitude is the total joystick deflection (0 = center, 1 = edge). Used by `updateJoystickInput()` to drive player movement and aiming.

The right joystick triggers shooting when `magnitude > 0.5`, giving a deadzone so accidental nudges don't fire.

---

## update()

Called every frame by `MainScene.update()`:

1. Updates both joystick instances.
2. Reads left joystick force → calls `player.move(fx, fy)`.
3. Reads right joystick force → calls `player.rotateTowards()` and `player.shoot()` if magnitude exceeds 0.5.

---

## isMobile() / isTouchingJoystick()

`MainScene.update()` uses these to suppress keyboard and mouse shooting when on mobile or when a joystick is active, preventing input conflicts.

---

## syncToCamera()

Re-pins the screen-space layer after a camera zoom change. The layer already handles `resize` itself; this covers zoom changes that arrive without one. Called by `MainScene.applyCameraZoom()`.

---

## destroy()

Removes all DOM event listeners, destroys all Phaser game objects, and tears down the screen-space layer. Called on scene shutdown.

