# Mobile Touch Controls Integration Guide

This guide shows how to integrate the `TouchControlManager` and `PauseMenu` into your existing Phaser game.

## Installation Steps

### 1. Update MainScene.ts

Add these imports at the top:

```typescript
import { TouchControlManager } from './TouchControlManager'
import { PauseMenu } from '../ui/PauseMenu'
```

### 2. Add Properties to MainScene

In the `MainScene` class, add:

```typescript
export class MainScene extends Phaser.Scene {
  player!: Player
  enemyManager!: EnemyManager
  waveManager!: WaveManager
  collisionManager!: CollisionManager
  mapManager!: MapManager

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>
  
  // ADD THESE:
  private touchControls!: TouchControlManager
  private pauseMenu!: PauseMenu
  private isPausedByUI: boolean = false

  // ... rest of existing properties
}
```

### 3. Initialize in create()

In your `create()` method, after initializing the player and other managers, add:

```typescript
create(): void {
  // ... existing initialization code ...

  // Initialize touch controls (handles mobile input automatically)
  this.touchControls = new TouchControlManager(this, this.player)

  // Initialize pause menu
  this.pauseMenu = new PauseMenu(this, () => this.resumeGame())

  // Set up keyboard pause shortcut (ESC key)
  this.input.keyboard!.on('keydown-ESC', () => this.togglePause())
}
```

### 4. Update the update() Method

In your `update()` method, call the touch control update:

```typescript
update(): void {
  // Existing update code...

  // Update touch controls
  if (this.touchControls) {
    this.touchControls.update()
  }
}
```

### 5. Add Pause/Resume Methods

Add these methods to your MainScene class:

```typescript
private togglePause(): void {
  if (this.isPausedByUI) {
    this.resumeGame()
  } else {
    this.pauseGame()
  }
}

private pauseGame(): void {
  this.isPausedByUI = true
  this.pauseMenu.show()
  this.scene.pause()
}

private resumeGame(): void {
  this.isPausedByUI = false
  this.pauseMenu.hide()
  this.scene.resume()
}
```

### 6. Cleanup in shutdown()

Add a shutdown handler to clean up:

```typescript
constructor() {
  super({ key: 'MainScene' })
  this.events.on('shutdown', () => {
    if (this.touchControls) {
      this.touchControls.destroy()
    }
    if (this.pauseMenu) {
      this.pauseMenu.destroy()
    }
  })
}
```

## How It Works

### Left Joystick (Bottom-Left)
- **Position**: Bottom-left corner (100px from edges)
- **Function**: Controls player movement
- **Input**: Returns velocity vector normalized to -1 to 1 in each axis
- **Integration**: Automatically calls `player.move(forceX, forceY)` each frame

### Right Joystick (Bottom-Right)
- **Position**: Bottom-right corner (100px from edges)
- **Function**: Controls rotation and shooting
- **Logic**:
  - Any input rotates the player toward the joystick direction
  - If joystick is pushed into the **outer ring** (magnitude > 0.5), the player shoots
  - If joystick is in the **inner circle** (magnitude ≤ 0.5), only rotation happens
- **Integration**: Automatically calls:
  - `player.rotateTowards(targetX, targetY)`
  - `player.shoot(targetX, targetY)` when in outer ring

### Ability Buttons
- **Dash Button** (Green): Calls `player.dash()`
- **Shield Button** (Cyan): Calls `player.activateShield()`
- **Position**: Right side, above the right joystick
- **Feedback**: Button dims when pressed

### Pause Button
- **Position**: Top-right corner
- **Function**: Pauses game and shows menu
- **Behavior**: Pause menu can be dismissed by:
  - Tapping the RESUME button
  - Pressing ESC key
  - Tapping the pause button again

## Customization

### Change Joystick Size

In `TouchControlManager.createJoysticks()`:

```typescript
const joystickRadius = 80        // Outer radius in pixels
const joystickInnerRadius = 40   // Inner circle radius in pixels
```

### Change Button Positions

Ability buttons are no longer drawn on the canvas. They are DOM pads rendered by
`components/AbilityDisplay.tsx`, positioned by `abilityPadPosition()` in
`core/TouchLayout.ts`. Tune them there:

```typescript
// core/TouchLayout.ts
abilityButtonSize: 65,     // Pad width/height
abilitySidePad: 25,        // Distance from the screen edge
abilityStackOffset: 250,   // Gap above the joysticks
abilityStackGap: 15,       // Gap between stacked pairs
```

`TOUCH_LAYOUT` also holds the joystick and pause-button geometry that
`TouchControlManager` reads, so the canvas controls and the DOM pads stay in
agreement when you move either.

### Change Colors

Each component has a color parameter (in hex):

```typescript
// Left joystick color (blue)
0x3366ff

// Right joystick color (orange)
0xff6633

// Pause button (dark blue)
0x222266
```

Ability pad colours come from each ability's `activation.theme`, resolved through
the `THEMES` table in `components/AbilityDisplay.tsx`.

### Add More Ability Buttons

Nothing to do here. Ability pads are generated from every upgrade def that
declares an `activation` block, in `slot` order — add the ability and its pad
appears, on both desktop (as a card) and mobile (as a tappable pad). See
`documentation/ABILITY_SYSTEM.md`.

## Desktop/Keyboard Controls

Keyboard and mouse controls continue to work unchanged:

```typescript
// In your existing update() or input handling:
if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
  this.player.move(-1, 0)
}
if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
  this.player.move(1, 0)
}
// ... etc

// Mouse rotation still works (if you have it)
// Mouse shooting still works (if you have it)
```

The touch controls and keyboard controls are completely independent and can coexist.

## Responsive Design

The touch controls automatically adapt to screen size:

- Joystick positions are relative to viewport dimensions
- Button positions scale with screen width/height
- All touch targets are appropriately sized for fingers (minimum 50px)

To further customize responsiveness, modify the geometry in `core/TouchLayout.ts`, which both `createJoysticks()` and the DOM ability pads read from:

```typescript
const { width, height } = this.scene.scale

// Position elements relative to viewport
const leftJoystickX = width * 0.1  // 10% from left
const rightJoystickX = width * 0.9 // 90% from left
```

## Advanced: Detecting Mobile

The `TouchControlManager` automatically detects mobile devices:

```typescript
private detectMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}
```

Controls only initialize on mobile. For testing on desktop, you can force mobile mode:

```typescript
// In TouchControlManager constructor, temporarily override:
this.isMobileDevice = true  // Force mobile controls on desktop for testing
```

## Performance Notes

- Each joystick uses 3 graphics objects (outer circle, inner circle, knob)
- Each ability button uses 2 objects (rectangle, text)
- Total: ~12 graphics objects for full UI
- Touch input is throttled to Phaser's input update cycle (automatic)
- No external dependencies required (pure Phaser)

## Testing Checklist

- [ ] Joysticks appear and respond to touch
- [ ] Left joystick controls movement smoothly
- [ ] Right joystick rotates player in all directions
- [ ] Outer ring of right joystick triggers shooting
- [ ] Ability buttons can be tapped and trigger actions
- [ ] Pause button opens menu overlay
- [ ] Resume button and ESC key close menu
- [ ] Game properly pauses (enemies stop moving, projectiles freeze)
- [ ] Keyboard controls still work on desktop
- [ ] Touch UI is positioned correctly on different screen sizes