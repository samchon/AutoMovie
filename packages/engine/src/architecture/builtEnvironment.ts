import {
  IAutoMovieBoundaryFace,
  IAutoMovieBuiltConnector,
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltOpening,
  IAutoMovieBuiltSpace,
  IAutoMovieConnectorCarriage,
  IAutoMovieConnectorSection,
  IAutoMovieConnectorState,
  IAutoMovieMovablePanel,
  IAutoMovieOpeningProfile,
  IAutoMovieOperationState,
  IAutoMoviePlanarPoint,
  IAutoMovieQuaternion,
  IAutoMovieSpace,
  IAutoMovieTravelMotion,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieWallOpening } from "../geometry/proceduralMesh";
import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoMovieSubjectContribution } from "../subject";
import { validateModel } from "../validation/validateModel";
import { validateSpace } from "../validation/validateSpace";
import { validateTransformScalars } from "../validation/validateTransformScalars";
import { ViolationCollector } from "../validation/violation";
import {
  PLANAR_EPSILON,
  outlineHull,
  polygonBounds,
  polygonDoubleArea,
  polygonInside,
  polygonIsSimple,
  polygonShortestEdge,
  polygonsOverlap,
} from "./planarGeometry";

const CONNECTOR_KINDS = [
  "passage",
  "stair",
  "ramp",
  "lift",
  "escalator",
  "moving-walk",
  "ladder",
  "bridge",
  "other",
] as const;
/** The three ways a powered run may stand: driven either way, or not at all. */
const CONNECTOR_DRIVES = ["forward", "reverse", "still"] as const;
const PLANE_NORMAL_EPSILON = 1e-12;
const MATRIX_ROUND_TRIP_EPSILON = 1e-8;
const CONTAINMENT_EPSILON = 1e-9;
/** Largest deviation from unit norm a stated quaternion may carry. */
const UNIT_QUATERNION_EPSILON = 1e-6;
/** Shortest distance, in metres, two consecutive route stations may sit apart. */
const ROUTE_EPSILON = 1e-9;
/** Largest disagreement, in metres, between a stated step run and its route. */
const STEP_TOLERANCE = 1e-3;
/** Largest disagreement, in radians, between a stated slope and its route. */
const SLOPE_TOLERANCE = 1e-6;
/**
 * Slack, in radians, on the full turn a revolute panel may travel.
 *
 * Validation and the swept-envelope solver share this on purpose: the cap is
 * what bounds the solver's critical-angle walk, so a range the validator waved
 * through but the solver could not enumerate would be a hang rather than a
 * disagreement.
 */
const FULL_TURN_EPSILON = 1e-6;

/** Validate the graph, geometry references, and spatial topology of a building. */
export const validateBuiltEnvironment = (props: {
  environment: IAutoMovieBuiltEnvironment;
}): IAutoMovieValidation => {
  const { environment } = props;
  const collector = new ViolationCollector();
  const root = "$input";

  nonEmpty(environment.id, `${root}.id`, "building id", collector);
  if (environment.version !== 1)
    collector.push(
      "type",
      `${root}.version`,
      `building schema version must be 1, but was ${environment.version}`,
      environment.version,
    );
  if (environment.units !== "meter")
    collector.push(
      "type",
      `${root}.units`,
      `building units must be "meter", but was ${String(environment.units)}`,
      environment.units,
    );

  const modelIds = collectIds(
    environment.models,
    `${root}.models`,
    "model",
    collector,
  );
  environment.models.forEach((model, index) => {
    appendValidation(
      collector,
      validateModel({ model }),
      `${root}.models[${index}]`,
    );
  });
  const referencedModelIds = new Set<string>();
  environment.modelReferences.forEach((id, index) => {
    nonEmpty(
      id,
      `${root}.modelReferences[${index}]`,
      "runtime model reference",
      collector,
    );
    if (modelIds.has(id))
      collector.push(
        "type",
        `${root}.modelReferences[${index}]`,
        `runtime model reference "${id}" duplicates an environment-owned model`,
        id,
      );
    if (referencedModelIds.has(id))
      collector.push(
        "type",
        `${root}.modelReferences[${index}]`,
        `runtime model reference "${id}" is duplicated`,
        id,
      );
    referencedModelIds.add(id);
  });

  const spaceIds = collectIds(
    environment.spaces,
    `${root}.spaces`,
    "logical space",
    collector,
  );
  environment.spaces.forEach((space, index) => {
    const path = `${root}.spaces[${index}]`;
    nonEmpty(space.kind, `${path}.kind`, "logical-space kind", collector);
    if (space.parent !== null && !spaceIds.has(space.parent))
      collector.push(
        "type",
        `${path}.parent`,
        `logical-space parent "${space.parent}" does not resolve`,
        space.parent,
      );
    const cellIds = new Set<string>();
    space.cells.forEach((cell, cellIndex) => {
      const cellPath = `${path}.cells[${cellIndex}]`;
      nonEmpty(cell.id, `${cellPath}.id`, "space-cell id", collector);
      if (cellIds.has(cell.id))
        collector.push(
          "type",
          `${cellPath}.id`,
          `space-cell id "${cell.id}" must be unique within logical space "${space.id}"`,
          cell.id,
        );
      cellIds.add(cell.id);
      if (cell.planes.length < 4)
        collector.push(
          "range",
          `${cellPath}.planes`,
          `a bounded convex cell needs at least 4 planes, but had ${cell.planes.length}`,
          cell.planes.length,
        );
      cell.planes.forEach((plane, planeIndex) => {
        const planePath = `${cellPath}.planes[${planeIndex}]`;
        finiteVector(
          plane.normal,
          `${planePath}.normal`,
          "plane normal",
          collector,
        );
        const length = Math.hypot(
          plane.normal.x,
          plane.normal.y,
          plane.normal.z,
        );
        if (Number.isFinite(length) && length <= PLANE_NORMAL_EPSILON)
          collector.push(
            "range",
            `${planePath}.normal`,
            "plane normal must be non-zero",
            plane.normal,
          );
        if (!Number.isFinite(plane.offset))
          collector.push(
            "range",
            `${planePath}.offset`,
            `plane offset must be finite, but was ${plane.offset}`,
            plane.offset,
          );
      });
    });
  });
  appendHierarchyCycles(
    environment.spaces,
    `${root}.spaces`,
    "logical space",
    collector,
  );

  const elementIds = collectIds(
    environment.elements,
    `${root}.elements`,
    "building element",
    collector,
  );
  environment.elements.forEach((element, index) => {
    const path = `${root}.elements[${index}]`;
    nonEmpty(element.kind, `${path}.kind`, "building-element kind", collector);
    if (element.parent !== null && !elementIds.has(element.parent))
      collector.push(
        "type",
        `${path}.parent`,
        `building-element parent "${element.parent}" does not resolve`,
        element.parent,
      );
    if (
      element.model !== null &&
      !modelIds.has(element.model) &&
      !referencedModelIds.has(element.model)
    )
      collector.push(
        "type",
        `${path}.model`,
        `building-element model "${element.model}" does not resolve`,
        element.model,
      );
    if (element.space !== null && !spaceIds.has(element.space))
      collector.push(
        "type",
        `${path}.space`,
        `building-element space "${element.space}" does not resolve`,
        element.space,
      );
    validateTransformScalars({
      transform: element.transform,
      path: `${path}.transform`,
      label: "building-element transform",
      collector,
    });
  });
  appendHierarchyCycles(
    environment.elements,
    `${root}.elements`,
    "building element",
    collector,
  );

  const buildingIds = collectIds(
    environment.buildings,
    `${root}.buildings`,
    "building unit",
    collector,
  );
  if (environment.buildings.length === 0)
    collector.push(
      "range",
      `${root}.buildings`,
      "a built-environment work needs at least one building unit",
      environment.buildings,
    );
  const buildingElementRoots = new Set<string>();
  const buildingSpaceRoots = new Set<string>();
  environment.buildings.forEach((building, index) => {
    const path = `${root}.buildings[${index}]`;
    if (buildingIds.has(building.id)) {
      const element = environment.elements.find(
        (candidate) => candidate.id === building.element,
      );
      if (element === undefined)
        collector.push(
          "type",
          `${path}.element`,
          `building root element "${building.element}" does not resolve`,
          building.element,
        );
      else if (element.parent !== null)
        collector.push(
          "type",
          `${path}.element`,
          `building root element "${building.element}" must have no parent`,
          building.element,
        );
      const space = environment.spaces.find(
        (candidate) => candidate.id === building.space,
      );
      if (space === undefined)
        collector.push(
          "type",
          `${path}.space`,
          `building root space "${building.space}" does not resolve`,
          building.space,
        );
      else if (space.parent !== null)
        collector.push(
          "type",
          `${path}.space`,
          `building root space "${building.space}" must have no parent`,
          building.space,
        );
    }
    if (buildingElementRoots.has(building.element))
      collector.push(
        "type",
        `${path}.element`,
        `building root element "${building.element}" is already owned by another building unit`,
        building.element,
      );
    if (buildingSpaceRoots.has(building.space))
      collector.push(
        "type",
        `${path}.space`,
        `building root space "${building.space}" is already owned by another building unit`,
        building.space,
      );
    buildingElementRoots.add(building.element);
    buildingSpaceRoots.add(building.space);
  });
  appendOwnership(
    environment.elements,
    buildingElementRoots,
    `${root}.elements`,
    "building element",
    "root element",
    collector,
  );
  appendOwnership(
    environment.spaces,
    buildingSpaceRoots,
    `${root}.spaces`,
    "logical space",
    "root space",
    collector,
  );

  const boundaryIds = collectIds(
    environment.boundaries,
    `${root}.boundaries`,
    "boundary",
    collector,
  );
  const boundaryFaces = new Map<string, IAutoMovieBoundaryFace>();
  environment.boundaries.forEach((boundary, index) => {
    const path = `${root}.boundaries[${index}]`;
    nonEmpty(boundary.kind, `${path}.kind`, "boundary kind", collector);
    if (boundary.spaces.length < 1 || boundary.spaces.length > 2)
      collector.push(
        "range",
        `${path}.spaces`,
        `a boundary must enclose one space or separate two, but cited ${boundary.spaces.length}`,
        boundary.spaces,
      );
    validateReferences(
      boundary.spaces,
      spaceIds,
      `${path}.spaces`,
      "logical space",
      collector,
    );
    validateReferences(
      boundary.elements,
      elementIds,
      `${path}.elements`,
      "building element",
      collector,
    );
    if (
      boundary.face !== undefined &&
      faceIsUsable(boundary.face, path, collector)
    )
      boundaryFaces.set(boundary.id, boundary.face);
  });

  collectIds(environment.openings, `${root}.openings`, "opening", collector);
  const openingHulls = new Map<number, IAutoMoviePlanarPoint[]>();
  const drivenElements = new Map<string, string>();
  environment.openings.forEach((opening, index) => {
    const path = `${root}.openings[${index}]`;
    nonEmpty(opening.kind, `${path}.kind`, "opening kind", collector);
    if (!boundaryIds.has(opening.boundary))
      collector.push(
        "type",
        `${path}.boundary`,
        `opening boundary "${opening.boundary}" does not resolve`,
        opening.boundary,
      );
    if (opening.fill !== null && !elementIds.has(opening.fill))
      collector.push(
        "type",
        `${path}.fill`,
        `opening fill element "${opening.fill}" does not resolve`,
        opening.fill,
      );
    if (opening.profile !== undefined) {
      const profilePath = `${path}.profile`;
      const host = environment.boundaries.find(
        (candidate) => candidate.id === opening.boundary,
      );
      if (host !== undefined && host.face === undefined)
        collector.push(
          "type",
          profilePath,
          `opening "${opening.id}" states a void, but its host boundary "${opening.boundary}" declares no face to cut it in`,
          opening.boundary,
        );
      if (profileIsUsable(opening.profile, profilePath, collector)) {
        const hull = outlineHull(opening.profile);
        openingHulls.set(index, hull);
        const face = boundaryFaces.get(opening.boundary);
        // A missing or malformed host face is already reported on its own path,
        // and repeating it here would only hide the one defect worth acting on.
        if (face !== undefined && polygonInside(hull, face.outline) === false)
          collector.push(
            "range",
            `${profilePath}.outline`,
            `opening "${opening.id}" leaves the face of its host boundary "${opening.boundary}"`,
            opening.profile.outline,
          );
      }
    }
    validateOpeningOperation({
      opening,
      path,
      elements: elementIds,
      environment,
      driven: drivenElements,
      collector,
    });
  });
  environment.openings.forEach((opening, index) => {
    const hull = openingHulls.get(index);
    if (hull === undefined) return;
    // Hulls are keyed by position rather than by id, so a work that declares
    // one opening id twice reports that one defect on its own path instead of
    // also reporting the record as overlapping itself.
    environment.openings.slice(0, index).forEach((earlier, other) => {
      const against = openingHulls.get(other);
      if (
        against !== undefined &&
        earlier.boundary === opening.boundary &&
        polygonsOverlap(hull, against)
      )
        collector.push(
          "range",
          `${root}.openings[${index}].profile.outline`,
          `openings "${earlier.id}" and "${opening.id}" occupy the same part of boundary "${opening.boundary}"`,
          opening.profile!.outline,
        );
    });
  });

  collectIds(
    environment.connectors,
    `${root}.connectors`,
    "connector",
    collector,
  );
  environment.connectors.forEach((connector, index) => {
    const path = `${root}.connectors[${index}]`;
    if (!CONNECTOR_KINDS.includes(connector.kind))
      collector.push(
        "type",
        `${path}.kind`,
        `unknown connector kind "${String(connector.kind)}"`,
        connector.kind,
      );
    for (const endpoint of ["from", "to"] as const)
      if (!spaceIds.has(connector[endpoint]))
        collector.push(
          "type",
          `${path}.${endpoint}`,
          `connector ${endpoint} space "${connector[endpoint]}" does not resolve`,
          connector[endpoint],
        );
    if (connector.from === connector.to)
      collector.push(
        "type",
        `${path}.to`,
        "connector endpoints must be different logical spaces",
        connector.to,
      );
    if (connector.route.length < 2)
      collector.push(
        "range",
        `${path}.route`,
        `connector route needs at least 2 points, but had ${connector.route.length}`,
        connector.route.length,
      );
    connector.route.forEach((point, pointIndex) =>
      finiteVector(
        point,
        `${path}.route[${pointIndex}]`,
        "connector route point",
        collector,
      ),
    );
    validateConnectorShape(connector, path, collector);
    validateReferences(
      connector.elements,
      elementIds,
      `${path}.elements`,
      "building element",
      collector,
    );
    validateConnectorLandings(connector, path, spaceIds, collector);
    validateConnectorOperation({
      connector,
      path,
      elements: elementIds,
      environment,
      driven: drivenElements,
      collector,
    });
  });

  environment.surfaces.forEach((entry, index) => {
    if (!spaceIds.has(entry.space))
      collector.push(
        "type",
        `${root}.surfaces[${index}].space`,
        `surface logical space "${entry.space}" does not resolve`,
        entry.space,
      );
  });
  appendBuildingSpaceValidation(
    collector,
    validateSpace({
      space: {
        id: `${environment.id}-support`,
        surfaces: environment.surfaces.map((entry) => entry.surface),
        walkable: environment.walkable,
      },
    }),
  );

  if (!collector.items.some((item) => item.severity === "error")) {
    validatePanelFit(environment, root, boundaryFaces, openingHulls, collector);
    validateCarriageService(environment, root, collector);
    validateStagedConfigurations(environment, root, collector);
  }

  return collector.toValidation();
};

