import {
  IAutoMovieBenchmarkGateResult,
  IAutoMovieBenchmarkMcpSession,
  austerlitzSignalDraft,
  austerlitzTeaserDraft,
  getAutoMovieBenchmarkScenario,
  replayAutoMovieBenchmarkTrace,
} from "@automovie/benchmark";
import {
  AutoMovieBenchmarkAgent,
  AutoMovieBenchmarkInfrastructureError,
  IAutoMovieBenchmarkCollectedEvidence,
  IAutoMovieBenchmarkProcessAgentInput,
  IAutoMovieBenchmarkRunIdentity,
  createClaudeCodeAutoMovieBenchmarkAgent,
  createCodexAutoMovieBenchmarkAgent,
  createProcessAutoMovieBenchmarkAgent,
  createProcessAutoMovieBenchmarkMcpTarget,
  runAutoMovieBenchmark,
  snapshotAutoMovieBenchmarkProject,
} from "@automovie/benchmark-runner";
import { muxProductionFeatureMp4 } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";
import {
  productionH264Mp4,
  productionOpusMp4,
  productionPng,
  productionWebVtt,
} from "../mcp/productionMediaFixtures";

const expectErrorMessage = (
  title: string,
  task: () => unknown,
  message: string,
): void => TestValidator.predicate(title, throwsError(task, message));

const completeLifecycle = (): IAutoMovieBenchmarkGateResult[] => [
  { gate: "packaged-install", status: "pass", detail: "Packages installed." },
  { gate: "mcp-handshake", status: "pass", detail: "Ignored agent claim." },
  { gate: "project-bootstrap", status: "pass", detail: "Project exists." },
  { gate: "source-compile", status: "pass", detail: "Compile receipt passed." },
  { gate: "capture-runtime", status: "pass", detail: "Capture initialized." },
  { gate: "required-frames", status: "pass", detail: "Frames parsed." },
  { gate: "review-queue", status: "pass", detail: "Reviews current." },
  {
    gate: "deliverable-render",
    status: "pass",
    detail: "Outputs parsed.",
  },
  { gate: "final-compile", status: "pass", detail: "Final compile passed." },
];

