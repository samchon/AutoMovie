import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltOpening,
  IAutoMovieBuiltSpace,
  IAutoMovieConvexSpaceCell,
  IAutoMoviePlanarPoint,
  IAutoMovieSubjectBox,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { compareAutoMovieRenderIds } from "../render/renderDigest";
import {
  builtEnvironmentBuildingOfSpace,
  builtEnvironmentDescendantSpaces,
  builtEnvironmentSpaceConnectors,
  builtSpaceContainsPoint,
  builtSpaceStatesVolume,
} from "./builtEnvironment";
import { outlineHull, polygonBounds } from "./planarGeometry";

/**
 * Slack below which two derived quantities are treated as one.
 *
 * It is read two ways, and both land on the same number for the same reason.
 * As a length it is metres of building, so one micrometre is far below any
 * authored dimension and far above the drift a rotation and a linear solve
 * introduce. As the scalar triple product of three unit normals it is
 * dimensionless, and one micrometre of it is three planes so nearly coplanar
 * that the point they meet at is numerically meaningless.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Fixes the slack under which two derived observation stations are one station.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Bounds the numeric tolerance the derivation is deterministic under.
 */
export const AUTOMOVIE_OBSERVATION_EPSILON = 1e-6;

/**
 * Distance, in metres, a containment probe steps off a boundary face.
 *
 * A face plane sits on the surface of the volume it bounds, so a point exactly
 * on it answers containment ambiguously. One millimetre is smaller than any
 * room and larger than the containment epsilon, so the probe lands strictly
 * inside on one side and strictly outside on the other.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Fixes how far a probe steps off a face before asking which side a space is on.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Bounds the containment probe used to orient an envelope face.
 */
export const AUTOMOVIE_OBSERVATION_PROBE = 1e-3;

/**
 * Standing eye height, in metres, an interior observation is taken from.
 *
 * A room is judged from the height its user reads it at, and a camera dropped
 * to the floor or lifted to the slab reports proportions nobody experiences. A
 * room shorter than twice this height is observed from its own mid-height
 * instead, so a crawl space is not observed from inside its ceiling.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Places every interior station at the height its declared user reads the space from.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Fixes the deterministic interior eye height shared by every caller.
 */
export const AUTOMOVIE_OBSERVATION_EYE_HEIGHT = 1.6;

/**
 * Fractions, toward the interior centre, an interior station is nudged along.
 *
 * A corner station wants to stand as near its corner as the room admits, and a
 * threshold station as near its opening. Neither can stand on the boundary
 * itself, and how far in it must move depends on the wall thickness, the
 * chamfer, and whatever the room's own cells actually say. Walking a fixed
 * ladder toward the interior centre keeps that deterministic: two callers
 * asking for the same station receive the same point, and a station the ladder
 * cannot place is reported unplaced rather than dropped.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Keeps an interior station inside its own space without a caller-supplied inset.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Fixes the deterministic ladder every interior station is placed by.
 */
export const AUTOMOVIE_OBSERVATION_INSET_LADDER: readonly number[] = [
  0.05, 0.1, 0.2, 0.35, 0.5,
];

/**
 * How a bounding envelope face is read, from its own outward normal.
 *
 * The split is the ordinary architectural one at forty-five degrees: a
 * separation more vertical than horizontal is read in elevation and owes a
 * facade observation, while one more horizontal than vertical is read from
 * above or below and owes a roof or underside observation. The threshold is
 * geometric rather than a label, so a record that calls a steep mansard slope a
 * `roof` and a record that calls it a `wall` derive the same population.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Classifies each exposed separation into the observation role it owes.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the closed envelope-face aspect the derivation partitions by.
 */
export type AutoMovieEnvelopeFaceAspect = "facade" | "roof" | "underside";

/**
 * The vertical component above which an envelope face stops being a facade.
 *
 * `Math.SQRT1_2` is the sine of forty-five degrees, so a face tilted past that
 * is more horizontal than vertical.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Fixes the angle at which an exposed face changes the observation it owes.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Bounds the aspect partition with one stated constant.
 */
export const AUTOMOVIE_ENVELOPE_FACADE_LIMIT = Math.SQRT1_2;

