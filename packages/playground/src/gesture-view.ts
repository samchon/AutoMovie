import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoFilmActorContext,
  cutSequence,
  makeActorSynthesizer,
  performShot,
  resolveSequencePlayback,
  stageScene,
} from "@autofilm/engine";
import {
  IAutoFilmMotion,
  IAutoFilmPerformanceApplication,
  IAutoFilmScriptApplication,
  IAutoFilmShot,
  IAutoFilmStagingApplication,
  IAutoFilmVector3,
} from "@autofilm/interface";
import { AutoFilmPlayer, buildModel, mountViewer } from "@autofilm/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

// The whole-body `jump` gesture on screen: a figure coils, leaps (the pose
// root arcs up on Y), tucks its legs at the apex, and absorbs the landing —
// then throws both arms overhead in a celebration. The celebrate gesture is
// authored in clinical space (abduction 180 = straight up, no per-side mirror);
// the player is handed HUMANOID_REST_FRAME so it reads those angles up. Engine-
// authored, ROM-safe, deterministic via renderAt(t).

const script: IAutoFilmScriptApplication.IWrite = {
  type: "write",
  logline: "A figure jumps, then celebrates.",
  theme: "a coil, a leap, and a cheer",
  cast: [{ node: "jumper", character: "the jumper", modelRef: "stickman" }],
  beats: [
    {
      id: "leap",
      name: "the leap",
      summary: "the figure jumps twice, then throws its arms up",
      durationHint: 5,
    },
  ],
};

const staging: IAutoFilmStagingApplication.IWrite = {
  type: "write",
  scene: { id: "scene-leap", name: "the leap" },
  plan: "the jumper stands centre, facing +Z; a side-on camera reads the vertical arc.",
  actors: [{ node: "jumper", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 }],
  cameras: [
    {
      node: "cam-main",
      position: { x: 3.4, y: 1.5, z: 0.2 },
      lookAt: { kind: "point", point: { x: 0, y: 1, z: 0 } },
      fovDeg: 48,
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

const performance: IAutoFilmPerformanceApplication.IWrite = {
  type: "write",
  beat: "leap",
  plan: "two jumps back to back, then both arms thrown up in a cheer.",
  draft: [
    {
      verb: "gesture",
      actor: "jumper",
      start: 0,
      duration: 1.4,
      kind: "jump",
      region: "fullBody",
    },
    {
      verb: "gesture",
      actor: "jumper",
      start: 1.5,
      duration: 1.4,
      kind: "jump",
      region: "fullBody",
    },
    {
      verb: "gesture",
      actor: "jumper",
      start: 3.1,
      duration: 1.4,
      kind: "celebrate",
      region: "upperBody",
    },
  ],
  revise: { review: "two clean leaps into a cheer.", final: null },
  duration: 4.6,
};

// ── rigs + the content seam ──────────────────────────────────────────────────
const jumperRig = buildStickman(DEFAULT_STICKMAN);
const rigOf = { jumper: jumperRig } as const;
const isActor = (node: string): node is keyof typeof rigOf => node in rigOf;

const staged = stageScene(script, staging);
if (staged.success !== true)
  throw new Error(`staging failed: ${JSON.stringify(staged)}`);

const nodePositions = new Map<string, IAutoFilmVector3>(
  staged.scene.nodes.map((n) => [n.id, n.transform.translation]),
);
const contexts = new Map<string, IAutoFilmActorContext>(
  staged.scene.nodes
    .filter((n) => isActor(n.id))
    .map((n) => {
      const rig = rigOf[n.id as keyof typeof rigOf];
      return [
        n.id,
        {
          skeleton: rig.skeleton.id,
          rig: rig.skeleton,
          gaits: [],
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

const performed = performShot({
  script,
  staged,
  performance,
  synthesize,
  skeleton: (node) => (isActor(node) ? rigOf[node].skeleton : null),
});
if (performed.success !== true)
  throw new Error(`perform failed: ${JSON.stringify(performed.violations)}`);
const shots: IAutoFilmShot[] = [performed.shot];
const motionsByShot = new Map<string, Record<string, IAutoFilmMotion>>([
  [performed.shot.id, performed.motions],
]);

const cut = cutSequence(
  {
    type: "write",
    sequence: { id: "seq-leap", name: "the leap" },
    fps: 30,
    entries: shots.map((s) => ({ shot: s.id, trim: null, transition: null })),
    pacing: "two leaps.",
    continuity: "the figure lands where it took off.",
  },
  shots,
);
if (cut.success !== true) throw new Error("cut failed");
export const FILM_DURATION = cut.runtime;

// ── the set ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef1f6);
scene.add(new THREE.GridHelper(12, 24, 0xb8c0cc, 0xd5dbe4));
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 4, -1.4);
scene.add(sun);

const built = Object.fromEntries(
  staged.scene.nodes.map((node) => {
    const obj = buildModel(rigOf[node.id as keyof typeof rigOf].model);
    const group = new THREE.Group();
    const t = node.transform.translation;
    group.position.set(t.x, t.y, t.z);
    const r = node.transform.rotation;
    group.quaternion.set(r.x, r.y, r.z, r.w);
    group.add(obj.object);
    scene.add(group);
    return [node.id, obj] as const;
  }),
);

const playersByShot = new Map(
  shots.map((shot) => [
    shot.id,
    shot.performances.map((p) => ({
      node: p.node,
      player: new AutoFilmPlayer(
        built[p.node]!,
        rigOf[p.node as keyof typeof rigOf].skeleton,
        motionsByShot.get(shot.id)![p.node]!,
        HUMANOID_JOINT_AXES,
        false,
        undefined,
        HUMANOID_REST_FRAME,
      ),
    })),
  ]),
);

// ── the projector ────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.05, 100);
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
  if (live.cameraMotion === null) applyStagedCamera();
};

// ── mount + deterministic seek contract (capture) ────────────────────────────
const params = new URLSearchParams(location.search);
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const capMode = params.get("cap") === "1";
const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (freezeAt !== null && Number.isFinite(freezeAt)) renderAt(freezeAt);

const handle = mountViewer(canvas, scene, camera, (elapsed) => {
  if (!capMode && freezeAt === null) renderAt(elapsed % (FILM_DURATION + 0.6));
});
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  renderAt(t);
  handle.renderer.render(scene, camera);
};
(window as unknown as { __autofilm: unknown }).__autofilm = {
  ready: true,
  duration: FILM_DURATION,
  shots: shots.map((s) => s.id),
};
