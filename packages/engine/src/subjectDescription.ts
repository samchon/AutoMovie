import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieCompiledInstanceSet,
  IAutoMovieModel,
  IAutoMovieModelPart,
  IAutoMovieQuaternion,
  IAutoMovieSubjectArtifact,
  IAutoMovieSubjectBox,
  IAutoMovieSubjectDescription,
  IAutoMovieSubjectMaterial,
  IAutoMovieSubjectMemberSummary,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { builtEnvironmentSpaceContentBounds } from "./architecture";
import { tessellate } from "./geometry";
import { resolvePose } from "./kinematics";
import { Matrix4, Quaternion, seededValue } from "./math";
import { compareAutoMovieRenderIds } from "./render";

/**
 * Maximum stable subject ids included in one membership summary.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Bounds inspection output even when one prototype or set has thousands of uses.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Fixes the deterministic sample limit used beside exact member totals.
 */
export const AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT = 64;

/**
 * Enumerate directly stored compiled subjects without expanding placed parts or
 * compact instance members.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Lets a reviewer discover stable compiled subject identities without rendering.
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Measures the inventory from the compiled artifact consumed by render and oracle services.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Enumerates prototypes, prototype parts, elements, instance sets, and spaces in deterministic order.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-bounds Derives geometry and space boxes from compiled content and declarations.
 */
export const describeAutoMovieSubjects = (
  artifact: IAutoMovieSubjectArtifact,
): IAutoMovieSubjectDescription[] => {
  const context = createDescriptionContext(artifact);
  const descriptions: IAutoMovieSubjectDescription[] = [];
  for (const model of context.models.values()) {
    descriptions.push(describePrototype(context, model));
    for (const part of model.parts)
      descriptions.push(describePrototypePart(context, model, part));
  }
  for (const node of artifact.compiled.scene.nodes)
    descriptions.push(describeElement(context, node.id));
  for (const set of artifact.compiled.instanceSets)
    descriptions.push(describeInstanceSet(context, set));
  for (const environment of artifact.compiled.builtEnvironments ?? []) {
    // A transform-only group stages no node, so the scene walk above never
    // reaches one. Leaving it out made the inventory of a building smaller than
    // the building: one authored example carries 30 elements and stages 22, and
    // the 8 it does not stage include both of its unit roots. They are elements
    // the record owns, so a census that omits them is a census of the scene
    // rather than of the work.
    for (const element of environment.elements)
      if (element.model === null)
        descriptions.push(describeElementGroup(context, environment, element));
    for (const space of environment.spaces)
      descriptions.push(describeSpace(context, environment, space));
  }
  return descriptions.sort((left, right) =>
    compareAutoMovieRenderIds(left.id, right.id),
  );
};

/**
 * Describe one stable subject address from a compiled shot artifact.
 *
 * Individual compact instances and placed parts are regenerated only when
 * addressed, so direct inspection remains exact without expanding the normal
 * subject inventory.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Answers what one element, part, prototype, instance, set, or space is from stable identity and revision.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-description-record Resolves both enumerated subjects and deterministic non-enumerated placement ids.
 */
