import {
  HUMANOID_JOINT_AXES,
  IAutoMovieBody,
  IAutoMovieImpact,
  impactRecoil,
  projectileAt,
  projectileSphereHit,
  resolveImpact,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMoviePose,
  IAutoMovieVector3,
} from "@automovie/interface";
import { applyPose, buildModel, mountViewer } from "@automovie/viewer";
import * as THREE from "three";

import { DEFAULT_STICKMAN, buildStickman } from "./stickman";

// ── collision-response demo: projectiles strike a braced stick figure; the
// engine's resolveImpact decides bounce / embed / knock-back (and the ball's
// rebound), and impactRecoil drives the figure's flinch — bounded by joint ROM,
// the overflow becoming a root stagger. The engine computes the reaction; the
// view just plays it. ─────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const v = (x: number, y: number, z: number): IAutoMovieVector3 => ({ x, y, z });
const j = (
  bone: AutoMovieHumanoidBone,
  a: { flexion?: number; abduction?: number; twist?: number },
): IAutoMovieJointPose => ({
  bone,
  flexion: a.flexion ?? 0,
  abduction: a.abduction ?? 0,
  twist: a.twist ?? 0,
});

const { skeleton, model } = buildStickman(DEFAULT_STICKMAN);
const object = buildModel(model);

// a braced stance — knees soft, hands up to take the hit
const BRACE: IAutoMovieJointPose[] = [
  j("leftUpperLeg", { flexion: -10, abduction: 10 }),
  j("rightUpperLeg", { flexion: -10, abduction: -10 }),
  j("leftLowerLeg", { flexion: 24 }),
  j("rightLowerLeg", { flexion: 24 }),
  j("leftUpperArm", { flexion: -40, abduction: -50 }),
  j("leftLowerArm", { flexion: -110 }),
  j("rightUpperArm", { flexion: 40, abduction: 50 }),
  j("rightLowerArm", { flexion: 110 }),
];

// torso target (world; the figure stands at the origin facing +Z, hits come
// from +Z flying −Z into the chest)
const torso = { center: v(0, 1.28, 0), radius: 0.34 };
const bodyMass = 72;
const recoilChain: AutoMovieHumanoidBone[] = ["spine", "chest", "neck", "head"];

interface Shot {
  t0: number;
  label: string;
  color: number;
  radius: number;
  origin: IAutoMovieVector3;
  velocity: IAutoMovieVector3;
  gravity: IAutoMovieVector3;
  ball: Omit<IAutoMovieBody, "velocity">;
  body: Omit<IAutoMovieBody, "velocity" | "mass">;
}

// three strikes that exercise the three response kinds
const SHOTS: Shot[] = [
  {
    t0: 0.6,
    label: "bounce",
    color: 0xe5a23b,
    radius: 0.13,
    origin: v(0, 1.28, 4.2),
    velocity: v(0, 0.2, -16),
    gravity: v(0, -2, 0),
    ball: { mass: 0.6, restitution: 0.88, hardness: 0.9, penetrability: 0.1 },
    body: { restitution: 0.85, hardness: 0.8, penetrability: 0.1 }, // braced shell → bounce
  },
  {
    t0: 3.4,
    label: "knock-back",
    color: 0x4a4f57,
    radius: 0.2,
    origin: v(0, 1.3, 4.6),
    velocity: v(0, 0.4, -14),
    gravity: v(0, -2, 0),
    ball: { mass: 9, restitution: 0.2, hardness: 0.9, penetrability: 0.1 },
    body: { restitution: 0.2, hardness: 0.4, penetrability: 0.2 }, // heavy → inelastic knock-back
  },
  {
    t0: 6.4,
    label: "embed",
    color: 0xcfd3da,
    radius: 0.07,
    origin: v(0, 1.32, 4.4),
    velocity: v(0, 0.5, -34),
    gravity: v(0, -3, 0),
    ball: { mass: 0.09, restitution: 0.1, hardness: 0.9, penetrability: 0.1 },
    body: { restitution: 0.1, hardness: 0.2, penetrability: 0.8 }, // soft flesh → arrow embeds
  },
];
const DUR = 9;

// resolve each strike once (deterministic): time of contact + the impact result
interface Resolved {
  shot: Shot;
  hitT: number; // absolute time of contact
  impact: IAutoMovieImpact;
  hitPoint: IAutoMovieVector3;
}
const resolved: Resolved[] = SHOTS.map((shot) => {
  const proj = {
    origin: shot.origin,
    velocity: shot.velocity,
    gravity: shot.gravity,
  };
  const hit = projectileSphereHit(proj, torso, 1.2);
  const flightT = hit ? hit.time : 0.3;
  const ballVel = projectileAt(proj, flightT).velocity;
  const normal = v(0, 0, -1); // ball (front) → body
  const impact = resolveImpact(
    { ...shot.ball, velocity: ballVel },
    { ...shot.body, mass: bodyMass, velocity: v(0, 0, 0) },
    normal,
  );
  return {
    shot,
    hitT: shot.t0 + flightT,
    impact,
    hitPoint: hit ? hit.point : torso.center,
  };
});
// eslint-disable-next-line no-console
console.log(
  "[impact]",
  resolved.map((r) => `${r.shot.label}:${r.impact.kind}`).join(" "),
);

