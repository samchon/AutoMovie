import { IautomovieTransform } from "../geometry/IautomovieTransform";
import { automovieHumanoidBone } from "./AutomovieHumanoidBone";

/**
 * A rigid coupling of one model's root to a **bone of another model** ??the
 * cross-skeleton joint that lets a rider sit a horse, a passenger ride a cart,
 * or a sword stay in a hand.
 *
 * This is the automovie expression of what a physics engine does with a fixed
 * joint between two bodies: the child's body frame is locked into the parent
 * bone's frame, so wherever and however that bone moves in the world ??the
 * horse's saddle pitching back as it rears ??the child follows rigidly,
 * position and orientation together. The engine's `resolveAttachment` computes
 * the child root world transform each frame from the parent's posed skeleton.
 *
 * @author Samchon
 */
export interface IautomovieAttachment {
  /**
   * The bone on the **parent** skeleton the child rides (e.g. a horse's `chest`
   * standing in for the saddle).
   */
  parentBone: automovieHumanoidBone;

  /**
   * The child root's offset within that bone's local frame ??where the seat is
   * relative to the bone origin (translation) and how the child is oriented on
   * it (rotation). Composed onto the bone's world transform.
   */
  offset: IautomovieTransform;
}
