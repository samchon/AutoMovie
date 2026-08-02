import type { IAutoMovieProductionRenderJobPlan } from "@automovie/mcp";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcPhysicalDirectory,
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  assertCapturedRenderTarget,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";

const RENDER_PLAN_MAX_BYTES = 16 * 1024 * 1024;
const RENDER_PLAN_GENERATION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** One parsed plan bound to its immutable generation record. */
export interface IRenderPlanSnapshot {
  generation: string;
  plan: IAutoMovieProductionRenderJobPlan;
  snapshot: IRenderGcTargetSnapshot;
}

interface IRenderPlanGenerationRecord {
  generation: string;
  plan: IAutoMovieProductionRenderJobPlan;
  predecessor: string | null;
  version: 1;
}

interface IRenderPlanOwnership {
  candidates: IRenderGcPhysicalDirectory;
  generations: IRenderGcPhysicalDirectory;
  parent: IRenderGcPhysicalDirectory;
  root: IRenderGcPhysicalDirectory;
}

/** Capture the current append-only plan-chain head, including legacy v0 files. */
export const captureExistingRenderPlan = (
  base: string,
  target: string,
): IRenderPlanSnapshot | null => {
  const ownership = capturePlanReadOwnership(base, target);
  let current = captureLegacyRenderPlan(base, target);
  const snapshots: IRenderGcTargetSnapshot[] = [];
  if (current !== null) snapshots.push(current.snapshot);
  assertPlanReadOwnership(ownership, snapshots);
  if (ownership.generations === null) return current;
  const visited = new Set<string>();
  for (;;) {
    assertPlanReadOwnership(ownership, snapshots);
    const predecessor = current?.generation ?? null;
    const slot = generationSlot(ownership.generations.path, predecessor);
    const successor = captureExistingGeneration(base, slot);
    if (successor === null) {
      assertPlanReadOwnership(ownership, snapshots);
      return current;
    }
    if (successor.record.predecessor !== predecessor)
      throw new Error("Render plan generation has another predecessor.");
    if (visited.has(successor.record.generation))
      throw new Error("Render plan generation chain contains a cycle.");
    visited.add(successor.record.generation);
    snapshots.push(successor.snapshot);
    current = {
      generation: successor.record.generation,
      plan: successor.record.plan,
      snapshot: successor.snapshot,
    };
    assertPlanReadOwnership(ownership, snapshots);
  }
};

/** Require and capture the current append-only plan-chain head. */
export const captureRenderPlan = (
  base: string,
  target: string,
): IRenderPlanSnapshot => {
  const current = captureExistingRenderPlan(base, target);
  if (current === null)
    throw Object.assign(new Error("No stored render plan exists."), {
      code: "ENOENT",
    });
  return current;
};

