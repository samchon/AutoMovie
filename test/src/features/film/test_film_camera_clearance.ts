import {
  ViolationCollector,
  compileCameraClearanceReports,
  compileDefinedShot,
  defineShot,
  evaluateCameraClearance,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieCameraClearanceEnvelope,
  IAutoMovieShotProgram,
  IAutoMovieStage,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createModel, createSkeleton } from "../internal/fixtures";

const identity = (x = 0, y = 0, z = 0): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const box = (center: IAutoMovieVector3, half = 0.1) => ({
  min: { x: center.x - half, y: center.y - half, z: center.z - half },
  max: { x: center.x + half, y: center.y + half, z: center.z + half },
});

const envelope = (
  body: { center: IAutoMovieVector3; radius: number } = {
    center: { x: 0, y: 0, z: 0 },
    radius: 0.1,
  },
  parentRig: IAutoMovieCameraClearanceEnvelope["parentRig"] = null,
): IAutoMovieCameraClearanceEnvelope => ({ body, parentRig });

const evaluate = (
  over: {
    envelope?: IAutoMovieCameraClearanceEnvelope;
    revision?: string;
    currentRevision?: string;
    sampleRate?: number;
    duration?: number;
    samples?: Array<{
      time: number;
      camera: IAutoMovieTransform;
      obstacles: Array<{
        node: string;
        bounds: ReturnType<typeof box>;
      }>;
    }>;
  } = {},
) =>
  evaluateCameraClearance({
    camera: "camera-main",
    envelope: over.envelope ?? envelope(),
    revision: over.revision ?? "revision-7",
    currentRevision: over.currentRevision ?? "revision-7",
    sampleRate: over.sampleRate ?? 1,
    duration: over.duration ?? 1,
    samples:
      over.samples ??
      [0, 1].map((time) => ({
        time,
        camera: identity(),
        obstacles: [{ node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) }],
      })),
  });

const throws = (closure: () => unknown, text: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(text);
  }
};

const stageWithClearance = (
  clearance: IAutoMovieCameraClearanceEnvelope,
): IAutoMovieStage => {
  const base = makeStagingWrite();
  return {
    ...base,
    cameras: [
      {
        ...base.cameras[0]!,
        near: 0.1,
        far: 100,
        depthPrecision: {
          minimumDepthBits: 24,
          maximumStepMeters: 1,
        },
        clearance,
      },
    ],
  };
};

const runtimeModels = () => [
  { ...createModel(), id: "stickman" },
  { ...createModel(), id: "knightB" },
];

/**
 * Camera body and parent-rig clearance are continuous, current-revision gates.
 *
 * Scenarios:
 *
 * 1. Exact sphere/box boundary contact blocks a static camera.
 * 2. Clear endpoints do not hide a midpoint wall penetration.
 * 3. A parent rig can collide while the camera body remains clear.
 * 4. A moving subject crossing a fixed camera is compared at the same samples.
 * 5. Rotation of an offset envelope carries the conservative arc, not merely
 *    its endpoint chord.
 * 6. A current clear result is publishable while a stale revision is not.
 * 7. Malformed clocks, boxes, duplicate obstacles, and changing identity sets
 *    are refused at the evaluator boundary.
 * 8. Stage validation rejects malformed nested envelopes and deep-lowers a
 *    valid envelope without retaining author-object aliases.
 * 9. Performance preserves a clear report, while compiler-visible body contact
 *    and a stale geometry snapshot return addressed refusal.
 */
