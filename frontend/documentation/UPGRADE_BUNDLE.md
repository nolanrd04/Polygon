# DroppedUpgradeBundle

**File:** `frontend/src/game/entities/upgrades/DroppedUpgradeBundle.ts`

> **Not yet implemented.** The file exists as a placeholder with no content.

The intent is for enemies to drop collectible upgrade bundles when killed — a physical in-world item the player walks over to collect an upgrade without going through the post-wave upgrade modal. This system is not wired into `EnemyManager`, `CollisionManager`, or any game loop as of the current implementation.

When implemented, it will likely extend `Phaser.GameObjects.Container`, carry one or more upgrade IDs, and be consumed by player overlap.
