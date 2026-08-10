import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieClearanceBox,
  IAutoMovieModel,
  IAutoMoviePropSpec,
  IAutoMovieStageSetPiece,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { tessellate } from "../geometry/tessellate";
import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { ViolationCollector } from "../validation/violation";
import { forgeProp } from "./forgeProp";

interface IIndexed<Value> {
  value: Value;
  index: number;
}

interface IResolvedProp extends IIndexed<IAutoMoviePropSpec> {
  forged: boolean;
  piece: IIndexed<IAutoMovieStageSetPiece> | undefined;
  unique: boolean;
}

/**
 * Validate a source-owned prop registry, its unique staged join, building
 * relations, support graph, and transformed clearance proxies.
 *
 * Registry construction is deliberately a separate first pass. A lamp may cite
 * a table declared later without changing the result, while duplicate prop,
 * set-piece, or building-environment identities stay explicit rather than being
 * hidden by `Map`'s last-write-wins behavior. Props that omit `placement`
 * retain the original forge-and-stage contract.
 */
export const validatePropPlacements = (props: {
  props: readonly IAutoMoviePropSpec[];
  set: readonly IAutoMovieStageSetPiece[];
  builtEnvironments: readonly IAutoMovieBuiltEnvironment[];
}): IAutoMovieValidation => {
  const out = new ViolationCollector();
  const byNode = indexBy(props.props, (prop) => prop.node);
  const setByNode = indexBy(props.set, (piece) => piece.node);
  const environments = indexBy(
    props.builtEnvironments,
    (environment) => environment.id,
  );

  reportDuplicates(byNode, "$input.props", "node", "prop node", out);
  reportDuplicates(setByNode, "$input.set", "node", "staged set node", out);
  reportDuplicates(
    environments,
    "$input.builtEnvironments",
    "id",
    "built environment id",
    out,
  );

  const resolved: IResolvedProp[] = props.props.map((prop, index) => {
    const path = `$input.props[${index}]`;
    const forged = forgeProp(prop);
    if (forged.success === false)
      for (const violation of forged.violations)
        out.items.push({
          ...violation,
          path: violation.path.replace("$input", path),
        });
    const pieces = setByNode.get(prop.node) ?? [];
    if (pieces.length === 0)
      out.push(
        "type",
        `${path}.node`,
        `prop "${prop.node}" needs one staged set placement`,
        prop.node,
      );
    else if (pieces.length === 1 && pieces[0]!.value.model !== prop.model.id)
      out.push(
        "type",
        `$input.set[${pieces[0]!.index}].model`,
        `staged prop "${prop.node}" uses model "${pieces[0]!.value.model}" instead of "${prop.model.id}"`,
        pieces[0]!.value.model,
      );
    return {
      value: prop,
      index,
      forged: forged.success,
      piece: pieces.length === 1 ? pieces[0] : undefined,
      unique: (byNode.get(prop.node)?.length ?? 0) === 1,
    };
  });

  for (const entry of resolved)
    if (entry.value.placement !== undefined)
      validatePlacement(entry, environments, byNode, out);
  validateSupportCycles(byNode, out);

  for (const entry of resolved) {
    const placement = entry.value.placement;
    if (
      placement === undefined ||
      entry.piece === undefined ||
      !entry.forged ||
      !entry.unique
    )
      continue;
    const matrix = pieceMatrix(entry.piece.value);
    placement.clearance.forEach((clearance, clearanceIndex) => {
      if (!validClearance(clearance)) return;
      const keepOut = transformedBox(clearance, matrix);
      resolved.forEach((candidate) => {
        if (
          candidate.value.node === entry.value.node ||
          candidate.piece === undefined ||
          !candidate.forged ||
          !candidate.unique
        )
          return;
        const occupied = transformedModelBounds(
          candidate.value.model,
          pieceMatrix(candidate.piece.value),
        );
        if (overlap(keepOut, occupied))
          out.push(
            "range",
            `$input.props[${entry.index}].placement.clearance[${clearanceIndex}]`,
            `clearance "${clearance.id}" intersects staged prop "${candidate.value.node}"`,
            candidate.value.node,
          );
      });
    });
  }
  return out.toValidation();
};