/**
 * Lower one building record to ordinary subject contributions.
 *
 * Visible element transforms are composed parent-to-child and flattened into
 * world-space set pieces because staged scene nodes are world TRS. The original
 * hierarchy remains in `builtEnvironments` for spatial queries and evidence.
 *
 * An opening's current operating state is applied on the way down, so a door
 * authored open is staged open. Without that, "the door is open" would be a
 * fact of the record that the render contradicts, which is exactly the drift
 * between the declared passage and the visible hole this graph exists to close.
 * A record that declares no operation lowers byte-for-byte as it always did,
 * because the joint displacement it would contribute is the identity.
 */
export const lowerBuiltEnvironment = (
  environment: IAutoMovieBuiltEnvironment,
): IAutoMovieSubjectContribution => {
  const validated = validateBuiltEnvironment({ environment });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `built environment "${environment.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }

  const matrices = worldMatricesOf(environment, operationDeltas(environment));
  const spaces: IAutoMovieSpace[] = environment.spaces.map((space) => {
    const surfaces = environment.surfaces
      .filter((entry) => entry.space === space.id)
      .map((entry) => entry.surface);
    const surfaceIds = new Set(surfaces.map((surface) => surface.id));
    return {
      id: `${environment.id}/${space.id}`,
      surfaces,
      walkable: environment.walkable.filter((id) => surfaceIds.has(id)),
    };
  });

  return {
    models: environment.models,
    set: environment.elements
      .filter((element) => element.model !== null)
      .map((element) => {
        const world = Matrix4.decompose(matrices.get(element.id)!);
        return {
          node: `${environment.id}/${element.id}`,
          model: element.model!,
          position: world.position,
          rotation: Quaternion.normalize(world.rotation),
          scale: world.scale,
        };
      }),
    spaces,
    builtEnvironments: [environment],
  };
};

/** Merge several subject-owned support spaces into one stage space. */
export const mergeAutoMovieSpaces = (
  id: string,
  spaces: readonly IAutoMovieSpace[],
): IAutoMovieSpace => ({
  id,
  surfaces: spaces.flatMap((space) => space.surfaces),
  walkable: spaces.flatMap((space) => space.walkable),
});

/** Test whether a point lies in a logical space or any of its child spaces. */
export const builtEnvironmentContainsPoint = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
  point: IAutoMovieVector3,
): boolean => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  return environment.spaces.some(
    (space) =>
      included.has(space.id) &&
      space.cells.some((cell) =>
        cell.planes.every(
          (plane) =>
            plane.normal.x * point.x +
              plane.normal.y * point.y +
              plane.normal.z * point.z <=
            plane.offset + CONTAINMENT_EPSILON,
        ),
      ),
  );
};

/**
 * Return spaces directly joined by a boundary or traversal connector.
 *
 * A run reaches every stop it declares, not only its two ends: a lift serving
 * four floors makes all four reachable from each other, because the floors it
 * stops at are the floors it joins. A one-way run reaches only stops further
 * along its own route, which is the same rule its two-ended form has always
 * followed, generalized to the stops between them.
 */
export const builtEnvironmentAdjacentSpaces = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): string[] => {
  requireSpace(environment, spaceId);
  const adjacent = new Set<string>();
  for (const boundary of environment.boundaries)
    if (boundary.spaces.includes(spaceId))
      for (const candidate of boundary.spaces)
        if (candidate !== spaceId) adjacent.add(candidate);
  for (const connector of environment.connectors) {
    const stops = connectorStops(connector);
    const here = stops.indexOf(spaceId);
    if (here === -1) continue;
    stops.forEach((stop, index) => {
      if (index !== here && (connector.bidirectional || index > here))
        adjacent.add(stop);
    });
  }
  return [...adjacent];
};

/**
 * Return every connector landing on a logical space, endpoints and route
 * intact.
 *
 * Adjacency answers which spaces are reachable; this answers with what. The
 * authored 3D centre route is handed back as written rather than reduced to a
 * pair of ids, because a stair's rise and a bridge's span are the part a shot
 * stages and a later pathfinder would have to re-derive.
 *
 * Stops are matched exactly, not through containment: a connector declares the
 * spaces it actually lands in — its two ends and any landing between them — so
 * asking a building root returns the connectors declared on the root itself
 * rather than every connector inside it. That is the same rule
 * {@link builtEnvironmentAdjacentSpaces} follows.
 */
export const builtEnvironmentSpaceConnectors = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): IAutoMovieBuiltConnector[] => {
  requireSpace(environment, spaceId);
  return environment.connectors.filter((connector) =>
    connectorStops(connector).includes(spaceId),
  );
};

/**
 * Report the support patches usable in a logical space and its descendants.
 *
 * Support and walkability are separate facts: a roof deck may carry a prop
 * without being somewhere a performer may walk. Both are answered by the stable
 * surface id the lowered stage space also cites, so a caller never has to match
 * geometry to learn which patch it is holding.
 */
export const builtEnvironmentSpaceSurfaces = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): Array<{ space: string; surface: string; walkable: boolean }> => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  const walkable = new Set(environment.walkable);
  return environment.surfaces
    .filter((entry) => included.has(entry.space))
    .map((entry) => ({
      space: entry.space,
      surface: entry.surface.id,
      walkable: walkable.has(entry.surface.id),
    }));
};

/**
 * Name the staged set nodes standing in a logical space and its descendants.
 *
 * This is the join that keeps the visible model and the semantic partition from
 * drifting apart: the ids returned here are exactly the `node` ids
 * {@link lowerBuiltEnvironment} emits, so a room can be asked what is visibly
 * inside it without a second traversal that could answer differently.
 */
export const builtEnvironmentSpaceNodes = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): string[] => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  return environment.elements
    .filter(
      (element) =>
        element.model !== null &&
        element.space !== null &&
        included.has(element.space),
    )
    .map((element) => `${environment.id}/${element.id}`);
};

/**
 * Name the building unit that owns a logical space.
 *
 * A work holds several independently placed building units, so "which building
 * is this room in" is a real question rather than a constant. A validated
 * environment answers it for every space; an unowned space is refused here for
 * the same reason validation refuses it.
 */
export const builtEnvironmentBuildingOfSpace = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): string => {
  requireSpace(environment, spaceId);
  const owner = environment.buildings.find((building) =>
    descendantSpaces(environment.spaces, building.space).has(spaceId),
  );
  if (owner === undefined)
    throw new Error(
      `built environment "${environment.id}" has no building unit owning logical space "${spaceId}"`,
    );
  return owner.id;
};

/** The rectangular wall panel and cut voids one boundary's own face implies. */
export interface IAutoMovieBoundaryWallCut {
  /** Panel extent along the boundary's local X, in metres. */
  width: number;
  /** Panel extent along the boundary's local Y, in metres. */
  height: number;
  /** Panel extent along the boundary's local Z, in metres. */
  depth: number;
  /** World position of the panel's own centre. */
  origin: IAutoMovieVector3;
  /** World rotation of the panel, taken from the boundary's face. */
  rotation: IAutoMovieQuaternion;
  /** Kernel voids, each keyed by the architectural opening that declared it. */
  openings: IAutoMovieWallOpening[];
}

/** Where one movable panel stands, in world space, at one operating state. */
export interface IAutoMovieOpeningPanelPlacement {
  /** Panel id inside its opening. */
  panel: string;
  /** The visible element the panel drives. */
  element: string;
  /** The staged node id {@link lowerBuiltEnvironment} emits for that element. */
  node: string;
  /** World translation of the panel's element. */
  position: IAutoMovieVector3;
  /** World rotation of the panel's element, as a unit quaternion. */
  rotation: IAutoMovieQuaternion;
  /** World per-axis scale of the panel's element. */
  scale: IAutoMovieVector3;
}

/** The world volume one movable panel sweeps across its whole travel. */
export interface IAutoMovieOpeningSweep {
  /** Panel id inside its opening. */
  panel: string;
  /** The visible element the panel drives. */
  element: string;
  /** World minimum corner of the swept volume. */
  min: IAutoMovieVector3;
  /** World maximum corner of the swept volume. */
  max: IAutoMovieVector3;
}

/** One oriented station of a connector's route. */
export interface IAutoMovieConnectorStation {
  /** World position of the station. */
  position: IAutoMovieVector3;
  /** Authored facing, or null when the connector declared none. */
  rotation: IAutoMovieQuaternion | null;
  /** Arc-length fraction of the station along the route, in `[0, 1]`. */
  at: number;
}

/** The measured traversal shape of one connector. */
export interface IAutoMovieConnectorGeometry {
  /** Signed climb from the first station to the last, in metres. */
  rise: number;
  /** Horizontal length of the route polyline, in metres. */
  run: number;
  /** Total 3D length of the route polyline, in metres. */
  length: number;
  /** Slope of the run from horizontal, in radians within `[0, PI / 2]`. */
  slope: number;
  /** The route's own stations, in authored order. */
  stations: IAutoMovieConnectorStation[];
  /** The further spaces the run stops at, placed on its own route. */
  landings: IAutoMovieConnectorLandingAt[];
}

/** One further space a run stops at, placed on the route that reaches it. */
export interface IAutoMovieConnectorLandingAt {
  /** Logical space served at this stop. */
  space: string;
  /** Arc-length fraction of the route, as authored. */
  at: number;
  /** World position of that point of the route. */
  position: IAutoMovieVector3;
}

/** Where one carriage of a run stands, in world space, at one state. */
export interface IAutoMovieConnectorCarriagePlacement {
  /** Carriage id inside its connector. */
  carriage: string;
  /** The visible element the carriage drives. */
  element: string;
  /** The staged node id {@link lowerBuiltEnvironment} emits for that element. */
  node: string;
  /** World translation of the carriage's element. */
  position: IAutoMovieVector3;
  /** World rotation of the carriage's element, as a unit quaternion. */
  rotation: IAutoMovieQuaternion;
  /** World per-axis scale of the carriage's element. */
  scale: IAutoMovieVector3;
  /** Logical space this carriage stands at in that state, or null. */
  serves: string | null;
}

/** The usable section of a connector at one point of its route. */
export interface IAutoMovieConnectorSectionAt {
  /** Usable width in metres. */
  width: number;
  /** Vertical clearance in metres. */
  clearHeight: number;
}

/**
 * Turn one boundary's declared face into the wall panel a mesh kernel can cut.
 *
 * This is the join that stops the declared opening and the modelled hole from
 * being two unrelated facts: the returned voids carry the architectural
 * opening's own id, so `buildAutoMovieWall` cuts the wall against the same
 * records validation held inside the face.
 *
 * The kernel is rectangular, and that shows in two places rather than being
 * hidden. An arched or round void is handed over as the rectangle that exactly
 * bounds it, so an author who needs the arch's own spandrel back composes it
 * from the profile rather than being told the rectangle was the arch. A concave
 * face likewise becomes its own bounding panel. Two voids that clear each other
 * as outlines may therefore still have overlapping bounds, and the kernel
 * refuses that pair by name; that refusal is the rectangle's limit speaking,
 * not a defect in the design it was handed.
 */
export const builtBoundaryWallCut = (
  environment: IAutoMovieBuiltEnvironment,
  boundaryId: string,
): IAutoMovieBoundaryWallCut => {
  const boundary = environment.boundaries.find(
    (candidate) => candidate.id === boundaryId,
  );
  if (boundary === undefined)
    throw new Error(
      `built environment "${environment.id}" has no boundary "${boundaryId}"`,
    );
  const face = boundary.face;
  if (face === undefined)
    throw new Error(
      `boundary "${boundaryId}" of built environment "${environment.id}" declares no face to cut`,
    );
  const bounds = polygonBounds(face.outline);
  return {
    width: bounds.max.x - bounds.min.x,
    height: bounds.max.y - bounds.min.y,
    depth: face.thickness,
    origin: Vector3.add(
      face.origin,
      Quaternion.rotateVector(face.rotation, {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: (bounds.min.y + bounds.max.y) / 2,
        z: 0,
      }),
    ),
    rotation: face.rotation,
    openings: environment.openings
      .filter(
        (opening) =>
          opening.boundary === boundaryId && opening.profile !== undefined,
      )
      .map((opening) => {
        const void_ = polygonBounds(outlineHull(opening.profile!));
        return {
          id: opening.id,
          x: void_.min.x - bounds.min.x,
          y: void_.min.y - bounds.min.y,
          width: void_.max.x - void_.min.x,
          height: void_.max.y - void_.min.y,
        };
      }),
  };
};

/**
 * Where an opening's panels stand, in world space, at one named state.
 *
 * Omitting the state answers for the state the record itself stands in, which
 * is the placement {@link lowerBuiltEnvironment} stages. Naming another one
 * answers for that state without editing the record, so a shot can ask where
 * the leaf would be when open without a second building.
 *
 * A state is a configuration rather than a moment. A door that swings on screen
 * is a shot `objectMotions` clip over the
 * {@link IAutoMovieOpeningPanelPlacement.node} ids this answers with, so the
 * architecture record never grows a second clock beside the shot's own.
 */
export const builtOpeningPanelPlacements = (
  environment: IAutoMovieBuiltEnvironment,
  openingId: string,
  stateId?: string,
): IAutoMovieOpeningPanelPlacement[] => {
  const opening = requireOpening(environment, openingId);
  const operation = opening.operation;
  if (operation === undefined) return [];
  if (
    stateId !== undefined &&
    !operation.states.some((state) => state.id === stateId)
  )
    throw new Error(
      `opening "${openingId}" of built environment "${environment.id}" has no operating state "${stateId}"`,
    );
  const matrices = worldMatricesOf(
    environment,
    operationDeltas(environment, stateId),
  );
  return operation.panels.map((panel) => {
    const world = Matrix4.decompose(
      requireTravellerMatrix(environment, matrices, panel, "panel"),
    );
    return {
      panel: panel.id,
      element: panel.element,
      node: `${environment.id}/${panel.element}`,
      position: world.position,
      rotation: Quaternion.normalize(world.rotation),
      scale: world.scale,
    };
  });
};

/**
 * The world volume each panel of an opening sweeps across its whole travel.
 *
 * The envelope is solved rather than sampled. Every corner of a turning leaf
 * traces `A + B cos(t) + D sin(t)` under the panel's own placement, and an
 * affine world matrix keeps that form, so each axis is a single cosine whose
 * extremes are its endpoints and the critical angles the travel actually
 * crosses. A sliding leaf is linear and reaches its extremes at its limits.
 * Nothing here judges whether a person can pass the leaf: this is the volume a
 * later clearance or collision analysis reads, not its verdict.
 *
 * The answer is **per panel, and only that panel's own travel**. Ancestors
 * stand where the environment's current state puts them, so an inner folding
 * leaf is measured against the outer leaf as it currently stands. That is the
 * volume this leaf sweeps from where the design has it, not the union over
 * every configuration a chain of leaves could reach between its named states. A
 * caller wanting that union asks for each state in turn and takes the hull
 * itself; inventing it here would quietly report a chain's envelope under one
 * panel's name.
 */
export const builtOpeningSweepEnvelope = (
  environment: IAutoMovieBuiltEnvironment,
  openingId: string,
): IAutoMovieOpeningSweep[] => {
  const opening = requireOpening(environment, openingId);
  const operation = opening.operation;
  if (operation === undefined) return [];
  const staged = operationDeltas(environment);
  return operation.panels.map((panel) => {
    requireEnumerableTravel(environment, panel);
    // The panel's own travel is what is being measured, so it is the one joint
    // left at rest; every other joint, its ancestors included, stands where the
    // environment's current state puts it.
    const held = new Map(staged);
    held.delete(panel.element);
    const base = requireTravellerMatrix(
      environment,
      worldMatricesOf(environment, held),
      panel,
      "panel",
    );
    const corners: IAutoMovieVector3[] = [
      { x: 0, y: 0, z: 0 },
      { x: panel.width, y: 0, z: 0 },
      { x: panel.width, y: panel.height, z: 0 },
      { x: 0, y: panel.height, z: 0 },
    ];
    const swept = corners.map((corner) =>
      sweptCornerBounds(base, panel.motion, corner),
    );
    return {
      panel: panel.id,
      element: panel.element,
      min: {
        x: Math.min(...swept.map((bound) => bound.min.x)),
        y: Math.min(...swept.map((bound) => bound.min.y)),
        z: Math.min(...swept.map((bound) => bound.min.z)),
      },
      max: {
        x: Math.max(...swept.map((bound) => bound.max.x)),
        y: Math.max(...swept.map((bound) => bound.max.y)),
        z: Math.max(...swept.map((bound) => bound.max.z)),
      },
    };
  });
};

/**
 * Measure one connector's traversal shape: climb, run, length, slope, stations.
 *
 * A station's facing is answered as authored or as `null`, never as a heading
 * this function invented. A connector that declared no orientation has no
 * orientation, and saying so is what keeps a later analysis from reading a
 * derived guess as a design decision.
 */
export const builtConnectorGeometry = (
  environment: IAutoMovieBuiltEnvironment,
  connectorId: string,
): IAutoMovieConnectorGeometry => {
  const connector = requireConnector(environment, connectorId);
  const cumulative = cumulativeRouteLengths(connector.route);
  const total = cumulative[cumulative.length - 1]!;
  if (connector.route.length < 2 || total === 0)
    throw new Error(
      `connector "${connectorId}" of built environment "${environment.id}" has no measurable route`,
    );
  return {
    ...routeMetrics(connector.route),
    stations: connector.route.map((position, index) => ({
      position,
      rotation: connector.orientations?.[index] ?? null,
      at: cumulative[index]! / total,
    })),
    landings: (connector.landings ?? []).map((landing) => ({
      space: landing.space,
      at: landing.at,
      position: routePointAt(connector.route, cumulative, total, landing.at),
    })),
  };
};

/**
 * Where a run's carriages stand, in world space, at one named state.
 *
 * Omitting the state answers for the state the record itself stands in, which
 * is the placement {@link lowerBuiltEnvironment} stages. Naming another one
 * answers for that state without editing the record, so a shot can ask where
 * the car would be at the top landing while the design still holds it at the
 * bottom. The space each carriage serves is handed back beside its placement,
 * because "where the car is" and "which floor that is" are one answer and
 * making a caller rejoin them invites two.
 */
export const builtConnectorCarriagePlacements = (
  environment: IAutoMovieBuiltEnvironment,
  connectorId: string,
  stateId?: string,
): IAutoMovieConnectorCarriagePlacement[] => {
  const connector = requireConnector(environment, connectorId);
  const operation = connector.operation;
  if (operation === undefined) return [];
  if (
    stateId !== undefined &&
    !operation.states.some((state) => state.id === stateId)
  )
    throw new Error(
      `connector "${connectorId}" of built environment "${environment.id}" has no operating state "${stateId}"`,
    );
  const wanted = stateId ?? operation.state;
  const state = operation.states.find((candidate) => candidate.id === wanted);
  const matrices = worldMatricesOf(
    environment,
    operationDeltas(environment, stateId),
  );
  return operation.carriages.map((carriage) => {
    const world = Matrix4.decompose(
      requireTravellerMatrix(environment, matrices, carriage, "carriage"),
    );
    return {
      carriage: carriage.id,
      element: carriage.element,
      node: `${environment.id}/${carriage.element}`,
      position: world.position,
      rotation: Quaternion.normalize(world.rotation),
      scale: world.scale,
      serves:
        state?.carriages.find((entry) => entry.carriage === carriage.id)
          ?.serves ?? null,
    };
  });
};

/**
 * The usable section of a connector at one arc-length fraction of its route.
 *
 * A constant section answers the same pair everywhere; a varying one is read as
 * the piecewise-linear function its stations describe, so a corridor that
 * narrows between two stations narrows evenly rather than in a step nothing
 * declared.
 */
export const builtConnectorSectionAt = (
  environment: IAutoMovieBuiltEnvironment,
  connectorId: string,
  at: number,
): IAutoMovieConnectorSectionAt => {
  const connector = requireConnector(environment, connectorId);
  if (!Number.isFinite(at) || at < 0 || at > 1)
    throw new Error(
      `connector "${connectorId}" of built environment "${environment.id}" can only be sectioned within [0, 1], but was asked at ${at}`,
    );
  const section = builtConnectorSection(connector, at);
  if (section === null)
    throw new Error(
      `connector "${connectorId}" of built environment "${environment.id}" states no usable section`,
    );
  return section;
};

/**
 * The usable section of one connector record, or null when it states none.
 *
 * This is the record-addressed form {@link builtConnectorSectionAt} answers
 * through. A caller already holding the record reads it here rather than
 * resolving an id a second time, because a work carrying two connectors under
 * one id would otherwise be sectioned against whichever one was declared first
 * — a contradiction validation refuses by name, and one this function has no
 * business re-deciding. The route parameter is not range-checked here; the
 * id-addressed form owns that guard.
 */
export const builtConnectorSection = (
  connector: IAutoMovieBuiltConnector,
  at: number,
): IAutoMovieConnectorSectionAt | null => {
  const sections = connector.sections ?? [];
  if (sections.length === 0)
    return connector.width === undefined || connector.clearHeight === undefined
      ? null
      : { width: connector.width, clearHeight: connector.clearHeight };
  let index = 0;
  while (index + 1 < sections.length && sections[index + 1]!.at <= at)
    index += 1;
  const from = sections[index]!;
  const to = sections[index + 1] ?? from;
  const span = to.at - from.at;
  const ratio = span <= 0 ? 0 : (at - from.at) / span;
  return {
    width: from.width + (to.width - from.width) * ratio,
    clearHeight: from.clearHeight + (to.clearHeight - from.clearHeight) * ratio,
  };
};

const requireOpening = (
  environment: IAutoMovieBuiltEnvironment,
  openingId: string,
): IAutoMovieBuiltOpening => {
  const opening = environment.openings.find(
    (candidate) => candidate.id === openingId,
  );
  if (opening === undefined)
    throw new Error(
      `built environment "${environment.id}" has no opening "${openingId}"`,
    );
  return opening;
};

const requireConnector = (
  environment: IAutoMovieBuiltEnvironment,
  connectorId: string,
): IAutoMovieBuiltConnector => {
  const connector = environment.connectors.find(
    (candidate) => candidate.id === connectorId,
  );
  if (connector === undefined)
    throw new Error(
      `built environment "${environment.id}" has no connector "${connectorId}"`,
    );
  return connector;
};

/**
 * Refuse a panel whose travel the swept envelope could not enumerate.
 *
 * The solver walks the critical angles the travel actually crosses, so an
 * infinite limit or a range spanning more than a full turn is not a wrong
 * answer waiting to happen: it is a walk that never reaches its end.
 * {@link validateBuiltEnvironment} refuses both by name and shares the very same
 * cap, so this only ever fires on a record that was never validated — and on
 * one of those, a named refusal is the only acceptable outcome.
 */
const requireEnumerableTravel = (
  environment: IAutoMovieBuiltEnvironment,
  panel: IAutoMovieMovablePanel,
): void => {
  const { min, max } = panel.motion;
  if (
    Number.isFinite(min) === false ||
    Number.isFinite(max) === false ||
    (panel.motion.kind === "revolute" &&
      max - min > 2 * Math.PI + FULL_TURN_EPSILON)
  )
    throw new Error(
      `panel "${panel.id}" of built environment "${environment.id}" travels [${min}, ${max}], which no swept envelope can enumerate`,
    );
};

const requireTravellerMatrix = (
  environment: IAutoMovieBuiltEnvironment,
  matrices: ReadonlyMap<string, number[]>,
  traveller: { id: string; element: string },
  label: string,
): number[] => {
  const world = matrices.get(traveller.element);
  if (world === undefined)
    throw new Error(
      `built environment "${environment.id}" has no element "${traveller.element}" for ${label} "${traveller.id}"`,
    );
  return world;
};

const requireSpace = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): void => {
  if (!environment.spaces.some((space) => space.id === spaceId))
    throw new Error(
      `built environment "${environment.id}" has no logical space "${spaceId}"`,
    );
};

const collectIds = <T extends { id: string }>(
  records: readonly T[],
  path: string,
  label: string,
  collector: ViolationCollector,
): Set<string> => {
  const ids = new Set<string>();
  records.forEach((record, index) => {
    nonEmpty(record.id, `${path}[${index}].id`, `${label} id`, collector);
    if (ids.has(record.id))
      collector.push(
        "type",
        `${path}[${index}].id`,
        `${label} id "${record.id}" must be unique`,
        record.id,
      );
    ids.add(record.id);
  });
  return ids;
};

const appendHierarchyCycles = <T extends { id: string; parent: string | null }>(
  records: readonly T[],
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  const byId = new Map(records.map((record) => [record.id, record]));
  const indexById = new Map(records.map((record, index) => [record.id, index]));
  const states = new Map<string, "visiting" | "visited">();
  const visit = (record: T): void => {
    const state = states.get(record.id);
    if (state === "visited") return;
    if (state === "visiting") {
      collector.push(
        "type",
        `${path}[${indexById.get(record.id)!}].parent`,
        `${label} hierarchy must be acyclic`,
        record.parent,
      );
      return;
    }
    states.set(record.id, "visiting");
    const parent = record.parent === null ? undefined : byId.get(record.parent);
    if (parent !== undefined) visit(parent);
    states.set(record.id, "visited");
  };
  records.forEach(visit);
};

const appendOwnership = <T extends { id: string; parent: string | null }>(
  records: readonly T[],
  roots: ReadonlySet<string>,
  path: string,
  label: string,
  rootLabel: string,
  collector: ViolationCollector,
): void => {
  const byId = new Map(records.map((record) => [record.id, record]));
  records.forEach((record, index) => {
    const seen = new Set<string>([record.id]);
    let current: T = record;
    while (current.parent !== null) {
      const parent = byId.get(current.parent);
      // A dangling or cyclic parent is already reported on its own path, and
      // walking it further would only repeat that one defect as an ownership
      // gap the author cannot act on.
      if (parent === undefined || seen.has(parent.id)) return;
      seen.add(parent.id);
      current = parent;
    }
    if (!roots.has(current.id))
      collector.push(
        "type",
        `${path}[${index}].parent`,
        `${label} "${record.id}" belongs to no building unit; its topmost ${label} "${current.id}" must be declared as some building unit's ${rootLabel}`,
        record.parent,
      );
  });
};

