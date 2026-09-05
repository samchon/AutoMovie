import {
  IAutoMovieBoundaryFace,
  IAutoMovieBuiltBoundary,
  IAutoMovieBuiltConnector,
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltOpening,
  IAutoMovieBuiltPopulation,
  IAutoMovieBuiltSpace,
  IAutoMovieConnectorCarriage,
  IAutoMovieConnectorSection,
  IAutoMovieConnectorState,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieMovablePanel,
  IAutoMovieOpeningProfile,
  IAutoMovieOperationState,
  IAutoMoviePlanarPoint,
  IAutoMovieQuaternion,
  IAutoMovieSpace,
  IAutoMovieSpaceShell,
  IAutoMovieTravelMotion,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieWallOpening } from "../geometry/proceduralMesh";
import { tessellate } from "../geometry/tessellate";
import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { compareAutoMovieRenderIds } from "../render/renderDigest";
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

/**
 * Validate the graph, geometry references, and spatial topology of a building.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `validateBuiltEnvironment` validates the graph, geometry references, and spatial topology of a building. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `validateBuiltEnvironment` performs built environment validation when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 * @evidence requirements/interior/connections-and-circulation.md#interior-route-refusal `validateBuiltEnvironment` rejects missing or identical connector endpoints, short or non-finite routes, invalid section dimensions, slopes, landings, states, and operation travel instead of accepting a broken circulation path.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology `validateBuiltEnvironment` enforces the connector endpoints, route, section, landing, and operation invariants that make one circulation topology usable.
 * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-validation `validateBuiltEnvironment` checks each opening's host and cut geometry, fill and panel containment, overlap, named states, travel, and panel fit before the opening can enter the built environment.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation `validateBuiltEnvironment` enforces the host, aperture, fill, panel, state, and travel invariants of an operable opening.
 * @evidence requirements/interior/columns-beams-and-architectural-elements.md#interior-element-open-form `validateBuiltEnvironment` admits open element kinds and arbitrary referenced models while validating stable identity, ownership, hierarchy, and parent-local transforms.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-element-host-support-form The validator implements the open-form, model-reference, owner, hierarchy, and transform subset without claiming structural support analysis.
 * @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-multilevel-spaces `validateBuiltEnvironment` preserves arbitrary convex cells and closed triangle shells in three dimensions instead of flattening logical spaces into one storey plane.
 * @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-boundaries `validateBuiltEnvironment` validates stable boundary identities whose faces relate one or two logical spaces.
 * @evidence requirements/interior/spatial-hierarchy-and-zones.md#interior-space-graph-validation `validateBuiltEnvironment` rejects unresolved parents, ownership collisions, cycles, malformed cells, and open or inconsistently wound shells.
 * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-hierarchy-zone-overlay The validator implements the three-dimensional space hierarchy, containment, boundary, and topology subset without claiming authored logical-zone overlays.
 * @evidence requirements/interior/validation-and-iteration.md#interior-addressable-diagnostics `validateBuiltEnvironment` reports each failed building identity, relation, transform, face, cell, shell, opening, and connector fact at its stable input path with observed and expected values.
 * @evidence requirements/interior/validation-and-iteration.md#interior-geometry-topology-validation `validateBuiltEnvironment` checks finite geometry, face outlines, cell planes, shell closure and winding, containment, ownership, and graph topology before lowering.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-layered-validation-diagnostics The building validator contributes the addressable geometry-and-topology layer without claiming visual review, code compliance, or every diagnostic field.
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-boundary-validation `validateBuiltEnvironment` rejects invalid boundary thickness, planar face geometry, ownership, shell closure, opening containment, and overlapping cuts.
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-partial-freeform `validateBuiltEnvironment` accepts arbitrary simple planar face outlines and faceted closed shells rather than limiting walls to full-height rectangles.
 * @evidence requirements/interior/walls-partitions-and-linings.md#interior-wall-two-sided-ownership `validateBuiltEnvironment` preserves one boundary identity shared by at most two spaces instead of duplicating the construction for each side.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-wall-partition-boundary The validator implements the boundary face, thickness, one-or-two-space ownership, cut, and topology subset without claiming finish-side policy.
 * @evidence requirements/building-exterior/balconies-terraces-and-courtyards.md#building-exterior-space-boundary `validateBuiltEnvironment` preserves each enclosing or open boundary face and its related space identities without claiming guard or drainage compliance.
 * @evidence requirements/building-exterior/balconies-terraces-and-courtyards.md#building-exterior-space-identity `validateBuiltEnvironment` validates stable building-owned space identity, three-dimensional extent, boundaries, surfaces, and connectors.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-space-input-output The building-space graph implements the stable identity, extent, boundary, and access-relation subset without claiming weather exposure or resolved drainage.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-space-boundary-drainage-invariant The validator contributes the boundary-face and open-edge identity subset without claiming guards, thresholds, or water-path analysis.
 * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-identity `validateBuiltEnvironment` makes one boundary or opening identity own the shared face, cut, and related space references.
 * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-shared-boundary-identity The validator enforces single shared boundary and opening identities for its built-environment subset without claiming site control-point authority.
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-interior-consistency `validateBuiltEnvironment` uses one host face, aperture profile, depth, fill, panel, and named state for an opening seen from either related space.
 * @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-identity `validateBuiltEnvironment` binds stable building units to unique visible-element and logical-space roots and rejects unattributed or multiply owned members.
 * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-scope-input-normalization The validator implements building-unit, root, element, space, unit, and ownership normalization without claiming phase or source-revision authority.
 * @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-linked-interior `validateBuiltEnvironment` keeps exterior elements, logical interior spaces, shared boundaries, openings, and connectors under the same building-unit ownership graph.
 * @evidence specifications/building-envelope/linked-interior-coordination.md#building-envelope-linked-interior-input-output The unified building graph implements shared building, space, boundary, and opening identity without claiming revision, authority, or coordination receipts.
 * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-geometry-validation `validateBuiltEnvironment` reports addressable exterior element, boundary, opening, connector, cell, and shell geometry or topology failures.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-validation-finding-output The validator supplies stable paths, severity, observed values, and expected conditions for its geometry subset without claiming the specification's full finding schema.
 * @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation `validateBuiltEnvironment` jointly validates the shared boundary, opening, coordinate hierarchy, containment, and ownership facts held in one built environment.
 * @evidence specifications/building-envelope/linked-interior-coordination.md#building-envelope-linked-interior-matrix-rules The validator implements the boundary, opening, coordinate, and containment rows of the coordination matrix without claiming area, storey, or stale-propagation coverage.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group `validateBuiltEnvironment` requires each compact population to name one declared logical space, keeping spatial membership explicit and separate from logical grouping.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality `validateBuiltEnvironment` refuses unresolved or duplicated compact population ownership and placement laws that a space query could not inspect.
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds `validateBuiltEnvironment` requires a finite, ordered prototype-local bound before any population world bound can be derived.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs `validateBuiltEnvironment` checks the declared model-local extent and every placement scalar consumed by the deterministic population bounds fold.
 */
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
    if (space.cells.length !== 0 && space.shell !== undefined)
      collector.push(
        "type",
        `${path}.shell`,
        "a logical space states its volume once: carry either convex cells or a boundary shell, not both",
        space.shell,
      );
    if (space.fidelity !== undefined) {
      if (space.fidelity !== "exact" && space.fidelity !== "faceted")
        collector.push(
          "type",
          `${path}.fidelity`,
          `logical-space fidelity must be "exact" or "faceted", but was ${String(space.fidelity)}`,
          space.fidelity,
        );
      else if (space.cells.length === 0 && space.shell === undefined)
        collector.push(
          "type",
          `${path}.fidelity`,
          "a logical space that states no volume has nothing for a fidelity to describe",
          space.fidelity,
        );
    }
    if (space.shell !== undefined)
      validateSpaceShell(space.shell, `${path}.shell`, collector);
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

  const populationIds = new Set<string>();
  (environment.populations ?? []).forEach((population, index) => {
    const path = `${root}.populations[${index}]`;
    nonEmpty(population.set.id, `${path}.set.id`, "population id", collector);
    if (populationIds.has(population.set.id))
      collector.push(
        "type",
        `${path}.set.id`,
        `population id "${population.set.id}" is duplicated`,
        population.set.id,
      );
    populationIds.add(population.set.id);
    if (!spaceIds.has(population.space))
      collector.push(
        "type",
        `${path}.space`,
        `population space "${population.space}" does not resolve`,
        population.space,
      );
    validatePopulationPrototypeBounds(
      population.prototypeBounds,
      `${path}.prototypeBounds`,
      collector,
    );
    validatePopulationSet(population.set, `${path}.set`, collector);
  });

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
 *
 * A declared population leaves as the compact instance set it already is, never
 * expanded into set pieces. That is what makes the building the one owner of its
 * own repeated parts: the set the production world stages and the set a space
 * query measures are the same record, so no second copy of a placement law can
 * drift away from the first.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `lowerBuiltEnvironment` lowers one building record to ordinary subject contributions. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `lowerBuiltEnvironment` performs built environment lowering when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 * @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-coordinate-transform-chain `lowerBuiltEnvironment` composes every building root and child element's declared local translation, rotation, and scale in parent-to-child order into deterministic world transforms.
 * @evidence specifications/building-envelope/identity-scope-and-coordinates.md#building-envelope-coordinate-input-output The lowering implements the building-root and child-transform composition subset without claiming CRS, control-point residual, or source-frame receipts.
 * @evidence requirements/building-exterior/facades-and-walls.md#building-facade-placement-basis `lowerBuiltEnvironment` preserves each facade element's authored parent-local transform and resolves it through the building coordinate root rather than applying a view-dependent offset.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-facade-placement-input The lowering contributes deterministic local-to-world facade placement while face-region selection, corners, and panel rules remain authored facts.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group `lowerBuiltEnvironment` contributes each space-owned compact population as the same instance-set record instead of expanding it or duplicating its placement law.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality `lowerBuiltEnvironment` preserves a compressed population's stable set identity, count, seed, and selectable-member regeneration contract in the production world.
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
  const populations = environment.populations ?? [];
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
    // A population is contributed as the compact set it already is, never
    // expanded into set pieces: the whole point of declaring 2,392 slates as
    // one record is that nothing downstream has to hold 2,392 of anything. The
    // key is omitted rather than emitted empty so a record without populations
    // merges byte-for-byte as it did before the field existed.
    ...(populations.length === 0
      ? {}
      : { instanceSets: populations.map((population) => population.set) }),
  };
};

