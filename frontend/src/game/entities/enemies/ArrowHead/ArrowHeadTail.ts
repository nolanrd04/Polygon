import { ArrowHeadBody } from './ArrowHeadBody'
import { type ArrowHeadRole } from './ArrowHeadConfig'

/**
 * ============================================================================
 * ARROW HEAD (BOSS) - TAIL SEGMENT
 * ============================================================================
 *
 * The last link of the worm. Behaviourally identical to a body segment —
 * tModLoader's `WormTail` shares `WormBody`'s AI outright — so this exists to
 * be the far end of the chain: it takes the `t = 1` end of every per-segment
 * curve in the config (smallest radius, narrowest chevron, tail color), and
 * gives the head a distinct registry id to spawn last.
 */
export class ArrowHeadTail extends ArrowHeadBody {
  readonly role: ArrowHeadRole = 'tail'

  /** The tail sits at the far end of every per-segment curve. */
  protected get fallbackT(): number {
    return 1
  }
}