/**
 * One exposed separation of a building unit, placed in world space.
 *
 * A separation is exposed when it encloses exactly one logical space, because
 * the record's other spelling names the two regions a separation stands
 * between. What is left over is the envelope, which is precisely the population
 * a facade, corner, and roof review is counted over.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Names each exposed envelope face a building owes an observation for.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the world-placed envelope face the observation population is derived from.
 */
export interface IAutoMovieBuiltEnvelopeFace {
  /** Boundary whose face this is. */
  boundary: string;
  /** Building unit owning the enclosed space. */
  building: string;
  /** The one logical space this separation encloses. */
  space: string;
  /** Authored boundary label, preserved without being trusted for geometry. */
  kind: string;
  /** Observation role derived from the outward normal. */
  aspect: AutoMovieEnvelopeFaceAspect;
  /**
   * Unit normal pointing away from the enclosed space.
   *
   * Derived rather than copied. The authored frame states its own outward `+Z`,
   * and a face wound the other way would otherwise put every camera inside the
   * wall it was meant to photograph, so the direction is settled by asking the
   * space which side it is on.
   */
  normal: IAutoMovieVector3;
  /** Area-weighted world centroid of the face outline. */
  centroid: IAutoMovieVector3;
  /** Face outline in world metres, in authored order. */
  vertices: IAutoMovieVector3[];
  /** Authored separation thickness along the face normal, in metres. */
  thickness: number;
}

/**
 * One meeting of two exposed facades of the same building unit.
 *
 * `exterior` is a corner an observer walks around, and `reentrant` is one an
 * observer walks into. They fail differently: an exterior corner exposes how
 * two elevations join, while a reentrant corner is where an elevation hides
 * itself, which is exactly the face a facade-by-facade sweep leaves unread.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Names each corner the envelope population owes a perspective observation for.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the derived corner and the side of the envelope it stands on.
 */
export interface IAutoMovieBuiltEnvelopeCorner {
  /** Stable identity built from the two boundary ids in code-unit order. */
  id: string;
  /** Building unit both facades belong to. */
  building: string;
  /** The two boundary ids, in code-unit order. */
  facades: [string, string];
  /** Which side of the envelope the corner turns toward. */
  kind: "exterior" | "reentrant";
  /** World point the two facades meet at. */
  position: IAutoMovieVector3;
  /** Unit bisector of the two outward normals, pointing off the envelope. */
  normal: IAutoMovieVector3;
}

/**
 * One required interior viewpoint of one logical space.
 *
 * The population is closed and derived: four outward views from the interior
 * centre, four inward views from the corners of its own extent, and one
 * threshold view for every opening on one of its boundaries. A station whose
 * point cannot be placed inside the space keeps its identity and reports a null
 * pose, because a station that disappeared would shrink the denominator exactly
 * where the topology is hardest to read.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Enumerates the interior stations a space owes without letting a caller choose them.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the interior station and separates its identity from its resolved pose.
 */
export interface IAutoMovieSpaceObservationStation {
  /** Stable station identity inside its space. */
  id: string;
  /** Which of the three interior roles this station answers. */
  role: "center" | "corner" | "threshold";
  /** Opening this threshold station reads, or null for the other roles. */
  opening: string | null;
  /**
   * Where the eye stands and what it looks at, or null when no interior point
   * could be placed for it.
   */
  pose: {
    /** World eye position, proved inside the space's own stated volume. */
    position: IAutoMovieVector3;
    /** Unit view direction. */
    direction: IAutoMovieVector3;
    /** World point the eye is aimed at. */
    target: IAutoMovieVector3;
  } | null;
}

/**
 * The complete observation topology of one building unit.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Aggregates one building unit's exposed faces, corners, entrances, spaces, and routes as one denominator.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the building aggregate the compiled subject hierarchy and the review population share.
 */
