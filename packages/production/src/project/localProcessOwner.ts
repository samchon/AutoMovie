import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import os from "node:os";

/**
 * One process generation whose identity remains stable for this Node process.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Makes the host and process generation behind a mutable owner claim explicit.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Carries the process generation that distinguishes one owner from a reused PID.
 */
export interface IAutoMovieLocalProcessOwner {
  /** Host whose process table assigned {@link pid}. */
  host: string;
  /** Positive safe-integer process identifier on {@link host}. */
  pid: number;
  /** Opaque UUID identifying this process generation. */
  generation: string;
}

/**
 * What a local process-table observation proves about a persisted owner.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-stale-lock-recovery Allows reclaim only from affirmative proof that the recorded owner disappeared.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-stale-claim-recovery Preserves same-owner, absence, PID reuse, remote-host, and unavailable observations as distinct recovery states.
 */
export type AutoMovieLocalProcessOwnerObservation =
  | {
      /** The descriptor is exactly this observing process generation. */
      state: "same-owner";
      /** The validated persisted owner. */
      owner: IAutoMovieLocalProcessOwner;
    }
  | {
      /** No process currently occupies the recorded local PID. */
      state: "absent";
      /** The validated persisted owner. */
      owner: IAutoMovieLocalProcessOwner;
    }
  | {
      /** The PID is occupied without proof that its process generation matches. */
      state: "occupied-or-reused";
      /** The validated persisted owner. */
      owner: IAutoMovieLocalProcessOwner;
    }
  | {
      /** The descriptor belongs to a host this process table cannot inspect. */
      state: "elsewhere";
      /** The validated persisted owner. */
      owner: IAutoMovieLocalProcessOwner;
    }
  | {
      /** No recovery-authorizing owner conclusion could be proved. */
      state: "unknown";
      /** A validated owner when the observation, rather than parsing, failed. */
      owner: IAutoMovieLocalProcessOwner | null;
      /** Sanitized reason that does not expose the raw descriptor or platform error. */
      reason: "invalid-owner" | "process-query-unavailable";
    };

/** The signal-zero process query injected by platform adapters and tests. */
export type AutoMovieLocalProcessQuery = (pid: number, signal: 0) => unknown;

const PROCESS_QUERY = new AsyncLocalStorage<AutoMovieLocalProcessQuery>();

/** The invocation-scoped process query, or the real Node process table. */
export const currentAutoMovieLocalProcessQuery =
  (): AutoMovieLocalProcessQuery =>
    PROCESS_QUERY.getStore() ?? ((pid, signal) => process.kill(pid, signal));

/** Run one operation with an explicit process-table observation capability. */
export const withAutoMovieLocalProcessQuery = <Output>(
  query: AutoMovieLocalProcessQuery,
  operation: () => Output,
): Output => PROCESS_QUERY.run(query, operation);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROCESS_GENERATION_SYMBOL = Symbol.for(
  "automovie.local-process-generation.v1",
);
const HOST_MAX_BYTES = 255;
const HOST_CONTROL_PATTERN = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

const processGeneration = (): string => {
  const owner = globalThis as typeof globalThis & {
    [PROCESS_GENERATION_SYMBOL]?: string;
  };
  return (owner[PROCESS_GENERATION_SYMBOL] ??= randomUUID());
};

/**
 * Validate a persisted local process owner before any process-table query.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Rejects owner claims whose host, PID, or process generation is not queryable.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Enforces the complete local owner identity consumed by recovery decisions.
 */
export const isAutoMovieLocalProcessOwner = (
  value: unknown,
): value is IAutoMovieLocalProcessOwner => {
  if (typeof value !== "object" || value === null) return false;
  const { host, pid, generation } = value as Record<string, unknown>;
  return (
    typeof host === "string" &&
    host.length !== 0 &&
    host === host.trim() &&
    Buffer.byteLength(host, "utf8") <= HOST_MAX_BYTES &&
    HOST_CONTROL_PATTERN.test(host) === false &&
    typeof pid === "number" &&
    Number.isSafeInteger(pid) &&
    pid > 0 &&
    typeof generation === "string" &&
    UUID_PATTERN.test(generation)
  );
};

/**
 * Return this Node process's stable local owner generation.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Emits one queryable host, PID, and process generation for every local claim.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-claim-scope-owner Reuses one owner generation across this process's claims while claim tokens remain independent fences.
 */
export const currentAutoMovieLocalProcessOwner =
  (): IAutoMovieLocalProcessOwner => ({
    host: os.hostname(),
    pid: process.pid,
    generation: processGeneration(),
  });

/**
 * Resolve a persisted owner without promoting bare PID occupancy to identity.
 *
 * Descriptor validation happens before the injected process query. Signal-zero
 * success and `EPERM` establish occupancy only, `ESRCH` establishes absence,
 * and every other platform result remains unknown.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-stale-lock-recovery Refuses stale recovery unless the original local owner is proved absent.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-stale-claim-recovery Implements the generation-aware observation used before takeover or cleanup.
 */
export const observeAutoMovieLocalProcessOwner = (props: {
  /** Persisted owner-shaped value to validate and observe. */
  owner: unknown;
  /** Stable identity of the process performing the observation. */
  current: IAutoMovieLocalProcessOwner;
  /** Signal-zero process-table adapter. */
  query: AutoMovieLocalProcessQuery;
}): AutoMovieLocalProcessOwnerObservation => {
  if (
    isAutoMovieLocalProcessOwner(props.owner) === false ||
    isAutoMovieLocalProcessOwner(props.current) === false
  )
    return { state: "unknown", owner: null, reason: "invalid-owner" };
  const owner = props.owner;
  if (owner.host !== props.current.host) return { state: "elsewhere", owner };
  if (
    owner.pid === props.current.pid &&
    owner.generation === props.current.generation
  )
    return { state: "same-owner", owner };
  try {
    props.query(owner.pid, 0);
    return { state: "occupied-or-reused", owner };
  } catch (error) {
    let code: unknown;
    try {
      code = (error as NodeJS.ErrnoException).code;
    } catch {
      return {
        state: "unknown",
        owner,
        reason: "process-query-unavailable",
      };
    }
    if (code === "ESRCH") return { state: "absent", owner };
    if (code === "EPERM") return { state: "occupied-or-reused", owner };
    return {
      state: "unknown",
      owner,
      reason: "process-query-unavailable",
    };
  }
};
