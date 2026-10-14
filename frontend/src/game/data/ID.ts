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
  HealAmount                   = 'healAmount',
  HealCooldown                 = 'healCooldown',
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

/** What kind of entity a buff can sit on. */
export const enum BuffHostID {
  Player = 'player',
  Enemy  = 'enemy',
}

/** Stats a buff can write into its host's per-tick BuffStats layer. */
export const enum BuffStatID {
  LifeRegen   = 'lifeRegen',   // HP per second; negative = damage over time
  MoveSpeed   = 'moveSpeed',   // player + enemy movement
  Damage      = 'damage',      // outgoing damage: projectiles (fire-time) and enemy contact
  FireRate    = 'fireRate',    // player shot cooldown is divided by this
  DamageTaken = 'damageTaken', // incoming damage, applied after armor
  Defense     = 'defense',     // enemy armor (flat)
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

/**
 * Icons for upgrade and buff defs. Defs store the id (JSON-safe, so the
 * backend sync scripts can read them); components/GameIcon.tsx maps each id
 * to what is drawn. Add a member here and an entry there.
 */
export const enum IconID {
  Buff    = 'buff',    // fallback for buffs without an icon
  Debuff  = 'debuff',  // fallback for debuffs without an icon
  Upgrade = 'upgrade', // fallback for upgrades without an icon
  Fire    = 'fire',
  Chilled = 'GiSnowflake2',
  OnFire = 'GiBurningSkull',
  Poison = 'GiPoisonBottle',
  Weakness = 'weakness',
  Slowness = 'slowness',
  Vulnerable = 'vulnerable',
  BurningBullets = 'burning_bullets',
  Frenzy = 'frenzy',
  Haste = 'haste',
  Mending = 'mending',
  PoisonTippedRounds = 'poison_tipped_rounds',
  Toughness = 'toughness',
  Wrath = 'wrath',
  Dash = 'dash',
  Health = 'health',
  EnergyShield = 'energy_shield',
  Shield = 'shield',
  Explosion = 'explosion',
  Ricochet = 'ricochet',
  Reflect = 'reflect',
  Vampire = 'vampire',
  Cannon = 'cannon',
  Pierce = 'pierce',
  HeavyBullets = 'heavy_bullets',
  Velocity = 'velocity',
  ShinyBullet = 'shiny_bullet',
  Speedometer = 'speedometer',
  FeatheredWing = 'feathered_wing',
  ShotgunRounds = 'shotgun_rounds',
  Knockback = 'knockback',
  RocketThruster = 'rocket_thruster',
  RadialBalance = 'radial_balance',
  FireFlake = 'fire_flake',
  FireBomb = 'fire_bomb',
  HealIncrease = 'heal_increase',
  HealCharge = 'heal_charge',
  HeartWings = 'heart_wings',
  EyeTarget = 'eye_target',
  PiercingSword = 'piercing_sword',
  MoreHealth = 'more_health',
  Infinity = 'infinity',
  ShieldPierce = 'shield_pierce',
  Hourglass = 'hourglass',
  Buckshot = 'buckshot',
  Homing = 'homing',
}

/** Every buff and debuff — one file per id under game/buffs/. */
export const enum BuffID {
  Mending    = 'mending',
  Haste1      = 'haste_1',
  Haste2      = 'haste_2',
  Haste3      = 'haste_3',
  // Haste4      = 'haste_4',
  // Haste5      = 'haste_5',
  Wrath1      = 'wrath_1',
  Wrath2      = 'wrath_2',
  Wrath3      = 'wrath_3',
  Wrath4      = 'wrath_4',
  Wrath5      = 'wrath_5',
  Frenzy     = 'frenzy',
  Toughness1  = 'toughness_1',
  Toughness2  = 'toughness_2',
  // Toughness3  = 'toughness_3',
  Slowness1   = 'slowness_1',
  Slowness2   = 'slowness_2',
  Slowness3   = 'slowness_3',
  Slowness4   = 'slowness_4',
  Slowness5   = 'slowness_5',
  Vulnerable1 = 'vulnerable_1',
  Vulnerable2 = 'vulnerable_2',
  Vulnerable3 = 'vulnerable_3',
  Weakness1   = 'weakness_1',
  Weakness2   = 'weakness_2',
  Weakness3   = 'weakness_3',
  Weakness4   = 'weakness_4',
  OnFire1     = 'on_fire_1',
  OnFire2    = 'on_fire_2',
  OnFire3    = 'on_fire_3',
  OnFire4    = 'on_fire_4',
  OnFire5    = 'on_fire_5',
  BurningBullets1 = 'burning_bullets_1',
  BurningBullets2 = 'burning_bullets_2',
  BurningBullets3 = 'burning_bullets_3',
  BurningBullets4 = 'burning_bullets_4',
  BurningBullets5 = 'burning_bullets_5',
  Chilled1   = 'chilled_1',
  Chilled2   = 'chilled_2',
  Chilled3   = 'chilled_3',
  Chilled4   = 'chilled_4',
  Chilled5   = 'chilled_5',
  Poison1    = 'poison_1',
  Poison2    = 'poison_2',
  Poison3    = 'poison_3',
  Poison4    = 'poison_4',
  Poison5    = 'poison_5',
  PoisonTippedRounds1 = 'poison_tipped_rounds_1',
  PoisonTippedRounds2 = 'poison_tipped_rounds_2',
  PoisonTippedRounds3 = 'poison_tipped_rounds_3',
  PoisonTippedRounds4 = 'poison_tipped_rounds_4',
  PoisonTippedRounds5 = 'poison_tipped_rounds_5',
}