export const describeAutoMovieSubject = (
  artifact: IAutoMovieSubjectArtifact,
  subjectId: string,
  props?: {
    /**
     * Rank of the first member to name, defaulting to the first.
     *
     * A whole number; a fractional or negative rank names no page that exists
     * and is refused rather than rounded, because a caller paging by a value it
     * computed would otherwise be told it had read everything.
     */
    memberOffset?: number;
  },
): IAutoMovieSubjectDescription => {
  const memberOffset = props?.memberOffset ?? 0;
  if (Number.isSafeInteger(memberOffset) === false || memberOffset < 0)
    throw new Error(
      `Subject member offset must be a whole number of members from the first, but was ${memberOffset}.`,
    );
  const context = createDescriptionContext(artifact, memberOffset);
  const model = [...context.models.values()].find(
    (candidate) => prototypeId(candidate.id) === subjectId,
  );
  if (model !== undefined) return describePrototype(context, model);
  for (const candidate of context.models.values()) {
    const part = candidate.parts.find(
      (item) => prototypePartId(candidate.id, item.id) === subjectId,
    );
    if (part !== undefined)
      return describePrototypePart(context, candidate, part);
  }
  const node = artifact.compiled.scene.nodes.find(
    (candidate) => elementId(candidate.id) === subjectId,
  );
  if (node !== undefined) return describeElement(context, node.id);
  for (const environment of artifact.compiled.builtEnvironments ?? []) {
    const group = environment.elements.find(
      (candidate) =>
        candidate.model === null &&
        elementId(`${environment.id}/${candidate.id}`) === subjectId,
    );
    if (group !== undefined)
      return describeElementGroup(context, environment, group);
  }
  for (const candidate of artifact.compiled.scene.nodes) {
    const candidateModel = context.models.get(candidate.model);
    const part = candidateModel?.parts.find(
      (item) => elementPartId(candidate.id, item.id) === subjectId,
    );
    if (candidateModel !== undefined && part !== undefined)
      return describeElementPart(context, candidate, candidateModel, part);
  }
  const set = artifact.compiled.instanceSets.find(
    (candidate) => instanceSetId(candidate.id) === subjectId,
  );
  if (set !== undefined) return describeInstanceSet(context, set);
  for (const candidate of artifact.compiled.instanceSets) {
    const slot = findAddressedInstanceSlot(candidate, subjectId);
    if (slot !== null) return describeInstance(context, candidate, slot);
  }
  for (const environment of artifact.compiled.builtEnvironments ?? []) {
    const space = environment.spaces.find(
      (candidate) => spaceId(environment.id, candidate.id) === subjectId,
    );
    if (space !== undefined) return describeSpace(context, environment, space);
  }
  throw new Error(`Compiled subject "${subjectId}" does not exist.`);
};

interface IDescriptionContext {
  artifact: IAutoMovieSubjectArtifact;
  models: Map<string, IAutoMovieModel>;
  builtElements: Map<
    string,
    {
      environment: IAutoMovieBuiltEnvironment;
      element: IAutoMovieBuiltEnvironment["elements"][number];
    }
  >;
  populationSpaces: Map<string, string>;
  /**
   * Child elements of one built element, by that element's node id.
   *
   * An element's assignment to a logical space is authored, and an exterior wall,
   * a foundation, or a structural frame legitimately belongs to no room, so the
   * space tree is an index over a building rather than a cover of it. The element
   * hierarchy is the cover: `IAutoMovieBuiltEnvironment.buildings` states that
   * ownership is total, every element descending from exactly one unit's roots,
   * so a walk down the parent relation reaches everything the record owns.
   *
   * Every child is listed, whether or not the compiler staged a node for it,
   * because a transform-only group is describable in its own right. Substituting
   * a group's drawn descendants for the group was measured and rejected: on one
   * authored building it would have made a unit's root space list every staged
   * node under it, which is a flat dump of the building rather than a way in.
   */
  elementChildren: Map<string, string[]>;
  /**
   * Rank the membership sample starts at, for every summary this pass builds.
   *
   * On the context rather than threaded through eight describe functions,
   * because it is one property of the request and not of any one subject: a
   * caller asks a subject for its next page, and every summary that answer
   * carries is that same page of its own members.
   */
  memberOffset: number;
}

const createDescriptionContext = (
  artifact: IAutoMovieSubjectArtifact,
  memberOffset: number = 0,
): IDescriptionContext => {
  const models = new Map(
    artifact.compiled.models.map((model) => [model.id, model] as const),
  );
  const builtElements: IDescriptionContext["builtElements"] = new Map();
  const populationSpaces = new Map<string, string>();
  for (const environment of artifact.compiled.builtEnvironments ?? []) {
    for (const model of environment.models) models.set(model.id, model);
    for (const element of environment.elements)
      builtElements.set(`${environment.id}/${element.id}`, {
        environment,
        element,
      });
    for (const population of environment.populations ?? [])
      populationSpaces.set(
        population.set.id,
        spaceId(environment.id, population.space),
      );
  }
  const elementChildren: IDescriptionContext["elementChildren"] = new Map();
  for (const environment of artifact.compiled.builtEnvironments ?? [])
    for (const element of environment.elements) {
      if (element.parent === null) continue;
      const parent = `${environment.id}/${element.parent}`;
      const siblings = elementChildren.get(parent) ?? [];
      siblings.push(elementId(`${environment.id}/${element.id}`));
      elementChildren.set(parent, siblings);
    }
  return {
    artifact,
    models,
    builtElements,
    populationSpaces,
    elementChildren,
    memberOffset,
  };
};

