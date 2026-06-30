# Graph Report - .  (2026-06-29)

## Corpus Check
- 187 files · ~93,752 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1242 nodes · 2385 edges · 92 communities (50 shown, 42 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 311 edges (avg confidence: 0.59)
- Token cost: 8,800 input · 3,400 output

## Community Hubs (Navigation)
- [[_COMMUNITY_React UI Components|React UI Components]]
- [[_COMMUNITY_Backend Runs API|Backend Runs API]]
- [[_COMMUNITY_Backend Waves & Saves API|Backend Waves & Saves API]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Backend Save System|Backend Save System]]
- [[_COMMUNITY_Anti-Cheat & Upgrade Data|Anti-Cheat & Upgrade Data]]
- [[_COMMUNITY_Touch Controls|Touch Controls]]
- [[_COMMUNITY_Enemy Types & Manager (Docs)|Enemy Types & Manager (Docs)]]
- [[_COMMUNITY_Run Data Models|Run Data Models]]
- [[_COMMUNITY_Player Entity|Player Entity]]
- [[_COMMUNITY_Backend Infrastructure|Backend Infrastructure]]
- [[_COMMUNITY_Game Config & Entry|Game Config & Entry]]
- [[_COMMUNITY_Enemy Entity Code|Enemy Entity Code]]
- [[_COMMUNITY_Difficulty & Enemy Spawning|Difficulty & Enemy Spawning]]
- [[_COMMUNITY_Game HUD & Upgrade UI|Game HUD & Upgrade UI]]
- [[_COMMUNITY_Projectile Entity Core|Projectile Entity Core]]
- [[_COMMUNITY_Game Manager|Game Manager]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Backend Repositories|Backend Repositories]]
- [[_COMMUNITY_Trail Renderer & Upgrade Bundles|Trail Renderer & Upgrade Bundles]]
- [[_COMMUNITY_Event Bus|Event Bus]]
- [[_COMMUNITY_Enemy Abilities & Dev Settings|Enemy Abilities & Dev Settings]]
- [[_COMMUNITY_Backend Base Models|Backend Base Models]]
- [[_COMMUNITY_Audio Registry|Audio Registry]]
- [[_COMMUNITY_Special Enemies & Enemy Projectiles|Special Enemies & Enemy Projectiles]]
- [[_COMMUNITY_Upgrade Effect System|Upgrade Effect System]]
- [[_COMMUNITY_Upgrade System|Upgrade System]]
- [[_COMMUNITY_Auth API|Auth API]]
- [[_COMMUNITY_Main Scene|Main Scene]]
- [[_COMMUNITY_Difficulty & Rarity System|Difficulty & Rarity System]]
- [[_COMMUNITY_Map Manager|Map Manager]]
- [[_COMMUNITY_Database Connection|Database Connection]]
- [[_COMMUNITY_User Repository|User Repository]]
- [[_COMMUNITY_User Service|User Service]]
- [[_COMMUNITY_Dev Tools|Dev Tools]]
- [[_COMMUNITY_Dropped Upgrade Bundle|Dropped Upgrade Bundle]]
- [[_COMMUNITY_Enemy Ability Base|Enemy Ability Base]]
- [[_COMMUNITY_Wave Validation Service|Wave Validation Service]]
- [[_COMMUNITY_Backend Security|Backend Security]]
- [[_COMMUNITY_Upgrade Data Core|Upgrade Data Core]]
- [[_COMMUNITY_View Upgrades UI|View Upgrades UI]]
- [[_COMMUNITY_Upgrade Modifier System|Upgrade Modifier System]]
- [[_COMMUNITY_Enemy Data Core|Enemy Data Core]]
- [[_COMMUNITY_Dodecahedron Boss|Dodecahedron Boss]]
- [[_COMMUNITY_Supertriangle Enemy|Supertriangle Enemy]]
- [[_COMMUNITY_Bullet Explosion|Bullet Explosion]]
- [[_COMMUNITY_Shield Ability|Shield Ability]]
- [[_COMMUNITY_Enemy Types Index|Enemy Types Index]]
- [[_COMMUNITY_Hexagon Enemy|Hexagon Enemy]]
- [[_COMMUNITY_Projectile Manager|Projectile Manager]]
- [[_COMMUNITY_TypeScript Node Config|TypeScript Node Config]]
- [[_COMMUNITY_Acid Explosion Projectile|Acid Explosion Projectile]]
- [[_COMMUNITY_Player Stats Repository|Player Stats Repository]]
- [[_COMMUNITY_Diamond Enemy|Diamond Enemy]]
- [[_COMMUNITY_Homing Bullet|Homing Bullet]]
- [[_COMMUNITY_Backend Settings|Backend Settings]]
- [[_COMMUNITY_MongoDB Base Model|MongoDB Base Model]]
- [[_COMMUNITY_Game Save Repository|Game Save Repository]]
- [[_COMMUNITY_Game Event Bus|Game Event Bus]]
- [[_COMMUNITY_Dash Ability|Dash Ability]]
- [[_COMMUNITY_Shoot Ability|Shoot Ability]]
- [[_COMMUNITY_Vercel Deployment|Vercel Deployment]]
- [[_COMMUNITY_Ability Display UI|Ability Display UI]]
- [[_COMMUNITY_Octagon Enemy|Octagon Enemy]]
- [[_COMMUNITY_Acid Bullet|Acid Bullet]]
- [[_COMMUNITY_Wave Service|Wave Service]]
- [[_COMMUNITY_Dodecahedron Bullet|Dodecahedron Bullet]]
- [[_COMMUNITY_Mobile Touch Planning|Mobile Touch Planning]]
- [[_COMMUNITY_Users API|Users API]]
- [[_COMMUNITY_User Model|User Model]]
- [[_COMMUNITY_Auth Service|Auth Service]]
- [[_COMMUNITY_Backend Startup|Backend Startup]]
- [[_COMMUNITY_Particle Entity|Particle Entity]]
- [[_COMMUNITY_Game Config Docs|Game Config Docs]]
- [[_COMMUNITY_Explode Ability Docs|Explode Ability Docs]]
- [[_COMMUNITY_Split Ability Docs|Split Ability Docs]]
- [[_COMMUNITY_Login Page Docs|Login Page Docs]]
- [[_COMMUNITY_Register Page Docs|Register Page Docs]]
- [[_COMMUNITY_Settings Page Docs|Settings Page Docs]]
- [[_COMMUNITY_Polygon README|Polygon README]]
- [[_COMMUNITY_Frontend Index HTML|Frontend Index HTML]]
- [[_COMMUNITY_Removed Upgrades|Removed Upgrades]]
- [[_COMMUNITY_App Startup Docs|App Startup Docs]]