// ball meshes
const balls = SHOTS.map((s) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(s.radius, 16, 12),
    new THREE.MeshStandardMaterial({ color: s.color, metalness: 0.2 }),
  );
  m.visible = false;
  return m;
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f4f8);
scene.add(object.object);
balls.forEach((b) => scene.add(b));
scene.add(new THREE.GridHelper(8, 16, 0xb8c0cc, 0xd5dbe4));
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b2, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 4, 3);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
const az = (Number(params.get("az") ?? 62) * Math.PI) / 180;
const dist = Number(params.get("dist") ?? 4.6);
camera.position.set(dist * Math.sin(az), 1.25, dist * Math.cos(az));
camera.lookAt(0, 0.95, 0);

// recoil envelope: 0 before the hit, snaps to 1, decays back over ~0.9s
const envelope = (t: number, hitT: number): number => {
  if (t < hitT) return 0;
  const dt = t - hitT;
  const rise = Math.min(dt / 0.1, 1);
  const fall = Math.max(0, 1 - (dt - 0.1) / 0.9);
  return rise * fall;
};

const step = (t: number): void => {
  // accumulate the recoil (flinch + stagger) from any strike currently landing
  let flinch: IAutoMovieJointPose[] = [];
  let staggerZ = 0;
  let staggerDip = 0;
  for (const r of resolved) {
    const env = envelope(t, r.hitT);
    if (env <= 0) continue;
    // reactive push from the impulse magnitude (lean away from the hit, −Z ⇒
    // spine extends back ⇒ negative flexion); impactRecoil clamps it to ROM
    const mag = Math.hypot(
      r.impact.impulse.x,
      r.impact.impulse.y,
      r.impact.impulse.z,
    );
    const pushDeg = -Math.min(mag * 1.6, 90) * env;
    const recoil = impactRecoil(
      { flexion: pushDeg },
      recoilChain,
      skeleton,
      0.7,
    );
    flinch = recoil.joints;
    // the momentum the joints can't absorb staggers the whole body back
    staggerZ -= Math.min(mag * 0.012, 0.5) * env;
    staggerDip -= Math.min(mag * 0.004, 0.12) * env;
  }

  const joints = new Map<AutoMovieHumanoidBone, IAutoMovieJointPose>();
  for (const b of BRACE) joints.set(b.bone, b);
  for (const f of flinch) joints.set(f.bone, f);
  const pose: IAutoMoviePose = {
    skeleton: skeleton.id,
    root: {
      translation: { x: 0, y: staggerDip, z: staggerZ },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    joints: [...joints.values()],
  };
  applyPose(object, pose, skeleton, HUMANOID_JOINT_AXES);

  // balls
  resolved.forEach((r, i) => {
    const mesh = balls[i]!;
    const s = r.shot;
    if (t < s.t0 || t > r.hitT + 1.4) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    if (t <= r.hitT) {
      const p = projectileAt(
        { origin: s.origin, velocity: s.velocity, gravity: s.gravity },
        t - s.t0,
      ).position;
      mesh.position.set(p.x, p.y, p.z);
    } else {
      // after contact: bounce flies back, embed sticks, others drop
      const dt = t - r.hitT;
      if (r.impact.kind === "bounce") {
        const p = projectileAt(
          {
            origin: r.hitPoint,
            velocity: r.impact.velocityA,
            gravity: v(0, -6, 0),
          },
          dt,
        ).position;
        mesh.position.set(p.x, p.y, p.z);
      } else if (r.impact.kind === "embed") {
        mesh.position.set(
          r.hitPoint.x,
          r.hitPoint.y + staggerDip,
          r.hitPoint.z + staggerZ,
        );
      } else {
        const p = projectileAt(
          {
            origin: r.hitPoint,
            velocity: r.impact.velocityA,
            gravity: v(0, -9, 0),
          },
          dt,
        ).position;
        mesh.position.set(p.x, p.y, p.z);
      }
    }
  });
};

const frozen = params.get("t");
const freezeAt = frozen !== null ? Number(frozen) : null;
if (freezeAt !== null && Number.isFinite(freezeAt)) step(freezeAt);

const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const capMode = params.get("cap") === "1";
const handle = mountViewer(canvas, scene, camera, (elapsed) => {
  if (!capMode && freezeAt === null) step(elapsed % DUR);
});
(window as unknown as { __afSeek: (t: number) => void }).__afSeek = (
  t: number,
): void => {
  step(t);
  handle.renderer.render(scene, camera);
};

(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  kinds: resolved.map((r) => r.impact.kind),
  duration: DUR,
};
