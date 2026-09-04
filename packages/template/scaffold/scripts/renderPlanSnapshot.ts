import {
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderLayer,
  compareCodeUnits,
} from "@automovie/production";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcPhysicalDirectory,
  type IRenderGcTargetSnapshot,
  assertCapturedRenderTarget,
  assertRenderPhysicalDirectoryIdentity,
  captureRenderGcTarget,
  captureRenderPhysicalDirectory,
  createRenderGcFileSnapshot,
  ensureRenderPhysicalDirectory,
  readCapturedRenderGcFile,
} from "./renderGcSnapshot";

/**
 * Maximum bytes of one stored plan generation.
 *
 * The number is unchanged; what it bounds is not. A generation is stored in the
 * range schema ({@link RENDER_PLAN_RANGE_SCHEMA}), which spells out one entry
 * per constant-velocity layer run instead of one entry per output frame, so the
 * record no longer grows with the length of the film. A 48-frame chunk costs
 * about 550 bytes plus about 220 for each extra run inside it, where the
 * per-frame form cost about 14,500.
 *
 * Where that lands, at the default 48 frames per chunk and counting every video
 * deliverable's copy of the chunk list:
 *
 * - One video deliverable, a cut at most every chunk: ~1,045,000 output frames,
 *   about 12 hours at 24 fps.
 * - Four video deliverables (a feature plus three guide passes), a cut in every
 *   chunk: ~261,000 output frames, about 3 hours at 24 fps or 2.4 hours at 30
 *   fps.
 * - Four video deliverables, three cuts in every chunk: ~166,000 output frames,
 *   about 1.9 hours at 24 fps.
 *
 * The same four-deliverable production reached this cap at 13,919 frames; 9.7
 * minutes at 24 fps; while the plan spelled out every frame. What bounds a
 * plan now is how often the edit cuts or dissolves, not how long it runs.
 */
const RENDER_PLAN_MAX_BYTES = 16 * 1024 * 1024;

/** Storage schema of a generation whose chunks describe ranges, not frames. */
const RENDER_PLAN_RANGE_SCHEMA = 2;

const RENDER_PLAN_GENERATION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** One parsed plan bound to its immutable generation record. */
export interface IRenderPlanSnapshot {
  generation: string;
  plan: IAutoMovieProductionRenderJobPlan;
  snapshot: IRenderGcTargetSnapshot;
}

/**
 * One decoded generation. The stored bytes carry a `version` naming their
 * schema; the decoded record always holds the whole plan, whichever schema it
 * arrived in.
 */
interface IRenderPlanGenerationRecord {
  generation: string;
  plan: IAutoMovieProductionRenderJobPlan;
  predecessor: string | null;
}

/** One maximal frame range whose layers advance one source frame per frame. */
interface IRenderPlanFrameRun {
  count: number;
  layers: IAutoMovieProductionRenderLayer[];
}

