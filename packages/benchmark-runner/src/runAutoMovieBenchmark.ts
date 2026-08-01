import {
  AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL,
  AutoMovieBenchmarkGate,
  AutoMovieBenchmarkLane,
  IAutoMovieBenchmarkCapturedFrame,
  IAutoMovieBenchmarkClient,
  IAutoMovieBenchmarkDeliveredFile,
  IAutoMovieBenchmarkGateResult,
  IAutoMovieBenchmarkGenerationHealth,
  IAutoMovieBenchmarkInfraIncident,
  IAutoMovieBenchmarkMcpSession,
  IAutoMovieBenchmarkRepaintEvidence,
  IAutoMovieBenchmarkRepository,
  IAutoMovieBenchmarkRuntime,
  IAutoMovieBenchmarkScenario,
  IAutoMovieBenchmarkSourceEdit,
  IAutoMovieBenchmarkToolInventoryReport,
  IAutoMovieBenchmarkTraceEvent,
  IAutoMovieBenchmarkVerdict,
  appendAutoMovieBenchmarkTrace,
  compareBenchmarkCodeUnits,
  digestAutoMovieBenchmarkBytes,
  digestBenchmarkValue,
  getAutoMovieBenchmarkScenario,
  judgeAutoMovieBenchmarkSubmission,
  replayAutoMovieBenchmarkTrace,
  reportAutoMovieBenchmark,
  reportAutoMovieBenchmarkToolInventory,
  sealAutoMovieBenchmarkSubmission,
  validateAutoMovieBenchmarkTask,
} from "@automovie/benchmark";
import type { IAutoMovieRepaintRuntimeIdentity } from "@automovie/interface";
import {
  canonicalAutoMovieRepaintRuntimeIdentity,
  probeProductionMedia,
  readAutoMovieProductionOwnedFile,
} from "@automovie/mcp";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  IAutoMovieBenchmarkMcpProbeContext,
  IAutoMovieBenchmarkMcpTarget,
} from "./probeAutoMovieBenchmarkMcp";

const BENCHMARK_WORKSPACE_MARKER = `/**
 * Runner-owned workspace marker. Replace it during benchmark project bootstrap.
 */
export {};
`;

/** Candidate workspace and immutable law handed to an external agent. */
export interface IAutoMovieBenchmarkAgentContext {
  /** Registered scenario selected by exact id. */
  scenario: IAutoMovieBenchmarkScenario;
  /** Selected deterministic or optional repaint lane. */
  lane: AutoMovieBenchmarkLane;
  /** Candidate-writable workspace isolated from archive staging. */
  project: string;
  /** Candidate copy of the task law inside `project`. */
  taskPath: string;
  /** Candidate copy of the exact scenario brief inside `project`. */
  briefPath: string;
}

/** Process transcript and non-scoring usage telemetry observed by the adapter. */
export interface IAutoMovieBenchmarkAgentResult {
  /** Exact client stdout or structured transcript. */
  stdout: string;
  /** Exact client stderr. */
  stderr: string;
  /** Usage/cost health reported beside, never blended into, film quality. */
  generation: IAutoMovieBenchmarkGenerationHealth;
}

/** External candidate boundary; tests replace it with an in-memory adapter. */
export type AutoMovieBenchmarkAgent = (
  context: IAutoMovieBenchmarkAgentContext,
) => Promise<IAutoMovieBenchmarkAgentResult>;

/** One actual frame path found by a trusted post-run collector. */
export interface IAutoMovieBenchmarkCollectedFrame {
  /** Candidate-project-relative resident PNG path. */
  file: string;
  /** Compiler-owned shot id. */
  shot: string;
  /** Exact shot-local capture time in seconds. */
  timeSeconds: number;
  /** Captured guide pass. */
  pass: IAutoMovieBenchmarkCapturedFrame["pass"];
}

/** One actual deliverable path found by a trusted post-run collector. */
export interface IAutoMovieBenchmarkCollectedDeliverable {
  /** Candidate-project-relative resident output path. */
  file: string;
  /** Deliverable id that owns the file. */
  deliverable: string;
  /** Declared output class. */
  kind: IAutoMovieBenchmarkDeliveredFile["kind"];
  /** Declared media type checked by the runner-owned parser. */
  mediaType: string;
  /** Timeline duration when the parser cannot derive one, otherwise null. */
  durationSeconds: number | null;
}

/** Trace events a trusted collector can derive from execution receipts. */
type WithoutTraceHeader<T> = T extends unknown
  ? Omit<T, "sequence" | "atMs">
  : never;

export type AutoMovieBenchmarkCollectedTraceEvent = WithoutTraceHeader<
  Extract<
    IAutoMovieBenchmarkTraceEvent,
    { kind: "mcp-call" | "compile" | "review" }
  >
>;

/** Runner-owned evidence returned after inspecting the actual project. */
export interface IAutoMovieBenchmarkCollectedEvidence {
  /** Lifecycle outcomes derived from package/compiler/review/render receipts. */
  lifecycle: IAutoMovieBenchmarkGateResult[];
  /** Scenario observations derived from generated state, never agent prose. */
  observations: Record<string, number>;
  /** Resident captured PNGs. */
  frames: IAutoMovieBenchmarkCollectedFrame[];
  /** Resident final output files. */
  deliverables: IAutoMovieBenchmarkCollectedDeliverable[];
  /** Finished feature runtime, or null before publication. */
  finishedRuntimeSeconds: number | null;
  /** Direct receipt observations not otherwise synthesized by the runner. */
  trace: AutoMovieBenchmarkCollectedTraceEvent[];
  /** Trusted repaint receipt/review evidence for the optional lane. */
  repaint?: Extract<
    IAutoMovieBenchmarkRepaintEvidence,
    { status: "not-produced" | "verified" }
  >;
}

/** Read-only context handed to the trusted evidence collector. */
export interface IAutoMovieBenchmarkCollectorContext {
  /** Registered scenario and selected lane. */
  scenario: IAutoMovieBenchmarkScenario;
  /** Selected visual-delivery lane. */
  lane: AutoMovieBenchmarkLane;
  /** Candidate project after the external process exited. */
  project: string;
  /** Runner-observed current MCP handshake. */
  mcp: IAutoMovieBenchmarkMcpSession;
  /** Exact client transcripts. */
  stdout: string;
  stderr: string;
  /** Host-owned repaint runtime identity, present only for that lane. */
  repaintRuntime?: IAutoMovieRepaintRuntimeIdentity;
}

/**
 * Host-side collector; it must inspect receipts instead of reading agent
 * claims.
 */
export type AutoMovieBenchmarkCollector = (
  context: IAutoMovieBenchmarkCollectorContext,
) => Promise<IAutoMovieBenchmarkCollectedEvidence>;

