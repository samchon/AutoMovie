import {
  IAutoMovieCompiledFormation,
  IAutoMovieFormationMotion,
  IAutoMovieModel,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { sampleFormationMotion, transformFormationBounds } from "../formation";
import { productionRuntimeModelId } from "../productionIdentity";
import {
  DEFAULT_SUBJECT_HEIGHT,
  computeModelRestExtentY,
  placeTransformedPoint,
} from "./cameraMove";

/**
 * The world-space axis-aligned box a camera must contain to show a subject.
 *
 * Structurally the same record a compiled formation states its bounds in, so a
 * unit's own bounds pass straight through here without a conversion that could
 * disagree with them. It is spelled separately because a subject is not only a
 * formation: two actors, a prop and a crowd together, or one figure, all reduce
 * to the same box, and the framing solve reads nothing else.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion IAutoMovieSubjectBox carries the subject's current world-space minimum and maximum rather than substituting rest geometry for live extent.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants IAutoMovieSubjectBox realizes dynamic-bounds invariants: The world-space axis-aligned box a camera must contain to show a subject. Structurally the same record a compiled formation states its bounds in, so a unit's own bounds pass straight through here without a conversion that could disagree with them. It is spelled separately because a subject is not only a formation: two actors, a prop and a crowd together, or one figure, all reduce to the same box, and the framing solve reads nothing else.
 * @author Samchon
 */
export interface IAutoMovieSubjectBox {
  /**
   * Minimum world corner.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion IAutoMovieSubjectBox.min exposes state-dependent asset extent: Minimum world corner.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants IAutoMovieSubjectBox.min realizes dynamic-bounds invariants: Minimum world corner.
   */
  min: IAutoMovieVector3;

  /**
   * Maximum world corner.
   *
   * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion IAutoMovieSubjectBox.max exposes state-dependent asset extent: Maximum world corner.
   * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants IAutoMovieSubjectBox.max realizes dynamic-bounds invariants: Maximum world corner.
   */
  max: IAutoMovieVector3;
}

/**
 * What the framing grammar solves a camera distance and an aim height from.
 *
 * `base` is the bottom of what the camera sees, `height` the vertical span
 * above it, and `radius` half the widest horizontal span, measured about the
 * base rather than about any one member. The three together are the box below,
 * restated in the terms {@link compileCameraMove} consumes.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedBox exposes the base, height, and radius consumed directly by the landmark framing solve.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedBox realizes landmark-based framing: What the framing grammar solves a camera distance and an aim height from. `base` is the bottom of what the camera sees, `height` the vertical span above it, and `radius` half the widest horizontal span, measured about the base rather than about any one member. The three together are the box below, restated in the terms {@link compileCameraMove} consumes.
 */
export interface IAutoMovieFramedBox {
  /**
   * Bottom-centre of the box.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedBox.base drives required-landmark framing: Bottom-centre of the box.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedBox.base realizes landmark-based framing: Bottom-centre of the box.
   */
  base: IAutoMovieVector3;

  /**
   * Vertical span of the box, in meters.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedBox.height drives required-landmark framing: Vertical span of the box, in meters.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedBox.height realizes landmark-based framing: Vertical span of the box, in meters.
   */
  height: number;

  /**
   * Half the box's horizontal diagonal, in meters.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedBox.radius drives required-landmark framing: Half the box's horizontal diagonal, in meters.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedBox.radius realizes landmark-based framing: Half the box's horizontal diagonal, in meters.
   */
  radius: number;
}

/**
 * One member's model-space vertical extent inside a compiled formation.
 *
 * A formation stores where its members STAND, not how tall they are: the
 * compiled bounds are the box of slot positions, so their vertical span is the
 * ground's, and a camera solved from it frames a crowd as a flat carpet. The
 * member's own model supplies the missing dimension, measured through
 * {@link computeModelRestExtentY} — the same read a node subject is measured
 * with, so a hero promoted out of the unit and its anonymous neighbours are the
 * same height by construction.
 *
 * Falls back to {@link DEFAULT_SUBJECT_HEIGHT} standing on the slot when the
 * recipe's runtime model was not supplied or draws nothing, which is the same
 * documented stand-in a subject with no measurable geometry has always taken.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion formationMemberExtent measures the addressed member's live formation slot and model height before world-space union.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants formationMemberExtent realizes dynamic-bounds invariants: One member's model-space vertical extent inside a compiled formation. A formation stores where its members STAND, not how tall they are: the compiled bounds are the box of slot positions, so their vertical span is the ground's, and a camera solved from it frames a crowd as a flat carpet. The member's own model supplies the missing dimension, measured through {@link computeModelRestExtentY} — the same read a node subject is measured with, so a hero promoted out of the unit and its anonymous neighbours are the same height by construction. Falls back to {@link DEFAULT_SUBJECT_HEIGHT} standing on the slot when the recipe's runtime model was not supplied or draws nothing, which is the same documented stand-in a subject with no measurable geometry has always taken.
 */
export const formationMemberExtent = (
  formation: Pick<IAutoMovieCompiledFormation, "modelRecipe">,
  models: readonly IAutoMovieModel[] | undefined,
): { min: number; max: number } => {
  const id = productionRuntimeModelId(formation.modelRecipe);
  const model = (models ?? []).find((candidate) => candidate.id === id);
  const extent = model === undefined ? null : computeModelRestExtentY(model);
  return extent === null || extent.max - extent.min < 0.1
    ? { min: 0, max: DEFAULT_SUBJECT_HEIGHT }
    : extent;
};

/**
 * The box one formation's members occupy at a shot-local instant.
 *
 * The unit's designed bounds go through {@link transformFormationBounds} under
 * the cue {@link sampleFormationMotion} reports at that instant, so a mass that
 * has marched, wheeled, or closed its ranks is framed where it actually is.
 * Both reads are the compiler's own: the ground gate that refuses a member
 * standing off its staged surface asks the same two functions the same way, and
 * a second implementation here is how a gate and a camera come to disagree
 * about where a unit is.
 *
 * The transformed slot box is then widened by the member radius the compiler
 * already derived for LOD projection and raised by the member's own extent,
 * because the box of slot POSITIONS is a footprint: the outermost member's body
 * hangs over its edge and its head stands above it.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion formationSubjectBox unions every member's sampled world extent at the addressed shot time into one live formation bound.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants formationSubjectBox realizes dynamic-bounds invariants: The box one formation's members occupy at a shot-local instant. The unit's designed bounds go through {@link transformFormationBounds} under the cue {@link sampleFormationMotion} reports at that instant, so a mass that has marched, wheeled, or closed its ranks is framed where it actually is. Both reads are the compiler's own: the ground gate that refuses a member standing off its staged surface asks the same two functions the same way, and a second implementation here is how a gate and a camera come to disagree about where a unit is. The transformed slot box is then widened by the member radius the compiler already derived for LOD projection and raised by the member's own extent, because the box of slot POSITIONS is a footprint: the outermost member's body hangs over its edge and its head stands above it.
 */
export const formationSubjectBox = (props: {
  /** The unit being framed. */
  formation: IAutoMovieCompiledFormation;
  /** Every compact cue in the shot; those of other units are ignored. */
  motions: readonly IAutoMovieFormationMotion[];
  /** One member's model-space vertical extent ({@link formationMemberExtent}). */
  member: { min: number; max: number };
  /** Shot-local seconds at which the cue is sampled. */
  seconds: number;
}): IAutoMovieSubjectBox => {
  const moved = transformFormationBounds(
    props.formation.bounds,
    props.formation.anchor,
    sampleFormationMotion(
      props.motions,
      props.formation.id,
      Math.max(0, props.seconds),
    ),
    props.formation.facingDeg,
  );
  const pad = Math.max(0, props.formation.projectionRadius);
  return {
    min: {
      x: moved.min.x - pad,
      y: moved.min.y + props.member.min,
      z: moved.min.z - pad,
    },
    max: {
      x: moved.max.x + pad,
      y: moved.max.y + props.member.max,
      z: moved.max.z + pad,
    },
  };
};

/**
 * The box one staged point occupies, given the vertical extent of what stands
 * there. `extent` is stated relative to the point and carries its own floor, so
 * a model whose geometry begins above its node origin is boxed where it draws
 * rather than at the placement it hangs from.
 *
 * Horizontally degenerate, because a placement is a point and a height is not a
 * width. This is the shape of a subject nothing could be measured for — a node
 * with no compiled model, whose span is its rig's or the stand-in's, and neither
 * of those states a horizontal extent any more than it states a floor. A subject
 * that does draw geometry is boxed by {@link nodeSubjectBox} from what it draws.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion pointSubjectBox exposes state-dependent asset extent: The box one staged point occupies, given the vertical extent of what stands there, carrying the extent's own floor so geometry authored above its node origin is boxed where it draws. Horizontally degenerate, because this is the shape of a subject nothing could be measured for: a rig span and the stand-in height state no width any more than they state a floor.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants pointSubjectBox realizes dynamic-bounds invariants: The box one staged point occupies, given the vertical extent of what stands there, carrying the extent's own floor so geometry authored above its node origin is boxed where it draws. Horizontally degenerate, because this is the shape of a subject nothing could be measured for: a rig span and the stand-in height state no width any more than they state a floor.
 */
export const pointSubjectBox = (
  point: IAutoMovieVector3,
  extent: { min: number; max: number },
): IAutoMovieSubjectBox => ({
  min: { x: point.x, y: point.y + extent.min, z: point.z },
  max: { x: point.x, y: point.y + extent.max, z: point.z },
});

/**
 * The world box one staged node fills, given the model-space box of what it
 * draws.
 *
 * The eight corners of `extent` go through the node's own placement
 * ({@link placeTransformedPoint}, the arithmetic that placed the parts the
 * extent was measured from) and the result is their axis-aligned range, so a
 * yawed or scaled element is boxed where it stands rather than where its model
 * file happens to lie.
 *
 * **This is the one answer both sides of a shot read.** `performShot` frames a
 * node subject from it and `realizeShotContract` grades the same subject from
 * it, which is what makes the check honest: a camera solved to hold a mass is
 * tested against the mass it was solved for. Measuring the width on one side
 * only would be worse than measuring it on neither — grading a 60 m facade on
 * its true box while the solve still aimed at its element origin would refuse
 * shots no authored camera could then satisfy.
 *
 * An extent lying on the node's own vertical axis is a point with a height
 * rather than geometry — the shape {@link nodeSubjectExtent} returns when
 * nothing could be measured — and it goes to {@link pointSubjectBox} instead.
 * There is nothing to place, so the only part of the placement that could
 * matter is where it stands: a rotation cannot turn a segment about the axis it
 * lies on, and a scale must not stretch the height, because a rig span and the
 * stand-in are inventions about the subject rather than measurements of it, and
 * scaling an invention states something the model never did.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion nodeSubjectBox exposes state-dependent asset extent: The world box one staged node fills, the eight corners of its drawn model-space box carried through its own placement, so a yawed or scaled element is bounded where it stands.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants nodeSubjectBox realizes dynamic-bounds invariants: The world box one staged node fills, given the model-space box of what it draws. The eight corners of extent go through the node's own placement, the arithmetic that placed the parts the extent was measured from, and the result is their axis-aligned range, so a yawed or scaled element is boxed where it stands rather than where its model file happens to lie. This is the one answer both sides of a shot read: performShot frames a node subject from it and realizeShotContract grades the same subject from it, which is what makes the check honest. An extent with no horizontal span states that nothing was measured and goes to pointSubjectBox instead, because a rig span and the stand-in are inventions about the subject rather than measurements of it, and scaling an invention states something the model never did.
 */
export const nodeSubjectBox = (
  placement: IAutoMovieTransform,
  extent: IAutoMovieSubjectBox,
): IAutoMovieSubjectBox => {
  if (
    extent.min.x === 0 &&
    extent.max.x === 0 &&
    extent.min.z === 0 &&
    extent.max.z === 0
  )
    return pointSubjectBox(placement.translation, {
      min: extent.min.y,
      max: extent.max.y,
    });
  const min: IAutoMovieVector3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: IAutoMovieVector3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const x of [extent.min.x, extent.max.x])
    for (const y of [extent.min.y, extent.max.y])
      for (const z of [extent.min.z, extent.max.z]) {
        const corner = placeTransformedPoint(placement, { x, y, z });
        if (corner.x < min.x) min.x = corner.x;
        if (corner.y < min.y) min.y = corner.y;
        if (corner.z < min.z) min.z = corner.z;
        if (corner.x > max.x) max.x = corner.x;
        if (corner.y > max.y) max.y = corner.y;
        if (corner.z > max.z) max.z = corner.z;
      }
  return { min, max };
};

