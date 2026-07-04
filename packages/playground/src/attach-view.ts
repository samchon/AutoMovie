import {
  HUMANOID_GAITS,
  HUMANOID_JOINT_AXES,
  IautomovieActorContext,
  cutSequence,
  makeActorSynthesizer,
  performShot,
  resolveSequencePlayback,
  stageScene,
} from "@automovie/engine";
import {
  IautomovieModel,
  IautomovieMotion,
  IautomoviePerformanceApplication,
  IautomovieScriptApplication,
  IautomovieShot,
  IautomovieStagingApplication,
  IautomovieVector3,
} from "@automovie/interface";
import {
  automoviePlayer,
  applyObjectMotion,
  buildModel,
  mountViewer,
} from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./Stickman";

// The `attachTo` verb on screen: a figure walks the floor with a blade coupled
// to its left hand. The engine bakes the coupling into the shot's objectMotions
// ??a world-space node clip that, each frame, is the hand's frame (the walker's
// FK) composed onto the walker's placement ??so the blade rides the hand across
// the shot. The viewer drives the blade's group from that clip: the read side
// of compileAttach. Deterministic via renderAt(t) for capture.

// ?? the blade prop: grip at origin, blade rising +Y; no rig ??????????????????
const bladeModel: IautomovieModel = {
  id: "blade",
  name: "blade",
  origin: "generated",
  skeleton: null,
  materials: [
    {
      id: "steel",
      name: "steel",
      baseColor: { r: 0.62, g: 0.66, b: 0.72, a: 1, hex: null },
      metallic: 0.8,
      roughness: 0.3,
      emissive: null,
      opacity: 1,
      baseColorTexture: null,
    },
  ],
  parts: [
    {
      id: "blade",
      name: "blade",
      geometry: {
        type: "primitive",
        shape: { type: "box", width: 0.05, height: 0.66, depth: 0.05 },
      },
      material: "steel",
      attachedBone: null,
      // rise from the grip (the hand) rather than centring through it
      transform: {
        translation: { x: 0, y: 0.36, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
  asset: null,
};

// ?? the stage payloads ???????????????????????????????????????????????????????
const script: IautomovieScriptApplication.IWrite = {
  type: "write",
  logline: "A figure walks the floor, blade in hand.",
  theme: "a prop rides the hand",
  cast: [
    { node: "walker", character: "the walker", modelRef: "stickman" },
    { node: "blade", character: "the blade", modelRef: null },
  ],
  beats: [
    {
      id: "carry",
      name: "the carry",
      summary: "the walker crosses the floor and the blade rides the left hand",
      durationHint: 4,
    },
  ],
};

const staging: IautomovieStagingApplication.IWrite = {
  type: "write",
  scene: { id: "scene-carry", name: "the carry" },
  plan: "the walker starts near and crosses to far along +Z, facing +Z; the blade is nocked in the left hand; a side-on camera reads the crossing.",
  actors: [
    { node: "walker", position: { x: 0, y: 0, z: -1.8 }, facingDeg: 0 },
    { node: "blade", position: { x: 0.25, y: 1.05, z: -1.8 }, facingDeg: 0 },
  ],
  cameras: [
    {
      node: "cam-main",
      position: { x: 4.2, y: 1.6, z: 0.1 },
      lookAt: { kind: "point", point: { x: 0, y: 1, z: 0.1 } },
      fovDeg: 46,
    },
  ],
  lights: [
    {
      node: "sun",
      role: "sun",
      direction: { x: -0.7, y: -1.3, z: 0.35 },
      intensity: 1.4,
    },
  ],
};

const performance: IautomoviePerformanceApplication.IWrite = {
  type: "write",
  beat: "carry",
  plan: "the walker crosses the floor; the blade is attached to its left hand for the whole shot.",
  draft: [
    {
      verb: "locomote",
      actor: "walker",
      start: 0,
      duration: 4,
      gait: "walk",
      to: { kind: "point", point: { x: 0, y: 0, z: 1.8 } },
    },
    {
      verb: "attachTo",
      actor: "blade",
      parent: "walker",
      bone: "leftHand",
      start: 0,
      duration: "auto",
    },
  ],
  revise: {
    review: "the walker covers the floor; the blade tracks the left hand.",
    final: null,
  },
  duration: 4,
};

// ?? rigs + the content seam ??????????????????????????????????????????????????
const walkerRig = buildStickman(DEFAULT_STICKMAN);
const rigOf = { walker: walkerRig } as const;
const isActor = (node: string): node is keyof typeof rigOf => node in rigOf;

const staged = stageScene(script, staging);
if (staged.success !== true)
  throw new Error(`staging failed: ${JSON.stringify(staged)}`);

const nodePositions = new Map<string, IautomovieVector3>(
  staged.scene.nodes.map((n) => [n.id, n.transform.translation]),
);
const contexts = new Map<string, IautomovieActorContext>(
  staged.scene.nodes
    .filter((n) => isActor(n.id))
    .map((n) => {
      const rig = rigOf[n.id as keyof typeof rigOf];
      return [
        n.id,
        {
          skeleton: rig.skeleton.id,
          rig: rig.skeleton,
          gaits: [HUMANOID_GAITS.walk],
          position: n.transform.translation,
          speed: 0.7,
          facingDeg: 0,
          eyeHeight: 1.45,
          restPose: { skeleton: rig.skeleton.id, root: null, joints: [] },
        },
      ];
    }),
);
const synthesize = makeActorSynthesizer(contexts, nodePositions);

// ?? the ladder: perform ??cut ????????????????????????????????????????????????
const performed = performShot({
  script,
  staged,
  performance,
  synthesize,
  skeleton: (node) => (isActor(node) ? rigOf[node].skeleton : null),
});
if (performed.success !== true)
  throw new Error(`perform failed: ${JSON.stringify(performed.violations)}`);
const shots: IautomovieShot[] = [performed.shot];
const motionsByShot = new Map<string, Record<string, IautomovieMotion>>([
  [performed.shot.id, performed.motions],
]);

const cut = cutSequence(
  {
    type: "write",
    sequence: { id: "seq-carry", name: "the carry" },
    fps: 30,
    entries: shots.map((s) => ({ shot: s.id, trim: null, transition: null })),
    pacing: "one continuous carry.",
    continuity: "the blade never leaves the hand.",
  },
  shots,
);
if (cut.success !== true) throw new Error("cut failed");
export const FILM_DURATION = cut.runtime;

// ?? the set: scene nodes ??three.js (groups tracked by id) ???????????????????
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
  const obj = buildModel(isActor(node.id) ? rigOf[node.id].model : bladeModel);
  const group = new THREE.Group();
  const t = node.transform.translation;
  group.position.set(t.x, t.y, t.z);
  const r = node.transform.rotation;
  group.quaternion.set(r.x, r.y, r.z, r.w);
  group.add(obj.object);
  scene.add(group);
  built[node.id] = obj;
  groupsById.set(node.id, group);
}

const playersByShot = new Map(
  shots.map((shot) => [
    shot.id,
    shot.performances
      .filter((p) => isActor(p.node))
      .map((p) => ({
        node: p.node,
        player: new automoviePlayer(
          built[p.node]!,
          rigOf[p.node as keyof typeof rigOf].skeleton,
          motionsByShot.get(shot.id)![p.node]!,
          HUMANOID_JOINT_AXES,
        ),
      })),
  ]),
);

// ?? the projector: global seconds ??posed walker + carried blade + camera ????
const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 100);
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
  // objectMotions: the blade's world-space follow clip (compileAttach).
  for (const clip of live.objectMotions)
    applyObjectMotion(clip, sample.time, (node) => groupsById.get(node));
  if (live.cameraMotion === null) applyStagedCamera();
  else applyObjectMotion(live.cameraMotion, sample.time, () => camera);
};

// ?? mount + deterministic seek contract (capture) ????????????????????????????
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