/** Fixed identity supplied by the host, not the candidate process. */
export interface IAutoMovieBenchmarkRunIdentity {
  /** Exact packaged repository/artifact identity under test. */
  repository: IAutoMovieBenchmarkRepository;
  /** External client/model configuration held across compared surfaces. */
  client: IAutoMovieBenchmarkClient;
  /** Host and deterministic capture runtime. */
  runtime: IAutoMovieBenchmarkRuntime;
}

/** Input for one content-addressed benchmark execution. */
export interface IAutoMovieBenchmarkRunInput {
  /** Exact registered scenario id. */
  taskId: string;
  /** Deterministic baseline or optional repaint experiment. */
  lane: AutoMovieBenchmarkLane;
  /** Stable portable campaign directory segment. */
  campaign: string;
  /** Root that will own `.benchmarks`, outside `repositoryRoot`. */
  runRoot: string;
  /** Source repository boundary the runner must not enter. */
  repositoryRoot: string;
  /** Host-owned candidate identity. */
  identity: IAutoMovieBenchmarkRunIdentity;
  /** Current surface measured by a real runner-owned MCP probe. */
  mcpTarget: IAutoMovieBenchmarkMcpTarget;
  /** Optional measured retired/comparison surfaces. */
  inventoryBaselines?: readonly IAutoMovieBenchmarkMcpTarget[];
  /** Structured host-owned repaint runtime available to the optional lane. */
  repaintRuntime?: IAutoMovieRepaintRuntimeIdentity;
  /** External agent/process adapter. */
  agent: AutoMovieBenchmarkAgent;
  /** Trusted receipt collector invoked only after the agent exits. */
  collect: AutoMovieBenchmarkCollector;
}

/** Published run identities and deterministic reports. */
export interface IAutoMovieBenchmarkRunOutput {
  /** Content-addressed archive directory. */
  archive: string;
  /** Final taxonomy verdict. */
  verdict: IAutoMovieBenchmarkVerdict;
  /** Aggregate report containing this verdict. */
  report: ReturnType<typeof reportAutoMovieBenchmark>;
  /** Current/retired tool inventory comparison. */
  toolInventory: IAutoMovieBenchmarkToolInventoryReport;
}

/** One runner-observed project-tree entry bound into the sealed submission. */
export type IAutoMovieBenchmarkProjectTreeEntry =
  | {
      /** Resident regular file. */
      kind: "file";
      /** Project-relative slash-normalized path. */
      path: string;
      /** Exact byte count. */
      bytes: number;
      /** Exact resident-byte digest. */
      digest: `sha256:${string}`;
    }
  | {
      /** Unfollowed symbolic link or junction. */
      kind: "link";
      /** Project-relative slash-normalized path. */
      path: string;
      /** Exact link text recorded without following it. */
      target: string;
    };

/** Runner-owned project snapshot stored beside the sealed submission. */
export interface IAutoMovieBenchmarkProjectTree {
  /** Stable path-ordered project entries. */
  entries: IAutoMovieBenchmarkProjectTreeEntry[];
  /** Canonical digest of `entries`. */
  digest: `sha256:${string}`;
}

/** Configuration for a prompt-on-stdin external-agent process. */
export interface IAutoMovieBenchmarkProcessAgentInput {
  /** Executable, resolved by the host environment. */
  command: string;
  /** Fixed arguments placed before the scenario prompt on stdin. */
  args?: readonly string[];
  /** Additional non-secret environment variables. */
  env?: Readonly<Record<string, string>>;
  /** Hard process fence in milliseconds. */
  timeoutMs: number;
  /** Optional trusted usage telemetry parser for provider output. */
  generation?: (
    stdout: string,
    stderr: string,
    elapsedSeconds: number,
  ) => IAutoMovieBenchmarkGenerationHealth;
}

/** Runner-owned infrastructure error carrying whatever transcript exists. */
export class AutoMovieBenchmarkInfrastructureError extends Error {
  public constructor(
    public readonly incident: IAutoMovieBenchmarkInfraIncident,
    public readonly stdout = "",
    public readonly stderr = "",
  ) {
    super(incident.detail);
  }
}

/** Candidate process failure that remains in the benchmark denominator. */
export class AutoMovieBenchmarkCandidateError extends Error {
  public constructor(
    detail: string,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly generation: IAutoMovieBenchmarkGenerationHealth,
  ) {
    super(detail);
  }
}

/**
 * Adapt a Codex, Claude, or another prompt-on-stdin agent process.
 *
 * The exact brief is sent on stdin and its task/brief copies are available in
 * the candidate workspace. The process cannot write a submission or see the
 * runner-owned archive staging area; evidence is collected after it exits.
 */
export const createProcessAutoMovieBenchmarkAgent = (
  input: IAutoMovieBenchmarkProcessAgentInput,
): AutoMovieBenchmarkAgent => {
  if (
    input.command.trim().length === 0 ||
    Number.isSafeInteger(input.timeoutMs) === false ||
    input.timeoutMs <= 0
  )
    throw new Error(
      "Benchmark process agent needs a non-blank command and positive safe-integer timeoutMs.",
    );
  return async (context) => {
    const started = performance.now();
    const child = spawnSync(input.command, [...(input.args ?? [])], {
      cwd: context.project,
      encoding: "utf8",
      input: context.scenario.brief,
      maxBuffer: 64 * 1024 * 1024,
      timeout: input.timeoutMs,
      env: {
        ...process.env,
        ...input.env,
        AUTOMOVIE_BENCHMARK_TASK_ID: context.scenario.taskId,
        AUTOMOVIE_BENCHMARK_LANE: context.lane,
        AUTOMOVIE_BENCHMARK_PROJECT_ROOT: context.project,
        AUTOMOVIE_BENCHMARK_TASK_PATH: context.taskPath,
        AUTOMOVIE_BENCHMARK_BRIEF_PATH: context.briefPath,
      },
    });
    const stdout = child.stdout ?? "";
    const stderr = child.stderr ?? "";
    if (child.error !== undefined)
      throw new AutoMovieBenchmarkInfrastructureError(
        {
          kind:
            (child.error as NodeJS.ErrnoException).code === "ETIMEDOUT"
              ? "runner-interrupted"
              : "harness-error",
          gate: "project-bootstrap",
          detail: `External benchmark agent could not complete: ${child.error.message}`,
        },
        stdout,
        stderr,
      );
    const elapsedSeconds = (performance.now() - started) / 1_000;
    if (child.status !== 0) {
      const detail = `External benchmark agent exited ${String(
        child.status,
      )} (signal ${String(child.signal)}).`;
      const generation =
        input.generation?.(stdout, stderr, elapsedSeconds) ??
        emptyGeneration(elapsedSeconds);
      assertAgentResult({ stdout, stderr, generation });
      throw new AutoMovieBenchmarkCandidateError(
        detail,
        stdout,
        stderr,
        generation,
      );
    }
    return {
      stdout,
      stderr,
      generation:
        input.generation?.(stdout, stderr, elapsedSeconds) ??
        emptyGeneration(elapsedSeconds),
    };
  };
};