const validateReferences = (
  references: readonly string[],
  targets: ReadonlySet<string>,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  const seen = new Set<string>();
  references.forEach((reference, index) => {
    if (!targets.has(reference))
      collector.push(
        "type",
        `${path}[${index}]`,
        `${label} "${reference}" does not resolve`,
        reference,
      );
    if (seen.has(reference))
      collector.push(
        "type",
        `${path}[${index}]`,
        `${label} "${reference}" is duplicated`,
        reference,
      );
    seen.add(reference);
  });
};

const appendValidation = (
  collector: ViolationCollector,
  validation: IAutoMovieValidation,
  path: string,
  nestedRoot = "",
): void => {
  const items =
    validation.success === false
      ? validation.violations
      : (validation.warnings ?? []);
  for (const item of items)
    collector.items.push({
      ...item,
      path: item.path.replace("$input", `${path}${nestedRoot}`),
    });
};

const appendBuildingSpaceValidation = (
  collector: ViolationCollector,
  validation: IAutoMovieValidation,
): void => {
  const items =
    validation.success === false
      ? validation.violations
      : (validation.warnings ?? []);
  for (const item of items)
    collector.items.push({
      ...item,
      path: item.path
        .replace(/^\$input\.surfaces\[(\d+)\]/, "$input.surfaces[$1].surface")
        .replace(/^\$input\.walkable/, "$input.walkable"),
    });
};

