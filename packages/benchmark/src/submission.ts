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
  /** Positive tarball byte count. */
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
  /** Integer seed handed to the client. */
  seed: number;
  /** Digest of the complete client configuration. */
  configDigest: AutoMovieContentDigest;
}

/** One advertised MCP tool and the schema budget it consumed. */
export interface IAutoMovieBenchmarkToolInventory {
  /** Advertised tool name. */
  name: string;
  /** Byte length of the advertised description. */
  descriptionBytes: number;
  /** Byte length of the advertised input schema. */
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
  /** Exact shot-local capture time in seconds. */
  timeSeconds: number;
  /** Pass the frame was captured through. */
  pass: AutoMovieGuidePass;
  /** Exact captured raster width. */
  width: number;
  /** Exact captured raster height. */
  height: number;
  /** Resident PNG byte count. */
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
  /** Resident byte count. */
  bytes: number;
  /** Digest of the resident bytes. */
  digest: AutoMovieContentDigest;
  /** Parsed runtime in seconds, or `null` for a still or text deliverable. */
  durationSeconds: number | null;
  /** Whether the media parser accepted the resident bytes. */
  probeValid: boolean;
}

/** Candidate generation health, never blended into the film score. */
export interface IAutoMovieBenchmarkGenerationHealth {
  /** Tool calls the candidate issued. */
  toolCalls: number;
  /** Correction rounds the candidate spent on its own output. */
  corrections: number;
  /** Candidate cost in US dollars. */
  costUsd: number;
  /** Wall-clock run time in seconds. */
  elapsedSeconds: number;
  /** Input tokens consumed. */
  inputTokens: number;
  /** Output tokens produced. */
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
  /** Direct numeric observations keyed by the task law's observation names. */
  observations: Record<string, number>;
  /** Every actual captured frame. */
  frames: IAutoMovieBenchmarkCapturedFrame[];
  /** Every published deliverable file. */
  deliverables: IAutoMovieBenchmarkDeliveredFile[];
  /** Parsed finished runtime, or `null` when no feature was published. */
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
  const fields = (
    [
      ["taskId", left.taskId, right.taskId],
      ["briefDigest", left.briefDigest, right.briefDigest],
      ["commit", left.repository.commit, right.repository.commit],
      ["client", left.client.client, right.client.client],
      ["model", left.client.model, right.client.model],
      ["effort", left.client.effort, right.client.effort],
      ["seed", left.client.seed, right.client.seed],
      ["configDigest", left.client.configDigest, right.client.configDigest],
    ] as const
  )
    .filter(([, from, to]) => from !== to)
    .map(([field, from, to]) => `${field}: ${String(from)} vs ${String(to)}`);
  return left.surface === right.surface
    ? [`surface: both submissions drove ${left.surface}`, ...fields]
    : fields;
};
