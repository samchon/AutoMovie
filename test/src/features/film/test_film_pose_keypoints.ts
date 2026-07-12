import { resolvePoseKeypoints } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieCamera,
  IAutoMovieClip,
  IAutoMoviePose,
  IAutoMoviePoseKeypoint,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const IDENTITY_Q = { x: 0, y: 0, z: 0, w: 1 };
const t3 = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: IDENTITY_Q,
  scale: { x: 1, y: 1, z: 1 },
});

/** Hips at the rig origin, head at `headRest` above it. */
const skeleton = (headRest: IAutoMovieTransform): IAutoMovieSkeleton => ({
  id: "sk",
  bones: [
    { bone: "hips", parent: null, rest: t3(0, 0, 0), constraint: null },
    { bone: "head", parent: "hips", rest: headRest, constraint: null },
  ],
});

/** An articulation-free pose whose rig root sits at (x, y, z). */
const poseAt = (x: number, y: number, z: number): IAutoMoviePose => ({
  skeleton: "sk",
  root: t3(x, y, z),
  joints: [],
});

const camera = (over: Partial<IAutoMovieCamera> = {}): IAutoMovieCamera => ({
  id: "cam",
  transform: t3(0, 0, 0),
  fovY: 60,
  near: 0.1,
  far: 100,
  ...over,
});

const keypoints = (props: {
  pose: IAutoMoviePose;
  headRest?: IAutoMovieTransform;
  node?: IAutoMovieTransform;
  camera?: IAutoMovieCamera;
  joints?: readonly AutoMovieHumanoidBone[];
  aspect?: number;
  cameraMotion?: IAutoMovieClip | null;
  time?: number;
}): IAutoMoviePoseKeypoint[] =>
  resolvePoseKeypoints({
    pose: props.pose,
    skeleton: skeleton(props.headRest ?? t3(0, 1, 0)),
    node: { transform: props.node ?? t3(0, 0, 0) },
    camera: props.camera ?? camera(),
    joints: props.joints ?? ["hips", "head"],
    aspect: props.aspect,
    cameraMotion: props.cameraMotion,
    time: props.time,
  });

const of = (ks: IAutoMoviePoseKeypoint[], bone: string) =>
  ks.find((k) => k.bone === bone)!;

/**
 * `resolvePoseKeypoints` (#1168) projects a posed actor's named joints to 2D
 * screen keypoints — the exact OpenPose-style ControlNet conditioning automovie
 * can emit from its known 3D joint positions. Coordinates are normalized to the
 * frame ([0,1], top-left origin); out-of-frame joints project honestly (never
 * clamped) with `inFrame: false`.
 *
 * Scenarios (camera at origin looking down −Z, fovY 60):
 *
 * 1. A rig 5 m down −Z projects hips to frame center (0.5, 0.5) and the head 1 m
 *    above it to y ≈ 0.327 — both in frame.
 * 2. A joint high above, behind the camera, past the far plane, or beside the
 *    frame each projects out of [0,1] with inFrame false and is NOT clamped.
 * 3. A bone the rig lacks yields no keypoint; the default joint set emits only the
 *    bones the rig has.
 * 4. The staged node transform and an explicit aspect change the projection; the
 *    camera can be sampled from a move at a given time.
 */
export const test_film_pose_keypoints = (): void => {
  // 1. basic projection.
  const centered = keypoints({ pose: poseAt(0, 0, -5) });
  TestValidator.equals("hips + head keypoints", centered.length, 2);
  const hips = of(centered, "hips");
  const head = of(centered, "head");
  TestValidator.predicate(
    "hips project to frame center, in frame",
    nclose(hips.x, 0.5) && nclose(hips.y, 0.5) && hips.inFrame,
  );
  TestValidator.predicate(
    "the head 1 m up projects above center, in frame",
    nclose(head.x, 0.5) && nclose(head.y, 0.3267949, 1e-6) && head.inFrame,
  );

  // 2. out-of-frame joints project honestly (unclamped) with inFrame false.
  const high = of(
    keypoints({ pose: poseAt(0, 0, -5), headRest: t3(0, 20, 0) }),
    "head",
  );
  TestValidator.predicate(
    "a joint high above the frame is out, not clamped",
    high.inFrame === false && high.y < 0,
  );
  TestValidator.equals(
    "a joint behind the camera is out",
    of(keypoints({ pose: poseAt(0, 0, 5) }), "hips").inFrame,
    false,
  );
  TestValidator.equals(
    "a joint past the far plane is out",
    of(keypoints({ pose: poseAt(0, 0, -200) }), "hips").inFrame,
    false,
  );
  const beside = of(keypoints({ pose: poseAt(20, 0, -5) }), "hips");
  TestValidator.predicate(
    "a joint beside the frame is out, not clamped",
    beside.inFrame === false && beside.x > 1,
  );

  // 3. missing bone + default joint set.
  TestValidator.equals(
    "a bone the rig lacks yields no keypoint",
    keypoints({ pose: poseAt(0, 0, -5), joints: ["hips", "leftHand"] }).length,
    1,
  );
  TestValidator.equals(
    "the default joint set emits only the rig's bones",
    resolvePoseKeypoints({
      pose: poseAt(0, 0, -5),
      skeleton: skeleton(t3(0, 1, 0)),
      node: { transform: t3(0, 0, 0) },
      camera: camera(),
    }).length,
    2,
  );

  // 4. node placement, aspect, and a sampled camera move.
  const raised = of(
    keypoints({ pose: poseAt(0, 0, -5), node: t3(0, 3, 0) }),
    "hips",
  );
  TestValidator.equals(
    "the staged node lifts the actor out of frame",
    raised.inFrame,
    false,
  );
  TestValidator.equals(
    "a square aspect narrows the horizontal frame",
    of(keypoints({ pose: poseAt(4, 0, -5), aspect: 1 }), "hips").inFrame,
    false,
  );
  const still = of(
    keypoints({
      pose: poseAt(0, 0, -5),
      cameraMotion: {
        id: "m",
        name: null,
        duration: 1,
        loop: false,
        tracks: [
          {
            channel: { kind: "node", node: "cam", path: "translation" },
            times: [0, 1],
            values: [0, 0, 0, 0, 0, 0],
            interpolation: "linear",
          },
        ],
      },
      time: 0.5,
    }),
    "hips",
  );
  TestValidator.predicate(
    "a sampled static camera move keeps the subject centered",
    nclose(still.x, 0.5) && still.inFrame,
  );
};
