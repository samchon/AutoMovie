import {
  IAutoMovieBenchmarkAnchors,
  IAutoMovieBenchmarkMutantAnchor,
} from "../calibration";
import { IAutoMovieBenchmarkGateResult } from "../lifecycle";
import {
  AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL,
  IAutoMovieBenchmarkSubmission,
  IAutoMovieBenchmarkSubmissionDraft,
  sealAutoMovieBenchmarkSubmission,
} from "../submission";
import {
  AUTOMOVIE_BENCHMARK_HARNESS_VERSION,
  AUTOMOVIE_BENCHMARK_TASK_PROTOCOL,
  AutoMovieBenchmarkSurface,
  IAutoMovieBenchmarkTask,
  IAutoMovieBenchmarkVersions,
  digestAutoMovieBenchmarkText,
  validateAutoMovieBenchmarkTask,
} from "../task";

/**
 * The short-tier brief, committed as the exact bytes every surface receives.
 *
 * The brief lives in the module that owns it rather than in a data file so the
 * digest the task law fixes and the text a candidate is handed cannot drift
 * apart: there is one copy, and the digest is derived from it.
 */
export const AUSTERLITZ_SIGNAL_BRIEF = `# Austerlitz: the signal on the Pratzen

Deliver one finished minute. A named French sentinel stands on the Pratzen
Heights before dawn on 2 December 1805 and raises a signal arm. Behind and
below, an allied column advances across the slope as an instanced formation.

Historical law:

- The allied column is already moving before the signal is raised.
- The Pratzen Heights stand at least twelve meters above the surrounding plain.

Production law:

- The allied column is one formation of at least five hundred twelve members.
- The production frame clock is twenty-four frames per second.

Deliver a feature cut, burned-in captions, and an audio mix. The finished film
runs between fifty-five and sixty-five seconds.
`;

/** Versions this corpus scenario is comparable within. */
const VERSIONS: IAutoMovieBenchmarkVersions = {
  task: "1.0.0",
  harness: AUTOMOVIE_BENCHMARK_HARNESS_VERSION,
  reference: "1.0.0",
  scenarioHelper: 1,
};

const digest = (label: string): `sha256:${string}` =>
  digestAutoMovieBenchmarkText(label);

/**
 * The short-tier task law.
 *
 * Every band below is the exact score its anchor earns under these weights, so
 * a judge change that moves any anchor by more than half a percent fails
 * calibration before it reaches a leaderboard.
 */
export const austerlitzSignalTask = (): IAutoMovieBenchmarkTask => ({
  protocolVersion: AUTOMOVIE_BENCHMARK_TASK_PROTOCOL,
  taskId: "short/austerlitz-signal",
  tier: "short",
  versions: { ...VERSIONS },
  brief: {
    path: "packages/benchmark/src/corpus/austerlitzSignal.ts",
    digest: digestAutoMovieBenchmarkText(AUSTERLITZ_SIGNAL_BRIEF),
  },
  historicalLaw: [
    {
      id: "historical/column-moves-first",
      statement: "The allied column advances before the signal is raised.",
      observation: "event-order:column-before-signal",
      operator: "==",
      value: 1,
      tolerance: 0,
    },
    {
      id: "historical/pratzen-elevation",
      statement: "The Pratzen Heights stand at least twelve meters up.",
      observation: "landmark:pratzen-height-meters",
      operator: ">=",
      value: 12,
      tolerance: 0,
    },
  ],
  productionLaw: [
    {
      id: "production/column-strength",
      statement: "The allied column carries at least 512 formation members.",
      observation: "formation:allied-column:count",
      operator: ">=",
      value: 512,
      tolerance: 0,
    },
    {
      id: "production/frame-clock",
      statement: "The production frame clock is 24 frames per second.",
      observation: "production:fps",
      operator: "==",
      value: 24,
      tolerance: 0,
    },
  ],
  requiredFrames: [
    {
      id: "frame/signal-apex-beauty",
      statement: "The raised signal arm is readable in the beauty pass.",
      shot: "opening",
      timeSeconds: 2,
      pass: "beauty",
      width: 1280,
      height: 720,
      minBytes: 4096,
    },
    {
      id: "frame/signal-apex-mask",
      statement: "The sentinel is separable in the mask pass.",
      shot: "opening",
      timeSeconds: 2,
      pass: "mask",
      width: 1280,
      height: 720,
      minBytes: 1024,
    },
  ],
  physicalInvariants: [
    {
      id: "invariant/signal-abduction",
      statement: "The signal arm reaches at least 100 degrees of abduction.",
      observation: "joint:sentinel:leftUpperArm:abduction-deg",
      operator: ">=",
      value: 100,
      tolerance: 0,
    },
    {
      id: "invariant/ground-contact",
      statement: "No formation member sinks into the slope.",
      observation: "physics:max-ground-penetration-m",
      operator: "<=",
      value: 0.001,
      tolerance: 0,
    },
  ],
  delivery: {
    requiredKinds: ["feature", "captions", "audio-mix"],
    minRuntimeSeconds: 55,
    maxRuntimeSeconds: 65,
  },
  weights: {
    historical: 0.2,
    production: 0.2,
    frame: 0.25,
    invariant: 0.2,
    delivery: 0.15,
  },
  calibration: {
    reference: { min: 0.995, max: 1 },
    empty: { min: 0, max: 0.005 },
    mutants: [
      {
        id: "stale-frame",
        defect: "The beauty capture is stale and fails its PNG probe.",
        band: { min: 0.87, max: 0.88 },
      },
      {
        id: "missing-formation",
        defect: "The allied column was never compiled as a formation.",
        band: { min: 0.895, max: 0.905 },
      },
      {
        id: "broken-runtime",
        defect: "The published feature runs far short of the brief.",
        band: { min: 0.9575, max: 0.9675 },
      },
    ],
  },
  sandbox: {
    maxElapsedSeconds: 3600,
    maxCostUsd: 25,
    maxCorrections: 8,
  },
});