/**
 * Merge several subject-owned support spaces into one stage space.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `mergeAutoMovieSpaces` merges several subject-owned support spaces into one stage space. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `mergeAutoMovieSpaces` performs auto movie spaces merge when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export const mergeAutoMovieSpaces = (
  id: string,
  spaces: readonly IAutoMovieSpace[],
): IAutoMovieSpace => ({
  id,
  surfaces: spaces.flatMap((space) => space.surfaces),
  walkable: spaces.flatMap((space) => space.walkable),
});

/**
 * Test whether a point lies in a logical space or any of its child spaces.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentContainsPoint` tests whether a point lies in a logical space or any of its child spaces. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentContainsPoint` tests the requested logical space and its descendant spaces until one declared volume contains the point.
 */
export const builtEnvironmentContainsPoint = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
  point: IAutoMovieVector3,
): boolean => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  return environment.spaces.some(
    (space) => included.has(space.id) && builtSpaceContainsPoint(space, point),
  );
};

/**
 * Does one logical space's own stated volume contain a point?
 *
 * The single place either spelling is read, so nothing has to know which one a
 * space used: a celled space is the union of its half-space cells, a shelled
 * space is the inside of its own closed boundary, and a space that states
 * neither locates nothing and contains nothing. Every containment consumer —
 * the descendant-folding query above, room visibility's per-leaf placement,
 * prop occupancy, a fluid basin's stray-cell walk — goes through here, because
 * a second reading of the same field is how a room and its own camera ended up
 * with two answers about where the camera stood.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtSpaceContainsPoint` answers "Does one logical space's own stated volume contain a point?" This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtSpaceContainsPoint` tests a point only against one logical space's own declared cells or shell.
 * @author Samchon
 */
export const builtSpaceContainsPoint = (
  space: IAutoMovieBuiltSpace,
  point: IAutoMovieVector3,
): boolean => {
  if (space.shell !== undefined)
    return spaceShellContainsPoint(space.shell, point);
  return space.cells.some((cell) =>
    cell.planes.every(
      (plane) =>
        plane.normal.x * point.x +
          plane.normal.y * point.y +
          plane.normal.z * point.z <=
        plane.offset + CONTAINMENT_EPSILON,
    ),
  );
};

/**
 * Does a logical space bound a volume at all, in either spelling?
 *
 * A space that states none is a name — "the west wing" — and every consumer
 * treats that differently from an empty one: props are not refused inside it, a
 * sight line through it cannot be ruled out, a fluid lattice has nothing to be
 * outside of. Asking through this rather than through `cells.length` is what
 * keeps a shelled space from reading as unlocated.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtSpaceStatesVolume` answers "Does a logical space bound a volume at all, in either spelling?" This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtSpaceStatesVolume` performs declared-volume test when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 * @author Samchon
 */
export const builtSpaceStatesVolume = (space: IAutoMovieBuiltSpace): boolean =>
  space.cells.length !== 0 || space.shell !== undefined;

/**
 * Is the space's stated volume a single convex region?
 *
 * A caller deciding one rectangle against a convex region only has to test its
 * corners; against anything else the middle can fall through a notch, a void,
 * or the gap between two cells. This answers which of the two it is holding, so
 * the cheap test is taken exactly when it is exact.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtSpaceIsConvex` answers "Is the space's stated volume a single convex region?" This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtSpaceIsConvex` performs space-convexity test when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 * @author Samchon
 */
export const builtSpaceIsConvex = (space: IAutoMovieBuiltSpace): boolean =>
  space.shell === undefined && space.cells.length === 1;

/**
 * What a logical space's own volume claims to be, folded over its descendants.
 *
 * `"unstated"` is a subtree that bounds nothing at all, `"faceted"` is a
 * subtree where at least one stated volume declares itself an approximation of
 * a curved region, and `"exact"` is everything else. Folding matters because a
 * storey holding one vaulted hall is a storey whose measured volume is a facet
 * count: the approximation does not stop at the space that declared it.
 *
 * This engine has no curved boundary primitive, so a curved region cannot be
 * stated exactly by any spelling here. That limit is reported rather than
 * smoothed over: a caller that wants an exact dome learns it is holding flats.
 *
 * What fills the region never enters this answer. The question is what a space
 * says its own volume is, so an element, a population, or an empty room all
 * leave it alone; the blindness to populations that
 * {@link builtEnvironmentSpaceContentBounds} carried was a blindness about
 * contents, and this fold never looked at contents to begin with.
 *
 * It folds because {@link builtEnvironmentContainsPoint} folds: the caller who
 * asked whether a prop stands in a storey, or whether a fluid lattice stays in
 * a basin, got an answer over that whole subtree and this is how exact that
 * answer was. **Nothing inside the engine asks it yet.** The take-off and the
 * drafter read the declaration directly instead, because a gap has to name the
 * spaces that carry it rather than a verdict over a subtree, so the folded form
 * is here for the authoring surface — where the same question is asked before a
 * placement rather than after a measurement — and it needs an entry on the
 * sandbox's engine export list before a source module can reach it.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentSpaceFidelity` returns what a logical space's own volume claims to be, folded over its descendants. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentSpaceFidelity` performs space-fidelity fold when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 * @author Samchon
 */
export const builtEnvironmentSpaceFidelity = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): "exact" | "faceted" | "unstated" => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  const stated = environment.spaces.filter(
    (space) => included.has(space.id) && builtSpaceStatesVolume(space),
  );
  if (stated.length === 0) return "unstated";
  return stated.some((space) => space.fidelity === "faceted")
    ? "faceted"
    : "exact";
};

/**
 * Volume, in cubic metres, enclosed by a closed outward-wound shell.
 *
 * The divergence theorem over triangles: a sixth of the summed scalar triple
 * products. Voids subtract themselves, because their facets are wound the other
 * way and contribute the negative of what they enclose, which is the whole
 * reason an atrium is inner facets rather than a second record. Exact for the
 * flats as written; what the flats stand for is
 * {@link builtEnvironmentSpaceFidelity}'s answer, not this one's.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtSpaceShellVolume` produces volume, in cubic metres, enclosed by a closed outward-wound shell. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtSpaceShellVolume` performs volume calculation when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
 * @author Samchon
 */
export const builtSpaceShellVolume = (shell: IAutoMovieSpaceShell): number => {
  let sum = 0;
  for (let face = 0; face + 2 < shell.triangles.length; face += 3) {
    const a = shell.vertices[shell.triangles[face]!];
    const b = shell.vertices[shell.triangles[face + 1]!];
    const c = shell.vertices[shell.triangles[face + 2]!];
    if (a === undefined || b === undefined || c === undefined) continue;
    sum +=
      a.x * (b.y * c.z - b.z * c.y) +
      a.y * (b.z * c.x - b.x * c.z) +
      a.z * (b.x * c.y - b.y * c.x);
  }
  return sum / 6;
};

/**
 * Is a point inside a closed shell?
 *
 * The winding number, summed as signed solid angles (Van Oosterom–Strackee), so
 * the answer never depends on a ray direction somebody had to pick and a void's
 * inward facets cancel the outer boundary's contribution exactly. A point
 * strictly inside subtends a full turn, a point outside subtends nothing, and a
 * point in a void subtends nothing because that is what a void is.
 *
 * The shell's own surface is inside it, tested first and by distance, because
 * solid angle degenerates exactly where a crate's corner sits: on a face it is
 * half a turn, but on an edge or at a vertex it is whatever the dihedral
 * happens to be, so a box standing in the corner of a room would have been
 * reported outside the room it is in.
 */
const spaceShellContainsPoint = (
  shell: IAutoMovieSpaceShell,
  point: IAutoMovieVector3,
): boolean => {
  let winding = 0;
  for (let face = 0; face + 2 < shell.triangles.length; face += 3) {
    const a = shell.vertices[shell.triangles[face]!];
    const b = shell.vertices[shell.triangles[face + 1]!];
    const c = shell.vertices[shell.triangles[face + 2]!];
    if (a === undefined || b === undefined || c === undefined) continue;
    if (pointOnTriangle(point, a, b, c)) return true;
    winding += signedSolidAngle(point, a, b, c);
  }
  return Math.abs(winding) >= 2 * Math.PI;
};

/** Signed solid angle triangle `abc` subtends at `point`, in steradians. */
const signedSolidAngle = (
  point: IAutoMovieVector3,
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
): number => {
  const u = Vector3.subtract(a, point);
  const v = Vector3.subtract(b, point);
  const w = Vector3.subtract(c, point);
  const lu = Vector3.length(u);
  const lv = Vector3.length(v);
  const lw = Vector3.length(w);
  const numerator = Vector3.dot(u, Vector3.cross(v, w));
  const denominator =
    lu * lv * lw +
    Vector3.dot(u, v) * lw +
    Vector3.dot(u, w) * lv +
    Vector3.dot(v, w) * lu;
  return 2 * Math.atan2(numerator, denominator);
};

