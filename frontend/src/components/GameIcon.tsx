import type { CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import { GiDeathSkull, GiSmallFire, GiStarsStack, GiUpgrade, GiSnowflake2, GiBurningSkull, GiPoisonBottle, GiFastBackwardButton,
  GiBrokenShield, GiShatteredSword, GiEmberShot, GiWingfoot, GiStripedSword, GiHealing, GiDrippingBlade, GiHeartShield, GiPointySword, GiDodging,
  GiHealthNormal, GiBellShield, GiShield, GiMineExplosion, GiBouncingSword, GiShieldReflect, GiFangs, GiCannonShot, GiPiercedBody, GiHeavyBullets,
  GiSupersonicBullet, GiSilverBullet, GiSpeedometer, GiFeatheredWing, GiShotgunRounds, GiShatter, GiRocketThruster, GiRadialBalance, GiFireflake,
  GiFireBomb, GiHealthIncrease, GiHealthCapsule, GiHeartWings, GiEyeTarget, GiPiercingSword, GiHeartPlus, GiInfinity, GiShieldImpact, GiSandsOfTime,
  GiSunRadiations, GiHumanTarget
 } from 'react-icons/gi'
import { IconID } from '../game/data/ID'

/**
 * What each IconID draws. Game Icons (react-icons/gi) are placeholders,
 * CC BY 3.0 — they need a credits line if they ship. Swapping one for a custom
 * asset later only changes its entry here.
 */
const ICONS: Record<IconID, IconType> = {
  [IconID.Buff]: GiStarsStack,
  [IconID.Debuff]: GiDeathSkull,
  [IconID.Upgrade]: GiUpgrade,
  [IconID.Fire]: GiSmallFire,
  [IconID.Chilled]: GiSnowflake2,
  [IconID.OnFire]: GiBurningSkull,
  [IconID.Poison]: GiPoisonBottle,
  [IconID.Weakness]: GiShatteredSword,
  [IconID.Slowness]: GiFastBackwardButton,
  [IconID.Vulnerable]: GiBrokenShield,
  [IconID.BurningBullets]: GiEmberShot,
  [IconID.Frenzy]: GiStripedSword,
  [IconID.Haste]: GiWingfoot,
  [IconID.Mending]: GiHealing,
  [IconID.PoisonTippedRounds]: GiDrippingBlade,
  [IconID.Toughness]: GiHeartShield,
  [IconID.Wrath]: GiPointySword,
  [IconID.Dash]: GiDodging,
  [IconID.Health]: GiHealthNormal,
  [IconID.EnergyShield]: GiBellShield,
  [IconID.Shield]: GiShield,
  [IconID.Explosion]: GiMineExplosion,
  [IconID.Ricochet]: GiBouncingSword,
  [IconID.Reflect]: GiShieldReflect,
  [IconID.Vampire]: GiFangs,
  [IconID.Cannon]: GiCannonShot,
  [IconID.Pierce]: GiPiercedBody,
  [IconID.HeavyBullets]: GiHeavyBullets,
  [IconID.Velocity]: GiSupersonicBullet,
  [IconID.ShinyBullet]: GiSilverBullet,
  [IconID.Speedometer]: GiSpeedometer,
  [IconID.FeatheredWing]: GiFeatheredWing,
  [IconID.ShotgunRounds]: GiShotgunRounds,
  [IconID.Knockback]: GiShatter,
  [IconID.RocketThruster]: GiRocketThruster,
  [IconID.RadialBalance]: GiRadialBalance,
  [IconID.FireFlake]: GiFireflake,
  [IconID.FireBomb]: GiFireBomb,
  [IconID.HealIncrease]: GiHealthIncrease,
  [IconID.HealCharge]: GiHealthCapsule,
  [IconID.HeartWings]: GiHeartWings,
  [IconID.EyeTarget]: GiEyeTarget,
  [IconID.PiercingSword]: GiPiercingSword,
  [IconID.MoreHealth]: GiHeartPlus,
  [IconID.Infinity]: GiInfinity,
  [IconID.ShieldPierce]: GiShieldImpact,
  [IconID.Hourglass]: GiSandsOfTime,
  [IconID.Buckshot]: GiSunRadiations,
  [IconID.Homing]: GiHumanTarget,
}

export default function GameIcon({ icon, fallback, className, style }: {
  icon?: IconID
  fallback: IconID
  className?: string
  style?: CSSProperties
}) {
  const Icon = (icon && ICONS[icon]) || ICONS[fallback]
  return <Icon className={className} style={style} aria-hidden />
}
