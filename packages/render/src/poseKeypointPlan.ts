import {
  foldRoot,
  playbackCursor,
  projectToNdc,
  resolveCameraAt,
  resolvePoseKeypoints,
  sampleMotion,
  sceneFogTransmittance,
  sequenceTimeline,
} from "@automovie/engine";
import {
  IAutoMovieCamera,
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  IAutoMoviePoseKeypointActor,
  IAutoMoviePoseKeypointFrame,
  IAutoMoviePoseKeypointSidecar,
} from "./poseKeypointSidecar";

/**
 * Plan the per-frame pose-keypoint sidecar (#1168): lay the cut onto the output
 * clock ({@link sequenceTimeline}, the same frame-atomic arithmetic the render,
 * chunk, and caption plans use), resolve the live shot at every output frame
 * ({@link playbackCursor}), and for each performing actor project its named
 * joints to the frame through {@link resolvePoseKeypoints}. A frame whose shot,
 * scene, or camera cannot be resolved, and an actor whose motion, skeleton, or
 * node cannot, simply contribute no keypoints rather than throwing: the sidecar
 * still covers every output frame.
 *
 * When the scene declares an atmosphere, each actor also carries the fog
 * transmittance at its own depth
 * ({@link IAutoMoviePoseKeypointActor.atmosphere}), derived through the engine's
 * {@link sceneFogTransmittance}: the identical law the viewer hands the GPU, so
 * the sidecar and the captured frame state the same film. A scene without fog
 * omits the field and the sidecar is unchanged.
 *
 * Planning only: the host writes the file ({@link renderPoseKeypointSidecar}).
 *
 * @author Samchon
 */
export const planPoseKeypointSidecar = (props: {
  /** The cut being rendered. */
  sequence: IAutoMovieSequence;
  /** The shots the cut references. */
  shots: IAutoMovieShot[];
  /** The staged scenes the shots play over. */
  scenes: readonly IAutoMovieScene[];
  /** The motions the shots' performances reference. */
  motions: readonly IAutoMovieMotion[];
  /** The skeletons the motions target. */
  skeletons: readonly IAutoMovieSkeleton[];
  /** Output frames per second (the render clock, not necessarily sequence.fps). */
  fps: number;
  /** Render aspect (width/height); defaults inside resolvePoseKeypoints to 16/9. */
  aspect?: number;
}): IAutoMoviePoseKeypointSidecar => {
  const { sequence, shots, scenes, motions, skeletons, fps, aspect } = props;
  if (!Number.isFinite(fps) || fps <= 0)
    throw new Error(`fps must be a finite number > 0, but was ${fps}`);

  const timeline = sequenceTimeline(sequence, shots);
  const frameCount = Math.round(timeline.runtime * fps);
  if (frameCount === 0)
    throw new Error(
      `planPoseKeypointSidecar requires at least one frame; fps ${fps} and duration ${timeline.runtime} produced zero frames`,
    );

  const shotById = new Map(shots.map((s) => [s.id, s]));
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const motionById = new Map(motions.map((m) => [m.id, m]));
  const skeletonById = new Map(skeletons.map((s) => [s.id, s]));
  const cursor = playbackCursor(sequence, timeline);

  const frames = Array.from(
    { length: frameCount },
    (_, frame): IAutoMoviePoseKeypointFrame => {
      const sample = cursor(frame / fps);
      // sequenceTimeline already threw for any entry whose shot was not
      // provided, so every cursor sample resolves to a known shot.
      const shot = shotById.get(sample.shot)!;
      return {
        frame,
        beat: beatOf(sample.shot),
        actors: actorsAt(shot, sample.time, {
          sceneById,
          motionById,
          skeletonById,
          aspect,
        }),
      };
    },
  );

  return { target: sequence.id, fps, frameCount, frames };
};

/** Project every performing actor of one shot at a shot-local instant. */
const actorsAt = (
  shot: IAutoMovieShot,
  time: number,
  lookups: {
    sceneById: ReadonlyMap<string, IAutoMovieScene>;
    motionById: ReadonlyMap<string, IAutoMovieMotion>;
    skeletonById: ReadonlyMap<string, IAutoMovieSkeleton>;
    aspect: number | undefined;
  },
): IAutoMoviePoseKeypointActor[] => {
  const scene = lookups.sceneById.get(shot.scene);
  if (scene === undefined) return [];
  const camera = scene.cameras.find((c) => c.id === shot.camera);
  if (camera === undefined) return [];
  const nodeById = new Map(scene.nodes.map((n) => [n.id, n]));
  const fog = scene.fog ?? null;

  const actors: IAutoMoviePoseKeypointActor[] = [];
  for (const performance of shot.performances) {
    if (performance.motion === null) continue;
    const motion = lookups.motionById.get(performance.motion);
    const node = nodeById.get(performance.node);
    if (motion === undefined || node === undefined) continue;
    const skeleton = lookups.skeletonById.get(motion.skeleton);
    if (skeleton === undefined) continue;
    const pose = sampleMotion(
      motion,
      Math.max(0, time - performance.startOffset),
    ).pose;
    actors.push({
      node: performance.node,
      keypoints: resolvePoseKeypoints({
        pose,
        skeleton,
        node,
        camera,
        cameraMotion: shot.cameraMotion,
        time,
        aspect: lookups.aspect,
      }),
      // The atmosphere in front of this actor, from the SAME declaration and
      // the SAME law the viewer hands its shader. Spread conditionally rather
      // than written as `undefined`, so a scene declaring no fog produces a
      // sidecar without the key at all: byte-identical to one written before
      // the field existed, which is the whole promise of an absent default.
      //
      // The actor's world root is the depth sample: its staged placement with
      // the sampled pose root folded in ({@link foldRoot}), which is the same
      // one-point subject `reviewVisualRead` frames against. The staged
      // placement ALONE would be wrong wherever a clip carries the travel, the
      // ordinary case: an actor walking away from the lens would keep the
      // atmosphere it had at frame zero. A per-joint transmittance would
      // multiply the sidecar's size for a difference smaller than a body's own
      // depth.
      ...(fog === null
        ? {}
        : {
            atmosphere: sceneFogTransmittance(
              fog,
              cameraDepth(
                camera,
                shot.cameraMotion,
                time,
                foldRoot(node.transform, pose.root).translation,
              ),
            ),
          }),
    });
  }
  return actors;
};

/**
 * The camera-space depth of `point` at `time`: the distance along the camera's
 * forward axis, which is the length the atmosphere is integrated over (and what
 * the fog shader interpolates as `vFogDepth`).
 *
 * `projectToNdc` computes that depth as `-localZ` BEFORE its perspective
 * divide, so the frustum shape plays no part in it: `halfY` and `aspect` only
 * scale `ndcX`/`ndcY`, which this caller discards. Passing ones therefore says
 * "no frustum needed" instead of restating the projection's own aspect default,
 * which would be a second place for that default to drift from the first.
 */
const cameraDepth = (
  camera: IAutoMovieCamera,
  cameraMotion: IAutoMovieShot["cameraMotion"],
  time: number,
  point: IAutoMovieVector3,
): number =>
  projectToNdc(
    resolveCameraAt(camera.transform, cameraMotion, camera.id, time),
    point,
    1,
    1,
  ).depth;

/** `shot:duel` → `duel`; an unprefixed id is already the beat id. */
const beatOf = (shotId: string): string =>
  shotId.startsWith("shot:") ? shotId.slice("shot:".length) : shotId;