/** Snapshot one candidate project without following any resident link. */
export const snapshotAutoMovieBenchmarkProject = (
  project: string,
): IAutoMovieBenchmarkProjectTree => {
  const identity = directoryIdentity(project, "benchmark project");
  const root = identity.real;
  const entries: IAutoMovieBenchmarkProjectTreeEntry[] = [];
  const visit = (directory: string): void => {
    for (const name of fs
      .readdirSync(directory)
      .sort(compareBenchmarkCodeUnits)) {
      const absolute = path.join(directory, name);
      const relative = slash(path.relative(root, absolute));
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink())
        entries.push({
          kind: "link",
          path: relative,
          target: slash(fs.readlinkSync(absolute)),
        });
      else if (stat.isDirectory()) visit(absolute);
      else {
        /* c8 ignore start -- sockets/devices are not portable test fixtures */
        if (stat.isFile() === false)
          throw new Error(
            `Benchmark project entry "${relative}" is not a regular file, directory, or unfollowed link.`,
          );
        /* c8 ignore stop */
        const bytes = readAutoMovieProductionOwnedFile({
          root,
          directory: path.dirname(absolute),
          relative: path.basename(absolute),
        });
        entries.push({
          kind: "file",
          path: relative,
          bytes: bytes.length,
          digest: digestAutoMovieBenchmarkBytes(bytes),
        });
      }
    }
  };
  visit(root);
  assertDirectoryIdentity(identity, "benchmark project");
  return { entries, digest: digestBenchmarkValue(entries) };
};

