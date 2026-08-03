import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
} from "@automovie/interface";
import { constants, gunzipSync, gzipSync } from "node:zlib";
import typia from "typia";

import {
  AutoMovieBenchmarkGate,
  AutoMovieBenchmarkGateStatus,
  IAutoMovieBenchmarkInfraIncident,
} from "./lifecycle";
import {
  AutoMovieBenchmarkLane,
  AutoMovieBenchmarkSurface,
  canonicalBenchmarkJson,
  compareBenchmarkCodeUnits,
} from "./task";

/** Trace schema every archived event stream carries. */
export const AUTOMOVIE_BENCHMARK_TRACE_PROTOCOL =
  "automovie.benchmark.trace.v2";

/** Fields every observed event carries. */
export interface IAutoMovieBenchmarkTraceHeader {
  /** Zero-based append order; the reader refuses a gap. */
  sequence: number;
  /** Runner-supplied monotonic milliseconds since the run started. */
  atMs: number;
}

/** One append-only direct observation. */
export type IAutoMovieBenchmarkTraceEvent = IAutoMovieBenchmarkTraceHeader &
  (
    | {
        /** The run opened. */
        kind: "run-start";
        /** Attempt identity known before candidate execution starts. */
        executionId: AutoMovieContentDigest;
        /** Task law the run is produced under. */
        taskId: string;
        /** Surface the candidate drives. */
        surface: AutoMovieBenchmarkSurface;
        /** Selected deterministic or optional repaint lane. */
        lane: AutoMovieBenchmarkLane;
      }
    | {
        /** The runner sealed all observed evidence under its final identity. */
        kind: "run-seal";
        /** Content-addressed submission identity. */
        runId: AutoMovieContentDigest;
      }
    | {
        /** Runner-owned infrastructure incident observed during execution. */
        kind: "incident";
        /** Infrastructure failure class. */
        incident: IAutoMovieBenchmarkInfraIncident["kind"];
        /** Gate the run was standing on. */
        gate: AutoMovieBenchmarkGate;
        /** Direct runner diagnostic. */
        detail: string;
      }
    | {
        /** One lifecycle gate reached a terminal outcome. */
        kind: "gate";
        /** Gate observed. */
        gate: AutoMovieBenchmarkGate;
        /** Outcome observed. */
        status: AutoMovieBenchmarkGateStatus;
        /** Short evidence sentence. */
        detail: string;
      }
    | {
        /** One MCP call and its result identity. */
        kind: "mcp-call";
        /** Tool name invoked. */
        tool: string;
        /** Digest of the exact request payload. */
        requestDigest: AutoMovieContentDigest;
        /** Digest of the exact result payload. */
        resultDigest: AutoMovieContentDigest;
        /** Whether the server answered without an error result. */
        ok: boolean;
      }
    | {
        /** One source path changed. */
        kind: "source-edit";
        /** Project-relative path. */
        path: string;
        /** Digest before the edit, or `null` when the path was created. */
        beforeDigest: AutoMovieContentDigest | null;
        /** Digest after the edit, or `null` when the path was removed. */
        afterDigest: AutoMovieContentDigest | null;
      }
    | {
        /** One compile finished. */
        kind: "compile";
        /** Whether the compile succeeded. */
        success: boolean;
        /** Error diagnostic count. */
        errors: number;
        /** Warning diagnostic count. */
        warnings: number;
      }
    | {
        /** One actual frame was captured. */
        kind: "capture";
        /** Compiler-owned shot id. */
        shot: string;
        /** Exact shot-local capture time in seconds. */
        timeSeconds: number;
        /** Pass captured. */
        pass: AutoMovieGuidePass;
        /** Digest of the resident PNG bytes. */
        digest: AutoMovieContentDigest;
        /** Resident PNG byte count. */
        bytes: number;
      }
    | {
        /** One review queue entry changed state. */
        kind: "review";
        /** Review target address. */
        target: string;
        /** Observed transition. */
        transition: string;
      }
    | {
        /** One render chunk or terminal publication finished. */
        kind: "render";
        /** Chunk or publication identity. */
        chunk: string;
        /** Media-parser outcome. */
        probe: "valid" | "invalid";
        /** Resident byte count. */
        bytes: number;
      }
    | {
        /** One deterministic assertion was settled. */
        kind: "assertion";
        /** Assertion id settled. */
        assertion: string;
        /** Settled outcome. */
        outcome: "pass" | "fail" | "unknown";
      }
    | {
        /** The run reached a verdict. */
        kind: "verdict";
        /** Verdict taxonomy outcome. */
        outcome: "scored" | "gate-failed" | "infra-excluded";
        /** Scored value, exact zero for gate failure, or `null` when excluded. */
        filmScore: number | null;
      }
  );

/** Result of replaying one archived, possibly truncated trace. */
export interface IAutoMovieBenchmarkTraceReplay {
  /** Every intact event, in append order. */
  events: IAutoMovieBenchmarkTraceEvent[];
  /** Whether the stream ended mid-line, as a killed process leaves it. */
  truncated: boolean;
}

/** First two bytes of a gzip member. */
const GZIP_MAGIC = [0x1f, 0x8b];

