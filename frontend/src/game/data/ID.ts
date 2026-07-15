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
}

export const enum UpgradeVariantID {
  HomingBullets    = 'homing_bullets',
  ExplosiveBullets = 'explosive_bullets',
  BuckshotBullets  = 'buckshot_bullets',
}

export const enum AttackTypeID
{
  Bullet = 'bullet',
  Laser = 'laser'
}