/** The runner is exercised without invoking a model or network service. */
export const test_benchmark_runner = async (): Promise<void> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-runner-test-"));
  const repositoryRoot = path.resolve(__dirname, "../../../..");
  const current = austerlitzTeaserDraft();
  const identity: IAutoMovieBenchmarkRunIdentity = {
    repository: current.repository,
    client: current.client,
    runtime: current.runtime,
  };
  const ttsxEntry = path.join(
    path.dirname(createRequire(__filename).resolve("ttsc/package.json")),
    "lib/launcher/ttsx.js",
  );
  const mcpTarget = createProcessAutoMovieBenchmarkMcpTarget({
    surface: "five-tool",
    provenance: "@automovie/mcp:workspace",
    command: process.execPath,
    args: [
      ttsxEntry,
      "-P",
      path.join(repositoryRoot, "packages/mcp/tsconfig.json"),
      path.join(repositoryRoot, "packages/mcp/src/bin.ts"),
    ],
    timeoutMs: 30_000,
  });
  const archivedBaseline = {
    surface: "legacy-compact" as const,
    provenance: "@automovie/mcp:legacy-compact:archived",
    probe: async (): Promise<IAutoMovieBenchmarkMcpSession> =>
      austerlitzSignalDraft("legacy-compact").mcp,
  };
  try {
    const agent = materializingAgent(current.generation);
    const output = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "redesign-cycle-1",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      inventoryBaselines: [archivedBaseline],
      agent,
      collect: collectCompleteEvidence,
    });
    const submission = readJson<{
      treeDigest: string;
      transcriptDigest: string;
      inventoryDigest: string;
      edits: Array<{ path: string }>;
      frames: Array<{ path: string; digest: string }>;
      deliverables: Array<{ path: string; digest: string }>;
    }>(path.join(output.archive, "submission.json"));
    const projectTree = readJson<{
      digest: string;
      entries: Array<{ kind: string; path: string }>;
    }>(path.join(output.archive, "project-tree.json"));
    const replay = replayAutoMovieBenchmarkTrace(
      fs.readFileSync(path.join(output.archive, "trace/oracle.jsonl.gz")),
    );
    TestValidator.predicate(
      "one scenario id publishes runner-owned evidence and live MCP inventory",
      output.verdict.outcome === "scored" &&
        output.verdict.filmScore === 1 &&
        replay.truncated === false &&
        replay.events[0]?.kind === "run-start" &&
        replay.events.some((event) => event.kind === "compile") &&
        replay.events.some((event) => event.kind === "review") &&
        replay.events.some((event) => event.kind === "assertion") &&
        replay.events.at(-2)?.kind === "verdict" &&
        replay.events.at(-1)?.kind === "run-seal" &&
        projectTree.digest === submission.treeDigest &&
        projectTree.entries.some(
          (entry) =>
            entry.kind === "file" &&
            entry.path === "receipts/observations.json",
        ) &&
        submission.edits.some(
          (edit) => edit.path === "receipts/observations.json",
        ) &&
        submission.edits.some((edit) => edit.path === "src/film.ts") &&
        submission.edits.every((edit) => edit.path !== "nonexistent.ts") &&
        submission.frames.every(
          (frame) =>
            fs.existsSync(path.join(output.archive, frame.path)) &&
            frame.path.startsWith("evidence/frames/"),
        ) &&
        submission.deliverables.every(
          (file) =>
            fs.existsSync(path.join(output.archive, file.path)) &&
            file.path.startsWith("evidence/deliverables/"),
        ) &&
        output.toolInventory.surfaces.length === 2 &&
        output.toolInventory.surfaces.find(
          (surface) => surface.surface === "five-tool",
        )?.tools === 5 &&
        output.toolInventory.comparisons.length === 1 &&
        fs.existsSync(path.join(output.archive, "tool-sessions.json")) &&
        submission.inventoryDigest.startsWith("sha256:") &&
        submission.transcriptDigest.startsWith("sha256:"),
    );

    const duplicate = await rejected(() =>
      runAutoMovieBenchmark({
        taskId: current.taskId,
        lane: "deterministic",
        campaign: "redesign-cycle-1",
        runRoot: root,
        repositoryRoot,
        identity,
        mcpTarget,
        inventoryBaselines: [archivedBaseline],
        agent,
        collect: collectCompleteEvidence,
      }),
    );
    TestValidator.predicate(
      "an existing content-addressed run is immutable",
      duplicate.includes("is already archived"),
    );

    const gateFailed = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "taxonomy",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      agent: async () => ({
        stdout: "candidate stopped",
        stderr: "",
        generation: { ...current.generation, elapsedSeconds: 1 },
      }),
      collect: async () => ({
        ...emptyEvidence(),
        lifecycle: [
          {
            gate: "packaged-install",
            status: "pass",
            detail: "Package installed.",
          },
          {
            gate: "project-bootstrap",
            status: "pass",
            detail: "Project created.",
          },
          {
            gate: "source-compile",
            status: "fail",
            detail: "Candidate source did not compile.",
          },
        ],
      }),
    });
    const excluded = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "taxonomy",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      agent: async () => {
        throw new Error("agent transport disappeared");
      },
      collect: collectCompleteEvidence,
    });
    const repaintExcluded = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "repaint",
      campaign: "taxonomy",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      agent: unreachableAgent,
      collect: collectCompleteEvidence,
    });
    const candidateStopped = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "candidate-boundary",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      agent: createProcessAutoMovieBenchmarkAgent({
        command: process.execPath,
        args: ["-e", "process.exit(2)"],
        timeoutMs: 30_000,
      }),
      collect: collectCompleteEvidence,
    });
    const missingCandidateReceipts = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "candidate-boundary",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      agent: async () => ({
        stdout: "candidate omitted receipts",
        stderr: "",
        generation: { ...current.generation, elapsedSeconds: 1 },
      }),
      collect: async () => {
        throw new Error("compile receipt is absent");
      },
    });
    const collectorInfrastructure = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "candidate-boundary",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      agent: async () => ({
        stdout: "candidate completed",
        stderr: "",
        generation: { ...current.generation, elapsedSeconds: 1 },
      }),
      collect: async () => {
        throw new AutoMovieBenchmarkInfrastructureError({
          kind: "rate-limit",
          gate: "capture-runtime",
          detail: "Trusted capture service was rate-limited.",
        });
      },
    });
    TestValidator.equals(
      "runner-owned taxonomy separates candidate, agent infra, and missing repaint adapter",
      [
        gateFailed.verdict.outcome,
        gateFailed.verdict.filmScore,
        candidateStopped.verdict.outcome,
        candidateStopped.verdict.filmScore,
        missingCandidateReceipts.verdict.outcome,
        missingCandidateReceipts.verdict.filmScore,
        excluded.verdict.outcome,
        excluded.verdict.filmScore,
        collectorInfrastructure.verdict.outcome,
        collectorInfrastructure.verdict.filmScore,
        repaintExcluded.verdict.outcome,
        repaintExcluded.verdict.filmScore,
      ],
      [
        "gate-failed",
        0,
        "gate-failed",
        0,
        "gate-failed",
        0,
        "infra-excluded",
        null,
        "infra-excluded",
        null,
        "infra-excluded",
        null,
      ],
    );
    TestValidator.predicate(
      "failed runs still publish replayable traces and reports",
      [excluded.archive, repaintExcluded.archive].every(
        (archive) =>
          fs.existsSync(path.join(archive, "report.json")) &&
          replayAutoMovieBenchmarkTrace(
            fs.readFileSync(path.join(archive, "trace/oracle.jsonl.gz")),
          ).events.some((event) => event.kind === "incident"),
      ),
    );
    TestValidator.predicate(
      "missing repaint runtime is infrastructure-excluded with a dedicated class",
      repaintExcluded.verdict.outcome === "infra-excluded" &&
        repaintExcluded.verdict.incident.kind === "repaint-adapter-unavailable",
    );

    const badProbe = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "deterministic",
      campaign: "mcp-failure",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget: {
        surface: "five-tool",
        provenance: "broken-server",
        probe: async () => {
          throw new Error("initialize refused");
        },
      },
      agent: unreachableAgent,
      collect: collectCompleteEvidence,
    });
    const unavailableRepaintWithBadProbe = await runAutoMovieBenchmark({
      taskId: current.taskId,
      lane: "repaint",
      campaign: "mcp-failure",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget: {
        surface: "five-tool",
        provenance: "broken-repaint-server",
        probe: async () => {
          throw new Error("initialize refused");
        },
      },
      agent: unreachableAgent,
      collect: collectCompleteEvidence,
    });
    TestValidator.predicate(
      "a failed live MCP handshake is runner-owned infrastructure evidence",
      badProbe.verdict.outcome === "infra-excluded" &&
        badProbe.toolInventory.surfaces.length === 0 &&
        readJson<{ mcp: { protocolVersion: string } }>(
          path.join(badProbe.archive, "submission.json"),
        ).mcp.protocolVersion === "unavailable",
    );
    TestValidator.predicate(
      "a missing repaint runtime remains archiveable when MCP handshake also fails",
      unavailableRepaintWithBadProbe.verdict.outcome === "infra-excluded" &&
        unavailableRepaintWithBadProbe.verdict.incident.kind ===
          "repaint-adapter-unavailable" &&
        readJson<{ repaint: { status: string } }>(
          path.join(unavailableRepaintWithBadProbe.archive, "submission.json"),
        ).repaint.status === "unavailable",
    );

    await exerciseCandidateEvidenceBoundary(
      root,
      repositoryRoot,
      identity,
      mcpTarget,
      current.generation,
    );
    await exerciseInputAndFilesystemFences(
      root,
      repositoryRoot,
      identity,
      mcpTarget,
    );
    await exerciseProcessAdapter(root);
    await exerciseProviderAdapters(root);
    exerciseSnapshotLink(root);
  } finally {
    fs.rmSync(root, {
      force: true,
      maxRetries: 3,
      recursive: true,
      retryDelay: 100,
    });
  }
};

