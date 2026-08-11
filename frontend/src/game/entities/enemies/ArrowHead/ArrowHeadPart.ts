import Phaser from 'phaser'
import { Enemy } from '../Enemy'
import { TextureGenerator } from '../../../utils/TextureGenerator'
import { Particle, PolygonParticle } from '../../particles'
import {
  ArrowHeadConfig,
  ARROW_HEAD_IDS,
  chevronGeometry,
  spacingBetween,
  facingOffset,
  blendColor,
  quantize,
  type ArrowHeadRole,
  type ChevronShape,
} from './ArrowHeadConfig'

/**
 * ============================================================================
 * ARROW HEAD - SHARED PART BASE
 * ============================================================================
 *
 * Every piece of the worm — head, body, tail — is its own Enemy (its own
 * registry id, container, sprite and hitbox), and this class holds what all
 * three have in common:
 *
 *  - the concave arrow ("^") sprite, built from the config's shape description
 *  - the doubly-linked chain (`leader` / `follower`) that makes the worm move
 *    as one animal
 *  - the shared health pool, i.e. tModLoader's `NPC.realLife`: damage dealt to
 *    any part is routed into the head, so the worm has one health bar and dies
 *    as one enemy
 *
 * Modeled on tModLoader's `Worm` / `WormHead` / `WormBody` / `WormTail` split:
 * the head runs real AI, and body/tail parts run no AI of their own at all —
 * they are placed a fixed distance behind whatever they follow. The one
 * deliberate difference is *who* does the placing. tModLoader lets each
 * segment pull itself toward its leader on its own update tick; here the head
 * walks the whole chain itself (see `ArrowHeadHead.UpdateChain`), because
 * `EnemyManager.update()` iterates its enemy array backwards — segments would
 * otherwise update before the head and every link would inherit a one-frame
 * lag, compounding down the chain.
 */
export abstract class ArrowHeadPart extends Enemy {
  /** Which of the three roles this part is. Drives shape/stat derivation only. */
  abstract readonly role: ArrowHeadRole

  // ============ CHAIN LINKS ============

  /** The part directly ahead of this one. Null on the head. */
  leader: ArrowHeadPart | null = null
  /** The part directly behind this one. Null on the last part. */
  follower: ArrowHeadPart | null = null
  /**
   * The worm's owner — tModLoader's `NPC.realLife`. Every part points at the
   * head, including the head itself, so damage routing needs no special case.
   */
  owner: ArrowHeadPart | null = null

  /** Index of this part in the chain. 0 is the head. */
  chainIndex: number = 0
  /** Total parts in the worm, head included. */
  chainLength: number = 1
  /** Position along the chain, 0 (first part behind the head) -> 1 (last part). */
  chainT: number = 0

  /** The chevron this part was built with. Kept so death FX can match the outline. */
  protected shape: ChevronShape = ArrowHeadConfig.head.shape

  /** Set while forwarding damage up the chain, so the head doesn't re-play the hit sound. */
  protected suppressHitSound: boolean = false

  /**
   * True once a dissolve has been scheduled for this part.
   *
   * `Enemy._die()` flags itself destroyed *before* calling `OnDeath()`, so the
   * moment the head dies every segment's orphan check would fire on the next
   * frame and dissolve the whole chain at once — throwing away the staggered
   * back-to-front dissolve the head just scheduled. This flag lets an already
   * scheduled dissolve run out.
   */
  dissolveScheduled: boolean = false

  /** Ambient particle cadence counter. */
  protected fxTimer: number = 0

  // ========================================================================
  // CONSTRUCTION
  // ========================================================================

