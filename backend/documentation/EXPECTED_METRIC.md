# Expected scaling results for different classes and projectiles

Using the script `damage_scaling_ratio.py`, we can see how much the player's damage is scaling compared to enemy health. The player's damage is calculated by getting the maximum possible damage from a projectile spawn and multiplying it by the number of polygon sides. This scale number is divided by the rate at which enemies health increases per wave. That number is VS_POOL. Perfect balance would be VS_POOL staying constant at 1.00, but projectile and enemy variance can make different values *feel* more balanced than others. See below.

## Bullet

### Homing bullet
This projectile seeks out enemies automatically. This means the player can maximize projecitle efficiency so the maximum possible damage per shot is likely to be reached. This means damage capping needs to be taken into account. Right now, this happens in the actual projectile, with a dramatic decrease in damage over the projectile's lifetime, and a further decrease per pierce. Homing bullets perform best against single targets.

**VS_POOL:** feels balanced around `3.00-4.00` for waves 1-25

### Explosive bullet
These are single projectiles shot straight out, harder to maximize the maximum possible damage especially if the player is primarily aiming head-on. Ricochete and pierce upgrades greatly increase the value of damage because the projectile can stay alive longer and has a higher chance of hitting an enemy. The crux of the explosive bullet is the fact that on any collision, it spawns an explosion projectile which does damage separate from the bullet itself. This means a single projectile's damage can scale with two separate stats. Damage scaling is expected to scale faster with this projectile, because the upgrades are primarily damage-based. This projecitle performs best against clusters of enemies.

**VS_POOL:** feels balanced around `4.50-6.00` for waves 1-25