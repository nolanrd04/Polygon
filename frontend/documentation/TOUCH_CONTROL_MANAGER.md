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
| Ability buttons | Alternating sides, above/beside the joysticks | One per `AbilitySystem` binding — calls `AbilitySystem.activate(id)` |
| Pause button | Top-center | Emits `game-pause` |

### Ability buttons

There are no hardcoded DASH/SHIELD buttons. `createAbilityButtons()` maps over `AbilitySystem.getBindings()` (every def with an `activation` block, in `slot` order) and builds one `TouchButton` per binding, taking its label and fill from `activation.label` / `activation.buttonColor`. Adding an ability adds a button with no edit here — see [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md).

`abilityButtonPosition(index)` is index-driven: **even indices go left, odd right**, and each further pair steps inward from the edge (tall screens stack upward, short screens spread outward). Index 0 and 1 land exactly where the original hardcoded shield/dash pair sat.

Layout adapts to screen aspect ratio: "tall" screens (`H > 500` — portrait phones and tablets) put ability buttons above the joysticks; "short" screens (landscape phones) place them beside the pause button.

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
4. Sets each ability button's visibility from `AbilitySystem.isAvailable(id)` — owned, and (for consumable abilities like shield) still holding charges.

---

## isMobile() / isTouchingJoystick()

`MainScene.update()` uses these to suppress keyboard and mouse shooting when on mobile or when a joystick is active, preventing input conflicts.

---

## destroy()

Removes all DOM event listeners and destroys all Phaser game objects. Called on scene shutdown.

---

## TouchButton (inner class)

A simple rectangular Phaser button with a text label. Supports `pointerdown`, `pointerup`, and `pointerout` events for visual press feedback (alpha 0.6 when pressed). `setVisible()` and `reposition()` are used by `TouchControlManager` to show/hide and reposition buttons on orientation change.
