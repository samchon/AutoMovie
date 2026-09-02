import {
  IAutoMovieCompiledInstanceSet,
  IAutoMovieSubjectArtifact,
  IAutoMovieSubjectChange,
  IAutoMovieSubjectDescription,
  IAutoMovieSubjectDiff,
  IAutoMovieSubjectDiffFanout,
  IAutoMovieSubjectMemberSummary,
} from "@automovie/interface";

import { seededValue } from "./math";
import { compareAutoMovieRenderIds } from "./render";
import {
  AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT,
  describeAutoMovieSubjects,
} from "./subjectDescription";

/**
 * Default inclusive absolute tolerance for compiled structural comparison.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Makes the default numeric comparison threshold stable and caller-visible.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-diff-tolerance-fanout Implements the specified `1e-6` inclusive default.
 */
export const AUTOMOVIE_SUBJECT_DIFF_DEFAULT_TOLERANCE = 1e-6;

/**
 * Compare two compiled subject inventories without rendering either artifact.
 *
 * Added and removed subjects are exclusive. A common subject may be both moved
 * and reshaped when its placement and reusable structure changed together.
 * Prototype consequences and per-slot prototype changes remain aggregate
 * counts instead of member-sized change arrays.
 *
 * @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Produces added, removed, moved, reshaped, and unchanged structural results over compiled revisions.
 * @evidence specifications/review-and-acceptance/subject-description-and-structural-diff.md#review-system-subject-structural-diff Compares stable subject ids and their separate placement and shape states.
 */
export const diffAutoMovieSubjects = (
  beforeArtifact: IAutoMovieSubjectArtifact,
  afterArtifact: IAutoMovieSubjectArtifact,
  tolerance: number = AUTOMOVIE_SUBJECT_DIFF_DEFAULT_TOLERANCE,
): IAutoMovieSubjectDiff => {
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new RangeError(
      "Subject diff tolerance must be finite and non-negative.",
    );
  const before = inventoryOf(beforeArtifact);
  const after = inventoryOf(afterArtifact);
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort(
    compareAutoMovieRenderIds,
  );
  const added: IAutoMovieSubjectChange[] = [];
  const removed: IAutoMovieSubjectChange[] = [];
  const moved: IAutoMovieSubjectChange[] = [];
  const reshaped: IAutoMovieSubjectChange[] = [];
  const unchanged: string[] = [];
  for (const id of ids) {
    const previous = before.get(id);
    const next = after.get(id);
    if (previous === undefined) {
      added.push(
        changeOf(null, next!.description, beforeArtifact, afterArtifact),
      );
      continue;
    }
    if (next === undefined) {
      removed.push(
        changeOf(previous.description, null, beforeArtifact, afterArtifact),
      );
      continue;
    }
    const placementChanged = !tolerantEqual(
      previous.placement,
      next.placement,
      tolerance,
    );
    const shapeChanged = !tolerantEqual(previous.shape, next.shape, tolerance);
    if (!placementChanged && !shapeChanged) {
      unchanged.push(id);
      continue;
    }
    const change = changeOf(
      previous.description,
      next.description,
      beforeArtifact,
      afterArtifact,
    );
    if (placementChanged) moved.push(change);
    if (shapeChanged) reshaped.push(change);
  }
  return {
    version: 1,
    fromRevision: beforeArtifact.revision,
    toRevision: afterArtifact.revision,
    tolerance,
    added,
    removed,
    moved,
    reshaped,
    unchanged: summarize(unchanged),
  };
};

interface ISubjectInventoryEntry {
  description: IAutoMovieSubjectDescription;
  placement: unknown;
  shape: unknown;
}

const inventoryOf = (
  artifact: IAutoMovieSubjectArtifact,
): Map<string, ISubjectInventoryEntry> =>
  new Map(
    describeAutoMovieSubjects(artifact).map((description) => [
      description.id,
      {
        description,
        placement: placementState(description),
        shape: shapeState(artifact, description),
      },
    ]),
  );

const placementState = (
  description: IAutoMovieSubjectDescription,
): unknown => ({
  transform: description.transform,
  owner: description.owner,
  space: description.space,
  prototype: description.prototype,
});