/** Whether a point sits on triangle `abc`, its edges and corners included. */
const pointOnTriangle = (
  point: IAutoMovieVector3,
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
): boolean => {
  const ab = Vector3.subtract(b, a);
  const ac = Vector3.subtract(c, a);
  const ap = Vector3.subtract(point, a);
  const normal = Vector3.cross(ab, ac);
  const area = Vector3.length(normal);
  if (area <= PLANE_NORMAL_EPSILON) return false;
  if (Math.abs(Vector3.dot(ap, normal)) > CONTAINMENT_EPSILON * area)
    return false;
  const bp = Vector3.subtract(point, b);
  const bc = Vector3.subtract(c, b);
  const slack = CONTAINMENT_EPSILON * area;
  return (
    Vector3.dot(Vector3.cross(ab, ap), normal) >= -slack &&
    Vector3.dot(Vector3.cross(bc, bp), normal) >= -slack &&
    Vector3.dot(
      Vector3.cross(Vector3.subtract(a, c), Vector3.subtract(point, c)),
      normal,
    ) >= -slack
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentAdjacentSpaces` returns spaces directly joined by a boundary or traversal connector. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentAdjacentSpaces` finds the logical spaces joined to a space by a boundary or traversal connector inside one building-interior boundary.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentSpaceConnectors` returns every connector landing on a logical space, endpoints and route intact. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentSpaceConnectors` collects the connectors whose landings belong to a logical space while preserving their endpoints and routes.
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
 * Return every boundary that encloses or separates a logical space.
 *
 * {@link builtEnvironmentAdjacentSpaces} already walks these records, and keeps
 * only the far-side space ids. That answers which rooms are next to this one and
 * discards what stands between them — the boundary's identity, its `kind`, and
 * the elements realizing it — so the one record able to state "this room's
 * ceiling is that slab" had no reader. The same pairing
 * {@link builtEnvironmentSpaceConnectors} makes for traversal is the pairing
 * enclosure was missing: adjacency answers which spaces are joined, this answers
 * with what.
 *
 * That absence is not theoretical. On two authored buildings every floor slab
 * was assigned to a storey rather than to the rooms it covers, which is what the
 * record asks for — a slab between two storeys belongs to neither room alone,
 * and {@link IAutoMovieBuiltPopulation.space} states that a room's contents are
 * what stands in it and not what covers it. Every rule involved behaved as
 * designed, and a reviewer still could not ask either building what enclosed a
 * room, so a room whose ceiling was owned elsewhere on purpose read exactly like
 * a room with no ceiling at all.
 *
 * Matched exactly rather than through containment, which is the rule
 * {@link builtEnvironmentAdjacentSpaces} and {@link builtEnvironmentSpaceConnectors}
 * already follow: asking a storey returns the storey's own enclosure and not
 * every partition standing inside its rooms. Boundaries are handed back whole,
 * because `kind` is the part that distinguishes a ceiling from a wall and
 * `elements` is the part that says whether anything visible realizes it — a
 * boundary with an empty `elements` is a separation the design declares and
 * nothing builds, and reducing these to ids would hide both facts.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentSpaceBoundaries` returns every boundary enclosing or separating a logical space, so the authored enclosure of a room stays reviewable rather than being reachable only as an anonymous adjacency.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentSpaceBoundaries` collects the boundaries a logical space is named on within one building-interior boundary, preserving each boundary's kind and realizing elements.
 * @author Samchon
 */
export const builtEnvironmentSpaceBoundaries = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): IAutoMovieBuiltBoundary[] => {
  requireSpace(environment, spaceId);
  return environment.boundaries.filter((boundary) =>
    boundary.spaces.includes(spaceId),
  );
};

/**
 * Report the support patches usable in a logical space and its descendants.
 *
 * Support and walkability are separate facts: a roof deck may carry a prop
 * without being somewhere a performer may walk. Both are answered by the stable
 * surface id the lowered stage space also cites, so a caller never has to match
 * geometry to learn which patch it is holding.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentSpaceSurfaces` reports the support patches usable in a logical space and its descendants. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentSpaceSurfaces` collects support patches owned by a logical space or any of its descendants.
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
 * The elements of a building that neither a logical space nor a parent reaches.
 *
 * An element's assignment to a logical space is authored, and an exterior wall, a
 * foundation, or a structural frame belongs to no room, so leaving one unassigned
 * is correct rather than careless. Measured on one authored building, 9 of its 30
 * elements are claimed by no space, and every one of the nine is envelope or
 * vertical-transport machinery — curtain panels, a facade ladder, a lift car and
 * its counterweight — while every floor slab, partition, door and leaf is claimed.
 * The assignment is a fact about what occupies a room, not a measure of care.
 *
 * The reach path therefore belongs on the element hierarchy rather than on the
 * space tree, and that is the record's own arrangement:
 * {@link IAutoMovieBuiltEnvironment.buildings} states that ownership is total,
 * every element descending from exactly one unit's roots. A space is an index
 * over that hierarchy, so an unassigned element is not detached, only unindexed.
 *
 * What is left over is therefore small and exact. A child is listed among its
 * parent's members, and a claimed element is listed by the space that claims it,
 * so the only element nothing names is one that is a root of the hierarchy and
 * carries no space of its own. Naming anything more would list the same element
 * twice and tell the reader it hangs from nothing while the record says
 * otherwise, which is what happened when this took the compiled scene's drawn set
 * as its notion of reach: on that same building it named seven envelope pieces as
 * roots although their unit root is claimed by a space.
 *
 * A resolvable hierarchy is the precondition, which `validateBuiltEnvironment`
 * enforces by rejecting an unresolved parent and a parent cycle.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentUnclaimedElements` names the building elements no logical space and no parent element reaches, so authored interior and envelope state stays reachable for review instead of being addressable only by a key nobody has.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentUnclaimedElements` derives those roots from the element hierarchy of one building rather than from a space assignment it does not have.
 * @author Samchon
 */
export const builtEnvironmentUnclaimedElements = (
  environment: IAutoMovieBuiltEnvironment,
): string[] =>
  environment.elements
    .filter((element) => element.space === null && element.parent === null)
    .map((element) => `${environment.id}/${element.id}`);

/**
 * Name what is staged in a logical space and its descendants.
 *
 * This is the join that keeps the visible model and the semantic partition from
 * drifting apart: a room can be asked what is visibly inside it without a
 * second traversal that could answer differently.
 *
 * Two spellings come back, in this order, because two things are staged. An
 * element contributes exactly the `node` id {@link lowerBuiltEnvironment} emits
 * for it, `<environment>/<element>`. A population contributes
 * `instance-set:<set>`, the one owner id the render inventory and the semantic
 * mask already address a whole population by, because lowering emits it as one
 * compact set and not as `count` nodes. Naming the population rather than its
 * members is the difference between an answer and an unbounded expansion: one
 * authored field of roof slate is 2,392 members, and a query a reviewer calls
 * in a loop may not hand back 2,392 strings to say "there is slate here".
 * {@link builtEnvironmentSpacePopulations} hands back the sets themselves for a
 * caller that wants the placement law. Regeneration names a procedural member
 * `instance:<set>:slot:<six-digit-index>` and an explicit member
 * `instance:<set>:<transform-id>`, exactly as the production materializer does.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentSpaceNodes` names the staged set nodes and populations standing in a logical space and its descendants. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentSpaceNodes` collects staged node ids from a logical space and every child space within its building boundary.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group `builtEnvironmentSpaceNodes` answers for a compact population under the space that owns it, so compression does not remove the population from the question "what stands here".
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality `builtEnvironmentSpaceNodes` keeps a compressed population addressable by one stable owner id without expanding or omitting its members.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality `builtEnvironmentSpaceNodes` addresses a compressed population by its stable owner id rather than dropping it from the staged listing.
 */
export const builtEnvironmentSpaceNodes = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): string[] => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  return [
    ...environment.elements
      .filter(
        (element) =>
          element.model !== null &&
          element.space !== null &&
          included.has(element.space),
      )
      .map((element) => `${environment.id}/${element.id}`),
    ...(environment.populations ?? [])
      .filter((population) => included.has(population.space))
      .map((population) => `instance-set:${population.set.id}`),
  ];
};

/**
 * Report the compact populations standing in a logical space and its
 * descendants.
 *
 * {@link builtEnvironmentSpaceNodes} names them; this hands back the records, so
 * a caller that needs a member's own transform regenerates it from the same set
 * the renderer draws instead of re-deriving a placement law from the geometry.
 * Selection is by declared membership, exactly as an element's is: a population
 * states the one space it occupies and every ancestor of that space folds it in,
 * so nothing here tests a member's position against a cell. That is deliberate.
 * A floor flag rests on the floor plane and an ashlar block sits inside the
 * wall, both of them on or across the boundary a derived test would have to
 * judge them against, so deriving membership would answer "the room is empty" in
 * exactly the cases the room is most full.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group `builtEnvironmentSpacePopulations` answers which compact populations a space owns, which is the space membership this requirement holds apart from a member's logical groups.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality `builtEnvironmentSpacePopulations` exposes the compact source record needed to regenerate and inspect individual members without storing a member-sized answer.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality `builtEnvironmentSpacePopulations` keeps a compressed population selectable and inspectable through the space that owns it.
 * @author Samchon
 */
export const builtEnvironmentSpacePopulations = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): IAutoMovieBuiltPopulation[] => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  return (environment.populations ?? []).filter((population) =>
    included.has(population.space),
  );
};