export interface IAutoMovieBuildingObservationCensus {
  /** Building unit identity within its environment. */
  building: string;
  /** Exposed separations read in elevation. */
  facades: IAutoMovieBuiltEnvelopeFace[];
  /** Exposed separations read from above. */
  roofs: IAutoMovieBuiltEnvelopeFace[];
  /** Exposed separations read from below. */
  undersides: IAutoMovieBuiltEnvelopeFace[];
  /** Meetings of two exposed facades. */
  corners: IAutoMovieBuiltEnvelopeCorner[];
  /** Openings cut through an exposed separation, in code-unit order. */
  entrances: string[];
  /** Descendant spaces stating a volume, in code-unit order. */
  spaces: string[];
  /** Connectors landing in one of those spaces, in code-unit order. */
  connectors: string[];
}

/** Read a plane as a unit normal and its matching offset, or null if degenerate. */
const unitPlane = (plane: {
  normal: IAutoMovieVector3;
  offset: number;
}): { normal: IAutoMovieVector3; offset: number } | null => {
  const length = Vector3.length(plane.normal);
  if (length <= AUTOMOVIE_OBSERVATION_EPSILON) return null;
  return {
    normal: Vector3.scale(plane.normal, 1 / length),
    offset: plane.offset / length,
  };
};

/**
 * The corner points of one convex cell's own half-space intersection.
 *
 * A cell is stated as the planes that cut it rather than as the shape those
 * planes leave, so every question about where the room actually is starts by
 * solving them. Each triple of planes meets at one point when their normals are
 * independent, and the point belongs to the cell when every other plane admits
 * it. Unbounded cells simply produce fewer points, which is the honest answer
 * for a half-space that closes nothing.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Turns a stated space volume into the points an observation station can be measured against.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Derives the convex-cell corner set the interior station rule reads.
 */
export const builtConvexCellVertices = (
  cell: IAutoMovieConvexSpaceCell,
): IAutoMovieVector3[] => {
  const planes = cell.planes
    .map(unitPlane)
    .filter((plane): plane is { normal: IAutoMovieVector3; offset: number } =>
      Boolean(plane),
    );
  const vertices: IAutoMovieVector3[] = [];
  for (let i = 0; i < planes.length; i++)
    for (let j = i + 1; j < planes.length; j++)
      for (let k = j + 1; k < planes.length; k++) {
        const a = planes[i]!;
        const b = planes[j]!;
        const c = planes[k]!;
        const bc = Vector3.cross(b.normal, c.normal);
        const determinant = Vector3.dot(a.normal, bc);
        if (Math.abs(determinant) <= AUTOMOVIE_OBSERVATION_EPSILON) continue;
        const point = Vector3.scale(
          Vector3.add(
            Vector3.add(
              Vector3.scale(bc, a.offset),
              Vector3.scale(Vector3.cross(c.normal, a.normal), b.offset),
            ),
            Vector3.scale(Vector3.cross(a.normal, b.normal), c.offset),
          ),
          1 / determinant,
        );
        if (
          planes.some(
            (plane) =>
              Vector3.dot(plane.normal, point) >
              plane.offset + AUTOMOVIE_OBSERVATION_EPSILON,
          )
        )
          continue;
        if (
          vertices.some(
            (known) =>
              Vector3.length(Vector3.subtract(known, point)) <=
              AUTOMOVIE_OBSERVATION_EPSILON,
          )
        )
          continue;
        vertices.push(point);
      }
  return vertices;
};

/** Grow a box by one point, creating it when there is none yet. */
const includePoint = (
  box: IAutoMovieSubjectBox | null,
  point: IAutoMovieVector3,
): IAutoMovieSubjectBox =>
  box === null
    ? { min: { ...point }, max: { ...point } }
    : {
        min: {
          x: Math.min(box.min.x, point.x),
          y: Math.min(box.min.y, point.y),
          z: Math.min(box.min.z, point.z),
        },
        max: {
          x: Math.max(box.max.x, point.x),
          y: Math.max(box.max.y, point.y),
          z: Math.max(box.max.z, point.z),
        },
      };

/**
 * The world box one logical space's own stated volume occupies.
 *
 * Both spellings answer here so no consumer has to know which one a space used:
 * a shelled space is bounded by its own vertices and a celled space by the
 * corners its half-spaces cut. A space that states no volume, and a space whose
 * cells close nothing, report null rather than a box of the origin.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Measures the extent an interior observation population is laid out inside.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Derives one world extent from either stated volume spelling.
 */