/** Run one registered scenario, archive direct evidence, and judge it. */
export const runAutoMovieBenchmark = async (
  input: IAutoMovieBenchmarkRunInput,
): Promise<IAutoMovieBenchmarkRunOutput> => {
  assertCampaign(input.campaign);
  const scenario = getAutoMovieBenchmarkScenario(input.taskId);
  if (scenario.lanes.includes(input.lane) === false)
    throw new Error(
      `Benchmark scenario "${scenario.taskId}" does not support lane "${input.lane}". Choose one of: ${scenario.lanes.join(", ")}.`,
    );
  const repaintAdapterIdentity =
    input.repaintRuntime === undefined
      ? undefined
      : canonicalAutoMovieRepaintRuntimeIdentity(input.repaintRuntime);
  const task = scenario.task();
  const taskDigest = validateAutoMovieBenchmarkTask(task);
  const mcpTargets = [input.mcpTarget, ...(input.inventoryBaselines ?? [])];
  assertMcpTargets(mcpTargets);
  const repository = directoryIdentity(
    path.resolve(input.repositoryRoot),
    "source repository",
  );
  const requestedRunRoot = path.resolve(input.runRoot);
  if (inside(repository.real, requestedRunRoot))
    throw new Error(
      `Benchmark run root "${requestedRunRoot}" is inside source repository "${repository.real}". Choose an external workspace root.`,
    );
  fs.mkdirSync(requestedRunRoot, { recursive: true });
  const runRoot = directoryIdentity(requestedRunRoot, "benchmark run root");
  assertOutside(repository.real, runRoot.real, "benchmark run root");
  const benchmarkRoot = secureChildDirectory(
    runRoot,
    ".benchmarks",
    repository.real,
  );
  const campaignRoot = secureChildDirectory(
    benchmarkRoot,
    input.campaign,
    repository.real,
  );
  const work = secureTemporaryDirectory(
    campaignRoot,
    ".work-",
    repository.real,
  );
  const pending = secureTemporaryDirectory(
    campaignRoot,
    ".pending-",
    repository.real,
  );
  const project = secureChildDirectory(work, "project", repository.real);
  const candidateInput = secureChildDirectory(
    project,
    ".automovie-benchmark",
    repository.real,
  );
  const taskText = `${JSON.stringify(task, null, 2)}\n`;
  const taskPath = path.join(candidateInput.real, "task.json");
  const briefPath = path.join(candidateInput.real, "brief.md");
  fs.writeFileSync(taskPath, taskText);
  fs.writeFileSync(briefPath, scenario.brief);
  fs.writeFileSync(
    path.join(project.real, "automovie.config.ts"),
    BENCHMARK_WORKSPACE_MARKER,
    { flag: "wx" },
  );
  const before = snapshotAutoMovieBenchmarkProject(project.real);

  const traceRoot = secureChildDirectory(pending, "trace", repository.real);
  const trace = new AutoMovieBenchmarkTraceWriter(
    path.join(traceRoot.real, "oracle.jsonl.gz"),
  );
  const executionId = digestBenchmarkValue({
    taskId: scenario.taskId,
    lane: input.lane,
    campaign: input.campaign,
    attempt: path.basename(pending.real),
  });
  trace.append({
    kind: "run-start",
    executionId,
    taskId: scenario.taskId,
    surface: input.mcpTarget.surface,
    lane: input.lane,
  });

  let incident: IAutoMovieBenchmarkInfraIncident | null =
    input.lane === "repaint" && input.repaintRuntime === undefined
      ? {
          kind: "repaint-adapter-unavailable",
          gate: "capture-runtime",
          detail:
            "The optional repaint lane has no host-owned repaint adapter. Configure that capability or run the deterministic lane.",
        }
      : null;
  let result: IAutoMovieBenchmarkAgentResult = {
    stdout: "",
    stderr: "",
    generation: emptyGeneration(0),
  };
  let evidence = emptyEvidence();
  const inventory = await observeMcpTargets(mcpTargets, {
    scenario,
    project: project.real,
  });
  const currentObservation = inventory.find(
    (entry) =>
      entry.surface === input.mcpTarget.surface &&
      entry.provenance === input.mcpTarget.provenance,
  )!;
  if (currentObservation.session === null) {
    if (incident === null)
      incident = {
        kind: "harness-error",
        gate: "mcp-handshake",
        detail: currentObservation.error!,
      };
    trace.append({
      kind: "gate",
      gate: "mcp-handshake",
      status: "fail",
      detail: currentObservation.error!,
    });
  } else
    trace.append({
      kind: "gate",
      gate: "mcp-handshake",
      status: "pass",
      detail: `Runner measured ${currentObservation.session.tools.length} advertised tools.`,
    });
  const failedComparison = inventory.find(
    (entry) => entry.session === null && entry !== currentObservation,
  );
  if (incident === null && failedComparison !== undefined)
    incident = {
      kind: "harness-error",
      gate: "mcp-handshake",
      detail: `Comparison MCP target "${failedComparison.provenance}" failed: ${failedComparison.error}`,
    };

  if (incident === null) {
    try {
      result = await input.agent({
        scenario,
        lane: input.lane,
        project: project.real,
        taskPath,
        briefPath,
      });
      assertAgentResult(result);
    } catch (error) {
      if (error instanceof AutoMovieBenchmarkCandidateError) {
        result = {
          stdout: error.stdout,
          stderr: error.stderr,
          generation: error.generation,
        };
        evidence = candidateFailureEvidence(error.message);
      } else if (error instanceof AutoMovieBenchmarkInfrastructureError) {
        incident = error.incident;
        result = {
          stdout: error.stdout,
          stderr: error.stderr,
          generation: emptyGeneration(
            (performance.now() - trace.startedAt) / 1_000,
          ),
        };
      } else
        incident = {
          kind: "harness-error",
          gate: "project-bootstrap",
          detail: `External benchmark agent adapter failed: ${messageOf(error)}`,
        };
    }
  }

  if (
    incident === null &&
    evidence.lifecycle.some(
      (gate) => gate.gate === "project-bootstrap" && gate.status === "fail",
    ) === false
  )
    try {
      evidence = await input.collect({
        scenario,
        lane: input.lane,
        project: project.real,
        mcp: currentObservation.session!,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(input.repaintRuntime === undefined
          ? {}
          : { repaintRuntime: structuredClone(input.repaintRuntime) }),
      });
      assertCollectedEvidence(evidence);
      if (
        evidence.repaint !== undefined &&
        repaintAdapterIdentity !== undefined &&
        evidence.repaint.adapterIdentity !== repaintAdapterIdentity
      )
        throw new Error(
          "Collected repaint evidence cites a different adapter than the host runtime.",
        );
      for (const event of evidence.trace) trace.append(event);
    } catch (error) {
      if (error instanceof AutoMovieBenchmarkInfrastructureError) {
        incident = error.incident;
        evidence = emptyEvidence();
      } else
        evidence = candidateCollectionFailureEvidence(
          `Candidate receipts could not be collected: ${messageOf(error)}`,
        );
    }
  const staged = stageCandidateProject({
    work,
    project,
    pending,
    repositoryRoot: repository.real,
  });
  const stagedProject = staged.project;
  const projectTree = staged.tree;
  if (staged.failure !== null) {
    const failed = failCandidateGate(evidence, "final-compile", staged.failure);
    evidence = { ...emptyEvidence(), lifecycle: failed.lifecycle };
  }
  const edits = diffProjectTrees(before, projectTree);

  const evidenceRoot = secureChildDirectory(
    pending,
    "evidence",
    repository.real,
  );
  let frames: IAutoMovieBenchmarkCapturedFrame[] = [];
  let deliverables: IAutoMovieBenchmarkDeliveredFile[] = [];
  try {
    frames = materializeFrames(
      stagedProject.real,
      evidenceRoot.real,
      evidence.frames,
    );
  } catch (error) {
    resetEvidenceDirectory(evidenceRoot, "frames");
    evidence = failCandidateGate(
      evidence,
      "required-frames",
      `Runner could not materialize candidate frame evidence: ${messageOf(error)}`,
    );
  }
  try {
    deliverables = materializeDeliverables(
      stagedProject.real,
      evidenceRoot.real,
      evidence.deliverables,
    );
  } catch (error) {
    resetEvidenceDirectory(evidenceRoot, "deliverables");
    evidence = failCandidateGate(
      evidence,
      "deliverable-render",
      `Runner could not materialize candidate deliverable evidence: ${messageOf(error)}`,
    );
  }
  for (const gate of evidence.lifecycle)
    if (gate.gate !== "mcp-handshake") trace.append({ kind: "gate", ...gate });
  for (const edit of edits) trace.append({ kind: "source-edit", ...edit });
  for (const frame of frames)
    trace.append({
      kind: "capture",
      shot: frame.shot,
      timeSeconds: frame.timeSeconds,
      pass: frame.pass,
      digest: frame.digest,
      bytes: frame.bytes,
    });
  for (const file of deliverables)
    trace.append({
      kind: "render",
      chunk: file.deliverable,
      probe: file.probeValid ? "valid" : "invalid",
      bytes: file.bytes,
    });
  if (incident !== null)
    trace.append({
      kind: "incident",
      incident: incident.kind,
      gate: incident.gate,
      detail: incident.detail,
    });

  fs.writeFileSync(path.join(pending.real, "task.json"), taskText);
  fs.writeFileSync(path.join(pending.real, "brief.md"), scenario.brief);
  const transcriptRoot = secureChildDirectory(
    pending,
    "transcript",
    repository.real,
  );
  fs.writeFileSync(path.join(transcriptRoot.real, "stdout.txt"), result.stdout);
  fs.writeFileSync(path.join(transcriptRoot.real, "stderr.txt"), result.stderr);
  const transcriptDigest = digestBenchmarkValue({
    stdout: result.stdout,
    stderr: result.stderr,
  });
  const inventoryDigest = digestBenchmarkValue(inventory);
  writeJson(path.join(pending.real, "tool-sessions.json"), inventory);
  const measuredSessions = inventory.flatMap((entry) =>
    entry.session === null
      ? []
      : [{ surface: entry.surface, mcp: entry.session }],
  );
  const toolInventory =
    measuredSessions.length === 0
      ? { surfaces: [], comparisons: [] }
      : reportAutoMovieBenchmarkToolInventory(measuredSessions);

  const currentMcp =
    currentObservation.session ?? unavailableMcpSession(currentObservation);
  const lifecycle = [
    ...evidence.lifecycle.filter((gate) => gate.gate !== "mcp-handshake"),
    {
      gate: "mcp-handshake" as const,
      status:
        currentObservation.session === null
          ? ("fail" as const)
          : ("pass" as const),
      detail:
        currentObservation.session === null
          ? currentObservation.error!
          : `Runner measured ${currentObservation.session.tools.length} advertised tools.`,
    },
  ];
  const submission = sealAutoMovieBenchmarkSubmission({
    protocolVersion: AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL,
    taskId: scenario.taskId,
    taskDigest,
    versions: structuredClone(task.versions),
    briefDigest: task.brief.digest,
    surface: input.mcpTarget.surface,
    lane: input.lane,
    repository: structuredClone(input.identity.repository),
    client: structuredClone(input.identity.client),
    mcp: currentMcp,
    transcriptDigest,
    inventoryDigest,
    edits,
    treeDigest: projectTree.digest,
    lifecycle,
    observations: structuredClone(evidence.observations),
    frames,
    deliverables,
    finishedRuntimeSeconds: evidence.finishedRuntimeSeconds,
    generation: {
      ...structuredClone(result.generation),
    },
    runtime: structuredClone(input.identity.runtime),
    repaint:
      input.lane === "deterministic"
        ? { status: "not-requested" }
        : input.repaintRuntime === undefined
          ? { status: "unavailable" }
          : (evidence.repaint ?? {
              status: "not-produced",
              adapterIdentity: repaintAdapterIdentity!,
            }),
    incident,
  });
  const verdict = judgeAutoMovieBenchmarkSubmission(task, submission);
  const report = reportAutoMovieBenchmark([verdict]);
  writeJson(path.join(pending.real, "project-tree.json"), projectTree);
  writeJson(path.join(pending.real, "submission.json"), submission);
  writeJson(path.join(pending.real, "verdict.json"), verdict);
  writeJson(path.join(pending.real, "report.json"), report);
  writeJson(path.join(pending.real, "tool-inventory.json"), toolInventory);
  if (verdict.outcome === "scored")
    for (const assertion of verdict.assertions)
      trace.append({
        kind: "assertion",
        assertion: assertion.id,
        outcome: assertion.outcome,
      });
  trace.append({
    kind: "verdict",
    outcome: verdict.outcome,
    filmScore: verdict.filmScore,
  });
  trace.append({ kind: "run-seal", runId: submission.runId });

  const archive = path.join(
    campaignRoot.real,
    submission.runId.slice("sha256:".length),
  );
  if (fs.existsSync(archive)) {
    tryRemoveTemporaryDirectory(pending, campaignRoot);
    tryRemoveTemporaryDirectory(work, campaignRoot);
    throw new Error(
      `Benchmark run ${submission.runId} is already archived at "${archive}". Content-addressed runs are immutable.`,
    );
  }
  const publication = moveArchiveStaging(
    pending,
    campaignRoot,
    repository.real,
  );
  assertArchiveIdentity({
    pending: publication,
    repositoryRoot: repository.real,
    taskText,
    brief: scenario.brief,
    projectTree,
    transcriptDigest,
    inventory,
    submission,
  });
  assertDirectoryIdentity(publication, "benchmark archive publication");
  assertDirectoryIdentity(campaignRoot, "benchmark campaign directory");
  fs.renameSync(publication.real, archive);
  let archived: IDirectoryIdentity;
  try {
    archived = movedDirectoryIdentity(publication, archive, "final archive");
  } catch (error) {
    quarantineRejectedArchive(archive, campaignRoot, repository.real, error);
  }
  assertOutside(repository.real, archived.real, "final archive");
  tryRemoveTemporaryDirectory(work, campaignRoot);
  return { archive, verdict, report, toolInventory };
};

