import {
  HUMANOID_GAITS,
  HUMANOID_JOINT_AXES,
  IAutoMovieActorContext,
  blockBeat,
  cutSequence,
  makeActorSynthesizer,
  performShot,
  resolveSequencePlayback,
  stageScene,
} from "@automovie/engine";
import {
  AutoMovieGuidePass,
  IAutoMovieBlockingApplication,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";
import { type IAutoMovieSequenceRenderFrame } from "@automovie/render";
import {
  AutoMoviePlayer,
  IAutoMovieRenderModeHandle,
  applyObjectMotion,
  applyPose,
  applyRenderMode,
  buildModel,
  mountViewer,
  renderCrossDissolve,
} from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

// The film pipeline end to end, on screen: the same stage payloads the LLM
// harness will emit (script → staging → blocking → performance → assemble),
// consumed by the engine's film compilers, played back through the sequence
// resolver — real gait travel, a follow camera compiled from a `frame` verb,
// a hard cut onto an orbiting close-up. Deterministic via `renderAt(t)`, so
// capture-shots.mjs bakes the identical film every run.

// ── the stage payloads (what the LLM will author; fixtures here) ─────────────
const script: IAutoMovieScriptApplication.IWrite = {
  type: "write",
  logline: "A pursuer closes the distance; the one waiting never turns.",
  theme: "inevitability at walking pace",
  cast: [
    { node: "walker", character: "the pursuer", modelRef: "stickman" },
    { node: "waiter", character: "the one who waits", modelRef: "stickman" },
  ],
  beats: [
    {
      id: "approach",
      name: "the approach",
      summary: "the walker crosses the floor toward the waiter's back",
      durationHint: 3,
    },
    {
      id: "face-off",
      name: "the face-off",
      summary: "both hold; the camera circles the waiter",
      durationHint: 2.5,
    },
  ],
};

const staging: IAutoMovieStagingApplication.IWrite = {
  type: "write",
  scene: { id: "scene-pursuit", name: "the pursuit" },
  plan: "walker starts 2.95 m behind the waiter, both facing +Z; the camera stands side-on and follows the walker in.",
  actors: [
    { node: "walker", position: { x: 0, y: 0, z: -2.4 }, facingDeg: 0 },
    { node: "waiter", position: { x: 0, y: 0, z: 0.55 }, facingDeg: 0 },
  ],
  cameras: [
    {
      node: "cam-main",
      position: { x: 2.2, y: 1.4, z: -0.8 },
      lookAt: { kind: "node", node: "walker" },
      fovDeg: 40,
    },
  ],
  lights: [
    {
      node: "sun",
      role: "sun",
      direction: { x: -1, y: -1.4, z: 0.4 },
      intensity: 1.4,
    },
  ],
};

const blockings: IAutoMovieBlockingApplication.IWrite[] = [
  {
    type: "write",
    beat: "approach",
    analysis: "the distance itself is the drama — the walk must read whole.",
    rationale:
      "a medium follow keeps the walker's stride and the shrinking gap in one frame.",
    actors: [
      {
        node: "walker",
        beats: "walks the 2.25 m to just behind the waiter, eyes on him",
        anchors: [{ t: 2.8, cue: "the last step lands" }],
      },
      { node: "waiter", beats: "stands dead still, facing away" },
    ],
    camera: {
      framing: "full",
      move: "follow",
      on: { kind: "node", node: "walker" },
    },
    duration: 3,
  },
  {
    type: "write",
    beat: "face-off",
    analysis: "stillness after motion — the circle asks who moves first.",
    rationale:
      "an orbiting close-up on the waiter turns his stillness into tension.",
    actors: [
      { node: "walker", beats: "holds one pace behind, watching" },
      { node: "waiter", beats: "holds, jaw set" },
    ],
    camera: {
      framing: "full",
      move: "orbit",
      on: { kind: "node", node: "waiter" },
    },
    duration: 2.5,
  },
];

const performances: IAutoMoviePerformanceApplication.IWrite[] = [
  {
    type: "write",
    beat: "approach",
    plan: "one locomote covers the whole beat; the head tracks the waiter; the camera follows.",
    draft: [
      {
        verb: "locomote",
        actor: "walker",
        start: 0,
        duration: 3,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: -0.15 } },
      },
      {
        verb: "lookAt",
        actor: "walker",
        start: 0,
        duration: 3,
        to: { kind: "node", node: "waiter" },
      },
      { verb: "hold", actor: "waiter", start: 0, duration: 3 },
      {
        verb: "frame",
        actor: "cam-main",
        start: 0,
        duration: "auto",
        framing: "full",
        move: "follow",
        on: { kind: "node", node: "walker" },
      },
    ],
    revise: {
      review: "stride covers the gap; the follow keeps both in frame.",
      final: null,
    },
    duration: 3,
  },
  {
    type: "write",
    beat: "face-off",
    plan: "both hold; the camera orbits the waiter in close.",
    draft: [
      { verb: "hold", actor: "walker", start: 0, duration: 2.5 },
      {
        verb: "emote",
        actor: "waiter",
        start: 0,
        duration: 2.5,
        preset: "angry",
        intensity: 0.8,
      },
      {
        verb: "frame",
        actor: "cam-main",
        start: 0,
        duration: "auto",
        framing: "full",
        move: "orbit",
        on: { kind: "node", node: "waiter" },
      },
    ],
    revise: {
      review: "nothing moves but the camera — as blocked.",
      final: null,
    },
    duration: 2.5,
  },
];