/** Append one successor only while its exact predecessor and inputs are current. */
export const publishRenderPlan = async (props: {
  base: string;
  inputCurrent: () => Promise<void>;
  plan: IAutoMovieProductionRenderJobPlan;
  predecessor: IRenderPlanSnapshot | null;
  target: string;
}): Promise<IRenderPlanSnapshot> => {
  const ownership = capturePlanOwnership(props.base, props.target);
  const predecessor = props.predecessor?.generation ?? null;
  assertPlanHead(props.base, props.target, props.predecessor);
  await props.inputCurrent();
  assertPlanHead(props.base, props.target, props.predecessor);
  if (
    props.predecessor !== null &&
    planBytes(props.predecessor.plan).equals(planBytes(props.plan))
  )
    return props.predecessor;
  const generation = randomUUID();
  const record: IRenderPlanGenerationRecord = {
    generation,
    plan: props.plan,
    predecessor,
    version: 1,
  };
  const bytes = recordBytes(record);
  const destination = generationSlot(ownership.generations.path, predecessor);
  const candidatePath = path.join(
    ownership.candidates.path,
    `${generation}.${process.pid}.plan-candidate`,
  );
  assertPlanOwnership(ownership);
  const candidate = createRenderGcFileSnapshot(
    props.base,
    candidatePath,
    bytes,
  );
  let linkSucceeded = false;
  let cleanup = candidate;
  try {
    assertPlanHead(props.base, props.target, props.predecessor);
    assertPlanOwnership(ownership);
    assertCapturedRenderTarget(candidate);
    assertPlanLinkCount(candidate, 1);
    try {
      fs.linkSync(candidate.target, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const winner = captureGeneration(props.base, destination);
      if (
        winner.record.predecessor !== predecessor ||
        planBytes(winner.record.plan).equals(planBytes(props.plan)) === false
      )
        throw new Error("A concurrent render plan won this predecessor slot.");
      assertPlanOwnership(ownership);
      return {
        generation: winner.record.generation,
        plan: winner.record.plan,
        snapshot: winner.snapshot,
      };
    }
    linkSucceeded = true;
    const linked = captureGeneration(props.base, destination);
    assertGenerationRecord(linked.record, record);
    assertSamePlanFile(candidate, linked.snapshot);
    const capturedCandidate = captureRenderGcTarget(
      props.base,
      candidate.target,
    );
    assertSamePlanFile(candidate, capturedCandidate);
    if (linked.snapshot.targetVersion !== capturedCandidate.targetVersion)
      throw new Error("Render plan link generation changed before commit.");
    assertPlanLinkCount(linked.snapshot, 2);
    assertPlanLinkCount(capturedCandidate, 2);
    assertPlanOwnership(ownership);
    cleanup = capturedCandidate;
    if (removeOwnedCandidate(cleanup, ownership) === false)
      throw new Error("Render plan candidate cleanup lost ownership.");
    const published = captureGeneration(props.base, destination);
    assertGenerationRecord(published.record, record);
    assertSamePlanFile(linked.snapshot, published.snapshot);
    assertPlanOwnership(ownership);
    return {
      generation,
      plan: published.record.plan,
      snapshot: published.snapshot,
    };
  } finally {
    if (
      linkSucceeded === false &&
      removeOwnedCandidate(cleanup, ownership) === false
    )
      throw new Error("Render plan candidate cleanup lost ownership.");
  }
};

const captureLegacyRenderPlan = (
  base: string,
  target: string,
): IRenderPlanSnapshot | null => {
  const snapshot = captureExistingTarget(base, target);
  if (snapshot === null) return null;
  if (snapshot.kind !== "file")
    throw new Error("Legacy render plan is not one physical file.");
  const plan = parsePlan(
    readCapturedRenderGcFile(snapshot, RENDER_PLAN_MAX_BYTES),
  );
  return {
    generation: legacyGeneration(snapshot),
    plan,
    snapshot,
  };
};

const captureExistingGeneration = (
  base: string,
  target: string,
): {
  record: IRenderPlanGenerationRecord;
  snapshot: IRenderGcTargetSnapshot;
} | null => {
  const snapshot = captureExistingTarget(base, target);
  return snapshot === null ? null : parseGeneration(snapshot);
};

const captureGeneration = (
  base: string,
  target: string,
): { record: IRenderPlanGenerationRecord; snapshot: IRenderGcTargetSnapshot } =>
  parseGeneration(captureRenderGcTarget(base, target));

const parseGeneration = (
  snapshot: IRenderGcTargetSnapshot,
): {
  record: IRenderPlanGenerationRecord;
  snapshot: IRenderGcTargetSnapshot;
} => {
  if (snapshot.kind !== "file")
    throw new Error("Render plan generation is not one physical file.");
  const value = JSON.parse(
    Buffer.from(
      readCapturedRenderGcFile(snapshot, RENDER_PLAN_MAX_BYTES),
    ).toString("utf8"),
  ) as unknown;
  if (
    isRecord(value) === false ||
    Object.keys(value).sort().join(",") !==
      "generation,plan,predecessor,version" ||
    value.version !== 1 ||
    typeof value.generation !== "string" ||
    RENDER_PLAN_GENERATION.test(value.generation) === false ||
    (value.predecessor !== null && typeof value.predecessor !== "string") ||
    isRecord(value.plan) === false
  )
    throw new Error("Render plan generation record is malformed.");
  return {
    record: value as unknown as IRenderPlanGenerationRecord,
    snapshot,
  };
};

const parsePlan = (bytes: Uint8Array): IAutoMovieProductionRenderJobPlan => {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  if (isRecord(value) === false)
    throw new Error("Stored render plan is malformed.");
  return value as unknown as IAutoMovieProductionRenderJobPlan;
};

const assertPlanHead = (
  base: string,
  target: string,
  expected: IRenderPlanSnapshot | null,
): void => {
  const current = captureExistingRenderPlan(base, target);
  if (current === null || expected === null) {
    if (current !== expected)
      throw new Error("Render plan predecessor changed before publication.");
    return;
  }
  if (
    current.generation !== expected.generation ||
    current.snapshot.target !== expected.snapshot.target ||
    current.snapshot.targetIdentity !== expected.snapshot.targetIdentity ||
    current.snapshot.targetVersion !== expected.snapshot.targetVersion ||
    current.snapshot.fileDigest !== expected.snapshot.fileDigest ||
    current.snapshot.namespaceFingerprint !==
      expected.snapshot.namespaceFingerprint
  )
    throw new Error("Render plan predecessor changed before publication.");
};

const capturePlanOwnership = (
  base: string,
  target: string,
): IRenderPlanOwnership => {
  const root = captureRenderPhysicalDirectory(base, "render plan root");
  const parent = captureRenderPhysicalDirectory(
    path.dirname(path.resolve(target)),
    "render plan parent",
  );
  if (parent.path !== root.path || parent.identity !== root.identity)
    throw new Error("Render plan target must be a direct child of its root.");
  const generations = captureRenderPhysicalDirectory(
    ensureRenderPhysicalDirectory(
      root.path,
      path.basename(generationDirectory(target)),
    ),
    "render plan generation directory",
  );
  const candidates = captureRenderPhysicalDirectory(
    ensureRenderPhysicalDirectory(
      root.path,
      `${RENDER_GC_PRESERVED_PREFIX}plan-candidates`,
    ),
    "render plan candidate directory",
  );
  const ownership = { candidates, generations, parent, root };
  assertPlanOwnership(ownership);
  return ownership;
};

const capturePlanReadOwnership = (
  base: string,
  target: string,
): {
  generations: IRenderGcPhysicalDirectory | null;
  parent: IRenderGcPhysicalDirectory;
  root: IRenderGcPhysicalDirectory;
} => {
  const root = captureRenderPhysicalDirectory(base, "render plan read root");
  const parent = captureRenderPhysicalDirectory(
    path.dirname(path.resolve(target)),
    "render plan read parent",
  );
  const relative = path.relative(root.real, parent.real);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("Render plan target escapes its read root.");
  const directory = generationDirectory(target);
  const generations = physicalDirectoryExists(directory)
    ? captureRenderPhysicalDirectory(
        directory,
        "render plan generation directory",
      )
    : null;
  const ownership = { generations, parent, root };
  assertPlanReadOwnership(ownership, []);
  return ownership;
};

const assertPlanReadOwnership = (
  ownership: {
    generations: IRenderGcPhysicalDirectory | null;
    parent: IRenderGcPhysicalDirectory;
    root: IRenderGcPhysicalDirectory;
  },
  snapshots: readonly IRenderGcTargetSnapshot[],
): void => {
  assertExactPhysicalDirectory(ownership.root, "render plan read root");
  assertExactPhysicalDirectory(ownership.parent, "render plan read parent");
  if (ownership.generations !== null)
    assertExactPhysicalDirectory(
      ownership.generations,
      "render plan generation directory",
    );
  for (const snapshot of snapshots) assertCapturedRenderTarget(snapshot);
};

const assertExactPhysicalDirectory = (
  expected: IRenderGcPhysicalDirectory,
  label: string,
): void => {
  const current = captureRenderPhysicalDirectory(expected.path, label);
  if (
    current.identity !== expected.identity ||
    current.real !== expected.real ||
    current.version !== expected.version
  )
    throw new Error(`${label} changed exact generation.`);
};

const assertPlanOwnership = (ownership: IRenderPlanOwnership): void => {
  assertRenderPhysicalDirectoryIdentity(ownership.root, "render plan root");
  assertRenderPhysicalDirectoryIdentity(ownership.parent, "render plan parent");
  assertRenderPhysicalDirectoryIdentity(
    ownership.generations,
    "render plan generation directory",
  );
  assertRenderPhysicalDirectoryIdentity(
    ownership.candidates,
    "render plan candidate directory",
  );
};

const generationDirectory = (target: string): string =>
  `${path.resolve(target)}.generations`;

const generationSlot = (
  directory: string,
  predecessor: string | null,
): string =>
  path.join(
    directory,
    `${predecessor === null ? "genesis" : predecessor}.json`,
  );

const legacyGeneration = (snapshot: IRenderGcTargetSnapshot): string =>
  `legacy-${createHash("sha256")
    .update(
      JSON.stringify({
        digest: snapshot.fileDigest,
        identity: snapshot.targetIdentity,
        version: snapshot.targetVersion,
      }),
    )
    .digest("hex")}`;

const recordBytes = (record: IRenderPlanGenerationRecord): Buffer => {
  const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");
  if (bytes.length > RENDER_PLAN_MAX_BYTES)
    throw new Error("Render plan generation exceeds its maximum byte length.");
  return bytes;
};

const planBytes = (plan: IAutoMovieProductionRenderJobPlan): Buffer =>
  Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, "utf8");