const shapeState = (
  artifact: IAutoMovieSubjectArtifact,
  description: IAutoMovieSubjectDescription,
): unknown => {
  if (description.kind === "prototype")
    return artifact.compiled.models.find(
      (model) => model.id === description.model,
    );
  if (description.kind === "part") {
    const model = artifact.compiled.models.find(
      (candidate) => candidate.id === description.model,
    );
    return model?.parts.find(
      (part) => `prototype-part:${model.id}/${part.id}` === description.id,
    );
  }
  if (description.kind === "element")
    return {
      semanticKind: description.semanticKind,
      model: description.model,
      materials: description.materials,
      members: description.members,
    };
  if (description.kind === "instance-set") {
    const set = artifact.compiled.instanceSets.find(
      (candidate) => `instance-set:${candidate.id}` === description.id,
    )!;
    return {
      count: set.count,
      modelRecipe: set.modelRecipe,
      prototypes: set.prototypes,
      layout: set.layout,
      route: set.route,
      seed: set.seed,
      variation: set.variation,
    };
  }
  // A building unit's shape is the unit record: which element hierarchy covers
  // it and which space tree indexes it. Its extent is not read here, because
  // the elements it is measured over are subjects of their own and report their
  // own movement; a unit would otherwise be reported as reshaped every time one
  // wall it owns moved a millimetre.
  if (description.kind === "building")
    return artifact.compiled
      .builtEnvironments!.flatMap((environment) =>
        environment.buildings.map((building) => ({ environment, building })),
      )
      .find(
        ({ environment, building }) =>
          `building:${environment.id}/${building.id}` === description.id,
      )!.building;
  return artifact.compiled
    .builtEnvironments!.flatMap((environment) =>
      environment.spaces.map((space) => ({ environment, space })),
    )
    .find(
      ({ environment, space }) =>
        `space:${environment.id}/${space.id}` === description.id,
    )!.space;
};

const changeOf = (
  before: IAutoMovieSubjectDescription | null,
  after: IAutoMovieSubjectDescription | null,
  beforeArtifact: IAutoMovieSubjectArtifact,
  afterArtifact: IAutoMovieSubjectArtifact,
): IAutoMovieSubjectChange => {
  const description = after ?? (before as IAutoMovieSubjectDescription);
  return {
    id: description.id,
    kind: description.kind,
    before,
    after,
    fanout: fanoutOf(
      description,
      beforeArtifact,
      afterArtifact,
      before !== null && after !== null,
      after !== null,
    ),
  };
};

const fanoutOf = (
  description: IAutoMovieSubjectDescription,
  beforeArtifact: IAutoMovieSubjectArtifact,
  afterArtifact: IAutoMovieSubjectArtifact,
  common: boolean,
  useAfter: boolean,
): IAutoMovieSubjectDiffFanout => {
  if (description.kind === "instance-set") {
    const before = beforeArtifact.compiled.instanceSets.find(
      (set) => `instance-set:${set.id}` === description.id,
    );
    const after = afterArtifact.compiled.instanceSets.find(
      (set) => `instance-set:${set.id}` === description.id,
    );
    return {
      elements: 0,
      instances: 0,
      instanceSets: summarize([]),
      prototypeChanges:
        common && before !== undefined && after !== undefined
          ? changedPrototypeSelections(before, after)
          : 0,
    };
  }
  if (
    description.kind !== "prototype" &&
    description.id.startsWith("prototype-part:") === false
  )
    return emptyFanout();
  const artifact = useAfter ? afterArtifact : beforeArtifact;
  const model = description.model as string;
  const elementCount = artifact.compiled.scene.nodes.filter(
    (node) => node.model === model,
  ).length;
  const setIds: string[] = [];
  let instances = 0;
  for (const set of artifact.compiled.instanceSets) {
    let setInstances = 0;
    for (let slot = 0; slot < set.count; ++slot)
      if (selectedRuntimeModel(set, slot) === model) ++setInstances;
    if (setInstances !== 0) setIds.push(`instance-set:${set.id}`);
    instances += setInstances;
  }
  return {
    elements: elementCount,
    instances,
    instanceSets: summarize(setIds),
    prototypeChanges: 0,
  };
};

const emptyFanout = (): IAutoMovieSubjectDiffFanout => ({
  elements: 0,
  instances: 0,
  instanceSets: summarize([]),
  prototypeChanges: 0,
});

