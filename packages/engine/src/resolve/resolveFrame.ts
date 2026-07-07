import {
  IAutoMovieChannelLimit,
  IAutoMovieClip,
  IAutoMovieDriver,
  IAutoMovieNode,
  IAutoMovieTransform,
} from "@automovie/interface";

import {
  IAutoMovieClampViolation,
  applyChannelLimit,
} from "./applyChannelLimit";
import { channelKey } from "./channel";
import { composeScene } from "./composeScene";
import { resolveDrivers } from "./resolveDrivers";
import { IAutoMovieSampledChannel, sampleClip } from "./sampleClip";
import {
  IAutoMovieSpringSphere,
  IAutoMovieSpringState,
  stepSpring,
} from "./spring";
import { childrenIndex, resolveWorldDrivers } from "./worldDrivers";
import { readWorld } from "./worldShared";

/**
 * A collision sphere attached to a scene node, for in-frame spring stepping:
 * the sphere rides the node's composed world position each frame.
 */
export interface IAutoMovieSpringCollider {
  /** Node whose world position centers the sphere. */
  node: string;
  /** Sphere radius, meters. Strictly positive. */
  radius: number;
}

/**
 * The cross-frame inputs that let {@link resolveFrame} step spring drivers
 * inside the frame pass: the previous-step state, the timestep, and optional
 * node-attached collision spheres. Springs are the one stateful driver — with
 * this the engine advances them deterministically frame-to-frame; without it
 * they defer exactly as before.
 */
export interface IAutoMovieResolveSprings {
  /** Cross-frame Verlet state, advanced in place. */
  state: IAutoMovieSpringState;
  /** Seconds since the previously resolved frame. Strictly positive. */
  dt: number;
  /** Collision spheres riding scene nodes. Omit for none. */
  colliders?: IAutoMovieSpringCollider[];
}

/** Everything needed to resolve one instant of a scene. */
export interface IAutoMovieResolveInput {
  /** The scene graph: nodes with parent-local rest transforms. */
  nodes: IAutoMovieNode[];

  /** The clip animating the scene this frame, or `null` for the rest pose. */
  clip: IAutoMovieClip | null;

  /** Channel limits to clamp sampled values against (generalized ROM). */
  limits: IAutoMovieChannelLimit[];

  /**
   * Drivers computing channels from other channels. Channel-space drivers
   * (`copy`, `driven`) are resolved this frame; world-space ones apply in the
   * post-compose pass; only springs without a {@link springs} input are returned
   * in {@link IAutoMovieResolveOutput.deferredDrivers}. Omit for none.
   */
  drivers?: IAutoMovieDriver[];

  /**
   * Cross-frame spring stepping (state + dt + colliders). When present every
   * spring driver advances inside this frame; when absent springs defer.
   */
  springs?: IAutoMovieResolveSprings;

  /** The instant to resolve, in clip-local seconds. */
  seconds: number;
}

/** A clamp that fired this frame, tagged with the channel it constrained. */
export interface IAutoMovieResolveViolation extends IAutoMovieClampViolation {
  /** The {@link channelKey} of the channel that was clamped. */
  channel: string;
}

/** The resolved frame: world matrices, morph weights, and any clamps fired. */
export interface IAutoMovieResolveOutput {
  /** Node id → world matrix (`number[16]`, column-major). */
  world: Map<string, number[]>;

  /** Node id → morph-target weights, for nodes whose `weights` channel animated. */
  weights: Map<string, number[]>;

  /** Every constraint breach that was clamped, in channel/component order. */
  violations: IAutoMovieResolveViolation[];

  /**
   * Drivers this pass could not resolve — surfaced, never dropped. After S2
   * only two things can appear here: springs when no
   * {@link IAutoMovieResolveInput.springs} input was given (stateful — nothing
   * to step them with), and malformed two-bone chains (length ≠ 3).
   */
  deferredDrivers: IAutoMovieDriver[];
}

/**
 * Resolve one frame of a scene: SAMPLE the clip, DRIVE the channel-space
 * drivers, CONSTRAIN the values to their channel limits, COMPOSE the node
 * hierarchy into world matrices, then run the world-space DRIVE pass
 * (aim/parent/two-bone and iterative ccd/fabrik IK) and — when the caller
 * threads `springs` state — STEP every spring driver.
 *
 * This is the engine's per-frame entry point and the deterministic core of
 * automovie: given the same scene, clip, limits, drivers, time (and spring
 * state) it always yields the same matrices — the property that makes the
 * renderer a reproducible diffusion alternative. Every solver runs on a fixed
 * budget, so nothing here is host-dependent; springs without a `springs` input
 * are the one thing still surfaced in `deferredDrivers`.
 *
 * @author Samchon
 */
