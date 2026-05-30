# Difficulty

**Interface:** `frontend/src/game/systems/difficulty/Difficulty.ts`  
**Implementation:** `frontend/src/game/systems/difficulty/Normal.ts`

---

## The `Difficulty` interface

A `Difficulty` object is the single source of truth for all wave-pacing data. `WaveManager` delegates to it for every wave-dependent decision.

```ts
interface Difficulty {
  readonly id: string
  readonly label: string

  getEnemyCount(wave: number): number
  getSpawnWeights(wave: number): EnemySpawnWeight[]
  getSpawnDelay(wave: number): number
  getScheduledBossSpawns(wave: number): string[] | null
  getRarityWeights(wave: number): RarityWeights
}
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getEnemyCount(wave)` | `number` | Total enemies to spawn in this wave |
| `getSpawnWeights(wave)` | `EnemySpawnWeight[]` | Weighted list of `{ type, weight }` entries |
| `getSpawnDelay(wave)` | `number` (ms) | Milliseconds between enemy spawns |
| `getScheduledBossSpawns(wave)` | `string[] \| null` | Enemy type IDs for boss spawns, or `null` if not a boss wave |
| `getRarityWeights(wave)` | `RarityWeights` | Probability weights for each upgrade rarity tier |

To add a new difficulty, create a new file that exports a `Difficulty` object and pass it to `new WaveManager(scene, enemyManager, myDifficulty)`.

---

## NormalDifficulty

**Export:** `NormalDifficulty` (constant object, not a class)

### Enemy counts

Waves 1–19 have explicit counts defined in `ENEMY_COUNTS`. From wave 20 onward, the formula is:

```
Math.floor(100 + wave × 2 + wave^1.2)
```

### Spawn delay

```
wave < 3:  max(50, 1000 − wave × 25)   ms
wave < 5:  max(50, 1000 − wave × 35)   ms
wave ≥ 5:  max(50, 1000 − wave × 50)   ms
```

Floor is 50 ms. Earlier waves use gentler scaling so the first few waves don't feel overwhelming.

### Spawn weights

Defined per wave in `SPAWN_WEIGHTS`. Each wave has an explicit array of `{ type, weight }` objects. Higher weight = more likely to appear that wave. Waves not listed use `FALLBACK_WEIGHTS` (mixed late-game enemies).

Key progressions:
- Wave 1–2: Triangles only.
- Wave 3–4: Triangles + Squares.
- Wave 5+: Super Triangles introduced.
- Wave 8+: Diamonds introduced.
- Wave 11+: Hexagons introduced.
- Wave 15+: Octagons introduced.
- Wave 17+: Super Squares introduced.

### Boss waves

Waves 10, 20, and 30 trigger boss spawns: `['hexagon', 'hexagon', 'hexagon', 'dodecahedron']`. The regular enemy pool is halved on boss waves.

### Rarity weights

Defined per wave in `RARITY_WEIGHTS_BY_WAVE`. Each entry specifies the probability of rolling each rarity tier when offering upgrades. The weights sum to 1.0.

| Wave | Common | Uncommon | Rare | Epic | Legendary |
|------|--------|----------|------|------|-----------|
| 1 | 50% | 35% | 15% | 0% | 0% |
| 10 | 37% | 38% | 19% | 5% | 1% |
| 20 | 24% | 40% | 25% | 8% | 3% |
| 30 | 20% | 31% | 33% | 11% | 5% |

After wave 30, the fallback is the wave 30 distribution. The same table is mirrored in the backend's `upgrade_data.py` so the server and client roll upgrades with identical probabilities.