/** Every gate passing, which is what a delivered run reports. */
const completeLifecycle = (): IAutoMovieBenchmarkGateResult[] => [
  { gate: "packaged-install", status: "pass", detail: "Installed 9 tarballs." },
  { gate: "mcp-handshake", status: "pass", detail: "15 tools advertised." },
  { gate: "project-bootstrap", status: "pass", detail: "Starter scaffolded." },
  { gate: "source-compile", status: "pass", detail: "0 errors." },
  { gate: "capture-runtime", status: "pass", detail: "Chromium 148 ready." },
  { gate: "required-frames", status: "pass", detail: "2 frames captured." },
  { gate: "review-queue", status: "pass", detail: "Queue drained." },
  { gate: "deliverable-render", status: "pass", detail: "3 deliverables." },
  { gate: "final-compile", status: "pass", detail: "Publication committed." },
];

/**
 * One delivered short-tier run that satisfies the whole law.
 *
 * Exported because a sealed submission cannot be spread back into a draft: the
 * seal adds a run id that strict validation refuses as a surplus field, so a
 * variant is built from this draft rather than from a sealed archive.
 */
export const austerlitzSignalDraft = (
  surface: AutoMovieBenchmarkSurface,
): IAutoMovieBenchmarkSubmissionDraft => ({
  protocolVersion: AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL,
  taskId: "short/austerlitz-signal",
  taskDigest: validateAutoMovieBenchmarkTask(austerlitzSignalTask()),
  versions: { ...VERSIONS },
  briefDigest: digestAutoMovieBenchmarkText(AUSTERLITZ_SIGNAL_BRIEF),
  surface,
  lane: "deterministic",
  repository: {
    commit: "0".repeat(40),
    dirty: false,
    artifacts: [
      { name: "@automovie/cli", digest: digest("cli.tgz"), bytes: 262144 },
      { name: "@automovie/mcp", digest: digest("mcp.tgz"), bytes: 524288 },
    ],
  },
  client: {
    client: "claude-code",
    agent: "default",
    model: "claude-opus-5",
    effort: "high",
    seed: 1411,
    configDigest: digest("client-config"),
  },
  mcp: {
    protocolVersion: "2025-06-18",
    serverName: "automovie-production",
    serverVersion: "0.1.0",
    tools: [
      { name: "setShotContract", descriptionBytes: 812, schemaBytes: 4096 },
      { name: "compile", descriptionBytes: 640, schemaBytes: 1024 },
    ],
  },
  transcriptDigest: digest("transcript"),
  inventoryDigest: digest("inventory"),
  edits: [
    {
      path: "src/shots/opening.ts",
      beforeDigest: digest("opening-before"),
      afterDigest: digest("opening-after"),
    },
  ],
  treeDigest: digest("tree"),
  lifecycle: completeLifecycle(),
  observations: {
    "event-order:column-before-signal": 1,
    "landmark:pratzen-height-meters": 13.5,
    "formation:allied-column:count": 2049,
    "production:fps": 24,
    "joint:sentinel:leftUpperArm:abduction-deg": 104.5,
    "physics:max-ground-penetration-m": 0,
  },
  frames: [
    {
      path: "evidence/frames/opening-beauty.png",
      shot: "opening",
      timeSeconds: 2,
      pass: "beauty",
      width: 1280,
      height: 720,
      bytes: 148_221,
      digest: digest("beauty.png"),
      probeValid: true,
    },
    {
      path: "evidence/frames/opening-mask.png",
      shot: "opening",
      timeSeconds: 2,
      pass: "mask",
      width: 1280,
      height: 720,
      bytes: 12_044,
      digest: digest("mask.png"),
      probeValid: true,
    },
  ],
  deliverables: [
    {
      path: "evidence/deliverables/feature.mp4",
      deliverable: "feature",
      kind: "feature",
      mediaType: "video/mp4",
      bytes: 8_412_672,
      digest: digest("feature.mp4"),
      durationSeconds: 60,
      probeValid: true,
    },
    {
      path: "evidence/deliverables/captions.vtt",
      deliverable: "captions",
      kind: "captions",
      mediaType: "text/vtt",
      bytes: 1_204,
      digest: digest("captions.vtt"),
      durationSeconds: null,
      probeValid: true,
    },
    {
      path: "evidence/deliverables/audio.m4a",
      deliverable: "audio",
      kind: "audio-mix",
      mediaType: "audio/mp4",
      bytes: 962_048,
      digest: digest("audio.m4a"),
      durationSeconds: 60,
      probeValid: true,
    },
  ],
  finishedRuntimeSeconds: 60,
  generation: {
    toolCalls: 46,
    corrections: 2,
    costUsd: 7.25,
    elapsedSeconds: 1_284,
    inputTokens: 812_004,
    outputTokens: 96_512,
  },
  runtime: {
    os: "linux",
    arch: "x64",
    toolchain: "node 22.15.0 / pnpm 10.6.4",
    capture: "automovie.capture-runtime.v1 chromium 148",
  },
  repaint: { status: "not-requested" },
  incident: null,
});

