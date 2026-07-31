import {
  IAutoMovieBenchmarkAnchors,
  IAutoMovieBenchmarkMutantAnchor,
} from "../calibration";
import { IAutoMovieBenchmarkGateResult } from "../lifecycle";
import {
  AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL,
  IAutoMovieBenchmarkSubmissionDraft,
  sealAutoMovieBenchmarkSubmission,
} from "../submission";
import {
  AUTOMOVIE_BENCHMARK_HARNESS_VERSION,
  AUTOMOVIE_BENCHMARK_TASK_PROTOCOL,
  AutoMovieBenchmarkSurface,
  AutoMovieBenchmarkTier,
  IAutoMovieBenchmarkTask,
  digestAutoMovieBenchmarkText,
  validateAutoMovieBenchmarkTask,
} from "../task";

/** Exact one-minute zero-config deterministic demo brief. */
export const AUSTERLITZ_TEASER_BRIEF = `# Austerlitz deterministic teaser

Deliver a finished one-minute teaser at 24 fps. The deterministic lane must use
the original renderer without a repaint adapter. When the runner selects the
optional repaint lane, preserve that deterministic original and also publish a
reviewed repaint rendition from the same source shot.
Before dawn on 2 December 1805, a French sentinel on the Pratzen Heights raises
a signal. A 512-member allied column is already advancing below. The signal
cuts to a French line presenting muskets and one synchronized volley whose
flash, smoke, recoil, impact direction, reaction, captions, and audio remain
readable. Deliver a feature cut, captions, and an audio mix between 55 and 65
seconds.`;

/** Exact five-minute deterministic volley-exchange demo brief. */
export const AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF = `# Austerlitz volley exchange

Deliver a finished five-minute battle sequence at 24 fps. The deterministic
lane must not use a repaint adapter. The optional repaint lane preserves the
deterministic originals and adds reviewed renditions from those same shots.
Establish the Pratzen slope, opposed French and Allied line
formations, command relationships, and screen direction. Stage at least three
ordered volley exchanges with registered muskets, measured event timing,
formation motion, recoil, smoke, impact response, editorial coverage, captions,
and event-derived spatial audio. Preserve immutable hit facts while authoring
distinct human reactions. Deliver a feature, captions, and audio mix between
285 and 315 seconds.`;

/** Exact twenty-minute zero-config deterministic full-film demo brief. */
export const AUSTERLITZ_BATTLE_FILM_BRIEF = `# Austerlitz battle film

Deliver a finished twenty-minute film at 24 fps. The deterministic lane must
not use a repaint adapter. The optional repaint lane preserves deterministic
originals and adds reviewed renditions from those same shots. Build a screenplay
ladder from pre-dawn uncertainty through
the Allied movement onto the Pratzen Heights, French counterstroke, line and
artillery exchanges, crisis, and resolution. Use historically sourced object
and line-battle contracts, multiple formations, authored hero reactions,
continuity-aware cinematography and editing, captions, event-derived sound, and
an audio mix. Preserve engine hit and impact facts. Deliver between 1,140 and
1,260 seconds with current asset, shot, sequence, and film reviews.`;

interface IMilestoneConfig {
  taskId: string;
  tier: AutoMovieBenchmarkTier;
  brief: string;
  runtime: number;
  minRuntime: number;
  maxRuntime: number;
  primaryShot: string;
  secondaryShot: string;
  formationObservation: string;
  formationMinimum: number;
  objectObservation: string;
  eventObservation: string;
  eventMinimum: number;
  historicalObservation: string;
  historicalMinimum: number;
  sandboxSeconds: number;
  maxCostUsd: number;
  maxCorrections: number;
}

