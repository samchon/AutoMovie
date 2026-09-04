import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

interface ILocalOwner {
  host: string;
  pid: number;
  generation: string;
}

type LocalOwnerObservation =
  | {
      state: "same-owner" | "absent" | "occupied-or-reused" | "elsewhere";
      owner: ILocalOwner;
    }
  | {
      state: "unknown";
      owner: ILocalOwner | null;
      reason: "invalid-owner" | "process-query-unavailable";
    };

interface IRenderSnapshot {
  target: string;
  bytes: number;
}

interface IRenderChunk {
  id: `sha256:${string}`;
  slot: string;
}

interface RenderChunkRuntimeModule {
  createProductionRenderChunkLeaseRuntime(props: {
    captureExisting: (target: string) => IRenderSnapshot | null;
    host: {
      filesystem: Pick<typeof fs, "existsSync" | "mkdirSync" | "readdirSync">;
      observeProcessOwner: (owner: unknown) => LocalOwnerObservation;
      owner: ILocalOwner;
      randomUuid: () => string;
    };
    quarantine: (
      target: string,
      reason: string,
      snapshot: IRenderSnapshot,
    ) => void;
    readJson: <Value>(snapshot: IRenderSnapshot, maximumBytes: number) => Value;
    remove: (snapshot: IRenderSnapshot) => "lost" | "removed";
    stateRoot: string;
  }): {
    acquire(chunk: IRenderChunk): Promise<boolean>;
    begin(chunk: IRenderChunk): {
      record: { owner: ILocalOwner; state: "running" | "failed" };
    };
    complete(chunk: IRenderChunk): void;
    release(chunk: IRenderChunk): Promise<void>;
  };
}

interface RenderChunkSnapshotModule {
  inventoryRenderChunkGarbage(props: {
    assertReceipt: (chunk: unknown, receipt: unknown) => void;
    chunks: ReadonlyMap<string, unknown>;
    observeProcessOwner: (owner: unknown) => LocalOwnerObservation;
    renderJobRoot: string;
    root: string;
    scope: string;
    tier: "final" | "proxy";
  }): {
    entries: Array<{ candidate: { path: string } }>;
    retainedChunkPaths: string[];
  };
}

interface RenderGcSnapshotModule {
  captureRenderGcTarget(base: string, target: string): IRenderSnapshot;
  readCapturedRenderGcFile(
    snapshot: IRenderSnapshot,
    maximumBytes: number,
  ): Uint8Array;
}

interface RenderLivenessModule {
  acquireRenderSessionLease(props: {
    coordinationRoot: string;
    observeProcessOwner: (owner: unknown) => LocalOwnerObservation;
    owner: ILocalOwner;
    scope: string;
    tier: "proxy" | "final";
  }): { snapshot: IRenderSnapshot };
  acquireRenderGcLease(props: {
    coordinationRoot: string;
    observeProcessOwner: (owner: unknown) => LocalOwnerObservation;
    owner: ILocalOwner;
    scope: string;
  }): { snapshot: IRenderSnapshot };
  releaseRenderLivenessLease(lease: { snapshot: IRenderSnapshot }): boolean;
}

interface RenderOwnerModule {
  observeRenderOwnerRecovery(props: {
    between?: () => void;
    observe: (owner: unknown) => LocalOwnerObservation;
    owner: unknown;
  }): { state: "reclaimable" | "preserved" };
}

interface RenderProcessOwnerModule {
  renderProcessOwnerSuffix(owner: ILocalOwner): string;
  parseRenderProcessOwnerSuffix(value: string): ILocalOwner | null;
}

const GENERATION_A = "11111111-1111-4111-8111-111111111111";
const GENERATION_B = "22222222-2222-4222-8222-222222222222";
const TOKEN_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

interface IScaffoldDependencyLoadFailure {
  error: unknown;
}

class ScaffoldDependencyLoadCleanupError extends AggregateError {}

