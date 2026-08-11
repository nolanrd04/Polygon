/**
 * Arrow Head boss - barrel export.
 *
 * The boss is three cooperating enemies (head, body, tail) plus one config
 * file that every one of them reads from. See ArrowHeadConfig.ts for the
 * tunables and ArrowHeadPart.ts for how the chain and shared health work.
 */
export { ArrowHeadHead } from './ArrowHeadHead'
export { ArrowHeadBody } from './ArrowHeadBody'
export { ArrowHeadTail } from './ArrowHeadTail'
export { ArrowHeadPart } from './ArrowHeadPart'
export {
  ArrowHeadConfig,
  ARROW_HEAD_IDS,
  chevronGeometry,
  blendColor,
  lerp,
} from './ArrowHeadConfig'
export type { ArrowHeadRole, ChevronShape } from './ArrowHeadConfig'