const describePrototype = (
  context: IDescriptionContext,
  model: IAutoMovieModel,
): IAutoMovieSubjectDescription => ({
  version: 1,
  revision: context.artifact.revision,
  id: prototypeId(model.id),
  kind: "prototype",
  semanticKind: model.skeleton === null ? "object" : "actor",
  name: model.name,
  prototype: null,
  placement: null,
  owner: null,
  model: model.id,
  space: null,
  transform: null,
  bounds: {
    declared: null,
    content: boundsOf(modelPoints(model)),
    coordinateSpace: "model",
  },
  materials: materialsOf(model),
  members: summarizeMembers(
    context,
    model.parts.map((part) => prototypePartId(model.id, part.id)),
  ),
});

const describePrototypePart = (
  context: IDescriptionContext,
  model: IAutoMovieModel,
  part: IAutoMovieModelPart,
): IAutoMovieSubjectDescription => ({
  version: 1,
  revision: context.artifact.revision,
  id: prototypePartId(model.id, part.id),
  kind: "part",
  semanticKind: part.geometry.type,
  name: part.name,
  prototype: null,
  placement: null,
  owner: prototypeId(model.id),
  model: model.id,
  space: null,
  transform: part.transform === null ? null : structuredClone(part.transform),
  bounds: {
    declared: null,
    content: boundsOf(partPoints(model, part)),
    coordinateSpace: "model",
  },
  materials: partMaterials(model, part),
  members: summarizeMembers(context, []),
});

const describeElement = (
  context: IDescriptionContext,
  nodeId: string,
): IAutoMovieSubjectDescription => {
  const node = context.artifact.compiled.scene.nodes.find(
    (candidate) => candidate.id === nodeId,
  )!;
  const model = context.models.get(node.model);
  const built = context.builtElements.get(node.id);
  return {
    version: 1,
    revision: context.artifact.revision,
    id: elementId(node.id),
    kind: "element",
    semanticKind: built?.element.kind ?? "scene-node",
    name: model?.name ?? null,
    prototype: prototypeId(node.model),
    placement: elementId(node.id),
    owner:
      built?.element.parent === null || built === undefined
        ? null
        : elementId(`${built.environment.id}/${built.element.parent}`),
    model: node.model,
    space:
      built?.element.space === null || built === undefined
        ? null
        : spaceId(built.environment.id, built.element.space),
    transform: structuredClone(node.transform),
    bounds: {
      declared: null,
      content:
        model === undefined
          ? null
          : boundsOf(
              transformPoints(modelPoints(model), nodeMatrix(node.transform)),
            ),
      coordinateSpace: "world",
    },
    materials: model === undefined ? [] : materialsOf(model),
    // Parts and child elements together, because both are things this subject
    // contains and both are ids this surface resolves. Without the children
    // there is no way down to an element no space claims, and the reviewer who
    // needs one most is the one who does not know it exists.
    members: summarizeMembers(context, [
      ...(model?.parts.map((part) => elementPartId(node.id, part.id)) ?? []),
      ...(context.elementChildren.get(node.id) ?? []),
    ]),
  };
};

