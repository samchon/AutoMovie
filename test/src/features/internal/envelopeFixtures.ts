import type {
  IAutoMovieBuiltBoundary,
  IAutoMovieBuiltEnvironment,
  IAutoMovieConvexSpaceCell,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * Hand-typed building records the envelope derivations are calibrated against.
 *
 * Every face frame here is written out as literal metres and a literal
 * quaternion rather than generated from a footprint. A generator would be a
 * second implementation of the very placement the derivation under test
 * performs, so a sign error in one would confirm the same sign error in the
 * other. These records are the reference shape the reading convention is fixed
 * on.
 */

/** Sine and cosine of forty-five degrees, typed rather than computed. */
const QUARTER = 0.7071067811865476;

/** The five rigid placements every hand-written face frame is built from. */
export const FACE_ROTATION = {
  /** Local `+Z` stays world `+Z`. */
  keepZ: { x: 0, y: 0, z: 0, w: 1 } satisfies IAutoMovieQuaternion,
  /** Half turn about `+Y`: local `+Z` becomes world `-Z`. */
  halfTurnY: { x: 0, y: 1, z: 0, w: 0 } satisfies IAutoMovieQuaternion,
  /** Quarter turn about `+Y`: local `+Z` becomes world `+X`. */
  quarterY: {
    x: 0,
    y: QUARTER,
    z: 0,
    w: QUARTER,
  } satisfies IAutoMovieQuaternion,
  /** Quarter turn about `-Y`: local `+Z` becomes world `-X`. */
  quarterMinusY: {
    x: 0,
    y: -QUARTER,
    z: 0,
    w: QUARTER,
  } satisfies IAutoMovieQuaternion,
  /** Quarter turn about `-X`: local `+Z` becomes world `+Y`. */
  quarterMinusX: {
    x: -QUARTER,
    y: 0,
    z: 0,
    w: QUARTER,
  } satisfies IAutoMovieQuaternion,
  /** Quarter turn about `+X`: local `+Z` becomes world `-Y`. */
  quarterX: {
    x: QUARTER,
    y: 0,
    z: 0,
    w: QUARTER,
  } satisfies IAutoMovieQuaternion,
} as const;

/** The identity placement every fixture element is staged at. */
export const originTransform = (): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** The six half-spaces cutting one axis-aligned box out of world space. */
export const boxCell = (
  id: string,
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
): IAutoMovieConvexSpaceCell => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});

/** One rectangular separation with its face frame written out in full. */
const wall = (props: {
  id: string;
  kind: string;
  /** The one space this encloses, or the two it separates. */
  space: string | readonly string[];
  origin: IAutoMovieVector3;
  rotation: IAutoMovieQuaternion;
  width: number;
  height: number;
}): IAutoMovieBuiltBoundary => ({
  id: props.id,
  kind: props.kind,
  spaces: typeof props.space === "string" ? [props.space] : [...props.space],
  elements: [],
  face: {
    origin: props.origin,
    rotation: props.rotation,
    outline: [
      { x: 0, y: 0 },
      { x: props.width, y: 0 },
      { x: props.width, y: props.height },
      { x: 0, y: props.height },
    ],
    thickness: 0.2,
  },
});

/**
 * One rectangular hall four metres east, three high, six deep, at the origin.
 *
 * Four wall faces, one roof and one floor enclose the single space `hall`, and
 * one door is cut through the south wall. This is the shape the survey guidance
 * draws as four perpendicular facade views plus four corner obliques, so the
 * derived populations can be read straight off the diagram.
 */