const exerciseCandidateEvidenceBoundary = async (
  root: string,
  repositoryRoot: string,
  identity: IAutoMovieBenchmarkRunIdentity,
  mcpTarget: ReturnType<typeof createProcessAutoMovieBenchmarkMcpTarget>,
  generation: ReturnType<typeof austerlitzTeaserDraft>["generation"],
): Promise<void> => {
  const malformedEvidence = await runAutoMovieBenchmark({
    taskId: "short/austerlitz-teaser",
    lane: "deterministic",
    campaign: "candidate-evidence",
    runRoot: root,
    repositoryRoot,
    identity,
    mcpTarget,
    agent: materializingAgent(generation),
    collect: async (context) => {
      const evidence = await collectCompleteEvidence(context);
      return {
        ...evidence,
        frames: [{ ...evidence.frames[0]!, file: "../outside.png" }],
        deliverables: [
          {
            ...evidence.deliverables[0]!,
            file: "renders/outputs/missing.mp4",
          },
        ],
      };
    },
  });
  const unstableProject = await runAutoMovieBenchmark({
    taskId: "short/austerlitz-teaser",
    lane: "deterministic",
    campaign: "candidate-evidence",
    runRoot: root,
    repositoryRoot,
    identity,
    mcpTarget,
    agent: async ({ project }) => {
      fs.rmSync(project, { recursive: true, force: true });
      fs.symlinkSync(
        repositoryRoot,
        project,
        process.platform === "win32" ? "junction" : "dir",
      );
      return {
        stdout: "candidate replaced its workspace",
        stderr: "",
        generation: { ...generation, elapsedSeconds: 1 },
      };
    },
    collect: async () => ({
      ...emptyEvidence(),
      lifecycle: completeLifecycle(),
    }),
  });
  TestValidator.predicate(
    "candidate-controlled evidence paths and workspace instability remain in the denominator",
    malformedEvidence.verdict.outcome === "gate-failed" &&
      "incident" in malformedEvidence.verdict === false &&
      unstableProject.verdict.outcome === "gate-failed" &&
      "incident" in unstableProject.verdict === false &&
      readJson<{ entries: unknown[] }>(
        path.join(unstableProject.archive, "project-tree.json"),
      ).entries.length === 0,
  );
};