/** Preserve a module-load failure when its temporary dependency cleanup fails. */
const preserveScaffoldDependencyCleanup = (
  failure: IScaffoldDependencyLoadFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ScaffoldDependencyLoadCleanupError(
      [failure.error, cleanupFailure],
      "Scaffold dependency load and cleanup both failed.",
      { cause: failure.error },
    );
  }
};

/**
 * Scaffold render recovery preserves every owner state except repeated absence.
 *
 * Scenarios:
 *
 * 1. The shared recovery decision requires two absence observations and keeps
 *    occupied-or-reused, unknown, and changed second observations.
 * 2. Complete temporary-tree owner suffixes round-trip while malformed and
 *    non-canonical encodings remain invisible to recovery.
 * 3. Session/GC liveness refuses the exact current generation, preserves an
 *    occupied or malformed guard, and reclaims an unchanged absent guard only
 *    after two observations.
 * 4. Chunk acquisition preserves an occupied foreign generation, reclaims an
 *    absent exact claim after two observations, and uses the same rule before
 *    replacing an abandoned running attempt.
 * 5. GC inventory preserves unknown temporary-tree owners and emits an exact
 *    candidate only after two absence observations around its snapshot fence.
 */
export const test_cli_scaffold_render_owner_state = async (): Promise<void> => {
  // The scaffold becomes its own npm package after generation, while this
  // repository deliberately does not install its runtime dependencies below
  // packages/template/scaffold. Give this source-level consumer the same
  // package boundary for the duration of module loading.
  const scaffoldNodeModules = path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/node_modules",
  );
  const scaffoldPng = path.join(scaffoldNodeModules, "pngjs");
  const installedPng = path.resolve(__dirname, "../../../node_modules/pngjs");
  const removeScaffoldNodeModules =
    fs.existsSync(scaffoldNodeModules) === false;
  fs.mkdirSync(scaffoldNodeModules, { recursive: true });
  const removeScaffoldPng = fs.existsSync(scaffoldPng) === false;
  if (removeScaffoldPng) fs.symlinkSync(installedPng, scaffoldPng, "junction");
  const cleanupScaffoldDependency = (): void => {
    if (removeScaffoldPng) {
      if (
        fs.lstatSync(scaffoldPng).isSymbolicLink() === false ||
        fs.realpathSync.native(scaffoldPng) !==
          fs.realpathSync.native(installedPng)
      )
        throw new Error("Scaffold PNG test dependency changed before cleanup.");
      fs.unlinkSync(scaffoldPng);
    }
    if (removeScaffoldNodeModules) fs.rmdirSync(scaffoldNodeModules);
  };
  let chunkRuntime: RenderChunkRuntimeModule;
  let dependencyLoadFailure: IScaffoldDependencyLoadFailure | undefined;
  try {
    chunkRuntime = loadSourceModule<RenderChunkRuntimeModule>(
      path.resolve(
        __dirname,
        "../../../../packages/template/scaffold/scripts/renderChunkRuntime.ts",
      ),
    );
  } catch (error) {
    dependencyLoadFailure = { error };
    throw error;
  } finally {
    preserveScaffoldDependencyCleanup(
      dependencyLoadFailure,
      cleanupScaffoldDependency,
    );
  }
  const chunkSnapshot = loadSourceModule<RenderChunkSnapshotModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderChunkSnapshot.ts",
    ),
  );
  const gcSnapshot = loadSourceModule<RenderGcSnapshotModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderGcSnapshot.ts",
    ),
  );
  const liveness = loadSourceModule<RenderLivenessModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderLiveness.ts",
    ),
  );
  const ownerState = loadSourceModule<RenderOwnerModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderOwnerState.ts",
    ),
  );
  const processOwner = loadSourceModule<RenderProcessOwnerModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderProcessOwner.ts",
    ),
  );
  const current: ILocalOwner = {
    host: "host-a",
    pid: 17,
    generation: GENERATION_A,
  };
  const foreign: ILocalOwner = {
    ...current,
    pid: 23,
    generation: GENERATION_B,
  };
  const absent = { state: "absent", owner: foreign } as const;
  const occupied = { state: "occupied-or-reused", owner: foreign } as const;
  const unknown = {
    state: "unknown",
    owner: foreign,
    reason: "process-query-unavailable",
  } as const;
  const recovery = (
    observations: Array<typeof absent | typeof occupied | typeof unknown>,
  ) => {
    let calls = 0;
    let fences = 0;
    const decision = ownerState.observeRenderOwnerRecovery({
      between: () => ++fences,
      owner: foreign,
      observe: () => observations[calls++]!,
    });
    return { state: decision.state, calls, fences };
  };
  TestValidator.equals(
    "render owner recovery matrix",
    [
      recovery([absent, absent]),
      recovery([occupied]),
      recovery([unknown]),
      recovery([absent, occupied]),
      recovery([absent, unknown]),
    ],
    [
      { state: "reclaimable", calls: 2, fences: 1 },
      { state: "preserved", calls: 1, fences: 0 },
      { state: "preserved", calls: 1, fences: 0 },
      { state: "preserved", calls: 2, fences: 1 },
      { state: "preserved", calls: 2, fences: 1 },
    ],
  );

  const suffix = processOwner.renderProcessOwnerSuffix(current);
  TestValidator.equals(
    "temporary owner suffix round trips",
    processOwner.parseRenderProcessOwnerSuffix(suffix),
    current,
  );
  TestValidator.equals(
    "malformed temporary owner suffixes refuse",
    [
      "",
      `0.${GENERATION_A}.aG9zdC1h`,
      `1.not-a-generation.aG9zdC1h`,
      `1.${GENERATION_A}.***`,
      `01.${GENERATION_A}.aG9zdC1h`,
    ].map(processOwner.parseRenderProcessOwnerSuffix),
    [null, null, null, null, null],
  );

  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-render-owner-"),
  );
  const scope = "c".repeat(64);
  const observation = (owner: unknown): LocalOwnerObservation => {
    const candidate = owner as ILocalOwner;
    return candidate.host === current.host &&
      candidate.pid === current.pid &&
      candidate.generation === current.generation
      ? { state: "same-owner", owner: current }
      : { state: "occupied-or-reused", owner: foreign };
  };
  try {
    const session = liveness.acquireRenderSessionLease({
      coordinationRoot: root,
      observeProcessOwner: observation,
      owner: current,
      scope,
      tier: "proxy",
    });
    TestValidator.equals(
      "GC refuses the exact current session generation",
      throwsError(
        () =>
          liveness.acquireRenderGcLease({
            coordinationRoot: root,
            observeProcessOwner: observation,
            owner: current,
            scope,
          }),
        ["active render session", `${current.pid}/proxy`],
      ),
      true,
    );
    TestValidator.equals(
      "session remains after refused GC",
      fs.existsSync(session.snapshot.target),
      true,
    );
    liveness.releaseRenderLivenessLease(session);

    const guard = path.join(root, `.automovie-liveness-${scope}.gc-apply.lock`);
    const writeGuard = (owner: unknown): void =>
      fs.writeFileSync(
        guard,
        `${JSON.stringify({ version: 2, kind: "gc", owner, tier: null, token: TOKEN_A })}\n`,
      );
    writeGuard(foreign);
    let occupiedCalls = 0;
    TestValidator.equals(
      "occupied GC owner is preserved",
      throwsError(
        () =>
          liveness.acquireRenderSessionLease({
            coordinationRoot: root,
            observeProcessOwner: (owner) => {
              ++occupiedCalls;
              return {
                state: "occupied-or-reused",
                owner: owner as ILocalOwner,
              };
            },
            owner: current,
            scope,
            tier: "proxy",
          }),
        "cannot be reclaimed (occupied-or-reused)",
      ),
      true,
    );
    TestValidator.equals(
      "occupied guard gets one observation and remains",
      { calls: occupiedCalls, resident: fs.existsSync(guard) },
      { calls: 1, resident: true },
    );
    fs.rmSync(guard);
    fs.writeFileSync(guard, '{"owner":"LIVENESS_OWNER_PAYLOAD_SENTINEL"');
    let malformedGuardMessage = "";
    try {
      liveness.acquireRenderSessionLease({
        coordinationRoot: root,
        observeProcessOwner: observation,
        owner: current,
        scope,
        tier: "proxy",
      });
    } catch (error) {
      malformedGuardMessage = (error as Error).message;
    }
    TestValidator.equals(
      "malformed GC bytes fail closed without exposing their payload",
      {
        refused: malformedGuardMessage.includes("trustworthy owner identity"),
        leaked: malformedGuardMessage.includes(
          "LIVENESS_OWNER_PAYLOAD_SENTINEL",
        ),
        resident: fs.existsSync(guard),
      },
      { refused: true, leaked: false, resident: true },
    );
    fs.rmSync(guard);
    writeGuard({ ...foreign, generation: "invalid" });
    TestValidator.equals(
      "malformed GC owner is not queried or removed",
      throwsError(
        () =>
          liveness.acquireRenderSessionLease({
            coordinationRoot: root,
            observeProcessOwner: () => {
              throw new Error("malformed owner reached observation");
            },
            owner: current,
            scope,
            tier: "proxy",
          }),
        "no trustworthy owner identity",
      ) && fs.existsSync(guard),
      true,
    );
    fs.rmSync(guard);
    writeGuard(foreign);
    let absentGuardCalls = 0;
    const replacementSession = liveness.acquireRenderSessionLease({
      coordinationRoot: root,
      observeProcessOwner: (owner) => {
        ++absentGuardCalls;
        return {
          state: "absent",
          owner: owner as ILocalOwner,
        };
      },
      owner: current,
      scope,
      tier: "final",
    });
    TestValidator.equals(
      "unchanged absent GC guard is reclaimed after two observations",
      { calls: absentGuardCalls, guard: fs.existsSync(guard) },
      { calls: 2, guard: false },
    );
    liveness.releaseRenderLivenessLease(replacementSession);

    const stateRoot = path.join(root, "state");
    fs.mkdirSync(path.join(stateRoot, "locks", "slot"), { recursive: true });
    const digest = `sha256:${"d".repeat(64)}` as const;
    const chunk = {
      id: digest,
      slot: "slot",
    } satisfies IRenderChunk;
    const foreignClaim = path.join(
      stateRoot,
      "locks",
      "slot",
      `claim.${foreign.pid}.${TOKEN_A}.lock`,
    );
    const writeForeignClaim = (): void =>
      fs.writeFileSync(
        foreignClaim,
        `${JSON.stringify({ version: 2, chunk: digest, owner: foreign, token: TOKEN_A })}\n`,
      );
    const captureExisting = (target: string) => {
      try {
        return gcSnapshot.captureRenderGcTarget(stateRoot, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    };
    const readJson = <Value>(
      snapshot: IRenderSnapshot,
      maximumBytes: number,
    ): Value =>
      JSON.parse(
        Buffer.from(
          gcSnapshot.readCapturedRenderGcFile(snapshot, maximumBytes),
        ).toString("utf8"),
      ) as Value;
    const quarantined: string[] = [];
    let leaseObservation: "occupied" | "absent" = "occupied";
    let foreignLeaseCalls = 0;
    let nextToken = 0;
    const lease = chunkRuntime.createProductionRenderChunkLeaseRuntime({
      captureExisting,
      host: {
        filesystem: fs,
        observeProcessOwner: (owner) => {
          const candidate = owner as ILocalOwner;
          if (
            candidate.host === current.host &&
            candidate.pid === current.pid &&
            candidate.generation === current.generation
          )
            return { state: "same-owner", owner: current };
          ++foreignLeaseCalls;
          return leaseObservation === "absent"
            ? { state: "absent", owner: candidate }
            : { state: "occupied-or-reused", owner: candidate };
        },
        owner: current,
        randomUuid: () => (nextToken++ === 0 ? TOKEN_B : TOKEN_A),
      },
      quarantine: (target, reason) => {
        quarantined.push(reason);
        fs.rmSync(target);
      },
      readJson,
      remove: (snapshot) => {
        if (fs.existsSync(snapshot.target) === false) return "lost";
        fs.rmSync(snapshot.target);
        return "removed";
      },
      stateRoot,
    });
    fs.writeFileSync(foreignClaim, '{"owner":"CHUNK_OWNER_PAYLOAD_SENTINEL"');
    let malformedClaimMessage = "";
    try {
      await lease.acquire(chunk);
    } catch (error) {
      malformedClaimMessage = (error as Error).message;
    }
    TestValidator.equals(
      "malformed chunk bytes fail closed without exposing their payload",
      {
        refused: malformedClaimMessage.includes("no readable owner identity"),
        leaked: malformedClaimMessage.includes("CHUNK_OWNER_PAYLOAD_SENTINEL"),
        resident: fs.existsSync(foreignClaim),
      },
      { refused: true, leaked: false, resident: true },
    );
    fs.rmSync(foreignClaim);
    writeForeignClaim();
    TestValidator.equals(
      "chunk acquisition preserves an occupied foreign generation",
      {
        acquired: await lease.acquire(chunk),
        calls: foreignLeaseCalls,
        resident: fs.existsSync(foreignClaim),
      },
      { acquired: false, calls: 1, resident: true },
    );
    leaseObservation = "absent";
    foreignLeaseCalls = 0;
    TestValidator.equals(
      "chunk acquisition reclaims only after two absence observations",
      await lease.acquire(chunk),
      true,
    );
    TestValidator.equals(
      "abandoned lock was fenced and quarantined",
      { calls: foreignLeaseCalls, quarantined },
      { calls: 2, quarantined: ["abandoned-lock"] },
    );
    const attemptPath = path.join(stateRoot, "attempts", "slot.json");
    fs.mkdirSync(path.dirname(attemptPath), { recursive: true });
    fs.writeFileSync(
      attemptPath,
      `${JSON.stringify({ version: 2, slot: "slot", chunk: digest, state: "running", correction: "", owner: foreign, token: TOKEN_A })}\n`,
    );
    foreignLeaseCalls = 0;
    const attempt = lease.begin(chunk);
    TestValidator.equals(
      "running attempt replacement uses the same two-observation fence",
      {
        calls: foreignLeaseCalls,
        generation: attempt.record.owner.generation,
        state: attempt.record.state,
      },
      { calls: 2, generation: current.generation, state: "running" },
    );
    lease.complete(chunk);
    await lease.release(chunk);

    const renderJobRoot = path.join(root, "render-job");
    const temporaryRoot = path.join(renderJobRoot, "proxy", "tmp");
    fs.mkdirSync(temporaryRoot, { recursive: true });
    const treeName = `${"e".repeat(64)}.${TOKEN_A}.${processOwner.renderProcessOwnerSuffix(foreign)}`;
    const tree = path.join(temporaryRoot, treeName);
    fs.mkdirSync(tree);
    fs.writeFileSync(path.join(tree, "partial.bin"), "partial");
    let inventoryCalls = 0;
    const inventory = (
      state: "unknown" | "absent",
    ): ReturnType<RenderChunkSnapshotModule["inventoryRenderChunkGarbage"]> =>
      chunkSnapshot.inventoryRenderChunkGarbage({
        assertReceipt: () => undefined,
        chunks: new Map(),
        observeProcessOwner: (owner) => {
          ++inventoryCalls;
          return state === "absent"
            ? {
                state: "absent",
                owner: owner as ILocalOwner,
              }
            : {
                state: "unknown",
                owner: owner as ILocalOwner,
                reason: "process-query-unavailable",
              };
        },
        renderJobRoot,
        root,
        scope,
        tier: "proxy",
      });
    TestValidator.equals(
      "unknown temporary owner is retained",
      { entries: inventory("unknown").entries.length, calls: inventoryCalls },
      { entries: 0, calls: 1 },
    );
    inventoryCalls = 0;
    TestValidator.equals(
      "absent temporary owner becomes one exact candidate after two observations",
      {
        paths: inventory("absent").entries.map((entry) => entry.candidate.path),
        calls: inventoryCalls,
      },
      { paths: [`proxy/tmp/${treeName}`], calls: 2 },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
