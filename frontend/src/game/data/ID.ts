export const enum BundleRarity {
  Common    = 0,
  Uncommon  = 1,
  Rare      = 2,
  Epic      = 3,
  Legendary = 4,
}

export const enum DifficultyID {
  Normal = 'normal',
}

/** How rare an upgrade is, used for drop weighting and UI styling. */
export const enum RarityID {
  Common    = 'common',
  Uncommon  = 'uncommon',
  Rare      = 'rare',
  Epic      = 'epic',
  Legendary = 'legendary',
}

/** How an upgrade is applied — determines which UpgradeSystem apply path runs. */
export const enum UpgradeTypeID {
  StatModifier = 'stat_modifier',
  Variant      = 'variant',
  Effect       = 'effect',
  VisualEffect = 'visual_effect',
  Ability      = 'ability',
}

/** What class of entity an upgrade's stat_modifier/variant/effect targets. */
export const enum UpgradeTargetID {
  Attack = 'attack',
  Bullet = 'bullet',
  Player = 'player',
}

/** Which field on the target class a stat_modifier upgrade changes. */
export const enum UpgradeStatID {
  Damage                       = 'damage',
  Speed                        = 'speed',
  Size                         = 'size',
  Pierce                       = 'pierce',
  TimeLeft                     = 'timeLeft',
  Knockback                    = 'knockback',
  MaxHealth                    = 'maxHealth',
  PolygonSides                 = 'polygonSides',
  DashSpeed                    = 'dashSpeed',
  DashCooldown                 = 'dashCooldown',
  ExplosionDamage              = 'explosionDamage',
  ExplosionRadius              = 'explosionRadius',
  TrackingDistance             = 'trackingDistance',
  MinimumDamageMultiplier      = 'minimumDamageMultiplier',
  MaximumSpawnDamageMultiplier = 'maximumSpawnDamageMultiplier',
  ChokeAngle                   = 'chokeAngle',
  MinimumPellets               = 'minPellets',
  MaximumPellets               = 'maxPellets',
  HitEnemyDamageReduction      = 'hitEnemyDamageReduction', 
}

export const enum UpgradeVariantID {
  HomingBullets    = 'homing_bullets',
  ExplosiveBullets = 'explosive_bullets',
  BuckshotBullets  = 'buckshot_bullets',
}

export const enum UpgradeEffectID {
  Ricochet = 'ricochet',
}

export const enum AttackTypeID
{
  Bullet = 'bullet',
  Laser = 'laser'
}

export const enum SoundID
{
  BulletShot = 'bullet_shot',
  Explosion = 'explosion',
  SelectUpgrade = 'select_upgrade',
  PlayerHurt = 'player_hurt',
  EnemyHurt = 'enemy_hurt',
  EnemyKilled = 'enemy_killed',
  PlayerDash = 'player_dash',
  UpgradeRoll = 'upgrade_roll',
  BulletCollide = 'bullet_tileCollide',
  Buckshot = 'buckshot',
  BossDash = 'boss_dash',
  BossShoot1 = 'boss_shoot_1',
  EnemyShoot1 = 'enemy_shoot_1',
  EnemyShoot2 = 'enemy_shoot_2',
  AcidBulletExplosion = 'acid_bullet_explosion',
  PlayerShieldUp = 'player_shield_up',
  DetonationWarning = 'detonation_warning'
}

export const enum SoundtrackID
{
  BackgroundMusic = 'background_music'
}

/**
 * Baseline brightness for LightingSystem.AddLight.
 *
 * Intensity is the ONLY light-size control - there is no radius parameter, since
 * a per-light radius means a per-light flood pass. Reach is logarithmic in these
 * values: at the shipped settings 2 reaches ~250px and 0.7 reaches ~160px, which
 * is where entity and projectile lights sat under the old radius parameter.
 *
 * Unlike the radius values these replaced, varying them is FREE - intensity does
 * not split the flood into more passes, so scale them per entity as you like.
 * Use LightingSystem.Reach() / IntensityFor() to convert to and from pixels, and
 * see INTENSITY IS THE ONLY KNOB in LightingSystem.ts for the curve's shape.
 */
export const enum LightingIntensityID
{
  /** Players and enemies. ~250px. */
  Entity = 2,
  /** Projectiles. ~160px. */
  Projectile = 0.7,
  /** Specific player override */
  Player = 1.2,
  Explosion = 1.3,
}