interface IObservedMcpTarget {
  surface: IAutoMovieBenchmarkMcpTarget["surface"];
  provenance: string;
  session: IAutoMovieBenchmarkMcpSession | null;
  error: string | null;
}

const observeMcpTargets = async (
  targets: readonly IAutoMovieBenchmarkMcpTarget[],
  context: IAutoMovieBenchmarkMcpProbeContext,
): Promise<IObservedMcpTarget[]> => {
  const observations: IObservedMcpTarget[] = [];
  for (const target of targets) {
    try {
      const session = await target.probe(context);
      reportAutoMovieBenchmarkToolInventory([
        { surface: target.surface, mcp: session },
      ]);
      observations.push({
        surface: target.surface,
        provenance: target.provenance,
        session,
        error: null,
      });
    } catch (error) {
      observations.push({
        surface: target.surface,
        provenance: target.provenance,
        session: null,
        error: messageOf(error),
      });
    }
  }
  return observations;
};

const assertMcpTargets = (
  targets: readonly IAutoMovieBenchmarkMcpTarget[],
): void => {
  const duplicate = targets.find(
    (target, index) =>
      targets.findIndex((entry) => entry.surface === target.surface) !== index,
  );
  if (duplicate !== undefined)
    throw new Error(
      `Benchmark MCP targets repeat surface "${duplicate.surface}". Supply one measured target per surface.`,
    );
  for (const target of targets) {
    if (target.provenance.trim().length === 0)
      throw new Error(
        `Benchmark MCP target "${target.surface}" has blank provenance.`,
      );
  }
};

const unavailableMcpSession = (
  observation: IObservedMcpTarget,
): IAutoMovieBenchmarkMcpSession => ({
  protocolVersion: "unavailable",
  serverName: observation.provenance,
  serverVersion: "unavailable",
  tools: [],
});

const materializeFrames = (
  project: string,
  evidenceRoot: string,
  frames: readonly IAutoMovieBenchmarkCollectedFrame[],
): IAutoMovieBenchmarkCapturedFrame[] => {
  const root = path.join(evidenceRoot, "frames");
  fs.mkdirSync(root);
  return frames.map((frame, index) => {
    const bytes = readResidentFile(project, frame.file);
    const relative = `evidence/frames/${String(index).padStart(4, "0")}.png`;
    fs.writeFileSync(
      path.join(evidenceRoot, "frames", path.basename(relative)),
      bytes,
    );
    try {
      const probe = probeProductionMedia({
        kind: "preview",
        mediaType: "image/png",
        bytes,
      });
      if (probe.kind !== "png")
        throw new Error("PNG evidence returned a non-raster probe.");
      return {
        path: relative,
        shot: frame.shot,
        timeSeconds: frame.timeSeconds,
        pass: frame.pass,
        width: probe.width,
        height: probe.height,
        bytes: bytes.length,
        digest: digestAutoMovieBenchmarkBytes(bytes),
        probeValid: true,
      };
    } catch {
      return {
        path: relative,
        shot: frame.shot,
        timeSeconds: frame.timeSeconds,
        pass: frame.pass,
        width: 0,
        height: 0,
        bytes: bytes.length,
        digest: digestAutoMovieBenchmarkBytes(bytes),
        probeValid: false,
      };
    }
  });
};

const materializeDeliverables = (
  project: string,
  evidenceRoot: string,
  deliverables: readonly IAutoMovieBenchmarkCollectedDeliverable[],
): IAutoMovieBenchmarkDeliveredFile[] => {
  const root = path.join(evidenceRoot, "deliverables");
  fs.mkdirSync(root);
  return deliverables.map((file, index) => {
    const bytes = readResidentFile(project, file.file);
    const extension = path.extname(file.file).toLowerCase();
    const safeExtension = /^\.[a-z0-9]{1,8}$/.test(extension)
      ? extension
      : ".bin";
    const relative = `evidence/deliverables/${String(index).padStart(
      4,
      "0",
    )}${safeExtension}`;
    fs.writeFileSync(
      path.join(evidenceRoot, "deliverables", path.basename(relative)),
      bytes,
    );
    try {
      const probe = probeProductionMedia({
        kind: file.kind,
        mediaType: file.mediaType,
        bytes,
      });
      const parsedDuration =
        probe.kind === "video" || probe.kind === "audio"
          ? probe.runtimeSeconds
          : file.durationSeconds;
      return {
        path: relative,
        deliverable: file.deliverable,
        kind: file.kind,
        mediaType: file.mediaType,
        bytes: bytes.length,
        digest: digestAutoMovieBenchmarkBytes(bytes),
        durationSeconds: parsedDuration,
        probeValid: true,
      };
    } catch {
      return {
        path: relative,
        deliverable: file.deliverable,
        kind: file.kind,
        mediaType: file.mediaType,
        bytes: bytes.length,
        digest: digestAutoMovieBenchmarkBytes(bytes),
        durationSeconds: file.durationSeconds,
        probeValid: false,
      };
    }
  });
};