/**
 * The model-space box a node subject is framed and graded from: what its model
 * draws when the compiler supplied one, and the horizontally degenerate segment
 * a rig span or the stand-in height describes when it did not.
 *
 * Stated once because a node is measured by the framing solve and again by the
 * contract check, and two answers to "what does he fill" is how a shot comes to
 * be graded against a subject nobody framed. `extent` is the drawn box
 * `computeModelRestExtent` measured, or null when the model measured nothing;
 * `rigHeight` is the joint span standing in for it, or null when there is no
 * rig either.
 *
 * A model too short to measure keeps the stand-in height and its own floor, and
 * keeps its measured width: a plaza slab 60 m across and 20 mm thick is a real
 * horizontal extent even where its vertical one is unusable.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion nodeSubjectExtent exposes state-dependent asset extent: The model-space box a node subject is framed and graded from, the drawn box when a model was compiled and the degenerate segment a rig span or the stand-in height describes when it was not.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants nodeSubjectExtent realizes dynamic-bounds invariants: The model-space box a node subject is framed and graded from: what its model draws when the compiler supplied one, and the horizontally degenerate segment a rig span or the stand-in height describes when it did not. Stated once because a node is measured by the framing solve and again by the contract check, and two answers to what he fills is how a shot comes to be graded against a subject nobody framed. A model too short to measure keeps the stand-in height and its own floor, and keeps its measured width: a plaza slab 60 m across and 20 mm thick is a real horizontal extent even where its vertical one is unusable.
 */