export const builtSpaceVolumeBounds = (
  space: IAutoMovieBuiltSpace,
): IAutoMovieSubjectBox | null => {
  let box: IAutoMovieSubjectBox | null = null;
  if (space.shell !== undefined) {
    for (const vertex of space.shell.vertices) box = includePoint(box, vertex);
    return box;
  }
  for (const cell of space.cells)
    for (const vertex of builtConvexCellVertices(cell))
      box = includePoint(box, vertex);
  return box;
};

/** Area-weighted centroid of a planar outline, or its vertex mean when flat. */
const outlineCentroid = (
  outline: readonly IAutoMoviePlanarPoint[],
): IAutoMoviePlanarPoint => {
  let doubleArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < outline.length; index++) {
    const from = outline[index]!;
    const to = outline[(index + 1) % outline.length]!;
    const cross = from.x * to.y - to.x * from.y;
    doubleArea += cross;
    x += (from.x + to.x) * cross;
    y += (from.y + to.y) * cross;
  }
  if (Math.abs(doubleArea) <= AUTOMOVIE_OBSERVATION_EPSILON)
    return {
      x: outline.reduce((sum, point) => sum + point.x, 0) / outline.length,
      y: outline.reduce((sum, point) => sum + point.y, 0) / outline.length,
    };
  return { x: x / (3 * doubleArea), y: y / (3 * doubleArea) };
};

/**
 * Every exposed separation of every building unit, placed in world space.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Derives the exposed envelope population a facade and roof review is counted over.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Implements the envelope-face derivation shared by the census and the observation population.
 */
export const builtEnvironmentEnvelopeFaces = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvelopeFace[] => {
  const spaces = new Map(
    environment.spaces.map((space) => [space.id, space] as const),
  );
  const faces: IAutoMovieBuiltEnvelopeFace[] = [];
  for (const boundary of environment.boundaries) {
    const face = boundary.face;
    const [spaceId, ...rest] = boundary.spaces;
    if (face === undefined || spaceId === undefined || rest.length !== 0)
      continue;
    const space = spaces.get(spaceId);
    if (space === undefined) continue;
    const vertices = face.outline.map((point) =>
      Vector3.add(
        face.origin,
        Quaternion.rotateVector(face.rotation, {
          x: point.x,
          y: point.y,
          z: 0,
        }),
      ),
    );
    const local = outlineCentroid(face.outline);
    const centroid = Vector3.add(
      face.origin,
      Quaternion.rotateVector(face.rotation, {
        x: local.x,
        y: local.y,
        z: 0,
      }),
    );
    const authored = Vector3.normalize(
      Quaternion.rotateVector(face.rotation, { x: 0, y: 0, z: 1 }),
    );
    // The frame states its own outward direction, and a face wound the other
    // way would aim every derived camera into the wall. Ask the space which
    // side the frame points at instead: a probe that lands inside means the
    // authored direction points in. A probe that lands outside is kept, which
    // covers both the ordinary outward frame and a face standing off the volume
    // by its own wall thickness, where neither side of it is in the room.
    const normal = builtSpaceContainsPoint(
      space,
      Vector3.add(
        centroid,
        Vector3.scale(authored, AUTOMOVIE_OBSERVATION_PROBE),
      ),
    )
      ? Vector3.scale(authored, -1)
      : authored;
    faces.push({
      boundary: boundary.id,
      building: builtEnvironmentBuildingOfSpace(environment, space.id),
      space: space.id,
      kind: boundary.kind,
      aspect:
        normal.y > AUTOMOVIE_ENVELOPE_FACADE_LIMIT
          ? "roof"
          : normal.y < -AUTOMOVIE_ENVELOPE_FACADE_LIMIT
            ? "underside"
            : "facade",
      normal,
      centroid,
      vertices,
      thickness: face.thickness,
    });
  }
  return faces.sort((left, right) =>
    compareAutoMovieRenderIds(left.boundary, right.boundary),
  );
};

/**
 * Every meeting of two exposed facades of one building unit.
 *
 * Two facades meet when a corner of one stands within the thicker of the two
 * separations of a corner of the other, which is exactly the slack a wall's own
 * construction introduces between two faces authored on the same envelope
 * corner. The side the corner turns toward is read from the meeting point
 * itself: a corner is exterior when each facade's own body lies behind the
 * other's outward plane, and reentrant when it lies in front of it.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Derives the exterior and reentrant corner population an envelope review owes.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Implements the corner derivation and its exterior or reentrant classification.
 */