const materializingAgent =
  (
    generation: ReturnType<typeof austerlitzTeaserDraft>["generation"],
  ): AutoMovieBenchmarkAgent =>
  async ({ project, scenario }) => {
    const source = path.join(project, "src");
    const frames = path.join(project, "renders", "frames");
    const outputs = path.join(project, "renders", "outputs");
    const receipts = path.join(project, "receipts");
    for (const directory of [source, frames, outputs, receipts])
      fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(source, "film.ts"),
      `export const brief = ${JSON.stringify(scenario.brief)};\n`,
    );
    fs.writeFileSync(
      path.join(receipts, "observations.json"),
      `${JSON.stringify(
        {
          "landmark:pratzen-height-meters": 12,
          "delivery:deterministic": 1,
          "formation:allied-column:count": 512,
          "battle:ordered-volley-count": 1,
          "asset:musket:registered": 1,
          "physics:max-ground-penetration-m": 0,
          "physics:reaction-after-impact": 1,
        },
        null,
        2,
      )}\n`,
    );
    fs.writeFileSync(
      path.join(frames, "signal-beauty.png"),
      productionPng(1_280, 720),
    );
    fs.writeFileSync(
      path.join(frames, "first-volley-pose.png"),
      productionPng(1_280, 720),
    );
    const video = await productionH264Mp4({
      width: 16,
      height: 16,
      fps: 24,
      frameCount: 4,
    });
    fs.writeFileSync(
      path.join(outputs, "feature.mp4"),
      muxProductionFeatureMp4({
        video,
        audio: productionOpusMp4(8_000),
      }),
    );
    fs.writeFileSync(path.join(outputs, "captions.vtt"), productionWebVtt());
    fs.writeFileSync(path.join(outputs, "audio.m4a"), productionOpusMp4(8_000));
    return {
      stdout: "agent completed",
      stderr: "",
      generation: { ...generation, elapsedSeconds: 1 },
    };
  };

