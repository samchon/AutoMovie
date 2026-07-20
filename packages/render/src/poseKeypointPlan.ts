import {
  playbackCursor,
  resolvePoseKeypoints,
  sampleMotion,
  sequenceTimeline,
} from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieScene,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieSkeleton,
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
 * node cannot, simply contribute no keypoints rather than throwing: the
 * sidecar still covers every output frame.
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
    });
  }
  return actors;
};

/** `shot:duel` → `duel`; an unprefixed id is already the beat id. */
const beatOf = (shotId: string): string =>
  shotId.startsWith("shot:") ? shotId.slice("shot:".length) : shotId;
