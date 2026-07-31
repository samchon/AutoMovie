import {
  IAutoMovieBenchmarkSubmissionDraft,
  austerlitzSignalDraft,
  austerlitzTeaserAnchors,
  austerlitzTeaserDraft,
  getAutoMovieBenchmarkScenario,
  replayAutoMovieBenchmarkTrace,
} from "@automovie/benchmark";
import {
  IAutoMovieBenchmarkAgentContext,
  createProcessAutoMovieBenchmarkAgent,
  runAutoMovieBenchmark,
  snapshotAutoMovieBenchmarkProject,
} from "@automovie/benchmark-runner";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The filesystem runner is fully exercised without invoking an actual agent. */
export const test_benchmark_runner = async (): Promise<void> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-runner-test-"));
  const repositoryRoot = path.resolve(__dirname, "../../../..");
  try {
    const current = austerlitzTeaserDraft();
    const output = await runAutoMovieBenchmark({
      taskId: current.taskId,
      campaign: "redesign-cycle-1",
      runRoot: root,
      repositoryRoot,
      inventoryBaselines: [
        {
          surface: "legacy-compact",
          mcp: austerlitzSignalDraft("legacy-compact").mcp,
        },
      ],
      agent: async ({ project, scenario }) => {
        materializeProject(project, scenario.brief);
        return {
          submission: current,
          stdout: "agent completed",
          stderr: "",
        };
      },
    });
    const required = [
      "brief.md",
      "task.json",
      "project",
      "transcript/stdout.txt",
      "transcript/stderr.txt",
      "trace/oracle.jsonl.gz",
      "project-tree.json",
      "submission-draft.json",
      "submission.json",
      "verdict.json",
      "report.json",
      "tool-inventory.json",
    ];
    const replay = replayAutoMovieBenchmarkTrace(
      fs.readFileSync(path.join(output.archive, "trace/oracle.jsonl.gz")),
    );
    const projectTree = JSON.parse(
      fs.readFileSync(path.join(output.archive, "project-tree.json"), "utf8"),
    ) as {
      digest: string;
      entries: Array<{ kind: string; path: string }>;
    };
    const sealedSubmission = JSON.parse(
      fs.readFileSync(path.join(output.archive, "submission.json"), "utf8"),
    ) as IAutoMovieBenchmarkSubmissionDraft;
    const linkedSnapshot = snapshotLinkedProject(root);
    TestValidator.predicate(
      "one scenario id produces the complete content-addressed archive",
      output.verdict.outcome === "scored" &&
        output.verdict.filmScore === 1 &&
        required.every((entry) =>
          fs.existsSync(path.join(output.archive, entry)),
        ) &&
        replay.truncated === false &&
        replay.events[0]?.kind === "run-start" &&
        replay.events.at(-1)?.kind === "verdict" &&
        projectTree.entries.some(
          (entry) => entry.kind === "file" && entry.path === "agent-owned.txt",
        ) &&
        linkedSnapshot.entries.some(
          (entry) => entry.kind === "link" && entry.path === "linked-view",
        ) &&
        sealedSubmission.treeDigest === projectTree.digest &&
        sealedSubmission.transcriptDigest !== current.transcriptDigest &&
        output.report.surfaces.length === 1 &&
        output.report.surfaces[0]?.scored === 1 &&
        output.toolInventory.surfaces.length === 2 &&
        output.toolInventory.comparisons.length === 1,
    );

    const duplicate = await rejected(() =>
      runAutoMovieBenchmark({
        taskId: current.taskId,
        campaign: "redesign-cycle-1",
        runRoot: root,
        repositoryRoot,
        agent: async ({ project, scenario }) => {
          materializeProject(project, scenario.brief);
          return {
            submission: current,
            stdout: "agent completed",
            stderr: "",
          };
        },
      }),
    );
    TestValidator.predicate(
      "an existing content-addressed run is immutable",
      duplicate.includes("is already archived"),
    );

    const empty = unseal(austerlitzTeaserAnchors().empty);
    const gateFailed = await runAutoMovieBenchmark({
      taskId: empty.taskId,
      campaign: "taxonomy",
      runRoot: root,
      repositoryRoot,
      agent: async () => ({
        submission: empty,
        stdout: "no source",
        stderr: "",
      }),
    });
    const excludedDraft: IAutoMovieBenchmarkSubmissionDraft = {
      ...austerlitzTeaserDraft(),
      client: {
        ...austerlitzTeaserDraft().client,
        configDigest:
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      },
      incident: {
        kind: "rate-limit",
        gate: "source-compile",
        detail: "External account was rate limited.",
      },
    };
    const excluded = await runAutoMovieBenchmark({
      taskId: excludedDraft.taskId,
      campaign: "taxonomy",
      runRoot: root,
      repositoryRoot,
      agent: async () => ({
        submission: excludedDraft,
        stdout: "limited",
        stderr: "429",
      }),
    });
    TestValidator.equals(
      "runner reports keep infrastructure exclusion distinct from gate failure",
      [
        gateFailed.verdict.outcome,
        gateFailed.verdict.filmScore,
        excluded.verdict.outcome,
        excluded.verdict.filmScore,
      ],
      ["gate-failed", 0, "infra-excluded", null],
    );

    TestValidator.predicate(
      "unsafe campaign, in-repository workspace, adapter failure, and task mismatch refuse before publication",
      (
        await rejected(() =>
          runAutoMovieBenchmark({
            taskId: current.taskId,
            campaign: "../escape",
            runRoot: root,
            repositoryRoot,
            agent: async () => {
              throw new Error("unreachable");
            },
          }),
        )
      ).includes("not a safe directory id") &&
        (
          await rejected(() =>
            runAutoMovieBenchmark({
              taskId: current.taskId,
              campaign: "inside",
              runRoot: path.join(repositoryRoot, ".benchmarks-forbidden"),
              repositoryRoot,
              agent: async () => {
                throw new Error("unreachable");
              },
            }),
          )
        ).includes("inside source repository") &&
        (await rejectsResolvedRepositoryLink(root, repositoryRoot, current)) &&
        (
          await rejected(() =>
            runAutoMovieBenchmark({
              taskId: current.taskId,
              campaign: "agent-error",
              runRoot: root,
              repositoryRoot,
              agent: async () => {
                throw "adapter unavailable";
              },
            }),
          )
        ).includes("adapter unavailable") &&
        (
          await rejected(() =>
            runAutoMovieBenchmark({
              taskId: current.taskId,
              campaign: "agent-error-object",
              runRoot: root,
              repositoryRoot,
              agent: async () => {
                throw new Error("adapter object failure");
              },
            }),
          )
        ).includes("adapter object failure") &&
        (
          await rejected(() =>
            runAutoMovieBenchmark({
              taskId: current.taskId,
              campaign: "invalid-transcript",
              runRoot: root,
              repositoryRoot,
              agent: async () => ({
                submission: current,
                stdout: 42 as unknown as string,
                stderr: "",
              }),
            }),
          )
        ).includes("string stdout and stderr") &&
        (
          await rejected(() =>
            runAutoMovieBenchmark({
              taskId: current.taskId,
              campaign: "invalid-stderr",
              runRoot: root,
              repositoryRoot,
              agent: async () => ({
                submission: current,
                stdout: "",
                stderr: 42 as unknown as string,
              }),
            }),
          )
        ).includes("string stdout and stderr") &&
        (
          await rejected(() =>
            runAutoMovieBenchmark({
              taskId: current.taskId,
              campaign: "wrong-task",
              runRoot: root,
              repositoryRoot,
              agent: async () => ({
                submission: {
                  ...current,
                  taskId: "short/austerlitz-signal",
                },
                stdout: "",
                stderr: "",
              }),
            }),
          )
        ).includes('for requested "short/austerlitz-teaser"'),
    );

    await exerciseProcessAdapter(root);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};