const validatePlacement = (
  entry: IIndexed<IAutoMoviePropSpec>,
  environments: ReadonlyMap<
    string,
    readonly IIndexed<IAutoMovieBuiltEnvironment>[]
  >,
  props: ReadonlyMap<string, readonly IIndexed<IAutoMoviePropSpec>[]>,
  out: ViolationCollector,
): void => {
  const prop = entry.value;
  const path = `$input.props[${entry.index}]`;
  const placement = prop.placement!;
  let located:
    | {
        environment: IAutoMovieBuiltEnvironment;
      }
    | undefined;
  if (placement.space !== null) {
    const environment = resolveUnique(
      environments,
      placement.space.environment,
      `${path}.placement.space.environment`,
      "built environment",
      out,
    );
    if (
      environment !== undefined &&
      !environment.spaces.some((space) => space.id === placement.space!.space)
    )
      out.push(
        "type",
        `${path}.placement.space.space`,
        `logical space "${placement.space.space}" does not resolve`,
        placement.space.space,
      );
    else if (environment !== undefined) located = { environment };
  }
  if (placement.host !== null) {
    const environment = resolveUnique(
      environments,
      placement.host.environment,
      `${path}.placement.host.environment`,
      "built environment",
      out,
    );
    const host = environment?.elements.find(
      (element) => element.id === placement.host!.element,
    );
    if (environment !== undefined && host === undefined)
      out.push(
        "type",
        `${path}.placement.host.element`,
        `building element "${placement.host.element}" does not resolve`,
        placement.host.element,
      );
    if (located !== undefined && environment !== undefined) {
      if (environment.id !== located.environment.id)
        out.push(
          "type",
          `${path}.placement.host.environment`,
          `host environment "${environment.id}" differs from occupied space environment "${located.environment.id}"`,
          environment.id,
        );
    }
  }
  if (placement.support?.kind === "surface") {
    const support = placement.support;
    const environment = resolveUnique(
      environments,
      support.environment,
      `${path}.placement.support.environment`,
      "built environment",
      out,
    );
    const surface = environment?.surfaces.find(
      (candidate) => candidate.surface.id === support.surface,
    );
    if (environment !== undefined && surface === undefined)
      out.push(
        "type",
        `${path}.placement.support.surface`,
        `support surface "${placement.support.surface}" does not resolve`,
        placement.support.surface,
      );
    if (located !== undefined && environment !== undefined) {
      if (environment.id !== located.environment.id)
        out.push(
          "type",
          `${path}.placement.support.environment`,
          `support environment "${environment.id}" differs from occupied space environment "${located.environment.id}"`,
          environment.id,
        );
    }
  } else if (placement.support?.kind === "prop-affordance") {
    const support = placement.support;
    const matches = props.get(support.prop) ?? [];
    if (support.prop === prop.node)
      out.push(
        "type",
        `${path}.placement.support.prop`,
        "a prop cannot support itself",
        placement.support.prop,
      );
    else if (matches.length === 0)
      out.push(
        "type",
        `${path}.placement.support.prop`,
        `supporting prop "${placement.support.prop}" does not resolve`,
        placement.support.prop,
      );
    else if (matches.length > 1)
      out.push(
        "type",
        `${path}.placement.support.prop`,
        `supporting prop "${placement.support.prop}" is ambiguous`,
        placement.support.prop,
      );
    else if (
      !matches[0]!.value.model.affordances?.some(
        (affordance) => affordance.id === support.affordance,
      )
    )
      out.push(
        "type",
        `${path}.placement.support.affordance`,
        `support affordance "${placement.support.affordance}" does not resolve`,
        placement.support.affordance,
      );
    else {
      const supportingSpace = matches[0]!.value.placement?.space;
      if (
        located !== undefined &&
        supportingSpace !== undefined &&
        supportingSpace !== null &&
        supportingSpace.environment !== located.environment.id
      )
        out.push(
          "type",
          `${path}.placement.support.prop`,
          `supporting prop "${support.prop}" occupies environment "${supportingSpace.environment}" instead of "${located.environment.id}"`,
          support.prop,
        );
    }
  }
  const ids = new Set<string>();
  placement.clearance.forEach((clearance, index) => {
    const clearancePath = `${path}.placement.clearance[${index}]`;
    if (clearance.id.trim().length === 0)
      out.push(
        "type",
        `${clearancePath}.id`,
        "clearance id must be non-empty",
        clearance.id,
      );
    if (ids.has(clearance.id))
      out.push(
        "type",
        `${clearancePath}.id`,
        `clearance id "${clearance.id}" is duplicated`,
        clearance.id,
      );
    ids.add(clearance.id);
    for (const axis of ["x", "y", "z"] as const)
      if (
        !Number.isFinite(clearance.min[axis]) ||
        !Number.isFinite(clearance.max[axis]) ||
        clearance.min[axis] >= clearance.max[axis]
      )
        out.push(
          "range",
          `${clearancePath}.${axis}`,
          `clearance ${axis} bounds must be finite and min < max`,
          { min: clearance.min[axis], max: clearance.max[axis] },
        );
  });
};

