import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoMovieActorContext,
  cutSequence,
  makeActorSynthesizer,
  performShot,
  resolveSequencePlayback,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMoviePerformanceApplication,
  IAutoMovieScriptApplication,
  IAutoMovieShot,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";
import { AutoMoviePlayer, buildModel, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

// A showcase of the engine-authored **arm** gesture vocabulary, run back to
// back: a wave, a two-arm celebration, a bow draw, and an overhand throw. All
// are authored in clinical space (abduction 0 = down, 90 = horizontal, 180 =
// overhead, the same on either arm) and read up through HUMANOID_REST_FRAME at
// render, so a front-3/4 camera reads the arms cleanly. Deterministic via
// renderAt(t).

const script: IAutoMovieScriptApplication.IWrite = {
  type: "write",
  logline: "A figure runs through its arm gestures.",
  theme: "the gesture vocabulary on parade",
  cast: [{ node: "mime", character: "the mime", modelRef: "stickman" }],
  beats: [
    {
      id: "parade",
      name: "the parade",
      summary: "a wave, a cheer, a bow draw, an overhand throw",
      durationHint: 6,
    },
  ],
};

const staging: IAutoMovieStagingApplication.IWrite = {
  type: "write",
  scene: { id: "scene-showcase", name: "the parade" },
  plan: "the mime stands centre, facing +Z; a front-3/4 camera reads the arms.",
  actors: [{ node: "mime", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 }],
  cameras: [
    {
      node: "cam-main",
      position: { x: 2.2, y: 1.6, z: 3.0 },
      lookAt: { kind: "point", point: { x: 0, y: 1.1, z: 0 } },
      fovDeg: 42,
    },
  ],
  lights: [
    {
      node: "sun",
      role: "sun",
      direction: { x: -0.6, y: -1.2, z: -0.4 },
      intensity: 1.4,
    },
  ],
};

const arm = (
  start: number,
  duration: number,
  kind: "wave" | "celebrate" | "draw" | "throw",
): IAutoMoviePerformanceApplication.IWrite["draft"][number] => ({
  verb: "gesture",
  actor: "mime",
  start,
  duration,
  kind,
  region: "upperBody",
});

const performance: IAutoMoviePerformanceApplication.IWrite = {
  type: "write",
  beat: "parade",
  plan: "wave, celebrate, draw, throw — one after another.",
  draft: [
    arm(0, 1.3, "wave"),
    arm(1.5, 1.3, "celebrate"),
    arm(3.0, 1.4, "draw"),
    arm(4.6, 1.4, "throw"),
  ],
  revise: { review: "the four arm gestures, back to back.", final: null },
  duration: 6,
};

// ── rigs + the content seam ──────────────────────────────────────────────────
const mimeRig = buildStickman(DEFAULT_STICKMAN);
const rigOf = { mime: mimeRig } as const;
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
          rig: rig.skeleton,
          gaits: [],
          position: n.transform.translation,
          speed: 0.7,
          facingDeg: 0,
          eyeHeight: 1.45,
          restPose: { skeleton: rig.skeleton.id, root: null, joints: [] },
          restFrames: HUMANOID_REST_FRAME,
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
const shots: IAutoMovieShot[] = [performed.shot];
const motionsByShot = new Map<string, Record<string, IAutoMovieMotion>>([
  [performed.shot.id, performed.motions],
]);

const cut = cutSequence(
  {
    type: "write",
    sequence: { id: "seq-showcase", name: "the parade" },
    fps: 30,
    entries: shots.map((s) => ({ shot: s.id, trim: null, transition: null })),
    pacing: "each gesture plays whole.",
    continuity: "the mime returns to rest between gestures.",
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
sun.position.set(2.4, 4, 2.2);
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
      player: new AutoMoviePlayer(
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
