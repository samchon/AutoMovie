import {
  IAutoMovieMotion,
  IAutoMovieReviewNote,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { foldRoot } from "./beatEndSim";
import {
  IAutoMovieResolvedCamera,
  projectToNdc,
  resolveCameraAt,
} from "./cameraProjection";

/** Assumed render aspect (width/height), the scene camera carries no aspect. */
const DEFAULT_ASPECT = 16 / 9;

/** Default visual-read sampling rate (samples/second). */
const DEFAULT_SAMPLE_RATE = 12;

/** Default body radius a contact point must land within to read as connected. */
const DEFAULT_CONTACT_RADIUS = 1.0;

/** Default silhouette half-width (m), a torso-ish radius for the blob check. */
const DEFAULT_SILHOUETTE_RADIUS = 0.35;

/**
 * Engine-computed **visual-read** advisory metrics (#1177), surfaced as `tier:
 * "visual"` review notes, the deterministic complement to the subjective review
 * pass, so "does the action read" becomes measurable and the correction loop
 * scales. These are advisory: they never fail a gate, they populate the review
 * backlog for the agent to weigh.
 *
 * Metrics:
 *
 * - **Subject in frame**: each performed actor's world root, sampled over the
 *   shot, must stay inside the live camera's view frustum (in front of the near
 *   plane, within the vertical FOV and an assumed-aspect horizontal FOV), an
 *   actor drifting off-screen or behind the camera reads as a missing subject.
 * - **Contact connection**: each `hit`/`contact` event whose engine-computed
 *   world point lands farther than `contactRadius` from the target actor's body
 *   reads as a miss (the punch swings through empty air the target has left).
 * - **Silhouette separation**: two actors whose angular separation from the
 *   camera is smaller than their combined angular radii merge into one blob,
 *   reading as a single indistinguishable subject.
 *
 * The root-point subject (vs a head-to-foot bounding extent) is the v1
 * approximation across all three. Deterministic: pure FK (`foldRoot` +
 * `sampleMotion`), fixed-clock sampling, and stateless vector math.
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

  /** Silhouette half-width (m) for the merge check. Defaults to 0.35. */
  silhouetteRadius?: number;
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

  // Metrics 1 & 3, subject in frame + silhouette separation (need a live,
  // sane camera).
  const camera = props.scene.cameras.find((c) => c.id === props.shot.camera);
  if (
    camera !== undefined &&
    Number.isFinite(camera.fovY) &&
    camera.fovY > 0 &&
    camera.fovY < 180 &&
    camera.far > camera.near
  ) {
    const aspect = props.aspect ?? DEFAULT_ASPECT;
    const silhouetteRadius =
      props.silhouetteRadius ?? DEFAULT_SILHOUETTE_RADIUS;
    const halfY = Math.tan((camera.fovY * Math.PI) / 360);
    const times = sampleTimes(
      props.shot.duration,
      props.sampleRate ?? DEFAULT_SAMPLE_RATE,
    );
    const camAt = (time: number) =>
      resolveCameraAt(
        camera.transform,
        props.shot.cameraMotion,
        camera.id,
        time,
      );

    // Resolve the actually-performing actors once, for both metrics.
    const performers = props.shot.performances
      .map((performance) => {
        const node = nodeById.get(performance.node);
        const motion =
          performance.motion === null
            ? undefined
            : motionById.get(performance.motion);
        return node === undefined || motion === undefined
          ? null
          : {
              name: performance.node,
              node,
              motion,
              offset: performance.startOffset,
            };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Metric 1: subject in frame.
    for (const actor of performers) {
      const offAt = times.find(
        (time) =>
          !inFrame(
            camAt(time),
            worldRootAt(actor.node, actor.motion, actor.offset, time),
            camera.near,
            camera.far,
            halfY,
            aspect,
          ),
      );
      if (offAt !== undefined)
        notes.push({
          beat: props.beat,
          tier: "visual",
          issue: `subject "${actor.name}" leaves the camera frame at t=${round(offAt)}s (drifts off-screen or behind the camera)`,
          suggestion: `keep "${actor.name}" in shot, widen or re-aim camera "${camera.id}", or restage the action within the frame`,
        });
    }

    // Metric 3: silhouette separation, two actors whose angular separation from
    // the camera is smaller than their combined angular radii merge into one
    // unreadable blob.
    for (let i = 0; i < performers.length; ++i)
      for (let j = i + 1; j < performers.length; ++j) {
        const a = performers[i]!;
        const b = performers[j]!;
        const mergeAt = times.find((time) => {
          const camPos = camAt(time).position;
          const va = Vector3.subtract(
            worldRootAt(a.node, a.motion, a.offset, time),
            camPos,
          );
          const vb = Vector3.subtract(
            worldRootAt(b.node, b.motion, b.offset, time),
            camPos,
          );
          const da = Vector3.length(va);
          const db = Vector3.length(vb);
          // Too close to the camera is the framing metric's concern, and makes
          // the angular radius degenerate, do not double-report it here.
          if (Math.min(da, db) < camera.near) return false;
          const cos = Math.min(
            1,
            Math.max(-1, Vector3.dot(va, vb) / (da * db)),
          );
          const separation = Math.acos(cos);
          return (
            separation <
            Math.atan(silhouetteRadius / da) + Math.atan(silhouetteRadius / db)
          );
        });
        if (mergeAt !== undefined)
          notes.push({
            beat: props.beat,
            tier: "visual",
            issue: `subjects "${a.name}" and "${b.name}" merge in silhouette at t=${round(mergeAt)}s (they overlap into one blob from this camera)`,
            suggestion: `separate "${a.name}" and "${b.name}" on screen, stagger their depth, re-block, or move the camera off the line that stacks them`,
          });
      }
  }

  // Metric 2, contact connection at hit events (camera-independent).
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
        issue: `the ${event.kind} at t=${round(event.time)}s lands ${round(distance)}m from "${event.target}", past the ${contactRadius}m body radius, it reads as a miss`,
        suggestion: `align the ${event.kind} with "${event.target}"'s body, retime the reaction or reposition the actor so the contact point meets it`,
      });
  }

  return notes;
};

/**
 * Whether `point` sits inside the camera's frustum: in front within `[near,
 * far]` and inside the NDC rectangle. Shares the projection with the keypoint
 * sidecar via {@link projectToNdc}.
 */
const inFrame = (
  cam: IAutoMovieResolvedCamera,
  point: IAutoMovieVector3,
  near: number,
  far: number,
  halfY: number,
  aspect: number,
): boolean => {
  const { ndcX, ndcY, depth } = projectToNdc(cam, point, halfY, aspect);
  if (depth < near || depth > far) return false;
  return Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1;
};

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