/**
 * The world box the contents of a logical space and its descendants fill.
 *
 * A declared space and the thing standing in it are two different extents, and
 * reading the first as the second is what puts a review camera in an empty
 * corner. In the medieval-residence experiment the space `stair-ground` is
 * declared over x 3.5..14.5, z 5.5..11.5 while the stair tower filling it
 * occupies x 8.93..14.13, z 5.90..11.10, so three of four cameras placed at the
 * declared cell's corners stood outside the tower and framed a wall. The cell
 * answers how far the room reaches; this answers where its content is, which is
 * the question a reviewer placing an eye actually asks.
 *
 * What is measured is exactly what {@link builtEnvironmentSpaceNodes} names: the
 * staged set pieces and the compact populations of this space and every space
 * below it. Each element stands where the environment's current operating state
 * puts it, which is where {@link lowerBuiltEnvironment} stages it, so a leaf
 * authored open widens the box by the leaf where it actually rests. Geometry is
 * read through {@link tessellate} for a primitive and from the stated mesh
 * otherwise, the same vertices the renderer draws, so the box cannot drift from
 * the picture.
 *
 * **A population widens this box, and that is the intended change rather than a
 * regression.** Before populations existed the answer counted elements alone,
 * and in the medieval-residence experiment that meant a room whose slate, ashlar
 * and flagging were four instance sets reported the box of whatever few elements
 * were left over: not `null`, which would have been noticed, but a plausibly
 * small box a review camera then aimed into a corner. A caller that stored the
 * old answer is holding a narrower box than the room's contents, so an eye
 * derived from it frames less than it did. A population contributes through
 * {@link builtInstanceSetPlacementBounds}, which measures the region its
 * declared placement law spans after folding the population's authored
 * prototype-local box through every scale and rotation that law permits. The
 * building cannot inspect the recipe's mesh, so the local box is the explicit
 * geometry fact that keeps a one-member table from collapsing to its origin.
 *
 * An element citing a runtime model reference, whose bytes this record never
 * holds, contributes its own world origin rather than nothing, exactly as one
 * whose parts draw no vertices does. A space furnished entirely by referenced
 * models therefore still reports where its content stands, and the horizontal
 * degeneracy is deliberate: a width the record never stated is a number that
 * would frame geometry nobody wrote down.
 *
 * `null` is a space with nothing placed in it at any depth. That is an ordinary
 * answer, not a fault: an undressed room and a purely semantic container ("the
 * west wing") are both legitimately empty, so refusing would make every caller
 * guard a normal case, and this file keeps refusal for an undeclared space id,
 * which is the caller's own mistake. A degenerate box would be worse than null,
 * because nothing distinguishes it from one real element standing at the
 * origin.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentSpaceContentBounds` reports the world box the placed contents of a logical space and its descendants fill. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentSpaceContentBounds` resolves the element hierarchy, ownership, and geometry of one logical-space subtree into its world extent inside one building-interior boundary.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group `builtEnvironmentSpaceContentBounds` includes every compact population owned by the queried space subtree instead of losing it behind instance compression.
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality `builtEnvironmentSpaceContentBounds` measures a compressed population from its stable placement law rather than treating omitted expansion as empty content.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality `builtEnvironmentSpaceContentBounds` folds the compact population record itself, so a spatial query remains proportional to populations rather than procedural members.
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds `builtEnvironmentSpaceContentBounds` keeps the authored prototype-local extent separate from the world-space content box it derives.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs `builtEnvironmentSpaceContentBounds` derives the current world extent from the population's declared local bound and placement law without persisting a second placement box.
 * @author Samchon
 */
export const builtEnvironmentSpaceContentBounds = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } | null => {
  requireSpace(environment, spaceId);
  const included = descendantSpaces(environment.spaces, spaceId);
  const matrices = worldMatricesOf(environment, operationDeltas(environment));
  const models = new Map(
    environment.models.map((model) => [model.id, model] as const),
  );
  const points = environment.elements
    .filter(
      (element) =>
        element.model !== null &&
        element.space !== null &&
        included.has(element.space),
    )
    .flatMap((element) =>
      placedElementPoints(
        models.get(element.model!),
        matrices.get(element.id)!,
      ),
    );
  for (const population of environment.populations ?? [])
    if (included.has(population.space)) {
      const bounds = builtInstanceSetPlacementBounds(
        population.set,
        population.prototypeBounds,
      );
      points.push(bounds.min, bounds.max);
    }
  return points.length === 0 ? null : boundsOf(points);
};

/**
 * The world box one compact population and its prototype geometry occupy.
 *
 * The placement law and the authored local box are the two inputs. A grid and a
 * lattice contribute only their occupied hull corners, including a short final
 * row, so thousands of repeated members cost the same bounded fold as four. A
 * scatter contributes its declared disk rather than copying the seeded
 * materializer. The local box is then scaled and rotated about every slot.
 * Fixed rotations stay exact. A non-constant seeded rotation range contributes
 * the smallest origin-centred sphere enclosing every scaled local corner; that
 * conservative result cannot crop a member, and records that it is an authored
 * range rather than pretending to know which unexpanded slots sampled which
 * angles. Explicit transforms are already stored per member, so their exact
 * rotations and scales are folded directly and cost only the data the author
 * chose to store. Visibility variation never shrinks the result: this is the
 * declared population's occupied placement envelope, not a seed-expanded list
 * of the members visible in one render sample.
 *
 * `along-route` is refused: its slots follow a production-world route, and a
 * building record carries no field that can reach one. `validateBuiltEnvironment`
 * refuses such a population outright, so this throws only for a caller handing
 * over a world set directly.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-logical-group `builtInstanceSetPlacementBounds` measures where a compact population stands so the space owning it can answer for it.
 * @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds `builtInstanceSetPlacementBounds` keeps the authored prototype-local box distinct from the world-space result derived after slot placement, rotation, and scale.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality `builtInstanceSetPlacementBounds` derives the population's extent from the stored count, seed, and layout the specification allows compression to keep.
 * @evidence specifications/asset-and-representation/bounds-proxies-and-lod.md#asset-spec-bounds-inputs `builtInstanceSetPlacementBounds` consumes an explicit model-local bound and returns the corresponding deterministic world-space placement bound.
 * @author Samchon
 */
export const builtInstanceSetPlacementBounds = (
  set: IAutoMovieInstanceSetDesign,
  prototypeBounds: IAutoMovieBuiltPopulation["prototypeBounds"],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => {
  const layout = set.layout;
  if (layout.kind === "along-route")
    throw new Error(
      `instance set "${set.id}" is placed along world route "${layout.route}", which a built environment carries no field to resolve`,
    );
  const collector = new ViolationCollector();
  validatePopulationPrototypeBounds(
    prototypeBounds,
    "$input.prototypeBounds",
    collector,
  );
  validatePopulationSet(set, "$input.set", collector);
  if (collector.items.length !== 0) {
    const first = collector.items[0]!;
    throw new RangeError(
      `instance set "${set.id}" cannot be bounded: ${first.path} ${first.expected}`,
    );
  }
  if (layout.kind === "explicit") {
    return boundsOf(
      layout.transforms.slice(0, set.count).flatMap((transform) => {
        const position = placeInstancePoint(set, transform.translation);
        const rotation = Quaternion.normalize(
          Quaternion.multiply(
            Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, set.facingDeg),
            transform.rotation,
          ),
        );
        return prototypeBoxCorners(prototypeBounds).map((corner) => {
          const offset = Quaternion.rotateVector(rotation, {
            x: corner.x * transform.scale.x,
            y: corner.y * transform.scale.y,
            z: corner.z * transform.scale.z,
          });
          return Vector3.add(position, offset);
        });
      }),
    );
  }
  const placement =
    layout.kind === "scatter"
      ? {
          min: {
            x: set.anchor.x - layout.radius,
            y: set.anchor.y,
            z: set.anchor.z - layout.radius,
          },
          max: {
            x: set.anchor.x + layout.radius,
            y: set.anchor.y,
            z: set.anchor.z + layout.radius,
          },
        }
      : boundsOf(
          instanceSetExtremeSlots(set, layout).map((point) =>
            placeInstancePoint(set, point),
          ),
        );
  const offset = populationPrototypeOffsetBounds(set, prototypeBounds);
  return {
    min: Vector3.add(placement.min, offset.min),
    max: Vector3.add(placement.max, offset.max),
  };
};

/** Place one layout-local point under the set's anchor and base heading. */
const placeInstancePoint = (
  set: IAutoMovieInstanceSetDesign,
  point: IAutoMovieVector3,
): IAutoMovieVector3 => {
  const radians = (set.facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: set.anchor.x + point.x * cosine + point.z * sine,
    y: set.anchor.y + point.y,
    z: set.anchor.z - point.x * sine + point.z * cosine,
  };
};

/** The eight corners of one model-local box, duplicates included when flat. */
const prototypeBoxCorners = (
  bounds: IAutoMovieBuiltPopulation["prototypeBounds"],
): IAutoMovieVector3[] =>
  [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => ({ x, y, z })),
    ),
  );

/** The prototype offset shared by every compact, non-explicit layout slot. */
const populationPrototypeOffsetBounds = (
  set: IAutoMovieInstanceSetDesign,
  bounds: IAutoMovieBuiltPopulation["prototypeBounds"],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => {
  const scaleRange = set.variation.scale3;
  const scales =
    scaleRange === undefined
      ? [set.variation.scale.min, set.variation.scale.max].map((scale) => ({
          x: scale,
          y: scale,
          z: scale,
        }))
      : [scaleRange.min.x, scaleRange.max.x].flatMap((x) =>
          [scaleRange.min.y, scaleRange.max.y].flatMap((y) =>
            [scaleRange.min.z, scaleRange.max.z].map((z) => ({ x, y, z })),
          ),
        );
  const rotationRange = set.variation.rotationDeg;
  const rotationVaries =
    rotationRange !== undefined &&
    (rotationRange.x.min !== rotationRange.x.max ||
      rotationRange.y.min !== rotationRange.y.max ||
      rotationRange.z.min !== rotationRange.z.max);
  if (rotationVaries) {
    let radius = 0;
    for (const corner of prototypeBoxCorners(bounds))
      for (const scale of scales)
        radius = Math.max(
          radius,
          Math.hypot(
            corner.x * scale.x,
            corner.y * scale.y,
            corner.z * scale.z,
          ),
        );
    return {
      min: { x: -radius, y: -radius, z: -radius },
      max: { x: radius, y: radius, z: radius },
    };
  }
  const variationRotation =
    rotationRange === undefined
      ? Quaternion.identity()
      : Quaternion.fromEuler({
          x: rotationRange.x.min,
          y: rotationRange.y.min,
          z: rotationRange.z.min,
          order: "XYZ",
        });
  const rotation = Quaternion.normalize(
    Quaternion.multiply(
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, set.facingDeg),
      variationRotation,
    ),
  );
  return boundsOf(
    prototypeBoxCorners(bounds).flatMap((corner) =>
      scales.map((scale) =>
        Quaternion.rotateVector(rotation, {
          x: corner.x * scale.x,
          y: corner.y * scale.y,
          z: corner.z * scale.z,
        }),
      ),
    ),
  );
};