## God Nodes (most connected - your core abstractions)
1. `Projectile` - 63 edges
2. `Enemy` - 62 edges
3. `User` - 51 edges
4. `Player` - 48 edges
5. `BaseMongoModel` - 34 edges
6. `WaveService` - 34 edges
7. `RunService` - 33 edges
8. `GameSaveRepository` - 32 edges
9. `PyObjectId` - 31 edges
10. `PlayerStatsRepository` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Anti-Cheat Wave Validation System (Integration)` --semantically_similar_to--> `Wave Validation Anti-Cheat Flow`  [INFERRED] [semantically similar]
  INTEGRATION_COMPLETE.md → backend/ANTI_CHEAT_SYSTEM.md
- `Mobile Controls Plan` --semantically_similar_to--> `Touch Controls Integration Guide`  [INFERRED] [semantically similar]
  plans/mobile.txt → frontend/src/game/systems/TOUCH_INTEGRATION_GUIDE.md
- `Manual Save 1 Game State` --shares_data_with--> `UpgradeSystem Coordinator Singleton`  [INFERRED]
  manual_saves/save1.txt → frontend/documentation/UPGRADE_MANAGER.md
- `Config` --uses--> `BaseMongoModel`  [INFERRED]
  backend/app/models/user.py → backend/app/models/base.py
- `Anti-Cheat Wave Validation System (Integration)` --references--> `UpgradeModal Component`  [EXTRACTED]
  INTEGRATION_COMPLETE.md → frontend/documentation/COMPONENTS.md

## Import Cycles
- 1-file cycle: `frontend/src/config/axios.ts -> frontend/src/config/axios.ts`
- 2-file cycle: `frontend/src/game/core/GameManager.ts -> frontend/src/game/services/WaveValidation.ts -> frontend/src/game/core/GameManager.ts`
- 3-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/core/GameConfig.ts`
- 3-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/EnemyManager.ts -> frontend/src/game/core/GameConfig.ts`
- 3-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/MapManager.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Bullet.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Flame.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Laser.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Spinner.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Zapper.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/entities/enemies/Enemy.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/systems/EnemyManager.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/EnemyManager.ts -> frontend/src/game/entities/enemies/Enemy.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/TouchControlManager.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/core/GameConfig.ts`
- 4-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/WaveManager.ts -> frontend/src/game/systems/EnemyManager.ts -> frontend/src/game/core/GameConfig.ts`
- 5-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Bullet.ts -> frontend/src/game/core/GameConfig.ts`
- 5-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Flame.ts -> frontend/src/game/core/GameConfig.ts`
- 5-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Laser.ts -> frontend/src/game/core/GameConfig.ts`
- 5-file cycle: `frontend/src/game/core/GameConfig.ts -> frontend/src/game/scenes/MainScene.ts -> frontend/src/game/systems/CollisionManager.ts -> frontend/src/game/entities/Player.ts -> frontend/src/game/entities/projectiles/player_projectiles/Spinner.ts -> frontend/src/game/core/GameConfig.ts`