const collectCompleteEvidence = async ({
  project,
}: {
  project: string;
}): Promise<IAutoMovieBenchmarkCollectedEvidence> => ({
  lifecycle: completeLifecycle(),
  observations: readJson<Record<string, number>>(
    path.join(project, "receipts", "observations.json"),
  ),
  frames: [
    {
      file: "renders/frames/signal-beauty.png",
      shot: "signal",
      timeSeconds: 2,
      pass: "beauty",
    },
    {
      file: "renders/frames/first-volley-pose.png",
      shot: "first-volley",
      timeSeconds: 2,
      pass: "pose",
    },
  ],
  deliverables: [
    {
      file: "renders/outputs/feature.mp4",
      deliverable: "feature",
      kind: "feature",
      mediaType: "video/mp4",
      durationSeconds: 60,
    },
    {
      file: "renders/outputs/captions.vtt",
      deliverable: "captions",
      kind: "captions",
      mediaType: "text/vtt",
      durationSeconds: null,
    },
    {
      file: "renders/outputs/audio.m4a",
      deliverable: "audio",
      kind: "audio-mix",
      mediaType: "audio/mp4",
      durationSeconds: 60,
    },
  ],
  finishedRuntimeSeconds: 60,
  trace: [
    { kind: "compile", success: true, errors: 0, warnings: 0 },
    {
      kind: "mcp-call",
      tool: "captureFrame",
      requestDigest:
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      resultDigest:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ok: true,
    },
    { kind: "review", target: "film:austerlitz", transition: "pass" },
  ],
});

