import {
  IAutoMovieBuiltConnector,
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieSpace,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { IAutoMovieSubjectContribution } from "../subject";
import { validateModel } from "../validation/validateModel";
import { validateSpace } from "../validation/validateSpace";
import { validateTransformScalars } from "../validation/validateTransformScalars";
import { ViolationCollector } from "../validation/violation";

const CONNECTOR_KINDS = [
  "passage",
  "stair",
  "ramp",
  "lift",
  "ladder",
  "bridge",
  "other",
] as const;
const PLANE_NORMAL_EPSILON = 1e-12;
const MATRIX_ROUND_TRIP_EPSILON = 1e-8;
const CONTAINMENT_EPSILON = 1e-9;

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
  });

  collectIds(environment.openings, `${root}.openings`, "opening", collector);
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
    positive(connector.width, `${path}.width`, "connector width", collector);
    positive(
      connector.clearHeight,
      `${path}.clearHeight`,
      "connector clear height",
      collector,
    );
    validateReferences(
      connector.elements,
      elementIds,
      `${path}.elements`,
      "building element",
      collector,
    );
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
    const matrices = worldMatricesOf(environment);
    environment.elements.forEach((element, index) => {
      const world = matrices.get(element.id)!;
      const decomposed = Matrix4.decompose(world);
      const recomposed = Matrix4.compose(
        decomposed.position,
        Quaternion.normalize(decomposed.rotation),
        decomposed.scale,
      );
      const magnitude = Math.max(1, ...world.map((value) => Math.abs(value)));
      const difference = Math.max(
        ...world.map((value, matrixIndex) =>
          Math.abs(value - recomposed[matrixIndex]!),
        ),
      );
      if (difference > magnitude * MATRIX_ROUND_TRIP_EPSILON)
        collector.push(
          "type",
          `${root}.elements[${index}].transform`,
          "the composed hierarchy contains shear, which cannot be lowered to the scene's world TRS; keep rotated descendants below uniformly scaled ancestors",
          element.transform,
        );
    });
  }

  return collector.toValidation();
};

/**
 * Lower one building record to ordinary subject contributions.
 *
 * Visible element transforms are composed parent-to-child and flattened into
 * world-space set pieces because staged scene nodes are world TRS. The original
 * hierarchy remains in `builtEnvironments` for spatial queries and evidence.
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

  const matrices = worldMatricesOf(environment);
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

/** Return spaces directly joined by a boundary or traversal connector. */
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
    if (connector.from === spaceId) adjacent.add(connector.to);
    if (connector.to === spaceId && connector.bidirectional)
      adjacent.add(connector.from);
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
 * Endpoints are matched exactly, not through containment: a connector declares
 * the two spaces it actually lands in, so asking a building root returns the
 * connectors declared on the root itself rather than every connector inside it.
 * That is the same rule {@link builtEnvironmentAdjacentSpaces} follows.
 */
export const builtEnvironmentSpaceConnectors = (
  environment: IAutoMovieBuiltEnvironment,
  spaceId: string,
): IAutoMovieBuiltConnector[] => {
  requireSpace(environment, spaceId);
  return environment.connectors.filter(
    (connector) => connector.from === spaceId || connector.to === spaceId,
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

const worldMatricesOf = (
  environment: IAutoMovieBuiltEnvironment,
): Map<string, number[]> => {
  const byId = new Map(
    environment.elements.map((element) => [element.id, element]),
  );
  const matrices = new Map<string, number[]>();
  const read = (id: string): number[] => {
    const cached = matrices.get(id);
    if (cached !== undefined) return cached;
    const element = byId.get(id)!;
    const local = Matrix4.compose(
      element.transform.translation,
      element.transform.rotation,
      element.transform.scale,
    );
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
  value: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (!Number.isFinite(value) || value <= 0)
    collector.push(
      "range",
      path,
      `${label} must be a finite number > 0, but was ${value}`,
      value,
    );
};