## Hyperedges (group relationships)
- **Anti-Cheat Wave Validation Pipeline** — integration_complete_wave_token, integration_complete_flagged_wave, frontend_documentation_backend_connection_wavevalidationservice, frontend_documentation_collision_manager_collisionmanager, frontend_documentation_core_eventbus [EXTRACTED 1.00]
- **Bundle Drop and Pickup Flow** — upgradebundleplan_dropped_upgrade_bundle, upgradebundleplan_dropped_bundle_manager, frontend_documentation_collision_manager_collisionmanager, frontend_documentation_core_eventbus, upgradebundleplan_bundle_pickup_notification [EXTRACTED 1.00]
- **Difficulty-Agnostic Rarity Rolling System** — upgradebundleplan_difficultymanager, frontend_documentation_difficulty_difficulty_interface, frontend_documentation_difficulty_normal_difficulty, frontend_documentation_backend_connection_wavevalidationservice [EXTRACTED 0.95]
- **Core Game Loop Systems** — frontend_documentation_scenes_mainscene, frontend_documentation_enemy_manager_enemymanager, frontend_documentation_systems_wavemanager, frontend_documentation_systems_collisionmanager [EXTRACTED 0.95]
- **Entities Implementing Three-Hook Rendering Pipeline** — frontend_documentation_enemy_enemy, frontend_documentation_player_player, frontend_documentation_projectile_projectile [EXTRACTED 0.95]
- **Persistence and Wave Validation System** — frontend_documentation_services_savemanager, frontend_documentation_services_wavevalidation, frontend_documentation_services_localsavemanager [INFERRED 0.85]
- **Four-Part Upgrade System Architecture** — frontend_documentation_upgrade_manager_upgradesystem, frontend_documentation_upgrade_manager_upgrademodifiersystem, frontend_documentation_upgrade_manager_upgradeeffectsystem, frontend_documentation_upgrade_manager_effecthandlers [EXTRACTED 1.00]
- **Bundle Drop, Rarity, and Collection-Time Selection Pipeline** — frontend_documentation_upgrade_bundle_droppedbundle, frontend_documentation_upgrade_bundle_bundlerarity, frontend_documentation_upgrade_bundle_collectiontimeselection [EXTRACTED 1.00]
- **Mobile Controls Plan and Implementation Triad** — plans_mobile, frontend_src_game_systems_touch_integration_guide, frontend_src_game_systems_touch_integration_guide_touchcontrolmanager [INFERRED 0.85]

## Communities (92 total, 42 thin omitted)