/**
 * World matrices for every element, optionally displaced by panel travel.
 *
 * A joint displacement is applied after the element's own local transform and
 * therefore rides down the hierarchy, which is what makes a folding leaf work
 * without a second parenting notion: parent its element to the leaf it folds
 * against and the outer leaf's travel carries it.
 */
const worldMatricesOf = (
  environment: IAutoMovieBuiltEnvironment,
  joints: ReadonlyMap<string, number[]> = new Map(),
): Map<string, number[]> => {
  const byId = new Map(
    environment.elements.map((element) => [element.id, element]),
  );
  const matrices = new Map<string, number[]>();
  const read = (id: string): number[] => {
    const cached = matrices.get(id);
    if (cached !== undefined) return cached;
    const element = byId.get(id)!;
    const rest = Matrix4.compose(
      element.transform.translation,
      element.transform.rotation,
      element.transform.scale,
    );
    const joint = joints.get(id);
    const local = joint === undefined ? rest : Matrix4.multiply(rest, joint);
    const world =
      element.parent === null
        ? local
        : Matrix4.multiply(read(element.parent), local);
    matrices.set(id, world);
    return world;
  };
  environment.elements.forEach((element) => read(element.id));
  return matrices;
};

/** The element-local displacement one moving member carries at one value. */
const travelDelta = (
  motion: IAutoMovieTravelMotion,
  value: number,
): number[] => {
  const axis = Vector3.normalize(motion.axis);
  if (motion.kind === "prismatic")
    return Matrix4.compose(
      Vector3.scale(axis, value),
      { x: 0, y: 0, z: 0, w: 1 },
      { x: 1, y: 1, z: 1 },
    );
  const half = value / 2;
  const sine = Math.sin(half);
  const rotation: IAutoMovieQuaternion = {
    x: axis.x * sine,
    y: axis.y * sine,
    z: axis.z * sine,
    w: Math.cos(half),
  };
  // Turning about a pivot is a turn about the origin plus the offset that puts
  // the pivot back where it was.
  return Matrix4.compose(
    Vector3.subtract(
      motion.pivot,
      Quaternion.rotateVector(rotation, motion.pivot),
    ),
    rotation,
    { x: 1, y: 1, z: 1 },
  );
};

