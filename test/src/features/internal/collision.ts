import { IAutoMovieCollisionActor } from "@automovie/engine";
import {
  IAutoMovieBody,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

const T = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * A collision actor whose single `hips→spine` capsule spans two bones placed at
 * exact world points (identity pose, one static keyframe), so a collision test
 * controls the geometry directly.
 */
export const staticActor = (props: {
  node: string;
  a: IAutoMovieVector3;
  b: IAutoMovieVector3;
  radius: number;
  body?: IAutoMovieBody | null;
}): IAutoMovieCollisionActor => {
  const { a, b } = props;
  const skeleton: IAutoMovieSkeleton = {
    id: `${props.node}-rig`,
    bones: [
      { bone: "hips", parent: null, rest: T(a.x, a.y, a.z), constraint: null },
      {
        bone: "spine",
        parent: "hips",
        rest: T(b.x - a.x, b.y - a.y, b.z - a.z),
        constraint: null,
      },
    ],
  };
  const motion: IAutoMovieMotion = {
    id: `${props.node}-motion`,
    skeleton: skeleton.id,
    duration: 1,
    loop: false,
    keyframes: [
      {
        time: 0,
        pose: { skeleton: skeleton.id, root: null, joints: [] },
        expression: null,
        easing: "linear",
        bezier: null,
      },
    ],
  };
  return {
    node: props.node,
    skeleton,
    motion,
    capsules: [{ from: "hips", to: "spine", radius: props.radius }],
    body: props.body ?? null,
  };
};