### Community 0 - "React UI Components"
Cohesion: 0.07
Nodes (29): LoadGameModalProps, PauseMenuProps, SaveGameModal(), SaveGameModalProps, applyLocalSave(), buildFullSaveFromCurrentState(), exportLocalSave(), importLocalSave() (+21 more)

### Community 1 - "Backend Runs API"
Cohesion: 0.09
Nodes (44): add_upgrade(), AddUpgradeRequest, delete_run(), end_run(), EndRunRequest, get_active_run(), get_run_status(), AsyncIOMotorDatabase (+36 more)

### Community 2 - "Backend Waves & Saves API"
Cohesion: 0.09
Nodes (37): delete_save(), Delete the game save for the current user, complete_wave(), EnemyDeath, FrameSample, AsyncIOMotorDatabase, Submit wave completion data for validation.      This endpoint performs comprehe, Apply a selected upgrade to the player.      Validates that:     - Upgrade was a (+29 more)

### Community 3 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (34): dependencies, axios, phaser, react, react-dom, react-icons, react-router-dom, devDependencies (+26 more)

### Community 4 - "Backend Save System"
Cohesion: 0.13
Nodes (39): DeathStateSaveRequest, GameStatsSaveRequest, load_full_game(), PointsSaveRequest, AsyncIOMotorDatabase, Validate that the user's save can be loaded (not marked as game over), Save current points.     ALWAYS ALLOWED - even after death (points persist for u, Save upgrade purchase history.     ALWAYS ALLOWED - even after death (upgrades p (+31 more)

### Community 5 - "Anti-Cheat & Upgrade Data"
Cohesion: 0.09
Nodes (26): get_rarity_weights(), FlaggedWave, FlagReason, Flagged wave submission for admin review, Individual flag reason with severity and details, GameSave, Check if player can continue this save (not dead), Game save model for storing current run progress - one save per user.     This i (+18 more)

### Community 6 - "Touch Controls"
Cohesion: 0.08
Nodes (3): TouchButton, TouchControlManager, VirtualJoystick

### Community 7 - "Enemy Types & Manager (Docs)"
Cohesion: 0.08
Nodes (39): DashAbility (Enemy Ability), Diamond Enemy, Dodecahedron Boss Enemy, Enemy Base Class, EnemyManager, ShootAbility (Enemy Ability), Phaser Container Entity Pattern, Three-Hook Rendering Pipeline (tModLoader-Style) (+31 more)

### Community 8 - "Run Data Models"
Cohesion: 0.09
Nodes (22): Progress data - core game state, Accumulated statistics over the run, Single run document per user. Immutable after death.      Invariants:     - wave, Run, RunProgress, RunStats, ObjectId, Find any run for user (active or dead) (+14 more)

### Community 10 - "Backend Infrastructure"
Cohesion: 0.09
Nodes (32): Wave Validation Anti-Cheat Flow, MongoDB Service (Docker), Wave Validation Implementation Guide, FastAPI Framework, python-jose JWT Library, Motor Async MongoDB Driver, Uvicorn Dev Server Startup, SaveManager (+24 more)

### Community 11 - "Game Config & Entry"
Cohesion: 0.15
Nodes (7): COLORS, Bullet, HeavyBullet, Flame, Laser, Spinner, Zapper

### Community 12 - "Enemy Entity Code"
Cohesion: 0.10
Nodes (4): Enemy, Pentagon, Square, Triangle

### Community 13 - "Difficulty & Enemy Spawning"
Cohesion: 0.08
Nodes (3): Difficulty, EnemyManager, WaveManager

### Community 14 - "Game HUD & Upgrade UI"
Cohesion: 0.11
Nodes (18): GameHUD(), GameHUDProps, isMobile, isMobile, rarityColors, rarityTextColors, Upgrade, UpgradeModalProps (+10 more)

### Community 17 - "TypeScript Config"
Cohesion: 0.08
Nodes (24): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution (+16 more)

### Community 18 - "Backend Repositories"
Cohesion: 0.13
Nodes (14): BaseRepository, Any, AsyncIOMotorDatabase, ObjectId, Base repository providing common CRUD operations for MongoDB collections, Create a new document, Find a document by ID, Find a single document matching the filter (+6 more)