interface IRenderPlanOwnership {
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
  assertPlanReadDirectories(ownership);
  if (ownership.generations === null) {
    assertPlanReadOwnership(ownership, snapshots);
    return current;
  }
  assertLegacyRootSlot(ownership.generations, current);
  const visited = new Set<string>();
  for (;;) {
    assertPlanReadDirectories(ownership);
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
    props.predecessor.generation.startsWith("legacy-") === false &&
    planBytes(props.predecessor.plan).equals(planBytes(props.plan))
  )
    return props.predecessor;
  const generation = randomUUID();
  const record: IRenderPlanGenerationRecord = {
    generation,
    plan: props.plan,
    predecessor,
  };
  const bytes = recordBytes(record);
  const destination = generationSlot(ownership.generations.path, predecessor);
  assertPlanOwnership(ownership);
  try {
    assertPlanHead(props.base, props.target, props.predecessor);
    assertPlanOwnership(ownership);
    const snapshot = createRenderGcFileSnapshot(props.base, destination, bytes);
    const published = parseGeneration(snapshot);
    assertGenerationRecord(published.record, record);
    assertCapturedRenderTarget(published.snapshot);
    assertPlanOwnership(ownership);
    return {
      generation,
      plan: published.record.plan,
      snapshot: published.snapshot,
    };
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
    Object.keys(value).sort(compareCodeUnits).join(",") !==
      "generation,plan,predecessor,version" ||
    (value.version !== 1 && value.version !== RENDER_PLAN_RANGE_SCHEMA) ||
    typeof value.generation !== "string" ||
    RENDER_PLAN_GENERATION.test(value.generation) === false ||
    (value.predecessor !== null && typeof value.predecessor !== "string") ||
    isRecord(value.plan) === false
  )
    throw new Error("Render plan generation record is malformed.");
  const stored = value as unknown as {
    generation: string;
    plan: unknown;
    predecessor: string | null;
    version: 1 | 2;
  };
  return {
    record: {
      generation: stored.generation,
      plan:
        stored.version === RENDER_PLAN_RANGE_SCHEMA
          ? decodeRenderPlanRanges(stored.plan)
          : (stored.plan as IAutoMovieProductionRenderJobPlan),
      predecessor: stored.predecessor,
    },
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
  const ownership = { generations, parent, root };
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
  assertPlanReadDirectories(ownership);
  for (const snapshot of snapshots) assertCapturedRenderTarget(snapshot);
};

const assertPlanReadDirectories = (ownership: {
  generations: IRenderGcPhysicalDirectory | null;
  parent: IRenderGcPhysicalDirectory;
  root: IRenderGcPhysicalDirectory;
}): void => {
  assertExactPhysicalDirectory(ownership.root, "render plan read root");
  assertExactPhysicalDirectory(ownership.parent, "render plan read parent");
  if (ownership.generations !== null)
    assertExactPhysicalDirectory(
      ownership.generations,
      "render plan generation directory",
    );
};

const assertLegacyRootSlot = (
  generations: IRenderGcPhysicalDirectory,
  legacy: IRenderPlanSnapshot | null,
): void => {
  const roots = fs
    .readdirSync(generations.path)
    .filter((name) => /^legacy-[0-9a-f]{64}\.json$/u.test(name));
  const genesis = fs.existsSync(path.join(generations.path, "genesis.json"));
  const expected = legacy === null ? null : `${legacy.generation}.json`;
  if (
    roots.length > 1 ||
    (legacy !== null && genesis) ||
    (roots.length === 1 && roots[0] !== expected) ||
    (roots.length !== 0 && legacy === null)
  )
    throw new Error("Render plan legacy root changed after chain publication.");
  assertExactPhysicalDirectory(generations, "render plan generation directory");
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
  const bytes = Buffer.from(
    `${JSON.stringify(storedGeneration(record), null, 2)}\n`,
    "utf8",
  );
  if (bytes.length > RENDER_PLAN_MAX_BYTES)
    throw new Error("Render plan generation exceeds its maximum byte length.");
  return bytes;
};

/**
 * Choose the schema one generation is stored in.
 *
 * The range schema is preferred, and taken only when the encoded form decodes
 * back to a byte-identical plan. A plan the codec cannot describe; one whose
 * frames are not the exact derivation of its own ranges; is stored verbatim
 * rather than approximated, so choosing the schema can never change what a
 * later read returns.
 */
const storedGeneration = (record: IRenderPlanGenerationRecord): unknown => {
  const ranges = encodeRenderPlanRanges(record.plan);
  if (ranges === null) return { ...record, version: 1 };
  let decoded: IAutoMovieProductionRenderJobPlan;
  try {
    decoded = decodeRenderPlanRanges(ranges);
  } catch {
    return { ...record, version: 1 };
  }
  if (planBytes(decoded).equals(planBytes(record.plan)) === false)
    return { ...record, version: 1 };
  return {
    generation: record.generation,
    plan: ranges,
    predecessor: record.predecessor,
    version: RENDER_PLAN_RANGE_SCHEMA,
  };
};

/**
 * Replace every chunk's per-frame array with the ranges it was derived from, or
 * answer `null` when this plan is not that derivation.
 *
 * A render chunk's frames are pure derived data: the output frame is the
 * chunk's own frame cursor, the timeline frame is that cursor times the tier's
 * frame step, the film second is that cursor over the frame clock, and the
 * layers advance exactly one source frame per output frame for as long as the
 * edit holds still. Only the layer runs carry information, and there is one run
 * per cut, per dissolve frame, and per chunk; never one per frame. Storing
 * the runs is what stops a plan growing with the length of the film.
 */
const encodeRenderPlanRanges = (
  plan: IAutoMovieProductionRenderJobPlan,
): Record<string, unknown> | null => {
  const source: unknown = plan;
  if (isRecord(source) === false) return null;
  const tier = source.tier;
  const frameFormat = source.frameFormat;
  if (
    source.version !== 4 ||
    Array.isArray(source.chunks) === false ||
    isRecord(tier) === false ||
    isRecord(frameFormat) === false
  )
    return null;
  const frameStep = tier.frameStep;
  const fps = frameFormat.fps;
  if (
    Number.isSafeInteger(frameStep) === false ||
    (frameStep as number) <= 0 ||
    typeof fps !== "number" ||
    Number.isFinite(fps) === false ||
    fps <= 0
  )
    return null;
  const chunks: unknown[] = [];
  for (const chunk of source.chunks as unknown[]) {
    const encoded = encodeRenderPlanChunkRanges(
      chunk,
      frameStep as number,
      fps,
    );
    if (encoded === null) return null;
    chunks.push(encoded);
  }
  return replaceOwnKey(source, "chunks", "chunks", chunks);
};

const encodeRenderPlanChunkRanges = (
  chunk: unknown,
  frameStep: number,
  fps: number,
): Record<string, unknown> | null => {
  if (isRecord(chunk) === false) return null;
  const frameStart = chunk.frameStart;
  const frames = chunk.frames;
  if (
    Number.isSafeInteger(frameStart) === false ||
    Number.isSafeInteger(chunk.frameEndExclusive) === false ||
    Array.isArray(frames) === false ||
    frames.length !==
      (chunk.frameEndExclusive as number) - (frameStart as number)
  )
    return null;
  const runs: IRenderPlanFrameRun[] = [];
  for (let index = 0; index < frames.length; ++index) {
    const layers = derivedRenderPlanFrameLayers(
      frames[index],
      (frameStart as number) + index,
      frameStep,
      fps,
    );
    if (layers === null) return null;
    const open = runs.at(-1);
    if (open !== undefined && continuesRenderPlanRun(open, layers)) {
      open.count += 1;
      continue;
    }
    runs.push({
      count: 1,
      layers: layers.map((layer) => ({
        shot: layer.shot,
        sourceFrame: layer.sourceFrame,
        weight: layer.weight,
      })),
    });
  }
  return replaceOwnKey(chunk, "frames", "runs", runs);
};

/** The frame's layers when every other field is exactly its own derivation. */
const derivedRenderPlanFrameLayers = (
  frame: unknown,
  globalFrame: number,
  frameStep: number,
  fps: number,
): IAutoMovieProductionRenderLayer[] | null => {
  if (
    isRecord(frame) === false ||
    Object.keys(frame).join(",") !==
      "globalFrame,timelineFrame,timeSeconds,layers" ||
    frame.globalFrame !== globalFrame ||
    frame.timelineFrame !== globalFrame * frameStep ||
    frame.timeSeconds !== globalFrame / fps
  )
    return null;
  const layers = frame.layers;
  if (
    Array.isArray(layers) === false ||
    layers.length === 0 ||
    layers.every(isRenderPlanLayer) === false
  )
    return null;
  return layers as IAutoMovieProductionRenderLayer[];
};

const isRenderPlanLayer = (
  layer: unknown,
): layer is IAutoMovieProductionRenderLayer =>
  isRecord(layer) &&
  Object.keys(layer).join(",") === "shot,sourceFrame,weight" &&
  typeof layer.shot === "string" &&
  Number.isSafeInteger(layer.sourceFrame) &&
  typeof layer.weight === "number" &&
  Number.isFinite(layer.weight);

/**
 * Whether the next frame continues an open run: the same shots at the same
 * weights, each having advanced exactly one source frame per frame already in
 * the run.
 */
const continuesRenderPlanRun = (
  run: IRenderPlanFrameRun,
  layers: readonly IAutoMovieProductionRenderLayer[],
): boolean =>
  run.layers.length === layers.length &&
  run.layers.every(
    (layer, index) =>
      layer.shot === layers[index]!.shot &&
      layer.weight === layers[index]!.weight &&
      layers[index]!.sourceFrame === layer.sourceFrame + run.count,
  );

/** Rebuild every chunk's exact frames from the ranges they were derived from. */
const decodeRenderPlanRanges = (
  plan: unknown,
): IAutoMovieProductionRenderJobPlan => {
  if (isRecord(plan) === false)
    throw new Error("Render plan generation record is malformed.");
  const chunks = plan.chunks;
  const tier = plan.tier;
  const frameFormat = plan.frameFormat;
  if (
    Array.isArray(chunks) === false ||
    isRecord(tier) === false ||
    isRecord(frameFormat) === false
  )
    throw new Error("Render plan generation record is malformed.");
  const frameStep = tier.frameStep;
  const fps = frameFormat.fps;
  if (
    Number.isSafeInteger(frameStep) === false ||
    (frameStep as number) <= 0 ||
    typeof fps !== "number" ||
    Number.isFinite(fps) === false ||
    fps <= 0
  )
    throw new Error("Render plan generation record is malformed.");
  return replaceOwnKey(
    plan,
    "chunks",
    "chunks",
    (chunks as unknown[]).map((chunk) =>
      decodeRenderPlanChunkRanges(chunk, frameStep as number, fps),
    ),
  ) as unknown as IAutoMovieProductionRenderJobPlan;
};

const decodeRenderPlanChunkRanges = (
  chunk: unknown,
  frameStep: number,
  fps: number,
): Record<string, unknown> => {
  if (isRecord(chunk) === false)
    throw new Error("Render plan generation record is malformed.");
  const runs = chunk.runs;
  if (
    Array.isArray(runs) === false ||
    Number.isSafeInteger(chunk.frameStart) === false ||
    Number.isSafeInteger(chunk.frameEndExclusive) === false
  )
    throw new Error("Render plan generation record is malformed.");
  const frames: unknown[] = [];
  let globalFrame = chunk.frameStart as number;
  for (const run of runs as unknown[]) {
    if (isRecord(run) === false)
      throw new Error("Render plan generation record is malformed.");
    const count = run.count;
    const entries = run.layers;
    if (
      Number.isSafeInteger(count) === false ||
      (count as number) <= 0 ||
      Array.isArray(entries) === false ||
      entries.length === 0 ||
      entries.every(isRenderPlanLayer) === false
    )
      throw new Error("Render plan generation record is malformed.");
    const layers = entries as IAutoMovieProductionRenderLayer[];
    for (let offset = 0; offset < (count as number); ++offset) {
      frames.push({
        globalFrame,
        timelineFrame: globalFrame * frameStep,
        timeSeconds: globalFrame / fps,
        layers: layers.map((layer) => ({
          shot: layer.shot,
          sourceFrame: layer.sourceFrame + offset,
          weight: layer.weight,
        })),
      });
      globalFrame += 1;
    }
  }
  if (globalFrame !== chunk.frameEndExclusive)
    throw new Error("Render plan generation record is malformed.");
  return replaceOwnKey(chunk, "runs", "frames", frames);
};

/**
 * Copy one record, substituting a single key in place, so the encoded and
 * decoded forms keep the exact property order the plan was written in and the
 * round trip stays byte-comparable.
 */
const replaceOwnKey = (
  source: Record<string, unknown>,
  key: string,
  replacement: string,
  value: unknown,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(source).map((entry): [string, unknown] =>
      entry[0] === key ? [replacement, value] : entry,
    ),
  );

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