export const builtEnvironmentEnvelopeCorners = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuiltEnvelopeCorner[] => {
  const facades = builtEnvironmentEnvelopeFaces(environment).filter(
    (face) => face.aspect === "facade",
  );
  const corners: IAutoMovieBuiltEnvelopeCorner[] = [];
  for (let i = 0; i < facades.length; i++)
    for (let j = i + 1; j < facades.length; j++) {
      const a = facades[i]!;
      const b = facades[j]!;
      if (a.building !== b.building) continue;
      if (
        Vector3.length(Vector3.cross(a.normal, b.normal)) <=
        AUTOMOVIE_OBSERVATION_EPSILON
      )
        continue;
      const tolerance =
        Math.max(a.thickness, b.thickness) + AUTOMOVIE_OBSERVATION_EPSILON;
      // Two facades meeting at a building corner share a whole edge, so the
      // nearest pair is not one point but every pair along it. Averaging them
      // puts the corner at the middle of that edge rather than at whichever end
      // the outlines happened to be written from, which is both the point a
      // corner observation aims at and an answer independent of authoring order.
      let best = Number.POSITIVE_INFINITY;
      const meetings: IAutoMovieVector3[] = [];
      for (const left of a.vertices)
        for (const right of b.vertices) {
          const gap = Vector3.length(Vector3.subtract(left, right));
          if (gap > Math.min(tolerance, best + AUTOMOVIE_OBSERVATION_EPSILON))
            continue;
          if (gap < best - AUTOMOVIE_OBSERVATION_EPSILON) {
            best = gap;
            meetings.length = 0;
          }
          meetings.push(Vector3.scale(Vector3.add(left, right), 0.5));
        }
      if (meetings.length === 0) continue;
      const meeting = Vector3.scale(
        meetings.reduce((sum, point) => Vector3.add(sum, point), {
          x: 0,
          y: 0,
          z: 0,
        }),
        1 / meetings.length,
      );
      const toB = Vector3.subtract(b.centroid, meeting);
      if (Vector3.length(toB) <= AUTOMOVIE_OBSERVATION_EPSILON) continue;
      const turn = Vector3.dot(a.normal, Vector3.normalize(toB));
      if (Math.abs(turn) <= AUTOMOVIE_OBSERVATION_EPSILON) continue;
      // The facade list is already in boundary-id order, so `i < j` puts the
      // two ids in code-unit order without a second comparison.
      corners.push({
        id: `${a.boundary}+${b.boundary}`,
        building: a.building,
        facades: [a.boundary, b.boundary],
        kind: turn < 0 ? "exterior" : "reentrant",
        position: meeting,
        normal: Vector3.normalize(Vector3.add(a.normal, b.normal)),
      });
    }
  return corners.sort((left, right) =>
    compareAutoMovieRenderIds(left.id, right.id),
  );
};

/** The first point of a ladder toward the interior centre that lands inside. */
const settle = (
  space: IAutoMovieBuiltSpace,
  from: IAutoMovieVector3,
  centre: IAutoMovieVector3,
): IAutoMovieVector3 | null => {
  for (const fraction of AUTOMOVIE_OBSERVATION_INSET_LADDER) {
    const point = Vector3.lerp(from, centre, fraction);
    if (builtSpaceContainsPoint(space, point)) return point;
  }
  return null;
};

/** Aim one station at a target, or refuse it when the two coincide. */
const aim = (
  position: IAutoMovieVector3,
  target: IAutoMovieVector3,
): IAutoMovieSpaceObservationStation["pose"] => {
  const offset = Vector3.subtract(target, position);
  if (Vector3.length(offset) <= AUTOMOVIE_OBSERVATION_EPSILON) return null;
  return { position, direction: Vector3.normalize(offset), target };
};