/**
 * The element-local displacement every moving member carries in a named state.
 *
 * The default is the environment's own current state; a caller asking for
 * another state gets that one instead, which is how a shot stages the same
 * building with its doors open without editing the record. An opening or run
 * that has no such state simply does not move, so asking for `open` swings the
 * doors that can open and leaves every other opening, and every lift, exactly
 * where it was.
 *
 * Openings and runs share one table because they share one rule: an element
 * carries one displacement. Validation refuses a work where two members claim
 * the same element, so the table is a merge of disjoint keys rather than a
 * race, and whichever member owns the element owns it everywhere.
 *
 * A state that names no value for a member leaves that member at rest.
 * `validateBuiltEnvironment` refuses such a record by name, and answering at
 * rest is what keeps a query over an unvalidated one from failing on a value it
 * was never given.
 */
const operationDeltas = (
  environment: IAutoMovieBuiltEnvironment,
  stateId?: string,
): Map<string, number[]> => {
  const deltas = new Map<string, number[]>();
  for (const opening of environment.openings) {
    const operation = opening.operation;
    if (operation === undefined) continue;
    const wanted = stateId ?? operation.state;
    const state = operation.states.find((candidate) => candidate.id === wanted);
    if (state === undefined) continue;
    applyPanelState(operation.panels, state, deltas);
  }
  for (const connector of environment.connectors) {
    const operation = connector.operation;
    if (operation === undefined) continue;
    const wanted = stateId ?? operation.state;
    const state = operation.states.find((candidate) => candidate.id === wanted);
    if (state === undefined) continue;
    applyCarriageState(operation.carriages, state, deltas);
  }
  return deltas;
};

/** Place every panel of one opening at the travel a named state gives it. */
const applyPanelState = (
  panels: readonly IAutoMovieMovablePanel[],
  state: IAutoMovieOperationState,
  deltas: Map<string, number[]>,
): void => {
  for (const panel of panels) {
    const entry = state.panels.find((value) => value.panel === panel.id);
    if (entry === undefined) continue;
    deltas.set(panel.element, travelDelta(panel.motion, entry.value));
  }
};

/** Place every carriage of one run at the travel a named state gives it. */
const applyCarriageState = (
  carriages: readonly IAutoMovieConnectorCarriage[],
  state: IAutoMovieConnectorState,
  deltas: Map<string, number[]>,
): void => {
  for (const carriage of carriages) {
    const entry = state.carriages.find(
      (value) => value.carriage === carriage.id,
    );
    if (entry === undefined) continue;
    deltas.set(carriage.element, travelDelta(carriage.motion, entry.value));
  }
};

const descendantSpaces = (
  spaces: readonly IAutoMovieBuiltSpace[],
  root: string,
): Set<string> => {
  const included = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const space of spaces)
      if (
        space.parent !== null &&
        included.has(space.parent) &&
        !included.has(space.id)
      ) {
        included.add(space.id);
        changed = true;
      }
  }
  return included;
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    collector.push("type", path, `${label} must be non-empty`, value);
};

const finiteVector = (
  value: IAutoMovieVector3,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(value[axis]))
      collector.push(
        "range",
        `${path}.${axis}`,
        `${label} ${axis} must be finite, but was ${value[axis]}`,
        value[axis],
      );
};

const positive = (
  value: number | undefined,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value === undefined || !Number.isFinite(value) || value <= 0)
    collector.push(
      "range",
      path,
      `${label} must be a finite number > 0, but was ${value}`,
      value ?? null,
    );
};

const unitQuaternion = (
  value: IAutoMovieQuaternion,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  const norm = Math.hypot(value.x, value.y, value.z, value.w);
  if (!Number.isFinite(norm) || Math.abs(norm - 1) > UNIT_QUATERNION_EPSILON)
    collector.push(
      "range",
      path,
      `${label} must be a unit quaternion, but its norm was ${norm}`,
      value,
    );
};

/**
 * Whether a closed planar outline names distinct, finite corners.
 *
 * The minimum corner count differs by what the outline may carry: a straight
 * face needs three, while an outline whose edges may bulge needs only two,
 * because a full circle is two half-turn arcs and demanding a third corner
 * would outlaw a round oculus for no geometric reason.
 */
const closedOutline = (
  outline: readonly IAutoMoviePlanarPoint[],
  least: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): boolean => {
  if (outline.length < least) {
    collector.push(
      "range",
      path,
      `${label} needs at least ${least} points, but had ${outline.length}`,
      outline.length,
    );
    return false;
  }
  let finite = true;
  outline.forEach((point, index) => {
    for (const axis of ["x", "y"] as const)
      if (!Number.isFinite(point[axis])) {
        finite = false;
        collector.push(
          "range",
          `${path}[${index}].${axis}`,
          `${label} ${axis} must be finite, but was ${point[axis]}`,
          point[axis],
        );
      }
  });
  if (!finite) return false;
  if (polygonShortestEdge(outline) <= PLANAR_EPSILON) {
    collector.push(
      "range",
      path,
      `${label} must not repeat a point at consecutive corners`,
      outline,
    );
    return false;
  }
  return true;
};

/**
 * Whether a closed region is one an inside test can be run against.
 *
 * Real area and no self-crossing are not stylistic demands: without them
 * "inside this region" has no answer, and every later containment or separation
 * result would be arbitrary rather than merely wrong.
 */
const closedRegion = (
  region: readonly IAutoMoviePlanarPoint[],
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (Math.abs(polygonDoubleArea(region)) <= PLANAR_EPSILON)
    collector.push("range", path, `${label} encloses no area`, region);
  else if (polygonIsSimple(region) === false)
    collector.push("type", path, `${label} must not cross itself`, region);
};

/** Whether a boundary's face is complete enough to place an opening on. */
const faceIsUsable = (
  face: IAutoMovieBoundaryFace,
  path: string,
  collector: ViolationCollector,
): boolean => {
  const before = collector.items.length;
  finiteVector(
    face.origin,
    `${path}.face.origin`,
    "boundary face origin",
    collector,
  );
  unitQuaternion(
    face.rotation,
    `${path}.face.rotation`,
    "boundary face rotation",
    collector,
  );
  positive(
    face.thickness,
    `${path}.face.thickness`,
    "boundary thickness",
    collector,
  );
  if (
    closedOutline(
      face.outline,
      3,
      `${path}.face.outline`,
      "boundary face outline",
      collector,
    )
  )
    closedRegion(
      face.outline,
      `${path}.face.outline`,
      "boundary face outline",
      collector,
    );
  return collector.items.length === before;
};

/** Whether an opening's void is complete enough to be located and bounded. */
const profileIsUsable = (
  profile: IAutoMovieOpeningProfile,
  path: string,
  collector: ViolationCollector,
): boolean => {
  const before = collector.items.length;
  closedOutline(
    profile.outline,
    2,
    `${path}.outline`,
    "opening outline",
    collector,
  );
  if (profile.bulges !== undefined) {
    if (profile.bulges.length !== profile.outline.length)
      collector.push(
        "type",
        `${path}.bulges`,
        `an opening states ${profile.bulges.length} bulges for ${profile.outline.length} edges`,
        profile.bulges.length,
      );
    profile.bulges.forEach((bulge, index) => {
      if (!Number.isFinite(bulge) || Math.abs(bulge) > 1)
        collector.push(
          "range",
          `${path}.bulges[${index}]`,
          `an edge bulge must be a finite number within [-1, 1], because an arc longer than a half turn is authored as two edges, but was ${bulge}`,
          bulge,
        );
    });
  }
  // The region an arc encloses is the hull's, not the corner polygon's: two
  // corners and two half turns are a circle, which the corners alone call flat.
  if (collector.items.length === before)
    closedRegion(
      outlineHull(profile),
      `${path}.outline`,
      "opening outline",
      collector,
    );
  return collector.items.length === before;
};

