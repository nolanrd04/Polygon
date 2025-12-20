1. Add fixed progression for first 30 waves
2. Add new enemies to add difficulty
3. implement flame, laser, spinner, and zapper.
4. add upgrades for projectiles
5. improve terrain
7. improve waves/enemy spawns
8. Add difficulties
9. Add leaderboard
14. right click breaks things

Optimization Recommendations (Priority Order)

  High Impact:
  1. Convert to sprite textures - Pre-render polygon shapes as textures instead of redrawing vectors every frame
  2. Object pooling - Reuse projectile objects instead of creating/destroying them
  3. Limit max projectiles - Cap active projectiles at 200-300 total
  4. Optimize/disable health bars - Batch into single canvas or use simpler rendering

  Medium Impact:
  5. Cull off-screen entities - Don't update/draw entities outside camera view
  6. Reduce enemy count - Consider capping at 80-100 max regardless of wave