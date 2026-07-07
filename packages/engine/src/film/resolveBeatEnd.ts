import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndFootPlant,
  IAutoMovieBeatEndState,
  IAutoMovieMotion,
  IAutoMovieMountBinding,
  IAutoMoviePose,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { sampleMotion } from "../motion/sampleMotion";
import {
  foldRoot,
  gaitPhaseOf,
  plantsAtEnd,
  rootVelocityOf,
} from "./beatEndSim";
import { IAutoMovieStagedSet } from "./stageScene";

const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: 1 };

/**
 * Derive the forward-state a later beat should block against from a compiled
 * shot. Every scene actor gets an end snapshot: held actors keep their staged
 * placement, performed actors sample their motion at the shot end, and pose
 * root motion is folded into the returned world transform.
 *
 * Beyond the end pose, the state is a _resumable_ simulation snapshot: the gait
 * cycle phase (so the next beat continues mid-stride instead of resetting), the
 * world root velocity (finite-differenced over the clip's last instants), the
 * planted feet (when the caller passes the ground-IK pass output), and the
 * persistent mount coupling (absorbing the staged `mounts` the film pipeline
 * previously never consumed). This is the seam that keeps an hours-long
 * timeline continuous across beat boundaries.
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

  /**
   * Persistent mount couplings from staging (`IAutoMovieStagedSet.mounts`),
   * carried to each rider's end state so the next beat re-couples without
   * re-declaring. Omit when nothing is mounted.
   */
  mounts?: readonly IAutoMovieStagedSet.IMount[];

  /**
   * Ground-IK plant data per performed node (the `plants` of the engine's
   * plant-stance-feet pass), carried so the next beat keeps planted feet where
   * this beat left them. Omit when no pass ran.
   */
  plants?: ReadonlyArray<{
    /** Scene node the plants belong to. */
    node: string;
    /** The pass's pinned stance runs for that node. */
    plants: readonly IAutoMovieBeatEndFootPlant[];
  }>;
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
  const mountByNode = new Map<string, { binding: IAutoMovieMountBinding }>();
  (props.mounts ?? []).forEach((mount, index) => {
    if (mountByNode.has(mount.node))
      throw new Error(
        `mount for node "${mount.node}" is duplicated at props.mounts[${index}].node`,
      );
    mountByNode.set(mount.node, { binding: mount.binding });
  });
  const plantsByNode = new Map<string, readonly IAutoMovieBeatEndFootPlant[]>();
  (props.plants ?? []).forEach((entry, index) => {
    if (plantsByNode.has(entry.node))
      throw new Error(
        `plants for node "${entry.node}" are duplicated at props.plants[${index}].node`,
      );
    plantsByNode.set(entry.node, entry.plants);
  });

  const context: IResolveContext = {
    duration: props.shot.duration,
    motionById,
    performanceByNode,
    mountByNode,
    plantsByNode,
  };
  return {
    beat: props.beat,
    shot: props.shot.id,
    actors: props.scene.nodes.map((node) => endActorOf(context, node)),
  };
};

/** The per-beat lookups one actor's end snapshot derives from. */
interface IResolveContext {
  duration: number;
  motionById: ReadonlyMap<string, { motion: IAutoMovieMotion; index: number }>;
  performanceByNode: ReadonlyMap<
    string,
    { performance: IAutoMovieShot["performances"][number]; index: number }
  >;
  mountByNode: ReadonlyMap<string, { binding: IAutoMovieMountBinding }>;
  plantsByNode: ReadonlyMap<string, readonly IAutoMovieBeatEndFootPlant[]>;
}

/** One scene actor's end snapshot: sampled if performed, held otherwise. */
const endActorOf = (
  context: IResolveContext,
  node: IAutoMovieSceneNode,
): IAutoMovieBeatEndActorState => {
  const performed = context.performanceByNode.get(node.id);
  const motionId =
    performed === undefined ? node.motion : performed.performance.motion;
  const localTime =
    performed === undefined
      ? context.duration
      : Math.max(0, context.duration - performed.performance.startOffset);
  const mount = context.mountByNode.get(node.id)?.binding ?? null;
  const plants = context.plantsByNode.get(node.id);

  if (motionId === null)
    return actorState({
      node,
      motion: null,
      localTime,
      pose: node.pose,
      mount,
      plants,
    });

  const motion = context.motionById.get(motionId);
  if (motion === undefined)
    throw new Error(`motion "${motionId}" was not provided`);

  return actorState({
    node,
    motion: { id: motionId, clip: motion.motion },
    localTime,
    pose: sampleMotion(motion.motion, localTime).pose,
    mount,
    plants,
  });
};

const actorState = (props: {
  node: IAutoMovieSceneNode;
  motion: { id: string; clip: IAutoMovieMotion } | null;
  localTime: number;
  pose: IAutoMoviePose | null;
  mount: IAutoMovieMountBinding | null;
  plants: readonly IAutoMovieBeatEndFootPlant[] | undefined;
}): IAutoMovieBeatEndActorState => {
  const root = props.pose === null ? null : props.pose.root;
  const transform = foldRoot(props.node.transform, root);
  return {
    node: props.node.id,
    transform,
    facing: Quaternion.rotateVector(transform.rotation, FORWARD),
    pose: props.pose === null ? null : { ...props.pose, root: null },
    motion: props.motion === null ? null : props.motion.id,
    localTime: props.localTime,
    gaitPhase:
      props.motion === null
        ? null
        : gaitPhaseOf(props.motion.clip, props.localTime),
    rootVelocity:
      props.motion === null
        ? null
        : rootVelocityOf(props.node, props.motion.clip, props.localTime),
    footPlants: plantsAtEnd(props.plants, props.localTime),
    mount: props.mount,
  };
};
