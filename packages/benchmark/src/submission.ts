import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieProductionDeliverable,
} from "@automovie/interface";
import typia from "typia";

import {
  IAutoMovieBenchmarkGateResult,
  IAutoMovieBenchmarkInfraIncident,
  resolveAutoMovieBenchmarkLifecycle,
} from "./lifecycle";
import {
  AutoMovieBenchmarkSurface,
  IAutoMovieBenchmarkTask,
  IAutoMovieBenchmarkVersions,
  digestBenchmarkValue,
  validateAutoMovieBenchmarkTask,
} from "./task";

/** Submission schema every archived run carries. */
export const AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL =
  "automovie.benchmark.submission.v1";

/** One packaged artifact the candidate installed from. */
export interface IAutoMovieBenchmarkArtifact {
  /** Package name as published. */
  name: string;
  /** Digest of the exact installed tarball. */
  digest: AutoMovieContentDigest;
  /** Positive safe-integer tarball byte count. */
  bytes: number;
}

/** Repository state the packaged artifacts were built from. */
export interface IAutoMovieBenchmarkRepository {
  /** Exact commit the run was packaged at. */
  commit: string;
  /** Whether the packaging tree carried uncommitted changes. */
  dirty: boolean;
  /** Every installed artifact. */
  artifacts: IAutoMovieBenchmarkArtifact[];
}

/** External client identity, held equal across compared surfaces. */
export interface IAutoMovieBenchmarkClient {
  /** External client program, such as an agent CLI. */
  client: string;
  /** Agent profile the client ran. */
  agent: string;
  /** Model snapshot identity. */
  model: string;
  /** Reasoning-effort setting. */
  effort: string;
  /** Safe-integer seed handed to the client. */
  seed: number;
  /** Digest of the complete client configuration. */
  configDigest: AutoMovieContentDigest;
}

/** One advertised MCP tool and the schema budget it consumed. */
export interface IAutoMovieBenchmarkToolInventory {
  /** Advertised tool name. */
  name: string;
  /** Non-negative safe-integer byte length of the advertised description. */
  descriptionBytes: number;
  /** Non-negative safe-integer byte length of the advertised input schema. */
  schemaBytes: number;
}

/** Handshake and tool inventory observed at `initialize` and `tools/list`. */
export interface IAutoMovieBenchmarkMcpSession {
  /** MCP protocol version the server answered with. */
  protocolVersion: string;
  /** Advertised server name. */
  serverName: string;
  /** Advertised server version. */
  serverVersion: string;
  /** Every advertised tool, in advertised order. */
  tools: IAutoMovieBenchmarkToolInventory[];
}

/** One source path the candidate created, changed, or removed. */
export interface IAutoMovieBenchmarkSourceEdit {
  /** Project-relative path. */
  path: string;
  /** Digest before the run, or `null` when the run created the path. */
  beforeDigest: AutoMovieContentDigest | null;
  /** Digest after the run, or `null` when the run removed the path. */
  afterDigest: AutoMovieContentDigest | null;
}

/** One actual captured frame the run produced. */
export interface IAutoMovieBenchmarkCapturedFrame {
  /** Compiler-owned shot id. */
  shot: string;
  /** Non-negative finite shot-local capture time in seconds. */
  timeSeconds: number;
  /** Pass the frame was captured through. */
  pass: AutoMovieGuidePass;
  /** Non-negative safe-integer captured raster width. */
  width: number;
  /** Non-negative safe-integer captured raster height. */
  height: number;
  /** Non-negative safe-integer resident PNG byte count. */
  bytes: number;
  /** Digest of the resident PNG bytes. */
  digest: AutoMovieContentDigest;
  /** Whether a PNG parser accepted the resident bytes. */
  probeValid: boolean;
}

/** One published deliverable file and its parser receipt. */
export interface IAutoMovieBenchmarkDeliveredFile {
  /** Deliverable id that owns the file. */
  deliverable: string;
  /** Deliverable class. */
  kind: IAutoMovieProductionDeliverable["kind"];
  /** Published media type. */
  mediaType: string;
  /** Non-negative safe-integer resident byte count. */
  bytes: number;
  /** Digest of the resident bytes. */
  digest: AutoMovieContentDigest;
  /** Non-negative finite runtime, or `null` for a still or text deliverable. */
  durationSeconds: number | null;
  /** Whether the media parser accepted the resident bytes. */
  probeValid: boolean;
}

