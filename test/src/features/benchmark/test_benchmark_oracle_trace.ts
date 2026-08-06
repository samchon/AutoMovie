import {
  IAutoMovieBenchmarkTraceEvent,
  appendAutoMovieBenchmarkTrace,
  benchmarkTraceKinds,
  canonicalBenchmarkJson,
  replayAutoMovieBenchmarkTrace,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";
import { gzipSync } from "node:zlib";

import { namedFacts } from "../internal/predicates";

const digest = (digit: string): `sha256:${string}` =>
  `sha256:${digit.repeat(64)}`;

const events = (): IAutoMovieBenchmarkTraceEvent[] => [
  {
    sequence: 0,
    atMs: 0,
    kind: "run-start",
    executionId: digest("1"),
    taskId: "short/austerlitz-signal",
    surface: "production",
    lane: "deterministic",
  },
  {
    sequence: 1,
    atMs: 1_200,
    kind: "gate",
    gate: "source-compile",
    status: "pass",
    detail: "0 errors.",
  },
  {
    sequence: 2,
    atMs: 1_800,
    kind: "mcp-call",
    tool: "compile",
    requestDigest: digest("2"),
    resultDigest: digest("3"),
    ok: true,
  },
  {
    sequence: 3,
    atMs: 2_400,
    kind: "capture",
    shot: "opening",
    timeSeconds: 2,
    pass: "beauty",
    digest: digest("4"),
    bytes: 148_221,
  },
  {
    sequence: 4,
    atMs: 2_800,
    kind: "verdict",
    outcome: "scored",
    filmScore: 1,
  },
  {
    sequence: 5,
    atMs: 3_000,
    kind: "run-seal",
    runId: digest("5"),
  },
];

const throws = (task: () => unknown, fragment: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/**
 * The oracle trace is append-only and survives the process that wrote it, so a
 * killed run still yields every observation it managed to record.
 *
 * Scenarios:
 *
 * 1. Appending in two batches produces the same bytes as appending at once, and
 *    every archived event replays in order.
 * 2. An archive cut anywhere inside its final member replays every complete line
 *    before the cut and reports the truncation.
 * 3. An empty archive replays to nothing without reporting truncation.
 * 4. Uncompressed JSONL replays through the same reader.
 * 5. A complete line with malformed UTF-8, invalid JSON, an invalid event,
 *    sequence gap, backwards clock, or impossible number is refused as
 *    corruption rather than read as truncation.
 * 6. Verdict scores are finite and inside `0..1`, with `null` reserved exactly for
 *    infrastructure exclusion and exact zero required for gate failure.
 * 7. The archived event kinds are reported in code-unit order.
 */
export const test_benchmark_oracle_trace = (): void => {
  const all = events();
  const capture = all[3]!;
  const verdict = all[4]!;
  if (capture.kind !== "capture" || verdict.kind !== "verdict")
    throw new Error("benchmark trace fixture ordering changed");
  const oneShot = appendAutoMovieBenchmarkTrace(new Uint8Array(), all);
  const batched = appendAutoMovieBenchmarkTrace(
    appendAutoMovieBenchmarkTrace(new Uint8Array(), all.slice(0, 2)),
    all.slice(2),
  );
  TestValidator.equals(
    "appending in batches archives the same bytes",
    Buffer.from(batched).equals(Buffer.from(oneShot)),
    true,
  );
  TestValidator.equals(
    "every archived observation replays in append order",
    replayAutoMovieBenchmarkTrace(oneShot),
    { events: all, truncated: false },
  );

  const killed = replayAutoMovieBenchmarkTrace(
    gzipSync(
      Buffer.from(
        `${all
          .slice(0, 5)
          .map((event) => canonicalBenchmarkJson(event))
          .join("\n")}\n${canonicalBenchmarkJson(all[5]!).slice(0, 20)}`,
        "utf8",
      ),
    ),
  );
  TestValidator.equals(
    "a killed writer still yields every complete line before the cut",
    namedFacts([
      ["killedTruncated", () => killed.truncated],
      ["killedEventsAll", () => killed.events.length === all.length - 1],
      ["killedEventsKind", () => killed.events[3]?.kind === "capture"],
    ]),
    { killedTruncated: true, killedEventsAll: true, killedEventsKind: true },
  );
  TestValidator.equals(
    "an archive that lost only its gzip trailer still replays whole",
    replayAutoMovieBenchmarkTrace(oneShot.slice(0, oneShot.length - 8)),
    { events: all, truncated: false },
  );

  TestValidator.equals(
    "an empty archive replays to nothing",
    replayAutoMovieBenchmarkTrace(new Uint8Array()),
    { events: [], truncated: false },
  );

  const plain = Buffer.from(
    `${all.map((event) => canonicalBenchmarkJson(event)).join("\n")}\n`,
    "utf8",
  );
  TestValidator.equals(
    "uncompressed JSONL replays through the same reader",
    replayAutoMovieBenchmarkTrace(plain).events.length,
    all.length,
  );
  TestValidator.equals(
    "an incomplete UTF-8 tail remains ordinary writer truncation",
    replayAutoMovieBenchmarkTrace(Buffer.concat([plain, Buffer.from([0xe2])])),
    { events: all, truncated: true },
  );
  const malformedUtf8 = Buffer.from(
    `${canonicalBenchmarkJson(all[0]!)}\n`,
    "utf8",
  );
  const malformedOffset = malformedUtf8.indexOf("austerlitz");
  if (malformedOffset < 0)
    throw new Error("benchmark trace UTF-8 fixture marker changed");
  malformedUtf8[malformedOffset] = 0xff;

  TestValidator.equals(
    "corruption is refused instead of read as truncation",
    namedFacts([
      [
        "throwsReplayAutoMovieBenchmarkTraceMalformedUtf8",
        () =>
          throws(
            () => replayAutoMovieBenchmarkTrace(malformedUtf8),
            "valid UTF-8",
          ),
      ],
      [
        "throwsReplayAutoMovieBenchmarkTraceBuffer",
        () =>
          throws(
            () =>
              replayAutoMovieBenchmarkTrace(Buffer.from("{not json\n", "utf8")),
            "not JSON",
          ),
      ],
      [
        "throwsReplayAutoMovieBenchmarkTraceBuffer2",
        () =>
          throws(
            () =>
              replayAutoMovieBenchmarkTrace(
                Buffer.from('{"sequence":0,"atMs":0,"kind":"nope"}\n', "utf8"),
              ),
            "not an observed event",
          ),
      ],
      [
        "throwsReplayAutoMovieBenchmarkTraceAppendAutoMovieBenchmarkTrace",
        () =>
          throws(
            () =>
              replayAutoMovieBenchmarkTrace(
                appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                  all[0]!,
                  { ...all[2]!, sequence: 2 },
                ]),
              ),
            "has no gaps",
          ),
      ],
      [
        "throwsReplayAutoMovieBenchmarkTraceAppendAutoMovieBenchmarkTrace2",
        () =>
          throws(
            () =>
              replayAutoMovieBenchmarkTrace(
                appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                  { ...all[0]!, atMs: 1_200 },
                  { ...all[1]!, sequence: 1, atMs: 600 },
                ]),
              ),
            "monotonic clock backwards",
          ),
      ],
    ]),
    {
      throwsReplayAutoMovieBenchmarkTraceMalformedUtf8: true,
      throwsReplayAutoMovieBenchmarkTraceBuffer: true,
      throwsReplayAutoMovieBenchmarkTraceBuffer2: true,
      throwsReplayAutoMovieBenchmarkTraceAppendAutoMovieBenchmarkTrace: true,
      throwsReplayAutoMovieBenchmarkTraceAppendAutoMovieBenchmarkTrace2: true,
    },
  );
  TestValidator.equals(
    "trace numbers stay inside their physical domains",
    namedFacts([
      [
        "throwsAppendAutoMovieBenchmarkTraceNew",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...all[0]!, sequence: 0.5 },
              ]),
            "non-negative safe integer",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew2",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...capture, bytes: -1 },
              ]),
            "non-negative safe integer",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew3",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...all[0]!, atMs: Number.NaN },
              ]),
            "non-negative finite number",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew4",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...capture, timeSeconds: -1 },
              ]),
            "non-negative finite number",
          ),
      ],
    ]),
    {
      throwsAppendAutoMovieBenchmarkTraceNew: true,
      throwsAppendAutoMovieBenchmarkTraceNew2: true,
      throwsAppendAutoMovieBenchmarkTraceNew3: true,
      throwsAppendAutoMovieBenchmarkTraceNew4: true,
    },
  );
  TestValidator.equals(
    "trace verdict scores preserve their taxonomy and range",
    namedFacts([
      [
        "replayAutoMovieBenchmarkTraceAppendAutoMovieBenchmarkTraceNew",
        () =>
          replayAutoMovieBenchmarkTrace(
            appendAutoMovieBenchmarkTrace(new Uint8Array(), [
              {
                ...verdict,
                sequence: 0,
                outcome: "infra-excluded",
                filmScore: null,
              },
            ]),
          ).events.length === 1,
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                {
                  ...verdict,
                  outcome: "infra-excluded",
                  filmScore: 0,
                },
              ]),
            "null exactly",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew2",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...verdict, filmScore: null },
              ]),
            "null exactly",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew3",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...verdict, filmScore: Number.NaN },
              ]),
            "inside 0..1",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew4",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...verdict, filmScore: -0.1 },
              ]),
            "inside 0..1",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew5",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                { ...verdict, filmScore: 1.1 },
              ]),
            "inside 0..1",
          ),
      ],
      [
        "throwsAppendAutoMovieBenchmarkTraceNew6",
        () =>
          throws(
            () =>
              appendAutoMovieBenchmarkTrace(new Uint8Array(), [
                {
                  ...verdict,
                  outcome: "gate-failed",
                  filmScore: 0.7,
                },
              ]),
            "must have filmScore 0",
          ),
      ],
    ]),
    {
      replayAutoMovieBenchmarkTraceAppendAutoMovieBenchmarkTraceNew: true,
      throwsAppendAutoMovieBenchmarkTraceNew: true,
      throwsAppendAutoMovieBenchmarkTraceNew2: true,
      throwsAppendAutoMovieBenchmarkTraceNew3: true,
      throwsAppendAutoMovieBenchmarkTraceNew4: true,
      throwsAppendAutoMovieBenchmarkTraceNew5: true,
      throwsAppendAutoMovieBenchmarkTraceNew6: true,
    },
  );

  TestValidator.equals(
    "archived event kinds are reported in code-unit order",
    benchmarkTraceKinds(all),
    ["capture", "gate", "mcp-call", "run-seal", "run-start", "verdict"],
  );
};
