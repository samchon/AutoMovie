import {
  IAutoMovieBenchmarkTraceEvent,
  appendAutoMovieBenchmarkTrace,
  benchmarkTraceKinds,
  canonicalBenchmarkJson,
  replayAutoMovieBenchmarkTrace,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";
import { gzipSync } from "node:zlib";

const digest = (digit: string): `sha256:${string}` =>
  `sha256:${digit.repeat(64)}`;

const events = (): IAutoMovieBenchmarkTraceEvent[] => [
  {
    sequence: 0,
    atMs: 0,
    kind: "run-start",
    runId: digest("1"),
    taskId: "short/austerlitz-signal",
    surface: "production",
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
    atMs: 3_000,
    kind: "verdict",
    outcome: "scored",
    filmScore: 1,
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
 * 5. A complete line that is not JSON, is not an observed event, carries a
 *    sequence gap, moves time backwards, or claims an impossible number is
 *    refused as corruption rather than read as truncation.
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
          .slice(0, 4)
          .map((event) => canonicalBenchmarkJson(event))
          .join("\n")}\n${canonicalBenchmarkJson(all[4]!).slice(0, 20)}`,
        "utf8",
      ),
    ),
  );
  TestValidator.predicate(
    "a killed writer still yields every complete line before the cut",
    killed.truncated &&
      killed.events.length === all.length - 1 &&
      killed.events[3]?.kind === "capture",
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

  TestValidator.predicate(
    "corruption is refused instead of read as truncation",
    throws(
      () => replayAutoMovieBenchmarkTrace(Buffer.from("{not json\n", "utf8")),
      "not JSON",
    ) &&
      throws(
        () =>
          replayAutoMovieBenchmarkTrace(
            Buffer.from('{"sequence":0,"atMs":0,"kind":"nope"}\n', "utf8"),
          ),
        "not an observed event",
      ) &&
      throws(
        () =>
          replayAutoMovieBenchmarkTrace(
            appendAutoMovieBenchmarkTrace(new Uint8Array(), [
              all[0]!,
              { ...all[2]!, sequence: 2 },
            ]),
          ),
        "has no gaps",
      ) &&
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
  );
  TestValidator.predicate(
    "trace numbers stay inside their physical domains",
    throws(
      () =>
        appendAutoMovieBenchmarkTrace(new Uint8Array(), [
          { ...all[0]!, sequence: 0.5 },
        ]),
      "non-negative safe integer",
    ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...capture, bytes: -1 },
          ]),
        "non-negative safe integer",
      ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...all[0]!, atMs: Number.NaN },
          ]),
        "non-negative finite number",
      ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...capture, timeSeconds: -1 },
          ]),
        "non-negative finite number",
      ),
  );
  TestValidator.predicate(
    "trace verdict scores preserve their taxonomy and range",
    replayAutoMovieBenchmarkTrace(
      appendAutoMovieBenchmarkTrace(new Uint8Array(), [
        {
          ...verdict,
          sequence: 0,
          outcome: "infra-excluded",
          filmScore: null,
        },
      ]),
    ).events.length === 1 &&
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
      ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...verdict, filmScore: null },
          ]),
        "null exactly",
      ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...verdict, filmScore: Number.NaN },
          ]),
        "inside 0..1",
      ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...verdict, filmScore: -0.1 },
          ]),
        "inside 0..1",
      ) &&
      throws(
        () =>
          appendAutoMovieBenchmarkTrace(new Uint8Array(), [
            { ...verdict, filmScore: 1.1 },
          ]),
        "inside 0..1",
      ) &&
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
  );

  TestValidator.equals(
    "archived event kinds are reported in code-unit order",
    benchmarkTraceKinds(all),
    ["capture", "gate", "mcp-call", "run-start", "verdict"],
  );
};