### Community 19 - "Trail Renderer & Upgrade Bundles"
Cohesion: 0.14
Nodes (23): TrailRenderer Documentation, GPU-Accelerated Sprite Trail Pattern, Upgrade Bundle System Documentation, BundleRarity Enum, Item Selection at Collection Time Design, Curse Upgrade Pool, DroppedUpgradeBundle In-World Pickup Entity, Upgrade Manager Documentation (+15 more)

### Community 20 - "Event Bus"
Cohesion: 0.22
Nodes (12): EventBus, EventCallback, GameEvents, PlayerStatsPayload, EnemyRegistry, Obstacle, registerEffectHandlers(), EffectHandler (+4 more)

### Community 21 - "Enemy Abilities & Dev Settings"
Cohesion: 0.23
Nodes (13): DEV_SETTINGS, AbilityConfig, DashConfig, DEFAULT_DASH_CONFIG, DEFAULT_EXPLODE_CONFIG, ExplodeConfig, AbilityType, DEFAULT_SHIELD_CONFIG (+5 more)

### Community 22 - "Backend Base Models"
Cohesion: 0.12
Nodes (15): Config, PyObjectId, Custom ObjectId type for Pydantic, Config, Config, PlayerStats, PlayerStatsResponse, Player statistics response model (+7 more)

### Community 23 - "Audio Registry"
Cohesion: 0.13
Nodes (10): AUDIO_REGISTRY, AudioDefinition, defaultVolumeByKey, getDefaultVolume(), pauseBackgroundMusic(), playBackgroundMusic(), preloadAllAudio(), resumeBackgroundMusic() (+2 more)

### Community 27 - "Auth API"
Cohesion: 0.24
Nodes (15): check_username_availability(), login(), AsyncIOMotorDatabase, Login with username and password, Check if a username is available (for real-time validation), register(), Token, UserLoginRequest (+7 more)

### Community 29 - "Difficulty & Rarity System"
Cohesion: 0.14
Nodes (11): EnemySpawnWeight, Rarity, RarityWeights, BUNDLE_RARITY_WEIGHTS_BY_WAVE, ENEMY_COUNTS, FALLBACK_BUNDLE_RARITY_WEIGHTS, FALLBACK_RARITY_WEIGHTS, FALLBACK_WEIGHTS (+3 more)

### Community 31 - "Database Connection"
Cohesion: 0.15
Nodes (9): close_mongo_connection(), connect_to_mongo(), get_database(), MongoDB, AsyncIOMotorDatabase, Connect to MongoDB on application startup, Close MongoDB connection on application shutdown, Get MongoDB database instance (+1 more)

### Community 32 - "User Repository"
Cohesion: 0.15
Nodes (7): AsyncIOMotorDatabase, Find a user by username (case-insensitive), Check if a username already exists (case-insensitive), Create indexes for the users collection, Repository for User collection with user-specific queries, UserRepository, AsyncIOMotorDatabase

### Community 33 - "User Service"
Cohesion: 0.21
Nodes (6): AsyncIOMotorDatabase, ObjectId, PlayerStats, Service for user-related business logic, Get player stats for a user, UserService

### Community 34 - "Dev Tools"
Cohesion: 0.23
Nodes (7): DevToolsProps, isMobile, ATTACK_INFO, AttackType, ATTACK_COLORS, ATTACK_ICONS, ATTACK_SELECTED_COLORS

### Community 35 - "Dropped Upgrade Bundle"
Cohesion: 0.21
Nodes (4): BundleRarity, DroppedUpgradeBundle, Layer, RARITY_COLORS

### Community 36 - "Enemy Ability Base"
Cohesion: 0.17
Nodes (3): Ability, ExplodeAbility, SplitAbility

### Community 38 - "Backend Security"
Cohesion: 0.22
Nodes (8): create_access_token(), get_current_user(), get_password_hash(), AsyncIOMotorDatabase, verify_password(), Register a new user and create their player stats, Authenticate user and return access token, timedelta