const assertGenerationRecord = (
  current: IRenderPlanGenerationRecord,
  expected: IRenderPlanGenerationRecord,
): void => {
  if (
    current.generation !== expected.generation ||
    current.predecessor !== expected.predecessor ||
    planBytes(current.plan).equals(planBytes(expected.plan)) === false
  )
    throw new Error("Render plan publication used another generation record.");
};

const assertSamePlanFile = (
  expected: IRenderGcTargetSnapshot,
  current: IRenderGcTargetSnapshot,
): void => {
  if (
    current.kind !== "file" ||
    current.base.identity !== expected.base.identity ||
    current.targetIdentity !== expected.targetIdentity ||
    current.contentFingerprint !== expected.contentFingerprint ||
    current.fileDigest !== expected.fileDigest
  )
    throw new Error("Render plan publication used another physical file.");
};

const assertPlanLinkCount = (
  snapshot: IRenderGcTargetSnapshot,
  expected: number,
): void => {
  const status = fs.lstatSync(snapshot.target, { bigint: true });
  const version = `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;
  if (
    status.isSymbolicLink() ||
    status.isFile() === false ||
    version !== snapshot.targetVersion ||
    status.nlink !== BigInt(expected)
  )
    throw new Error("Render plan file has another hard-link generation.");
};

const removeOwnedCandidate = (
  snapshot: IRenderGcTargetSnapshot,
  ownership: IRenderPlanOwnership,
): boolean => {
  try {
    assertPlanOwnership(ownership);
    const quarantine = ensureRenderPhysicalDirectory(
      snapshot.base.path,
      `${RENDER_GC_PRESERVED_PREFIX}plan-${randomUUID()}`,
    );
    try {
      removeCapturedRenderGcTarget({
        isolated: path.join(quarantine, randomUUID()),
        quarantine,
        snapshot,
      });
    } finally {
      if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
    }
    try {
      fs.lstatSync(snapshot.target);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
    }
    assertPlanOwnership(ownership);
    return true;
  } catch {
    return false;
  }
};

const captureExistingTarget = (
  base: string,
  target: string,
): IRenderGcTargetSnapshot | null => {
  try {
    return captureRenderGcTarget(base, target);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR"
    )
      return null;
    throw error;
  }
};

const physicalDirectoryExists = (directory: string): boolean => {
  try {
    const status = fs.lstatSync(directory);
    if (status.isSymbolicLink() || status.isDirectory() === false)
      throw new Error(
        `Render plan generation path "${directory}" is not a physical directory.`,
      );
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;