  /**
   * Called by the head, through `EnemyManager.spawnEnemy`'s configure hook,
   * *after* SetDefaults() and after difficulty scaling but *before* `_spawn`.
   * That ordering is what makes the head the single statistics authority:
   *
   *  - the head's own stats have already been scaled by the wave curve, so
   *    stats derived from them here are scaled exactly once
   *  - nothing has been built yet, so radius/scale/hitbox changes are picked
   *    up by `_spawn` normally, with no need to rebuild bodies afterwards
   *
   * @param head    The head that owns this worm.
   * @param index   This part's index in the chain (1..chainLength-1).
   * @param length  Total parts in the worm, head included.
   */
  ConfigureAsSegment(head: ArrowHeadPart, index: number, length: number): void {
    const cfg = ArrowHeadConfig
    const segments = Math.max(1, length - 1)
    // t = 0 for the part right behind the head, 1 for the last part.
    const t = segments > 1 ? (index - 1) / (segments - 1) : 1

    this.owner = head
    this.chainIndex = index
    this.chainLength = length
    this.chainT = t

    // Appearance runs off a quantized `t` so every worm reuses the same small
    // set of cached textures regardless of how long its chain rolled.
    const tShape = quantize(t, cfg.segment.textureSteps)
    this.shape = cfg.segment.shapeFor(this.role, tShape)

    this.radius = head.radius * cfg.segment.radiusRatio(tShape)
    this.damage = head.damage * cfg.segment.damageRatio(t)
    this.defense = head.defense * cfg.segment.defenseRatio(t)
    this.hitboxSize = cfg.segment.hitboxSize(t)
    this.color = blendColor(head.color, cfg.segment.tailColor, t)

    // With a shared pool the part's own health is never spent - it exists only
    // so dev health bars read sensibly - so mirror the head. Without one, the
    // part is separately killable and gets a real slice of health.
    this.health = cfg.chain.sharedHealth
      ? head.maxHealth
      : head.maxHealth * cfg.chain.soloHealthRatio

    this.isBoss = head.isBoss
    this.knockbackResistance = 1
    this.speedCap = head.speedCap
    this.scale = head.scale
  }

  /**
   * Shared defaults for all three roles. Subclasses call this from
   * SetDefaults() and then apply whatever is specific to their role.
   */
  protected applySharedDefaults(): void {
    // `sides` feeds the base class's death particles and outline key; the
    // chevron has one vertex per entry in its geometry, so derive it rather
    // than fixing it at 4.
    this.sides = chevronGeometry(this.shape).angles.length
    this.knockbackResistance = 1
    this.speedCap = ArrowHeadConfig.head.speedCap
    this.knockbackEnemies = ArrowHeadConfig.chain.barge.enabled
    this.knockbackEnemiesStrength = ArrowHeadConfig.chain.barge.strength
  }

  /**
   * Swap the base class's regular-polygon sprite for the concave arrow, and
   * make the body immovable.
   *
   * Immovable matters: parts are positioned by the chain every frame, and the
   * enemy-vs-enemy collider would otherwise shove them out of formation. An
   * immovable body still collides (the player is still pushed out of the worm,
   * projectiles and contact damage still register) - it just isn't the one
   * that gets displaced.
   *
   * @internal
   */
  _spawn(scene: Phaser.Scene, x: number, y: number, id: number): Phaser.GameObjects.Container {
    const container = super._spawn(scene, x, y, id)

    const oldSprite = this.sprite
    this.sprite = scene.add.sprite(0, 0, this.getChevronTextureKey())
    this.sprite.setTint(this.color)
    // Only the display scale here: the container already carries `this.scale`.
    this.sprite.setScale(TextureGenerator.getDisplayScale())
    this.container.add(this.sprite)
    oldSprite.destroy()

    this.body.setImmovable(true)

    // Parts overlap, so their draw order is part of the silhouette: each one
    // sits just under the part ahead of it. Offset off `baseDepth` rather than
    // off 0, or the chain steps below the obstacles - see that config entry.
    this.container.setDepth(
      ArrowHeadConfig.chain.baseDepth + this.chainIndex * ArrowHeadConfig.chain.depthPerPart
    )

    return container
  }

  /** Build (or fetch from cache) the concave arrow texture for this part. */
  protected getChevronTextureKey(): string {
    const { angles, vertexRadii } = chevronGeometry(this.shape)
    return TextureGenerator.getOrCreateIrregularPolygon(this.scene, {
      angles,
      vertexRadii,
      radius: this.radius,
      fillColor: 0xd9d9d9, // light gray so the white stroke stays visible under tint
      fillAlpha: 1.0,
      strokeWidth: 3,
      strokeColor: 0xffffff,
      strokeAlpha: 1.0,
    })
  }