const readResidentFile = (root: string, relative: string): Buffer => {
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative.includes("\\") ||
    slash(relative)
      .split("/")
      .some(
        (segment) =>
          segment.length === 0 ||
          segment === "." ||
          segment === ".." ||
          segment.includes("\0"),
      )
  )
    throw new Error(
      `Benchmark evidence path "${relative}" is not project-relative.`,
    );
  const rootIdentity = directoryIdentity(root, "benchmark evidence project");
  const physicalRoot = rootIdentity.real;
  const absolute = path.resolve(physicalRoot, relative);
  if (inside(physicalRoot, absolute) === false)
    throw new Error(`Benchmark evidence path "${relative}" escapes project.`);
  let cursor = physicalRoot;
  for (const segment of path.relative(physicalRoot, absolute).split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (fs.lstatSync(cursor).isSymbolicLink())
      throw new Error(
        `Benchmark evidence path "${relative}" crosses a symbolic link or junction.`,
      );
  }
  if (fs.statSync(absolute).isFile() === false)
    throw new Error(`Benchmark evidence path "${relative}" is not a file.`);
  const bytes = readAutoMovieProductionOwnedFile({
    root: physicalRoot,
    directory: path.dirname(absolute),
    relative: path.basename(absolute),
  });
  assertDirectoryIdentity(rootIdentity, "benchmark evidence project");
  return Buffer.from(bytes);
};

const diffProjectTrees = (
  before: IAutoMovieBenchmarkProjectTree,
  after: IAutoMovieBenchmarkProjectTree,
): IAutoMovieBenchmarkSourceEdit[] => {
  const beforeMap = new Map(
    before.entries.map((entry) => [entry.path, entryDigest(entry)]),
  );
  const afterMap = new Map(
    after.entries.map((entry) => [entry.path, entryDigest(entry)]),
  );
  return [...new Set([...beforeMap.keys(), ...afterMap.keys()])]
    .sort(compareBenchmarkCodeUnits)
    .flatMap((file) => {
      const beforeDigest = beforeMap.get(file) ?? null;
      const afterDigest = afterMap.get(file) ?? null;
      return beforeDigest === afterDigest
        ? []
        : [{ path: file, beforeDigest, afterDigest }];
    });
};

const entryDigest = (
  entry: IAutoMovieBenchmarkProjectTreeEntry,
): `sha256:${string}` =>
  entry.kind === "file"
    ? entry.digest
    : digestBenchmarkValue({ kind: entry.kind, target: entry.target });

interface IDirectoryIdentity {
  path: string;
  real: string;
  dev: bigint;
  ino: bigint;
}

const directoryIdentity = (
  directory: string,
  label: string,
): IDirectoryIdentity => {
  const resolved = path.resolve(directory);
  const link = fs.lstatSync(resolved, { bigint: true });
  if (link.isSymbolicLink())
    throw new Error(
      `${label} "${resolved}" cannot be a symbolic link or junction.`,
    );
  if (link.isDirectory() === false)
    throw new Error(`${label} "${resolved}" is not a directory.`);
  return {
    path: resolved,
    real: fs.realpathSync(resolved),
    dev: link.dev,
    ino: link.ino,
  };
};

const assertDirectoryIdentity = (
  expected: IDirectoryIdentity,
  label: string,
): void => {
  const current = directoryIdentity(expected.path, label);
  if (
    current.real !== expected.real ||
    current.dev !== expected.dev ||
    current.ino !== expected.ino
  )
    throw new Error(
      `${label} "${expected.path}" changed physical identity during the benchmark run.`,
    );
};

const movedDirectoryIdentity = (
  expected: IDirectoryIdentity,
  destination: string,
  label: string,
): IDirectoryIdentity => {
  const moved = directoryIdentity(destination, label);
  if (moved.dev !== expected.dev || moved.ino !== expected.ino)
    throw new Error(
      `${label} "${moved.path}" does not contain the physical directory selected for publication.`,
    );
  return moved;
};

const moveArchiveStaging = (
  pending: IDirectoryIdentity,
  campaign: IDirectoryIdentity,
  repositoryRoot: string,
): IDirectoryIdentity => {
  assertDirectoryIdentity(campaign, "benchmark campaign directory");
  assertDirectoryIdentity(pending, "benchmark archive staging");
  const publicationPath = path.join(
    campaign.real,
    `.publishing-${randomUUID()}`,
  );
  fs.renameSync(pending.real, publicationPath);
  assertDirectoryIdentity(campaign, "benchmark campaign directory");
  const publication = movedDirectoryIdentity(
    pending,
    publicationPath,
    "benchmark archive publication",
  );
  assertOutside(
    repositoryRoot,
    publication.real,
    "benchmark archive publication",
  );
  return publication;
};

const quarantineRejectedArchive = (
  archive: string,
  campaign: IDirectoryIdentity,
  repositoryRoot: string,
  identityError: unknown,
): never => {
  const rejected = path.join(campaign.real, `.rejected-${randomUUID()}`);
  assertDirectoryIdentity(campaign, "benchmark campaign directory");
  try {
    fs.renameSync(archive, rejected);
  } /* c8 ignore start -- a second adversarial rename during fail-closed quarantine is host-dependent */ catch (quarantineError) {
    if (fs.existsSync(archive))
      throw new Error(
        `Rejected benchmark archive "${archive}" could not be quarantined safely: ${messageOf(quarantineError)}`,
        { cause: identityError },
      );
    throw identityError;
  }
  /* c8 ignore stop */
  assertDirectoryIdentity(campaign, "benchmark campaign directory");
  assertOutside(repositoryRoot, fs.realpathSync(rejected), "rejected archive");
  throw new Error(
    `Benchmark publication moved a replacement directory; it was quarantined at "${rejected}".`,
    { cause: identityError },
  );
};

const secureChildDirectory = (
  parent: IDirectoryIdentity,
  name: string,
  repositoryRoot: string,
): IDirectoryIdentity => {
  assertDirectoryIdentity(parent, "benchmark parent directory");
  const child = path.join(parent.real, name);
  if (fs.existsSync(child)) {
    const stat = fs.lstatSync(child);
    if (stat.isSymbolicLink() || stat.isDirectory() === false)
      throw new Error(
        `Benchmark directory "${child}" must be a real directory, not a link or file.`,
      );
  } else fs.mkdirSync(child);
  const identity = directoryIdentity(child, "benchmark directory");
  if (inside(parent.real, identity.real) === false)
    throw new Error(
      `Benchmark directory "${child}" resolves outside parent "${parent.real}".`,
    );
  assertOutside(repositoryRoot, identity.real, "benchmark directory");
  return identity;
};

