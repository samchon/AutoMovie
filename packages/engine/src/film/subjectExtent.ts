import {
  IAutoMovieCompiledFormation,
  IAutoMovieFormationMotion,
  IAutoMovieModel,
  IAutoMovieVector3,
} from "@automovie/interface";

import { sampleFormationMotion, transformFormationBounds } from "../formation";
import { productionRuntimeModelId } from "../productionIdentity";
import { DEFAULT_SUBJECT_HEIGHT, computeModelRestExtentY } from "./cameraMove";

/**
 * The world-space axis-aligned box a camera must contain to show a subject.
 *
 * Structurally the same record a compiled formation states its bounds in, so a
 * unit's own bounds pass straight through here without a conversion that could
 * disagree with them. It is spelled separately because a subject is not only a
 * formation: two actors, a prop and a crowd together, or one figure, all reduce
 * to the same box, and the framing solve reads nothing else.
 *
 * @author Samchon
 */
export interface IAutoMovieSubjectBox {
  /** Minimum world corner. */
  min: IAutoMovieVector3;

  /** Maximum world corner. */
  max: IAutoMovieVector3;
}

/**
 * What the framing grammar solves a camera distance and an aim height from.
 *
 * `base` is the bottom of what the camera sees, `height` the vertical span
 * above it, and `radius` half the widest horizontal span, measured about the
 * base rather than about any one member. The three together are the box below,
 * restated in the terms {@link compileCameraMove} consumes.
 */
export interface IAutoMovieFramedBox {
  /** Bottom-centre of the box. */
  base: IAutoMovieVector3;

  /** Vertical span of the box, in meters. */
  height: number;

  /** Half the box's horizontal diagonal, in meters. */
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
 * there. Horizontally degenerate on purpose: a placement is a point, and the
 * only honest horizontal span a group of placements has is the spread between
 * them. Inventing a body width per member would put a number the renderer never
 * drew into the camera solve.
 */
export const pointSubjectBox = (
  point: IAutoMovieVector3,
  extent: { min: number; max: number },
): IAutoMovieSubjectBox => ({
  min: { x: point.x, y: point.y + extent.min, z: point.z },
  max: { x: point.x, y: point.y + extent.max, z: point.z },
});

/** The smallest box containing every given box, or null when none were given. */
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