  // ========================================================================
  // CHAIN
  // ========================================================================

  /** Link `next` directly behind this part. */
  LinkFollower(next: ArrowHeadPart): void {
    this.follower = next
    next.leader = this
  }

  /**
   * Gap this part keeps from `leader`, derived from where the two outlines
   * actually end rather than from their radii, so parts overlap by the amount
   * the config asks for no matter which shape family either one is.
   */
  GetSpacingTo(leader: ArrowHeadPart): number {
    return spacingBetween(
      { shape: leader.shape, radius: leader.radius * leader.scale, role: leader.role },
      {
        shape: this.shape,
        radius: this.radius * this.scale,
        role: this.role,
        t: this.chainT,
      }
    )
  }

  /**
   * Place this part behind its leader and aim it at them. This is the whole
   * of a body/tail part's movement - exactly like tModLoader's
   * `CommonAI_BodyTail`, which zeroes the segment's velocity and writes its
   * position directly.
   */
  FollowLeader(leader: ArrowHeadPart): void {
    const previousX = this.x
    const previousY = this.y

    const dx = leader.x - this.x
    const dy = leader.y - this.y
    const distance = Math.hypot(dx, dy)

    // Degenerate case (spawned exactly on top of the leader): fall in behind
    // the direction the leader is facing rather than snapping to angle 0.
    // The leader's own facing offset has to come back out to recover its heading.
    const angle =
      distance > 0.0001
        ? Math.atan2(dy, dx)
        : leader.rotation - Math.PI / 2 - facingOffset(leader.role)

    const spacing = this.GetSpacingTo(leader)
    const targetX = leader.x - Math.cos(angle) * spacing
    const targetY = leader.y - Math.sin(angle) * spacing

    const follow = ArrowHeadConfig.chain.followLerp
    this.x = follow >= 1 ? targetX : Phaser.Math.Linear(this.x, targetX, follow)
    this.y = follow >= 1 ? targetY : Phaser.Math.Linear(this.y, targetY, follow)

    // Sprites point up, so the heading is offset by a quarter turn - same
    // convention as Enemy.moveTowards() - plus this role's own facing offset,
    // which is what turns the tail around to point back down the worm.
    this.rotation = angle + Math.PI / 2 + facingOffset(this.role)

    // Write straight through to the container: the chain is driven by the
    // head's update, which may run after this part's own _update this frame.
    this.container.setPosition(this.x, this.y)
    this.container.rotation = this.rotation

    // Record the velocity this move *implies*. A segment is driven by position,
    // not by physics, so `velocityX/Y` would otherwise sit at 0 forever — and
    // anything reading an enemy's velocity as "how fast is it moving" would be
    // wrong about every part except the head. That includes the contact barge
    // (`knockbackEnemies`), which shoves along the knocker's velocity and would
    // silently do nothing for the whole body of the worm.
    //
    // The physics body itself still gets zeroed: position remains authoritative.
    // The segment's own `_update` will push this value into the body earlier in
    // the next frame, but the head updates last, so this line always has the
    // final say before the physics step.
    const seconds = this.scene.game.loop.delta / 1000
    this.velocityX = seconds > 0 ? (this.x - previousX) / seconds : 0
    this.velocityY = seconds > 0 ? (this.y - previousY) / seconds : 0
    this.body.setVelocity(0, 0)

    if (ArrowHeadConfig.chain.sharedHealth && this.owner) {
      // Keep dev health bars on segments reading the real (shared) pool.
      this.health = this.owner.health
      this.maxHealth = this.owner.maxHealth
    }

    this.EmitAmbientParticles()
  }

  // ========================================================================
  // DAMAGE ROUTING (tModLoader's NPC.realLife)
  // ========================================================================