const validateSupportCycles = (
  props: ReadonlyMap<string, readonly IIndexed<IAutoMoviePropSpec>[]>,
  out: ViolationCollector,
): void => {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (entry: IIndexed<IAutoMoviePropSpec>): void => {
    if (visited.has(entry.value.node)) return;
    visiting.add(entry.value.node);
    const support = entry.value.placement?.support;
    if (
      support?.kind === "prop-affordance" &&
      support.prop !== entry.value.node
    ) {
      const matches = props.get(support.prop) ?? [];
      if (matches.length === 1) {
        if (visiting.has(support.prop))
          out.push(
            "type",
            `$input.props[${entry.index}].placement.support.prop`,
            `prop support relation forms a cycle through "${support.prop}"`,
            support.prop,
          );
        else visit(matches[0]!);
      }
    }
    visiting.delete(entry.value.node);
    visited.add(entry.value.node);
  };
  for (const matches of props.values())
    if (matches.length === 1) visit(matches[0]!);
};

const indexBy = <Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): Map<string, IIndexed<Value>[]> => {
  const indexed = new Map<string, IIndexed<Value>[]>();
  values.forEach((value, index) => {
    const id = key(value);
    const matches = indexed.get(id);
    if (matches === undefined) indexed.set(id, [{ value, index }]);
    else matches.push({ value, index });
  });
  return indexed;
};

const reportDuplicates = <Value>(
  indexed: ReadonlyMap<string, readonly IIndexed<Value>[]>,
  path: string,
  field: string,
  label: string,
  out: ViolationCollector,
): void => {
  for (const [id, matches] of indexed)
    for (const match of matches.slice(1))
      out.push(
        "type",
        `${path}[${match.index}].${field}`,
        `${label} "${id}" is duplicated`,
        id,
      );
};

const resolveUnique = <Value>(
  indexed: ReadonlyMap<string, readonly IIndexed<Value>[]>,
  id: string,
  path: string,
  label: string,
  out: ViolationCollector,
): Value | undefined => {
  const matches = indexed.get(id) ?? [];
  if (matches.length === 1) return matches[0]!.value;
  out.push(
    "type",
    path,
    matches.length === 0
      ? `${label} "${id}" does not resolve`
      : `${label} "${id}" is ambiguous`,
    id,
  );
  return undefined;
};

interface IBounds {
  min: IAutoMovieVector3;
  max: IAutoMovieVector3;
}

const pieceMatrix = (piece: IAutoMovieStageSetPiece): number[] => {
  const scale =
    piece.scale === undefined
      ? { x: 1, y: 1, z: 1 }
      : typeof piece.scale === "number"
        ? { x: piece.scale, y: piece.scale, z: piece.scale }
        : piece.scale;
  return Matrix4.compose(
    piece.position,
    piece.rotation ??
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, piece.facingDeg ?? 0),
    scale,
  );
};

const transformedModelBounds = (
  model: IAutoMovieModel,
  world: number[],
): IBounds => {
  const points: IAutoMovieVector3[] = [];
  for (const part of model.parts) {
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
    for (let index = 0; index < positions.length; index += 3)
      points.push(
        transformPoint(
          {
            x: positions[index]!,
            y: positions[index + 1]!,
            z: positions[index + 2]!,
          },
          matrix,
        ),
      );
  }
  return boundsOf(points);
};

const transformedBox = (
  box: IAutoMovieClearanceBox,
  matrix: number[],
): IBounds =>
  boundsOf(
    [box.min.x, box.max.x].flatMap((x) =>
      [box.min.y, box.max.y].flatMap((y) =>
        [box.min.z, box.max.z].map((z) => transformPoint({ x, y, z }, matrix)),
      ),
    ),
  );

const validClearance = (clearance: IAutoMovieClearanceBox): boolean =>
  (["x", "y", "z"] as const).every(
    (axis) =>
      Number.isFinite(clearance.min[axis]) &&
      Number.isFinite(clearance.max[axis]) &&
      clearance.min[axis] < clearance.max[axis],
  );

const transformPoint = (
  point: IAutoMovieVector3,
  matrix: number[],
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

const boundsOf = (points: readonly IAutoMovieVector3[]): IBounds => {
  const first = points[0]!;
  const bounds: IBounds = {
    min: { ...first },
    max: { ...first },
  };
  for (const point of points.slice(1)) {
    bounds.min.x = Math.min(bounds.min.x, point.x);
    bounds.min.y = Math.min(bounds.min.y, point.y);
    bounds.min.z = Math.min(bounds.min.z, point.z);
    bounds.max.x = Math.max(bounds.max.x, point.x);
    bounds.max.y = Math.max(bounds.max.y, point.y);
    bounds.max.z = Math.max(bounds.max.z, point.z);
  }
  return bounds;
};

const overlap = (left: IBounds, right: IBounds): boolean =>
  left.min.x < right.max.x &&
  left.max.x > right.min.x &&
  left.min.y < right.max.y &&
  left.max.y > right.min.y &&
  left.min.z < right.max.z &&
  left.max.z > right.min.z;