const changedPrototypeSelections = (
  before: IAutoMovieCompiledInstanceSet,
  after: IAutoMovieCompiledInstanceSet,
): number => {
  let changed = Math.abs(before.count - after.count);
  const common = Math.min(before.count, after.count);
  for (let slot = 0; slot < common; ++slot)
    if (
      selectedPrototypeKey(before, slot) !== selectedPrototypeKey(after, slot)
    )
      ++changed;
  return changed;
};

const selectedPrototypeKey = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): string => selectedPrototype(set, slot).key;

const selectedRuntimeModel = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): string | null => selectedPrototype(set, slot).model;

const selectedPrototype = (
  set: IAutoMovieCompiledInstanceSet,
  slot: number,
): { key: string; model: string | null } => {
  const explicit =
    set.layout.kind === "explicit"
      ? set.layout.transforms[slot]?.prototype
      : undefined;
  const choices = compiledPrototypeChoices(set);
  if (explicit !== undefined) {
    const selected = choices.find((choice) => choice.id === explicit);
    return selected === undefined
      ? { key: `missing:${explicit}`, model: null }
      : selectedPrototypeValue(selected);
  }
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let sample = seededValue(set.seed, slot, 0x70726f74) * total;
  for (const choice of choices) {
    if (sample < choice.weight) return selectedPrototypeValue(choice);
    sample -= choice.weight;
  }
  const selected = choices.at(-1)!;
  return selectedPrototypeValue(selected);
};

const compiledPrototypeChoices = (set: IAutoMovieCompiledInstanceSet) =>
  set.prototypes ?? [
    {
      id: "default",
      modelRecipe: set.modelRecipe,
      weight: 1,
      lod: set.lod,
      projectionRadius: set.projectionRadius,
    },
  ];

const lodModelOf = (lod: IAutoMovieCompiledInstanceSet["lod"]): string | null =>
  lod[0]?.model ?? null;

const selectedPrototypeValue = (prototype: {
  id: string;
  lod: IAutoMovieCompiledInstanceSet["lod"];
}): { key: string; model: string | null } => {
  const model = lodModelOf(prototype.lod);
  return { key: `${prototype.id}:${String(model)}`, model };
};

const summarize = (ids: readonly string[]): IAutoMovieSubjectMemberSummary => {
  const sorted = [...ids].sort(compareAutoMovieRenderIds);
  const items = sorted.slice(0, AUTOMOVIE_SUBJECT_MEMBER_SAMPLE_LIMIT);
  // A diff consequence is one answer and not a page of one: nothing asks it for
  // a later rank, so its sample always starts at the first.
  return {
    total: sorted.length,
    offset: 0,
    items,
    omitted: sorted.length - items.length,
  };
};

const tolerantEqual = (
  left: unknown,
  right: unknown,
  tolerance: number,
): boolean => {
  if (typeof left === "number" && typeof right === "number")
    return Math.abs(left - right) <= tolerance;
  if (left === right) return true;
  if (
    left === null ||
    right === null ||
    left === undefined ||
    right === undefined
  )
    return false;
  if (isQuaternion(left) && isQuaternion(right)) {
    const leftLength = Math.hypot(left.x, left.y, left.z, left.w);
    const rightLength = Math.hypot(right.x, right.y, right.z, right.w);
    if (leftLength === 0 || rightLength === 0)
      return (
        Math.abs(left.x - right.x) <= tolerance &&
        Math.abs(left.y - right.y) <= tolerance &&
        Math.abs(left.z - right.z) <= tolerance &&
        Math.abs(left.w - right.w) <= tolerance
      );
    const dot =
      (left.x * right.x +
        left.y * right.y +
        left.z * right.z +
        left.w * right.w) /
      (leftLength * rightLength);
    return 1 - Math.abs(dot) <= tolerance;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((value, index) =>
      tolerantEqual(value, right[index], tolerance),
    );
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = [
    ...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]),
  ]
    .filter(
      (key) => leftRecord[key] !== undefined || rightRecord[key] !== undefined,
    )
    .sort(compareAutoMovieRenderIds);
  return keys.every((key) =>
    tolerantEqual(leftRecord[key], rightRecord[key], tolerance),
  );
};

function isQuaternion(
  value: unknown,
): value is { x: number; y: number; z: number; w: number } {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 4 &&
    typeof record.x === "number" &&
    typeof record.y === "number" &&
    typeof record.z === "number" &&
    typeof record.w === "number"
  );
}