export const resolveFrame = (
  input: IAutoMovieResolveInput,
): IAutoMovieResolveOutput => {
  const sampled: Map<string, IAutoMovieSampledChannel> =
    input.clip === null ? new Map() : sampleClip(input.clip, input.seconds);

  // DRIVE (channel-space): resolve copy/driven into the sampled map; collect the
  // world-space drivers the post-compose pass owns.
  const nodesById = new Map(input.nodes.map((n) => [n.id, n]));
  const worldSpaceDrivers =
    input.drivers !== undefined
      ? resolveDrivers(input.drivers, sampled, nodesById)
      : [];
  validateSampledNodeChannels(sampled, nodesById);

  // CONSTRAIN: clamp each sampled channel that carries a limit, in place.
  const violations: IAutoMovieResolveViolation[] = [];
  for (const limit of input.limits) {
    const key = channelKey(limit.channel);
    const hit = sampled.get(key);
    if (hit === undefined) continue;
    const outcome = applyChannelLimit(hit.value, limit);
    hit.value = outcome.value;
    for (const v of outcome.violations) violations.push({ ...v, channel: key });
  }

  // Fold node-targeting samples into per-node transform overrides + weights.
  const overrides = new Map<string, IAutoMovieTransform>();
  const weights = new Map<string, number[]>();
  for (const node of input.nodes) {
    const t = sampled.get(`node:${node.id}:translation`);
    const r = sampled.get(`node:${node.id}:rotation`);
    const s = sampled.get(`node:${node.id}:scale`);
    if (t !== undefined || r !== undefined || s !== undefined)
      overrides.set(node.id, {
        translation: t ? toVec3(t.value) : node.transform.translation,
        rotation: r ? toQuat(r.value) : node.transform.rotation,
        scale: s ? toVec3(s.value) : node.transform.scale,
      });
    const w = sampled.get(`node:${node.id}:weights`);
    if (w !== undefined) weights.set(node.id, w.value);
  }

  // COMPOSE, then the WORLD-SPACE DRIVE pass (aim/parent/analytic + iterative
  // IK) over the composed hierarchy; springs step afterward when state+dt are
  // threaded, and defer otherwise.
  const world = composeScene(input.nodes, overrides);
  const localById = new Map<string, IAutoMovieTransform>();
  for (const node of input.nodes)
    localById.set(node.id, overrides.get(node.id) ?? node.transform);
  const afterWorldPass = resolveWorldDrivers(
    worldSpaceDrivers,
    world,
    localById,
    childrenIndex(input.nodes),
  );

  // STEP springs (the one stateful driver) inside the frame when the caller
  // provides the cross-frame state; colliders ride their nodes' world matrices.
  let deferredDrivers = afterWorldPass;
  if (input.springs !== undefined) {
    const spheres: IAutoMovieSpringSphere[] = (
      input.springs.colliders ?? []
    ).map((c) => ({
      center: positionOf(readWorld(world, c.node, "spring collider")),
      radius: c.radius,
    }));
    deferredDrivers = [];
    for (const d of afterWorldPass)
      if (d.type === "spring") {
        seedSprungPositions(d.chain, world, input.springs.state);
        stepSpring(
          d,
          world,
          input.springs.state,
          input.springs.dt,
          localById,
          spheres,
        );
      } else deferredDrivers.push(d);
  }

  return { world, weights, violations, deferredDrivers };
};

/**
 * Seed a spring chain's non-root joints from the state's post-spring positions
 * of the previous frame. A host loop carries its mutated world map across
 * steps; `resolveFrame` composes fresh from the animation every frame, so
 * without this the spring would restart from the animated pose each time and
 * never accumulate sag. Rotation/scale stay animated — spring only owns the
 * position, exactly like {@link stepSpring}'s own write.
 */
const seedSprungPositions = (
  chain: readonly string[],
  world: Map<string, number[]>,
  state: IAutoMovieSpringState,
): void => {
  for (let i = 1; i < chain.length; ++i) {
    const id = chain[i]!;
    const carried = state.sprung.get(id);
    if (carried === undefined) continue;
    const m = readWorld(world, id, "spring chain");
    const next = [...m];
    next[12] = carried.x;
    next[13] = carried.y;
    next[14] = carried.z;
    world.set(id, next);
  }
};

/** Translation column of a column-major world matrix. */
const positionOf = (m: number[]) => ({ x: m[12]!, y: m[13]!, z: m[14]! });

const toVec3 = (a: number[]) => ({ x: a[0]!, y: a[1]!, z: a[2]! });
const toQuat = (a: number[]) => ({ x: a[0]!, y: a[1]!, z: a[2]!, w: a[3]! });

const validateSampledNodeChannels = (
  sampled: Map<string, IAutoMovieSampledChannel>,
  nodesById: Map<string, IAutoMovieNode>,
): void => {
  for (const [key, hit] of sampled) {
    if (hit.channel.kind !== "node") continue;
    if (!nodesById.has(hit.channel.node))
      throw new Error(
        `sampled channel "${key}" references missing node "${hit.channel.node}"`,
      );
  }
};