// ── rigs + the content seam ──────────────────────────────────────────────────
const walkerRig = buildStickman(DEFAULT_STICKMAN);
const waiterRig = buildStickman(DEFAULT_STICKMAN);
const rigOf = { walker: walkerRig, waiter: waiterRig } as const;

// The canonical humanoid walk from the engine's gait library — bent knees
// (neutral-centered so they stay in ROM), contralateral arm swing, already
// tuned. The demo drops it straight into the actor context; no hand-authoring.
const WALK = HUMANOID_GAITS.walk;

const staged = stageScene(script, staging);
if (staged.success !== true) throw new Error("staging failed");

const nodePositions = new Map<string, IAutoMovieVector3>(
  staged.scene.nodes.map((n) => [n.id, n.transform.translation]),
);
const contexts = new Map<string, IAutoMovieActorContext>(
  staged.scene.nodes.map((n) => [
    n.id,
    {
      skeleton: rigOf[n.id as keyof typeof rigOf].skeleton.id,
      gaits: [WALK],
      position: n.transform.translation,
      speed: 0.75,
      facingDeg: 0,
      eyeHeight: 1.45,
      restPose: {
        skeleton: rigOf[n.id as keyof typeof rigOf].skeleton.id,
        root: null,
        joints: [],
      },
    },
  ]),
);
const synthesize = makeActorSynthesizer(contexts, nodePositions);

// ── the ladder: block → perform → cut ────────────────────────────────────────
const shots: IAutoMovieShot[] = [];
const motionsByShot = new Map<string, Record<string, IAutoMovieMotion>>();
performances.forEach((performance, i) => {
  const blocked = blockBeat(script, staged, blockings[i]!);
  if (blocked.success !== true)
    throw new Error(`blocking failed: ${JSON.stringify(blocked.violations)}`);
  const performed = performShot({
    script,
    staged,
    performance,
    synthesize,
    skeleton: (node) => rigOf[node as keyof typeof rigOf].skeleton,
    blocking: blocked.blocking,
  });
  if (performed.success !== true)
    throw new Error(`perform failed: ${JSON.stringify(performed.violations)}`);
  shots.push(performed.shot);
  motionsByShot.set(performed.shot.id, performed.motions);
});

const cut = cutSequence(
  {
    type: "write",
    sequence: { id: "seq-pursuit", name: "the pursuit" },
    fps: 30,
    entries: shots.map((s, i) => ({
      shot: s.id,
      trim: null,
      // dissolve the approach into the face-off close-up (a soft reveal); the
      // first entry has nothing to transition from.
      transition:
        i === 1 ? { kind: "crossDissolve" as const, duration: 0.6 } : null,
    })),
    pacing: "the walk dissolves into the face-off close-up.",
    continuity: "the walker ends where the close-up finds him.",
  },
  shots,
);
if (cut.success !== true) throw new Error("cut failed");
export const FILM_DURATION = cut.runtime;

