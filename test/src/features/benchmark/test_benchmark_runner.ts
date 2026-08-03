import {
  IAutoMovieBenchmarkGateResult,
  IAutoMovieBenchmarkMcpSession,
  austerlitzSignalDraft,
  austerlitzTeaserDraft,
  digestAutoMovieBenchmarkBytes,
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
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
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

// A clean CI checkout starts this fixture through ttsx, so initialize includes
// the MCP project's cold typecheck and source-dependency emit. Keep the live
// protocol probe bounded without treating that compile as a 30-second request.
const SOURCE_MCP_STARTUP_TIMEOUT_MS = 120_000;

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

interface IBenchmarkRunnerFixtureFailure {
  error: unknown;
}

class BenchmarkRunnerFixtureCleanupError extends AggregateError {}

/** Remove the runner fixture root without replacing an earlier failure. */
export const preserveBenchmarkRunnerFixtureCleanup = (
  failure: IBenchmarkRunnerFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new BenchmarkRunnerFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Benchmark runner fixture cleanup failed after the benchmark failed.",
    );
  }
};

interface IBenchmarkRunnerHookCleanup {
  cleanup: () => unknown;
  resource: string;
}

class BenchmarkRunnerHookCleanupError extends AggregateError {}

/** Attempt every benchmark harness hook restoration without hiding failure. */
export const preserveBenchmarkRunnerHookCleanup = (
  failure: IBenchmarkRunnerFixtureFailure | undefined,
  resources: readonly IBenchmarkRunnerHookCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new BenchmarkRunnerHookCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Benchmark runner hook cleanup failed${
        failure === undefined ? "" : " after the benchmark failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

interface IBenchmarkRunnerResidentCleanup {
  cleanup: () => unknown;
  resource: string;
}

class BenchmarkRunnerResidentCleanupError extends AggregateError {}

/** Attempt every benchmark resident recovery without hiding failure. */
export const preserveBenchmarkRunnerResidentCleanup = (
  failure: IBenchmarkRunnerFixtureFailure | undefined,
  resources: readonly IBenchmarkRunnerResidentCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new BenchmarkRunnerResidentCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Benchmark runner resident cleanup failed${
        failure === undefined ? "" : " after the guarded operation failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/** The runner is exercised without invoking a model or network service. */
export const test_benchmark_runner = async (): Promise<void> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-runner-test-"));
  let benchmarkFailure: IBenchmarkRunnerFixtureFailure | undefined;
  try {
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
      startupTimeoutMs: SOURCE_MCP_STARTUP_TIMEOUT_MS,
    });
    const archivedBaseline = {
      surface: "legacy-compact" as const,
      provenance: "@automovie/mcp:legacy-compact:archived",
      probe: async (): Promise<IAutoMovieBenchmarkMcpSession> =>
        austerlitzSignalDraft("legacy-compact").mcp,
    };
    const agent = materializingAgent(current.generation);
    const nativeArchiveRead = fs.readFileSync;
    let archiveTaskPathRead = false;
    let archiveTaskParked: string | null = null;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const resolved =
        typeof file === "number" ? null : path.resolve(file.toString());
      if (
        resolved !== null &&
        path.basename(resolved) === "task.json" &&
        [".pending-", ".publishing-"].some((prefix) =>
          path.basename(path.dirname(resolved)).startsWith(prefix),
        )
      ) {
        archiveTaskPathRead = true;
        const parked = `${resolved}.read-parked`;
        archiveTaskParked = parked;
        const resident = nativeArchiveRead(resolved);
        fs.renameSync(resolved, parked);
        fs.writeFileSync(resolved, resident);
        let archiveTaskReadFailure: IBenchmarkRunnerFixtureFailure | undefined;
        try {
          return Reflect.apply(nativeArchiveRead, fs, [file, ...args]);
        } catch (error) {
          archiveTaskReadFailure = { error };
          throw error;
        } finally {
          preserveBenchmarkRunnerResidentCleanup(archiveTaskReadFailure, [
            {
              resource: "archive-task transient",
              cleanup: () => fs.rmSync(resolved),
            },
            {
              resource: "archive-task resident",
              cleanup: () => fs.renameSync(parked, resolved),
            },
            {
              resource: "archive-task parked marker",
              cleanup: () => {
                if (fs.existsSync(parked) === false) archiveTaskParked = null;
              },
            },
          ]);
        }
      }
      return Reflect.apply(nativeArchiveRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    const output = await (async () => {
      let archiveRunFailure: IBenchmarkRunnerFixtureFailure | undefined;
      try {
        return await runAutoMovieBenchmark({
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
      } catch (error) {
        archiveRunFailure = { error };
        throw error;
      } finally {
        const parked = archiveTaskParked as string | null;
        preserveBenchmarkRunnerResidentCleanup(archiveRunFailure, [
          {
            resource: "archive-task read hook",
            cleanup: () => {
              fs.readFileSync = nativeArchiveRead;
            },
          },
          ...(parked === null
            ? []
            : [
                {
                  resource: "archive-task fallback transient",
                  cleanup: () => {
                    if (fs.existsSync(parked))
                      fs.rmSync(parked.slice(0, -".read-parked".length), {
                        force: true,
                      });
                  },
                },
                {
                  resource: "archive-task fallback resident",
                  cleanup: () => {
                    if (fs.existsSync(parked))
                      fs.renameSync(
                        parked,
                        parked.slice(0, -".read-parked".length),
                      );
                  },
                },
              ]),
        ]);
      }
    })();
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
    const workspaceMarker = fs.readFileSync(
      path.join(output.archive, "project", "automovie.config.ts"),
      "utf8",
    );
    const toolSessions = readJson<
      Array<{
        provenance: string;
        session: IAutoMovieBenchmarkMcpSession | null;
        error: string | null;
      }>
    >(path.join(output.archive, "tool-sessions.json"));
    const liveObservation = toolSessions.find(
      (session) => session.provenance === "@automovie/mcp:workspace",
    );
    if (liveObservation?.session === null || liveObservation === undefined)
      throw new Error(
        `Live MCP inventory probe failed: ${
          liveObservation === undefined
            ? "current observation is absent"
            : (liveObservation.error ?? "probe supplied no error detail")
        }`,
      );
    const replay = replayAutoMovieBenchmarkTrace(
      fs.readFileSync(path.join(output.archive, "trace/oracle.jsonl.gz")),
    );
    TestValidator.predicate(
      "one scenario id publishes runner-owned evidence and live MCP inventory",
      archiveTaskPathRead === false &&
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
        projectTree.entries.some(
          (entry) =>
            entry.kind === "file" && entry.path === "automovie.config.ts",
        ) &&
        workspaceMarker ===
          `/**
 * Runner-owned workspace marker. Replace it during benchmark project bootstrap.
 */
export {};
` &&
        submission.edits.some(
          (edit) => edit.path === "receipts/observations.json",
        ) &&
        submission.edits.some((edit) => edit.path === "src/film.ts") &&
        submission.edits.every((edit) => edit.path !== "automovie.config.ts") &&
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
        liveObservation.session.tools.length === 5 &&
        output.toolInventory.surfaces.find(
          (surface) => surface.surface === "five-tool",
        )?.tools === liveObservation.session.tools.length &&
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

    const archiveCommit = path.join(
      path.dirname(output.archive),
      `.archive-${path.basename(output.archive)}.commit.json`,
    );
    const archiveCommitBytes = fs.readFileSync(archiveCommit);
    fs.writeFileSync(archiveCommit, "{}\n");
    const mismatchedCommit = await rejected(() =>
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
    fs.writeFileSync(archiveCommit, archiveCommitBytes);
    TestValidator.predicate(
      "an archive commit must bind the resident directory identity",
      mismatchedCommit.includes(
        "does not bind the resident content-addressed directory",
      ),
    );

    await exerciseArchivePublicationRaces({
      taskId: current.taskId,
      lane: "deterministic",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      inventoryBaselines: [archivedBaseline],
      agent,
      collect: collectCompleteEvidence,
    });
    await exerciseArchiveCommitPointRaces({
      taskId: current.taskId,
      lane: "deterministic",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      inventoryBaselines: [archivedBaseline],
      agent,
      collect: collectCompleteEvidence,
    });
    await exerciseArchivePublicationSealRaces({
      taskId: current.taskId,
      lane: "deterministic",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      inventoryBaselines: [archivedBaseline],
      agent,
      collect: collectCompleteEvidence,
    });
    await exerciseArchiveVerifierRecordRace({
      taskId: current.taskId,
      lane: "deterministic",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      inventoryBaselines: [archivedBaseline],
      agent,
      collect: collectCompleteEvidence,
    });
    await exerciseArchiveShapeLinks({
      taskId: current.taskId,
      lane: "deterministic",
      runRoot: root,
      repositoryRoot,
      identity,
      mcpTarget,
      inventoryBaselines: [archivedBaseline],
      agent,
      collect: collectCompleteEvidence,
    });

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
  } catch (error) {
    benchmarkFailure = { error };
    throw error;
  } finally {
    preserveBenchmarkRunnerFixtureCleanup(benchmarkFailure, () =>
      fs.rmSync(root, {
        force: true,
        maxRetries: 3,
        recursive: true,
        retryDelay: 100,
      }),
    );
  }
};

const exerciseArchivePublicationRaces = async (
  base: Omit<Parameters<typeof runAutoMovieBenchmark>[0], "campaign">,
): Promise<void> => {
  for (const phase of ["staging", "record", "final"] as const) {
    const campaign = `publication-${phase}-race`;
    const campaignPath = path.join(
      path.resolve(base.runRoot),
      ".benchmarks",
      campaign,
    );
    const nativeRename = fs.renameSync;
    let swapped = false;
    let parked: string | undefined;
    let movedTo: string | undefined;
    fs.renameSync = ((oldPath, newPath) => {
      const oldName = path.basename(oldPath.toString());
      const newName = path.basename(newPath.toString());
      const matches =
        swapped === false &&
        (phase === "staging"
          ? oldName.startsWith(".pending-") &&
            newName.startsWith(".publishing-")
          : phase === "record"
            ? oldName.startsWith(".pending-") &&
              newName.startsWith(".publishing-")
            : oldName.startsWith(".publishing-") &&
              /^[0-9a-f]{64}$/u.test(newName));
      if (matches) {
        swapped = true;
        movedTo = newPath.toString();
        if (phase === "record") {
          nativeRename(oldPath, newPath);
          fs.writeFileSync(
            path.join(newPath.toString(), "submission.json"),
            "{}\n",
          );
          return;
        }
        parked = `${oldPath.toString()}.original-parked`;
        nativeRename(oldPath, parked);
        if (phase === "staging") {
          fs.mkdirSync(oldPath);
          fs.writeFileSync(
            path.join(oldPath.toString(), "replacement.txt"),
            "replacement staging directory",
          );
        } else
          fs.cpSync(parked, oldPath.toString(), {
            recursive: true,
            dereference: false,
            verbatimSymlinks: true,
          });
      }
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let message: string;
    let archivePublicationFailure: IBenchmarkRunnerFixtureFailure | undefined;
    try {
      message = await rejected(() =>
        runAutoMovieBenchmark({ ...base, campaign }),
      );
    } catch (error) {
      archivePublicationFailure = { error };
      throw error;
    } finally {
      preserveBenchmarkRunnerHookCleanup(archivePublicationFailure, [
        {
          resource: "archive-publication rename hook",
          cleanup: () => {
            fs.renameSync = nativeRename;
          },
        },
      ]);
    }
    const retryMessage =
      phase === "final"
        ? await rejected(() => runAutoMovieBenchmark({ ...base, campaign }))
        : "";
    const contentArchives = fs.existsSync(campaignPath)
      ? fs
          .readdirSync(campaignPath)
          .filter((entry) => /^[0-9a-f]{64}$/u.test(entry))
      : [];
    const commitRecords = fs.existsSync(campaignPath)
      ? fs
          .readdirSync(campaignPath)
          .filter((entry) =>
            /^\.archive-[0-9a-f]{64}\.commit\.json$/u.test(entry),
          )
      : [];
    TestValidator.predicate(
      `archive publication rejects a ${phase} identity replacement`,
      swapped &&
        message.includes(
          phase === "staging"
            ? "physical directory selected for publication"
            : phase === "record"
              ? 'archive record "submission.json" changed'
              : "physical directory selected for publication",
        ) &&
        contentArchives.length === (phase === "final" ? 1 : 0) &&
        commitRecords.length === 0 &&
        (phase !== "final" ||
          (movedTo !== undefined &&
            fs.existsSync(movedTo) &&
            retryMessage.includes("is not committed") &&
            retryMessage.includes("already archived") === false)),
    );
    if (parked !== undefined)
      fs.rmSync(parked, { recursive: true, force: true });
    fs.rmSync(campaignPath, { recursive: true, force: true });
  }
};

const exerciseArchiveCommitPointRaces = async (
  base: Omit<Parameters<typeof runAutoMovieBenchmark>[0], "campaign">,
): Promise<void> => {
  for (const phase of [
    "tree",
    "late-tree",
    "late-byte",
    "record",
    "record-content",
    "record-bytes",
    "record-run",
    "commit-directory",
    "commit-link",
  ] as const) {
    const campaign = `publication-commit-${phase}-race`;
    const campaignPath = path.join(
      path.resolve(base.runRoot),
      ".benchmarks",
      campaign,
    );
    const output = await runAutoMovieBenchmark({ ...base, campaign });
    const archive = output.archive;
    const commitPath = path.join(
      path.dirname(archive),
      `.archive-${path.basename(archive)}.commit.json`,
    );
    const commitBytes = fs.readFileSync(commitPath);
    if (phase === "tree")
      fs.writeFileSync(
        path.join(archive, "unexpected-entry.txt"),
        "post-commit archive mutation",
      );
    else if (phase === "late-tree")
      fs.mkdirSync(path.join(archive, "unexpected-empty-directory"));
    else if (phase === "late-byte")
      fs.writeFileSync(path.join(archive, "task.json"), "{}\n");
    else if (phase === "record-bytes") fs.writeFileSync(commitPath, "{}\n");
    else if (phase === "record-run") {
      const record = JSON.parse(commitBytes.toString("utf8")) as {
        runId: string;
      };
      record.runId = `sha256:${"0".repeat(64)}`;
      fs.writeFileSync(commitPath, `${JSON.stringify(record)}\n`);
    } else {
      fs.unlinkSync(commitPath);
      if (phase === "record") fs.writeFileSync(commitPath, commitBytes);
      else if (phase === "record-content") fs.writeFileSync(commitPath, "{}\n");
      else if (phase === "commit-directory") fs.mkdirSync(commitPath);
      else
        fs.symlinkSync(
          archive,
          commitPath,
          process.platform === "win32" ? "junction" : "dir",
        );
    }
    const message = await rejected(() =>
      runAutoMovieBenchmark({ ...base, campaign }),
    );
    TestValidator.predicate(
      `archive commit rejects a ${phase} resident mutation`,
      message.includes(
        phase === "late-byte"
          ? "task law or brief changed"
          : phase === "commit-directory" || phase === "commit-link"
            ? "is not a physical file"
            : "does not bind the resident content-addressed directory",
      ),
    );
    fs.rmSync(campaignPath, { recursive: true, force: true });
  }
};

const exerciseArchivePublicationSealRaces = async (
  base: Omit<Parameters<typeof runAutoMovieBenchmark>[0], "campaign">,
): Promise<void> => {
  for (const phase of [
    "content",
    "publication-record",
    "final-record",
  ] as const) {
    const campaign = `publication-seal-${phase}-race`;
    const campaignPath = path.join(
      path.resolve(base.runRoot),
      ".benchmarks",
      campaign,
    );
    const nativeWrite = fs.writeFileSync;
    const nativeOpen = fs.openSync;
    const nativeRead = fs.readFileSync;
    let swapped = false;
    let commitPath: string | undefined;
    let commitDescriptor: number | undefined;
    if (phase === "content")
      fs.writeFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): unknown => {
        const output = Reflect.apply(nativeWrite, fs, [file, ...args]);
        if (
          swapped === false &&
          typeof file !== "number" &&
          path.basename(file.toString()) === ".archive-commit.json" &&
          path
            .basename(path.dirname(file.toString()))
            .startsWith(".publishing-")
        ) {
          nativeWrite(
            path.join(path.dirname(file.toString()), "unexpected-late-file"),
            "late publication content",
          );
          swapped = true;
        }
        return output;
      }) as typeof fs.writeFileSync;
    else {
      fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
        const resolved = path.resolve(file.toString());
        const parent = path.basename(path.dirname(resolved));
        const matches =
          path.basename(resolved) === ".archive-commit.json" &&
          (phase === "publication-record"
            ? parent.startsWith(".publishing-")
            : /^[0-9a-f]{64}$/u.test(parent));
        const descriptor = Reflect.apply(nativeOpen, fs, [
          file,
          ...args,
        ]) as number;
        if (
          matches &&
          commitDescriptor === undefined &&
          commitPath === undefined
        ) {
          commitPath = resolved;
          commitDescriptor = descriptor;
        }
        return descriptor;
      }) as typeof fs.openSync;
      fs.readFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...args: unknown[]
      ): unknown => {
        const bytes = Reflect.apply(nativeRead, fs, [file, ...args]);
        if (
          swapped === false &&
          typeof file === "number" &&
          file === commitDescriptor &&
          commitPath !== undefined
        ) {
          nativeWrite(commitPath, "{}\n");
          swapped = true;
        }
        return bytes;
      }) as typeof fs.readFileSync;
    }
    let message: string;
    let archiveSealFailure: IBenchmarkRunnerFixtureFailure | undefined;
    try {
      message = await rejected(() =>
        runAutoMovieBenchmark({ ...base, campaign }),
      );
    } catch (error) {
      archiveSealFailure = { error };
      throw error;
    } finally {
      preserveBenchmarkRunnerHookCleanup(archiveSealFailure, [
        {
          resource: "archive-seal write hook",
          cleanup: () => {
            fs.writeFileSync = nativeWrite;
          },
        },
        {
          resource: "archive-seal open hook",
          cleanup: () => {
            fs.openSync = nativeOpen;
          },
        },
        {
          resource: "archive-seal read hook",
          cleanup: () => {
            fs.readFileSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.predicate(
      `archive publication rejects a ${phase} seal mutation`,
      swapped &&
        message.includes(
          phase === "content"
            ? "content changed while its publication record was prepared"
            : "changed before publication",
        ),
    );
    fs.rmSync(campaignPath, { recursive: true, force: true });
  }
};

const exerciseArchiveVerifierRecordRace = async (
  base: Omit<Parameters<typeof runAutoMovieBenchmark>[0], "campaign">,
): Promise<void> => {
  const campaign = "publication-verifier-record-race";
  const campaignPath = path.join(
    path.resolve(base.runRoot),
    ".benchmarks",
    campaign,
  );
  const output = await runAutoMovieBenchmark({ ...base, campaign });
  const commitPath = path.join(
    path.dirname(output.archive),
    `.archive-${path.basename(output.archive)}.commit.json`,
  );
  const nativeOpen = fs.openSync;
  const nativeRead = fs.readFileSync;
  const nativeWrite = fs.writeFileSync;
  let descriptor: number | undefined;
  let swapped = false;
  fs.openSync = ((file: fs.PathLike, ...args: unknown[]): number => {
    const opened = Reflect.apply(nativeOpen, fs, [file, ...args]) as number;
    if (
      descriptor === undefined &&
      path.resolve(file.toString()) === commitPath
    )
      descriptor = opened;
    return opened;
  }) as typeof fs.openSync;
  fs.readFileSync = ((
    file: fs.PathOrFileDescriptor,
    ...args: unknown[]
  ): unknown => {
    const bytes = Reflect.apply(nativeRead, fs, [file, ...args]);
    if (swapped === false && typeof file === "number" && file === descriptor) {
      nativeWrite(commitPath, "{}\n");
      swapped = true;
    }
    return bytes;
  }) as typeof fs.readFileSync;
  let message: string;
  let archiveVerifierFailure: IBenchmarkRunnerFixtureFailure | undefined;
  try {
    message = await rejected(() =>
      runAutoMovieBenchmark({ ...base, campaign }),
    );
  } catch (error) {
    archiveVerifierFailure = { error };
    throw error;
  } finally {
    preserveBenchmarkRunnerHookCleanup(archiveVerifierFailure, [
      {
        resource: "archive-verifier open hook",
        cleanup: () => {
          fs.openSync = nativeOpen;
        },
      },
      {
        resource: "archive-verifier read hook",
        cleanup: () => {
          fs.readFileSync = nativeRead;
        },
      },
    ]);
  }
  TestValidator.predicate(
    "archive verifier rejects a commit record changed after descriptor read",
    swapped &&
      message.includes(
        "does not bind the resident content-addressed directory",
      ),
  );
  fs.rmSync(campaignPath, { recursive: true, force: true });
};

const exerciseArchiveShapeLinks = async (
  base: Omit<Parameters<typeof runAutoMovieBenchmark>[0], "campaign">,
): Promise<void> => {
  for (const phase of ["stable", "replaced"] as const) {
    const campaign = `publication-shape-link-${phase}`;
    const campaignPath = path.join(
      path.resolve(base.runRoot),
      ".benchmarks",
      campaign,
    );
    const nativeReadDirectory = fs.readdirSync;
    const nativeReadLink = fs.readlinkSync;
    let installed = false;
    let swapped = false;
    let linkPath: string | undefined;
    fs.readdirSync = ((directory: fs.PathLike, ...args: unknown[]): unknown => {
      const resolved = path.resolve(directory.toString());
      if (
        installed === false &&
        path.basename(resolved).startsWith(".publishing-")
      ) {
        linkPath = path.join(resolved, "archive-shape-link");
        fs.symlinkSync(
          path.join(resolved, "project"),
          linkPath,
          process.platform === "win32" ? "junction" : "dir",
        );
        installed = true;
      }
      return Reflect.apply(nativeReadDirectory, fs, [directory, ...args]);
    }) as typeof fs.readdirSync;
    if (phase === "replaced")
      fs.readlinkSync = ((file: fs.PathLike, ...args: unknown[]): unknown => {
        const target = Reflect.apply(nativeReadLink, fs, [file, ...args]);
        if (
          swapped === false &&
          linkPath !== undefined &&
          path.resolve(file.toString()) === linkPath
        ) {
          const parked = `${linkPath}.parked`;
          fs.renameSync(linkPath, parked);
          fs.symlinkSync(
            path.join(path.dirname(linkPath), "transcript"),
            linkPath,
            process.platform === "win32" ? "junction" : "dir",
          );
          swapped = true;
        }
        return target;
      }) as typeof fs.readlinkSync;
    let message = "";
    let archiveShapeFailure: IBenchmarkRunnerFixtureFailure | undefined;
    try {
      if (phase === "stable")
        await runAutoMovieBenchmark({ ...base, campaign });
      else
        message = await rejected(() =>
          runAutoMovieBenchmark({ ...base, campaign }),
        );
    } catch (error) {
      archiveShapeFailure = { error };
      throw error;
    } finally {
      preserveBenchmarkRunnerHookCleanup(archiveShapeFailure, [
        {
          resource: "archive-shape readdir hook",
          cleanup: () => {
            fs.readdirSync = nativeReadDirectory;
          },
        },
        {
          resource: "archive-shape readlink hook",
          cleanup: () => {
            fs.readlinkSync = nativeReadLink;
          },
        },
      ]);
    }
    TestValidator.predicate(
      `archive shape ${phase === "stable" ? "records" : "rejects"} a physical link identity`,
      installed &&
        (phase === "stable" ||
          (swapped && message.includes("changed physical identity"))),
    );
    fs.rmSync(campaignPath, { recursive: true, force: true });
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
  const nativeClientClose = Client.prototype.close;
  const cleanupFailure = new Error("synthetic MCP client cleanup failure");
  let cleanupOnlyFailure: unknown = null;
  let combinedProbeFailure: unknown = null;
  Client.prototype.close = function (): Promise<void> {
    const closed = Reflect.apply(nativeClientClose, this, []).then(() => {
      throw cleanupFailure;
    });
    // The SDK abandons one close() promise when initialize fails
    // (`void this.close()` in Client.connect), so the injected rejection is
    // observed here as well. Every awaiting caller still receives this exact
    // object; without the observer the abandoned rejection reaches the
    // process-wide unhandledRejection handler h264-mp4-encoder installs, which
    // aborts the whole suite instead of failing this scenario.
    void closed.catch(() => {});
    return closed;
  };
  let mcpProbeHarnessFailure: IBenchmarkRunnerFixtureFailure | undefined;
  try {
    cleanupOnlyFailure = await rejectedValue(() =>
      mcpTarget.probe({
        scenario: getAutoMovieBenchmarkScenario("short/austerlitz-teaser"),
        project: root,
      }),
    );
    combinedProbeFailure = await rejectedValue(() =>
      missingMcp.probe({
        scenario: getAutoMovieBenchmarkScenario("short/austerlitz-teaser"),
        project: root,
      }),
    );
  } catch (error) {
    mcpProbeHarnessFailure = { error };
    throw error;
  } finally {
    preserveBenchmarkRunnerHookCleanup(mcpProbeHarnessFailure, [
      {
        resource: "MCP-probe client-close hook",
        cleanup: () => {
          Client.prototype.close = nativeClientClose;
        },
      },
    ]);
  }
  // Name every observed failure instead of collapsing the contract into one
  // boolean: a mismatch has to report which failure arrived and from where.
  const describeProbeFailure = (value: unknown): unknown =>
    value === cleanupFailure
      ? "cleanup-failure"
      : value instanceof AggregateError
        ? {
            errors: value.errors.map(describeProbeFailure),
            kind: "aggregate",
          }
        : value instanceof Error
          ? value.message.includes('MCP probe "missing-process" failed')
            ? 'MCP probe "missing-process" failed'
            : { kind: "error", message: value.message }
          : { kind: typeof value, value: String(value) };
  TestValidator.equals(
    "process MCP probes preserve cleanup failures",
    {
      cleanupOnly: describeProbeFailure(cleanupOnlyFailure),
      combined: describeProbeFailure(combinedProbeFailure),
    },
    {
      cleanupOnly: "cleanup-failure",
      combined: {
        errors: ['MCP probe "missing-process" failed', "cleanup-failure"],
        kind: "aggregate",
      },
    },
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
  expectErrorMessage(
    "process MCP targets require a positive startup timeout",
    () =>
      createProcessAutoMovieBenchmarkMcpTarget({
        surface: "five-tool",
        provenance: "target",
        command: "mcp",
        timeoutMs: 1,
        startupTimeoutMs: 0,
      }),
    "startupTimeoutMs",
  );
  expectErrorMessage(
    "process MCP targets require an integer startup timeout",
    () =>
      createProcessAutoMovieBenchmarkMcpTarget({
        surface: "five-tool",
        provenance: "target",
        command: "mcp",
        timeoutMs: 1,
        startupTimeoutMs: 1.5,
      }),
    "startupTimeoutMs",
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
  const evidence = path.join(target, "evidence.txt");
  fs.writeFileSync(evidence, "evidence");
  const linked = path.join(project, "linked-view");
  fs.symlinkSync(
    target,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  let snapshotLinkFailure: IBenchmarkRunnerFixtureFailure | undefined;
  try {
    const resident = fs.readFileSync(evidence);
    const parked = `${evidence}.parked`;
    const nativeRead = fs.readFileSync;
    let pathnameRead = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === path.resolve(evidence)
      ) {
        pathnameRead = true;
        fs.renameSync(evidence, parked);
        fs.writeFileSync(evidence, "transient benchmark evidence");
        let snapshotReadFailure: IBenchmarkRunnerFixtureFailure | undefined;
        try {
          return Reflect.apply(nativeRead, fs, [file, ...args]);
        } catch (error) {
          snapshotReadFailure = { error };
          throw error;
        } finally {
          preserveBenchmarkRunnerResidentCleanup(snapshotReadFailure, [
            {
              resource: "snapshot transient evidence",
              cleanup: () => fs.rmSync(evidence),
            },
            {
              resource: "snapshot parked evidence",
              cleanup: () => fs.renameSync(parked, evidence),
            },
          ]);
        }
      }
      return Reflect.apply(nativeRead, fs, [file, ...args]);
    }) as typeof fs.readFileSync;
    const snapshot = (() => {
      let snapshotFailure: IBenchmarkRunnerFixtureFailure | undefined;
      try {
        return snapshotAutoMovieBenchmarkProject(project);
      } catch (error) {
        snapshotFailure = { error };
        throw error;
      } finally {
        preserveBenchmarkRunnerResidentCleanup(snapshotFailure, [
          {
            resource: "snapshot read hook",
            cleanup: () => {
              fs.readFileSync = nativeRead;
            },
          },
          {
            resource: "snapshot fallback transient evidence",
            cleanup: () => {
              if (fs.existsSync(parked)) fs.rmSync(evidence, { force: true });
            },
          },
          {
            resource: "snapshot fallback parked evidence",
            cleanup: () => {
              if (fs.existsSync(parked)) fs.renameSync(parked, evidence);
            },
          },
        ]);
      }
    })();
    const evidenceEntry = snapshot.entries.find(
      (entry) => entry.path === "linked-target/evidence.txt",
    );
    TestValidator.predicate(
      "project snapshots record links without following them",
      snapshot.entries.some(
        (entry) => entry.kind === "link" && entry.path === "linked-view",
      ),
    );
    TestValidator.predicate(
      "project snapshots bind regular bytes to the verified descriptor",
      pathnameRead === false &&
        evidenceEntry?.kind === "file" &&
        evidenceEntry.bytes === resident.length &&
        evidenceEntry.digest === digestAutoMovieBenchmarkBytes(resident),
    );
  } catch (error) {
    snapshotLinkFailure = { error };
    throw error;
  } finally {
    preserveBenchmarkRunnerResidentCleanup(snapshotLinkFailure, [
      {
        resource: "snapshot linked view",
        cleanup: () => fs.unlinkSync(linked),
      },
    ]);
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

const rejectedValue = async (
  closure: () => Promise<unknown>,
): Promise<unknown> => {
  try {
    await closure();
    return null;
  } catch (error) {
    return error;
  }
};