/** The interior point every other interior station is measured against. */
const interiorCentre = (
  space: IAutoMovieBuiltSpace,
  bounds: IAutoMovieSubjectBox,
): IAutoMovieVector3 | null => {
  const middle = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  if (builtSpaceContainsPoint(space, middle)) return middle;
  // A space split into several cells, or pierced by a void, can miss its own
  // box centre. A convex cell contains the mean of its own corners, and that
  // cell is part of the space's own union, so the first cell closing a volume
  // supplies an interior point without a second containment test. A cell that
  // closes nothing supplies no corners and is passed over.
  for (const cell of space.cells) {
    const vertices = builtConvexCellVertices(cell);
    if (vertices.length === 0) continue;
    return Vector3.scale(
      vertices.reduce((sum, vertex) => Vector3.add(sum, vertex), {
        x: 0,
        y: 0,
        z: 0,
      }),
      1 / vertices.length,
    );
  }
  return null;
};

/** World centre of one opening's void, or of its host face when uncut. */
const openingCentre = (
  environment: IAutoMovieBuiltEnvironment,
  opening: IAutoMovieBuiltOpening,
): IAutoMovieVector3 | null => {
  const face = environment.boundaries.find(
    (candidate) => candidate.id === opening.boundary,
  )?.face;
  if (face === undefined) return null;
  const profile = opening.profile;
  let planar = outlineCentroid(face.outline);
  if (profile !== undefined) {
    const box = polygonBounds(outlineHull(profile));
    planar = {
      x: (box.min.x + box.max.x) / 2,
      y: (box.min.y + box.max.y) / 2,
    };
  }
  return Vector3.add(
    face.origin,
    Quaternion.rotateVector(face.rotation, {
      x: planar.x,
      y: planar.y,
      z: 0,
    }),
  );
};

/** Where an eye stands to read one opening from inside the space it serves. */
const thresholdPose = (props: {
  environment: IAutoMovieBuiltEnvironment;
  space: IAutoMovieBuiltSpace;
  opening: IAutoMovieBuiltOpening;
  anchor: IAutoMovieVector3;
}): IAutoMovieSpaceObservationStation["pose"] => {
  const mouth = openingCentre(props.environment, props.opening);
  if (mouth === null) return null;
  const settled = settle(
    props.space,
    { ...mouth, y: props.anchor.y },
    props.anchor,
  );
  return settled === null ? null : aim(settled, props.anchor);
};

/**
 * The closed interior observation population one logical space owes.
 *
 * Four outward views from the interior centre and four inward views from the
 * corners of the space's own extent read the room's proportion, its junctions,
 * and the parts a single flattering angle hides. One threshold view for every
 * opening on one of the space's boundaries reads the arrival, which is the
 * observation a sweep taken from inside can never substitute for. A space that
 * states no volume is a name rather than a room and owes nothing here.
 *
 * Every station's point is proved inside the space's own stated volume before
 * it is returned, which is what separates an interior observation from a
 * turntable that circles the room from outside and photographs its walls.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Enumerates the closed interior station population and proves each camera stands inside its own space.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Implements the centre, corner, and threshold station derivation over a stated space volume.
 */
