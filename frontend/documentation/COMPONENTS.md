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

---

## AbilityDisplay

**File:** `AbilityDisplay.tsx`

Shows the status of the two player abilities: shield and dash.

- **Shield** – displays the number of remaining charges.
- **Dash** – shows a cooldown progress bar. When `maxDashCharges > 1` (double/triple dash upgrades), shows multiple charge pips with queue-based recharge progress (`dashQueueProgress`).

Props: `shieldCharges`, `hasDash`, `dashCooldownProgress`, `maxDashCharges`, `dashQueueProgress`, `readyDashCharges`.

Hidden entirely until the corresponding ability upgrade is purchased.

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

---

## ViewUpgrades

**File:** `ViewUpgrades.tsx`

Read-only panel listing all upgrades the player currently has applied. Displays the upgrade name, description, rarity, and stack count. Opened from within `UpgradeModal`.