const materializeProject = (project: string, brief: string): void => {
  fs.writeFileSync(path.join(project, "agent-owned.txt"), brief);
  const evidence = path.join(project, "evidence");
  fs.mkdirSync(evidence);
  fs.writeFileSync(path.join(evidence, "fact.txt"), "evidence");
};

const snapshotLinkedProject = (
  root: string,
): ReturnType<typeof snapshotAutoMovieBenchmarkProject> => {
  const project = path.join(root, "snapshot-project");
  const target = path.join(project, "linked-target");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "evidence.txt"), "evidence");
  fs.symlinkSync(
    target,
    path.join(project, "linked-view"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = path.join(project, "linked-view");
  try {
    return snapshotAutoMovieBenchmarkProject(project);
  } finally {
    fs.unlinkSync(linked);
  }
};

const rejectsResolvedRepositoryLink = async (
  root: string,
  repositoryRoot: string,
  submission: IAutoMovieBenchmarkSubmissionDraft,
): Promise<boolean> => {
  const linked = path.join(root, "linked-repository");
  fs.symlinkSync(
    repositoryRoot,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  try {
    return (
      await rejected(() =>
        runAutoMovieBenchmark({
          taskId: submission.taskId,
          campaign: "linked-inside",
          runRoot: linked,
          repositoryRoot,
          agent: async () => ({
            submission,
            stdout: "",
            stderr: "",
          }),
        }),
      )
    ).includes("resolves inside source repository");
  } finally {
    fs.unlinkSync(linked);
  }
};

const exerciseProcessAdapter = async (root: string): Promise<void> => {
  const archive = path.join(root, "process-adapter");
  const project = path.join(archive, "project");
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(archive, "task.json"), "{}");
  fs.writeFileSync(path.join(archive, "brief.md"), "brief");
  const script = path.join(archive, "agent.cjs");
  fs.writeFileSync(
    script,
    `const fs = require("node:fs");
const path = require("node:path");
if (
  process.env.AUTOMOVIE_BENCHMARK_PROJECT_ROOT !== process.cwd() ||
  process.env.AUTOMOVIE_BENCHMARK_ARCHIVE_ROOT !== path.dirname(process.cwd())
) process.exit(3);
fs.writeFileSync(
  process.env.AUTOMOVIE_BENCHMARK_SUBMISSION_PATH,
  ${JSON.stringify(JSON.stringify(austerlitzTeaserDraft()))},
);
process.stdout.write(process.env.BENCHMARK_MARKER);
`,
  );
  TestValidator.error(
    "process adapters validate command",
    () =>
      createProcessAutoMovieBenchmarkAgent({
        command: " ",
        timeoutMs: 0,
      }),
    "non-blank command",
  );
  TestValidator.error(
    "process adapters require an integer timeout",
    () =>
      createProcessAutoMovieBenchmarkAgent({
        command: process.execPath,
        timeoutMs: 1.5,
      }),
    "positive safe-integer timeoutMs",
  );
  TestValidator.error(
    "process adapters require a positive timeout",
    () =>
      createProcessAutoMovieBenchmarkAgent({
        command: process.execPath,
        timeoutMs: 0,
      }),
    "positive safe-integer timeoutMs",
  );
  const agent = createProcessAutoMovieBenchmarkAgent({
    command: process.execPath,
    args: [script],
    env: { BENCHMARK_MARKER: "process complete" },
    timeoutMs: 30_000,
  });
  const context: IAutoMovieBenchmarkAgentContext = {
    scenario: getAutoMovieBenchmarkScenario("short/austerlitz-teaser"),
    project,
    archive,
  };
  const result = await agent(context);
  const missing = createProcessAutoMovieBenchmarkAgent({
    command: process.execPath,
    args: ["-e", "process.exit(2)"],
    timeoutMs: 30_000,
  });
  const absent = await rejected(() => missing(context));
  const partial = createProcessAutoMovieBenchmarkAgent({
    command: process.execPath,
    args: [
      "-e",
      'require("node:fs").writeFileSync(process.env.AUTOMOVIE_BENCHMARK_SUBMISSION_PATH, "{}"); process.exit(2)',
    ],
    timeoutMs: 30_000,
  });
  const partialFailure = await rejected(() => partial(context));
  const nonexistent = createProcessAutoMovieBenchmarkAgent({
    command: path.join(root, "missing-agent-executable"),
    timeoutMs: 30_000,
  });
  const spawnError = await rejected(() => nonexistent(context));
  TestValidator.predicate(
    "process adapter passes task environment and requires a submission draft",
    result.stdout === "process complete" &&
      result.submission.taskId === "short/austerlitz-teaser" &&
      absent.includes("without writing") &&
      partialFailure.includes("after writing a submission draft") &&
      spawnError.length > 0,
  );
};

const unseal = (
  submission: ReturnType<typeof austerlitzTeaserAnchors>["empty"],
): IAutoMovieBenchmarkSubmissionDraft => {
  const { runId: _runId, ...draft } = submission;
  return draft;
};

const rejected = async (closure: () => Promise<unknown>): Promise<string> => {
  try {
    await closure();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};