const CONFIGS = {
  teaser: {
    taskId: "short/austerlitz-teaser",
    tier: "short",
    brief: AUSTERLITZ_TEASER_BRIEF,
    runtime: 60,
    minRuntime: 55,
    maxRuntime: 65,
    primaryShot: "signal",
    secondaryShot: "first-volley",
    formationObservation: "formation:allied-column:count",
    formationMinimum: 512,
    objectObservation: "asset:musket:registered",
    eventObservation: "battle:ordered-volley-count",
    eventMinimum: 1,
    historicalObservation: "landmark:pratzen-height-meters",
    historicalMinimum: 12,
    sandboxSeconds: 3_600,
    maxCostUsd: 25,
    maxCorrections: 8,
  },
  volley: {
    taskId: "medium/austerlitz-volley-exchange",
    tier: "medium",
    brief: AUSTERLITZ_VOLLEY_EXCHANGE_BRIEF,
    runtime: 300,
    minRuntime: 285,
    maxRuntime: 315,
    primaryShot: "line-establish",
    secondaryShot: "volley-impact",
    formationObservation: "formation:opposed-lines:count",
    formationMinimum: 512,
    objectObservation: "asset:musket:registered",
    eventObservation: "battle:ordered-volley-count",
    eventMinimum: 3,
    historicalObservation: "battle:line-formations-present",
    historicalMinimum: 2,
    sandboxSeconds: 10_800,
    maxCostUsd: 75,
    maxCorrections: 16,
  },
  film: {
    taskId: "long/austerlitz-battle-film",
    tier: "long",
    brief: AUSTERLITZ_BATTLE_FILM_BRIEF,
    runtime: 1_200,
    minRuntime: 1_140,
    maxRuntime: 1_260,
    primaryShot: "pratzen-establish",
    secondaryShot: "counterstroke-climax",
    formationObservation: "formation:battle-order:count",
    formationMinimum: 1_024,
    objectObservation: "asset:historical-object:registered",
    eventObservation: "battle:ordered-volley-count",
    eventMinimum: 6,
    historicalObservation: "story:pratzen-counterstroke-present",
    historicalMinimum: 1,
    sandboxSeconds: 28_800,
    maxCostUsd: 200,
    maxCorrections: 32,
  },
} as const satisfies Record<string, IMilestoneConfig>;

const digest = (label: string): `sha256:${string}` =>
  digestAutoMovieBenchmarkText(label);

const lifecycle = (): IAutoMovieBenchmarkGateResult[] => [
  { gate: "packaged-install", status: "pass", detail: "Installed packages." },
  { gate: "mcp-handshake", status: "pass", detail: "Five tools advertised." },
  { gate: "project-bootstrap", status: "pass", detail: "Starter created." },
  { gate: "source-compile", status: "pass", detail: "Source current." },
  { gate: "capture-runtime", status: "pass", detail: "Capture ready." },
  { gate: "required-frames", status: "pass", detail: "Frames verified." },
  { gate: "review-queue", status: "pass", detail: "Reviews complete." },
  {
    gate: "deliverable-render",
    status: "pass",
    detail: "Deterministic delivery rendered.",
  },
  { gate: "final-compile", status: "pass", detail: "Final gate passed." },
];

