import {
  DEFAULT_SUBJECT_HEIGHT,
  IAutoMovieResolvedCamera,
  formationMemberExtent,
  formationSubjectBox,
  framedBoxOf,
  intersectsPerspectiveFrustumBox,
  intersectsPerspectiveFrustumSegment,
  pointSubjectBox,
  unionSubjectBoxes,
} from "@automovie/engine";
import {
  IAutoMovieCompiledFormation,
  IAutoMovieFormationMotion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, vclose } from "../internal/predicates";

/** A line 100 m across and 20 m deep, its members half a meter wide. */
const UNIT: IAutoMovieCompiledFormation = {
  version: 1,
  id: "line",
  count: 2_000,
  anonymousCount: 2_000,
  modelRecipe: "member",
  layout: {
    kind: "line",
    ranks: 20,
    files: 100,
    spacing: { lateral: 1, depth: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  ground: [],
  facingDeg: 0,
  seed: 1,
  bounds: { min: { x: -50, y: 0, z: 0 }, max: { x: 50, y: 0, z: 20 } },
  centroid: { x: 0, y: 0, z: 10 },
  projectionRadius: 0.5,
  chunks: [],
  heroes: [],
  lod: [],
  phase: { seed: 1, periodSeconds: 1 },
  digest: "sha256:line",
};

/** One member, as tall as the stand-in the solve falls back to. */
const MEMBER = { min: 0, max: DEFAULT_SUBJECT_HEIGHT };

/** The unit marches 500 m to its right over the first second. */
const MARCH: IAutoMovieFormationMotion[] = [
  {
    id: "march",
    formation: "line",
    action: "advance",
    start: 0,
    end: 1,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 500, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    easing: "linear",
  },
];

const boxAt = (
  seconds: number,
  motions: IAutoMovieFormationMotion[] = [],
): ReturnType<typeof formationSubjectBox> =>
  formationSubjectBox({
    formation: UNIT,
    motions,
    member: MEMBER,
    seconds,
  });

const HALF_Y = Math.tan((40 * Math.PI) / 360);
const ASPECT = 16 / 9;

/** A camera at `position`, looking down world −Z (glTF identity). */
const lens = (position: IAutoMovieVector3): IAutoMovieResolvedCamera => ({
  position,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
});

const sees = (
  camera: IAutoMovieResolvedCamera,
  box: { min: IAutoMovieVector3; max: IAutoMovieVector3 },
  far = 200,
): boolean =>
  intersectsPerspectiveFrustumBox({
    camera,
    min: box.min,
    max: box.max,
    near: 0.1,
    far,
    halfY: HALF_Y,
    aspect: ASPECT,
  });

/** The old check: a 1.7 m segment standing at the unit's centroid. */
const seesCentroid = (camera: IAutoMovieResolvedCamera, far = 200): boolean =>
  intersectsPerspectiveFrustumSegment({
    camera,
    from: UNIT.centroid,
    to: {
      x: UNIT.centroid.x,
      y: UNIT.centroid.y + DEFAULT_SUBJECT_HEIGHT,
      z: UNIT.centroid.z,
    },
    near: 0.1,
    far,
    halfY: HALF_Y,
    aspect: ASPECT,
  });

/**
 * A formation is a subject with an extent: the box its members occupy, taken
 * from the unit's own transformed bounds, and judged for readability as that
 * box rather than as a segment at its centroid.
 *
 * A compiled formation stores where its members STAND, so its bounds are a
 * footprint: flat, and one member's body-width narrower than the unit really
 * is. The member's own extent supplies the height and the compiler's projection
 * radius the overhang, which is why the box below is `[-50.5, 50.5] × [0, 1.7]
 * × [-0.5, 20.5]` for a line designed `[-50, 50] × [0, 20]`.
 *
 * The readability consequence is the reason this matters. A hundred-meter line
 * cannot be inside a frame the way a person is; it reads when the frame holds
 * any part of it. The old segment answered for one point, so it called a unit
 * absent whenever the shot framed a flank, and the fix must find the flank
 * without merely calling everything readable.
 *
 * Scenarios:
 *
 * 1. The box is the transformed bounds, padded by a member's radius and raised by
 *    a member's height; reduced for the solve it gives the unit's bottom
 *    centre, its member height, and half its horizontal diagonal.
 * 2. A member with no supplied model takes the documented stand-in height, so a
 *    unit is never framed as a flat carpet.
 * 3. A camera aimed at the line's right flank reads the unit, while the segment at
 *    its centroid — 45 m off the lens axis — reports it absent. That gap IS the
 *    defect.
 * 4. A camera standing inside the line, seeing nothing but members, reads it too:
 *    no box edge enters so short a frustum, and only clipping the frustum's own
 *    edges against the box finds the overlap.
 * 5. A camera pointed away from the unit still reads nothing, so widening the test
 *    did not make a formation unconditionally present.
 * 6. A cue moves the box: the unit that marched 500 m to its right is no longer
 *    read by the camera that framed it at rest, because the box is measured
 *    under the cue playing at that instant.
 * 7. A group's box is the union of what its members occupy, so a node standing
 *    behind the line widens the same subject.
 */
export const test_film_camera_formation_subject_extent = (): void => {
  const rest = boxAt(0);
  TestValidator.equals(
    "the box is the unit's transformed bounds, padded and raised",
    namedFacts([
      ["min", () => vclose(rest.min, { x: -50.5, y: 0, z: -0.5 })],
      [
        "max",
        () => vclose(rest.max, { x: 50.5, y: DEFAULT_SUBJECT_HEIGHT, z: 20.5 }),
      ],
      ["base", () => vclose(framedBoxOf(rest).base, { x: 0, y: 0, z: 10 })],
      [
        "height",
        () => nclose(framedBoxOf(rest).height, DEFAULT_SUBJECT_HEIGHT),
      ],
      [
        "radius",
        () => nclose(framedBoxOf(rest).radius, Math.hypot(101, 21) / 2),
      ],
    ]),
    { min: true, max: true, base: true, height: true, radius: true },
  );

  TestValidator.equals(
    "an unsupplied member model takes the documented stand-in height",
    formationMemberExtent(UNIT, []),
    { min: 0, max: DEFAULT_SUBJECT_HEIGHT },
  );

  TestValidator.equals(
    "the frame that holds a flank reads the unit the centroid cannot",
    namedFacts([
      ["theUnitReads", () => sees(lens({ x: 45, y: 1, z: 30 }), rest)],
      ["theCentroidDoesNot", () => seesCentroid(lens({ x: 45, y: 1, z: 30 }))],
    ]),
    { theUnitReads: true, theCentroidDoesNot: false },
  );

  TestValidator.equals(
    "a camera standing inside the unit reads it",
    namedFacts([
      ["theUnitReads", () => sees(lens({ x: 0, y: 0.85, z: 10 }), rest, 5)],
      [
        "theCentroidDoesNot",
        () => seesCentroid(lens({ x: 0, y: 0.85, z: 10 }), 5),
      ],
    ]),
    { theUnitReads: true, theCentroidDoesNot: false },
  );

  TestValidator.predicate(
    "a camera pointed away from the unit reads nothing",
    sees(lens({ x: 0, y: 1, z: -100 }), rest) === false,
  );

  const marched = boxAt(1, MARCH);
  TestValidator.equals(
    "a cue moves the box the camera is graded against",
    namedFacts([
      ["marched", () => nclose(marched.min.x, rest.min.x + 500)],
      ["heldItsDepth", () => nclose(marched.max.z, rest.max.z)],
      ["atRestItReads", () => sees(lens({ x: 0, y: 1, z: 60 }), rest)],
      ["marchedItDoesNot", () => sees(lens({ x: 0, y: 1, z: 60 }), marched)],
    ]),
    {
      marched: true,
      heldItsDepth: true,
      atRestItReads: true,
      marchedItDoesNot: false,
    },
  );

  const withScout = unionSubjectBoxes([
    rest,
    pointSubjectBox({ x: 0, y: 0, z: -30 }, MEMBER),
  ]);
  TestValidator.equals(
    "a group's box is the union of what its members occupy",
    namedFacts([
      ["union", () => withScout !== null],
      ["reachedTheScout", () => nclose(withScout!.min.z, -30)],
      ["keptTheLine", () => nclose(withScout!.max.x, 50.5)],
      [
        "widerThanTheLineAlone",
        () => framedBoxOf(withScout!).radius > framedBoxOf(rest).radius,
      ],
    ]),
    {
      union: true,
      reachedTheScout: true,
      keptTheLine: true,
      widerThanTheLineAlone: true,
    },
  );
};