/**
 * The set-local points that can carry a deterministic layout's extremes.
 *
 * A rotated point set's world box is the box of its convex hull's corners, so a
 * lattice needs its corners rather than its slots. The last row of a grid may be
 * short, which is why the corner list is not simply four: the hull then has the
 * full rows' far corner and the short row's own end, and taking the full
 * rectangle instead would report a column of slate nobody laid.
 */
const instanceSetExtremeSlots = (
  set: IAutoMovieInstanceSetDesign,
  layout: Exclude<
    IAutoMovieInstanceSetDesign["layout"],
    { kind: "along-route" } | { kind: "explicit" } | { kind: "scatter" }
  >,
): IAutoMovieVector3[] => {
  const perLayer = layout.rows * layout.columns;
  const layers =
    layout.kind === "lattice" ? Math.ceil(set.count / perLayer) : 1;
  const withinLayer =
    layers > 1 ? perLayer : Math.min(set.count, layout.rows * layout.columns);
  const top = layout.kind === "lattice" ? (layers - 1) * layout.spacing.y : 0;
  return gridExtremeCells(withinLayer, layout.columns).flatMap((cell) =>
    (top === 0 ? [0] : [0, top]).map((y) => ({
      x: (cell.column - (layout.columns - 1) / 2) * layout.spacing.x,
      y,
      z: cell.row * layout.spacing.z,
    })),
  );
};

/** The hull corners of `count` slots laid row-major into `columns` columns. */
const gridExtremeCells = (
  count: number,
  columns: number,
): Array<{ column: number; row: number }> => {
  const rows = Math.ceil(count / columns);
  const last = count - (rows - 1) * columns;
  if (rows === 1)
    return [
      { column: 0, row: 0 },
      { column: last - 1, row: 0 },
    ];
  return [
    { column: 0, row: 0 },
    { column: columns - 1, row: 0 },
    { column: 0, row: rows - 1 },
    { column: last - 1, row: rows - 1 },
    ...(last === columns ? [] : [{ column: columns - 1, row: rows - 2 }]),
  ];
};

/** Every world point one drawn part contributes. */
const placedPartPoints = (
  part: IAutoMovieModel["parts"][number],
  world: number[],
): IAutoMovieVector3[] => {
  const points: IAutoMovieVector3[] = [];
  const positions =
    part.geometry.type === "primitive"
      ? tessellate(part.geometry.shape).positions
      : part.geometry.mesh.positions;
  const matrix =
    part.transform === null
      ? world
      : Matrix4.multiply(
          world,
          Matrix4.compose(
            part.transform.translation,
            part.transform.rotation,
            part.transform.scale,
          ),
        );
  for (let index = 0; index + 2 < positions.length; index += 3)
    points.push(
      applyMatrix(matrix, {
        x: positions[index]!,
        y: positions[index + 1]!,
        z: positions[index + 2]!,
      }),
    );
  return points;
};

/**
 * The world points one placed element draws, or its origin when it draws none.
 *
 * Parts are placed the way the renderer places them, each under its own
 * transform and then under the element's world matrix. A model the environment
 * does not own is `undefined` here rather than an error, because a runtime
 * model reference is a legal way to furnish a building and the record simply
 * does not carry its vertices.
 */
const placedElementPoints = (
  model: IAutoMovieModel | undefined,
  world: number[],
): IAutoMovieVector3[] => {
  const points = (model === undefined ? [] : model.parts).flatMap((part) =>
    placedPartPoints(part, world),
  );
  return points.length === 0
    ? [applyMatrix(world, { x: 0, y: 0, z: 0 })]
    : points;
};

/**
 * One world box per drawn part, rather than one box over all of them.
 *
 * A model's union box says where the body is and nothing about how much of that
 * volume it fills. A shelf is a back panel and two boards, so its union spans
 * floor to head height and is mostly air; anything standing on a board is
 * inside that box, and a test written against the union reports an overlap that
 * is true about the boxes and false about the bodies. The same box puts the
 * bearing face at the panel's top rather than at the board the object rests on,
 * which is the paired "floating" answer.
 *
 * Part boxes are contained in the union box, so every answer they give is one
 * the union would also have given or a false positive the union invented. A
 * single-part body yields exactly the union box and behaves as before.
 *
 * An element with no drawn part keeps its degenerate origin box, for the reason
 * {@link builtEnvironmentElementBounds} states.
 */
const placedPartBoxes = (
  model: IAutoMovieModel | undefined,
  world: number[],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 }[] => {
  const boxes: { min: IAutoMovieVector3; max: IAutoMovieVector3 }[] = [];
  for (const part of model === undefined ? [] : model.parts) {
    const points = placedPartPoints(part, world);
    if (points.length !== 0) boxes.push(boundsOf(points));
  }
  return boxes.length === 0
    ? [boundsOf([applyMatrix(world, { x: 0, y: 0, z: 0 })])]
    : boxes;
};

/**
 * The world boxes one element's drawn parts fill, one per part.
 *
 * Answers the question {@link builtEnvironmentElementBounds} cannot: how much of
 * a body's box is body. A caller testing whether two placed things intersect,
 * or which face one rests on, reads these rather than the union, because a
 * multi-part body's union is mostly air and says so nowhere.
 *
 * `null` for the same reasons the union answers `null`: an element that was
 * never declared, or one that draws nothing.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support `builtEnvironmentElementPartBounds` supplies the per-part world extents a support probe needs to name the face an object actually rests on.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Resolves one element's placed geometry into its drawn parts' world boxes while preserving the measurement basis.
 * @author Samchon
 */
export const builtEnvironmentElementPartBounds = (
  environment: IAutoMovieBuiltEnvironment,
  elementId: string,
): { min: IAutoMovieVector3; max: IAutoMovieVector3 }[] | null => {
  const element = environment.elements.find(
    (candidate) => candidate.id === elementId,
  );
  if (element === undefined || element.model === null) return null;
  const matrices = worldMatricesOf(environment, operationDeltas(environment));
  const model = environment.models.find(
    (candidate) => candidate.id === element.model,
  );
  return placedPartBoxes(model, matrices.get(element.id)!);
};

/**
 * Every drawn element's part boxes, resolved in one pass over the record.
 *
 * {@link builtEnvironmentElementPartBounds} answers for one element and walks
 * the whole element tree to do it, which is the right cost for one question and
 * the wrong one for a sweep: a building with three thousand placed bodies would
 * pay that walk three thousand times. This resolves the world matrices once and
 * reads every element through them, so a whole-building pass is one walk.
 *
 * A transform-only element is absent rather than present and empty, matching the
 * single-element answer's `null`, because a grouping node draws nothing and a
 * caller that finds no entry should fall back to the box the record reports for
 * it rather than treat it as a body with no volume.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Supplies the per-part world extents a whole-building support pass needs without re-walking the element tree once per body.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Resolves every drawn element's placed geometry into its parts' world boxes from a single placement pass.
 * @author Samchon
 */
export const builtEnvironmentPartBoxes = (
  environment: IAutoMovieBuiltEnvironment,
): Map<string, { min: IAutoMovieVector3; max: IAutoMovieVector3 }[]> => {
  const matrices = worldMatricesOf(environment, operationDeltas(environment));
  const models = new Map(
    environment.models.map((model) => [model.id, model] as const),
  );
  const boxes = new Map<
    string,
    { min: IAutoMovieVector3; max: IAutoMovieVector3 }[]
  >();
  for (const element of environment.elements) {
    if (element.model === null) continue;
    boxes.set(
      element.id,
      placedPartBoxes(models.get(element.model), matrices.get(element.id)!),
    );
  }
  return boxes;
};

/**
 * The world box one named element's placed geometry fills.
 *
 * **This is the engine's one computation of an element's world extent, and
 * every layer above asks it rather than repeating it.** Placement validation
 * resolves an element locator through here, subject description answers "where
 * is this element" through here, and the space fold above measures its elements
 * through the same private placement and tessellation this calls. A fourth
 * spelling of the same box is the defect this sentence exists to prevent: the
 * medieval-residence campaign built its own element-bounds probe by hand and
 * used it more than the viewer, which is exactly how a second answer to one
 * question gets written.
 *
 * The element stands where the environment's current operating state puts it,
 * so a leaf authored open is measured where it rests. Geometry is read through
 * {@link tessellate} for a primitive and from the stated mesh otherwise, the
 * same vertices the renderer draws.
 *
 * `null` has two ordinary readings, and neither is a fault. An id this record
 * never declared resolves to nothing, because the caller is usually resolving a
 * locator that project source authored and an unresolved locator is a finding
 * for that caller to report rather than an engine refusal — which is why this
 * answers `null` where the space queries in this file throw. A transform-only
 * element draws nothing, so it has no geometry box either, and it is left out
 * here for exactly the reason {@link builtEnvironmentSpaceContentBounds} leaves
 * it out of a room's contents: a grouping node standing eight metres up is not
 * something a camera can be aimed at.
 *
 * An element citing a runtime model reference, whose bytes this record never
 * holds, contributes its own world origin rather than nothing, so the answer is
 * a degenerate box at the place the record does state.
 *
 * One call stages the whole work's transform hierarchy, because an element's
 * world matrix is its ancestors' product. A caller resolving many locators over
 * one environment pays that once per locator, which is worth knowing before
 * putting this inside a loop over thousands of placements.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance `builtEnvironmentElementBounds` answers for one placed occurrence by its own stable identity, keeping a single placement's extent distinct from the prototype it reuses.
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentElementBounds` reports the world box one declared building element's placed geometry fills. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance `builtEnvironmentElementBounds` reports the placement fact recorded against one instance identity rather than a fact about its shared prototype.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentElementBounds` resolves one element's hierarchy, operating state, and geometry into its world extent inside one building-interior boundary.
 * @author Samchon
 */
export const builtEnvironmentElementBounds = (
  environment: IAutoMovieBuiltEnvironment,
  elementId: string,
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } | null => {
  const element = environment.elements.find(
    (candidate) => candidate.id === elementId,
  );
  if (element === undefined || element.model === null) return null;
  const matrices = worldMatricesOf(environment, operationDeltas(environment));
  const model = environment.models.find(
    (candidate) => candidate.id === element.model,
  );
  return boundsOf(placedElementPoints(model, matrices.get(element.id)!));
};