// ── the set: scene nodes → three.js ─────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f8);
scene.add(new THREE.GridHelper(10, 20, 0xb8c0cc, 0xd5dbe4));
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2.4, 3.4, -1);
scene.add(sun);

// node id → its scene group, so a shot's objectMotions (a projectile/prop's
// baked clip) can drive the object's world transform each frame.
const groupsById = new Map<string, THREE.Group>();

// Staged base per node — the FULL transform, scale included (the hand-rolled
// group setup used to drop staged scale, #1087).
const stagedNodeById = new Map(staged.scene.nodes.map((n) => [n.id, n]));
const applyStagedBase = (group: THREE.Group, nodeId: string): void => {
  const {
    translation: t,
    rotation: r,
    scale: s,
  } = stagedNodeById.get(nodeId)!.transform;
  group.position.set(t.x, t.y, t.z);
  group.quaternion.set(r.x, r.y, r.z, r.w);
  group.scale.set(s.x, s.y, s.z);
};
const built = Object.fromEntries(
  staged.scene.nodes.map((node) => {
    const rig = rigOf[node.id as keyof typeof rigOf];
    const obj = buildModel(rig.model);
    const group = new THREE.Group();
    applyStagedBase(group, node.id);
    group.add(obj.object);
    scene.add(group);
    groupsById.set(node.id, group);
    return [node.id, obj] as const;
  }),
);

// One player per (shot, performing node); seeking a shot drives its players.
const playersByShot = new Map<
  string,
  { node: string; player: AutoMoviePlayer }[]
>(
  shots.map((shot) => [
    shot.id,
    shot.performances.map((p) => ({
      node: p.node,
      player: new AutoMoviePlayer(
        built[p.node]!,
        rigOf[p.node as keyof typeof rigOf].skeleton,
        motionsByShot.get(shot.id)![p.node]!,
        HUMANOID_JOINT_AXES,
      ),
    })),
  ]),
);

// ── the projector: global seconds → posed set + framed camera ────────────────
const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 100);
const stagedCam = staged.scene.cameras[0]!;
const applyStagedCamera = (): void => {
  const t = stagedCam.transform.translation;
  const r = stagedCam.transform.rotation;
  camera.position.set(t.x, t.y, t.z);
  camera.quaternion.set(r.x, r.y, r.z, r.w);
  camera.fov = stagedCam.fovY;
  camera.updateProjectionMatrix();
};
applyStagedCamera();

const shotById = new Map(shots.map((s) => [s.id, s]));

type SequenceRenderFrameSample = Pick<
  IAutoMovieSequenceRenderFrame,
  "shot" | "shotTimeSeconds" | "blend"
>;

type SequenceRenderShotSample = {
  shot: string;
  shotTimeSeconds: number;
};

// Pose the scene and aim the camera for one shot at its shot-local time: advance
// each player, ride any objectMotions, and set the camera (its motion or the
// staged default). The read side used both for a plain frame and for each half
// of a cross-dissolve.
const poseShot = (shot: IAutoMovieShot, time: number): void => {
  // The applyObjectMotion host contract: a host that swaps clips mid-scene
  // restores staged bases itself (#1087). Without this reset a node driven by
  // shot A's objectMotion but absent from shot B kept A's tail transform —
  // order-dependent frames that break chunked capture's determinism promise
  // (a fresh page at a chunk boundary would render the staged base instead).
  // Rigs without a performance in this shot likewise return to rest, not the
  // previous shot's last pose — the same reset applyStagedCamera performs.
  const performing = new Set(shot.performances.map((p) => p.node));
  for (const node of staged.scene.nodes) {
    applyStagedBase(groupsById.get(node.id)!, node.id);
    if (performing.has(node.id)) continue;
    const rig = rigOf[node.id as keyof typeof rigOf];
    applyPose(
      built[node.id]!,
      { skeleton: rig.skeleton.id, root: null, joints: [] },
      rig.skeleton,
      HUMANOID_JOINT_AXES,
    );
  }
  for (const { player } of playersByShot.get(shot.id)!) player.update(time);
  for (const clip of shot.objectMotions)
    applyObjectMotion(clip, time, (node) => groupsById.get(node));
  if (shot.cameraMotion === null) applyStagedCamera();
  else applyObjectMotion(shot.cameraMotion, time, () => camera);
};