/**
 * Describe one built element the compiler stages no scene node for.
 *
 * A transform-only group is an authored element: it has an identity, a kind, a
 * parent, and a logical space, and other elements hang from it. What it does not
 * have is geometry, so it was left out of this surface entirely and every id
 * naming one answered "does not exist". That refusal did not stay inside the
 * group. A space lists the elements it claims, and one authored building has
 * both of its unit roots claimed by a space, so a reviewer opening a room was
 * handed ids that opened nothing while the elements underneath them appeared at
 * the top of the index as though they hung from nothing at all.
 *
 * It therefore states its place the way the rest of the engine already states
 * it. `builtEnvironmentPlacementBounds` answers `null` for a transform-only
 * group "because neither states a place a body occupies", and this agrees: no
 * transform, no content bounds, no materials, no prototype. What it does carry
 * is the structure a walk needs, which is the whole reason to be able to open
 * it.
 */
const describeElementGroup = (
  context: IDescriptionContext,
  environment: IAutoMovieBuiltEnvironment,
  element: IAutoMovieBuiltEnvironment["elements"][number],
): IAutoMovieSubjectDescription => {
  const node = `${environment.id}/${element.id}`;
  return {
    version: 1,
    revision: context.artifact.revision,
    id: elementId(node),
    kind: "element",
    semanticKind: element.kind,
    name: null,
    prototype: null,
    placement: elementId(node),
    owner:
      element.parent === null
        ? null
        : elementId(`${environment.id}/${element.parent}`),
    model: null,
    space:
      element.space === null ? null : spaceId(environment.id, element.space),
    transform: null,
    bounds: { declared: null, content: null, coordinateSpace: "world" },
    materials: [],
    members: summarizeMembers(context, context.elementChildren.get(node) ?? []),
  };
};

const describeElementPart = (
  context: IDescriptionContext,
  node: IAutoMovieSubjectArtifact["compiled"]["scene"]["nodes"][number],
  model: IAutoMovieModel,
  part: IAutoMovieModelPart,
): IAutoMovieSubjectDescription => {
  const built = context.builtElements.get(node.id);
  return {
    version: 1,
    revision: context.artifact.revision,
    id: elementPartId(node.id, part.id),
    kind: "part",
    semanticKind: part.geometry.type,
    name: part.name,
    prototype: prototypePartId(model.id, part.id),
    placement: elementPartId(node.id, part.id),
    owner: elementId(node.id),
    model: model.id,
    space:
      built?.element.space === null || built === undefined
        ? null
        : spaceId(built.environment.id, built.element.space),
    transform: structuredClone(node.transform),
    bounds: {
      declared: null,
      content: boundsOf(
        transformPoints(partPoints(model, part), nodeMatrix(node.transform)),
      ),
      coordinateSpace: "world",
    },
    materials: partMaterials(model, part),
    members: summarizeMembers(context, []),
  };
};

const describeInstanceSet = (
  context: IDescriptionContext,
  set: IAutoMovieCompiledInstanceSet,
): IAutoMovieSubjectDescription => {
  const model = runtimeModelOf(set);
  return {
    version: 1,
    revision: context.artifact.revision,
    id: instanceSetId(set.id),
    kind: "instance-set",
    semanticKind: set.layout.kind,
    name: set.id,
    prototype: model === null ? null : prototypeId(model),
    placement: instanceSetId(set.id),
    owner: context.populationSpaces.get(set.id) ?? null,
    model,
    space: context.populationSpaces.get(set.id) ?? null,
    transform: {
      translation: structuredClone(set.anchor),
      rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, set.facingDeg),
      scale: { x: 1, y: 1, z: 1 },
    },
    bounds: {
      declared: null,
      content: structuredClone(set.bounds),
      coordinateSpace: "world",
    },
    materials:
      model === null || context.models.has(model) === false
        ? []
        : materialsOf(context.models.get(model)!),
    members: summarizeInstanceMembers(context, set),
  };
};

const describeInstance = (
  context: IDescriptionContext,
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): IAutoMovieSubjectDescription => {
  const instance = materializeCompiledInstanceSlot(set, slot);
  const model = instance.model;
  const transform = instance.transform;
  const runtimeModel = model === null ? undefined : context.models.get(model);
  return {
    version: 1,
    revision: context.artifact.revision,
    id: instance.id,
    kind: "instance",
    semanticKind: instance.prototype,
    name: instance.id,
    prototype: model === null ? null : prototypeId(model),
    placement: instance.id,
    owner: instanceSetId(set.id),
    model,
    space: context.populationSpaces.get(set.id) ?? null,
    transform,
    bounds: {
      declared: null,
      content:
        runtimeModel === undefined
          ? null
          : boundsOf(
              transformPoints(modelPoints(runtimeModel), nodeMatrix(transform)),
            ),
      coordinateSpace: "world",
    },
    materials: runtimeModel === undefined ? [] : materialsOf(runtimeModel),
    members: summarizeMembers(context, []),
  };
};

