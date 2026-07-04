import { Upgrade, type UpgradeDef } from '../Upgrade'
import { BulletExplosion } from '../../entities/projectiles/player_projectiles/Bullet'
import { getDefaultVolume } from '../../core/AudioRegistry'
import type { Enemy } from '../../entities/enemies/Enemy'
import { RarityID, UpgradeTypeID } from '../../data/ID'

export const ExplosionOnKillDef: UpgradeDef = {
  id: "explosion_on_kill",
  name: "Chain Reaction",
  description: "Enemies explode on death",
  rarity: RarityID.Epic,
  upgradeType: UpgradeTypeID.Effect,
  cost: 20,
  effect: "explode_on_kill",
  effectValue: 20,
  stackable: false,
}

export class ExplosionOnKill extends Upgrade {
  onApply(): void {}

  onEnemyKilled(enemy: Enemy): void {
    // Spawn a real BulletExplosion projectile (same class ExplosiveBullet uses)
    // so the AOE damage flows through CollisionManager like any other player
    // hit: modifyExplosion + damage modifiers apply, on-hit/on-kill hooks fire
    // (so explosions chain), and kills award points/kills/bundles.
    const scene = enemy.getScene() as Phaser.Scene & { spawnProjectile: Function }
    const explosion = new BulletExplosion({ damage: this.def.effectValue!, radius: 60 })
    explosion.SetDefaults()

    // all sound calls should have this check to prevent "sound stacking"
    if (scene.sound.isPlaying('explosion')) {
      scene.sound.stopByKey('explosion')
    }
    scene.sound.play('explosion', { volume: getDefaultVolume('explosion') })

    scene.spawnProjectile(explosion, enemy.x, enemy.y, enemy.x, enemy.y, 'player', 0)
  }
}