/** Candidate generation health, never blended into the film score. */
export interface IAutoMovieBenchmarkGenerationHealth {
  /** Non-negative safe-integer tool calls the candidate issued. */
  toolCalls: number;
  /** Non-negative safe-integer correction rounds spent on its own output. */
  corrections: number;
  /** Non-negative finite candidate cost in US dollars. */
  costUsd: number;
  /** Non-negative finite wall-clock run time in seconds. */
  elapsedSeconds: number;
  /** Non-negative safe-integer input tokens consumed. */
  inputTokens: number;
  /** Non-negative safe-integer output tokens produced. */
  outputTokens: number;
}

/** Machine identity the run was produced on. */
export interface IAutoMovieBenchmarkRuntime {
  /** Operating system identity. */
  os: string;
  /** CPU architecture. */
  arch: string;
  /** Node and package-manager identity. */
  toolchain: string;
  /** Canonical capture-runtime identity recorded by the render bundle. */
  capture: string;
}

/** One immutable archived run, before its content-addressed identity. */
export interface IAutoMovieBenchmarkSubmissionDraft {
  /** Submission schema. */
  protocolVersion: typeof AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL;
  /** Task law the run was produced under. */
  taskId: string;
  /** Digest of the exact validated task law the run was produced under. */
  taskDigest: AutoMovieContentDigest;
  /** Every version the run is comparable within. */
  versions: IAutoMovieBenchmarkVersions;
  /** Digest of the exact brief bytes the candidate received. */
  briefDigest: AutoMovieContentDigest;
  /** Surface the candidate drove. */
  surface: AutoMovieBenchmarkSurface;
  /** Packaged repository state. */
  repository: IAutoMovieBenchmarkRepository;
  /** External client identity. */
  client: IAutoMovieBenchmarkClient;
  /** Observed MCP handshake and inventory. */
  mcp: IAutoMovieBenchmarkMcpSession;
  /** Digest of the complete transcript and tool-result stream. */
  transcriptDigest: AutoMovieContentDigest;
  /** Every source edit the run made. */
  edits: IAutoMovieBenchmarkSourceEdit[];
  /** Digest of the final project tree. */
  treeDigest: AutoMovieContentDigest;
  /** Reported lifecycle gates, in any order. */
  lifecycle: IAutoMovieBenchmarkGateResult[];
  /** Direct finite observations keyed by the task law's observation names. */
  observations: Record<string, number>;
  /** Every actual captured frame. */
  frames: IAutoMovieBenchmarkCapturedFrame[];
  /** Every published deliverable file. */
  deliverables: IAutoMovieBenchmarkDeliveredFile[];
  /** Non-negative finite runtime, or `null` when no feature was published. */
  finishedRuntimeSeconds: number | null;
  /** Candidate generation health. */
  generation: IAutoMovieBenchmarkGenerationHealth;
  /** Machine identity. */
  runtime: IAutoMovieBenchmarkRuntime;
  /** Infrastructure failure that removes the run from the denominator. */
  incident: IAutoMovieBenchmarkInfraIncident | null;
}

/** One sealed archived run with its content-addressed identity. */
export interface IAutoMovieBenchmarkSubmission extends IAutoMovieBenchmarkSubmissionDraft {
  /** Digest of the complete canonical draft. */
  runId: AutoMovieContentDigest;
}

/** Recursively freeze one archived value and everything it owns. */
const freezeDeep = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  for (const item of Object.values(value as Record<string, unknown>))
    freezeDeep(item);
  return Object.freeze(value);
};

/** One named numeric claim extracted from an otherwise valid archive shape. */
type AutoMovieBenchmarkNumericClaim = readonly [label: string, value: number];