const describeSpace = (
  context: IDescriptionContext,
  environment: IAutoMovieBuiltEnvironment,
  space: IAutoMovieBuiltSpace,
): IAutoMovieSubjectDescription => ({
  version: 1,
  revision: context.artifact.revision,
  id: spaceId(environment.id, space.id),
  kind: "space",
  semanticKind: space.kind,
  name: space.id,
  prototype: null,
  placement: spaceId(environment.id, space.id),
  owner: space.parent === null ? null : spaceId(environment.id, space.parent),
  model: null,
  space: null,
  transform: null,
  bounds: {
    declared: declaredSpaceBounds(space),
    content: builtEnvironmentSpaceContentBounds(environment, space.id),
    coordinateSpace: "world",
  },
  materials: [],
  members: summarizeMembers(context, [
    ...environment.spaces
      .filter((candidate) => candidate.parent === space.id)
      .map((candidate) => spaceId(environment.id, candidate.id)),
    ...environment.elements
      .filter((element) => element.space === space.id)
      .map((element) => elementId(`${environment.id}/${element.id}`)),
    ...(environment.populations ?? [])
      .filter((population) => population.space === space.id)
      .map((population) => instanceSetId(population.set.id)),
  ]),
});

const prototypeId = (model: string): string => `prototype:${model}`;
const prototypePartId = (model: string, part: string): string =>
  `prototype-part:${model}/${part}`;
const elementId = (node: string): string => `element:${node}`;
const elementPartId = (node: string, part: string): string =>
  `element-part:${node}/${part}`;
const instanceSetId = (set: string): string => `instance-set:${set}`;
const spaceId = (environment: string, space: string): string =>
  `space:${environment}/${space}`;

const summarizeMembers = (
  context: IDescriptionContext,
  ids: readonly string[],
): IAutoMovieSubjectMemberSummary => {
  const sorted = [...ids].sort(compareAutoMovieRenderIds);
  const offset = Math.min(context.memberOffset, sorted.length);
  const items = sorted.slice(
    offset,
    offset + AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
  );
  return {
    total: sorted.length,
    offset,
    items,
    omitted: sorted.length - items.length,
  };
};

const summarizeInstanceMembers = (
  context: IDescriptionContext,
  set: IAutoMovieCompiledInstanceSet,
): IAutoMovieSubjectMemberSummary => {
  // Drawn from the slot range rather than from a list, because a compact set
  // stores a count and not its members. The slot index is zero-padded, so slot
  // order and id order are the same order and a page names the slots its own
  // offset claims -- which sorting after an unsliced generation would not.
  const offset = Math.min(context.memberOffset, set.count);
  const items = Array.from(
    {
      length: Math.min(
        set.count - offset,
        AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
      ),
    },
    (_, slot) => instanceId(set, offset + slot),
  ).sort(compareAutoMovieRenderIds);
  return {
    total: set.count,
    offset,
    items,
    omitted: set.count - items.length,
  };
};

const materialsOf = (model: IAutoMovieModel): IAutoMovieSubjectMaterial[] =>
  model.materials
    .map((material) => ({ id: material.id, name: material.name }))
    .sort((left, right) => compareAutoMovieRenderIds(left.id, right.id));

const partMaterials = (
  model: IAutoMovieModel,
  part: IAutoMovieModelPart,
): IAutoMovieSubjectMaterial[] =>
  part.material === null
    ? []
    : materialsOf({
        ...model,
        materials: model.materials.filter(
          (material) => material.id === part.material,
        ),
      });

const modelPoints = (model: IAutoMovieModel): IAutoMovieVector3[] =>
  model.parts.flatMap((part) => partPoints(model, part));