/**
 * Name the building unit that owns a logical space.
 *
 * A work holds several independently placed building units, so "which building
 * is this room in" is a real question rather than a constant. A validated
 * environment answers it for every space; an unowned space is refused here for
 * the same reason validation refuses it.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentBuildingOfSpace` names the building unit that owns a logical space. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentBuildingOfSpace` resolves a logical space id to the building unit that owns it.
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

/**
 * The rectangular wall panel and cut voids one boundary's own face implies.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieBoundaryWallCut` represents the rectangular wall panel and cut voids one boundary's own face implies. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieBoundaryWallCut` structures the rectangular wall panel and cut voids one boundary's own face implies for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieBoundaryWallCut {
  /**
   * Panel extent along the boundary's local X, in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `width` records `IAutoMovieBoundaryWallCut`'s panel extent along the boundary's local X, in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `width` supplies `IAutoMovieBoundaryWallCut`'s panel extent along the boundary's local X, in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  width: number;
  /**
   * Panel extent along the boundary's local Y, in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `height` records `IAutoMovieBoundaryWallCut`'s panel extent along the boundary's local Y, in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `height` supplies `IAutoMovieBoundaryWallCut`'s panel extent along the boundary's local Y, in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  height: number;
  /**
   * Panel extent along the boundary's local Z, in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `depth` records `IAutoMovieBoundaryWallCut`'s panel extent along the boundary's local Z, in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `depth` supplies `IAutoMovieBoundaryWallCut`'s panel extent along the boundary's local Z, in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  depth: number;
  /**
   * World position of the panel's own centre.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `origin` records `IAutoMovieBoundaryWallCut`'s world position of the panel's own centre. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `origin` supplies `IAutoMovieBoundaryWallCut`'s world position of the panel's own centre when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  origin: IAutoMovieVector3;
  /**
   * World rotation of the panel, taken from the boundary's face.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `rotation` records `IAutoMovieBoundaryWallCut`'s world rotation of the panel, taken from the boundary's face. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `rotation` supplies `IAutoMovieBoundaryWallCut`'s world rotation of the panel, taken from the boundary's face when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  rotation: IAutoMovieQuaternion;
  /**
   * Kernel voids, each keyed by the architectural opening that declared it.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `openings` records `IAutoMovieBoundaryWallCut`'s kernel voids, each keyed by the architectural opening that declared it. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `openings` supplies `IAutoMovieBoundaryWallCut`'s kernel voids, each keyed by the architectural opening that declared it when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  openings: IAutoMovieWallOpening[];
}

/**
 * Where one movable panel stands, in world space, at one operating state.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieOpeningPanelPlacement` defines where one movable panel stands, in world space, at one operating state. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieOpeningPanelPlacement` structures where one movable panel stands, in world space, at one operating state for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieOpeningPanelPlacement {
  /**
   * Panel id inside its opening.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `panel` records `IAutoMovieOpeningPanelPlacement`'s panel id inside its opening. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `panel` supplies `IAutoMovieOpeningPanelPlacement`'s panel id inside its opening when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  panel: string;
  /**
   * The visible element the panel drives.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `element` records `IAutoMovieOpeningPanelPlacement`'s visible element the panel drives. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `element` supplies `IAutoMovieOpeningPanelPlacement`'s visible element the panel drives when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  element: string;
  /**
   * The staged node id {@link lowerBuiltEnvironment} emits for that element.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `node` records `IAutoMovieOpeningPanelPlacement`'s staged node id `lowerBuiltEnvironment` emits for that element. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `node` supplies `IAutoMovieOpeningPanelPlacement`'s staged node id `lowerBuiltEnvironment` emits for that element when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  node: string;
  /**
   * World translation of the panel's element.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `position` records `IAutoMovieOpeningPanelPlacement`'s world translation of the panel's element. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `position` supplies `IAutoMovieOpeningPanelPlacement`'s world translation of the panel's element when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  position: IAutoMovieVector3;
  /**
   * World rotation of the panel's element, as a unit quaternion.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `rotation` records `IAutoMovieOpeningPanelPlacement`'s world rotation of the panel's element, as a unit quaternion. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `rotation` supplies `IAutoMovieOpeningPanelPlacement`'s world rotation of the panel's element, as a unit quaternion when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  rotation: IAutoMovieQuaternion;
  /**
   * World per-axis scale of the panel's element.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `scale` records `IAutoMovieOpeningPanelPlacement`'s world per-axis scale of the panel's element. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `scale` supplies `IAutoMovieOpeningPanelPlacement`'s world per-axis scale of the panel's element when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  scale: IAutoMovieVector3;
}

/**
 * The world volume one movable panel sweeps across its whole travel.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieOpeningSweep` represents the world volume one movable panel sweeps across its whole travel. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieOpeningSweep` structures the world volume one movable panel sweeps across its whole travel for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieOpeningSweep {
  /**
   * Panel id inside its opening.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `panel` records `IAutoMovieOpeningSweep`'s panel id inside its opening. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `panel` supplies `IAutoMovieOpeningSweep`'s panel id inside its opening when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  panel: string;
  /**
   * The visible element the panel drives.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `element` records `IAutoMovieOpeningSweep`'s visible element the panel drives. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `element` supplies `IAutoMovieOpeningSweep`'s visible element the panel drives when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  element: string;
  /**
   * World minimum corner of the swept volume.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `min` records `IAutoMovieOpeningSweep`'s world minimum corner of the swept volume. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `min` supplies `IAutoMovieOpeningSweep`'s world minimum corner of the swept volume when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  min: IAutoMovieVector3;
  /**
   * World maximum corner of the swept volume.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `max` records `IAutoMovieOpeningSweep`'s world maximum corner of the swept volume. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `max` supplies `IAutoMovieOpeningSweep`'s world maximum corner of the swept volume when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  max: IAutoMovieVector3;
}

/**
 * One oriented station of a connector's route.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieConnectorStation` represents one oriented station of a connector's route. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieConnectorStation` structures one oriented station of a connector's route for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieConnectorStation {
  /**
   * World position of the station.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `position` records `IAutoMovieConnectorStation`'s world position of the station. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `position` supplies `IAutoMovieConnectorStation`'s world position of the station when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  position: IAutoMovieVector3;
  /**
   * Authored facing, or null when the connector declared none.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `rotation` records `IAutoMovieConnectorStation`'s authored facing, or null when the connector declared none. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `rotation` supplies `IAutoMovieConnectorStation`'s authored facing, or null when the connector declared none when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  rotation: IAutoMovieQuaternion | null;
  /**
   * Arc-length fraction of the station along the route, in `[0, 1]`.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `at` records `IAutoMovieConnectorStation`'s arc-length fraction of the station along the route, in `[0, 1]`. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `at` supplies `IAutoMovieConnectorStation`'s arc-length fraction of the station along the route, in `[0, 1]` when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  at: number;
}

/**
 * The measured traversal shape of one connector.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieConnectorGeometry` represents the measured traversal shape of one connector. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieConnectorGeometry` structures the measured traversal shape of one connector for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieConnectorGeometry {
  /**
   * Signed climb from the first station to the last, in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `rise` records `IAutoMovieConnectorGeometry`'s signed climb from the first station to the last, in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `rise` supplies `IAutoMovieConnectorGeometry`'s signed climb from the first station to the last, in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  rise: number;
  /**
   * Horizontal length of the route polyline, in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `run` records `IAutoMovieConnectorGeometry`'s horizontal length of the route polyline, in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `run` supplies `IAutoMovieConnectorGeometry`'s horizontal length of the route polyline, in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  run: number;
  /**
   * Total 3D length of the route polyline, in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `length` records `IAutoMovieConnectorGeometry`'s total 3D length of the route polyline, in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `length` supplies `IAutoMovieConnectorGeometry`'s total 3D length of the route polyline, in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  length: number;
  /**
   * Slope of the run from horizontal, in radians within `[0, PI / 2]`.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `slope` records `IAutoMovieConnectorGeometry`'s slope of the run from horizontal, in radians within `[0, PI / 2]`. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `slope` supplies `IAutoMovieConnectorGeometry`'s slope of the run from horizontal, in radians within `[0, PI / 2]` when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  slope: number;
  /**
   * The route's own stations, in authored order.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `stations` records `IAutoMovieConnectorGeometry`'s route's own stations, in authored order. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `stations` supplies `IAutoMovieConnectorGeometry`'s route's own stations, in authored order when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  stations: IAutoMovieConnectorStation[];
  /**
   * The further spaces the run stops at, placed on its own route.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `landings` records `IAutoMovieConnectorGeometry`'s further spaces the run stops at, placed on its own route. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `landings` supplies `IAutoMovieConnectorGeometry`'s further spaces the run stops at, placed on its own route when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  landings: IAutoMovieConnectorLandingAt[];
}

/**
 * One further space a run stops at, placed on the route that reaches it.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieConnectorLandingAt` represents one further space a run stops at, placed on the route that reaches it. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieConnectorLandingAt` structures one further space a run stops at, placed on the route that reaches it for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieConnectorLandingAt {
  /**
   * Logical space served at this stop.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `space` records `IAutoMovieConnectorLandingAt`'s logical space served at this stop. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `space` supplies `IAutoMovieConnectorLandingAt`'s logical space served at this stop when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  space: string;
  /**
   * Arc-length fraction of the route, as authored.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `at` records `IAutoMovieConnectorLandingAt`'s arc-length fraction of the route, as authored. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `at` supplies `IAutoMovieConnectorLandingAt`'s arc-length fraction of the route, as authored when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  at: number;
  /**
   * World position of that point of the route.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `position` records `IAutoMovieConnectorLandingAt`'s world position of that point of the route. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `position` supplies `IAutoMovieConnectorLandingAt`'s world position of that point of the route when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  position: IAutoMovieVector3;
}

/**
 * Where one carriage of a run stands, in world space, at one state.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieConnectorCarriagePlacement` defines where one carriage of a run stands, in world space, at one state. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieConnectorCarriagePlacement` structures where one carriage of a run stands, in world space, at one state for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieConnectorCarriagePlacement {
  /**
   * Carriage id inside its connector.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `carriage` records `IAutoMovieConnectorCarriagePlacement`'s carriage id inside its connector. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `carriage` supplies `IAutoMovieConnectorCarriagePlacement`'s carriage id inside its connector when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  carriage: string;
  /**
   * The visible element the carriage drives.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `element` records `IAutoMovieConnectorCarriagePlacement`'s visible element the carriage drives. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `element` supplies `IAutoMovieConnectorCarriagePlacement`'s visible element the carriage drives when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  element: string;
  /**
   * The staged node id {@link lowerBuiltEnvironment} emits for that element.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `node` records `IAutoMovieConnectorCarriagePlacement`'s staged node id `lowerBuiltEnvironment` emits for that element. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `node` supplies `IAutoMovieConnectorCarriagePlacement`'s staged node id `lowerBuiltEnvironment` emits for that element when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  node: string;
  /**
   * World translation of the carriage's element.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `position` records `IAutoMovieConnectorCarriagePlacement`'s world translation of the carriage's element. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `position` supplies `IAutoMovieConnectorCarriagePlacement`'s world translation of the carriage's element when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  position: IAutoMovieVector3;
  /**
   * World rotation of the carriage's element, as a unit quaternion.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `rotation` records `IAutoMovieConnectorCarriagePlacement`'s world rotation of the carriage's element, as a unit quaternion. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `rotation` supplies `IAutoMovieConnectorCarriagePlacement`'s world rotation of the carriage's element, as a unit quaternion when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  rotation: IAutoMovieQuaternion;
  /**
   * World per-axis scale of the carriage's element.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `scale` records `IAutoMovieConnectorCarriagePlacement`'s world per-axis scale of the carriage's element. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `scale` supplies `IAutoMovieConnectorCarriagePlacement`'s world per-axis scale of the carriage's element when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  scale: IAutoMovieVector3;
  /**
   * Logical space this carriage stands at in that state, or null.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `serves` records `IAutoMovieConnectorCarriagePlacement`'s logical space this carriage stands at in that state, or null. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `serves` supplies `IAutoMovieConnectorCarriagePlacement`'s logical space this carriage stands at in that state, or null when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  serves: string | null;
}

/**
 * The usable section of a connector at one point of its route.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `IAutoMovieConnectorSectionAt` represents the usable section of a connector at one point of its route. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `IAutoMovieConnectorSectionAt` structures the usable section of a connector at one point of its route for the system that resolves ownership, topology, and geometry inside one building-interior boundary.
 */
