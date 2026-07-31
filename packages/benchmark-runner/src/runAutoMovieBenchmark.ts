import {
  AutoMovieBenchmarkSurface,
  IAutoMovieBenchmarkMcpSession,
  IAutoMovieBenchmarkScenario,
  IAutoMovieBenchmarkSubmissionDraft,
  IAutoMovieBenchmarkToolInventoryReport,
  IAutoMovieBenchmarkTraceEvent,
  IAutoMovieBenchmarkVerdict,
  appendAutoMovieBenchmarkTrace,
  compareBenchmarkCodeUnits,
  digestAutoMovieBenchmarkBytes,
  digestBenchmarkValue,
  getAutoMovieBenchmarkScenario,
  judgeAutoMovieBenchmarkSubmission,
  reportAutoMovieBenchmark,
  reportAutoMovieBenchmarkToolInventory,
  sealAutoMovieBenchmarkSubmission,
  validateAutoMovieBenchmarkTask,
} from "@automovie/benchmark";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Workspace and immutable law handed to one external-agent adapter. */
export interface IAutoMovieBenchmarkAgentContext {
  /** Registered scenario selected by exact id. */
  scenario: IAutoMovieBenchmarkScenario;
  /** Empty repository workspace prepared outside the source repository. */
  project: string;
  /** Pending archive root that owns the project and transcripts. */
  archive: string;
}

/** Evidence returned by an external-agent adapter after it stops. */
export interface IAutoMovieBenchmarkAgentResult {
  /** Complete draft collected from the produced project and client session. */
  submission: IAutoMovieBenchmarkSubmissionDraft;
  /** Exact client stdout or structured transcript. */
  stdout: string;
  /** Exact client stderr. */
  stderr: string;
}

/** External candidate boundary; tests replace it with an in-memory adapter. */
export type AutoMovieBenchmarkAgent = (
  context: IAutoMovieBenchmarkAgentContext,
) => Promise<IAutoMovieBenchmarkAgentResult>;

/** One retired/current measured MCP session added to inventory comparison. */
export interface IAutoMovieBenchmarkInventoryBaseline {
  /** Surface the handshake belongs to. */
  surface: AutoMovieBenchmarkSurface;
  /** Actual initialize/tools-list result. */
  mcp: IAutoMovieBenchmarkMcpSession;
}

