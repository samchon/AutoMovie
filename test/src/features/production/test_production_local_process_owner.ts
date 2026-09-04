import {
  acquireCommitLock,
  inspectCommitLock,
  releaseCommitLock,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

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

interface OwnerModule {
  currentAutoMovieLocalProcessOwner(): ILocalOwner;
  isAutoMovieLocalProcessOwner(value: unknown): value is ILocalOwner;
  observeAutoMovieLocalProcessOwner(props: {
    owner: unknown;
    current: ILocalOwner;
    query: (pid: number, signal: 0) => unknown;
  }): LocalOwnerObservation;
}

interface RenderOwnerModule {
  observeRenderOwnerRecovery(props: {
    owner: unknown;
    observe: (owner: unknown) => LocalOwnerObservation;
  }): { state: "reclaimable" | "preserved" };
}

interface RenderProcessOwnerModule {
  renderProcessOwnerSuffix(owner: ILocalOwner): string;
  parseRenderProcessOwnerSuffix(value: string): ILocalOwner | null;
}

const GENERATION_A = "11111111-1111-4111-8111-111111111111";
const GENERATION_B = "22222222-2222-4222-8222-222222222222";

const platformError = (code: string): Error =>
  Object.assign(new Error(code), { code });

const withCommitProcessQuery = <T>(
  query: (pid: number, signal: 0) => unknown,
  task: () => T,
): T => {
  const original = process.kill;
  process.kill = ((pid: number, signal?: NodeJS.Signals | number): true => {
    query(pid, signal as 0);
    return true;
  }) as typeof process.kill;
  try {
    return task();
  } finally {
    process.kill = original;
  }
};

/**
 * Local owner claims never exceed process-generation evidence.
 *
 * Scenarios:
 *
 * 1. The current owner generation is stable and every malformed host, PID, or
 *    generation refuses before the process query runs.
 * 2. Exact current generation, foreign host, absent PID, occupied PID, reused
 *    current PID, permission denial, invalid query, and unknown query failures
 *    remain distinct typed observations.
 * 3. Render recovery requires two absence observations and preserves every
 *    same-owner, occupied-or-reused, elsewhere, unknown, or changed result.
 * 4. The temporary-tree owner suffix round-trips the complete descriptor and
 *    rejects malformed or non-canonical encodings.
 * 5. Commit inspection returns `null` only for genuine absence, preserves an
 *    unreadable path as unknown, validates timestamp and owner fields before a
 *    query, and recognizes this exact process generation.
 */
export const test_production_local_process_owner = (): void => {
  const ownerModule = loadSourceModule<OwnerModule>(
    path.resolve(
      __dirname,
      "../../../../packages/production/src/project/localProcessOwner.ts",
    ),
  );
  const renderOwnerModule = loadSourceModule<RenderOwnerModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderOwnerState.ts",
    ),
  );
  const renderProcessOwnerModule = loadSourceModule<RenderProcessOwnerModule>(
    path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/renderProcessOwner.ts",
    ),
  );

  const current = { host: "host-a", pid: 17, generation: GENERATION_A };
  const stableA = ownerModule.currentAutoMovieLocalProcessOwner();
  const stableB = ownerModule.currentAutoMovieLocalProcessOwner();
  TestValidator.equals(
    "current process generation is stable",
    stableB,
    stableA,
  );
  TestValidator.equals(
    "current process owner is valid",
    ownerModule.isAutoMovieLocalProcessOwner(stableA),
    true,
  );

  let invalidQueries = 0;
  const malformed: unknown[] = [
    null,
    {},
    { host: "", pid: 1, generation: GENERATION_A },
    { host: " host-a", pid: 1, generation: GENERATION_A },
    { host: "host-a", pid: 0, generation: GENERATION_A },
    { host: "host-a", pid: -1, generation: GENERATION_A },
    { host: "host-a", pid: 1.5, generation: GENERATION_A },
    {
      host: "host-a",
      pid: Number.MAX_SAFE_INTEGER + 1,
      generation: GENERATION_A,
    },
    { host: "host-a", pid: 1, generation: "" },
    { host: "host-a", pid: 1, generation: "not-a-generation" },
  ];
  TestValidator.equals(
    "malformed owners refuse as unknown",
    malformed.map((owner) =>
      ownerModule.observeAutoMovieLocalProcessOwner({
        owner,
        current,
        query: () => {
          ++invalidQueries;
        },
      }),
    ),
    malformed.map(() => ({
      state: "unknown" as const,
      owner: null,
      reason: "invalid-owner" as const,
    })),
  );
  TestValidator.equals(
    "malformed owners never reach the process query",
    invalidQueries,
    0,
  );
  TestValidator.equals(
    "an invalid observing owner also refuses before query",
    ownerModule.observeAutoMovieLocalProcessOwner({
      owner: current,
      current: { ...current, pid: 0 },
      query: () => {
        ++invalidQueries;
      },
    }),
    { state: "unknown", owner: null, reason: "invalid-owner" },
  );
  TestValidator.equals("invalid observer does not query", invalidQueries, 0);

  const observe = (
    owner: unknown,
    query: (pid: number, signal: 0) => unknown,
  ) => ownerModule.observeAutoMovieLocalProcessOwner({ owner, current, query });
  const anotherPid = { ...current, pid: 23 };
  const reusedPid = { ...current, generation: GENERATION_B };
  const maxPid = { ...current, pid: Number.MAX_SAFE_INTEGER };
  TestValidator.equals(
    "generation-aware process observations",
    [
      observe(current, () => {
        throw new Error("same owner must not query");
      }),
      observe({ ...current, host: "host-b" }, () => {
        throw new Error("foreign host must not query");
      }),
      observe(anotherPid, () => {
        throw platformError("ESRCH");
      }),
      observe(anotherPid, () => undefined),
      observe(reusedPid, () => undefined),
      observe(anotherPid, () => {
        throw platformError("EPERM");
      }),
      observe(maxPid, () => {
        throw platformError("EINVAL");
      }),
      observe(anotherPid, () => {
        throw platformError("EIO");
      }),
    ].map((result) => result.state),
    [
      "same-owner",
      "elsewhere",
      "absent",
      "occupied-or-reused",
      "occupied-or-reused",
      "occupied-or-reused",
      "unknown",
      "unknown",
    ],
  );

  const absent = { state: "absent", owner: anotherPid } as const;
  const changedAbsent = {
    state: "absent",
    owner: { ...anotherPid, generation: GENERATION_B },
  } as const;
  const occupied = { state: "occupied-or-reused", owner: anotherPid } as const;
  const unknown = {
    state: "unknown",
    owner: anotherPid,
    reason: "process-query-unavailable",
  } as const;
  const recovery = (
    observations: Array<
      typeof absent | typeof changedAbsent | typeof occupied | typeof unknown
    >,
  ) => {
    let calls = 0;
    const decision = renderOwnerModule.observeRenderOwnerRecovery({
      owner: anotherPid,
      observe: () => observations[calls++]!,
    });
    return { decision, calls };
  };
  TestValidator.equals(
    "render owner recovery matrix",
    [
      recovery([absent, absent]),
      recovery([occupied]),
      recovery([unknown]),
      recovery([absent, occupied]),
      recovery([absent, unknown]),
      recovery([absent, changedAbsent]),
    ].map(({ decision, calls }) => ({ state: decision.state, calls })),
    [
      { state: "reclaimable", calls: 2 },
      { state: "preserved", calls: 1 },
      { state: "preserved", calls: 1 },
      { state: "preserved", calls: 2 },
      { state: "preserved", calls: 2 },
      { state: "preserved", calls: 2 },
    ],
  );

  const suffix = renderProcessOwnerModule.renderProcessOwnerSuffix(current);
  TestValidator.equals(
    "temporary owner suffix round trips",
    renderProcessOwnerModule.parseRenderProcessOwnerSuffix(suffix),
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
    ].map(renderProcessOwnerModule.parseRenderProcessOwnerSuffix),
    [null, null, null, null, null],
  );
  TestValidator.predicate(
    "invalid temporary owner suffix input refuses before encoding",
    (() => {
      try {
        renderProcessOwnerModule.renderProcessOwnerSuffix({
          ...current,
          pid: 0,
        });
        return false;
      } catch (error) {
        return (error as Error).message.includes("owner is invalid");
      }
    })(),
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-owner-"));
  try {
    const missing = path.join(root, "missing.lock");
    TestValidator.equals(
      "missing commit lock is genuine absence",
      inspectCommitLock(missing),
      null,
    );

    const unreadable = path.join(root, "directory.lock");
    fs.mkdirSync(unreadable);
    TestValidator.equals(
      "non-file commit lock is unknown rather than absent",
      inspectCommitLock(unreadable),
      {
        path: unreadable,
        owner: null,
        state: "unknown",
        reason: "lock-read-unavailable",
      },
    );

    for (const [index, owner] of [
      { ...stableA, pid: 0, at: Date.now() },
      { ...stableA, pid: -1, at: Date.now() },
      { ...stableA, pid: 1.5, at: Date.now() },
      { ...stableA, generation: "", at: Date.now() },
      { ...stableA, at: -1 },
      { ...stableA, at: 0.5 },
      { ...stableA, at: Number.MAX_SAFE_INTEGER + 1 },
    ].entries()) {
      const file = path.join(root, `invalid-${index}.lock`);
      fs.writeFileSync(
        file,
        `automovie-commit-lock:${JSON.stringify({ ...owner, nonce: "0" })}`,
      );
      TestValidator.equals(
        `invalid commit owner ${index} is unknown`,
        inspectCommitLock(file),
        {
          path: file,
          owner: null,
          state: "unknown",
          reason: "invalid-owner",
        },
      );
    }

    const observed = path.join(root, "observed.lock");
    const observedOwner = { ...stableA, generation: GENERATION_B, at: 0 };
    const observedToken = `automovie-commit-lock:${JSON.stringify({
      ...observedOwner,
      nonce: "0",
    })}`;
    fs.writeFileSync(observed, observedToken);
    TestValidator.equals(
      "commit inspection preserves all injected process observations",
      [
        withCommitProcessQuery(
          () => undefined,
          () => inspectCommitLock(observed)?.state,
        ),
        withCommitProcessQuery(
          () => {
            throw platformError("EPERM");
          },
          () => inspectCommitLock(observed)?.state,
        ),
        withCommitProcessQuery(
          () => {
            throw platformError("ESRCH");
          },
          () => inspectCommitLock(observed)?.state,
        ),
        withCommitProcessQuery(
          () => {
            throw platformError("EINVAL");
          },
          () => inspectCommitLock(observed)?.state,
        ),
      ],
      ["occupied-or-reused", "occupied-or-reused", "absent", "unknown"],
    );

    let malformedCommitQueries = 0;
    withCommitProcessQuery(
      () => ++malformedCommitQueries,
      () => inspectCommitLock(path.join(root, "invalid-0.lock")),
    );
    TestValidator.equals(
      "malformed commit owner refuses before process query",
      malformedCommitQueries,
      0,
    );

    const reclaimed = withCommitProcessQuery(
      () => {
        throw platformError("ESRCH");
      },
      () => acquireCommitLock(observed),
    );
    TestValidator.predicate(
      "commit acquisition replaces an unchanged twice-absent owner",
      reclaimed !== observedToken &&
        fs.readFileSync(observed, "utf8") === reclaimed,
    );
    releaseCommitLock(observed, reclaimed);
    TestValidator.equals(
      "reclaimed commit lock releases by its successor token",
      fs.existsSync(observed),
      false,
    );

    const same = path.join(root, "same.lock");
    fs.writeFileSync(
      same,
      `automovie-commit-lock:${JSON.stringify({ ...stableA, at: 0, nonce: "0" })}`,
    );
    TestValidator.equals(
      "commit lock recognizes this exact process generation",
      inspectCommitLock(same),
      { path: same, owner: { ...stableA, at: 0 }, state: "same-owner" },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