/** Refuse the first numeric claim outside the physical domain it describes. */
const assertNumericClaims = (
  draft: IAutoMovieBenchmarkSubmissionDraft,
): void => {
  const assertClaims = (
    claims: readonly AutoMovieBenchmarkNumericClaim[],
    valid: (value: number) => boolean,
    expected: string,
  ): void => {
    const invalid = claims.find(([, value]) => valid(value) === false);
    if (invalid !== undefined)
      throw new Error(
        `Invalid AutoMovie benchmark submission: ${invalid[0]} is ${String(invalid[1])}; expected ${expected}.`,
      );
  };
  assertClaims(
    [["client seed", draft.client.seed]],
    Number.isSafeInteger,
    "a safe integer",
  );
  assertClaims(
    draft.repository.artifacts.map(
      (artifact) =>
        [`artifact "${artifact.name}" byte count`, artifact.bytes] as const,
    ),
    (value) => Number.isSafeInteger(value) && value > 0,
    "a positive safe integer",
  );
  assertClaims(
    [
      ...draft.mcp.tools.flatMap((tool) => [
        [
          `MCP tool "${tool.name}" description byte count`,
          tool.descriptionBytes,
        ] as const,
        [
          `MCP tool "${tool.name}" schema byte count`,
          tool.schemaBytes,
        ] as const,
      ]),
      ...draft.frames.flatMap((frame) => [
        [`frame "${frame.shot}" width`, frame.width] as const,
        [`frame "${frame.shot}" height`, frame.height] as const,
        [`frame "${frame.shot}" byte count`, frame.bytes] as const,
      ]),
      ...draft.deliverables.map(
        (file) =>
          [`deliverable "${file.deliverable}" byte count`, file.bytes] as const,
      ),
      ["scenario-helper revision", draft.versions.scenarioHelper] as const,
      ["generation tool-call count", draft.generation.toolCalls] as const,
      ["generation correction count", draft.generation.corrections] as const,
      ["generation input-token count", draft.generation.inputTokens] as const,
      ["generation output-token count", draft.generation.outputTokens] as const,
    ],
    (value) => Number.isSafeInteger(value) && value >= 0,
    "a non-negative safe integer",
  );
  assertClaims(
    Object.entries(draft.observations).map(
      ([observation, value]) =>
        [`observation "${observation}"`, value] as const,
    ),
    Number.isFinite,
    "a finite number",
  );
  assertClaims(
    [
      ...draft.frames.map(
        (frame) =>
          [`frame "${frame.shot}" sample time`, frame.timeSeconds] as const,
      ),
      ...draft.deliverables
        .filter((file) => file.durationSeconds !== null)
        .map(
          (file) =>
            [
              `deliverable "${file.deliverable}" duration`,
              file.durationSeconds!,
            ] as const,
        ),
      ...(draft.finishedRuntimeSeconds === null
        ? []
        : ([["finished runtime", draft.finishedRuntimeSeconds]] as const)),
      ["generation cost", draft.generation.costUsd] as const,
      ["generation elapsed time", draft.generation.elapsedSeconds] as const,
    ],
    (value) => Number.isFinite(value) && value >= 0,
    "a non-negative finite number",
  );
};

/**
 * Validate one archived run, resolve its lifecycle, and seal it.
 *
 * Sealing is what makes a submission evidence rather than a working document:
 * the run id is the digest of everything the archive claims, and the returned
 * object is frozen through, so a scorer that tries to repair a submission fails
 * loudly instead of quietly rescoring its own edit.
 */
export const sealAutoMovieBenchmarkSubmission = (
  draft: IAutoMovieBenchmarkSubmissionDraft,
): IAutoMovieBenchmarkSubmission => {
  const validation =
    typia.validateEquals<IAutoMovieBenchmarkSubmissionDraft>(draft);
  if (validation.success === false)
    throw new Error(
      `Invalid AutoMovie benchmark submission: ${validation.errors
        .map((error) => `${error.path} expects ${error.expected}`)
        .join("; ")}.`,
    );
  assertNumericClaims(draft);
  const sealed: IAutoMovieBenchmarkSubmissionDraft = {
    ...draft,
    lifecycle: resolveAutoMovieBenchmarkLifecycle(draft.lifecycle),
  };
  return freezeDeep({
    ...sealed,
    runId: digestBenchmarkValue(sealed),
  });
};

/**
 * Revalidate a serialized archive before any public scorer consumes it.
 *
 * Object freezing protects the in-memory value returned by sealing, but an
 * archive necessarily loses that runtime property when serialized. Shape,
 * physical numeric claims, canonical lifecycle order, and the content-addressed
 * run id therefore have to be proven again at every scoring boundary.
 */
const assertAutoMovieBenchmarkSubmissionIntegrity = (
  submission: IAutoMovieBenchmarkSubmission,
): void => {
  const validation =
    typia.validateEquals<IAutoMovieBenchmarkSubmission>(submission);
  if (validation.success === false)
    throw new Error(
      `Invalid sealed AutoMovie benchmark submission: ${validation.errors
        .map((error) => `${error.path} expects ${error.expected}`)
        .join("; ")}.`,
    );
  const { runId, ...draft } = validation.data;
  assertNumericClaims(draft);
  const canonicalLifecycle = resolveAutoMovieBenchmarkLifecycle(
    draft.lifecycle,
  );
  if (
    digestBenchmarkValue(canonicalLifecycle) !==
    digestBenchmarkValue(draft.lifecycle)
  )
    throw new Error(
      `Submission ${runId} does not carry the canonical lifecycle order. Seal the original archive again instead of rescoring edited evidence.`,
    );
  const expected = digestBenchmarkValue(draft);
  if (runId !== expected)
    throw new Error(
      `Submission ${runId} does not match its archived evidence digest ${expected}. Restore the sealed archive or rerun the task.`,
    );
};