### Community 39 - "Upgrade Data Core"
Cohesion: 0.24
Nodes (10): can_apply_upgrade(), get_upgrade(), get_upgrades_by_rarity(), Any, Upgrade definitions for backend upgrade rolling and validation. This matches the, Get upgrade definition by ID, Get all upgrades of a specific rarity, Check if an upgrade can be applied given current upgrades.      Args:         up (+2 more)

### Community 40 - "View Upgrades UI"
Cohesion: 0.20
Nodes (9): ALL_UPGRADES, buildGroups(), formatValue(), rarityBorder, rarityRank, rarityText, UpgradeDef, UpgradeGroup (+1 more)

### Community 42 - "Enemy Data Core"
Cohesion: 0.24
Nodes (9): calculate_minimum_damage_required(), get_enemy_health(), get_wave_multiplier(), Enemy health and spawn data for wave validation.  This data matches the frontend, Validate that an enemy type can spawn on a given wave.     Based on the frontend, Calculate wave multiplier for enemy stats.     Matches frontend EnemyManager.ts:, Calculate enemy health for a given wave.      Args:         enemy_type: Type of, Calculate minimum damage required to clear a wave.      Args:         wave: Wave (+1 more)

### Community 47 - "Enemy Types Index"
Cohesion: 0.25
Nodes (4): ENEMY_TYPES, EnemyType, getEnemyRegistry(), SuperSquare

### Community 50 - "TypeScript Node Config"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 52 - "Player Stats Repository"
Cohesion: 0.33
Nodes (4): ObjectId, PlayerStats, Find player stats by user ID, Get top players by highest wave

### Community 55 - "Backend Settings"
Cohesion: 0.50
Nodes (4): Config, get_settings(), Settings, BaseSettings

### Community 56 - "MongoDB Base Model"
Cohesion: 0.40
Nodes (3): Any, Convert model to dictionary for MongoDB insertion, Create model instance from MongoDB document

### Community 57 - "Game Save Repository"
Cohesion: 0.40
Nodes (3): ObjectId, Find the game save for a user (one save per user), Delete the game save for a user

### Community 61 - "Vercel Deployment"
Cohesion: 0.40
Nodes (4): buildCommand, framework, installCommand, outputDirectory

### Community 67 - "Mobile Touch Planning"
Cohesion: 0.67
Nodes (3): Touch Controls Integration Guide, TouchControlManager Mobile Input System, Mobile Controls Plan

## Knowledge Gaps
- **155 isolated node(s):** `Config`, `MongoDB`, `Config`, `start.sh script`, `name` (+150 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Projectile` connect `Projectile Entity Core` to `Acid Bullet`, `Dodecahedron Bullet`, `Player Entity`, `Game Config & Entry`, `Supertriangle Enemy`, `Bullet Explosion`, `Game HUD & Upgrade UI`, `Difficulty & Enemy Spawning`, `Game Manager`, `Acid Explosion Projectile`, `Event Bus`, `Homing Bullet`, `Special Enemies & Enemy Projectiles`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `Enemy` connect `Enemy Entity Code` to `Enemy Ability Base`, `Dodecahedron Boss`, `Supertriangle Enemy`, `Game Config & Entry`, `Shield Ability`, `Enemy Types Index`, `Hexagon Enemy`, `Difficulty & Enemy Spawning`, `Event Bus`, `Enemy Abilities & Dev Settings`, `Diamond Enemy`, `Special Enemies & Enemy Projectiles`, `Dash Ability`, `Shoot Ability`, `Octagon Enemy`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `TouchControlManager` connect `Touch Controls` to `Player Entity`, `Event Bus`, `Main Scene`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `User` (e.g. with `AddUpgradeRequest` and `EndRunRequest`) actually correct?**
  _`User` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Login with username and password`, `Check if a username is available (for real-time validation)`, `Run API Routes - Endpoints for the canonical run save system.  Each user has at` to the rest of the system?**
  _292 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06662770309760374 - nodes in this community are weakly interconnected._
- **Should `Backend Runs API` be split into smaller, more focused modules?**
  _Cohesion score 0.08549019607843138 - nodes in this community are weakly interconnected._