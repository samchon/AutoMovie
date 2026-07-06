import {
  IAutoMovieAssembleApplication,
  IAutoMovieGait,
  IAutoMovieRenderSpec,
  IAutoMovieScript,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

const app = new AutoMovieApplication();

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const emptySlate: IAutoMovieMcpWritableSlate = {
  script: null,
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
};

const actorContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const skeleton = createSkeleton();
  return {
    skeleton: skeleton.id,
    gaits: [walk],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig: skeleton,
  };
};

const scriptArtifact = (
  script: ReturnType<typeof makeScriptWrite>,
): IAutoMovieScript => ({
  logline: script.logline,
  theme: script.theme,
  cast: script.cast,
  beats: script.beats,
});

const assemble = (shot: string): IAutoMovieAssembleApplication.IWrite => ({
  type: "write",
  sequence: { id: "seq-smoke", name: "smoke" },
  fps: 12,
  entries: [{ shot, trim: null, transition: null }],
  pacing: "single continuous beat.",
  continuity: "one-shot smoke path.",
});

/**
 * The MCP toolbox can build and commit a one-shot film while refusing invalid
 * call order.
 *
 * Scenarios:
 *
 * 1. A shot commit before script/scene is refused and leaves the slate empty.
 * 2. The same fixtures then follow the intended tool order through script, stage,
 *    scene commit, block, perform, shot commit, cut, film commit, render plan,
 *    and preview-frame planning.
 */
export const test_mcp_agent_toolbox_smoke = (): void => {
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("stage must succeed");

  const refusedShot = app.commitShot({
    slate: emptySlate,
    shot: {
      id: "shot:beat-1",
      name: null,
      scene: staged.scene.id,
      camera: "cam-main",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 1,
    },
  });
  TestValidator.equals(
    "wrong order not committed",
    refusedShot.committed,
    false,
  );
  TestValidator.equals(
    "wrong order leaves slate empty",
    refusedShot.slate,
    emptySlate,
  );

  const scripted = app.commitScript({
    slate: emptySlate,
    script: scriptArtifact(script),
  });
  TestValidator.equals("script committed", scripted.committed, true);

  const sceneCommitted = app.commitScene({
    slate: scripted.slate,
    scene: staged.scene,
    models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
      (id) => ({ id, skeleton: null }),
    ),
  });
  TestValidator.equals("scene committed", sceneCommitted.committed, true);

  const blocked = app.block({
    script,
    staged,
    blocking: makeBlockingWrite({ duration: 1 }),
  }).blocked;
  TestValidator.equals("block succeeds", blocked.success, true);
  if (blocked.success !== true) return;

  const position = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((entry) => entry.id === id);
    if (node === undefined) throw new Error(`missing node ${id}`);
    return node.transform.translation;
  };
  const performed = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      duration: 1,
      draft: [
        {
          verb: "locomote",
          actor: ["knightA", "knightB"],
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
        },
        {
          verb: "frame",
          actor: "cam-main",
          start: 0,
          duration: "auto",
          framing: "medium",
          move: "static",
          on: { kind: "node", node: "knightA" },
        },
      ],
    }),
    actors: {
      knightA: actorContext(position("knightA"), 0),
      knightB: actorContext(position("knightB"), 180),
    },
    blocking: blocked.blocking,
  }).performed;
  TestValidator.equals("perform succeeds", performed.success, true);
  if (performed.success !== true) return;

  const shotCommitted = app.commitShot({
    slate: sceneCommitted.slate,
    shot: performed.shot,
    motions: performed.motions,
  });
  TestValidator.equals("shot committed", shotCommitted.committed, true);

  const cut = app.cut({
    assemble: assemble(performed.shot.id),
    shots: [performed.shot],
  }).cut;
  TestValidator.equals("cut succeeds", cut.success, true);
  if (cut.success !== true) return;

  const filmCommitted = app.commitFilm({
    slate: shotCommitted.slate,
    film: cut.sequence,
  });
  TestValidator.equals("film committed", filmCommitted.committed, true);

  const spec: IAutoMovieRenderSpec = {
    target: cut.sequence.id,
    fps: 12,
    width: 640,
    height: 360,
    toneMapping: "none",
    codec: "h264",
    pixelFormat: "yuv420p",
    crf: 20,
  };
  const renderPlan = app.planRender({ slate: filmCommitted.slate, spec }).plan;
  if (renderPlan === null) throw new Error("render plan must succeed");
  TestValidator.equals("render plan target", renderPlan.target, {
    kind: "sequence",
    id: cut.sequence.id,
  });
  TestValidator.equals("render frame count", renderPlan.frameCount, 12);

  const preview = app.seeFrame({
    slate: filmCommitted.slate,
    spec,
    frame: 1,
  }).preview;
  if (preview === null) throw new Error("preview must succeed");
  TestValidator.equals("preview frame", preview.frame, 1);
};