const secureTemporaryDirectory = (
  parent: IDirectoryIdentity,
  prefix: string,
  repositoryRoot: string,
): IDirectoryIdentity => {
  assertDirectoryIdentity(parent, "benchmark campaign directory");
  const created = fs.mkdtempSync(path.join(parent.real, prefix));
  const identity = directoryIdentity(created, "benchmark temporary directory");
  if (inside(parent.real, identity.real) === false)
    throw new Error(
      `Benchmark temporary directory "${created}" resolves outside campaign root.`,
    );
  assertOutside(repositoryRoot, identity.real, "benchmark temporary directory");
  return identity;
};

const secureProjectCopy = (
  source: IDirectoryIdentity,
  parent: IDirectoryIdentity,
  repositoryRoot: string,
): IDirectoryIdentity => {
  assertDirectoryIdentity(source, "candidate project");
  assertDirectoryIdentity(parent, "benchmark archive staging");
  const destination = path.join(parent.real, "project");
  if (fs.existsSync(destination))
    throw new Error(
      `Benchmark staged project "${destination}" already exists.`,
    );
  fs.cpSync(source.real, destination, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  });
  const identity = directoryIdentity(destination, "staged benchmark project");
  if (inside(parent.real, identity.real) === false)
    throw new Error(
      `Staged benchmark project "${destination}" resolves outside archive staging.`,
    );
  assertOutside(repositoryRoot, identity.real, "staged benchmark project");
  return identity;
};

const stageCandidateProject = (input: {
  work: IDirectoryIdentity;
  project: IDirectoryIdentity;
  pending: IDirectoryIdentity;
  repositoryRoot: string;
}): {
  project: IDirectoryIdentity;
  tree: IAutoMovieBenchmarkProjectTree;
  failure: string | null;
} => {
  let observedBeforeCopy: IAutoMovieBenchmarkProjectTree;
  let staged: IDirectoryIdentity;
  try {
    assertDirectoryIdentity(input.work, "candidate work root");
    assertDirectoryIdentity(input.project, "candidate project");
    observedBeforeCopy = snapshotAutoMovieBenchmarkProject(input.project.real);
    staged = secureProjectCopy(
      input.project,
      input.pending,
      input.repositoryRoot,
    );
  } catch (error) {
    const fallback = resetStagedProject(input.pending, input.repositoryRoot);
    return {
      project: fallback,
      tree: snapshotAutoMovieBenchmarkProject(fallback.real),
      failure: `Candidate project could not be staged as a stable tree: ${messageOf(error)}`,
    };
  }
  const tree = snapshotAutoMovieBenchmarkProject(staged.real);
  try {
    const observedAfterCopy = snapshotAutoMovieBenchmarkProject(
      input.project.real,
    );
    return {
      project: staged,
      tree,
      failure:
        observedBeforeCopy.digest === observedAfterCopy.digest
          ? null
          : "Candidate project changed while runner-owned archive staging copied it.",
    };
  } catch (error) {
    return {
      project: staged,
      tree,
      failure: `Candidate project became unstable after archive staging: ${messageOf(error)}`,
    };
  }
};

const resetStagedProject = (
  pending: IDirectoryIdentity,
  repositoryRoot: string,
): IDirectoryIdentity => {
  assertDirectoryIdentity(pending, "benchmark archive staging");
  const destination = path.join(pending.real, "project");
  if (inside(pending.real, destination) === false)
    throw new Error(
      `Refusing to reset staged project "${destination}" outside archive staging.`,
    );
  if (fs.existsSync(destination)) {
    const stat = fs.lstatSync(destination);
    if (stat.isSymbolicLink()) fs.unlinkSync(destination);
    else fs.rmSync(destination, { recursive: true, force: true });
  }
  return secureChildDirectory(pending, "project", repositoryRoot);
};

const resetEvidenceDirectory = (
  root: IDirectoryIdentity,
  name: "frames" | "deliverables",
): void => {
  assertDirectoryIdentity(root, "benchmark evidence staging");
  const directory = path.join(root.real, name);
  if (inside(root.real, directory) === false)
    throw new Error(
      `Refusing to reset evidence directory "${directory}" outside staging.`,
    );
  if (fs.existsSync(directory)) {
    const stat = fs.lstatSync(directory);
    if (stat.isSymbolicLink()) fs.unlinkSync(directory);
    else fs.rmSync(directory, { recursive: true, force: true });
  }
  fs.mkdirSync(directory);
};

const assertOutside = (
  repositoryRoot: string,
  candidate: string,
  label: string,
): void => {
  if (inside(repositoryRoot, candidate))
    throw new Error(
      `${label} "${candidate}" resolves inside source repository "${repositoryRoot}".`,
    );
};

const inside = (parent: string, candidate: string): boolean => {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false &&
      path.isAbsolute(relative) === false)
  );
};

const assertCampaign = (campaign: string): void => {
  const portable =
    campaign.length <= 64 &&
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?$/.test(campaign);
  const base = campaign.split(".")[0]!.toUpperCase();
  const reserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base);
  if (portable === false || reserved)
    throw new Error(
      `Benchmark campaign "${campaign}" is not a portable directory id.`,
    );
};

const assertAgentResult = (result: IAutoMovieBenchmarkAgentResult): void => {
  if (typeof result.stdout !== "string" || typeof result.stderr !== "string")
    throw new Error(
      "Benchmark agent adapter must return string stdout and stderr transcripts.",
    );
  const health = result.generation;
  if (
    [
      health.toolCalls,
      health.corrections,
      health.inputTokens,
      health.outputTokens,
    ].some((value) => Number.isSafeInteger(value) === false || value < 0) ||
    [health.costUsd, health.elapsedSeconds].some(
      (value) => Number.isFinite(value) === false || value < 0,
    )
  )
    throw new Error(
      "Benchmark agent generation telemetry must be finite and non-negative.",
    );
};

const assertCollectedEvidence = (
  evidence: IAutoMovieBenchmarkCollectedEvidence,
): void => {
  if (
    Array.isArray(evidence.lifecycle) === false ||
    Array.isArray(evidence.frames) === false ||
    Array.isArray(evidence.deliverables) === false ||
    Array.isArray(evidence.trace) === false ||
    evidence.observations === null ||
    typeof evidence.observations !== "object"
  )
    throw new Error(
      "Benchmark collector returned an incomplete evidence inventory.",
    );
  if (
    evidence.repaint?.status === "verified" &&
    (evidence.repaint.adapterIdentity.trim().length === 0 ||
      evidence.repaint.shots.length === 0 ||
      new Set(evidence.repaint.shots.map((shot) => shot.shot)).size !==
        evidence.repaint.shots.length)
  )
    throw new Error(
      "Benchmark collector returned incomplete or duplicate repaint receipt evidence.",
    );
};