/** Validate the movable panels, named states, and hardware of one opening. */
const validateOpeningOperation = (props: {
  opening: IAutoMovieBuiltOpening;
  path: string;
  elements: ReadonlySet<string>;
  environment: IAutoMovieBuiltEnvironment;
  /** Which panel already drives an element, across the whole work. */
  driven: Map<string, string>;
  collector: ViolationCollector;
}): void => {
  const { opening, path, collector } = props;
  const operation = opening.operation;
  if (operation === undefined) return;
  const base = `${path}.operation`;
  if (opening.fill === null)
    collector.push(
      "type",
      `${path}.fill`,
      `opening "${opening.id}" declares movable panels, so it must name the element they belong to`,
      null,
    );
  if (operation.panels.length === 0)
    collector.push(
      "range",
      `${base}.panels`,
      `opening "${opening.id}" declares an operation with no movable panel`,
      operation.panels.length,
    );
  const panelIds = collectIds(
    operation.panels,
    `${base}.panels`,
    "panel",
    collector,
  );
  const owned = descendantElements(
    props.environment,
    opening.fill === null ? [] : [opening.fill],
  );
  operation.panels.forEach((panel, index) => {
    const panelPath = `${base}.panels[${index}]`;
    if (!props.elements.has(panel.element))
      collector.push(
        "type",
        `${panelPath}.element`,
        `panel element "${panel.element}" does not resolve`,
        panel.element,
      );
    else if (opening.fill !== null && !owned.has(panel.element))
      collector.push(
        "type",
        `${panelPath}.element`,
        `panel element "${panel.element}" must be the filling element "${opening.fill}" of opening "${opening.id}" or descend from it`,
        panel.element,
      );
    // One element carries one displacement, so a second panel claiming it
    // would not add a degree of freedom: it would silently lose whichever
    // travel was written first, and the record would say a thing the render
    // never does.
    const already = props.driven.get(panel.element);
    if (already !== undefined)
      collector.push(
        "type",
        `${panelPath}.element`,
        `panel element "${panel.element}" is already driven by ${already}`,
        panel.element,
      );
    else
      props.driven.set(
        panel.element,
        `panel "${panel.id}" of opening "${opening.id}"`,
      );
    positive(panel.width, `${panelPath}.width`, "panel width", collector);
    positive(panel.height, `${panelPath}.height`, "panel height", collector);
    validateTravelMotion(
      panel.motion,
      `${panelPath}.motion`,
      "panel",
      collector,
    );
  });
  if (operation.states.length === 0)
    collector.push(
      "range",
      `${base}.states`,
      `opening "${opening.id}" declares an operation with no named state`,
      operation.states.length,
    );
  collectIds(operation.states, `${base}.states`, "operating state", collector);
  operation.states.forEach((state, index) => {
    const statePath = `${base}.states[${index}]`;
    const seen = new Set<string>();
    state.panels.forEach((entry, valueIndex) => {
      const valuePath = `${statePath}.panels[${valueIndex}]`;
      if (!panelIds.has(entry.panel))
        collector.push(
          "type",
          `${valuePath}.panel`,
          `operating state "${state.id}" drives unknown panel "${entry.panel}"`,
          entry.panel,
        );
      if (seen.has(entry.panel))
        collector.push(
          "type",
          `${valuePath}.panel`,
          `operating state "${state.id}" drives panel "${entry.panel}" twice`,
          entry.panel,
        );
      seen.add(entry.panel);
      const panel = operation.panels.find(
        (candidate) => candidate.id === entry.panel,
      );
      if (panel === undefined) return;
      if (
        !Number.isFinite(entry.value) ||
        entry.value < panel.motion.min ||
        entry.value > panel.motion.max
      )
        collector.push(
          "range",
          `${valuePath}.value`,
          `operating state "${state.id}" drives panel "${panel.id}" to ${entry.value}, outside its travel [${panel.motion.min}, ${panel.motion.max}]`,
          entry.value,
        );
    });
    for (const panel of operation.panels)
      if (!seen.has(panel.id))
        collector.push(
          "type",
          `${statePath}.panels`,
          `operating state "${state.id}" gives panel "${panel.id}" no value`,
          panel.id,
        );
  });
  if (!operation.states.some((state) => state.id === operation.state))
    collector.push(
      "type",
      `${base}.state`,
      `current operating state "${operation.state}" does not resolve`,
      operation.state,
    );
  collectIds(operation.hardware, `${base}.hardware`, "hardware", collector);
  operation.hardware.forEach((piece, index) => {
    const piecePath = `${base}.hardware[${index}]`;
    nonEmpty(piece.kind, `${piecePath}.kind`, "hardware kind", collector);
    if (piece.element !== null && !props.elements.has(piece.element))
      collector.push(
        "type",
        `${piecePath}.element`,
        `hardware element "${piece.element}" does not resolve`,
        piece.element,
      );
  });
};

/**
 * Validate the one degree of freedom a moving member travels on.
 *
 * The label names what is moving so the refusal reads as the author wrote it: a
 * door leaf and a lift car share this arithmetic, and a message that called a
 * car a panel would send its author looking through the openings for it.
 */
const validateTravelMotion = (
  motion: IAutoMovieTravelMotion,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  finiteVector(motion.axis, `${path}.axis`, `${label} travel axis`, collector);
  if (Vector3.length(motion.axis) <= PLANE_NORMAL_EPSILON)
    collector.push(
      "range",
      `${path}.axis`,
      `${label} travel axis must be non-zero`,
      motion.axis,
    );
  if (motion.kind === "revolute")
    finiteVector(motion.pivot, `${path}.pivot`, `${label} pivot`, collector);
  if (!Number.isFinite(motion.min) || motion.min > 0)
    collector.push(
      "range",
      `${path}.min`,
      `${label} travel is measured from its rest pose, so the lowest value must be a finite number <= 0, but was ${motion.min}`,
      motion.min,
    );
  if (!Number.isFinite(motion.max) || motion.max < 0)
    collector.push(
      "range",
      `${path}.max`,
      `${label} travel is measured from its rest pose, so the highest value must be a finite number >= 0, but was ${motion.max}`,
      motion.max,
    );
  else if (motion.max <= motion.min)
    collector.push(
      "range",
      `${path}.max`,
      `a movable ${label} needs travel, but its range was [${motion.min}, ${motion.max}]`,
      motion.max,
    );
  else if (
    motion.kind === "revolute" &&
    motion.max - motion.min > 2 * Math.PI + FULL_TURN_EPSILON
  )
    collector.push(
      "range",
      `${path}.max`,
      `a turning ${label} may travel at most a full turn, but its range spanned ${motion.max - motion.min} radians`,
      motion.max,
    );
};

/**
 * Validate the further spaces a run serves along its own route.
 *
 * A landing is a stop, and a stop stated twice, stated at an end the run
 * already names, or stated out of order is a stop later work cannot place. The
 * fraction is strictly inside `(0, 1)` because both ends are already served by
 * the run's own `from` and `to`.
 */
const validateConnectorLandings = (
  connector: IAutoMovieBuiltConnector,
  path: string,
  spaces: ReadonlySet<string>,
  collector: ViolationCollector,
): void => {
  const landings = connector.landings;
  if (landings === undefined) return;
  const seen = new Set<string>();
  landings.forEach((landing, index) => {
    const landingPath = `${path}.landings[${index}]`;
    if (!spaces.has(landing.space))
      collector.push(
        "type",
        `${landingPath}.space`,
        `connector landing space "${landing.space}" does not resolve`,
        landing.space,
      );
    if (landing.space === connector.from || landing.space === connector.to)
      collector.push(
        "type",
        `${landingPath}.space`,
        `connector landing "${landing.space}" restates an endpoint of connector "${connector.id}"`,
        landing.space,
      );
    if (seen.has(landing.space))
      collector.push(
        "type",
        `${landingPath}.space`,
        `connector landing "${landing.space}" is stated twice`,
        landing.space,
      );
    seen.add(landing.space);
    if (!Number.isFinite(landing.at) || landing.at <= 0 || landing.at >= 1)
      collector.push(
        "range",
        `${landingPath}.at`,
        `a connector landing stops between the run's own ends, so its arc-length fraction must be within (0, 1), but was ${landing.at}`,
        landing.at,
      );
    else if (index > 0 && !(landing.at > landings[index - 1]!.at))
      collector.push(
        "range",
        `${landingPath}.at`,
        `connector landings must strictly increase along the route, but ${landing.at} followed ${landings[index - 1]!.at}`,
        landing.at,
      );
  });
};

/** Validate the travelling carriages, named states, and stops of one run. */
const validateConnectorOperation = (props: {
  connector: IAutoMovieBuiltConnector;
  path: string;
  elements: ReadonlySet<string>;
  environment: IAutoMovieBuiltEnvironment;
  /** Which member already drives an element, across the whole work. */
  driven: Map<string, string>;
  collector: ViolationCollector;
}): void => {
  const { connector, path, collector } = props;
  const operation = connector.operation;
  if (operation === undefined) return;
  const base = `${path}.operation`;
  if (connector.elements.length === 0)
    collector.push(
      "type",
      `${path}.elements`,
      `connector "${connector.id}" drives a carriage, so it must name the elements it is built from`,
      connector.elements,
    );
  if (operation.carriages.length === 0)
    collector.push(
      "range",
      `${base}.carriages`,
      `connector "${connector.id}" declares an operation with no carriage`,
      operation.carriages.length,
    );
  const carriageIds = collectIds(
    operation.carriages,
    `${base}.carriages`,
    "carriage",
    collector,
  );
  const owned = descendantElements(props.environment, connector.elements);
  operation.carriages.forEach((carriage, index) => {
    const carriagePath = `${base}.carriages[${index}]`;
    if (!props.elements.has(carriage.element))
      collector.push(
        "type",
        `${carriagePath}.element`,
        `carriage element "${carriage.element}" does not resolve`,
        carriage.element,
      );
    else if (connector.elements.length !== 0 && !owned.has(carriage.element))
      collector.push(
        "type",
        `${carriagePath}.element`,
        `carriage element "${carriage.element}" must be one of the elements connector "${connector.id}" is built from, or descend from one`,
        carriage.element,
      );
    // One element carries one displacement, and doors and runs draw from the
    // same table, so a leaf that is also a lift car would lose whichever travel
    // was written first rather than gaining a second degree of freedom.
    const already = props.driven.get(carriage.element);
    if (already !== undefined)
      collector.push(
        "type",
        `${carriagePath}.element`,
        `carriage element "${carriage.element}" is already driven by ${already}`,
        carriage.element,
      );
    else
      props.driven.set(
        carriage.element,
        `carriage "${carriage.id}" of connector "${connector.id}"`,
      );
    validateTravelMotion(
      carriage.motion,
      `${carriagePath}.motion`,
      "carriage",
      collector,
    );
  });
  const stops = new Set(connectorStops(connector));
  if (operation.states.length === 0)
    collector.push(
      "range",
      `${base}.states`,
      `connector "${connector.id}" declares an operation with no named state`,
      operation.states.length,
    );
  collectIds(operation.states, `${base}.states`, "operating state", collector);
  operation.states.forEach((state, index) => {
    const statePath = `${base}.states[${index}]`;
    if (!CONNECTOR_DRIVES.includes(state.drive))
      collector.push(
        "type",
        `${statePath}.drive`,
        `unknown connector drive "${String(state.drive)}"`,
        state.drive,
      );
    else if (state.drive === "reverse" && connector.bidirectional === false)
      collector.push(
        "type",
        `${statePath}.drive`,
        `operating state "${state.id}" drives connector "${connector.id}" in reverse, but the run is one-way`,
        state.drive,
      );
    const seen = new Set<string>();
    state.carriages.forEach((entry, valueIndex) => {
      const valuePath = `${statePath}.carriages[${valueIndex}]`;
      if (!carriageIds.has(entry.carriage))
        collector.push(
          "type",
          `${valuePath}.carriage`,
          `operating state "${state.id}" drives unknown carriage "${entry.carriage}"`,
          entry.carriage,
        );
      if (seen.has(entry.carriage))
        collector.push(
          "type",
          `${valuePath}.carriage`,
          `operating state "${state.id}" drives carriage "${entry.carriage}" twice`,
          entry.carriage,
        );
      seen.add(entry.carriage);
      if (entry.serves !== null && !stops.has(entry.serves))
        collector.push(
          "type",
          `${valuePath}.serves`,
          `operating state "${state.id}" has carriage "${entry.carriage}" serve "${entry.serves}", which is neither an endpoint nor a landing of connector "${connector.id}"`,
          entry.serves,
        );
      const carriage = operation.carriages.find(
        (candidate) => candidate.id === entry.carriage,
      );
      if (carriage === undefined) return;
      if (
        !Number.isFinite(entry.value) ||
        entry.value < carriage.motion.min ||
        entry.value > carriage.motion.max
      )
        collector.push(
          "range",
          `${valuePath}.value`,
          `operating state "${state.id}" drives carriage "${carriage.id}" to ${entry.value}, outside its travel [${carriage.motion.min}, ${carriage.motion.max}]`,
          entry.value,
        );
    });
    for (const carriage of operation.carriages)
      if (!seen.has(carriage.id))
        collector.push(
          "type",
          `${statePath}.carriages`,
          `operating state "${state.id}" gives carriage "${carriage.id}" no value`,
          carriage.id,
        );
  });
  if (!operation.states.some((state) => state.id === operation.state))
    collector.push(
      "type",
      `${base}.state`,
      `current operating state "${operation.state}" does not resolve`,
      operation.state,
    );
};

