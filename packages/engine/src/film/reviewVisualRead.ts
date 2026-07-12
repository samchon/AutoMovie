import {
  IAutoMovieMotion,
  IAutoMovieQuaternion,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieSceneNode,
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

/** Default body radius a contact point must land within to read as connected. */
const DEFAULT_CONTACT_RADIUS = 1.0;

/**
 * Engine-computed **visual-read** advisory metrics (#1177), surfaced as `tier:
 * "visual"` review notes — the deterministic complement to the subjective
 * review pass, so "does the action read" becomes measurable and the correction
 * loop scales. These are advisory (D015): they never fail a gate, they populate
 * the review backlog for the agent to weigh.
 *
 * Metrics:
 *
 * - **Subject in frame**: each performed actor's world root, sampled over the
 *   shot, must stay inside the live camera's view frustum (in front of the near
 *   plane, within the vertical FOV and an assumed-aspect horizontal FOV) — an
 *   actor drifting off-screen or behind the camera reads as a missing subject.
 * - **Contact connection**: each `hit`/`contact` event whose engine-computed
 *   world point lands farther than `contactRadius` from the target actor's body
 *   reads as a miss (the punch swings through empty air the target has left).
 *
 * The root-point subject (vs a head-to-foot bounding extent) is the v1
 * approximation; silhouette separation is the natural third metric.
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

  /** The compiled shot (camera, camera motion, performances, events, duration). */
  shot: IAutoMovieShot;

  /** Motions the shot's performances reference. */
  motions: readonly IAutoMovieMotion[];

  /** Samples per second. Defaults to 12. */
  sampleRate?: number;

  /** Render aspect (width/height). Defaults to 16/9. */
  aspect?: number;

  /** Body radius (m) a contact point must land within. Defaults to 1.0. */
  contactRadius?: number;
}): IAutoMovieReviewNote[] => {
  const motionById = new Map(props.motions.map((m) => [m.id, m]));
  const nodeById = new Map(props.scene.nodes.map((n) => [n.id, n]));
  const notes: IAutoMovieReviewNote[] = [];

  // A performed actor's world root at shot-time `t`, startOffset-aware: the clip
  // has advanced `max(0, t − startOffset)` at shot time t (the resolveBeatEnd
  // convention).
  const worldRootAt = (
    node: IAutoMovieSceneNode,
    motion: IAutoMovieMotion,
    startOffset: number,
    t: number,
  ): IAutoMovieVector3 =>
    foldRoot(
      node.transform,
      sampleMotion(motion, Math.max(0, t - startOffset)).pose.root,
    ).translation;

  // Metric 1 — subject in frame (needs a live, sane camera).
  const camera = props.scene.cameras.find((c) => c.id === props.shot.camera);
  if (
    camera !== undefined &&
    Number.isFinite(camera.fovY) &&
    camera.fovY > 0 &&
    camera.fovY < 180 &&
    camera.far > camera.near
  ) {
    const aspect = props.aspect ?? DEFAULT_ASPECT;
    const halfY = Math.tan((camera.fovY * Math.PI) / 360);
    const times = sampleTimes(
      props.shot.duration,
      props.sampleRate ?? DEFAULT_SAMPLE_RATE,
    );
    for (const performance of props.shot.performances) {
      const node = nodeById.get(performance.node);
      const motion =
        performance.motion === null
          ? undefined
          : motionById.get(performance.motion);
      if (node === undefined || motion === undefined) continue;
      const offAt = times.find((time) => {
        const world = worldRootAt(node, motion, performance.startOffset, time);
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
  }

  // Metric 2 — contact connection at hit events (camera-independent).
  const contactRadius = props.contactRadius ?? DEFAULT_CONTACT_RADIUS;
  const performanceByNode = new Map(
    props.shot.performances.map((p) => [p.node, p]),
  );
  for (const event of props.shot.events ?? []) {
    if (
      (event.kind !== "hit" && event.kind !== "contact") ||
      event.point === null ||
      event.target === null
    )
      continue;
    const performance = performanceByNode.get(event.target);
    if (performance === undefined) continue;
    const node = nodeById.get(performance.node);
    const motion =
      performance.motion === null
        ? undefined
        : motionById.get(performance.motion);
    if (node === undefined || motion === undefined) continue;
    const world = worldRootAt(
      node,
      motion,
      performance.startOffset,
      event.time,
    );
    const distance = Vector3.length(Vector3.subtract(world, event.point));
    if (distance > contactRadius)
      notes.push({
        beat: props.beat,
        tier: "visual",
        issue: `the ${event.kind} at t=${round(event.time)}s lands ${round(distance)}m from "${event.target}" — past the ${contactRadius}m body radius, it reads as a miss`,
        suggestion: `align the ${event.kind} with "${event.target}"'s body — retime the reaction or reposition the actor so the contact point meets it`,
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
