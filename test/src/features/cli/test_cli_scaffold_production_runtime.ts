import { scaffoldAssetDirectory } from "@automovie/cli";
import type {
  IAutoMovieDialogueExpressionLayers,
  IAutoMovieDialogueSpeakerBinding,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieShotContract,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";

interface ProductionRuntimeModule {
  compileProductionDialogueRuntime: (props: {
    plan: IAutoMovieProductionSoundPlan;
    timeline: IAutoMovieFilmTimeline;
    receipts: readonly IAutoMovieProductionTtsReceipt[];
    bindings: readonly IAutoMovieDialogueSpeakerBinding[];
  }) => DialogueRuntime;
  currentProductionDialogueRuntime: () => DialogueRuntime | null;
  deriveProductionRuntimeSoundPlan: (props: {
    timeline: IAutoMovieFilmTimeline;
    contracts: ReadonlyMap<string, IAutoMovieShotContract>;
    compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
    sound: unknown;
    acousticStudies: readonly unknown[];
    acousticBindings: readonly {
      event: string;
      sourceSpace: string | null;
      listenerSpace: string | null;
      study: string | null;
    }[];
  }) => IAutoMovieProductionSoundPlan;
  installProductionDialogueRuntime: (runtime: DialogueRuntime | null) => void;
  productionDialogueFrameForShotTime: (props: {
    shot: string;
    time: number;
  }) => number | null;
  productionDialogueRuntimeIdentity: () => string | null;
}

interface DialogueRuntime {
  version: 1;
  inputFingerprint: AutoMovieContentDigest;
  fps: number;
  segments: Array<{
    shot: string;
    startFrame: number;
    endFrame: number;
    sourceInFrame: number;
    sourceOutFrame: number;
  }>;
  receipts: IAutoMovieProductionTtsReceipt[];
  timelines: Array<{
    line: string;
    actor: string;
    ranges: Array<{
      startFrame: number;
      endFrame: number;
      viseme: "aa" | "ih" | "ou" | "ee" | "oh" | "rest";
    }>;
  }>;
}

interface ShotRuntimeModule {
  applyProductionDialogueMouth: (props: {
    runtime: DialogueRuntime | null;
    frame: number | null;
    actors: ReadonlyMap<
      string,
      {
        object: {
          expressionTargets?: readonly {
            setExpressionValue: (name: string, weight: number) => void;
          }[];
          flushExpressionTargets?: () => void;
        };
        authored: {
          preset: "happy";
          intensity: number;
          blendshapes: null;
        } | null;
      }
    >;
  }) => ReadonlyMap<string, IAutoMovieDialogueExpressionLayers>;
  selectProductionWearableSoftBodies: (
    domains: readonly IAutoMovieSoftBodyDomain[],
    selected: readonly string[],
  ) => Array<{
    domain: IAutoMovieSoftBodyDomain;
    subjectIndex: number;
    maxSubjects: number;
  }>;
}

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

/** Scaffold joins selected sound/runtime behavior without hidden selections. */
export const test_cli_scaffold_production_runtime = (): void => {
  const load = createRequire(__filename);
  const production = load(
    path.join(scaffoldAssetDirectory(), "scripts", "productionRuntime.ts"),
  ) as ProductionRuntimeModule;
  const viewer = load(
    path.join(scaffoldAssetDirectory(), "viewer", "src", "shotRuntime.ts"),
  ) as ShotRuntimeModule;
  const timeline = minimalTimeline();
  const runtime = production.compileProductionDialogueRuntime({
    plan: dialoguePlan(),
    timeline,
    receipts: [receipt("line", 3, 5, "aa")],
    bindings: [{ speaker: "voice", actor: "actor" }],
  });
  TestValidator.equals(
    "final-byte receipt creates a gap-free emission-clock actor timeline",
    {
      lipSync: runtime.receipts[0]!.lipSync,
      ranges: runtime.timelines[0]!.ranges,
    },
    {
      lipSync: {
        status: "available",
        actor: "actor",
        timing: "emission",
        composition: "mouth-layer-over-authored-expression",
      },
      ranges: [
        { startFrame: 2, endFrame: 3, viseme: "rest" },
        { startFrame: 3, endFrame: 5, viseme: "aa" },
        { startFrame: 5, endFrame: 8, viseme: "rest" },
      ],
    },
  );
  const missingBinding = production.compileProductionDialogueRuntime({
    plan: dialoguePlan(),
    timeline,
    receipts: [receipt("line", 3, 5, "aa")],
    bindings: [],
  });
  TestValidator.equals(
    "missing speaker mapping remains a visible not-run receipt",
    {
      lipSync: missingBinding.receipts[0]!.lipSync,
      timelines: missingBinding.timelines.length,
    },
    {
      lipSync: { status: "not-run", reason: "speaker-actor-not-found" },
      timelines: 0,
    },
  );

  production.installProductionDialogueRuntime(runtime);
  try {
    const identity = production.productionDialogueRuntimeIdentity();
    const copy = production.currentProductionDialogueRuntime()!;
    copy.timelines[0]!.actor = "mutated";
    TestValidator.equals(
      "installed dialogue runtime is cloned and unique local seeks map to film frames",
      {
        identityStable:
          production.productionDialogueRuntimeIdentity() === identity,
        actor:
          production.currentProductionDialogueRuntime()!.timelines[0]!.actor,
        frame: production.productionDialogueFrameForShotTime({
          shot: "shot",
          time: 0.4,
        }),
      },
      { identityStable: true, actor: "actor", frame: 4 },
    );
  } finally {
    production.installProductionDialogueRuntime(null);
  }

  const writes: Array<readonly [string, number]> = [];
  let flushes = 0;
  const authored = {
    preset: "happy" as const,
    intensity: 0.75,
    blendshapes: null,
  };
  const actors = new Map([
    [
      "actor",
      {
        object: {
          expressionTargets: [
            {
              setExpressionValue: (name: string, weight: number): void => {
                writes.push([name, weight]);
              },
            },
          ],
          flushExpressionTargets: (): void => {
            ++flushes;
          },
        },
        authored,
      },
    ],
  ]);
  const active = viewer.applyProductionDialogueMouth({
    runtime,
    frame: 3,
    actors,
  });
  const activeWrites = [...writes];
  writes.length = 0;
  viewer.applyProductionDialogueMouth({ runtime, frame: 6, actors });
  const restWrites = [...writes];
  writes.length = 0;
  viewer.applyProductionDialogueMouth({ runtime, frame: 3, actors });
  TestValidator.equals(
    "mouth seeks preserve authored emotion, close rest, and repeat exactly",
    {
      authored: active.get("actor")!.authored,
      mouth: active.get("actor")!.mouth,
      activeWrites,
      restWrites,
      repeated: writes,
      flushes,
    },
    {
      authored,
      mouth: { preset: "aa", intensity: 1 },
      activeWrites: [
        ["aa", 0],
        ["ih", 0],
        ["ou", 0],
        ["ee", 0],
        ["oh", 0],
        ["aa", 1],
      ],
      restWrites: [
        ["aa", 0],
        ["ih", 0],
        ["ou", 0],
        ["ee", 0],
        ["oh", 0],
      ],
      repeated: activeWrites,
      flushes: 3,
    },
  );
  TestValidator.predicate(
    "an active line refuses an absent compiled actor",
    throwsWith(
      () =>
        viewer.applyProductionDialogueMouth({
          runtime,
          frame: 3,
          actors: new Map(),
        }),
      "absent actor",
    ),
  );
  TestValidator.predicate(
    "an active line refuses an actor with no mouth expression sink",
    throwsWith(
      () =>
        viewer.applyProductionDialogueMouth({
          runtime,
          frame: 3,
          actors: new Map([
            [
              "actor",
              {
                object: {},
                authored: null,
              },
            ],
          ]),
        }),
      "without a mouth expression sink",
    ),
  );

  TestValidator.predicate(
    "overlapping lines on one mouth are refused before capture",
    throwsWith(
      () =>
        production.compileProductionDialogueRuntime({
          plan: {
            ...dialoguePlan(),
            dialogue: [
              dialoguePlan().dialogue[0]!,
              {
                ...dialoguePlan().dialogue[0]!,
                id: "overlap",
                startFrame: 4,
                endFrame: 9,
              },
            ],
          },
          timeline,
          receipts: [
            receipt("line", 3, 5, "aa"),
            receipt("overlap", 4, 6, "ih"),
          ],
          bindings: [{ speaker: "voice", actor: "actor" }],
        }),
      "overlap on actor",
    ),
  );

  const domains = ["coat", "cape"].map(
    (id) => ({ id }) as IAutoMovieSoftBodyDomain,
  );
  TestValidator.equals(
    "live wearable selection preserves only explicit authored order and budget",
    viewer
      .selectProductionWearableSoftBodies(domains, ["cape", "coat"])
      .map((selection) => ({
        id: selection.domain.id,
        subjectIndex: selection.subjectIndex,
        maxSubjects: selection.maxSubjects,
      })),
    [
      { id: "cape", subjectIndex: 0, maxSubjects: 2 },
      { id: "coat", subjectIndex: 1, maxSubjects: 2 },
    ],
  );
  TestValidator.equals(
    "wearable admission never auto-selects and refuses stale selections",
    {
      omitted: viewer.selectProductionWearableSoftBodies(domains, []).length,
      duplicate: throwsWith(
        () =>
          viewer.selectProductionWearableSoftBodies(domains, ["coat", "coat"]),
        "unique",
      ),
      missing: throwsWith(
        () => viewer.selectProductionWearableSoftBodies(domains, ["missing"]),
        "absent",
      ),
    },
    { omitted: 0, duplicate: true, missing: true },
  );

  const baseSound = production.deriveProductionRuntimeSoundPlan({
    timeline,
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    sound: { propagation: propagationProfile() },
    acousticStudies: [],
    acousticBindings: [],
  });
  const event = baseSound.events[0]!;
  const acoustic = production.deriveProductionRuntimeSoundPlan({
    timeline,
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    sound: {
      propagation: propagationProfile(),
      acousticResponse: {
        kind: "derived-room-analysis",
        id: "declared-room-path",
        solver: "sabine-broadband-v1",
      },
    },
    acousticStudies: [],
    acousticBindings: [
      {
        event: event.id,
        sourceSpace: null,
        listenerSpace: null,
        study: null,
      },
    ],
  });
  TestValidator.equals(
    "scaffold sound planning carries selected propagation and outdoor acoustics",
    {
      arrival: acoustic.events[0]!.propagation!.arrivalFrame,
      emission: acoustic.events[0]!.frame,
      response: acoustic.events[0]!.acousticResponse,
    },
    {
      arrival: 6,
      emission: 2,
      response: {
        status: "available",
        path: "outdoor",
        profile: "declared-room-path",
        inputRevision: digest,
        reverberationTimeSeconds: null,
        directToDiffuseRatio: null,
        transmissionGain: null,
      },
    },
  );
};

const dialoguePlan = (): IAutoMovieProductionSoundPlan =>
  ({
    version: 1,
    inputFingerprint: digest,
    fps: 10,
    totalFrames: 20,
    sampleRate: 48_000,
    channels: 2,
    events: [],
    cues: [],
    dialogue: [
      {
        id: "line",
        text: "hello",
        language: "en",
        speaker: "voice",
        startFrame: 2,
        endFrame: 8,
      },
    ],
  }) as IAutoMovieProductionSoundPlan;

const receipt = (
  line: string,
  startFrame: number,
  endFrame: number,
  viseme: "aa" | "ih",
): IAutoMovieProductionTtsReceipt =>
  ({
    line,
    visemes: [{ phoneme: viseme, viseme, startFrame, endFrame }],
  }) as IAutoMovieProductionTtsReceipt;

const minimalTimeline = (): IAutoMovieFilmTimeline =>
  ({
    inputFingerprint: digest,
    fps: 10,
    totalFrames: 20,
    segments: [
      {
        shot: "shot",
        sourceInFrame: 0,
        sourceOutFrame: 10,
        startFrame: 0,
        endFrame: 10,
        transitionIn: { kind: "cut", durationFrames: 0 },
      },
    ],
    tracks: { audio: [], captions: [] },
  }) as unknown as IAutoMovieFilmTimeline;

const minimalContract = (): IAutoMovieShotContract =>
  ({
    events: [
      {
        id: "hit",
        kind: "contact",
        window: { from: 0, to: 1 },
        subjects: ["actor"],
        predicates: [{}],
      },
    ],
  }) as IAutoMovieShotContract;

const minimalCompiled = (): IAutoMovieCompiledShotSource =>
  ({
    eventSamples: [{ id: "hit", time: 0.2 }],
    scene: {
      nodes: [
        {
          id: "actor",
          model: "actor-model",
          transform: transform(4),
          motion: null,
          pose: null,
        },
      ],
      cameras: [
        {
          id: "camera",
          transform: transform(0),
          fovY: 50,
          near: 0.1,
          far: 100,
        },
      ],
      lights: [],
    },
    shot: {
      id: "shot",
      camera: "camera",
      cameraMotion: null,
      objectMotions: [],
    },
    formations: [],
    formationMotions: [],
    instanceSets: [],
  }) as unknown as IAutoMovieCompiledShotSource;

const transform = (x: number) => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const propagationProfile = () => ({
  id: "declared-air",
  speedOfSoundMetersPerSecond: 10,
  distanceGain: { kind: "softened-inverse-square-v1", coefficient: 0.01 },
  spectral: { kind: "none" },
  segmentBoundary: "carry-across-cut",
  assumptions: ["caller supplied the effective path length"],
});

const throwsWith = (operation: () => unknown, text: string): boolean => {
  try {
    operation();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(text);
  }
};