const emptyGeneration = (
  elapsedSeconds: number,
): IAutoMovieBenchmarkGenerationHealth => ({
  toolCalls: 0,
  corrections: 0,
  costUsd: 0,
  elapsedSeconds,
  inputTokens: 0,
  outputTokens: 0,
});

const emptyEvidence = (): IAutoMovieBenchmarkCollectedEvidence => ({
  lifecycle: [],
  observations: {},
  frames: [],
  deliverables: [],
  finishedRuntimeSeconds: null,
  trace: [],
});

const candidateFailureEvidence = (
  detail: string,
): IAutoMovieBenchmarkCollectedEvidence => ({
  ...emptyEvidence(),
  lifecycle: [
    {
      gate: "packaged-install",
      status: "pass",
      detail: "Runner reached the installed external candidate process.",
    },
    {
      gate: "project-bootstrap",
      status: "fail",
      detail,
    },
  ],
});

const candidateCollectionFailureEvidence = (
  detail: string,
): IAutoMovieBenchmarkCollectedEvidence => ({
  ...emptyEvidence(),
  lifecycle: [
    {
      gate: "packaged-install",
      status: "pass",
      detail: "Runner reached the installed external candidate process.",
    },
    {
      gate: "project-bootstrap",
      status: "pass",
      detail: "External candidate process completed in its isolated project.",
    },
    {
      gate: "source-compile",
      status: "fail",
      detail,
    },
  ],
});

const failCandidateGate = (
  evidence: IAutoMovieBenchmarkCollectedEvidence,
  gate: AutoMovieBenchmarkGate,
  detail: string,
): IAutoMovieBenchmarkCollectedEvidence => ({
  ...evidence,
  lifecycle: [
    ...evidence.lifecycle.filter((entry) => entry.gate !== gate),
    { gate, status: "fail", detail },
  ],
});

class AutoMovieBenchmarkTraceWriter {
  public readonly startedAt = performance.now();
  private sequence = 0;

  public constructor(private readonly file: string) {
    fs.writeFileSync(file, new Uint8Array());
  }

  public append(
    event: WithoutTraceHeader<IAutoMovieBenchmarkTraceEvent>,
  ): void {
    const observed = {
      ...event,
      sequence: this.sequence++,
      atMs: performance.now() - this.startedAt,
    } as IAutoMovieBenchmarkTraceEvent;
    fs.appendFileSync(
      this.file,
      appendAutoMovieBenchmarkTrace(new Uint8Array(), [observed]),
    );
  }
}

const writeJson = (file: string, value: unknown): void =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const assertArchiveIdentity = (input: {
  pending: IDirectoryIdentity;
  repositoryRoot: string;
  taskText: string;
  brief: string;
  projectTree: IAutoMovieBenchmarkProjectTree;
  transcriptDigest: `sha256:${string}`;
  inventory: IObservedMcpTarget[];
  submission: ReturnType<typeof sealAutoMovieBenchmarkSubmission>;
}): void => {
  assertDirectoryIdentity(input.pending, "benchmark archive staging");
  assertOutside(
    input.repositoryRoot,
    input.pending.real,
    "benchmark archive staging",
  );
  const readPending = (relative: string): Buffer => {
    assertDirectoryIdentity(input.pending, "benchmark archive staging");
    const bytes = readResidentFile(input.pending.real, relative);
    assertDirectoryIdentity(input.pending, "benchmark archive staging");
    return bytes;
  };
  if (
    readPending("task.json").toString("utf8") !== input.taskText ||
    readPending("brief.md").toString("utf8") !== input.brief
  )
    throw new Error(
      "Runner-owned task law or brief changed before archive publication.",
    );
  assertDirectoryIdentity(input.pending, "benchmark archive staging");
  const project = snapshotAutoMovieBenchmarkProject(
    path.join(input.pending.real, "project"),
  );
  assertDirectoryIdentity(input.pending, "benchmark archive staging");
  if (project.digest !== input.projectTree.digest)
    throw new Error(
      "Staged project bytes changed after the runner sealed their tree digest.",
    );
  const stdout = readPending("transcript/stdout.txt").toString("utf8");
  const stderr = readPending("transcript/stderr.txt").toString("utf8");
  if (
    digestBenchmarkValue({ stdout, stderr }) !== input.transcriptDigest ||
    digestBenchmarkValue(
      JSON.parse(readPending("tool-sessions.json").toString("utf8")) as unknown,
    ) !== input.submission.inventoryDigest ||
    digestBenchmarkValue(input.inventory) !== input.submission.inventoryDigest
  )
    throw new Error(
      "Runner-owned transcript or MCP inventory changed before publication.",
    );
  for (const artifact of [
    ...input.submission.frames,
    ...input.submission.deliverables,
  ]) {
    const bytes = readPending(artifact.path);
    if (
      bytes.length !== artifact.bytes ||
      digestAutoMovieBenchmarkBytes(bytes) !== artifact.digest
    )
      throw new Error(
        `Archived evidence "${artifact.path}" changed before publication.`,
      );
  }
  const trace = replayAutoMovieBenchmarkTrace(
    readPending("trace/oracle.jsonl.gz"),
  );
  const start = trace.events[0];
  const seal = trace.events.at(-1);
  if (
    trace.truncated ||
    start?.kind !== "run-start" ||
    start.taskId !== input.submission.taskId ||
    start.surface !== input.submission.surface ||
    start.lane !== input.submission.lane ||
    seal?.kind !== "run-seal" ||
    seal.runId !== input.submission.runId
  )
    throw new Error(
      "Runner-owned trace is truncated or does not bind its run endpoints to the sealed submission.",
    );
  assertDirectoryIdentity(input.pending, "benchmark archive staging");
};

const tryRemoveTemporaryDirectory = (
  target: IDirectoryIdentity,
  campaign: IDirectoryIdentity,
): void => {
  try {
    assertDirectoryIdentity(campaign, "benchmark campaign directory");
    assertDirectoryIdentity(target, "benchmark temporary directory");
    if (inside(campaign.real, target.real) === false)
      throw new Error(
        `Refusing to remove temporary directory "${target.real}" outside campaign "${campaign.real}".`,
      );
    fs.rmSync(target.real, { recursive: true, force: true });
  } /* c8 ignore start -- detached-process file locks are host-dependent */ catch {
    // A detached candidate may still hold its isolated workspace. Publication
    // remains valid because that workspace cannot address archive staging.
  }
  /* c8 ignore stop */
};

const slash = (value: string): string => value.split(path.sep).join("/");

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
