import {
  IAutoMovieMotion,
  IAutoMovieQuaternion,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { channelKey } from "../resolve/channel";
import { sampleClip } from "../resolve/sampleClip";
import { foldRoot } from "./beatEndSim";

/** Assumed render aspect (width/height) — the scene camera carries no aspect. */
const DEFAULT_ASPECT = 16 / 9;

/** Default visual-read sampling rate (samples/second). */
const DEFAULT_SAMPLE_RATE = 12;

/**
 * Engine-computed **visual-read** advisory metrics (#1177), surfaced as `tier:
 * "visual"` review notes — the deterministic complement to the subjective
 * review pass, so "does the action read" becomes measurable and the correction
 * loop scales. These are advisory (D015): they never fail a gate, they populate
 * the review backlog for the agent to weigh.
 *
 * V1 metric — **subject in frame**: for each performed actor, sample its world
 * root over the shot and check it stays inside the live camera's view frustum
 * (in front of the near plane, within the vertical FOV and an assumed-aspect
 * horizontal FOV). An actor drifting off-screen or behind the camera reads as a
 * missing subject, so a note names the beat, the actor, and when it first
 * leaves frame. Silhouette separation and contact-connection at hit events are
 * the natural follow-up metrics; the root-point subject (vs a head-to-foot
 * bounding extent) and a heightfield-free frustum are the v1 approximations.
 *
 * Deterministic: pure FK (`foldRoot` + `sampleMotion`), fixed-clock sampling,
 * and stateless vector math.
 *
 * @author Samchon
 */
export const reviewVisualRead = (props: {
  /** Beat id the notes are filed against. */
  beat: string;

  /** Staged scene (nodes + cameras) the shot plays over. */
  scene: IAutoMovieScene;

  /** The compiled shot (camera, camera motion, performances, duration). */
  shot: IAutoMovieShot;

  /** Motions the shot's performances reference. */
  motions: readonly IAutoMovieMotion[];

  /** Samples per second. Defaults to 12. */
  sampleRate?: number;

  /** Render aspect (width/height). Defaults to 16/9. */
  aspect?: number;
}): IAutoMovieReviewNote[] => {
  const camera = props.scene.cameras.find((c) => c.id === props.shot.camera);
  // No live camera, or a nonsensical FOV, leaves nothing to read visually.
  if (
    camera === undefined ||
    !Number.isFinite(camera.fovY) ||
    camera.fovY <= 0 ||
    camera.fovY >= 180 ||
    !(camera.far > camera.near)
  )
    return [];

  const aspect = props.aspect ?? DEFAULT_ASPECT;
  const sampleRate = props.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const halfY = Math.tan((camera.fovY * Math.PI) / 360);
  const motionById = new Map(props.motions.map((m) => [m.id, m]));
  const nodeById = new Map(props.scene.nodes.map((n) => [n.id, n]));
  const times = sampleTimes(props.shot.duration, sampleRate);

  const notes: IAutoMovieReviewNote[] = [];
  for (const performance of props.shot.performances) {
    const node = nodeById.get(performance.node);
    const motion =
      performance.motion === null
        ? undefined
        : motionById.get(performance.motion);
    if (node === undefined || motion === undefined) continue;

    const offAt = times.find((time) => {
      const world = foldRoot(
        node.transform,
        sampleMotion(motion, time).pose.root,
      ).translation;
      const cam = cameraAt(
        camera.transform,
        props.shot.cameraMotion,
        camera.id,
        time,
      );
      return !inFrame(cam, world, camera.near, camera.far, halfY, aspect);
    });
    if (offAt !== undefined)
      notes.push({
        beat: props.beat,
        tier: "visual",
        issue: `subject "${performance.node}" leaves the camera frame at t=${round(offAt)}s (drifts off-screen or behind the camera)`,
        suggestion: `keep "${performance.node}" in shot — widen or re-aim camera "${camera.id}", or restage the action within the frame`,
      });
  }
  return notes;
};

/** The camera's world placement at `time`: static, or sampled from its move. */
const cameraAt = (
  base: { translation: IAutoMovieVector3; rotation: IAutoMovieQuaternion },
  cameraMotion: IAutoMovieShot["cameraMotion"],
  cameraId: string,
  time: number,
): { position: IAutoMovieVector3; rotation: IAutoMovieQuaternion } => {
  if (cameraMotion === null)
    return { position: base.translation, rotation: base.rotation };
  const sampled = sampleClip(cameraMotion, time);
  const position = sampled.get(
    channelKey({ kind: "node", node: cameraId, path: "translation" }),
  )?.value;
  const rotation = sampled.get(
    channelKey({ kind: "node", node: cameraId, path: "rotation" }),
  )?.value;
  return {
    position:
      position === undefined
        ? base.translation
        : { x: position[0]!, y: position[1]!, z: position[2]! },
    rotation:
      rotation === undefined
        ? base.rotation
        : {
            x: rotation[0]!,
            y: rotation[1]!,
            z: rotation[2]!,
            w: rotation[3]!,
          },
  };
};

/**
 * Whether `point` sits inside the camera's frustum. The camera looks down its
 * local −Z (glTF), so a point in front has `depth = −localZ > 0`; NDC is `local
 * / (depth · tan(fovY/2))`, horizontally widened by `aspect`.
 */
const inFrame = (
  cam: { position: IAutoMovieVector3; rotation: IAutoMovieQuaternion },
  point: IAutoMovieVector3,
  near: number,
  far: number,
  halfY: number,
  aspect: number,
): boolean => {
  const local = Quaternion.rotateVector(
    Quaternion.inverse(cam.rotation),
    Vector3.subtract(point, cam.position),
  );
  const depth = -local.z;
  if (depth < near || depth > far) return false;
  const ndcY = local.y / (depth * halfY);
  const ndcX = local.x / (depth * halfY * aspect);
  return Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1;
};

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