export const rectangularBuilding = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "hall-house",
  units: "meter",
  buildings: [{ id: "house", element: "house-root", space: "hall" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "house-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: "hall",
    },
  ],
  spaces: [
    {
      id: "hall",
      kind: "room",
      parent: null,
      cells: [boxCell("hall-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 })],
    },
  ],
  boundaries: [
    wall({
      id: "wall-north",
      kind: "wall",
      space: "hall",
      origin: { x: 0, y: 0, z: 6 },
      rotation: FACE_ROTATION.keepZ,
      width: 4,
      height: 3,
    }),
    wall({
      id: "wall-south",
      kind: "wall",
      space: "hall",
      origin: { x: 4, y: 0, z: 0 },
      rotation: FACE_ROTATION.halfTurnY,
      width: 4,
      height: 3,
    }),
    wall({
      id: "wall-east",
      kind: "wall",
      space: "hall",
      origin: { x: 4, y: 0, z: 6 },
      rotation: FACE_ROTATION.quarterY,
      width: 6,
      height: 3,
    }),
    wall({
      id: "wall-west",
      kind: "wall",
      space: "hall",
      origin: { x: 0, y: 0, z: 0 },
      rotation: FACE_ROTATION.quarterMinusY,
      width: 6,
      height: 3,
    }),
    wall({
      id: "roof-top",
      kind: "roof",
      space: "hall",
      origin: { x: 0, y: 3, z: 6 },
      rotation: FACE_ROTATION.quarterMinusX,
      width: 4,
      height: 6,
    }),
    wall({
      id: "floor-slab",
      kind: "floor",
      space: "hall",
      origin: { x: 0, y: 0, z: 0 },
      rotation: FACE_ROTATION.quarterX,
      width: 4,
      height: 6,
    }),
  ],
  openings: [
    {
      id: "door-main",
      kind: "door",
      boundary: "wall-south",
      fill: null,
      profile: {
        outline: [
          { x: 1.5, y: 0 },
          { x: 2.5, y: 0 },
          { x: 2.5, y: 2.1 },
          { x: 1.5, y: 2.1 },
        ],
      },
    },
  ],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * One L-shaped wing whose notch produces exactly one reentrant corner.
 *
 * The footprint runs `(0,0) (4,0) (4,2) (2,2) (2,4) (0,4)` in world XZ and
 * stands three metres high. Its box centre falls inside the long arm, and the
 * far corner of its own bounding box falls in the notch, which is the case a
 * turntable around the box would photograph from outside the room.
 */
export const lFootprintBuilding = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "l-wing",
  units: "meter",
  buildings: [{ id: "wing", element: "wing-root", space: "hall" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "wing-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: "hall",
    },
  ],
  spaces: [
    {
      id: "hall",
      kind: "room",
      parent: null,
      cells: [
        boxCell("hall-main", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 2 }),
        boxCell("hall-arm", { x: 0, y: 0, z: 2 }, { x: 2, y: 3, z: 4 }),
      ],
    },
  ],
  boundaries: [
    wall({
      id: "wall-0",
      kind: "wall",
      space: "hall",
      origin: { x: 4, y: 0, z: 0 },
      rotation: FACE_ROTATION.halfTurnY,
      width: 4,
      height: 3,
    }),
    wall({
      id: "wall-1",
      kind: "wall",
      space: "hall",
      origin: { x: 4, y: 0, z: 2 },
      rotation: FACE_ROTATION.quarterY,
      width: 2,
      height: 3,
    }),
    wall({
      id: "wall-2",
      kind: "wall",
      space: "hall",
      origin: { x: 2, y: 0, z: 2 },
      rotation: FACE_ROTATION.keepZ,
      width: 2,
      height: 3,
    }),
    wall({
      id: "wall-3",
      kind: "wall",
      space: "hall",
      origin: { x: 2, y: 0, z: 4 },
      rotation: FACE_ROTATION.quarterY,
      width: 2,
      height: 3,
    }),
    wall({
      id: "wall-4",
      kind: "wall",
      space: "hall",
      origin: { x: 0, y: 0, z: 4 },
      rotation: FACE_ROTATION.keepZ,
      width: 2,
      height: 3,
    }),
    wall({
      id: "wall-5",
      kind: "wall",
      space: "hall",
      origin: { x: 0, y: 0, z: 0 },
      rotation: FACE_ROTATION.quarterMinusY,
      width: 4,
      height: 3,
    }),
  ],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * One two-storey house, four metres east, six deep, six high, in two rooms.
 *
 * The building's own space encloses and states no volume of its own, so the
 * storeys under it are the rooms that answer: `ground` from zero to three and
 * `upper` from three to six. That is what makes this fixture different from the
 * single-room ones beside it -- the unit owns two spaces rather than one, its
 * envelope is eight wall faces rather than four, and the slab between the
 * storeys separates two spaces instead of enclosing one.
 *
 * A stair joins them and lands twice: once on the ground at zero and once on
 * the upper floor at three. Two landings in one connector at two heights is the
 * case the landing address exists for, and addressing a landing by its space
 * alone would collapse a three-level lift in one atrium into a single view.
 */
export const twoStoreyBuilding = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "storey-house",
  units: "meter",
  buildings: [{ id: "house", element: "house-root", space: "house-interior" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "house-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: "house-interior",
    },
  ],
  spaces: [
    {
      id: "house-interior",
      kind: "building-interior",
      parent: null,
      // No cells and no shell: this states no volume, so it is the container
      // the storeys hang from and is charged no interior station of its own.
      cells: [],
    },
    {
      id: "ground",
      kind: "room",
      parent: "house-interior",
      cells: [
        boxCell("ground-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 }),
      ],
    },
    {
      id: "upper",
      kind: "room",
      parent: "house-interior",
      cells: [
        boxCell("upper-cell", { x: 0, y: 3, z: 0 }, { x: 4, y: 6, z: 6 }),
      ],
    },
  ],
  boundaries: [
    ...(["ground", "upper"] as const).flatMap((space) => {
      const base = space === "ground" ? 0 : 3;
      return [
        wall({
          id: `wall-north-${space}`,
          kind: "wall",
          space,
          origin: { x: 0, y: base, z: 6 },
          rotation: FACE_ROTATION.keepZ,
          width: 4,
          height: 3,
        }),
        wall({
          id: `wall-south-${space}`,
          kind: "wall",
          space,
          origin: { x: 4, y: base, z: 0 },
          rotation: FACE_ROTATION.halfTurnY,
          width: 4,
          height: 3,
        }),
        wall({
          id: `wall-east-${space}`,
          kind: "wall",
          space,
          origin: { x: 4, y: base, z: 6 },
          rotation: FACE_ROTATION.quarterY,
          width: 6,
          height: 3,
        }),
        wall({
          id: `wall-west-${space}`,
          kind: "wall",
          space,
          origin: { x: 0, y: base, z: 0 },
          rotation: FACE_ROTATION.quarterMinusY,
          width: 6,
          height: 3,
        }),
      ];
    }),
    wall({
      id: "roof-top",
      kind: "roof",
      space: "upper",
      origin: { x: 0, y: 6, z: 6 },
      rotation: FACE_ROTATION.quarterMinusX,
      width: 4,
      height: 6,
    }),
    wall({
      id: "floor-slab",
      kind: "floor",
      space: "ground",
      origin: { x: 0, y: 0, z: 0 },
      rotation: FACE_ROTATION.quarterX,
      width: 4,
      height: 6,
    }),
    wall({
      id: "storey-slab",
      kind: "floor",
      // The one boundary here that separates rather than encloses.
      space: ["ground", "upper"],
      origin: { x: 0, y: 3, z: 0 },
      rotation: FACE_ROTATION.quarterX,
      width: 4,
      height: 6,
    }),
  ],
  openings: [
    {
      id: "door-main",
      kind: "door",
      boundary: "wall-south-ground",
      fill: null,
      profile: {
        outline: [
          { x: 1.5, y: 0 },
          { x: 2.5, y: 0 },
          { x: 2.5, y: 2.1 },
          { x: 1.5, y: 2.1 },
        ],
      },
    },
  ],
  connectors: [
    {
      id: "stair",
      kind: "stair",
      from: "ground",
      to: "upper",
      bidirectional: true,
      route: [
        { x: 2, y: 0, z: 1 },
        { x: 2, y: 3, z: 3 },
      ],
      elements: [],
      landings: [
        { space: "ground", at: 0 },
        { space: "upper", at: 3 },
      ],
    },
  ],
  surfaces: [],
  walkable: [],
});