/**
 * Refuse a submission that was not produced under the given task law.
 *
 * A verdict that reads one law against evidence produced under another is not a
 * weaker verdict, it is a different question answered by accident, so the
 * mismatch is named field by field before any assertion runs.
 */
export const assertAutoMovieBenchmarkBinding = (
  task: IAutoMovieBenchmarkTask,
  submission: IAutoMovieBenchmarkSubmission,
): void => {
  assertAutoMovieBenchmarkSubmissionIntegrity(submission);
  if (submission.taskId !== task.taskId)
    throw new Error(
      `Submission ${submission.runId} was produced for task "${submission.taskId}", not "${task.taskId}".`,
    );
  if (submission.briefDigest !== task.brief.digest)
    throw new Error(
      `Submission ${submission.runId} received brief ${submission.briefDigest}, but task "${task.taskId}" fixes ${task.brief.digest}.`,
    );
  const drift = (
    [
      ["task", submission.versions.task, task.versions.task],
      ["harness", submission.versions.harness, task.versions.harness],
      ["reference", submission.versions.reference, task.versions.reference],
      [
        "scenarioHelper",
        submission.versions.scenarioHelper,
        task.versions.scenarioHelper,
      ],
    ] as const
  ).filter(([, submitted, required]) => submitted !== required);
  if (drift.length !== 0)
    throw new Error(
      `Submission ${submission.runId} declares ${drift
        .map(
          ([field, submitted, required]) =>
            `${field} ${String(submitted)} against ${String(required)}`,
        )
        .join("; ")}. Rerun under the current task law instead of rescoring.`,
    );
  const taskDigest = validateAutoMovieBenchmarkTask(task);
  if (submission.taskDigest !== taskDigest)
    throw new Error(
      `Submission ${submission.runId} was produced under task law ${submission.taskDigest}, but task "${task.taskId}" validates as ${taskDigest}. Raise the task version and rerun instead of rescoring old evidence.`,
    );
};

/**
 * Refuse a comparison whose surfaces did not receive the same conditions.
 *
 * Everything but the surface id and the calls the surface itself requires is
 * held equal, so a capability difference has to show up in the result rather
 * than in the setup.
 */
export const benchmarkComparisonDrift = (
  left: IAutoMovieBenchmarkSubmission,
  right: IAutoMovieBenchmarkSubmission,
): string[] => {
  assertAutoMovieBenchmarkSubmissionIntegrity(left);
  assertAutoMovieBenchmarkSubmissionIntegrity(right);
  const fields = (
    [
      ["taskId", left.taskId, right.taskId],
      ["taskDigest", left.taskDigest, right.taskDigest],
      ["taskVersion", left.versions.task, right.versions.task],
      ["harnessVersion", left.versions.harness, right.versions.harness],
      ["referenceVersion", left.versions.reference, right.versions.reference],
      [
        "scenarioHelper",
        left.versions.scenarioHelper,
        right.versions.scenarioHelper,
      ],
      ["briefDigest", left.briefDigest, right.briefDigest],
      ["commit", left.repository.commit, right.repository.commit],
      ["dirty", left.repository.dirty, right.repository.dirty],
      [
        "artifacts",
        digestBenchmarkValue(left.repository.artifacts),
        digestBenchmarkValue(right.repository.artifacts),
      ],
      ["client", left.client.client, right.client.client],
      ["agent", left.client.agent, right.client.agent],
      ["model", left.client.model, right.client.model],
      ["effort", left.client.effort, right.client.effort],
      ["seed", left.client.seed, right.client.seed],
      ["configDigest", left.client.configDigest, right.client.configDigest],
      ["runtimeOs", left.runtime.os, right.runtime.os],
      ["runtimeArch", left.runtime.arch, right.runtime.arch],
      ["toolchain", left.runtime.toolchain, right.runtime.toolchain],
      ["captureRuntime", left.runtime.capture, right.runtime.capture],
    ] as const
  )
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => `${field}: ${String(from)} vs ${String(to)}`);
  return left.surface === right.surface
    ? [`surface: both submissions drove ${left.surface}`, ...fields]
    : fields;
};