export const nodeSubjectExtent = (
  extent: IAutoMovieSubjectBox | null,
  rigHeight: number | null,
): IAutoMovieSubjectBox => {
  const measured =
    extent === null ? (rigHeight ?? 0) : extent.max.y - extent.min.y;
  const height = measured >= 0.1 ? measured : DEFAULT_SUBJECT_HEIGHT;
  const floor = extent === null ? 0 : extent.min.y;
  return extent === null
    ? {
        min: { x: 0, y: floor, z: 0 },
        max: { x: 0, y: floor + height, z: 0 },
      }
    : {
        min: extent.min,
        max: { x: extent.max.x, y: floor + height, z: extent.max.z },
      };
};

/**
 * The smallest box containing every given box, or null when none were given.
 *
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion unionSubjectBoxes exposes state-dependent asset extent: The smallest box containing every given box, or null when none were given.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-dynamic-bounds-invariants unionSubjectBoxes realizes dynamic-bounds invariants: The smallest box containing every given box, or null when none were given.
 */
export const unionSubjectBoxes = (
  boxes: readonly IAutoMovieSubjectBox[],
): IAutoMovieSubjectBox | null =>
  boxes.length === 0
    ? null
    : {
        min: {
          x: Math.min(...boxes.map((box) => box.min.x)),
          y: Math.min(...boxes.map((box) => box.min.y)),
          z: Math.min(...boxes.map((box) => box.min.z)),
        },
        max: {
          x: Math.max(...boxes.map((box) => box.max.x)),
          y: Math.max(...boxes.map((box) => box.max.y)),
          z: Math.max(...boxes.map((box) => box.max.z)),
        },
      };