/** Input for one content-addressed benchmark execution. */
export interface IAutoMovieBenchmarkRunInput {
  /** Exact registered scenario id. */
  taskId: string;
  /** Stable campaign directory segment. */
  campaign: string;
  /** Root that will own `.benchmarks`, outside `repositoryRoot`. */
  runRoot: string;
  /** Source repository boundary the runner must not enter. */
  repositoryRoot: string;
  /** External agent/process adapter. */
  agent: AutoMovieBenchmarkAgent;
  /** Optional actual handshakes from retired or comparison surfaces. */
  inventoryBaselines?: readonly IAutoMovieBenchmarkInventoryBaseline[];
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

/** Configuration for a command-line external-agent wrapper. */
export interface IAutoMovieBenchmarkProcessAgentInput {
  /** Executable, resolved by the host environment. */
  command: string;
  /** Fixed arguments placed before the task environment. */
  args?: readonly string[];
  /** Additional non-secret environment variables. */
  env?: Readonly<Record<string, string>>;
  /** Hard process fence in milliseconds. */
  timeoutMs: number;
}

/**
 * Adapt a Claude Code, Codex, or another external wrapper process.
 *
 * The wrapper receives task/brief/output paths in environment variables and
 * must write a complete submission draft to the output path. This layer does
 * not know or special-case one vendor's CLI flags.
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
    const submissionPath = path.join(context.archive, "agent-submission.json");
    fs.rmSync(submissionPath, { force: true });
    const child = spawnSync(input.command, [...(input.args ?? [])], {
      cwd: context.project,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: input.timeoutMs,
      env: {
        ...process.env,
        ...input.env,
        AUTOMOVIE_BENCHMARK_TASK_ID: context.scenario.taskId,
        AUTOMOVIE_BENCHMARK_PROJECT_ROOT: context.project,
        AUTOMOVIE_BENCHMARK_ARCHIVE_ROOT: context.archive,
        AUTOMOVIE_BENCHMARK_TASK_PATH: path.join(context.archive, "task.json"),
        AUTOMOVIE_BENCHMARK_BRIEF_PATH: path.join(context.archive, "brief.md"),
        AUTOMOVIE_BENCHMARK_SUBMISSION_PATH: submissionPath,
      },
    });
    if (child.error !== undefined) throw child.error;
    if (fs.existsSync(submissionPath) === false)
      throw new Error(
        `External benchmark agent exited ${String(child.status)} without writing ${submissionPath}.`,
      );
    if (child.status !== 0)
      throw new Error(
        `External benchmark agent exited ${String(child.status)} after writing a submission draft. Treat the process failure as infrastructure instead of publishing partial evidence.`,
      );
    return {
      submission: JSON.parse(
        fs.readFileSync(submissionPath, "utf8"),
      ) as IAutoMovieBenchmarkSubmissionDraft,
      stdout: child.stdout,
      stderr: child.stderr,
    };
  };
};

/** Snapshot one candidate project without following links out of its root. */
export const snapshotAutoMovieBenchmarkProject = (
  project: string,
): IAutoMovieBenchmarkProjectTree => {
  const root = fs.realpathSync(project);
  const entries: IAutoMovieBenchmarkProjectTreeEntry[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) =>
        compareBenchmarkCodeUnits(left.name, right.name),
      )) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isSymbolicLink())
        entries.push({
          kind: "link",
          path: relative,
          target: fs.readlinkSync(absolute).split(path.sep).join("/"),
        });
      else {
        /* c8 ignore start -- sockets/devices cannot be portably created in the cross-platform fixture */
        if (entry.isFile() === false)
          throw new Error(
            `Benchmark project entry "${relative}" is not a regular file, directory, or unfollowed link.`,
          );
        /* c8 ignore stop */
        const bytes = fs.readFileSync(absolute);
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
  return { entries, digest: digestBenchmarkValue(entries) };
};

/** Run one registered scenario, archive all evidence, and judge it. */
export const runAutoMovieBenchmark = async (
  input: IAutoMovieBenchmarkRunInput,
): Promise<IAutoMovieBenchmarkRunOutput> => {
  assertCampaign(input.campaign);
  const repositoryRoot = fs.realpathSync(path.resolve(input.repositoryRoot));
  const requestedRunRoot = path.resolve(input.runRoot);
  if (inside(repositoryRoot, requestedRunRoot))
    throw new Error(
      `Benchmark run root "${requestedRunRoot}" is inside source repository "${repositoryRoot}". Choose an external workspace root.`,
    );
  fs.mkdirSync(requestedRunRoot, { recursive: true });
  const runRoot = fs.realpathSync(requestedRunRoot);
  if (inside(repositoryRoot, runRoot))
    throw new Error(
      `Benchmark run root "${runRoot}" resolves inside source repository "${repositoryRoot}". Choose a physical external workspace root.`,
    );
  const scenario = getAutoMovieBenchmarkScenario(input.taskId);
  const task = scenario.task();
  validateAutoMovieBenchmarkTask(task);
  const campaignRoot = path.join(runRoot, ".benchmarks", input.campaign);
  fs.mkdirSync(campaignRoot, { recursive: true });
  const pending = fs.mkdtempSync(path.join(campaignRoot, ".pending-"));
  const project = path.join(pending, "project");
  fs.mkdirSync(project);
  writeJson(path.join(pending, "task.json"), task);
  fs.writeFileSync(path.join(pending, "brief.md"), scenario.brief);

  let result: IAutoMovieBenchmarkAgentResult;
  try {
    result = await input.agent({ scenario, project, archive: pending });
  } catch (error) {
    fs.writeFileSync(
      path.join(pending, "runner-error.txt"),
      `${messageOf(error)}\n`,
    );
    throw new Error(
      `Benchmark agent adapter failed before producing a sealable submission: ${messageOf(error)}`,
    );
  }
  if (typeof result.stdout !== "string" || typeof result.stderr !== "string")
    throw new Error(
      "Benchmark agent adapter must return string stdout and stderr transcripts.",
    );
  const transcriptRoot = path.join(pending, "transcript");
  fs.mkdirSync(transcriptRoot);
  fs.writeFileSync(path.join(transcriptRoot, "stdout.txt"), result.stdout);
  fs.writeFileSync(path.join(transcriptRoot, "stderr.txt"), result.stderr);
  writeJson(path.join(pending, "submission-draft.json"), result.submission);
  const projectTree = snapshotAutoMovieBenchmarkProject(project);
  writeJson(path.join(pending, "project-tree.json"), projectTree);
  const submission = sealAutoMovieBenchmarkSubmission({
    ...result.submission,
    treeDigest: projectTree.digest,
    transcriptDigest: digestBenchmarkValue({
      stdout: result.stdout,
      stderr: result.stderr,
    }),
  });
  if (submission.taskId !== scenario.taskId)
    throw new Error(
      `Benchmark adapter returned task "${submission.taskId}" for requested "${scenario.taskId}".`,
    );
  const verdict = judgeAutoMovieBenchmarkSubmission(task, submission);
  const report = reportAutoMovieBenchmark([verdict]);
  const toolInventory = reportAutoMovieBenchmarkToolInventory([
    ...(input.inventoryBaselines ?? []),
    { surface: submission.surface, mcp: submission.mcp },
  ]);
  writeJson(path.join(pending, "submission.json"), submission);
  writeJson(path.join(pending, "verdict.json"), verdict);
  writeJson(path.join(pending, "report.json"), report);
  writeJson(path.join(pending, "tool-inventory.json"), toolInventory);
  const traceRoot = path.join(pending, "trace");
  fs.mkdirSync(traceRoot);
  fs.writeFileSync(
    path.join(traceRoot, "oracle.jsonl.gz"),
    buildTrace(submission.runId, submission, verdict),
  );

  const archive = path.join(
    campaignRoot,
    submission.runId.slice("sha256:".length),
  );
  if (fs.existsSync(archive))
    throw new Error(
      `Benchmark run ${submission.runId} is already archived at "${archive}". Content-addressed runs are immutable.`,
    );
  fs.renameSync(pending, archive);
  return { archive, verdict, report, toolInventory };
};