export const test_film_camera_clearance = (): void => {
  const boundary = evaluate({
    samples: [0, 1].map((time) => ({
      time,
      camera: identity(),
      obstacles: [{ node: "wall", bounds: box({ x: 0.2, y: 0, z: 0 }, 0.1) }],
    })),
  });
  TestValidator.equals(
    "inclusive static boundary contact",
    boundary.status,
    "blocked",
  );
  TestValidator.equals("boundary finding is addressed", boundary.findings, [
    { part: "body", obstacle: "wall", start: 0, end: 1 },
  ]);

  const midpoint = evaluate({
    samples: [
      {
        time: 0,
        camera: identity(-2),
        obstacles: [{ node: "wall", bounds: box({ x: 0, y: 0, z: 0 }) }],
      },
      {
        time: 1,
        camera: identity(2),
        obstacles: [{ node: "wall", bounds: box({ x: 0, y: 0, z: 0 }) }],
      },
    ],
  });
  TestValidator.equals(
    "clear endpoints still catch midpoint penetration",
    midpoint.status,
    "blocked",
  );

  const rigOnly = evaluate({
    envelope: envelope(
      { center: { x: 0, y: 3, z: 0 }, radius: 0.1 },
      { center: { x: 0, y: 0, z: 0 }, radius: 0.1 },
    ),
    samples: [0, 1].map((time) => ({
      time,
      camera: identity(),
      obstacles: [{ node: "support", bounds: box({ x: 0, y: 0, z: 0 }) }],
    })),
  });
  TestValidator.equals("rig-only collision is distinct", rigOnly.findings, [
    { part: "parent-rig", obstacle: "support", start: 0, end: 1 },
  ]);

  const moving = evaluate({
    samples: [
      {
        time: 0,
        camera: identity(),
        obstacles: [{ node: "actor", bounds: box({ x: -2, y: 0, z: 0 }) }],
      },
      {
        time: 1,
        camera: identity(),
        obstacles: [{ node: "actor", bounds: box({ x: 2, y: 0, z: 0 }) }],
      },
    ],
  });
  TestValidator.equals(
    "moving subject same-sample crossing",
    moving.status,
    "blocked",
  );

  const rotating = evaluate({
    envelope: envelope({ center: { x: 1, y: 0, z: 0 }, radius: 0.01 }),
    samples: [
      {
        time: 0,
        camera: identity(),
        obstacles: [
          { node: "ceiling", bounds: box({ x: 0, y: 1, z: 0 }, 0.01) },
        ],
      },
      {
        time: 1,
        camera: {
          ...identity(),
          rotation: { x: 0, y: 0, z: 1, w: 0 },
        },
        obstacles: [
          { node: "ceiling", bounds: box({ x: 0, y: 1, z: 0 }, 0.01) },
        ],
      },
    ],
  });
  TestValidator.equals(
    "offset rotation arc is conservatively covered",
    rotating.status,
    "blocked",
  );

  const clear = evaluate();
  const stale = evaluate({ currentRevision: "revision-8" });
  const instant = evaluate({
    duration: 0,
    samples: [
      {
        time: 0,
        camera: { ...identity(), scale: { x: 2, y: 1, z: 1 } },
        obstacles: [{ node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) }],
      },
    ],
  });
  TestValidator.equals(
    "current clear, stale, and zero-duration reports stay distinct",
    [
      [clear.status, clear.intervals, clear.findings.length],
      [stale.status, stale.intervals, stale.findings.length],
      [instant.status, instant.intervals, instant.findings.length],
    ],
    [
      ["clear", 1, 0],
      ["stale", 0, 0],
      ["clear", 0, 0],
    ],
  );

  TestValidator.equals(
    "malformed evaluation inputs are refused",
    [
      throws(() => evaluate({ sampleRate: 0 }), "sampleRate"),
      throws(() => evaluate({ duration: -1 }), "duration"),
      throws(() => evaluate({ samples: [] }), "fixed-clock"),
      throws(
        () =>
          evaluate({
            samples: [0, 1].map((time) => ({
              time,
              camera: identity(),
              obstacles: [
                {
                  node: "wall",
                  bounds: {
                    min: { x: Number.NaN, y: 0, z: 0 },
                    max: { x: 1, y: 1, z: 1 },
                  },
                },
              ],
            })),
          }),
        "finite coordinates",
      ),
      throws(
        () =>
          evaluate({
            samples: [0, 1].map((time) => ({
              time,
              camera: identity(),
              obstacles: [
                {
                  node: "wall",
                  bounds: {
                    min: { x: 2, y: 0, z: 0 },
                    max: { x: 1, y: 1, z: 1 },
                  },
                },
              ],
            })),
          }),
        "minimum",
      ),
      throws(
        () =>
          evaluate({
            samples: [0, 1].map((time) => ({
              time,
              camera: identity(),
              obstacles: [
                { node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) },
                { node: "wall", bounds: box({ x: 6, y: 0, z: 0 }) },
              ],
            })),
          }),
        "duplicates",
      ),
      throws(
        () =>
          evaluate({
            samples: [
              {
                time: 0,
                camera: identity(),
                obstacles: [
                  { node: "wall", bounds: box({ x: 5, y: 0, z: 0 }) },
                ],
              },
              {
                time: 1,
                camera: identity(),
                obstacles: [
                  { node: "floor", bounds: box({ x: 5, y: 0, z: 0 }) },
                ],
              },
            ],
          }),
        "identity set",
      ),
    ],
    [true, true, true, true, true, true, true],
  );

  const authored = stageWithClearance(envelope());
  const staged = stageScene(makeScriptWrite(), authored);
  TestValidator.equals("valid stage envelope lowers", staged.success, true);
  if (staged.success === true) {
    authored.cameras[0]!.clearance!.body.center.x = 99;
    TestValidator.equals(
      "resolved envelope does not alias author input",
      staged.scene.cameras[0]!.clearance!.body.center.x,
      0,
    );
  }
  const malformed = [
    null,
    { body: null, parentRig: null },
    { body: { center: [], radius: 0.1 }, parentRig: null },
    {
      body: { center: { x: Number.NaN, y: 0, z: 0 }, radius: 0.1 },
      parentRig: null,
    },
    {
      body: { center: { x: 0, y: 0, z: 0 }, radius: 0 },
      parentRig: null,
    },
    { body: { center: { x: 0, y: 0, z: 0 }, radius: 0.1 } },
    {
      body: { center: { x: 0, y: 0, z: 0 }, radius: 0.1 },
      parentRig: { center: { x: 0, y: Infinity, z: 0 }, radius: -1 },
    },
  ].map((clearance) =>
    stageScene(
      makeScriptWrite(),
      stageWithClearance(
        clearance as unknown as IAutoMovieCameraClearanceEnvelope,
      ),
    ),
  );
  TestValidator.predicate(
    "every malformed envelope is refused at its clearance member",
    malformed.every(
      (result) =>
        result.success === false &&
        result.violations.some((item) => item.path.includes(".clearance")),
    ),
  );

  const clearStage = stageScene(
    makeScriptWrite(),
    stageWithClearance(
      envelope({ center: { x: 0, y: 0, z: 0 }, radius: 0.01 }),
    ),
  );
  if (clearStage.success !== true)
    throw new Error("clearance performance fixture must stage");
  const performanceProps = {
    script: makeScriptWrite(),
    staged: clearStage,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
    models: runtimeModels(),
  };
  const performed = performShot({
    ...performanceProps,
    cameraClearance: {
      revision: "current",
      currentRevision: "current",
      sampleRate: 24,
    },
  });
  TestValidator.predicate(
    "current clear performance preserves its report",
    performed.success === true &&
      performed.shot.cameraClearance?.[0]?.status === "clear" &&
      performed.shot.cameraClearance[0].intervals === 48,
  );
  if (performed.success !== true)
    throw new Error("clearance performance fixture must perform");

  const heroCamera = clearStage.scene.cameras.find(
    (camera) => camera.id === performed.shot.camera,
  )!;
  const baseAdapterProps = {
    scene: clearStage.scene,
    hero: { camera: heroCamera, motion: performed.shot.cameraMotion },
    coverage: performed.shot.coverage ?? [],
    duration: performed.shot.duration,
    motions: performed.motions,
    objectMotions: performed.shot.objectMotions,
    models: runtimeModels(),
    runtime: {
      revision: "current",
      currentRevision: "current",
      sampleRate: 24,
    },
  };
  const inspectAdapter = (
    over: Partial<typeof baseAdapterProps> = {},
  ): {
    reports: ReturnType<typeof compileCameraClearanceReports>;
    out: ViolationCollector;
  } => {
    const out = new ViolationCollector();
    const reports = compileCameraClearanceReports({
      ...baseAdapterProps,
      ...over,
      out,
    });
    return { reports, out };
  };

  const plainCamera = { ...heroCamera, clearance: undefined };
  const plain = inspectAdapter({
    scene: { ...clearStage.scene, cameras: [plainCamera] },
    hero: { camera: plainCamera, motion: performed.shot.cameraMotion },
    runtime: undefined,
  });
  const noRuntime = inspectAdapter({ runtime: undefined });
  TestValidator.equals(
    "legacy camera and missing compiler authority remain distinct",
    [
      [plain.reports, plain.out.items.length],
      [noRuntime.reports, noRuntime.out.items[0]?.path],
    ],
    [
      [undefined, 0],
      [undefined, "$input.cameraClearance"],
    ],
  );

  const missingGeometry = inspectAdapter({ models: [] });
  const emptyGeometry = inspectAdapter({
    models: runtimeModels().map((model) => ({ ...model, parts: [] })),
  });
  TestValidator.predicate(
    "absent and empty obstacle geometry are addressed rather than skipped",
    [missingGeometry, emptyGeometry].every(
      ({ reports, out }) =>
        reports === undefined &&
        out.items.length === clearStage.scene.nodes.length &&
        out.items.every((item) => item.path.endsWith(".model")),
    ),
  );

  const propModel = { ...createModel(null), id: "prop" };
  const sourceNode = clearStage.scene.nodes[0]!;
  const staticNode = {
    ...sourceNode,
    id: "static-prop",
    model: "prop",
    transform: identity(20, 20, 20),
  };
  const movingNode = {
    ...sourceNode,
    id: "moving-prop",
    model: "prop",
    transform: identity(30, 30, 30),
  };
  const alternateCamera = { ...heroCamera, id: "cam-alt" };
  const animated = inspectAdapter({
    scene: {
      ...clearStage.scene,
      nodes: [...clearStage.scene.nodes, staticNode, movingNode],
      cameras: [...clearStage.scene.cameras, alternateCamera],
    },
    coverage: [{ camera: "cam-alt", cameraMotion: null, cameraIntent: [] }],
    models: [...runtimeModels(), propModel],
    objectMotions: [
      {
        id: "moving-prop-transform",
        name: null,
        duration: 2,
        loop: false,
        tracks: [
          {
            channel: {
              kind: "node",
              node: "moving-prop",
              path: "translation",
            },
            times: [0, 2],
            values: [30, 30, 30, 31, 31, 31],
            interpolation: "linear",
          },
          {
            channel: {
              kind: "node",
              node: "moving-prop",
              path: "rotation",
            },
            times: [0, 2],
            values: [0, 0, 0, 1, 0, 0, 1, 0],
            interpolation: "linear",
          },
          {
            channel: {
              kind: "node",
              node: "moving-prop",
              path: "scale",
            },
            times: [0, 2],
            values: [1, 1, 1, 2, 2, 2],
            interpolation: "linear",
          },
        ],
      },
    ],
  });
  TestValidator.predicate(
    "static and moving obstacles share the clock across hero and coverage takes",
    animated.out.items.length === 0 &&
      animated.reports?.length === 2 &&
      animated.reports.every((report) => report.status === "clear"),
  );

  const evaluatorFault = inspectAdapter({
    runtime: { ...baseAdapterProps.runtime, sampleRate: 0 },
  });
  TestValidator.predicate(
    "an invalid compiler clock is returned at the camera envelope",
    evaluatorFault.reports === undefined &&
      evaluatorFault.out.items.some(
        (item) =>
          item.path === "$input.cameraClearance.sampleRate" &&
          item.expected.includes("sample rate"),
      ),
  );

  const rigCamera = {
    ...heroCamera,
    clearance: envelope(
      { center: { x: 0, y: 100, z: 0 }, radius: 0.01 },
      { center: { x: 0, y: 0, z: 0 }, radius: 3 },
    ),
  };
  const rigBlocked = inspectAdapter({
    scene: { ...clearStage.scene, cameras: [rigCamera] },
    hero: { camera: rigCamera, motion: performed.shot.cameraMotion },
  });
  TestValidator.predicate(
    "performance addresses a parent-rig contact at its own member",
    rigBlocked.reports === undefined &&
      rigBlocked.out.items.some(
        (item) =>
          item.path.endsWith(".clearance.parentRig") &&
          item.expected.includes("parent-rig"),
      ),
  );

  const stalePerformance = performShot({
    ...performanceProps,
    cameraClearance: {
      revision: "old",
      currentRevision: "current",
      sampleRate: 24,
    },
  });
  TestValidator.predicate(
    "stale performance is addressed",
    stalePerformance.success === false &&
      stalePerformance.violations.some(
        (item) => item.path === "$input.cameraClearance.currentRevision",
      ),
  );

  const blockedProgram = (): IAutoMovieShotProgram => {
    const blocking = makeBlockingWrite();
    const performance = makePerformanceWrite();
    blocking.camera.framing = "full";
    for (const action of performance.draft)
      if (action.verb === "frame") action.framing = "full";
    return {
      actors: [
        { node: "knightA", model: "knightA", speed: 1, eyeHeight: 1.6 },
        { node: "knightB", model: "knightB", speed: 1, eyeHeight: 1.6 },
      ],
      script: makeScriptWrite(),
      stage: stageWithClearance(
        envelope({ center: { x: 0, y: 0, z: 0 }, radius: 3 }),
      ),
      blocking,
      performance,
      eventSamples: [],
    };
  };
  const blocked = compileDefinedShot({
    shot: defineShot("clearance-blocked", {
      scene: "scene-duel",
      contract: {
        beat: "beat-1",
        durationSeconds: 2,
        participants: [
          { kind: "actor", id: "knightA" },
          { kind: "actor", id: "knightB" },
        ],
        opening: [],
        closing: [],
        camera: {
          intent: "Keep the duel readable without crossing the actors.",
          requiredSubjects: ["knightA", "knightB"],
          maxOcclusionRatio: 0.2,
        },
        events: [],
        reviewFrames: [],
      },
      build: blockedProgram,
    }),
    context: undefined,
    runtime: {
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
      frameFormat: { width: 1920, height: 1080 },
      models: runtimeModels(),
      cameraClearance: {
        revision: "current",
        currentRevision: "current",
        sampleRate: 24,
      },
    },
  });
  TestValidator.predicate(
    "compiler returns an addressed camera-body refusal",
    blocked.success === false &&
      blocked.diagnostics.some(
        (item) =>
          item.phase === "performance" &&
          item.path.includes(".clearance.body") &&
          item.fact.includes("contacts obstacle"),
      ),
  );
};