/** The intended vertical slice, sealed. */
export const austerlitzSignalReference = (
  surface: AutoMovieBenchmarkSurface = "production",
): IAutoMovieBenchmarkSubmission =>
  sealAutoMovieBenchmarkSubmission(austerlitzSignalDraft(surface));

/** A bootstrap-only run that never compiled the film it was asked for. */
export const austerlitzSignalEmpty = (): IAutoMovieBenchmarkSubmission =>
  sealAutoMovieBenchmarkSubmission({
    ...austerlitzSignalDraft("production"),
    lifecycle: [
      ...completeLifecycle().slice(0, 3),
      {
        gate: "source-compile",
        status: "fail",
        detail: "No shot source was ever written.",
      },
    ],
    observations: {},
    frames: [],
    deliverables: [],
    finishedRuntimeSeconds: null,
    generation: {
      toolCalls: 3,
      corrections: 0,
      costUsd: 0.11,
      elapsedSeconds: 42,
      inputTokens: 12_004,
      outputTokens: 512,
    },
  });

/** Every known-broken run this scenario pins the judge against. */
export const austerlitzSignalMutants =
  (): IAutoMovieBenchmarkMutantAnchor[] => [
    {
      id: "stale-frame",
      submission: sealAutoMovieBenchmarkSubmission({
        ...austerlitzSignalDraft("production"),
        frames: austerlitzSignalDraft("production").frames.map((frame) =>
          frame.pass === "beauty" ? { ...frame, probeValid: false } : frame,
        ),
      }),
    },
    {
      id: "missing-formation",
      submission: sealAutoMovieBenchmarkSubmission({
        ...austerlitzSignalDraft("production"),
        observations: {
          ...austerlitzSignalDraft("production").observations,
          "formation:allied-column:count": 0,
        },
      }),
    },
    {
      id: "broken-runtime",
      submission: sealAutoMovieBenchmarkSubmission({
        ...austerlitzSignalDraft("production"),
        finishedRuntimeSeconds: 20,
        deliverables: austerlitzSignalDraft("production").deliverables.map(
          (file) =>
            file.kind === "feature" ? { ...file, durationSeconds: 20 } : file,
        ),
      }),
    },
  ];

/** The complete anchor set for this scenario. */
export const austerlitzSignalAnchors = (): IAutoMovieBenchmarkAnchors => ({
  reference: austerlitzSignalReference(),
  empty: austerlitzSignalEmpty(),
  mutants: austerlitzSignalMutants(),
});

/**
 * The production and legacy submissions of one dry evaluation.
 *
 * Both are produced under the same law, brief bytes, commit, client, model and
 * seed, and differ only in the surface they drove and in what driving it cost.
 * That is the whole comparison rule: a capability difference has to appear in
 * the result and the friction, never in the setup.
 */
export const austerlitzSignalDryRun = (): IAutoMovieBenchmarkSubmission[] => [
  austerlitzSignalReference("production"),
  sealAutoMovieBenchmarkSubmission({
    ...austerlitzSignalDraft("legacy-compact"),
    mcp: {
      protocolVersion: "2025-06-18",
      serverName: "automovie-legacy",
      serverVersion: "0.1.0",
      tools: [
        { name: "execute", descriptionBytes: 1_004, schemaBytes: 12_288 },
      ],
    },
    observations: {
      ...austerlitzSignalDraft("legacy-compact").observations,
      "formation:allied-column:count": 128,
    },
    generation: {
      toolCalls: 118,
      corrections: 8,
      costUsd: 19.4,
      elapsedSeconds: 3_102,
      inputTokens: 2_411_008,
      outputTokens: 214_016,
    },
  }),
];
