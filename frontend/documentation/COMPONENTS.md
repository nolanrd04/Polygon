# Components

React overlay components that render on top of the Phaser canvas. They receive data from `GamePage` via props and interact with the game through `EventBus` or direct `GameManager` calls.

All components live in `frontend/src/components/`.

---

## GameHUD

**File:** `GameHUD.tsx`

Always-visible heads-up display. Shows:
- **Health bar** – filled rectangle scaled to `health / maxHealth`, color shifts red as health drops.
- **Wave counter** – current wave number.
- **Points** – current currency (used to buy upgrades).
- **Kill count** – total enemies killed this session.

Props: `health`, `maxHealth`, `points`, `kills`, `wave`.

Also exports **`hudBlockBottom()`** — the bottom edge of this HUD in CSS pixels, the taller of the health block (left) and the wave/points block (right), halved on mobile where both are `scale(0.5)`. The mobile ability pads hang off the joysticks and grow upward, so they need to know where this ends. The unscaled block heights are constants at the top of the file, beside the markup they describe.

---

## PerfOverlay

**File:** `PerfOverlay.tsx`

On-screen performance readout, parked top-right under the wave block. Three modes: `off`, `basic` (Settings › Show FPS), `full` (Show Diagnostics, or `?perf=1`). Separate from `DevTools` because it has to stay legible *while* playing, and that panel covers the screen on mobile. See [LIGHTING.md](LIGHTING.md) for what the timings mean.

Also exports **`perfOverlayBottom()`** — its bottom edge in CSS pixels, or `0` when it is not rendered. Height depends on the mode (row and divider counts are constants beside the JSX). The mobile ability pads use it the same way they use `hudBlockBottom()`: this readout sits exactly where the upper-right pads want to go.

---

## AbilityDisplay

**File:** `AbilityDisplay.tsx`

The player's owned on-demand abilities (shield, dash, heal, …). Fully data-driven — it knows no ability by name. Two presentations:

- **Desktop** — a passive card per ability, stacked top-left. Key chip, name, progress bar or charge pips, count.
- **Mobile** — **these are the ability buttons.** One square 65px pad per ability, positioned by `abilityPadPosition()` (see **TouchLayout** in [CORE.md](CORE.md)) so it lands exactly where the old on-canvas ability button sat, above the joysticks. Tapping emits `activate-ability`; `MainScene` turns that into `AbilitySystem.activate(id)`.

The mobile pad carries the same state the desktop card does, minus the key chip — keyboard-only information, and in 65px the room is better spent on the name. Cooldown reads twice over: a scrim wiping down the pad, and the progress bar under the label. A pad with no charge ready is `disabled` and dimmed, so a dead tap looks dead rather than merely failing silently.

There used to be a separate on-canvas button stack drawn alongside these cards, duplicating every field and forcing the two to be laid out around each other. See [TOUCH_CONTROL_MANAGER.md](TOUCH_CONTROL_MANAGER.md).

The container is `pointer-events-none` so bare space still passes touches through to the canvas — the joysticks read raw DOM events on it — and each pad re-enables pointer events for itself.

On mobile the pads must stay clear of the top HUD, which they would otherwise climb into on a short screen. The ceiling is the max of `hudBlockBottom()` (exported by `GameHUD` — health block on the left, wave/points on the right) and `perfOverlayBottom()` (exported by `PerfOverlay`, 0 when the FPS readout is off), plus clearance. Each component reports its own extent so no file has to guess at another's Tailwind. What the stack then does with that ceiling — compress, slide, clamp — is in **TouchLayout** in [CORE.md](CORE.md). The ceiling is captured once per mount, since the FPS readout does not appear or disappear mid-run.

**Props:** `{ slots: AbilitySlotState[], bindingCount: number }`. `GamePage` polls `request-ability-state` every 100 ms and stores the `ability-state-update` payload, which `MainScene` fills from `AbilitySystem.getSlots()` (owned abilities only, in `slot` order) plus `getBindings().length`. `bindingCount` covers every registered ability, owned or not — the pads sit in fixed slots, so the layout depends on the full count rather than on what is owned yet.

Each `AbilitySlotState` carries `{ id, label, keyLabel, theme, ready, max, progress, recharges, index }`:

- `recharges: true` (dash, heal) → progress bar plus an `x{n}` ready count.
- `recharges: false` (shield) → one pip per remaining charge.
- `theme` indexes a local `THEMES` table (`cyan`, `blue`, `rose`, `green`, …) supplying border/chip/text/bar/pip classes. A *recharging* ability sitting at full charges switches to the `green` theme regardless of its declared theme.
- `index` is the position among **all** registered bindings, not among the owned ones — it is what pins each mobile pad to a fixed slot for the run.

> **Tailwind:** the class strings in `THEMES` are spelled out literally rather than interpolated. Tailwind only keeps classes it can see in source, so building them from the theme name would silently drop the styles at build time. Adding a theme means adding a full literal entry.

The component renders nothing while `slots` is empty, so abilities appear only once owned. See [ABILITY_SYSTEM.md](ABILITY_SYSTEM.md).

---

## UpgradeModal

**File:** `UpgradeModal.tsx`

Post-wave upgrade selection screen. Fetches the offered upgrades for the current wave from `WaveValidationService.getOfferedUpgrades()`, displays three cards, and lets the player purchase one.

- Shows upgrade name, description, rarity badge, and cost.
- Grays out upgrades the player cannot afford.
- Includes a **Reroll** button (cost increases each reroll) that calls `waveValidation.rerollUpgrades()`.
- **Start Wave** button emits `start-next-wave` via `EventBus`, advancing to the next wave.
- Includes a **View Upgrades** button to open `ViewUpgrades`.

Props: `onStartWave`, `playerPoints`, `selectedAttack`.

---

## WaveComplete

**File:** `WaveComplete.tsx`

Splash screen shown briefly when a wave ends. Displays the wave number and points earned from the wave bonus. Automatically transitions to `UpgradeModal` when the player clicks continue.

Props: `wave`, `score`, `isPrime`, `onContinue`.

---

## PauseMenu

**File:** `PauseMenu.tsx`

Overlay shown when the game is paused (ESC key or mobile pause button). Provides:
- **Resume** – calls `GameManager.resume()`.
- **Quit** – calls `SaveManager.saveOnQuit()` then navigates to `MainMenu`.
- **Settings** shortcut.

Props: `onResume`, `onQuit`.

---

## SaveGameModal

**File:** `SaveGameModal.tsx`

Sandbox/offline save export modal. Calls `exportLocalSave()` from `LocalSaveManager` to serialize the current game state to a JSON string, then displays it in a text area for the player to copy. Shows a short summary line (`summarizeLocalSave()`) in the header.

---

## LoadGameModal

**File:** `LoadGameModal.tsx`

Sandbox/offline save import modal. Accepts a pasted JSON string, validates it with `importLocalSave()`, then calls `applyLocalSave()` to restore the game state in memory. Sets `sessionStorage.loadLocalSave = 'true'` and navigates to `/game`.

---

## DevTools

**File:** `DevTools.tsx`

Developer console, toggled by a hidden button. Provides:
- Toggle collision box visualization (emits `toggle-collision-boxes`).
- Spawn specific enemy types (emits `dev-spawn-enemy`).
- Apply any upgrade by ID for free (emits `dev-apply-upgrade`).
- Remove / decrement upgrades (emits `dev-remove-upgrade`).
- Jump to a specific wave (emits `set-wave`).

Props: `onToggleCollisionBoxes`, `showCollisionBoxes`.

**Mobile:** the panel used to `return null` on mobile outright, which made the touch ability buttons untestable without granting abilities the slow way. It now renders there too, repacked: the launcher sits **bottom-centre**, in the gap between the two joysticks (bottom-right, the desktop spot, is directly under the aim stick), and the open panel goes full-bleed since its 420px fixed width is wider than a phone viewport. Both branches key off `IS_MOBILE` — see [CORE.md](CORE.md) for the `?mobile=1` override.

Because `AbilitySystem` binds from the upgrade *registry* rather than from what the player owns, `TouchControlManager` already built a button for every ability at scene create and just toggles visibility. So an ability applied from this panel mid-run surfaces its touch button immediately, with no rebind.

---

## ViewUpgrades

**File:** `ViewUpgrades.tsx`

Read-only panel listing all upgrades the player currently has applied. Displays the upgrade name, description, rarity, and stack count. Opened from within `UpgradeModal`.