export interface IAutoMovieConnectorSectionAt {
  /**
   * Usable width in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `width` records `IAutoMovieConnectorSectionAt`'s usable width in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `width` supplies `IAutoMovieConnectorSectionAt`'s usable width in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
  width: number;
  /**
   * Vertical clearance in metres.
   *
   * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `clearHeight` records `IAutoMovieConnectorSectionAt`'s vertical clearance in metres. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
   * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `clearHeight` supplies `IAutoMovieConnectorSectionAt`'s vertical clearance in metres when the engine resolves ownership, topology, and geometry inside one building-interior boundary.
   */
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtBoundaryWallCut` turns one boundary's declared face into the wall panel a mesh kernel can cut. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtBoundaryWallCut` converts a declared boundary face into the wall-panel cut consumed by the mesh layer.
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout `builtBoundaryWallCut` lowers the host-local opening profile, hull or arc into the exact wall-panel cut while preserving the validated host containment and cut layout.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-cut-input-output `builtBoundaryWallCut` converts the declared host face and aperture geometry into the deterministic opening-cut input consumed by the mesh layer.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtOpeningPanelPlacements` returns where an opening's panels stand, in world space, at one named state. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtOpeningPanelPlacements` resolves every opening panel to its world-space placement at the requested state.
 * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-components `builtOpeningPanelPlacements` materializes the declared movable fill panels at their named-state world placements without claiming unmodeled frame or hardware components.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation `builtOpeningPanelPlacements` resolves the movable panel subset of the host opening's declared operation state.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtOpeningSweepEnvelope` produces the world volume each panel of an opening sweeps across its whole travel. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtOpeningSweepEnvelope` derives the world-space volume swept by each panel across the opening's full travel.
 * @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state `builtOpeningSweepEnvelope` evaluates every declared panel across the opening's named travel states and returns its complete world-space sweep volume.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-host-opening-operation `builtOpeningSweepEnvelope` turns the host opening's declared panel operation into a measurable travel envelope.
 * @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state `builtOpeningSweepEnvelope` computes each exterior opening panel's named-state travel as a world-space sweep rather than treating operability as metadata.
 * @evidence specifications/building-envelope/facade-roof-and-openings.md#building-envelope-opening-operable-sweep-invariant `builtOpeningSweepEnvelope` measures the validated panel travel and sweep invariant for an operable facade opening.
 * @evidence requirements/interior/clearance-anthropometrics-and-accessibility.md#interior-static-dynamic-clearance `builtOpeningSweepEnvelope` returns the world-space volume occupied across each panel's declared travel for downstream dynamic-clearance checks.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-anthropometric-accessibility-clearance The sweep implements the moving-opening envelope subset without claiming route, reach, jurisdiction, or accessibility compliance.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtConnectorGeometry` measures one connector's traversal shape: climb, run, length, slope, stations. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtConnectorGeometry` measures a connector route's climb, run, length, slope, and stations inside its building boundary.
 * @evidence requirements/interior/connections-and-circulation.md#interior-horizontal-vertical-routes `builtConnectorGeometry` resolves the connector endpoint path into one three-dimensional route with climb, horizontal run, length, slope, and ordered stations.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology `builtConnectorGeometry` computes the geometric route that connects the declared spaces through horizontal and vertical travel.
 * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation `builtConnectorGeometry` derives the exterior connector's endpoint route, landings, rise, horizontal run, length, slope, width, and headroom as its measurable circulation contribution.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-exterior-circulation-input-output `builtConnectorGeometry` produces the validated route geometry and section facts for an exterior circulation connector without claiming guard, port, or code compliance.
 * @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection `builtConnectorGeometry` preserves a connector whose resolved endpoint spaces belong to different building roots and refuses unresolved, self-linked, or malformed route state.
 * @evidence specifications/building-envelope/exterior-spaces-circulation-and-optics.md#building-envelope-multibuilding-connector-failures `builtConnectorGeometry` materializes the declared cross-building route after endpoint, route, section, and operation validation without claiming transform-revision authority.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtConnectorCarriagePlacements` returns where a run's carriages stand, in world space, at one named state. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtConnectorCarriagePlacements` resolves every connector carriage to its world-space placement at the requested state.
 * @evidence requirements/interior/connections-and-circulation.md#interior-access-state `builtConnectorCarriagePlacements` resolves each declared carriage through the connector's named access state and drive onto its served world-space route position.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology `builtConnectorCarriagePlacements` materializes the connector's named operational access state on its declared route topology.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtConnectorSectionAt` produces the usable section of a connector at one arc-length fraction of its route. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtConnectorSectionAt` samples the usable connector section at one arc-length fraction of its route.
 * @evidence requirements/interior/connections-and-circulation.md#interior-circulation-transitions `builtConnectorSectionAt` samples the route's rise, run, slope, station and landing transition together with its usable width and headroom at the requested arc-length fraction.
 * @evidence specifications/interior-space/boundaries-openings-and-circulation.md#interior-space-connector-route-topology `builtConnectorSectionAt` exposes the measurable section and landing state along the connector transition.
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
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtConnectorSection` produces the usable section of one connector record, or null when it states none. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtConnectorSection` returns the usable section declared by a connector, or `null` when it has none.
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

/**
 * Every logical space under one space, including that space itself.
 *
 * The containment fold every other query here performs, exposed once rather
 * than copied. A caller asking what a storey holds, what a building unit owns,
 * or which rooms a derived review population must charge for was otherwise
 * rewriting this walk, and two walks over one hierarchy are two answers that
 * eventually disagree.
 *
 * Sorted, because a population is compared and printed rather than only tested
 * for membership.
 *
 * @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope `builtEnvironmentDescendantSpaces` names every logical space under one space. This ensures authored building-interior state remains explicit and reviewable within its supported host boundary.
 * @evidence specifications/interior-space/scope-and-host.md#interior-space-building-interior-boundary `builtEnvironmentDescendantSpaces` resolves the descendant space population the engine folds ownership, topology, and geometry over inside one building-interior boundary.
 * @author Samchon
 */
export const builtEnvironmentDescendantSpaces = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): string[] => {
  requireSpace(environment, spaceId);
  return [...descendantSpaces(environment.spaces, spaceId)].sort(
    compareAutoMovieRenderIds,
  );
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

/**
 * Check exactly what a building owns about a population it stages.
 *
 * The whole instance-set design is the production compiler's to validate, and
 * it validates it again when the lowered set reaches the world. What is checked
 * here is the subset this record answers for on its own: the slot count and the
 * placement law {@link builtInstanceSetPlacementBounds} has to be total over,
 * because a space query that cannot bound a population it was handed would have
 * to return either a lie or nothing at all.
 */
const validatePopulationPrototypeBounds = (
  bounds: IAutoMovieBuiltPopulation["prototypeBounds"],
  path: string,
  collector: ViolationCollector,
): void => {
  finiteVector(
    bounds.min,
    `${path}.min`,
    "population prototype minimum",
    collector,
  );
  finiteVector(
    bounds.max,
    `${path}.max`,
    "population prototype maximum",
    collector,
  );
  for (const axis of ["x", "y", "z"] as const)
    if (
      Number.isFinite(bounds.min[axis]) &&
      Number.isFinite(bounds.max[axis]) &&
      bounds.min[axis] > bounds.max[axis]
    )
      collector.push(
        "range",
        `${path}.${axis}`,
        `population prototype ${axis} bounds must be ordered, but ${bounds.min[axis]} is above ${bounds.max[axis]}`,
        { min: bounds.min[axis], max: bounds.max[axis] },
      );
};

const validatePopulationSet = (
  set: IAutoMovieInstanceSetDesign,
  path: string,
  collector: ViolationCollector,
): void => {
  positiveInteger(
    set.count,
    `${path}.count`,
    "population slot count",
    collector,
  );
  finiteVector(set.anchor, `${path}.anchor`, "population anchor", collector);
  if (!Number.isFinite(set.facingDeg))
    collector.push(
      "range",
      `${path}.facingDeg`,
      `population heading must be finite, but was ${set.facingDeg}`,
      set.facingDeg,
    );
  positive(
    set.variation.scale.min,
    `${path}.variation.scale.min`,
    "population minimum scale",
    collector,
  );
  positive(
    set.variation.scale.max,
    `${path}.variation.scale.max`,
    "population maximum scale",
    collector,
  );
  if (
    Number.isFinite(set.variation.scale.min) &&
    Number.isFinite(set.variation.scale.max) &&
    set.variation.scale.min > set.variation.scale.max
  )
    collector.push(
      "range",
      `${path}.variation.scale`,
      `population scale range must be ordered, but ${set.variation.scale.min} is above ${set.variation.scale.max}`,
      set.variation.scale,
    );
  if (set.variation.scale3 !== undefined)
    for (const axis of ["x", "y", "z"] as const) {
      const range = {
        min: set.variation.scale3.min[axis],
        max: set.variation.scale3.max[axis],
      };
      positive(
        range.min,
        `${path}.variation.scale3.min.${axis}`,
        `population minimum ${axis} scale`,
        collector,
      );
      positive(
        range.max,
        `${path}.variation.scale3.max.${axis}`,
        `population maximum ${axis} scale`,
        collector,
      );
      if (
        Number.isFinite(range.min) &&
        Number.isFinite(range.max) &&
        range.min > range.max
      )
        collector.push(
          "range",
          `${path}.variation.scale3.${axis}`,
          `population ${axis} scale range must be ordered, but ${range.min} is above ${range.max}`,
          range,
        );
    }
  if (set.variation.rotationDeg !== undefined)
    for (const axis of ["x", "y", "z"] as const) {
      const range = set.variation.rotationDeg[axis];
      if (!Number.isFinite(range.min))
        collector.push(
          "range",
          `${path}.variation.rotationDeg.${axis}.min`,
          `population minimum ${axis} rotation must be finite, but was ${range.min}`,
          range.min,
        );
      if (!Number.isFinite(range.max))
        collector.push(
          "range",
          `${path}.variation.rotationDeg.${axis}.max`,
          `population maximum ${axis} rotation must be finite, but was ${range.max}`,
          range.max,
        );
      if (
        Number.isFinite(range.min) &&
        Number.isFinite(range.max) &&
        range.min > range.max
      )
        collector.push(
          "range",
          `${path}.variation.rotationDeg.${axis}`,
          `population ${axis} rotation range must be ordered, but ${range.min} is above ${range.max}`,
          range,
        );
    }
  const layout = set.layout;
  if (layout.kind === "along-route") {
    collector.push(
      "type",
      `${path}.layout.kind`,
      'a building population may not use the "along-route" layout: a route is a production-world fact this record carries no field for, so such a population belongs to the world rather than to a building space',
      layout.kind,
    );
    return;
  }
  if (layout.kind === "scatter") {
    positive(
      layout.radius,
      `${path}.layout.radius`,
      "population scatter radius",
      collector,
    );
    return;
  }
  if (layout.kind === "explicit") {
    if (layout.transforms.length < set.count)
      collector.push(
        "range",
        `${path}.layout.transforms`,
        `an explicit population needs one transform per slot, but ${layout.transforms.length} were stated for ${set.count} slots`,
        layout.transforms.length,
      );
    layout.transforms.forEach((transform, index) => {
      finiteVector(
        transform.translation,
        `${path}.layout.transforms[${index}].translation`,
        "population slot translation",
        collector,
      );
      unitQuaternion(
        transform.rotation,
        `${path}.layout.transforms[${index}].rotation`,
        "population slot rotation",
        collector,
      );
      for (const axis of ["x", "y", "z"] as const)
        positive(
          transform.scale[axis],
          `${path}.layout.transforms[${index}].scale.${axis}`,
          `population slot ${axis} scale`,
          collector,
        );
    });
    return;
  }
  positiveInteger(
    layout.rows,
    `${path}.layout.rows`,
    "population layout rows",
    collector,
  );
  positiveInteger(
    layout.columns,
    `${path}.layout.columns`,
    "population layout columns",
    collector,
  );
  positive(
    layout.spacing.x,
    `${path}.layout.spacing.x`,
    "population layout x spacing",
    collector,
  );
  positive(
    layout.spacing.z,
    `${path}.layout.spacing.z`,
    "population layout z spacing",
    collector,
  );
  if (layout.kind === "lattice") {
    positiveInteger(
      layout.layers,
      `${path}.layout.layers`,
      "population layout layers",
      collector,
    );
    positive(
      layout.spacing.y,
      `${path}.layout.spacing.y`,
      "population layout y spacing",
      collector,
    );
  }
  const capacity =
    layout.kind === "lattice"
      ? layout.rows * layout.columns * layout.layers
      : layout.rows * layout.columns;
  if (Number.isSafeInteger(capacity) && capacity < set.count)
    collector.push(
      "range",
      `${path}.layout`,
      `a ${layout.kind} population's own lattice holds ${capacity} slots, which cannot carry its ${set.count}`,
      capacity,
    );
};

const positiveInteger = (
  value: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (!Number.isSafeInteger(value) || value <= 0)
    collector.push(
      "range",
      path,
      `${label} must be an integer > 0, but was ${value}`,
      value,
    );
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
    (space) => included.has(space.id) && builtSpaceStatesVolume(space),
  );
};

