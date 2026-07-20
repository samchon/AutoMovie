import {
  HUMANOID_JOINT_AXES,
  IAutoMovieActorContext,
  cutSequence,
  makeActorSynthesizer,
  performShot,
  resolveSequencePlayback,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieModel,
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMoviePlayer,
  applyObjectMotion,
  buildModel,
  mountViewer,
} from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

// The `launch` verb on screen: the archer looses, the engine solves the aim and
// bakes the arrow's flight into the shot's `objectMotions` (a world-space node
// clip: a projectile has no rig, so it moves the way the camera does), and
// schedules the target's recoil at the *computed* contact. The viewer samples
// that clip onto the arrow's group each frame: the read side of the whole
// launch arc. Deterministic via renderAt(t) for capture.

// ── the arrow prop: a thin shaft, no rig (driven wholly by its objectMotion) ──
const arrowModel: IAutoMovieModel = {
  id: "arrow",
  name: "arrow",
  origin: "generated",
  skeleton: null,
  body: null,
  materials: [
    {
      id: "shaft-mat",
      name: "shaft",
      baseColor: { r: 0.14, g: 0.1, b: 0.08, a: 1, hex: null },
      metallic: 0.1,
      roughness: 0.7,
      emissive: null,
      opacity: 1,
      baseColorTexture: null,
    },
  ],
  parts: [
    {
      id: "shaft",
      name: "shaft",
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 0.035, height: 0.035, depth: 0.72 },
      },
      material: "shaft-mat",
      attachedBone: null,
      transform: null,
    },
  ],
  asset: null,
};

// ── the stage payloads (what the LLM will author; fixtures here) ─────────────
const script: IAutoMovieScriptApplication.IWrite = {
  type: "write",
  logline: "An archer looses; the shaft finds its mark across the field.",
  theme: "a computed arc",
  cast: [
    { node: "archer", character: "the archer", modelRef: "stickman" },
    { node: "target", character: "the mark", modelRef: "stickman" },
    { node: "arrow", character: "the arrow", modelRef: null },
  ],
  beats: [
    {
      id: "loose",
      name: "the loosing",
      summary:
        "the archer looses at the mark; the shaft arcs across and strikes",
      durationHint: 3,
    },
  ],
};

const staging: IAutoMovieStagingApplication.IWrite = {
  type: "write",
  scene: { id: "scene-range", name: "the range" },
  plan: "archer at the near mark facing downrange (+Z); the mark 6.5 m away; the arrow nocked at bow height; camera side-on to read the whole arc.",
  actors: [
    { node: "archer", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
    { node: "target", position: { x: 0, y: 0, z: 6.5 }, facingDeg: 180 },
    { node: "arrow", position: { x: 0, y: 1.35, z: 0.25 }, facingDeg: 0 },
  ],
  cameras: [
    {
      node: "cam-main",
      position: { x: 7.4, y: 2.2, z: 3.25 },
      lookAt: { kind: "point", point: { x: 0, y: 1.1, z: 3.25 } },
      fovDeg: 42,
    },
  ],
  lights: [
    {
      node: "sun",
      role: "sun",
      direction: { x: -0.8, y: -1.3, z: 0.3 },
      intensity: 1.4,
    },
  ],
};

const performance: IAutoMoviePerformanceApplication.IWrite = {
  type: "write",
  beat: "loose",
  plan: "the archer tracks the mark and looses; the engine flies the arrow and recoils the mark on the hit.",
  draft: [
    {
      verb: "lookAt",
      actor: "archer",
      start: 0,
      duration: 3,
      to: { kind: "node", node: "target" },
    },
    {
      verb: "launch",
      actor: "archer",
      start: 0.6,
      duration: "auto",
      region: "upperBody",
      projectile: "arrow",
      at: { kind: "node", node: "target" },
      speed: 9.2,
      onHit: { force: 0.9, unbalance: true },
    },
    {
      verb: "lookAt",
      actor: "target",
      start: 0,
      duration: 3,
      to: { kind: "node", node: "archer" },
    },
  ],
  revise: {
    review: "the loose lands; the mark reacts on the computed contact.",
    final: null,
  },
  duration: 3,
};

// ── rigs + the content seam ──────────────────────────────────────────────────
const archerRig = buildStickman(DEFAULT_STICKMAN);
const targetRig = buildStickman(DEFAULT_STICKMAN);
const rigOf = { archer: archerRig, target: targetRig } as const;
const isActor = (node: string): node is keyof typeof rigOf => node in rigOf;

const staged = stageScene(script, staging);
if (staged.success !== true)
  throw new Error(`staging failed: ${JSON.stringify(staged)}`);

const nodePositions = new Map<string, IAutoMovieVector3>(
  staged.scene.nodes.map((n) => [n.id, n.transform.translation]),
);
const contexts = new Map<string, IAutoMovieActorContext>(
  staged.scene.nodes
    .filter((n) => isActor(n.id))
    .map((n) => {
      const rig = rigOf[n.id as keyof typeof rigOf];
      return [
        n.id,
        {
          skeleton: rig.skeleton.id,
          rig: rig.skeleton, // physics/IK verbs (react) need the rig geometry
          gaits: [],
          position: n.transform.translation,
          speed: 0.75,
          facingDeg: n.id === "target" ? 180 : 0,
          eyeHeight: 1.45,
          restPose: { skeleton: rig.skeleton.id, root: null, joints: [] },
        },
      ];
    }),
);
const synthesize = makeActorSynthesizer(contexts, nodePositions);

// ── the ladder: perform → cut ────────────────────────────────────────────────
const performed = performShot({
  script,
  staged,
  performance,
  synthesize,
  skeleton: (node) => (isActor(node) ? rigOf[node].skeleton : null),
});
if (performed.success !== true)
  throw new Error(`perform failed: ${JSON.stringify(performed.violations)}`);
const shots: IAutoMovieShot[] = [performed.shot];
const motionsByShot = new Map<string, Record<string, IAutoMovieMotion>>([
  [performed.shot.id, performed.motions],
]);

const cut = cutSequence(
  {
    type: "write",
    sequence: { id: "seq-range", name: "the range" },
    fps: 30,
    entries: shots.map((s) => ({ shot: s.id, trim: null, transition: null })),
    pacing: "one continuous loose.",
    continuity: "the arrow leaves the bow and lands on the mark.",
  },
  shots,
);
if (cut.success !== true) throw new Error("cut failed");
export const FILM_DURATION = cut.runtime;

// ── the set: scene nodes → three.js (groups tracked by id) ───────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f6);
scene.add(new THREE.GridHelper(16, 32, 0xb8c0cc, 0xd5dbe4));
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 4, -1.4);
scene.add(sun);

