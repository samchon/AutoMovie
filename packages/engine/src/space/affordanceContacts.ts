import {
  IAutoMovieAffordance,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * The world-space support contacts of a `"stack-top"` affordance — its extent
 * corners carried through the affordance frame and the parent's world
 * transform, in exactly the shape {@link detectSupportToppling} and
 * {@link supportContactsFor} consume.
 *
 * This is the #601/#605 bridge that makes stacking judgeable end-to-end: crate
 * B seated on crate A's top (via `resolveAffordanceSeat`) is stable when its
 * center of mass projects inside these contacts' hull, and topples when it
 * overhangs — the same judgment a floor or table surface gets, now supplied by
 * the object itself.
 *
 * Each extent corner is a point in the affordance frame's XZ plane (`y`
 * ignored, per {@link IAutoMovieAffordance.extent}): it is lifted into the model
 * frame through the affordance `frame`, then into world through `parentWorld`
 * (the {@link resolveAttachment} composition convention — no scale folding, the
 * engine never mirrors).
 *
 * Throws on a non-`stack-top` kind or a missing extent: feeding a handle to the
 * support judgment is a mis-wired pipeline, not a skippable frame
 * ({@link validateModel} rejects such data before it gets here).
 *
 * @author Samchon
 */
export const affordanceSupportContacts = (props: {
  /** The declared contact face — must be a `"stack-top"` with an extent. */
  affordance: IAutoMovieAffordance;

  /** The owning model's root in world space. */
  parentWorld: IAutoMovieTransform;
}): IAutoMovieVector3[] => {
  const { affordance, parentWorld } = props;
  if (affordance.kind !== "stack-top")
    throw new Error(
      `affordanceSupportContacts: "${affordance.id}" is a "${affordance.kind}", not a "stack-top"`,
    );
  if (affordance.extent === null)
    throw new Error(
      `affordanceSupportContacts: stack-top "${affordance.id}" has no extent`,
    );

  const frame = affordance.frame;
  return affordance.extent.map((corner): IAutoMovieVector3 => {
    const inModel = Vector3.add(
      frame.translation,
      Quaternion.rotateVector(frame.rotation, {
        x: corner.x,
        y: 0,
        z: corner.z,
      }),
    );
    return Vector3.add(
      parentWorld.translation,
      Quaternion.rotateVector(parentWorld.rotation, inModel),
    );
  });
};