export const builtSpaceObservationStations = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): IAutoMovieSpaceObservationStation[] => {
  const space = environment.spaces.find(
    (candidate) => candidate.id === spaceId,
  );
  if (space === undefined)
    throw new Error(
      `built environment "${environment.id}" has no logical space "${spaceId}"`,
    );
  if (builtSpaceStatesVolume(space) === false) return [];
  const bounds = builtSpaceVolumeBounds(space);
  const interior = bounds === null ? null : interiorCentre(space, bounds);
  // The eye stands at reading height above the space's own floor, and a space
  // whose stated volume narrows with height can leave that point outside
  // itself, so the interior point it was derived from is kept as the fallback.
  const placed =
    bounds === null || interior === null
      ? null
      : {
          bounds,
          anchor: ((eye: IAutoMovieVector3) =>
            builtSpaceContainsPoint(space, eye) ? eye : interior)({
            ...interior,
            y:
              bounds.min.y +
              Math.min(
                AUTOMOVIE_OBSERVATION_EYE_HEIGHT,
                (bounds.max.y - bounds.min.y) / 2,
              ),
          }),
        };
  const stations: IAutoMovieSpaceObservationStation[] = [];
  for (const [id, direction] of [
    ["center-x-minus", { x: -1, y: 0, z: 0 }],
    ["center-x-plus", { x: 1, y: 0, z: 0 }],
    ["center-z-minus", { x: 0, y: 0, z: -1 }],
    ["center-z-plus", { x: 0, y: 0, z: 1 }],
  ] as const)
    stations.push({
      id,
      role: "center",
      opening: null,
      pose:
        placed === null
          ? null
          : aim(
              placed.anchor,
              Vector3.add(
                placed.anchor,
                Vector3.scale(
                  direction,
                  Math.max(
                    placed.bounds.max.x - placed.bounds.min.x,
                    placed.bounds.max.z - placed.bounds.min.z,
                    AUTOMOVIE_OBSERVATION_PROBE,
                  ),
                ),
              ),
            ),
    });
  for (const [id, sx, sz] of [
    ["corner-x-minus-z-minus", "min", "min"],
    ["corner-x-minus-z-plus", "min", "max"],
    ["corner-x-plus-z-minus", "max", "min"],
    ["corner-x-plus-z-plus", "max", "max"],
  ] as const)
    stations.push({
      id,
      role: "corner",
      opening: null,
      pose:
        placed === null
          ? null
          : ((settled: IAutoMovieVector3 | null) =>
              settled === null ? null : aim(settled, placed.anchor))(
              settle(
                space,
                {
                  x: placed.bounds[sx].x,
                  y: placed.anchor.y,
                  z: placed.bounds[sz].z,
                },
                placed.anchor,
              ),
            ),
    });
  for (const opening of environment.openings
    .filter((candidate) =>
      environment.boundaries.some(
        (boundary) =>
          boundary.id === candidate.boundary &&
          boundary.spaces.includes(spaceId),
      ),
    )
    .slice()
    .sort((left, right) => compareAutoMovieRenderIds(left.id, right.id)))
    stations.push({
      id: `threshold-${opening.id}`,
      role: "threshold",
      opening: opening.id,
      pose:
        placed === null
          ? null
          : thresholdPose({
              environment,
              space,
              opening,
              anchor: placed.anchor,
            }),
    });
  return stations;
};

/**
 * The complete observation topology of every building unit in one environment.
 *
 * This is the building aggregate a review counts against. A building is not the
 * sum of the rooms a space tree happens to index, so the census carries the
 * envelope, its corners, the openings cut through it, and the connectors that
 * cross it beside the spaces, and every one of those populations is derived
 * from the record rather than declared by whoever writes the review.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Aggregates every derived envelope, corner, entrance, space, and route population per building unit.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Implements the building aggregate the review denominator and the subject hierarchy share.
 */
export const builtEnvironmentBuildingCensus = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieBuildingObservationCensus[] => {
  const faces = builtEnvironmentEnvelopeFaces(environment);
  const corners = builtEnvironmentEnvelopeCorners(environment);
  return environment.buildings
    .map((building) => {
      const owned = new Set(
        builtEnvironmentDescendantSpaces(environment, building.space),
      );
      const mine = faces.filter((face) => face.building === building.id);
      const envelope = new Set(mine.map((face) => face.boundary));
      return {
        building: building.id,
        facades: mine.filter((face) => face.aspect === "facade"),
        roofs: mine.filter((face) => face.aspect === "roof"),
        undersides: mine.filter((face) => face.aspect === "underside"),
        corners: corners.filter((corner) => corner.building === building.id),
        entrances: environment.openings
          .filter((opening) => envelope.has(opening.boundary))
          .map((opening) => opening.id)
          .sort(compareAutoMovieRenderIds),
        spaces: environment.spaces
          .filter(
            (space) => owned.has(space.id) && builtSpaceStatesVolume(space),
          )
          .map((space) => space.id)
          .sort(compareAutoMovieRenderIds),
        connectors: [
          ...new Set(
            [...owned].flatMap((space) =>
              builtEnvironmentSpaceConnectors(environment, space).map(
                (connector) => connector.id,
              ),
            ),
          ),
        ].sort(compareAutoMovieRenderIds),
      };
    })
    .sort((left, right) =>
      compareAutoMovieRenderIds(left.building, right.building),
    );
};