const taskOf = (config: IMilestoneConfig): IAutoMovieBenchmarkTask => ({
  protocolVersion: AUTOMOVIE_BENCHMARK_TASK_PROTOCOL,
  taskId: config.taskId,
  tier: config.tier,
  versions: {
    task: "1.0.0",
    harness: AUTOMOVIE_BENCHMARK_HARNESS_VERSION,
    reference: "1.0.0",
    scenarioHelper: 1,
  },
  brief: {
    path: "packages/benchmark/src/corpus/demoMilestones.ts",
    digest: digestAutoMovieBenchmarkText(config.brief),
  },
  historicalLaw: [
    {
      id: "historical/scene-law",
      statement: "The historical scenario law is represented.",
      observation: config.historicalObservation,
      operator: ">=",
      value: config.historicalMinimum,
      tolerance: 0,
    },
    {
      id: "historical/zero-config",
      statement: "The mandatory lane uses deterministic visual delivery.",
      observation: "delivery:deterministic",
      operator: "==",
      value: 1,
      tolerance: 0,
    },
  ],
  productionLaw: [
    {
      id: "production/formation-strength",
      statement: "The required battle formations are materialized.",
      observation: config.formationObservation,
      operator: ">=",
      value: config.formationMinimum,
      tolerance: 0,
    },
    {
      id: "production/ordered-events",
      statement: "The required ordered volley events are compiled.",
      observation: config.eventObservation,
      operator: ">=",
      value: config.eventMinimum,
      tolerance: 0,
    },
    {
      id: "production/object-registration",
      statement: "The required historical battle object is registered.",
      observation: config.objectObservation,
      operator: ">=",
      value: 1,
      tolerance: 0,
    },
  ],
  requiredFrames: [
    {
      id: "frame/establish-beauty",
      statement: "The battle geography is readable.",
      shot: config.primaryShot,
      timeSeconds: 2,
      pass: "beauty",
      width: 1280,
      height: 720,
      minBytes: 4_096,
    },
    {
      id: "frame/action-pose",
      statement: "The decisive action has structural pose evidence.",
      shot: config.secondaryShot,
      timeSeconds: 2,
      pass: "pose",
      width: 1280,
      height: 720,
      minBytes: 1_024,
    },
  ],
  physicalInvariants: [
    {
      id: "invariant/ground-contact",
      statement: "Formation members do not penetrate terrain.",
      observation: "physics:max-ground-penetration-m",
      operator: "<=",
      value: 0.001,
      tolerance: 0,
    },
    {
      id: "invariant/event-order",
      statement: "Reactions begin after their immutable impact fact.",
      observation: "physics:reaction-after-impact",
      operator: "==",
      value: 1,
      tolerance: 0,
    },
  ],
  delivery: {
    requiredKinds: ["feature", "captions", "audio-mix"],
    minRuntimeSeconds: config.minRuntime,
    maxRuntimeSeconds: config.maxRuntime,
  },
  weights: {
    historical: 0.2,
    production: 0.2,
    frame: 0.2,
    invariant: 0.2,
    delivery: 0.2,
  },
  calibration: {
    reference: { min: 0.995, max: 1 },
    empty: { min: 0, max: 0.005 },
    mutants: [
      {
        id: "missing-battle-event",
        defect: "The required ordered battle event is absent.",
        band: { min: 0.928, max: 0.938 },
      },
    ],
  },
  sandbox: {
    maxElapsedSeconds: config.sandboxSeconds,
    maxCostUsd: config.maxCostUsd,
    maxCorrections: config.maxCorrections,
  },
});

const draftOf = (
  config: IMilestoneConfig,
  surface: AutoMovieBenchmarkSurface = "five-tool",
): IAutoMovieBenchmarkSubmissionDraft => {
  const task = taskOf(config);
  return {
    protocolVersion: AUTOMOVIE_BENCHMARK_SUBMISSION_PROTOCOL,
    taskId: task.taskId,
    taskDigest: validateAutoMovieBenchmarkTask(task),
    versions: { ...task.versions },
    briefDigest: task.brief.digest,
    surface,
    lane: "deterministic",
    repository: {
      commit: "0".repeat(40),
      dirty: false,
      artifacts: [
        {
          name: "@automovie/cli",
          digest: digest(`${task.taskId}:cli`),
          bytes: 262_144,
        },
        {
          name: "@automovie/mcp",
          digest: digest(`${task.taskId}:mcp`),
          bytes: 524_288,
        },
      ],
    },
    client: {
      client: "codex",
      agent: "benchmark",
      model: "recorded-model",
      effort: "high",
      seed: 1_805,
      configDigest: digest(`${task.taskId}:client`),
    },
    mcp: {
      protocolVersion: "2025-06-18",
      serverName: "automovie",
      serverVersion: "0.1.0",
      tools: [
        { name: "getGuideDocument", descriptionBytes: 192, schemaBytes: 384 },
        { name: "captureFrame", descriptionBytes: 512, schemaBytes: 2_048 },
        { name: "repaintShot", descriptionBytes: 640, schemaBytes: 3_072 },
        { name: "prepareReview", descriptionBytes: 512, schemaBytes: 2_048 },
        { name: "submitReview", descriptionBytes: 768, schemaBytes: 4_096 },
      ],
    },
    transcriptDigest: digest(`${task.taskId}:transcript`),
    inventoryDigest: digest(`${task.taskId}:inventory`),
    edits: [
      {
        path: "src/film.ts",
        beforeDigest: digest(`${task.taskId}:film-before`),
        afterDigest: digest(`${task.taskId}:film-after`),
      },
    ],
    treeDigest: digest(`${task.taskId}:tree`),
    lifecycle: lifecycle(),
    observations: {
      [config.historicalObservation]: config.historicalMinimum,
      "delivery:deterministic": 1,
      [config.formationObservation]: config.formationMinimum,
      [config.eventObservation]: config.eventMinimum,
      [config.objectObservation]: 1,
      "physics:max-ground-penetration-m": 0,
      "physics:reaction-after-impact": 1,
    },
    frames: [
      {
        path: `evidence/frames/${config.primaryShot}-beauty.png`,
        shot: config.primaryShot,
        timeSeconds: 2,
        pass: "beauty",
        width: 1280,
        height: 720,
        bytes: 148_221,
        digest: digest(`${task.taskId}:beauty`),
        probeValid: true,
      },
      {
        path: `evidence/frames/${config.secondaryShot}-pose.png`,
        shot: config.secondaryShot,
        timeSeconds: 2,
        pass: "pose",
        width: 1280,
        height: 720,
        bytes: 24_112,
        digest: digest(`${task.taskId}:pose`),
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
        digest: digest(`${task.taskId}:feature`),
        durationSeconds: config.runtime,
        probeValid: true,
      },
      {
        path: "evidence/deliverables/captions.vtt",
        deliverable: "captions",
        kind: "captions",
        mediaType: "text/vtt",
        bytes: 4_096,
        digest: digest(`${task.taskId}:captions`),
        durationSeconds: null,
        probeValid: true,
      },
      {
        path: "evidence/deliverables/audio.m4a",
        deliverable: "audio",
        kind: "audio-mix",
        mediaType: "audio/mp4",
        bytes: 962_048,
        digest: digest(`${task.taskId}:audio`),
        durationSeconds: config.runtime,
        probeValid: true,
      },
    ],
    finishedRuntimeSeconds: config.runtime,
    generation: {
      toolCalls: 50,
      corrections: 2,
      costUsd: Math.min(config.maxCostUsd, 20),
      elapsedSeconds: Math.min(config.sandboxSeconds, 1_800),
      inputTokens: 800_000,
      outputTokens: 100_000,
    },
    runtime: {
      os: "linux",
      arch: "x64",
      toolchain: "node 22 / pnpm 10",
      capture: "automovie.capture-runtime.v1",
    },
    incident: null,
  };
};