const partPoints = (
  model: IAutoMovieModel,
  part: IAutoMovieModelPart,
): IAutoMovieVector3[] => {
  const positions =
    part.geometry.type === "mesh"
      ? part.geometry.mesh.positions
      : tessellate(part.geometry.shape).positions;
  let matrix =
    part.transform === null ? Matrix4.identity() : nodeMatrix(part.transform);
  if (part.attachedBone !== null && model.skeleton !== null) {
    const bone = resolvePose(
      { skeleton: model.skeleton.id, root: null, joints: [] },
      model.skeleton,
    ).find((candidate) => candidate.bone === part.attachedBone);
    if (bone !== undefined)
      matrix = Matrix4.multiply(
        Matrix4.compose(bone.worldPosition, bone.worldRotation, {
          x: 1,
          y: 1,
          z: 1,
        }),
        matrix,
      );
  }
  const points: IAutoMovieVector3[] = [];
  for (let index = 0; index + 2 < positions.length; index += 3)
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
  return points;
};

const nodeMatrix = (transform: IAutoMovieTransform): number[] =>
  Matrix4.compose(transform.translation, transform.rotation, transform.scale);

const transformPoints = (
  points: readonly IAutoMovieVector3[],
  matrix: readonly number[],
): IAutoMovieVector3[] => points.map((point) => transformPoint(point, matrix));

const transformPoint = (
  point: IAutoMovieVector3,
  matrix: readonly number[],
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

const boundsOf = (
  points: readonly IAutoMovieVector3[],
): IAutoMovieSubjectBox | null => {
  if (points.length === 0) return null;
  const first = points[0]!;
  const min = { ...first };
  const max = { ...first };
  for (const point of points.slice(1)) {
    min.x = Math.min(min.x, point.x);
    min.y = Math.min(min.y, point.y);
    min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x);
    max.y = Math.max(max.y, point.y);
    max.z = Math.max(max.z, point.z);
  }
  return { min, max };
};

const declaredSpaceBounds = (
  space: IAutoMovieBuiltSpace,
): IAutoMovieSubjectBox | null => {
  if (space.shell !== undefined) return boundsOf(space.shell.vertices);
  const points = space.cells.flatMap((cell) => {
    const vertices: IAutoMovieVector3[] = [];
    for (let left = 0; left < cell.planes.length; ++left)
      for (let middle = left + 1; middle < cell.planes.length; ++middle)
        for (let right = middle + 1; right < cell.planes.length; ++right) {
          const point = intersectPlanes(
            cell.planes[left]!,
            cell.planes[middle]!,
            cell.planes[right]!,
          );
          if (
            point !== null &&
            cell.planes.every(
              (plane) =>
                dot(plane.normal, point) <= plane.offset + Number.EPSILON * 64,
            )
          )
            vertices.push(point);
        }
    return vertices;
  });
  return boundsOf(points);
};

const intersectPlanes = (
  first: IAutoMovieBuiltSpace["cells"][number]["planes"][number],
  second: IAutoMovieBuiltSpace["cells"][number]["planes"][number],
  third: IAutoMovieBuiltSpace["cells"][number]["planes"][number],
): IAutoMovieVector3 | null => {
  const secondCrossThird = cross(second.normal, third.normal);
  const determinant = dot(first.normal, secondCrossThird);
  if (Math.abs(determinant) <= Number.EPSILON) return null;
  const thirdCrossFirst = cross(third.normal, first.normal);
  const firstCrossSecond = cross(first.normal, second.normal);
  return {
    x:
      (first.offset * secondCrossThird.x +
        second.offset * thirdCrossFirst.x +
        third.offset * firstCrossSecond.x) /
      determinant,
    y:
      (first.offset * secondCrossThird.y +
        second.offset * thirdCrossFirst.y +
        third.offset * firstCrossSecond.y) /
      determinant,
    z:
      (first.offset * secondCrossThird.z +
        second.offset * thirdCrossFirst.z +
        third.offset * firstCrossSecond.z) /
      determinant,
  };
};

