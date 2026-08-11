import Phaser from 'phaser'
import { ArrowHeadPart } from './ArrowHeadPart'
import { ArrowHeadConfig, type ArrowHeadRole } from './ArrowHeadConfig'
import { ArrowHeadBodyProj } from '../../projectiles/enemy_projectiles/ArrowHeadBodyProj'

/**
 * ============================================================================
 * ARROW HEAD (BOSS) - BODY SEGMENT
 * ============================================================================
 *
 * A middle link of the worm. It does not steer: `PreAI()` returns false so the
 * base class skips its bundled move-toward-player + `AI()` pair, and the head
 * places this segment every frame instead. Same as tModLoader's `WormBody`,
 * whose whole movement is "sit a fixed distance behind whatever you follow".
 *
 * **`AI()` still works — override it here as normal.** The head calls it from
 * `ArrowHeadHead.UpdateChain()`, immediately after positioning this segment,
 * so it runs once per frame with a current position and in head-to-tail order.
 * That's also why the base class's copy has to stay switched off: `AI()` and
 * `moveTowards()` sit behind the same `if` in `Enemy._update()`, so letting
 * the base call one means getting default steering fighting the chain.
 *
 * Two consequences worth knowing before writing behaviour here:
 *  - `AI()` stops being called once the head dies, since nothing drives the
 *    chain any more. A dead worm can't keep attacking, which is what you want,
 *    but it means `AI()` is not the place for teardown — that lives in
 *    `PreAI()`, which the base class does still call every frame.
 *  - it runs on *every* segment, so anything that fires costs one-per-segment.
 *    Gate on `this.chainIndex` (or `chainT`) to thin it out.
 *
 * Its stats are not defined here — they are derived from the head in
 * `ConfigureAsSegment`. The values in `SetDefaults()` are only the fallback
 * for a segment spawned without a head (e.g. straight from a dev console), so
 * it still renders and behaves sanely on its own.
 */
export class ArrowHeadBody extends ArrowHeadPart {
  readonly role: ArrowHeadRole = 'body'

  // Projecitle attack variables
  protected projectileCooldown: number = Phaser.Math.Between(3000, 7000) // this value should always be randomized when a projectile is spawned.

  /** Position along the chain used for the standalone fallback stats. 0 = just behind the head. */
  protected get fallbackT(): number {
    return 0
  }

  SetDefaults(): void {
    const cfg = ArrowHeadConfig
    const t = this.fallbackT

    this.shape = cfg.segment.shapeFor(this.role, t)

    this.health = cfg.head.health * cfg.chain.soloHealthRatio
    this.damage = cfg.head.damage * cfg.segment.damageRatio(t)
    this.defense = cfg.head.defense * cfg.segment.defenseRatio(t)
    this.radius = cfg.head.radius * cfg.segment.radiusRatio(t)
    this.hitboxSize = cfg.segment.hitboxSize(t)
    this.color = cfg.head.color
    this.speed = 0
    this.scoreChance = 0
    this.bundleDropChance = 0
    this.isBoss = true

    this.applySharedDefaults()
  }

  /**
   * Segments never steer. Returning false skips the base class's default
   * move-toward-player *and* its `AI()` call, leaving position entirely to the
   * chain — the head calls `AI()` itself, see the class doc above.
   *
   * The one thing handled here is orphaning: if the head is gone but this
   * segment somehow survived it, dissolve rather than sit in the arena
   * forever blocking wave completion. A dissolve the head already scheduled
   * (its staggered death sequence) is left to run out.
   */
  PreAI(): boolean {
    if (!this.dissolveScheduled && (!this.owner || this.owner.isDestroyed)) {
      this.Dissolve()
    }
    return false
  }

  AI(_playerX: number, _playerY: number): void
  {
    if (this.projectileCooldown <= 0)
    {
      const projectile = new ArrowHeadBodyProj()
      projectile.SetDefaults()
      projectile.damage = this.damage/2
      projectile.color = this.color

      // const angle = Math.atan2(direction.y, direction.x)

      const scene = this.scene as Phaser.Scene & { spawnProjectile: Function }

      scene.spawnProjectile(
        projectile,
        this.x,
        this.y,
        _playerX,
        _playerY,
        'enemy',
        this.id
      )

      this.projectileCooldown = Phaser.Math.Between(3000, 7000) // reset cooldown to a new random value
    }
    this.projectileCooldown -= (1000/60)
  }
}