  takeDamage(amount: number, source?: any): boolean {
    const owner = ArrowHeadConfig.chain.sharedHealth ? this.owner : null

    if (!owner || owner === this || owner.isDestroyed) {
      return super.takeDamage(amount, source)
    }

    // Let this part veto/react to the hit (flash, sound, invulnerability).
    if (!this.OnHit(amount, source)) {
      return false
    }
    this.FlashOnHit()

    // The part that was actually struck is the one whose armor applies, so
    // reduce by *this* part's defense here. The head will subtract its own
    // defense inside its takeDamage, so add that back first and the pool ends
    // up losing exactly what this part let through.
    const throughArmor = Math.max(1, amount - this.defense)
    owner.suppressHitSound = true
    const killed = owner.takeDamage(throughArmor + owner.defense, source)
    owner.suppressHitSound = false

    return killed
  }

  OnHit(damage: number, source: any): boolean {
    if (this.suppressHitSound) {
      // A segment already played the hit sound for this exact hit.
      return true
    }
    return super.OnHit(damage, source)
  }

  /**
   * The white damage flash the base class does inside takeDamage. Parts that
   * forward their damage never reach that code, so they flash from here.
   */
  protected FlashOnHit(): void {
    const original = this.color
    this.sprite.setTint(0xffffff)
    this.scene.time.delayedCall(50, () => {
      if (!this.isDestroyed) {
        this.sprite.setTint(original)
      }
    })
  }

  // ========================================================================
  // DEATH
  // ========================================================================

  /**
   * Remove this part without reporting a kill.
   *
   * Used when the head dies and takes its chain with it: the worm is a single
   * enemy as far as scoring and wave validation are concerned, so only the
   * head's own death emits `enemy-killed`.
   *
   * @param delayMs Stagger, so a long worm dissolves back-to-front.
   */
  Dissolve(delayMs: number = 0): void {
    if (this.isDestroyed || this.dissolveScheduled) return
    this.dissolveScheduled = true

    const finish = () => {
      if (this.isDestroyed) return
      this.EmitDeathParticles()
      this._destroy()
    }

    if (delayMs > 0 && this.scene) {
      this.scene.time.delayedCall(delayMs, finish)
    } else {
      finish()
    }
  }

  /**
   * A part died on its own (only reachable with `chain.sharedHealth` off).
   * Stitch the chain back together so the parts behind it keep following.
   */
  OnDeath(): void {
    super.OnDeath()

    if (this.follower) {
      this.follower.leader = this.leader
    }
    if (this.leader) {
      this.leader.follower = this.follower
    }
    this.follower = null
    this.leader = null
  }

  // ========================================================================
  // FX
  // ========================================================================

  protected EmitAmbientParticles(): void {
    const fx = ArrowHeadConfig.fx.ambient
    if (fx.every <= 0) return

    this.fxTimer++
    if (this.fxTimer % fx.every !== 0) return

    const bursts = Phaser.Math.Between(fx.perBurst.min, fx.perBurst.max)
    for (let i = 0; i < bursts; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = this.radius * this.scale * Math.sqrt(Phaser.Math.FloatBetween(0, 1)) * 0.7

      Particle.NewParticle(
        PolygonParticle,
        this.x + Math.cos(angle) * dist,
        this.y + Math.sin(angle) * dist,
        this.velocityX * 0.25,
        this.velocityY * 0.25,
        {
          sides: this.sides,
          radius: Phaser.Math.Between(fx.radiusRange.min, fx.radiusRange.max),
          color: this.color,
          additive: true,
        }
      )
    }
  }

  protected EmitDeathParticles(): void {
    const burst = ArrowHeadConfig.fx.deathBurst
    const count = Phaser.Math.Between(burst.min, burst.max)

    for (let i = 0; i < count; i++) {
      const velocity = new Phaser.Math.Vector2(Phaser.Math.Between(150, 250), 0)
      velocity.rotate(Phaser.Math.FloatBetween(0, Math.PI * 2))

      Particle.NewParticle(PolygonParticle, this.x, this.y, velocity.x, velocity.y, {
        color: this.color,
        sides: Phaser.Math.Between(3, this.sides),
        scale: (this.radius / 20) * Phaser.Math.FloatBetween(0.4, 0.6),
      })
    }
  }

  /** Registry ids, re-exported for convenience at the call sites. */
  static readonly IDS = ARROW_HEAD_IDS
}
