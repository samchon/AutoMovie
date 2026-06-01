import { IMoticaBone } from "./IMoticaBone";

/**
 * A normalized humanoid skeleton — the rig a pose or motion targets.
 *
 * The skeleton is the contract between _what exists_ (which bones, their
 * hierarchy, their ROM) and _what an animation does_ (which bones it rotates).
 * Because bones are keyed by the closed {@link "./MoticaHumanoidBone"} enum, a
 * motion authored against one skeleton retargets onto any other that shares the
 * humanoid convention — the basis of motica's "author once, play on any VRM"
 * portability.
 *
 * Whether the skeleton was generated (geometry phase) or imported (ingest of a
 * user's glTF/VRM/FBX), it arrives here in the same normalized shape, so the
 * pose/motion/expression layers never need to know its origin.
 *
 * @author Samchon
 */
export interface IMoticaSkeleton {
  /** Stable id so poses, motions, and scene nodes can cite this rig. */
  id: string;

  /**
   * The bones, hierarchy, rest pose, and ROM. At least one bone (`hips`, the
   * root) is required. Each {@link IMoticaBone.bone} appears at most once.
   */
  bones: IMoticaBone[];
}