/**
 * Refuse a carriage that does not stand in the space its state says it serves.
 *
 * A named stop is a claim about geometry, so it is settled against geometry:
 * the state is applied, the element the carriage drives is placed, and its own
 * origin has to land inside the space. A space that bounds nothing is skipped
 * rather than failed, because a purely semantic container has no inside for the
 * car to be in and refusing it would outlaw a run through an unbounded region.
 *
 * Every other member stands where the environment's current state puts it, the
 * same rule the swept envelope follows, so a state is measured as the one
 * change it makes rather than against a configuration nothing declared.
 */
const validateCarriageService = (
  environment: IAutoMovieBuiltEnvironment,
  root: string,
  collector: ViolationCollector,
): void => {
  const staged = operationDeltas(environment);
  environment.connectors.forEach((connector, index) => {
    const operation = connector.operation;
    if (operation === undefined) return;
    operation.states.forEach((state, stateIndex) => {
      const claims: Array<{ space: string; carriage: string; at: number }> = [];
      state.carriages.forEach((entry, valueIndex) => {
        if (
          entry.serves === null ||
          !spaceSubtreeIsBounded(environment, entry.serves)
        )
          return;
        claims.push({
          space: entry.serves,
          carriage: entry.carriage,
          at: valueIndex,
        });
      });
      // Placing every element of the work is the expensive half, so a state
      // that claims no bounded space never pays for it.
      if (claims.length === 0) return;
      const deltas = new Map(staged);
      applyCarriageState(operation.carriages, state, deltas);
      const matrices = worldMatricesOf(environment, deltas);
      for (const claim of claims) {
        const carriage = operation.carriages.find(
          (candidate) => candidate.id === claim.carriage,
        )!;
        const world = matrices.get(carriage.element)!;
        const point: IAutoMovieVector3 = {
          x: world[12]!,
          y: world[13]!,
          z: world[14]!,
        };
        if (
          builtEnvironmentContainsPoint(environment, claim.space, point) ===
          false
        )
          collector.push(
            "range",
            `${root}.connectors[${index}].operation.states[${stateIndex}].carriages[${claim.at}].serves`,
            `operating state "${state.id}" stands carriage "${carriage.id}" at (${point.x}, ${point.y}, ${point.z}), which is outside the space "${claim.space}" it serves`,
            claim.space,
          );
      }
    });
  });
};

/**
 * Refuse a configuration the scene could not stage, in any state the record
 * names.
 *
 * A staged node is world TRS, so a composed hierarchy carrying shear cannot be
 * lowered without silently dropping it. Checking only the state the record
 * currently stands in would let a door pass shut and lie open: the same
 * revolute leaf below a non-uniformly scaled ancestor is a clean rigid frame at
 * rest and a sheared one a quarter turn later, and both the staged set and the
 * placement queries would answer with a decomposition that never existed.
 *
 * Only the subtree a state actually moves is re-checked. A delta rides down
 * from the element it drives, so nothing above or beside it can change, and
 * measuring the untouched remainder once per state would be the same answer
 * paid for again.
 */
const validateStagedConfigurations = (
  environment: IAutoMovieBuiltEnvironment,
  root: string,
  collector: ViolationCollector,
): void => {
  const staged = operationDeltas(environment);
  const base = worldMatricesOf(environment, staged);
  environment.elements.forEach((element, index) => {
    if (isSheared(base.get(element.id)!))
      collector.push(
        "type",
        `${root}.elements[${index}].transform`,
        "the composed hierarchy contains shear, which cannot be lowered to the scene's world TRS; keep rotated descendants below uniformly scaled ancestors",
        element.transform,
      );
  });

  /** Report the elements one alternative configuration would shear. */
  const alternative = (props: {
    path: string;
    state: string;
    moved: readonly string[];
    deltas: Map<string, number[]>;
  }): void => {
    const touched = descendantElements(environment, props.moved);
    const matrices = worldMatricesOf(environment, props.deltas);
    for (const id of touched)
      if (isSheared(matrices.get(id)!)) {
        collector.push(
          "type",
          props.path,
          `operating state "${props.state}" composes shear into element "${id}", which cannot be lowered to the scene's world TRS; keep rotated descendants below uniformly scaled ancestors`,
          props.state,
        );
        return;
      }
  };
  environment.openings.forEach((opening, index) => {
    const operation = opening.operation;
    if (operation === undefined) return;
    operation.states.forEach((state, stateIndex) => {
      if (state.id === operation.state) return;
      const deltas = new Map(staged);
      applyPanelState(operation.panels, state, deltas);
      alternative({
        path: `${root}.openings[${index}].operation.states[${stateIndex}]`,
        state: state.id,
        moved: operation.panels.map((panel) => panel.element),
        deltas,
      });
    });
  });
  environment.connectors.forEach((connector, index) => {
    const operation = connector.operation;
    if (operation === undefined) return;
    operation.states.forEach((state, stateIndex) => {
      if (state.id === operation.state) return;
      const deltas = new Map(staged);
      applyCarriageState(operation.carriages, state, deltas);
      alternative({
        path: `${root}.connectors[${index}].operation.states[${stateIndex}]`,
        state: state.id,
        moved: operation.carriages.map((carriage) => carriage.element),
        deltas,
      });
    });
  });
};

/** Whether a world matrix carries more than a position, rotation, and scale. */
const isSheared = (world: number[]): boolean => {
  const decomposed = Matrix4.decompose(world);
  const recomposed = Matrix4.compose(
    decomposed.position,
    Quaternion.normalize(decomposed.rotation),
    decomposed.scale,
  );
  const magnitude = Math.max(1, ...world.map((value) => Math.abs(value)));
  const difference = Math.max(
    ...world.map((value, index) => Math.abs(value - recomposed[index]!)),
  );
  return difference > magnitude * MATRIX_ROUND_TRIP_EPSILON;
};

/** Whether a logical space or any space under it bounds a volume at all. */
const spaceSubtreeIsBounded = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): boolean => {
  const included = descendantSpaces(environment.spaces, spaceId);
  return environment.spaces.some(
    (space) => included.has(space.id) && space.cells.length !== 0,
  );
};

/** The spaces one run serves, in the order its own route reaches them. */
const connectorStops = (connector: IAutoMovieBuiltConnector): string[] => [
  connector.from,
  ...(connector.landings ?? []).map((landing) => landing.space),
  connector.to,
];

/** The named elements and every element below them. */
const descendantElements = (
  environment: IAutoMovieBuiltEnvironment,
  roots: readonly string[],
): Set<string> => {
  const owned = new Set<string>(roots);
  if (owned.size === 0) return owned;
  let changed = true;
  while (changed) {
    changed = false;
    for (const element of environment.elements)
      if (
        element.parent !== null &&
        owned.has(element.parent) &&
        !owned.has(element.id)
      ) {
        owned.add(element.id);
        changed = true;
      }
  }
  return owned;
};