const buildTrace = (
  runId: `sha256:${string}`,
  submission: ReturnType<typeof sealAutoMovieBenchmarkSubmission>,
  verdict: IAutoMovieBenchmarkVerdict,
): Uint8Array => {
  let sequence = 0;
  let atMs = 0;
  const next = (
    event: Record<string, unknown>,
  ): IAutoMovieBenchmarkTraceEvent =>
    ({
      ...event,
      sequence: sequence++,
      atMs: atMs++,
    }) as IAutoMovieBenchmarkTraceEvent;
  const events: IAutoMovieBenchmarkTraceEvent[] = [
    next({
      kind: "run-start",
      runId,
      taskId: submission.taskId,
      surface: submission.surface,
    }),
    ...submission.lifecycle.map((gate) =>
      next({
        kind: "gate",
        gate: gate.gate,
        status: gate.status,
        detail: gate.detail,
      }),
    ),
    ...submission.edits.map((edit) => next({ kind: "source-edit", ...edit })),
    ...submission.frames.map((frame) =>
      next({
        kind: "capture",
        shot: frame.shot,
        timeSeconds: frame.timeSeconds,
        pass: frame.pass,
        digest: frame.digest,
        bytes: frame.bytes,
      }),
    ),
    ...(verdict.outcome === "scored"
      ? verdict.assertions.map((assertion) =>
          next({
            kind: "assertion",
            assertion: assertion.id,
            outcome: assertion.outcome,
          }),
        )
      : []),
    next({
      kind: "verdict",
      outcome: verdict.outcome,
      filmScore: verdict.filmScore,
    }),
  ];
  return appendAutoMovieBenchmarkTrace(new Uint8Array(), events);
};

const writeJson = (file: string, value: unknown): void =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

const assertCampaign = (campaign: string): void => {
  if (/^[a-z0-9][a-z0-9._-]*$/.test(campaign) === false)
    throw new Error(
      `Benchmark campaign "${campaign}" is not a safe directory id.`,
    );
};

const inside = (parent: string, candidate: string): boolean => {
  const prefix = `${parent.replace(/[\\/]+$/, "")}${path.sep}`;
  return candidate === parent || candidate.startsWith(prefix);
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