const groupsById = new Map<string, THREE.Group>();
const built: Record<string, ReturnType<typeof buildModel>> = {};
for (const node of staged.scene.nodes) {
  const obj = buildModel(isActor(node.id) ? rigOf[node.id].model : arrowModel);
  const group = new THREE.Group();
  const t = node.transform.translation;
  group.position.set(t.x, t.y, t.z);
  const r = node.transform.rotation;
  group.quaternion.set(r.x, r.y, r.z, r.w);
  // the FULL staged base, scale included (#1087)
  const s = node.transform.scale;
  group.scale.set(s.x, s.y, s.z);
  group.add(obj.object);
  scene.add(group);
  built[node.id] = obj;
  groupsById.set(node.id, group);
}

// One player per performing actor (poses ride inside the staged-facing group);
// the arrow has no performance: its group is driven by the objectMotion.
const playersByShot = new Map(
  shots.map((shot) => [
    shot.id,
    shot.performances
      .filter((p) => isActor(p.node))
      .map((p) => ({
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

// ── the projector: global seconds → posed actors + flying arrow + camera ─────
const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 100);
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
const renderAt = (seconds: number): void => {
  const sample = resolveSequencePlayback(cut.sequence, shots, seconds);
  if (sample === null) return;
  for (const { player } of playersByShot.get(sample.shot)!)
    player.update(sample.time);
  const live = shotById.get(sample.shot)!;
  // objectMotions: world-space node clips (the arrow's flight). Drive the
  // object's group transform straight from the sampled clip: the read side of
  // compileLaunch/projectileTrajectory.
  for (const clip of live.objectMotions)
    applyObjectMotion(clip, sample.time, (node) => groupsById.get(node));
  if (live.cameraMotion === null) applyStagedCamera();
  else applyObjectMotion(live.cameraMotion, sample.time, () => camera);
};

// ── mount + deterministic seek contract (capture) ────────────────────────────
const params = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const capMode = params.get("cap") === "1";
const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (freezeAt !== null && Number.isFinite(freezeAt)) renderAt(freezeAt);

const handle = mountViewer(canvas, scene, camera, (elapsed) => {
  if (!capMode && freezeAt === null) renderAt(elapsed % (FILM_DURATION + 0.8));
});
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  renderAt(t);
  handle.renderer.render(scene, camera);
};
(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  duration: FILM_DURATION,
  shots: shots.map((s) => s.id),
};