const cross = (
  left: IAutoMovieVector3,
  right: IAutoMovieVector3,
): IAutoMovieVector3 => ({
  x: left.y * right.z - left.z * right.y,
  y: left.z * right.x - left.x * right.z,
  z: left.x * right.y - left.y * right.x,
});

const dot = (left: IAutoMovieVector3, right: IAutoMovieVector3): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;

const instanceId = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): string => {
  const explicit =
    set.layout.kind === "explicit" ? set.layout.transforms[slot] : undefined;
  return explicit === undefined
    ? `instance:${set.id}:slot:${String(slot).padStart(6, "0")}`
    : `instance:${set.id}:${explicit.id}`;
};

const findAddressedInstanceSlot = (
  set: IAutoMovieCompiledInstanceSet,
  subjectId: string,
): number | null => {
  if (set.layout.kind === "explicit") {
    const slot = set.layout.transforms.findIndex(
      (transform) => `instance:${set.id}:${transform.id}` === subjectId,
    );
    return slot >= 0 && slot < set.count ? slot : null;
  }
  const prefix = `instance:${set.id}:slot:`;
  if (!subjectId.startsWith(prefix)) return null;
  const suffix = subjectId.slice(prefix.length);
  if (!/^\d{6}$/.test(suffix)) return null;
  const slot = Number(suffix);
  return slot < set.count ? slot : null;
};

interface IMaterializedCompiledInstance {
  id: string;
  model: string | null;
  prototype: string;
  transform: IAutoMovieTransform;
}

const materializeCompiledInstanceSlot = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): IMaterializedCompiledInstance => {
  const point = localInstancePoint(set, slot);
  const explicit =
    set.layout.kind === "explicit" ? set.layout.transforms[slot] : undefined;
  const selected = selectedCompiledPrototype(set, slot, explicit?.prototype);
  const scale = stableInterpolate(
    set.variation.scale.min,
    set.variation.scale.max,
    seededValue(set.seed, slot, 0x7363616c),
  );
  const scale3 =
    explicit?.scale ??
    (set.variation.scale3 === undefined
      ? { x: scale, y: scale, z: scale }
      : {
          x: stableInterpolate(
            set.variation.scale3.min.x,
            set.variation.scale3.max.x,
            seededValue(set.seed, slot, 0x73637878),
          ),
          y: stableInterpolate(
            set.variation.scale3.min.y,
            set.variation.scale3.max.y,
            seededValue(set.seed, slot, 0x73637979),
          ),
          z: stableInterpolate(
            set.variation.scale3.min.z,
            set.variation.scale3.max.z,
            seededValue(set.seed, slot, 0x73637a7a),
          ),
        });
  const rotation = Quaternion.normalize(
    Quaternion.multiply(
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, set.facingDeg),
      explicit?.rotation ?? seededInstanceRotation(set, slot),
    ),
  );
  return {
    id: instanceId(set, slot),
    model: selected.model,
    prototype: selected.id,
    transform: {
      translation:
        set.layout.kind === "along-route"
          ? { x: point.x, y: set.anchor.y, z: point.z }
          : rotateAndTranslatePoint(point, set.anchor, set.facingDeg),
      rotation,
      scale: scale3,
    },
  };
};

const selectedCompiledPrototype = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
  explicit?: string,
): { id: string; model: string | null; weight: number } => {
  const choices = set.prototypes ?? [
    {
      id: "default",
      modelRecipe: set.modelRecipe,
      weight: 1,
      lod: set.lod,
      projectionRadius: set.projectionRadius,
    },
  ];
  if (explicit !== undefined) {
    const selected = choices.find((choice) => choice.id === explicit);
    if (selected === undefined)
      throw new Error(
        `Instance set "${set.id}" slot ${slot} references missing prototype "${explicit}".`,
      );
    return {
      id: selected.id,
      model: lodModelOf(selected.lod),
      weight: selected.weight,
    };
  }
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let sample = seededValue(set.seed, slot, 0x70726f74) * total;
  for (const choice of choices) {
    if (sample < choice.weight)
      return {
        id: choice.id,
        model: lodModelOf(choice.lod),
        weight: choice.weight,
      };
    sample -= choice.weight;
  }
  const selected = choices.at(-1)!;
  return {
    id: selected.id,
    model: lodModelOf(selected.lod),
    weight: selected.weight,
  };
};

