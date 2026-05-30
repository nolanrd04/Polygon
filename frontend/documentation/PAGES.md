# Pages

Pages live in `frontend/src/pages/` and are standard React components registered as routes in the app router. Each page is a full-screen view.

---

## MainMenu

**File:** `MainMenu.tsx`

The entry point for authenticated and unauthenticated users alike. On mount it checks `localStorage` for a JWT token; if one is present it calls `GET /api/saves/full` to determine save state.

**Displayed states:**

| Condition | What the user sees |
|-----------|--------------------|
| Logged in, active save | `CONTINUE GAME` button (shows current wave) + `NEW GAME` |
| Logged in, save is game-over | Run-ended stats panel (wave, points, kills) + `NEW GAME` |
| Logged in, no save | `PLAY` button |
| Not logged in | `PLAY OFFLINE`, `LOAD FROM SAVE`, `LOGIN` buttons |

**Key behaviors:**
- `NEW GAME` calls `DELETE /api/saves/` to wipe the existing backend save before navigating to `AttackSelectPage`.
- `CONTINUE GAME` sets `sessionStorage.loadSavedGame = 'true'` then navigates to `/game`. `GamePage` reads this flag and calls `SaveManager.loadFullGame()`.
- `PLAY OFFLINE` sets `sessionStorage.playOffline = 'true'` and `sessionStorage.selectedAttack = 'bullet'` then navigates directly to `/game`, bypassing attack selection.
- `LOAD FROM SAVE` opens a `LoadGameModal` for the copy-paste sandbox save flow.

---

## AttackSelectPage

**File:** `AttackSelectPage.tsx`

Lets the player choose their starting weapon before a new game. Displays all five attack types as selectable cards. Each card shows an icon, name, and description.

**Attack types:** `bullet`, `laser`, `zapper`, `flamer`, `spinner`.

Currently only `bullet` is implemented and selectable; the others display "COMING SOON" and are disabled.

On confirm, stores `sessionStorage.selectedAttack = <type>` and navigates to `/game`. `MainScene` reads this value when spawning the `Player`.

---

## GamePage

**File:** `GamePage.tsx`

The container for the running game session. Manages:

- **Phaser lifecycle** – instantiates `new Game(gameConfig)` inside a `<div>` ref on mount; destroys it on unmount.
- **Save/load flow** – reads `sessionStorage` flags (`loadSavedGame`, `loadLocalSave`, `playOffline`) to restore state before the Phaser game starts.
- **React overlays** – renders `GameHUD`, `AbilityDisplay`, `PauseMenu`, `WaveComplete`, `UpgradeModal`, and `DevTools` on top of the canvas.
- **EventBus bridge** – subscribes to all game events (`wave-start`, `wave-complete`, `show-upgrades`, `player-stats-update`, `game-pause`, `game-resume`, `player-death`) and updates React state accordingly.
- **Save on death** – listens for `player-death` and calls `SaveManager.saveOnDeath()` exactly once per session (guarded by a ref).
- **Save on quit** – calls `SaveManager.saveOnQuit()` on component unmount and on the `beforeunload` DOM event.
- **ESC key** – handled at the DOM level (not Phaser level) so that pause/resume works even while the Phaser scene itself is paused.
- **Ability polling** – emits `request-ability-state` every 100 ms and receives `ability-state-update` from the scene to drive the `AbilityDisplay` cooldown bar.

---

## LoginPage

**File:** `LoginPage.tsx`

Standard username + password form. Posts credentials to the backend auth endpoint, stores the returned JWT in `localStorage.token`, then redirects to `MainMenu`.

---

## RegisterPage

**File:** `RegisterPage.tsx`

Registration form with username, password, and confirm-password fields. Performs real-time username availability checks against the backend. On success, redirects to `LoginPage`.

---

## SettingsPage

**File:** `SettingsPage.tsx`

In-game settings persisted to `localStorage.gameSettings`. Exposes toggles for:
- Show enemy health bars (`showEnemyHealthBar`)
- Show enemy health numbers (`showEnemyHealthNumber`)
- Volume controls

`GameConfig.DEV_SETTINGS` reads from this same `localStorage` key so settings take effect immediately on next scene load.
