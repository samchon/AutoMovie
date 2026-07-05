import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { sampleMotion } from "../motion/sampleMotion";

const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: 1 };

/**
 * Derive the forward-state a later beat should block against from a compiled
 * shot. Every scene actor gets an end snapshot: held actors keep their staged
 * placement, performed actors sample their motion at the shot end, and pose
 * root motion is folded into the returned world transform.
 */
export const resolveBeatEnd = (props: {
  /** Beat id the shot realizes. */
  beat: string;

  /** Staged scene the shot played over. */
  scene: IAutoMovieScene;

  /** Compiled shot for the beat. */
  shot: IAutoMovieShot;

  /** Motion clips referenced by scene nodes and shot performances. */
  motions: IAutoMovieMotion[];
}): IAutoMovieBeatEndState => {
  const motionById = new Map<
    string,
    { motion: IAutoMovieMotion; index: number }
  >();
  props.motions.forEach((motion, index) => {
    const existing = motionById.get(motion.id);
    if (existing !== undefined)
      throw new Error(
        `motion "${motion.id}" is duplicated at props.motions[${index}].id; first declared at props.motions[${existing.index}].id`,
      );
    motionById.set(motion.id, { motion, index });
  });
  const performanceByNode = new Map<
    string,
    { performance: IAutoMovieShot["performances"][number]; index: number }
  >();
  props.shot.performances.forEach((performance, index) => {
    const existing = performanceByNode.get(performance.node);
    if (existing !== undefined)
      throw new Error(
        `performance for node "${performance.node}" is duplicated at props.shot.performances[${index}].node; first declared at props.shot.performances[${existing.index}].node`,
      );
    performanceByNode.set(performance.node, { performance, index });
  });

  return {
    beat: props.beat,
    shot: props.shot.id,
    actors: props.scene.nodes.map((node) => {
      const performance = performanceByNode.get(node.id)?.performance;
      const motionId =
        performance === undefined ? node.motion : performance.motion;
      const localTime =
        performance === undefined
          ? props.shot.duration
          : Math.max(0, props.shot.duration - performance.startOffset);

      if (motionId === null)
        return actorState(node, null, localTime, node.pose);

      const motion = motionById.get(motionId);
      if (motion === undefined)
        throw new Error(`motion "${motionId}" was not provided`);

      return actorState(
        node,
        motionId,
        localTime,
        sampleMotion(motion.motion, localTime).pose,
      );
    }),
  };
};

const actorState = (
  node: IAutoMovieSceneNode,
  motion: string | null,
  localTime: number,
  pose: IAutoMoviePose | null,
): IAutoMovieBeatEndActorState => {
  const root = pose === null ? null : pose.root;
  const transform = foldRoot(node.transform, root);
  return {
    node: node.id,
    transform,
    facing: Quaternion.rotateVector(transform.rotation, FORWARD),
    pose: pose === null ? null : { ...pose, root: null },
    motion,
    localTime,
  };
};

const foldRoot = (
  base: IAutoMovieTransform,
  root: IAutoMovieTransform | null,
): IAutoMovieTransform => {
  if (root === null) return base;
  const world = Matrix4.multiply(toMatrix(base), toMatrix(root));
  const decomposed = Matrix4.decompose(world);
  return {
    translation: decomposed.position,
    rotation: decomposed.rotation,
    scale: decomposed.scale,
  };
};

const toMatrix = (transform: IAutoMovieTransform): number[] =>
  Matrix4.compose(transform.translation, transform.rotation, transform.scale);