/**
 * A closed boundary, held to exactly what makes its inside a fact.
 *
 * Three things are checked and nothing is repaired. Every index must name a
 * vertex the shell carries, and every face must have area, because a face
 * nobody can look up or that is a line contributes a solid angle of nothing to
 * a query that would then answer confidently. The surface must be **closed**:
 * each directed edge appears exactly once and its own reverse exactly once, so
 * a missing facet is a hole through which inside leaks into outside, and a
 * duplicated one is a facet counted twice. And the enclosed volume must be
 * positive, which is how "wound counter-clockwise seen from outside" is
 * actually checked: a shell turned inside out passes every local test and
 * answers the exact opposite of the truth for every point in the building.
 */
const validateSpaceShell = (
  shell: IAutoMovieSpaceShell,
  path: string,
  collector: ViolationCollector,
): void => {
  shell.vertices.forEach((vertex, index) => {
    finiteVector(
      vertex,
      `${path}.vertices[${index}]`,
      "shell vertex",
      collector,
    );
  });
  if (shell.vertices.length < 4)
    collector.push(
      "range",
      `${path}.vertices`,
      `a closed shell needs at least 4 vertices, but had ${shell.vertices.length}`,
      shell.vertices.length,
    );
  if (shell.triangles.length < 12 || shell.triangles.length % 3 !== 0) {
    collector.push(
      "range",
      `${path}.triangles`,
      `a closed shell needs at least 4 triangles as whole index triples, but had ${shell.triangles.length} indices`,
      shell.triangles.length,
    );
    return;
  }
  const bad = shell.triangles.findIndex(
    (index) =>
      Number.isSafeInteger(index) === false ||
      index < 0 ||
      index >= shell.vertices.length,
  );
  if (bad !== -1) {
    collector.push(
      "range",
      `${path}.triangles[${bad}]`,
      `shell triangle index must name one of the ${shell.vertices.length} vertices, but was ${shell.triangles[bad]}`,
      shell.triangles[bad],
    );
    return;
  }
  const edges = new Map<string, number>();
  for (let face = 0; face < shell.triangles.length; face += 3) {
    const corners = [
      shell.triangles[face]!,
      shell.triangles[face + 1]!,
      shell.triangles[face + 2]!,
    ];
    const a = shell.vertices[corners[0]!]!;
    const b = shell.vertices[corners[1]!]!;
    const c = shell.vertices[corners[2]!]!;
    if (
      Vector3.length(
        Vector3.cross(Vector3.subtract(b, a), Vector3.subtract(c, a)),
      ) <= PLANE_NORMAL_EPSILON
    ) {
      collector.push(
        "range",
        `${path}.triangles[${face}]`,
        `shell triangle ${face / 3} encloses no area, so it bounds nothing`,
        corners,
      );
      return;
    }
    for (let corner = 0; corner < 3; ++corner) {
      const key = `${corners[corner]}>${corners[(corner + 1) % 3]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const open = [...edges.entries()].find(
    ([key, count]) =>
      count !== 1 || edges.get(key.split(">").reverse().join(">")) !== 1,
  );
  if (open !== undefined) {
    collector.push(
      "type",
      `${path}.triangles`,
      `shell is not closed: directed edge ${open[0]} is not matched by exactly one facet and one opposite facet`,
      open[0],
    );
    return;
  }
  const volume = builtSpaceShellVolume(shell);
  if (volume <= 0)
    collector.push(
      "range",
      `${path}.triangles`,
      "shell encloses no positive volume: wind its facets counter-clockwise seen from outside the solid",
      volume,
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

/**
 * The axis-aligned box containing every given point.
 *
 * Folded rather than spread through `Math.min`, because the callers are no
 * longer only the four corners of a leaf: measuring a space's contents hands
 * this every vertex the space draws, and a spread of that many arguments is a
 * stack overflow rather than a slow answer.
 */
const boundsOf = (
  points: readonly IAutoMovieVector3[],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => {
  const min: IAutoMovieVector3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: IAutoMovieVector3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const point of points) {
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
  }
  return { min, max };
};
