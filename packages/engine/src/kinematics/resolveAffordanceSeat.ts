import {
  IAutoMovieAffordance,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/** Inverse of a (near-)unit quaternion: the normalized conjugate. */
const inverse = (q: IAutoMovieQuaternion): IAutoMovieQuaternion =>
  Quaternion.normalize({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

const UNIT_SCALE = { x: 1, y: 1, z: 1 } as const;

/**
 * Resolve the **world transform of a child model's root** seated on another
 * model's affordance — the model-frame sibling of {@link resolveAttachment}.
 * Where that couples a child to a posed **bone** (a rider on a horse), this
 * aligns two declared contact frames: crate B's base socket onto crate A's
 * stack-top, a lantern's ring onto a hook, a hand frame onto a mug handle.
 *
 * The parent's contact frame in world space is the parent affordance's frame
 * composed onto the parent root (the {@link resolveAttachment} convention — `pos
 * = parentPos + parentRot · frame.translation`, `rot = parentRot ∘
 * frame.rotation`). The child is then placed so its own contact frame — its
 * `childAffordance.frame`, or the child root origin when `null` — coincides
 * with it:
 *
 * - `childRot = contactRot ∘ childFrame.rotation⁻¹`
 * - `childPos = contactPos − childRot · childFrame.translation`
 *
 * Seating never rescales: the returned `scale` is unit (the engine never
 * mirrors, and an affordance is a contact, not a resize). Wiring the film
 * layer's `attachTo` verb to affordance targets (baking a follow clip the way
 * `compileAttach` does for bones) is a follow-up — this is the primitive it
 * will call per frame.
 *
 * @author Samchon
 */
export const resolveAffordanceSeat = (props: {
  /** Parent model root in world space. */
  parentWorld: IAutoMovieTransform;

  /** The parent's contact point (any kind — seating is pure frame alignment). */
  parentAffordance: IAutoMovieAffordance;

  /**
   * The child's own contact point to land on the parent's, or `null` to seat
   * the child root origin directly on the parent's contact frame.
   */
  childAffordance?: IAutoMovieAffordance | null;
}): IAutoMovieTransform => {
  const parent = props.parentWorld;
  const frame = props.parentAffordance.frame;
  const contactPosition = Vector3.add(
    parent.translation,
    Quaternion.rotateVector(parent.rotation, frame.translation),
  );
  const contactRotation = Quaternion.multiply(parent.rotation, frame.rotation);

  const child = props.childAffordance ?? null;
  if (child === null)
    return {
      translation: contactPosition,
      rotation: contactRotation,
      scale: UNIT_SCALE,
    };

  const childRotation = Quaternion.multiply(
    contactRotation,
    inverse(child.frame.rotation),
  );
  return {
    translation: Vector3.subtract(
      contactPosition,
      Quaternion.rotateVector(childRotation, child.frame.translation),
    ),
    rotation: childRotation,
    scale: UNIT_SCALE,
  };
};