const anchorsOf = (config: IMilestoneConfig): IAutoMovieBenchmarkAnchors => {
  const reference = draftOf(config);
  const mutantDraft = draftOf(config);
  return {
    reference: sealAutoMovieBenchmarkSubmission(reference),
    empty: sealAutoMovieBenchmarkSubmission({
      ...draftOf(config),
      lifecycle: [
        ...lifecycle().slice(0, 3),
        {
          gate: "source-compile",
          status: "fail",
          detail: "No candidate source was produced.",
        },
      ],
      observations: {},
      frames: [],
      deliverables: [],
      finishedRuntimeSeconds: null,
    }),
    mutants: [
      {
        id: "missing-battle-event",
        submission: sealAutoMovieBenchmarkSubmission({
          ...mutantDraft,
          observations: {
            ...mutantDraft.observations,
            [config.eventObservation]: 0,
          },
        }),
      } satisfies IAutoMovieBenchmarkMutantAnchor,
    ],
  };
};

/** One-minute deterministic teaser law. */
export const austerlitzTeaserTask = (): IAutoMovieBenchmarkTask =>
  taskOf(CONFIGS.teaser);
/** One-minute deterministic teaser calibration anchors. */
export const austerlitzTeaserAnchors = (): IAutoMovieBenchmarkAnchors =>
  anchorsOf(CONFIGS.teaser);
/** One-minute deterministic teaser reference draft. */
export const austerlitzTeaserDraft = (
  surface: AutoMovieBenchmarkSurface = "five-tool",
): IAutoMovieBenchmarkSubmissionDraft => draftOf(CONFIGS.teaser, surface);

/** Five-minute deterministic volley exchange law. */
export const austerlitzVolleyExchangeTask = (): IAutoMovieBenchmarkTask =>
  taskOf(CONFIGS.volley);
/** Five-minute deterministic volley exchange calibration anchors. */
export const austerlitzVolleyExchangeAnchors = (): IAutoMovieBenchmarkAnchors =>
  anchorsOf(CONFIGS.volley);

/** Twenty-minute deterministic battle-film law. */
export const austerlitzBattleFilmTask = (): IAutoMovieBenchmarkTask =>
  taskOf(CONFIGS.film);
/** Twenty-minute deterministic battle-film calibration anchors. */
export const austerlitzBattleFilmAnchors = (): IAutoMovieBenchmarkAnchors =>
  anchorsOf(CONFIGS.film);