/** Refuse numeric trace claims that cannot describe an observed run. */
const assertAutoMovieBenchmarkTraceNumbers = (
  event: IAutoMovieBenchmarkTraceEvent,
): void => {
  const record = event as unknown as Record<string, unknown>;
  for (const field of ["sequence", "errors", "warnings", "bytes"]) {
    const value = record[field] as number | undefined;
    if (
      value !== undefined &&
      (Number.isSafeInteger(value) === false || value < 0)
    )
      throw new Error(
        `Benchmark trace ${field} must be a non-negative safe integer.`,
      );
  }
  for (const field of ["atMs", "timeSeconds"]) {
    const value = record[field] as number | undefined;
    if (value !== undefined && (Number.isFinite(value) === false || value < 0))
      throw new Error(
        `Benchmark trace ${field} must be a non-negative finite number.`,
      );
  }
  if (event.kind === "verdict") {
    const excluded = event.outcome === "infra-excluded";
    if ((event.filmScore === null) !== excluded)
      throw new Error(
        "Benchmark trace filmScore must be null exactly when infrastructure excluded the run.",
      );
    if (
      event.filmScore !== null &&
      (Number.isFinite(event.filmScore) === false ||
        event.filmScore < 0 ||
        event.filmScore > 1)
    )
      throw new Error(
        "Benchmark trace filmScore must be a finite number inside 0..1.",
      );
    if (event.outcome === "gate-failed" && event.filmScore !== 0)
      throw new Error(
        "Benchmark trace gate-failed verdicts must have filmScore 0.",
      );
  }
};

/**
 * Append events to an archived trace as independent gzip members.
 *
 * One member per line is what keeps the archive both compressed and
 * append-only: a writer never rewrites earlier bytes, and a reader that
 * receives a stream cut mid-member still recovers every complete line before
 * it.
 */
export const appendAutoMovieBenchmarkTrace = (
  existing: Uint8Array,
  events: readonly IAutoMovieBenchmarkTraceEvent[],
): Uint8Array => {
  for (const event of events) assertAutoMovieBenchmarkTraceNumbers(event);
  return Buffer.concat([
    Buffer.from(existing),
    ...events.map((event) =>
      gzipSync(Buffer.from(`${canonicalBenchmarkJson(event)}\n`, "utf8")),
    ),
  ]);
};

/**
 * Replay one archived trace, tolerating a stream that was cut mid-line.
 *
 * Truncation and corruption are different answers. A stream that ends without
 * its final newline lost a line to a killed process, which is expected and
 * reported; a complete line that does not parse, or a sequence gap, is an
 * archive that cannot be trusted at all and is refused.
 */
export const replayAutoMovieBenchmarkTrace = (
  bytes: Uint8Array,
): IAutoMovieBenchmarkTraceReplay => {
  const buffer = Buffer.from(bytes);
  const resident =
    buffer.length >= GZIP_MAGIC.length &&
    GZIP_MAGIC.every((byte, index) => buffer[index] === byte)
      ? gunzipSync(buffer, {
          finishFlush: constants.Z_SYNC_FLUSH,
        })
      : buffer;
  const finalNewline = resident.lastIndexOf(0x0a);
  const truncated = finalNewline !== resident.length - 1;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      resident.subarray(0, finalNewline + 1),
    );
  } catch {
    throw new Error(
      "Benchmark trace bytes are not valid UTF-8. The archive is corrupt, not truncated.",
    );
  }
  // Only the prefix through the final newline is decoded. Any following bytes
  // belong to the killed writer's partial line and are reported as truncation
  // without letting an incomplete UTF-8 code point poison the complete prefix.
  const lines = text.split("\n");
  let previousAtMs = Number.NEGATIVE_INFINITY;
  const events = lines.slice(0, -1).map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error(
        `Benchmark trace line ${index} is complete but not JSON. The archive is corrupt, not truncated.`,
      );
    }
    const validation =
      typia.validateEquals<IAutoMovieBenchmarkTraceEvent>(parsed);
    if (validation.success === false)
      throw new Error(
        `Benchmark trace line ${index} is not an observed event: ${validation.errors
          .map((error) => `${error.path} expects ${error.expected}`)
          .join("; ")}.`,
      );
    if (validation.data.sequence !== index)
      throw new Error(
        `Benchmark trace line ${index} carries sequence ${validation.data.sequence}. An append-only trace has no gaps.`,
      );
    assertAutoMovieBenchmarkTraceNumbers(validation.data);
    if (validation.data.atMs < previousAtMs)
      throw new Error(
        `Benchmark trace line ${index} moves its monotonic clock backwards from ${previousAtMs} to ${validation.data.atMs}.`,
      );
    previousAtMs = validation.data.atMs;
    return validation.data;
  });
  return { events, truncated };
};

/**
 * Every event kind the trace archived, in code-unit order.
 *
 * A completeness critic reads this rather than the raw stream: a run that never
 * captured a frame and a run whose captures were never observed are the same
 * silence until the archived kinds are compared with the ones the lifecycle
 * claims.
 */
export const benchmarkTraceKinds = (
  events: readonly IAutoMovieBenchmarkTraceEvent[],
): string[] =>
  [...new Set(events.map((event) => event.kind))].sort(
    compareBenchmarkCodeUnits,
  );