const runtimeModelOf = (set: IAutoMovieCompiledInstanceSet): string | null =>
  lodModelOf(set.lod);

const lodModelOf = (lod: IAutoMovieCompiledInstanceSet["lod"]): string | null =>
  lod[0]?.model ?? null;

const localInstancePoint = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): IAutoMovieVector3 => {
  const layout = set.layout;
  if (layout.kind === "grid") {
    const row = Math.floor(slot / layout.columns);
    const column = slot % layout.columns;
    return {
      x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
      y: 0,
      z: row * layout.spacing.z,
    };
  }
  if (layout.kind === "scatter") {
    const radius =
      Math.sqrt(seededValue(set.seed, slot, 0x72616469)) * layout.radius;
    const angle = seededValue(set.seed, slot, 0x616e676c) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius };
  }
  if (layout.kind === "lattice") {
    const perLayer = layout.rows * layout.columns;
    const layer = Math.floor(slot / perLayer);
    const within = slot % perLayer;
    const row = Math.floor(within / layout.columns);
    const column = within % layout.columns;
    return {
      x: (column - (layout.columns - 1) / 2) * layout.spacing.x,
      y: layer * layout.spacing.y,
      z: row * layout.spacing.z,
    };
  }
  if (layout.kind === "explicit") {
    return layout.transforms[slot]!.translation;
  }
  const route = set.route;
  if (route === null || route.id !== layout.route || route.waypoints.length < 2)
    throw new Error(
      `Instance set "${set.id}" references unavailable route "${layout.route}".`,
    );
  const segments = route.waypoints.slice(1).map((right, index) => {
    const left = route.waypoints[index]!;
    return {
      left,
      right,
      length: Math.hypot(right.x - left.x, right.z - left.z),
    };
  });
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!Number.isFinite(total) || total <= 0)
    throw new RangeError(
      `Instance set "${set.id}" route "${layout.route}" must have finite non-zero length.`,
    );
  let remaining = ((slot + 0.5) / set.count) * total;
  const segment = segments.find((candidate) => {
    if (remaining <= candidate.length) return true;
    remaining -= candidate.length;
    return false;
  }) as (typeof segments)[number];
  const ratio = Math.min(1, remaining / segment.length);
  const tangent = {
    x: segment.right.x - segment.left.x,
    z: segment.right.z - segment.left.z,
  };
  const tangentLength = Math.hypot(tangent.x, tangent.z);
  const jitter =
    (seededValue(set.seed, slot, 0x6a697474) * 2 - 1) * layout.lateralJitter;
  return {
    x:
      segment.left.x + tangent.x * ratio - (tangent.z / tangentLength) * jitter,
    y: 0,
    z:
      segment.left.z + tangent.z * ratio + (tangent.x / tangentLength) * jitter,
  };
};

const rotateAndTranslatePoint = (
  point: IAutoMovieVector3,
  anchor: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieVector3 => {
  const radians = (facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: anchor.x + point.x * cosine + point.z * sine,
    y: anchor.y + point.y,
    z: anchor.z - point.x * sine + point.z * cosine,
  };
};

const seededInstanceRotation = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): IAutoMovieQuaternion => {
  const ranges = set.variation.rotationDeg;
  return ranges === undefined
    ? Quaternion.identity()
    : Quaternion.fromEuler({
        x: stableInterpolate(
          ranges.x.min,
          ranges.x.max,
          seededValue(set.seed, slot, 0x726f7478),
        ),
        y: stableInterpolate(
          ranges.y.min,
          ranges.y.max,
          seededValue(set.seed, slot, 0x726f7479),
        ),
        z: stableInterpolate(
          ranges.z.min,
          ranges.z.max,
          seededValue(set.seed, slot, 0x726f747a),
        ),
        order: "XYZ",
      });
};

function stableInterpolate(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}