// Draw one manifest frame sample. On a hard cut it only poses the live shot and
// returns false (the caller renders); inside a transition it composites the
// outgoing tail and the incoming shot into a cross-dissolve itself and returns
// true.
const drawSequenceFrame = (frame: SequenceRenderFrameSample): boolean => {
  const live = shotById.get(frame.shot)!;
  if (frame.blend === null) {
    poseShot(live, frame.shotTimeSeconds);
    return false;
  }
  const b = frame.blend;
  const outgoing = shotById.get(b.shot)!;
  renderCrossDissolve(
    renderer,
    scene,
    camera,
    () => poseShot(outgoing, b.shotTimeSeconds),
    () => poseShot(live, frame.shotTimeSeconds),
    b.alpha,
  );
  return true;
};

const drawFrame = (seconds: number): boolean => {
  const sample = resolveSequencePlayback(cut.sequence, shots, seconds);
  if (sample === null) return false;
  return drawSequenceFrame({
    shot: sample.shot,
    shotTimeSeconds: sample.time,
    blend:
      sample.blend === null
        ? null
        : {
            shot: sample.blend.shot,
            shotTimeSeconds: sample.blend.time,
            alpha: sample.blend.alpha,
          },
  });
};

const renderSequenceFrame = (frame: SequenceRenderFrameSample): void => {
  if (!drawSequenceFrame(frame)) renderer.render(scene, camera);
};

const renderShotOnly = (sample: SequenceRenderShotSample): void => {
  const shot = shotById.get(sample.shot);
  if (shot === undefined)
    throw new Error(`unknown film shot "${sample.shot}" for sequence probe`);
  poseShot(shot, sample.shotTimeSeconds);
  renderer.render(scene, camera);
};

// ── mount + deterministic seek contract (capture-shots.mjs) ──────────────────
const params = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const capMode = params.get("cap") === "1";
const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
const handle = mountViewer(
  canvas,
  scene,
  camera,
  (elapsed) => {
    // In capture/freeze mode the frame is driven by draw() below; returning
    // true keeps the mount loop from overwriting a composited dissolve with a
    // plain single-pass render.
    if (capMode || freezeAt !== null) return true;
    return drawFrame(elapsed % (FILM_DURATION + 0.8));
  },
  // Capture renders with AA off and a pinned pixel ratio (#1169) so structural
  // guide passes read back crisp and byte-stable across hosts.
  capMode ? { antialias: false, pixelRatio: 1 } : undefined,
);
const renderer = handle.renderer;
const draw = (t: number): void => {
  if (!drawFrame(t)) renderer.render(scene, camera);
};
if (freezeAt !== null && Number.isFinite(freezeAt)) draw(freezeAt);
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => draw(t);
// `__afPass` switches the guide pass a capturer screenshots (#1165): restore
// whatever pass was live, apply the requested one over the already-seeked
// scene, and re-render — so one seek yields every pass of that frame.
let passHandle: IAutoMovieRenderModeHandle | null = null;
(
  window as unknown as { __afPass: (pass: AutoMovieGuidePass) => void }
).__afPass = (pass: AutoMovieGuidePass): void => {
  passHandle?.restore();
  passHandle = applyRenderMode(scene, pass);
  renderer.render(scene, camera);
};
(
  window as unknown as {
    __afSeekSequenceFrame: (frame: SequenceRenderFrameSample) => void;
  }
).__afSeekSequenceFrame = renderSequenceFrame;
(
  window as unknown as {
    __afSeekSequenceShot: (sample: SequenceRenderShotSample) => void;
  }
).__afSeekSequenceShot = renderShotOnly;
(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  duration: FILM_DURATION,
  sequence: cut.sequence,
  shots,
  shotIds: shots.map((s) => s.id),
};
