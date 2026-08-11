import { scaffoldAssetDirectory } from "@automovie/cli";
import type {
  IAutoMovieAcousticRequest,
  IAutoMovieDialogueExpressionLayers,
  IAutoMovieDialogueSpeakerBinding,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieMotion,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieShotContract,
  IAutoMovieSoftBodyDomain,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";
import * as THREE from "three";

import {
  IDENTITY_TRANSFORM,
  createModel,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

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
  createCompiledShotRuntime: (
    compiled: IAutoMovieCompiledShotSource,
    delivery?: "none" | "acesFilmic",
    runtime?: {
      dialogue?: DialogueRuntime | null;
      liveWearableSoftBodies?: readonly string[];
    },
  ) => Promise<{
    scene: THREE.Scene;
    render: (
      renderer: THREE.WebGLRenderer,
      time: number,
      pass: "beauty",
      globalFrame?: number | null,
    ) => string;
    dispose: () => Promise<void>;
  }>;
}

const digest =
  "sha256:0000000000000000000000000000000000000000000000000000000000000000" as AutoMovieContentDigest;

/**
 * Scaffold joins selected sound/runtime behavior without hidden selections.
 *
 * Scenarios:
 *
 * 1. Final-byte receipts produce gap-free emission-clock visemes and preserve
 *    explicit missing-speaker outcomes.
 * 2. Installed dialogue state is immutable, content-addressed, and maps local
 *    seeks with the film renderer's floor boundary.
 * 3. Mouth sampling preserves authored emotion, closes receipt gaps, repeats under
 *    arbitrary seek, and refuses absent or ambiguous sinks.
 * 4. Dialogue compilation rejects overlapping actor ranges, stale receipts,
 *    duplicate identities, and a sound/film clock mismatch.
 * 5. Live wearable admission is explicit, ordered, bounded, and refuses stale or
 *    duplicate domain identities.
 * 6. A real Three.js shot runtime resamples a moving actor-bone anchor and body
 *    capsule from step zero on every seek and reproduces identical geometry.
 * 7. Sound planning preserves the direct path, consumes exact indoor acoustic
 *    study inputs, and refuses every undeclared or contradictory room join.
 */
export const test_cli_scaffold_production_runtime = async (): Promise<void> => {
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
        boundaryFrame: production.productionDialogueFrameForShotTime({
          shot: "shot",
          time: 0.19,
        }),
        missing: production.productionDialogueFrameForShotTime({
          shot: "absent",
          time: 0,
        }),
        invalid: [Number.NaN, -1].map((time) =>
          production.productionDialogueFrameForShotTime({ shot: "shot", time }),
        ),
      },
      {
        identityStable: true,
        actor: "actor",
        frame: 4,
        boundaryFrame: 1,
        missing: null,
        invalid: [null, null],
      },
    );
    const ambiguous = structuredClone(runtime);
    ambiguous.segments.push({ ...ambiguous.segments[0]! });
    production.installProductionDialogueRuntime(ambiguous);
    TestValidator.equals(
      "a repeated shot occurrence is not guessed from local time",
      production.productionDialogueFrameForShotTime({ shot: "shot", time: 0 }),
      null,
    );
  } finally {
    production.installProductionDialogueRuntime(null);
  }
  TestValidator.equals(
    "cleared dialogue state has no mutable value, identity, or local mapping",
    {
      current: production.currentProductionDialogueRuntime(),
      identity: production.productionDialogueRuntimeIdentity(),
      frame: production.productionDialogueFrameForShotTime({
        shot: "shot",
        time: 0,
      }),
    },
    { current: null, identity: null, frame: null },
  );

  const writes: Array<readonly [string, number]> = [];
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
  TestValidator.equals(
    "mouth application keeps unavailable time inert and refuses malformed frames",
    {
      noRuntime: viewer.applyProductionDialogueMouth({
        runtime: null,
        frame: 3,
        actors,
      }).size,
      noFrame: viewer.applyProductionDialogueMouth({
        runtime,
        frame: null,
        actors,
      }).size,
      invalid: throwsWith(
        () =>
          viewer.applyProductionDialogueMouth({
            runtime,
            frame: 0.5,
            actors,
          }),
        "non-negative integer",
      ),
      absentWhileInactive: viewer.applyProductionDialogueMouth({
        runtime,
        frame: 19,
        actors: new Map(),
      }).size,
      overlap: throwsWith(
        () =>
          viewer.applyProductionDialogueMouth({
            runtime: {
              ...runtime,
              timelines: [
                runtime.timelines[0]!,
                { ...runtime.timelines[0]!, line: "forged-overlap" },
              ],
            },
            frame: 3,
            actors,
          }),
        "overlaps 2 mouth timelines",
      ),
    },
    {
      noRuntime: 0,
      noFrame: 0,
      invalid: true,
      absentWhileInactive: 0,
      overlap: true,
    },
  );
  writes.length = 0;
  const inactive = viewer.applyProductionDialogueMouth({
    runtime,
    frame: 19,
    actors,
  });
  TestValidator.equals(
    "an inactive mapped actor is explicitly returned to a closed mouth",
    {
      layer: inactive.get("actor"),
      writes,
    },
    {
      layer: {
        authored,
        mouth: { preset: "neutral", intensity: 0 },
      },
      writes: [
        ["aa", 0],
        ["ih", 0],
        ["ou", 0],
        ["ee", 0],
        ["oh", 0],
      ],
    },
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
                startFrame: 2,
                endFrame: 9,
              },
            ],
          },
          timeline,
          receipts: [
            receipt("line", 3, 5, "aa"),
            receipt("overlap", 2, 6, "ih"),
          ],
          bindings: [{ speaker: "voice", actor: "actor" }],
        }),
      "overlap on actor",
    ),
  );
  TestValidator.predicate(
    "same-frame mouth conflicts are refused independent of authored id order",
    throwsWith(
      () =>
        production.compileProductionDialogueRuntime({
          plan: {
            ...dialoguePlan(),
            dialogue: [
              {
                ...dialoguePlan().dialogue[0]!,
                id: "z-line",
              },
              {
                ...dialoguePlan().dialogue[0]!,
                id: "a-line",
              },
            ],
          },
          timeline,
          receipts: [
            receipt("z-line", 3, 5, "aa"),
            receipt("a-line", 3, 5, "ih"),
          ],
          bindings: [{ speaker: "voice", actor: "actor" }],
        }),
      "overlap on actor",
    ),
  );
  TestValidator.equals(
    "dialogue runtime refuses stale clocks and incomplete receipt closure",
    {
      clock: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: dialoguePlan(),
            timeline: { ...timeline, fps: 12 },
            receipts: [receipt("line", 3, 5, "aa")],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "share one input fingerprint",
      ),
      fingerprint: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: dialoguePlan(),
            timeline: {
              ...timeline,
              inputFingerprint:
                "sha256:1111111111111111111111111111111111111111111111111111111111111111" as AutoMovieContentDigest,
            },
            receipts: [receipt("line", 3, 5, "aa")],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "share one input fingerprint",
      ),
      totalFrames: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: dialoguePlan(),
            timeline: { ...timeline, totalFrames: 21 },
            receipts: [receipt("line", 3, 5, "aa")],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "share one input fingerprint",
      ),
      missing: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: dialoguePlan(),
            timeline,
            receipts: [],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "no final-byte synthesis receipt",
      ),
      extra: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: dialoguePlan(),
            timeline,
            receipts: [
              receipt("line", 3, 5, "aa"),
              receipt("absent", 3, 5, "aa"),
            ],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "absent plan lines",
      ),
      duplicateLine: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: {
              ...dialoguePlan(),
              dialogue: [
                dialoguePlan().dialogue[0]!,
                dialoguePlan().dialogue[0]!,
              ],
            },
            timeline,
            receipts: [receipt("line", 3, 5, "aa")],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "dialogue line ids must be non-blank and unique",
      ),
      duplicateReceipt: throwsWith(
        () =>
          production.compileProductionDialogueRuntime({
            plan: dialoguePlan(),
            timeline,
            receipts: [
              receipt("line", 3, 5, "aa"),
              receipt("line", 3, 5, "aa"),
            ],
            bindings: [{ speaker: "voice", actor: "actor" }],
          }),
        "dialogue receipt ids must be non-blank and unique",
      ),
    },
    {
      clock: true,
      fingerprint: true,
      totalFrames: true,
      missing: true,
      extra: true,
      duplicateLine: true,
      duplicateReceipt: true,
    },
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
  TestValidator.equals(
    "wearable admission refuses malformed compiled and selected identities",
    {
      blankCompiled: throwsWith(
        () =>
          viewer.selectProductionWearableSoftBodies(
            [{ id: " " } as IAutoMovieSoftBodyDomain],
            [],
          ),
        "Compiled soft-body domain ids",
      ),
      duplicateCompiled: throwsWith(
        () =>
          viewer.selectProductionWearableSoftBodies(
            [domains[0]!, domains[0]!],
            [],
          ),
        "Compiled soft-body domain ids",
      ),
      blankSelected: throwsWith(
        () => viewer.selectProductionWearableSoftBodies(domains, [" "]),
        "Live wearable soft-body ids",
      ),
    },
    { blankCompiled: true, duplicateCompiled: true, blankSelected: true },
  );

  const liveRuntime = await viewer.createCompiledShotRuntime(
    wearableCompiledShot(),
    "none",
    { dialogue: null, liveWearableSoftBodies: ["cape"] },
  );
  try {
    const renderer = rendererStub();
    const mesh = liveRuntime.scene.getObjectByName("soft:cape") as THREE.Mesh;
    liveRuntime.render(renderer, 0.2, "beauty", null);
    const forward = Array.from(
      (mesh.geometry.getAttribute("position") as THREE.BufferAttribute).array,
    );
    const status = liveRuntime.render(renderer, 0, "beauty", null);
    liveRuntime.render(renderer, 0.2, "beauty", null);
    const repeated = Array.from(
      (mesh.geometry.getAttribute("position") as THREE.BufferAttribute).array,
    );
    TestValidator.equals(
      "live wearable samples its moving actor boundary from zero on every seek",
      {
        anchoredX: Math.abs(forward[0]! - 0.2) < 1e-6,
        deterministic: JSON.stringify(forward) === JSON.stringify(repeated),
        initialStatus: status,
      },
      {
        anchoredX: true,
        deterministic: true,
        initialStatus: "shot  t=0.000s  beauty  S1/1 A1/C1 B2",
      },
    );
    TestValidator.predicate(
      "live wearable rejects a non-finite seek before inventing a boundary",
      throwsWith(
        () => liveRuntime.render(renderer, Number.NaN, "beauty", null),
        "non-finite time",
      ),
    );
  } finally {
    await liveRuntime.dispose();
  }
  const unselectedRuntime = await viewer.createCompiledShotRuntime(
    wearableCompiledShot(false),
    "none",
  );
  await unselectedRuntime.dispose();

  const baseSound = production.deriveProductionRuntimeSoundPlan({
    timeline,
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    sound: { propagation: propagationProfile() },
    acousticStudies: [],
    acousticBindings: [],
  });
  const drySound = production.deriveProductionRuntimeSoundPlan({
    timeline,
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", minimalCompiled()]]),
    sound: undefined,
    acousticStudies: [],
    acousticBindings: [],
  });
  TestValidator.equals(
    "omitted propagation and acoustics preserve the direct dry event",
    {
      propagation: drySound.events[0]!.propagation,
      acoustic: drySound.events[0]!.acousticResponse,
    },
    { propagation: undefined, acoustic: undefined },
  );
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

  const room = roomEnvironment("room", 5);
  const roomCompiled = {
    ...minimalCompiled(),
    builtEnvironments: [room],
  } as IAutoMovieCompiledShotSource;
  const study = acousticStudy("study", "room");
  const indoor = production.deriveProductionRuntimeSoundPlan({
    timeline,
    contracts: new Map([["shot", minimalContract()]]),
    compiled: new Map([["shot", roomCompiled]]),
    sound: acousticSound(),
    acousticStudies: [study],
    acousticBindings: [
      {
        event: event.id,
        sourceSpace: "room",
        listenerSpace: "room",
        study: "study",
      },
    ],
  });
  TestValidator.equals(
    "an exact room study becomes the event's bounded same-room response",
    {
      path: indoor.events[0]!.acousticResponse?.path,
      status: indoor.events[0]!.acousticResponse?.status,
      revision:
        indoor.events[0]!.acousticResponse?.status === "available"
          ? indoor.events[0]!.acousticResponse.inputRevision
          : null,
    },
    { path: "same-room", status: "available", revision: digest },
  );

  const soundAttempt =
    (props: {
      compiled?: IAutoMovieCompiledShotSource;
      sound?: unknown;
      studies?: readonly unknown[];
      bindings?: readonly {
        event: string;
        sourceSpace: string | null;
        listenerSpace: string | null;
        study: string | null;
      }[];
    }): (() => IAutoMovieProductionSoundPlan) =>
    () =>
      production.deriveProductionRuntimeSoundPlan({
        timeline,
        contracts: new Map([["shot", minimalContract()]]),
        compiled: new Map([["shot", props.compiled ?? minimalCompiled()]]),
        sound: props.sound ?? acousticSound(),
        acousticStudies: props.studies ?? [],
        acousticBindings: props.bindings ?? [],
      });
  TestValidator.equals(
    "acoustic integration refuses every missing or contradictory authored join",
    {
      bindingWithoutProfile: throwsWith(
        soundAttempt({
          sound: { propagation: propagationProfile() },
          bindings: [outdoorBinding(event.id)],
        }),
        "require an explicitly selected acoustic response profile",
      ),
      missingBinding: throwsWith(soundAttempt({}), "no explicit room binding"),
      missingStudy: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          bindings: [indoorBinding(event.id, "missing")],
        }),
        "selects missing acoustic study",
      ),
      studyOutdoors: throwsWith(
        soundAttempt({
          studies: [study],
          bindings: [{ ...outdoorBinding(event.id), study: "study" }],
        }),
        "must not select a room study",
      ),
      indoorWithoutStudy: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          bindings: [indoorBinding(event.id, null)],
        }),
        "must select one declared acoustic study",
      ),
      wrongStudyRoom: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          studies: [acousticStudy("study", "other")],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "does not answer the declared source room",
      ),
      wrongStudyPosition: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          studies: [
            {
              ...study,
              request: {
                ...study.request,
                sources: [
                  {
                    ...study.request.sources[0],
                    position: { x: 3, y: 0, z: 0 },
                  },
                ],
              },
            },
          ],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "exact one source and listener positions",
      ),
      wrongListenerPosition: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          studies: [
            {
              ...study,
              request: {
                ...study.request,
                receivers: [
                  {
                    ...study.request.receivers[0],
                    position: { x: 0, y: 0.5, z: 0 },
                  },
                ],
              },
            },
          ],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "exact one source and listener positions",
      ),
      wrongListenerDepth: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          studies: [
            {
              ...study,
              request: {
                ...study.request,
                receivers: [
                  {
                    ...study.request.receivers[0],
                    position: { x: 0, y: 0, z: 0.5 },
                  },
                ],
              },
            },
          ],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "exact one source and listener positions",
      ),
      outdoorPointInsideRoom: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          bindings: [outdoorBinding(event.id)],
        }),
        "declared outdoors but lies in authored space",
      ),
      missingSpace: throwsWith(
        soundAttempt({
          compiled: roomCompiled,
          studies: [study],
          bindings: [
            {
              event: event.id,
              sourceSpace: "missing",
              listenerSpace: "room",
              study: "study",
            },
          ],
        }),
        "must resolve in exactly one staged built environment",
      ),
      missingSpaceWithoutEnvironment: throwsWith(
        soundAttempt({
          studies: [study],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "must resolve in exactly one staged built environment",
      ),
      outsideDeclaredSpace: throwsWith(
        soundAttempt({
          compiled: {
            ...roomCompiled,
            builtEnvironments: [roomEnvironment("room", 2)],
          } as IAutoMovieCompiledShotSource,
          studies: [study],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "does not lie in declared space",
      ),
      duplicateSpaceOwner: throwsWith(
        soundAttempt({
          compiled: {
            ...roomCompiled,
            builtEnvironments: [room, { ...room, id: "second" }],
          } as IAutoMovieCompiledShotSource,
          studies: [study],
          bindings: [indoorBinding(event.id, "study")],
        }),
        "must resolve in exactly one staged built environment",
      ),
      staleBinding: throwsWith(
        soundAttempt({
          bindings: [outdoorBinding(event.id), outdoorBinding("absent")],
        }),
        "name absent sound occurrences",
      ),
      duplicateStudy: throwsWith(
        soundAttempt({
          studies: [study, study],
          bindings: [outdoorBinding(event.id)],
        }),
        "production acoustic study ids must be non-blank and unique",
      ),
      blankStudy: throwsWith(
        soundAttempt({
          studies: [{ ...study, id: " " }],
          bindings: [outdoorBinding(event.id)],
        }),
        "production acoustic study ids must be non-blank and unique",
      ),
      duplicateBinding: throwsWith(
        soundAttempt({
          bindings: [outdoorBinding(event.id), outdoorBinding(event.id)],
        }),
        "production acoustic event binding ids must be non-blank and unique",
      ),
    },
    {
      bindingWithoutProfile: true,
      missingBinding: true,
      missingStudy: true,
      studyOutdoors: true,
      indoorWithoutStudy: true,
      wrongStudyRoom: true,
      wrongStudyPosition: true,
      wrongListenerPosition: true,
      wrongListenerDepth: true,
      outdoorPointInsideRoom: true,
      missingSpace: true,
      missingSpaceWithoutEnvironment: true,
      outsideDeclaredSpace: true,
      duplicateSpaceOwner: true,
      staleBinding: true,
      duplicateStudy: true,
      blankStudy: true,
      duplicateBinding: true,
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

const acousticSound = () => ({
  propagation: propagationProfile(),
  acousticResponse: {
    kind: "derived-room-analysis" as const,
    id: "declared-room-path",
    solver: "sabine-broadband-v1" as const,
  },
});

const outdoorBinding = (event: string) => ({
  event,
  sourceSpace: null,
  listenerSpace: null,
  study: null,
});

const indoorBinding = (event: string, study: string | null) => ({
  event,
  sourceSpace: "room",
  listenerSpace: "room",
  study,
});

const acousticStudy = (id: string, subject: string) => ({
  id,
  request: {
    subject,
    volume: 100,
    surfaces: [{ id: "boundaries", area: 100, absorption: 0.5 }],
    partitions: [],
    sources: [
      {
        id: "actor",
        position: { x: 4, y: 0, z: 0 },
        soundPower: 80,
        directivity: 1,
      },
    ],
    receivers: [{ id: "camera", position: { x: 0, y: 0, z: 0 } }],
    targets: [],
  } satisfies Omit<IAutoMovieAcousticRequest, "id" | "inputRevision">,
});

const roomEnvironment = (
  room: string,
  maximumX: number,
): IAutoMovieBuiltEnvironment =>
  ({
    id: `environment-${maximumX}`,
    spaces: [
      {
        id: room,
        parent: null,
        cells: [
          {
            id: "cell",
            planes: [
              { normal: { x: 1, y: 0, z: 0 }, offset: maximumX },
              { normal: { x: -1, y: 0, z: 0 }, offset: 1 },
              { normal: { x: 0, y: 1, z: 0 }, offset: 1 },
              { normal: { x: 0, y: -1, z: 0 }, offset: 1 },
              { normal: { x: 0, y: 0, z: 1 }, offset: 1 },
              { normal: { x: 0, y: 0, z: -1 }, offset: 1 },
            ],
          },
        ],
      },
    ],
  }) as IAutoMovieBuiltEnvironment;

const wearableCompiledShot = (
  includeSelectedFurnishing = true,
): IAutoMovieCompiledShotSource => {
  const motion: IAutoMovieMotion = makeMotion(
    [
      keyframe(0, makePose([], IDENTITY_TRANSFORM)),
      keyframe(1, makePose([], transform(1))),
    ],
    1,
  );
  return {
    models: [
      createModel(),
      { ...createModel(), id: "prop-model", skeleton: null },
    ],
    motions: [motion],
    formations: [],
    formationMotions: [],
    formationSlotMotions: [],
    instanceSets: [],
    effects: [],
    scene: {
      id: "scene",
      name: null,
      nodes: [
        {
          id: "actor",
          model: "model-1",
          transform: IDENTITY_TRANSFORM,
          motion: motion.id,
          pose: makePose([], IDENTITY_TRANSFORM),
        },
        {
          id: "prop",
          model: "prop-model",
          transform: IDENTITY_TRANSFORM,
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
      performances: [],
    },
    softBodyDomains: [wearableDomain()],
    fluidDomains: [],
    waterFeatures: [],
    softFurnishings: includeSelectedFurnishing
      ? [
          {
            id: "cape-furnishing",
            environment: "environment",
            space: "space",
            domain: "cape",
            kind: "curtain",
            mode: "simulated",
            state: null,
            supports: [],
            material: null,
          },
        ]
      : [],
    plantingDomains: [],
    plantingClusters: [],
    plantingInstallations: [],
  } as unknown as IAutoMovieCompiledShotSource;
};

const wearableDomain = (): IAutoMovieSoftBodyDomain => ({
  version: 1,
  id: "cape",
  units: "meter",
  lattice: { columns: 2, rows: 2 },
  solver: {
    fixedStepSeconds: 0.1,
    gravity: { x: 0, y: 0, z: 0 },
    drag: 0,
    iterations: 1,
    stiffness: { structural: 0, shear: 0, bend: 0 },
    referenceSpeed: 1,
    maxSteps: 10,
  },
  rest: [0, 1, 0, 0, 0.5, 0, 0.5, 1, 0, 0.5, 0.5, 0],
  mass: [1, 1, 1, 1],
  anchors: [
    {
      id: "hips-anchor",
      particle: 0,
      position: null,
      binding: {
        kind: "actor-bone",
        actor: "actor",
        bone: "hips",
        offset: { x: 0, y: 0, z: 0 },
      },
    },
  ],
  states: [],
  colliders: [
    {
      kind: "body-capsule",
      id: "body",
      actor: "actor",
      capsule: { from: "hips", to: "head", radius: 0.2 },
    },
  ],
  wind: null,
  selfCollision: false,
});

const rendererStub = (): THREE.WebGLRenderer =>
  ({
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, type: THREE.PCFShadowMap },
    domElement: { height: 720 },
    render: () => undefined,
  }) as unknown as THREE.WebGLRenderer;

const throwsWith = (operation: () => unknown, text: string): boolean => {
  try {
    operation();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(text);
  }
};