/** Validate a connector's stations, section spelling, slope, and steps. */
const validateConnectorShape = (
  connector: IAutoMovieBuiltConnector,
  path: string,
  collector: ViolationCollector,
): void => {
  const measurable =
    connector.route.length >= 2 &&
    connector.route.every((point) =>
      [point.x, point.y, point.z].every(Number.isFinite),
    );
  if (measurable)
    for (let index = 0; index + 1 < connector.route.length; ++index)
      if (
        Vector3.length(
          Vector3.subtract(
            connector.route[index + 1]!,
            connector.route[index]!,
          ),
        ) <= ROUTE_EPSILON
      )
        collector.push(
          "range",
          `${path}.route[${index + 1}]`,
          "consecutive connector route stations must be distinct",
          connector.route[index + 1],
        );
  if (connector.orientations !== undefined) {
    if (connector.orientations.length !== connector.route.length)
      collector.push(
        "type",
        `${path}.orientations`,
        `a connector states ${connector.orientations.length} station facings for ${connector.route.length} route points`,
        connector.orientations.length,
      );
    connector.orientations.forEach((rotation, index) =>
      unitQuaternion(
        rotation,
        `${path}.orientations[${index}]`,
        "connector station facing",
        collector,
      ),
    );
  }

  const scalar =
    connector.width !== undefined || connector.clearHeight !== undefined;
  if (connector.sections !== undefined && scalar)
    collector.push(
      "type",
      `${path}.sections`,
      "a connector states a constant width and clear height or a varying section, never both",
      connector.sections.length,
    );
  else if (connector.sections === undefined && !scalar)
    collector.push(
      "range",
      `${path}.width`,
      "a connector must state a constant width and clear height, or a varying section",
      null,
    );
  else if (scalar) {
    positive(connector.width, `${path}.width`, "connector width", collector);
    positive(
      connector.clearHeight,
      `${path}.clearHeight`,
      "connector clear height",
      collector,
    );
  } else
    validateConnectorSections(
      connector.sections!,
      `${path}.sections`,
      collector,
    );

  const metrics = measurable ? routeMetrics(connector.route) : null;
  if (connector.slope !== undefined) {
    if (
      !Number.isFinite(connector.slope) ||
      connector.slope < 0 ||
      connector.slope > Math.PI / 2
    )
      collector.push(
        "range",
        `${path}.slope`,
        `connector slope must be a finite number within [0, PI / 2], but was ${connector.slope}`,
        connector.slope,
      );
    else if (
      metrics !== null &&
      Math.abs(connector.slope - metrics.slope) > SLOPE_TOLERANCE
    )
      collector.push(
        "range",
        `${path}.slope`,
        `connector states a slope of ${connector.slope} radians, but its own route rises at ${metrics.slope}`,
        connector.slope,
      );
  }
  if (connector.steps !== undefined) {
    const steps = connector.steps;
    const before = collector.items.length;
    if (!Number.isSafeInteger(steps.count) || steps.count < 1)
      collector.push(
        "range",
        `${path}.steps.count`,
        `a stepped connector needs a safe integer step count >= 1, but had ${steps.count}`,
        steps.count,
      );
    positive(steps.rise, `${path}.steps.rise`, "step rise", collector);
    positive(steps.run, `${path}.steps.run`, "step run", collector);
    if (collector.items.length === before && metrics !== null) {
      if (
        Math.abs(steps.count * steps.rise - Math.abs(metrics.rise)) >
        STEP_TOLERANCE
      )
        collector.push(
          "range",
          `${path}.steps.rise`,
          `${steps.count} steps of ${steps.rise} m climb ${steps.count * steps.rise} m, but the route climbs ${Math.abs(metrics.rise)} m`,
          steps.rise,
        );
      if (Math.abs(steps.count * steps.run - metrics.run) > STEP_TOLERANCE)
        collector.push(
          "range",
          `${path}.steps.run`,
          `${steps.count} steps of ${steps.run} m run ${steps.count * steps.run} m, but the route runs ${metrics.run} m`,
          steps.run,
        );
    }
  }
};

/** Validate a connector's varying section stations. */
const validateConnectorSections = (
  sections: readonly IAutoMovieConnectorSection[],
  path: string,
  collector: ViolationCollector,
): void => {
  if (sections.length < 2) {
    collector.push(
      "range",
      path,
      `a varying connector section needs at least 2 stations, but had ${sections.length}`,
      sections.length,
    );
    return;
  }
  if (sections[0]!.at !== 0)
    collector.push(
      "range",
      `${path}[0].at`,
      `a varying connector section must begin at 0, but began at ${sections[0]!.at}`,
      sections[0]!.at,
    );
  const last = sections.length - 1;
  if (sections[last]!.at !== 1)
    collector.push(
      "range",
      `${path}[${last}].at`,
      `a varying connector section must end at 1, but ended at ${sections[last]!.at}`,
      sections[last]!.at,
    );
  sections.forEach((section, index) => {
    if (index > 0 && !(section.at > sections[index - 1]!.at))
      collector.push(
        "range",
        `${path}[${index}].at`,
        `connector section stations must strictly increase, but ${section.at} followed ${sections[index - 1]!.at}`,
        section.at,
      );
    positive(
      section.width,
      `${path}[${index}].width`,
      "section width",
      collector,
    );
    positive(
      section.clearHeight,
      `${path}[${index}].clearHeight`,
      "section clear height",
      collector,
    );
  });
};

/** Cumulative 3D arc length at each route station, starting at zero. */
const cumulativeRouteLengths = (
  route: readonly IAutoMovieVector3[],
): number[] => {
  const lengths = [0];
  for (let index = 0; index + 1 < route.length; ++index)
    lengths.push(
      lengths[index]! +
        Vector3.length(Vector3.subtract(route[index + 1]!, route[index]!)),
    );
  return lengths;
};

/**
 * The point one arc-length fraction reaches along a route polyline.
 *
 * Measuring by arc length rather than by point index is what keeps a landing on
 * an unevenly spaced route where its author put it, exactly as a connector
 * section is placed. Only {@link builtConnectorGeometry} calls this, and it has
 * already refused a route with no measurable length, so the segment the
 * fraction falls in always exists.
 */
const routePointAt = (
  route: readonly IAutoMovieVector3[],
  cumulative: readonly number[],
  total: number,
  at: number,
): IAutoMovieVector3 => {
  const target = at * total;
  let index = 0;
  while (index + 2 < route.length && cumulative[index + 1]! < target)
    index += 1;
  const span = cumulative[index + 1]! - cumulative[index]!;
  const ratio = span <= 0 ? 0 : (target - cumulative[index]!) / span;
  const from = route[index]!;
  const to = route[index + 1]!;
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
    z: from.z + (to.z - from.z) * ratio,
  };
};

/** Climb, horizontal run, 3D length, and slope of one route polyline. */
const routeMetrics = (
  route: readonly IAutoMovieVector3[],
): { rise: number; run: number; length: number; slope: number } => {
  let run = 0;
  let length = 0;
  for (let index = 0; index + 1 < route.length; ++index) {
    const delta = Vector3.subtract(route[index + 1]!, route[index]!);
    run += Math.hypot(delta.x, delta.z);
    length += Vector3.length(delta);
  }
  const rise = route[route.length - 1]!.y - route[0]!.y;
  return { rise, run, length, slope: Math.atan2(Math.abs(rise), run) };
};

/**
 * Refuse a closed leaf that does not fit the void it fills.
 *
 * The leaf is measured where it actually rests, projected into the host
 * boundary's own frame, so a leaf and a void authored in unrelated coordinates
 * disagree here instead of at render time. Nothing is said about a leaf smaller
 * than its void: two leaves sharing one opening, or a sash inside a frame, are
 * ordinary designs, while a leaf larger than its own hole is not a design at
 * all.
 *
 * Only the two in-plane coordinates are compared. How far the leaf sits in
 * front of or behind the face is a design freedom, not an error: a leaf in a
 * rebate, a storm sash outside the frame, and a surface-mounted sliding leaf
 * all rest off the face's own plane on purpose.
 *
 * Containment is the same test a void gets against its face, so a leaf that
 * spans the notch of a concave void is refused even though each of its corners
 * is inside.
 */
const validatePanelFit = (
  environment: IAutoMovieBuiltEnvironment,
  root: string,
  faces: ReadonlyMap<string, IAutoMovieBoundaryFace>,
  hulls: ReadonlyMap<number, IAutoMoviePlanarPoint[]>,
  collector: ViolationCollector,
): void => {
  const matrices = worldMatricesOf(environment);
  environment.openings.forEach((opening, index) => {
    const operation = opening.operation;
    const hull = hulls.get(index);
    const face = faces.get(opening.boundary);
    if (operation === undefined || hull === undefined || face === undefined)
      return;
    const inverse = Quaternion.inverse(face.rotation);
    operation.panels.forEach((panel, panelIndex) => {
      const world = matrices.get(panel.element)!;
      const corners: IAutoMovieVector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: panel.width, y: 0, z: 0 },
        { x: panel.width, y: panel.height, z: 0 },
        { x: 0, y: panel.height, z: 0 },
      ];
      const planar = corners.map((corner) => {
        const local = Quaternion.rotateVector(
          inverse,
          Vector3.subtract(applyMatrix(world, corner), face.origin),
        );
        return { x: local.x, y: local.y };
      });
      if (polygonInside(planar, hull) === false)
        collector.push(
          "range",
          `${root}.openings[${index}].operation.panels[${panelIndex}]`,
          `panel "${panel.id}" does not fit inside the void of opening "${opening.id}" when it rests closed`,
          { width: panel.width, height: panel.height },
        );
    });
  });
};

/** Apply a column-major matrix to a point. */
const applyMatrix = (
  matrix: readonly number[],
  point: IAutoMovieVector3,
): IAutoMovieVector3 => ({
  x:
    matrix[0]! * point.x +
    matrix[4]! * point.y +
    matrix[8]! * point.z +
    matrix[12]!,
  y:
    matrix[1]! * point.x +
    matrix[5]! * point.y +
    matrix[9]! * point.z +
    matrix[13]!,
  z:
    matrix[2]! * point.x +
    matrix[6]! * point.y +
    matrix[10]! * point.z +
    matrix[14]!,
});

/** Apply a column-major matrix's linear part to a direction. */
const applyDirection = (
  matrix: readonly number[],
  vector: IAutoMovieVector3,
): IAutoMovieVector3 => ({
  x: matrix[0]! * vector.x + matrix[4]! * vector.y + matrix[8]! * vector.z,
  y: matrix[1]! * vector.x + matrix[5]! * vector.y + matrix[9]! * vector.z,
  z: matrix[2]! * vector.x + matrix[6]! * vector.y + matrix[10]! * vector.z,
});

/** The world bounds one leaf corner reaches across a panel's whole travel. */
const sweptCornerBounds = (
  base: readonly number[],
  motion: IAutoMovieTravelMotion,
  corner: IAutoMovieVector3,
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => {
  const axis = Vector3.normalize(motion.axis);
  if (motion.kind === "prismatic") {
    const ends = [motion.min, motion.max].map((value) =>
      applyMatrix(base, Vector3.add(corner, Vector3.scale(axis, value))),
    );
    return boundsOf(ends);
  }
  const offset = Vector3.subtract(corner, motion.pivot);
  const along = Vector3.scale(axis, Vector3.dot(axis, offset));
  const center = applyMatrix(base, Vector3.add(motion.pivot, along));
  const cosine = applyDirection(base, Vector3.subtract(offset, along));
  const sine = applyDirection(base, Vector3.cross(axis, offset));
  const reach = (component: "x" | "y" | "z"): { low: number; high: number } => {
    const phase = Math.atan2(sine[component], cosine[component]);
    const angles = [motion.min, motion.max];
    const first = Math.ceil((motion.min - phase) / Math.PI);
    const last = Math.floor((motion.max - phase) / Math.PI);
    for (let step = first; step <= last; ++step)
      angles.push(phase + step * Math.PI);
    const values = angles.map(
      (angle) =>
        center[component] +
        cosine[component] * Math.cos(angle) +
        sine[component] * Math.sin(angle),
    );
    return { low: Math.min(...values), high: Math.max(...values) };
  };
  const x = reach("x");
  const y = reach("y");
  const z = reach("z");
  return {
    min: { x: x.low, y: y.low, z: z.low },
    max: { x: x.high, y: y.high, z: z.high },
  };
};

const boundsOf = (
  points: readonly IAutoMovieVector3[],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => ({
  min: {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
    z: Math.min(...points.map((point) => point.z)),
  },
  max: {
    x: Math.max(...points.map((point) => point.x)),
    y: Math.max(...points.map((point) => point.y)),
    z: Math.max(...points.map((point) => point.z)),
  },
});
