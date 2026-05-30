# Systems

Systems live in `frontend/src/game/systems/`. They are classes instantiated once in `MainScene.create()` and updated each frame by `MainScene.update()`. Unlike entities, systems are not game objects — they manage groups of entities and coordinate cross-entity logic.

---

## System overview

| System | File | Role |
|--------|------|------|
| [CollisionManager](COLLISION_MANAGER.md) | `CollisionManager.ts` | Registers all Phaser overlap/collider callbacks; handles damage, knockback, pierce, and effects |
| [EnemyManager](ENEMY_MANAGER.md) | `EnemyManager.ts` | Spawns, updates, and removes enemies; manages enemy projectiles; applies wave scaling |
| [MapManager](MAP_MANAGER.md) | `MapManager.ts` | Generates the seeded obstacle layout and background grid |
| [ProjectileManager](PROJECTILE_MANAGER.md) | `ProjectileManager.ts` | Legacy — mostly unused; Player now manages its own projectiles directly |
| [TouchControlManager](TOUCH_CONTROL_MANAGER.md) | `TouchControlManager.ts` | Virtual joysticks and ability buttons for mobile input |
| [WaveManager](WAVE_MANAGER.md) | `WaveManager.ts` | Drives wave start/end flow; schedules enemy spawning; delegates difficulty to the `Difficulty` interface |
| [Upgrade systems](UPGRADE_MANAGER.md) | `upgrades/` | UpgradeSystem, UpgradeEffectSystem, UpgradeModifierSystem, EffectHandlers |

---

## How systems interact

```
MainScene.update()
    │
    ├── TouchControlManager.update()
    │       └── calls player.move(), player.rotateTowards(), player.shoot(), player.dash(), player.activateShield()
    │
    ├── UpgradeEffectSystem.onUpdate(delta)
    │       └── fires onUpdate handlers (e.g. regeneration heals GameManager)
    │
    ├── player.update()
    │       └── ticks owned projectiles, updates spinner/flame position
    │
    ├── enemyManager.update(playerX, playerY)
    │       └── ticks each enemy._update(), ticks enemy projectiles
    │
    └── waveManager.isWaveComplete() → waveManager.completeWave()
            └── waveValidation.completeWave() (backend submit)
            └── GameManager.completeWave() (points, backend save, pre-load next upgrades)
            └── currentWave++

CollisionManager (event-driven, registered in create())
    ├── player projectile ↔ enemy → handleProjectileEnemyCollision()
    │       → UpgradeEffectSystem.onProjectileHit() (lifesteal, etc.)
    │       → enemy.takeDamage()
    │       → GameManager.addKill() / addPoints()
    │       → UpgradeEffectSystem.onEnemyKill() (explode-on-kill, etc.)
    │       → projectile._recordHit() (pierce management)
    │       → enemy.applyKnockback()
    │
    ├── enemy projectile ↔ player → handleEnemyProjectilePlayerCollision()
    │       → player.takeDamage()
    │
    ├── player ↔ enemy → handlePlayerEnemyCollision()
    │       → player.takeDamage()
    │       → UpgradeEffectSystem thorns check
    │
    └── projectile ↔ obstacle → processProjectileObstacleCollision()
            → ricochet if effect active, else projectile._destroy()

EventBus (shared by all systems and React)
    ├── game-pause/resume → MainScene pauses/resumes
    ├── wave-complete → React shows WaveComplete modal
    ├── show-upgrades → React shows UpgradeModal
    ├── upgrade-selected → MainScene.applyUpgrade()
    ├── player-death → MainScene shows death text; GamePage saves death state
    ├── player-stats-update → GamePage updates HUD
    ├── enemy-explode → MainScene draws explosion + deals AOE
    └── evolution-milestone → MainScene applies polygon_upgrade
```

### Key dependencies

- `WaveManager` depends on `EnemyManager` (to spawn enemies and check active count).
- `CollisionManager` depends on both `Player` and `EnemyManager` (to get Phaser groups).
- `EnemyManager` depends on `WaveManager` indirectly (wave number drives scaling).
- All systems read upgrade state from `UpgradeSystem` / `UpgradeEffectSystem` / `UpgradeModifierSystem`.
- All systems communicate state changes via `EventBus` and `GameManager`.
