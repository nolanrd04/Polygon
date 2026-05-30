# Frontend Documentation

Polygon is a top-down wave survival game built with **React** (UI/pages) and **Phaser 3** (game engine). The two layers share state through a typed `EventBus` and a central `GameManager` singleton.

## Architecture overview

```
React (pages + components)
    ↕  EventBus / GameManager refs
Phaser (MainScene + systems + entities)
    ↕  HTTP (Axios)
Backend API  (see BACKEND_CONNECTION.md)
```

- **Pages** own routing and top-level layout.
- **Components** are React overlays drawn on top of the Phaser canvas — health bars, upgrade screens, pause menus, etc.
- **Core** provides the singleton state store (`GameManager`), typed event bus, config constants, and audio registry.
- **Scenes** are Phaser `Scene` classes. `BootScene` loads assets; `MainScene` runs the game loop.
- **Entities** are in-game objects (Player, Enemy, Projectile, Particle, DroppedUpgradeBundle).
- **Systems** are stateless or lightly-stateful managers called by `MainScene` each frame (EnemyManager, CollisionManager, WaveManager, etc.).
- **Services** handle persistence: saves to the backend, wave validation, and the local/sandbox copy-paste system.
- **Utils** provide performance helpers: on-demand texture caching and a sprite-based trail renderer.

## Sub-documents

| File | Contents |
|------|----------|
| [PAGES.md](PAGES.md) | React page components and routing |
| [COMPONENTS.md](COMPONENTS.md) | React overlay components (HUD, modals, menus) |
| [CORE.md](CORE.md) | GameManager, EventBus, GameConfig, AudioRegistry |
| [DATA.md](DATA.md) | Upgrade JSON definitions and attack types |
| [ENTITIES.md](ENTITIES.md) | Overview of all in-game entities |
| [PLAYER.md](PLAYER.md) | Player class – fields, methods, abilities |
| [ENEMY.md](ENEMY.md) | Enemy base class and all enemy types |
| [PROJECTILE.md](PROJECTILE.md) | Projectile base class and all projectile types |
| [PARTICLE.md](PARTICLE.md) | Particle system (stub – not yet implemented) |
| [UPGRADE_BUNDLE.md](UPGRADE_BUNDLE.md) | DroppedUpgradeBundle (stub – not yet implemented) |
| [SCENES.md](SCENES.md) | BootScene and MainScene |
| [SERVICES.md](SERVICES.md) | SaveManager, WaveValidation, LocalSaveManager, SaveTypes |
| [SYSTEMS.md](SYSTEMS.md) | System overview and inter-system relationships |
| [COLLISION_MANAGER.md](COLLISION_MANAGER.md) | CollisionManager in detail |
| [ENEMY_MANAGER.md](ENEMY_MANAGER.md) | EnemyManager in detail |
| [MAP_MANAGER.md](MAP_MANAGER.md) | MapManager in detail |
| [PROJECTILE_MANAGER.md](PROJECTILE_MANAGER.md) | ProjectileManager (legacy) |
| [TOUCH_CONTROL_MANAGER.md](TOUCH_CONTROL_MANAGER.md) | Mobile touch input |
| [WAVE_MANAGER.md](WAVE_MANAGER.md) | WaveManager in detail |
| [DIFFICULTY.md](DIFFICULTY.md) | Difficulty interface and Normal implementation |
| [UPGRADE_MANAGER.md](UPGRADE_MANAGER.md) | UpgradeSystem, UpgradeEffectSystem, UpgradeModifierSystem, EffectHandlers |
| [UTILS.md](UTILS.md) | TextureGenerator and TrailRenderer overview |
| [TEXTURE_GENERATOR.md](TEXTURE_GENERATOR.md) | On-demand texture caching in detail |
| [TRAIL_RENDERER.md](TRAIL_RENDERER.md) | Sprite-based trail rendering in detail |
| [BACKEND_CONNECTION.md](BACKEND_CONNECTION.md) | How the frontend communicates with the backend |
| [OFFLINE_MODE.md](OFFLINE_MODE.md) | Sandbox / offline mode |
| [ONLINE_MODE.md](ONLINE_MODE.md) | Online data validation and saving |
