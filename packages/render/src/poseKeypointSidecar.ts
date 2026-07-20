import { IAutoMoviePoseKeypoint } from "@automovie/interface";

/**
 * One actor's projected keypoints in a single output frame: the node id plus
 * its named-joint screen positions (see {@link IAutoMoviePoseKeypoint}).
 *
 * @author Samchon
 */
export interface IAutoMoviePoseKeypointActor {
  /** The scene-node id of the performing actor. */
  node: string;

  /** The actor's named joints, projected to the frame. */
  keypoints: IAutoMoviePoseKeypoint[];
}

/**
 * One output frame's pose keypoints: which beat is live and every performing
 * actor's projected joints. Unlike the caption sidecar (run-length spans, since
 * a caption is constant across a shot), the pose sidecar is genuinely
 * per-frame: poses change every frame.
 *
 * @author Samchon
 */
export interface IAutoMoviePoseKeypointFrame {
  /** Global output frame index. */
  frame: number;

  /** The beat whose shot is live on this frame. */
  beat: string;

  /** Every performing actor's keypoints on this frame. */
  actors: IAutoMoviePoseKeypointActor[];
}

/**
 * The per-frame pose-keypoint sidecar for a sequence render (#1168): the
 * machine-readable OpenPose-style companion to the rendered `pose` guide pass,
 * exactly as the caption sidecar companions the beauty frames. A diffusion host
 * reads it frame-for-frame to drive pose-conditioned (ControlNet) generation.
 *
 * @author Samchon
 */
export interface IAutoMoviePoseKeypointSidecar {
  /** The sequence this sidecar tracks. */
  target: string;

  /** Output frames per second the frames are addressed in. */
  fps: number;

  /** Total output frames (`round(runtime × fps)`, the frame-atomic clock). */
  frameCount: number;

  /** One entry per output frame, in play order. */
  frames: IAutoMoviePoseKeypointFrame[];
}

/** Serialize the sidecar for the host to write: pretty JSON, declared order. */
export const renderPoseKeypointSidecar = (
  sidecar: IAutoMoviePoseKeypointSidecar,
): string => `${JSON.stringify(sidecar, null, 2)}\n`;