/**
 * Restate a world box as the base, height and radius the framing grammar solves
 * from.
 *
 * `radius` is HALF THE HORIZONTAL DIAGONAL rather than half the wider side. A
 * camera approaches on its staged bearing and an `orbit` sweeps that bearing 45
 * degrees, so the horizontal span the frame must hold varies with the bearing,
 * and its widest value over every bearing is exactly the box's diagonal.
 * Solving from the diagonal is therefore the one answer that holds from every
 * side, which is what keeps a crowd inside the frame for the whole of a move
 * instead of only at the instant the distance was solved.
 *
 * `base` is the box's bottom centre, not the members' centroid: a mass that is
 * denser on one flank has a centroid off its own middle, and framing there puts
 * the thin flank out of frame.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing framedBoxOf converts current world bounds into the base, vertical span, and horizontal radius required by landmark framing.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations framedBoxOf realizes landmark-based framing: Restate a world box as the base, height and radius the framing grammar solves from. `radius` is HALF THE HORIZONTAL DIAGONAL rather than half the wider side. A camera approaches on its staged bearing and an `orbit` sweeps that bearing 45 degrees, so the horizontal span the frame must hold varies with the bearing, and its widest value over every bearing is exactly the box's diagonal. Solving from the diagonal is therefore the one answer that holds from every side, which is what keeps a crowd inside the frame for the whole of a move instead of only at the instant the distance was solved. `base` is the box's bottom centre, not the members' centroid: a mass that is denser on one flank has a centroid off its own middle, and framing there puts the thin flank out of frame.
 */
export const framedBoxOf = (
  box: IAutoMovieSubjectBox,
): IAutoMovieFramedBox => ({
  base: {
    x: (box.min.x + box.max.x) / 2,
    y: box.min.y,
    z: (box.min.z + box.max.z) / 2,
  },
  height: box.max.y - box.min.y,
  radius: Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
});
