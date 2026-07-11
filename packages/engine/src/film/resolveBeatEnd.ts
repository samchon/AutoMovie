import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndFootPlant,
  IAutoMovieBeatEndState,
  IAutoMovieClip,
  IAutoMovieMotion,
  IAutoMovieMountBinding,
  IAutoMoviePose,
  IAutoMovieScene,
  IAutoMovieSceneNode,
  IAutoMovieShot,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "../motion/sampleMotion";
import { sampleClip } from "../resolve/sampleClip";
import {
  VELOCITY_DT,
  foldRoot,
  gaitPhaseOf,
  plantsAtEnd,
  rootVelocityOf,
} from "./beatEndSim";
import { bakedTransformAt, followClipOf } from "./followClip";
import { IAutoMovieStagedSet } from "./stageScene";

const FORWARD: IAutoMovieVector3 = { x: 0, y: 0, z: 1 };

/** Zero vector, the empty-window velocity. */
const ZERO: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };

/**
 * Trailing world velocity of the baked follow clip at `t` — the coupled child's
 * real end velocity as its parent moves, finite-differenced over the last
 * {@link VELOCITY_DT} and clamped into the clip. Zero exactly at the clip's
 * start (an empty window), like the pose-clip velocity rule; for any `t > 0`
 * the window `[t0, t1]` is non-empty (`VELOCITY_DT > 0`). The clip is the one
 * {@link followClipOf} matched, so its rider translation channel always
 * samples.
 */
const bakedFollowVelocity = (
  clip: IAutoMovieClip,
  node: string,
  t: number,
): IAutoMovieVector3 => {
  if (t <= 0) return ZERO;
  const t1 = Math.min(t, clip.duration);
  const t0 = Math.max(0, t1 - VELOCITY_DT);
  const p1 = sampleClip(clip, t1).get(`node:${node}:translation`)!.value;
  const p0 = sampleClip(clip, t0).get(`node:${node}:translation`)!.value;
  return Vector3.scale(
    {
      x: p1[0]! - p0[0]!,
      y: p1[1]! - p0[1]!,
      z: p1[2]! - p0[2]!,
    },
    1 / (t1 - t0),
  );
};

/** Inputs shared by the beat-end and beat-opening snapshots. */
export interface IResolveBeatProps {
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
}

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
export const resolveBeatEnd = (
  props: IResolveBeatProps,
): IAutoMovieBeatEndState => resolveSnapshot(props, props.shot.duration);

/**
 * The mirror of {@link resolveBeatEnd} at the shot's OPENING instant (`t = 0`):
 * where every actor stands, faces, and is coupled as the beat begins, before
 * any of its motion has played. The continuity linter compares this against the
 * previous beat's end-state to catch a cut that fails to resume from where the
 * prior beat left off — the "characters drift, props disappear" failure the
 * forward-written end-state exists to prevent but nothing verified.
 *
 * Same shape as the end snapshot, so `gaitPhase`/`rootVelocity`/`footPlants`
 * are the resumable-state fields at the opening instant; the linter reads only
 * `transform`, `facing`, and `mount`.
 */
export const resolveBeatOpening = (
  props: IResolveBeatProps,
): IAutoMovieBeatEndState => resolveSnapshot(props, 0);

/** Shared body: resolve every scene actor's snapshot at a shot-local instant. */
const resolveSnapshot = (
  props: IResolveBeatProps,
  instant: number,
): IAutoMovieBeatEndState => {
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
    instant,
    objectMotions: props.shot.objectMotions,
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

/** The per-beat lookups one actor's snapshot derives from. */
interface IResolveContext {
  /**
   * Shot-local instant to sample at — `0` for the opening, `duration` for the
   * end.
   */
  instant: number;
  objectMotions: readonly IAutoMovieClip[];
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
      ? context.instant
      : Math.max(0, context.instant - performed.performance.startOffset);
  const mount = context.mountByNode.get(node.id)?.binding ?? null;
  const plants = context.plantsByNode.get(node.id);
  // A coupled child's end world root comes from the shot's baked follow clip
  // — the same composition performShot produced (#674) — overriding its own
  // placement and pose-root. That covers the staged-mount rider AND the
  // per-beat `attachTo` grab (#1141): the shot leaves a grabbed prop in the
  // parent's hand, so the next beat must resume it there, not at its staged
  // spot; `mount` stays the PERSISTENT binding only (null for a grab). When
  // the shot carries no such clip (never coupled, a hand-built shot, or no
  // perform pass), the node falls back to the staged path below,
  // byte-identical to the pre-#674 output.
  const followClip = followClipOf(context.objectMotions, node.id);
  const world: IWorldOverride | null =
    followClip === null
      ? null
      : {
          transform: bakedTransformAt(followClip, node.id, localTime),
          rootVelocity: bakedFollowVelocity(followClip, node.id, localTime),
        };

  if (motionId === null)
    return actorState({
      node,
      motion: null,
      localTime,
      pose: node.pose,
      mount,
      plants,
      world,
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
    world,
  });
};

/** A coupled child's world root taken from its baked follow clip (#674). */
interface IWorldOverride {
  transform: IAutoMovieTransform;
  rootVelocity: IAutoMovieVector3;
}

const actorState = (props: {
  node: IAutoMovieSceneNode;
  motion: { id: string; clip: IAutoMovieMotion } | null;
  localTime: number;
  pose: IAutoMoviePose | null;
  mount: IAutoMovieMountBinding | null;
  plants: readonly IAutoMovieBeatEndFootPlant[] | undefined;
  world: IWorldOverride | null;
}): IAutoMovieBeatEndActorState => {
  const root = props.pose === null ? null : props.pose.root;
  const transform =
    props.world !== null
      ? props.world.transform
      : foldRoot(props.node.transform, root);
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
    // A coupled child's velocity is its parent's carry (baked-clip trailing
    // velocity), even when it holds its own pose; otherwise the pose-clip rule.
    rootVelocity:
      props.world !== null
        ? props.world.rootVelocity
        : props.motion === null
          ? null
          : rootVelocityOf(props.node, props.motion.clip, props.localTime),
    footPlants: plantsAtEnd(props.plants, props.localTime),
    mount: props.mount,
  };
};