const exerciseInputAndFilesystemFences = async (
  root: string,
  repositoryRoot: string,
  identity: IAutoMovieBenchmarkRunIdentity,
  mcpTarget: ReturnType<typeof createProcessAutoMovieBenchmarkMcpTarget>,
): Promise<void> => {
  const base = {
    taskId: "short/austerlitz-teaser",
    lane: "deterministic" as const,
    runRoot: root,
    repositoryRoot,
    identity,
    mcpTarget,
    agent: unreachableAgent,
    collect: collectCompleteEvidence,
  };
  const unsafe = await Promise.all(
    ["../escape", "nul", "foo."].map((campaign) =>
      rejected(() => runAutoMovieBenchmark({ ...base, campaign })),
    ),
  );
  const insideRepository = await rejected(() =>
    runAutoMovieBenchmark({
      ...base,
      campaign: "inside",
      runRoot: path.join(repositoryRoot, ".benchmarks-forbidden"),
    }),
  );
  const unsupportedLane = await rejected(() =>
    runAutoMovieBenchmark({
      ...base,
      taskId: "short/austerlitz-signal",
      lane: "repaint",
      campaign: "unsupported-lane",
    }),
  );
  const duplicateSurface = await rejected(() =>
    runAutoMovieBenchmark({
      ...base,
      campaign: "duplicate-surface",
      inventoryBaselines: [mcpTarget],
    }),
  );
  const blankProvenance = await rejected(() =>
    runAutoMovieBenchmark({
      ...base,
      campaign: "blank-provenance",
      mcpTarget: { ...mcpTarget, provenance: " " },
    }),
  );
  const missingMcp = createProcessAutoMovieBenchmarkMcpTarget({
    surface: "five-tool",
    provenance: "missing-process",
    command: path.join(root, "missing-mcp-executable"),
    timeoutMs: 30_000,
  });
  const missingMcpFailure = await rejected(() =>
    missingMcp.probe({
      scenario: getAutoMovieBenchmarkScenario("short/austerlitz-teaser"),
      project: root,
    }),
  );
  expectErrorMessage(
    "process MCP targets validate command and timeout",
    () =>
      createProcessAutoMovieBenchmarkMcpTarget({
        surface: "five-tool",
        provenance: " ",
        command: " ",
        timeoutMs: 0,
      }),
    "non-blank command/provenance",
  );
  expectErrorMessage(
    "process MCP targets validate provenance",
    () =>
      createProcessAutoMovieBenchmarkMcpTarget({
        surface: "five-tool",
        provenance: " ",
        command: "mcp",
        timeoutMs: 1,
      }),
    "non-blank command/provenance",
  );
  expectErrorMessage(
    "process MCP targets require an integer timeout",
    () =>
      createProcessAutoMovieBenchmarkMcpTarget({
        surface: "five-tool",
        provenance: "target",
        command: "mcp",
        timeoutMs: 1.5,
      }),
    "positive safe-integer timeoutMs",
  );
  expectErrorMessage(
    "process MCP targets require a positive timeout",
    () =>
      createProcessAutoMovieBenchmarkMcpTarget({
        surface: "five-tool",
        provenance: "target",
        command: "mcp",
        timeoutMs: 0,
      }),
    "positive safe-integer timeoutMs",
  );

  const linkedRoot = path.join(root, "linked-repository");
  fs.symlinkSync(
    repositoryRoot,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linkedRepository = await rejected(() =>
    runAutoMovieBenchmark({
      ...base,
      campaign: "linked",
      runRoot: linkedRoot,
    }),
  );
  fs.unlinkSync(linkedRoot);

  const linkedCampaignRoot = path.join(root, "linked-campaign");
  fs.mkdirSync(path.join(linkedCampaignRoot, ".benchmarks"), {
    recursive: true,
  });
  fs.symlinkSync(
    repositoryRoot,
    path.join(linkedCampaignRoot, ".benchmarks", "campaign"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const linkedCampaign = await rejected(() =>
    runAutoMovieBenchmark({
      ...base,
      campaign: "campaign",
      runRoot: linkedCampaignRoot,
    }),
  );
  fs.unlinkSync(path.join(linkedCampaignRoot, ".benchmarks", "campaign"));

  TestValidator.predicate(
    "portable ids, source-repository ancestry, links, and unsupported lanes are refused",
    unsafe.every((message) => message.includes("portable directory id")) &&
      insideRepository.includes("inside source repository") &&
      linkedRepository.includes("symbolic link or junction") &&
      linkedCampaign.includes("real directory, not a link") &&
      unsupportedLane.includes("does not support lane") &&
      duplicateSurface.includes("repeat surface") &&
      blankProvenance.includes("blank provenance") &&
      missingMcpFailure.includes('MCP probe "missing-process" failed'),
  );
};

const exerciseProcessAdapter = async (root: string): Promise<void> => {
  const project = path.join(root, "process-adapter");
  const input = path.join(project, ".automovie-benchmark");
  fs.mkdirSync(input, { recursive: true });
  const taskPath = path.join(input, "task.json");
  const briefPath = path.join(input, "brief.md");
  fs.writeFileSync(taskPath, "{}");
  fs.writeFileSync(briefPath, "brief");
  const script = path.join(project, "agent.cjs");
  fs.writeFileSync(
    script,
    `const fs = require("node:fs");
let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => prompt += chunk);
process.stdin.on("end", () => {
  if (
    process.env.AUTOMOVIE_BENCHMARK_PROJECT_ROOT !== process.cwd() ||
    process.env.AUTOMOVIE_BENCHMARK_TASK_PATH !== ${JSON.stringify(taskPath)} ||
    process.env.AUTOMOVIE_BENCHMARK_BRIEF_PATH !== ${JSON.stringify(briefPath)}
  ) process.exit(3);
  fs.writeFileSync("received-brief.md", prompt);
  process.stdout.write(process.env.BENCHMARK_MARKER);
});
`,
  );
  const context = {
    scenario: getAutoMovieBenchmarkScenario("short/austerlitz-teaser"),
    lane: "deterministic" as const,
    project,
    taskPath,
    briefPath,
  };
  const agent = createProcessAutoMovieBenchmarkAgent({
    command: process.execPath,
    args: [script],
    env: { BENCHMARK_MARKER: "process complete" },
    timeoutMs: 30_000,
    generation: (_stdout, _stderr, elapsedSeconds) => ({
      toolCalls: 1,
      corrections: 0,
      costUsd: 0,
      elapsedSeconds,
      inputTokens: 0,
      outputTokens: 0,
    }),
  });
  const result = await agent(context);
  const missing = createProcessAutoMovieBenchmarkAgent({
    command: path.join(root, "missing-agent-executable"),
    timeoutMs: 30_000,
  });
  const spawnFailure = await rejected(() => missing(context));
  const nonzero = createProcessAutoMovieBenchmarkAgent({
    command: process.execPath,
    args: ["-e", "process.exit(2)"],
    timeoutMs: 30_000,
  });
  const exitFailure = await rejected(() => nonzero(context));
  const timeout = createProcessAutoMovieBenchmarkAgent({
    command: process.execPath,
    args: ["-e", "setInterval(() => undefined, 1000)"],
    timeoutMs: 10,
  });
  const timeoutFailure = await rejected(() => timeout(context));
  expectErrorMessage(
    "process adapters validate command",
    () =>
      createProcessAutoMovieBenchmarkAgent({
        command: " ",
        timeoutMs: 0,
      }),
    "non-blank command",
  );
  expectErrorMessage(
    "process adapters validate integer timeout",
    () =>
      createProcessAutoMovieBenchmarkAgent({
        command: process.execPath,
        timeoutMs: 1.5,
      }),
    "positive safe-integer timeoutMs",
  );
  expectErrorMessage(
    "process adapters require a positive timeout",
    () =>
      createProcessAutoMovieBenchmarkAgent({
        command: process.execPath,
        timeoutMs: 0,
      }),
    "positive safe-integer timeoutMs",
  );
  TestValidator.predicate(
    "process adapters pass the exact brief on stdin without exposing archive paths",
    result.stdout === "process complete" &&
      result.generation.toolCalls === 1 &&
      fs.readFileSync(path.join(project, "received-brief.md"), "utf8") ===
        context.scenario.brief &&
      spawnFailure.includes("could not complete") &&
      exitFailure.includes("exited 2") &&
      timeoutFailure.includes("could not complete"),
  );
};

const exerciseProviderAdapters = async (root: string): Promise<void> => {
  const project = path.join(root, "provider-adapters");
  const inputRoot = path.join(project, ".automovie-benchmark");
  fs.mkdirSync(inputRoot, { recursive: true });
  const context = {
    scenario: getAutoMovieBenchmarkScenario("short/austerlitz-teaser"),
    lane: "deterministic" as const,
    project,
    taskPath: path.join(inputRoot, "task.json"),
    briefPath: path.join(inputRoot, "brief.md"),
  };
  fs.writeFileSync(context.taskPath, "{}");
  fs.writeFileSync(context.briefPath, context.scenario.brief);
  const launched: IAutoMovieBenchmarkProcessAgentInput[] = [];
  const stdout = [
    "not-json",
    JSON.stringify({ type: "thread.started" }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "command_execution" },
      usage: { input_tokens: 12, output_tokens: 5 },
    }),
  ].join("\n");
  const processAgent =
    (
      output: string,
    ): ((
      input: IAutoMovieBenchmarkProcessAgentInput,
    ) => AutoMovieBenchmarkAgent) =>
    (input) =>
    async () => {
      launched.push(input);
      return {
        stdout: output,
        stderr: "",
        generation: input.generation!(output, "", 2),
      };
    };

  createCodexAutoMovieBenchmarkAgent({
    mcp: { command: "mcp" },
    timeoutMs: 1,
  });
  expectErrorMessage(
    "provider adapters validate provider commands",
    () =>
      createCodexAutoMovieBenchmarkAgent({
        command: " ",
        mcp: { command: "mcp" },
        timeoutMs: 1,
      }),
    "non-blank provider/MCP commands",
  );
  expectErrorMessage(
    "provider adapters validate MCP commands and timeout",
    () =>
      createCodexAutoMovieBenchmarkAgent({
        command: "codex",
        mcp: { command: " " },
        timeoutMs: 1,
      }),
    "non-blank provider/MCP commands",
  );
  expectErrorMessage(
    "provider adapters require an integer timeout",
    () =>
      createCodexAutoMovieBenchmarkAgent({
        command: "codex",
        mcp: { command: "mcp" },
        timeoutMs: 1.5,
      }),
    "positive safe-integer timeoutMs",
  );
  expectErrorMessage(
    "provider adapters require a positive timeout",
    () =>
      createCodexAutoMovieBenchmarkAgent({
        command: "codex",
        mcp: { command: "mcp" },
        timeoutMs: 0,
      }),
    "positive safe-integer timeoutMs",
  );
  expectErrorMessage(
    "provider adapters refuse non-portable environment keys",
    () =>
      createClaudeCodeAutoMovieBenchmarkAgent({
        mcp: { command: "mcp", env: { "bad.key": "value" } },
        timeoutMs: 1,
      }),
    "not portable",
  );
  const codex = await createCodexAutoMovieBenchmarkAgent({
    model: "codex-model",
    mcp: {
      command: "mcp-command",
      args: ["serve"],
      env: { BENCHMARK_MODE: "1" },
    },
    timeoutMs: 30_000,
    dangerouslyBypassSandbox: true,
    processAgent: processAgent(stdout),
  })(context);
  await createCodexAutoMovieBenchmarkAgent({
    command: "codex-custom",
    mcp: { command: "mcp-command" },
    timeoutMs: 30_000,
    processAgent: processAgent("{}"),
  })(context);

  createClaudeCodeAutoMovieBenchmarkAgent({
    mcp: { command: "mcp" },
    timeoutMs: 1,
  });
  const claude = await createClaudeCodeAutoMovieBenchmarkAgent({
    model: "claude-model",
    effort: "high",
    mcp: {
      command: "mcp-command",
      args: ["serve"],
      env: { BENCHMARK_MODE: "1" },
    },
    timeoutMs: 30_000,
    dangerouslyBypassPermissions: true,
    processAgent: processAgent(
      JSON.stringify({
        num_turns: 3,
        total_cost_usd: 0.25,
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
    ),
  })(context);
  await createClaudeCodeAutoMovieBenchmarkAgent({
    command: "claude-custom",
    mcp: { command: "mcp-command" },
    timeoutMs: 30_000,
    processAgent: processAgent("not-json"),
  })(context);
  await createClaudeCodeAutoMovieBenchmarkAgent({
    mcp: { command: "mcp-command" },
    timeoutMs: 30_000,
    processAgent: processAgent(JSON.stringify({ usage: null })),
  })(context);

  const codexInput = launched[0]!;
  const claudeInput = launched[2]!;
  const claudeConfig = readJson<{
    mcpServers: {
      automovie: {
        command: string;
        args: string[];
        env: Record<string, string>;
      };
    };
  }>(path.join(inputRoot, "claude-mcp.json"));
  TestValidator.predicate(
    "concrete provider adapters fix MCP configuration and parse non-scoring usage",
    codex.generation.toolCalls === 1 &&
      codex.generation.inputTokens === 12 &&
      codex.generation.outputTokens === 5 &&
      codexInput.command === "codex" &&
      codexInput.args?.includes(
        "--dangerously-bypass-approvals-and-sandbox",
      ) === true &&
      codexInput.args?.includes(
        'mcp_servers.automovie.env.BENCHMARK_MODE="1"',
      ) === true &&
      claude.generation.toolCalls === 3 &&
      claude.generation.costUsd === 0.25 &&
      claudeInput.command === "claude" &&
      claudeInput.args?.includes("bypassPermissions") === true &&
      claudeConfig.mcpServers.automovie.command === "mcp-command" &&
      claudeConfig.mcpServers.automovie.env.AUTOMOVIE_PROJECT_ROOT === project,
  );
};

const exerciseSnapshotLink = (root: string): void => {
  const project = path.join(root, "snapshot-project");
  const target = path.join(project, "linked-target");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "evidence.txt"), "evidence");
  const linked = path.join(project, "linked-view");
  fs.symlinkSync(
    target,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  try {
    TestValidator.predicate(
      "project snapshots record links without following them",
      snapshotAutoMovieBenchmarkProject(project).entries.some(
        (entry) => entry.kind === "link" && entry.path === "linked-view",
      ),
    );
  } finally {
    fs.unlinkSync(linked);
  }
};

const emptyEvidence = (): IAutoMovieBenchmarkCollectedEvidence => ({
  lifecycle: [],
  observations: {},
  frames: [],
  deliverables: [],
  finishedRuntimeSeconds: null,
  trace: [],
});

const unreachableAgent: AutoMovieBenchmarkAgent = async () => {
  throw new Error("agent should not run");
};

const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8")) as T;

const rejected = async (closure: () => Promise<unknown>): Promise<string> => {
  try {
    await closure();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};
