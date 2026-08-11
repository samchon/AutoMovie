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
import { IAutoMovieProfileApplication, bindProfile } from "./bindProfile";
import { channelKey } from "./channel";
import { composeScene } from "./composeScene";
import { resolveDrivers } from "./resolveDrivers";
import {
  IAutoMovieSampledChannel,
  sampleClip,
  sampleClipSequence,
} from "./sampleClip";
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
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Attaches secondary collision geometry to a time-varying scene-node frame.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Defines the node-relative collider resolved for each live spring step.
 * @author Samchon
 */
export interface IAutoMovieSpringCollider {
  /**
   * Node whose world position centers the sphere.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Names the moving scene frame that carries this collision boundary.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Resolves the collider center from the current composed node state.
   */
  node: string;
  /**
   * Sphere radius, meters. Strictly positive.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Defines the collision boundary's authored physical extent.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Carries the radius used by the live secondary-motion collision solve.
   */
  radius: number;
}

/**
 * The cross-frame inputs that let {@link resolveFrame} step spring drivers
 * inside the frame pass: the previous-step state, the timestep, and optional
 * node-attached collision spheres. Springs are the one stateful driver: with
 * this the engine advances them deterministically frame-to-frame; without it
 * they defer exactly as before.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Enables the live deterministic spring path for a frame.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Defines the explicit live-secondary input to frame resolution.
 * @author Samchon
 */
export interface IAutoMovieResolveSprings {
  /**
   * Cross-frame Verlet state, advanced in place.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Carries the solver-owned history required by the selected live path.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Supplies persistent state to deterministic spring evaluation.
   */
  state: IAutoMovieSpringState;
  /**
   * Seconds since the previously resolved frame. Strictly positive.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Fixes the integration interval used by the live secondary solver.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Supplies the bounded timestep for deterministic spring advancement.
   */
  dt: number;
  /**
   * Collision spheres riding scene nodes. Omit for none.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Supplies the node-attached boundaries sampled for this spring step.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Carries the moving collision set used by live secondary resolution.
   */
  colliders?: IAutoMovieSpringCollider[];
}

/**
 * Everything needed to resolve one instant of a scene.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Identifies one frame evaluation through explicit authored inputs.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Defines the complete deterministic frame-evaluation input.
 * @author Samchon
 */
export interface IAutoMovieResolveInput {
  /**
   * The scene graph: nodes with parent-local rest transforms.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Supplies the node graph whose transforms define this evaluation.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Carries the concrete node graph against which sampled channels resolve.
   */
  nodes: IAutoMovieNode[];

  /**
   * The clip(s) animating this frame, or `null` for the rest pose. A sequence
   * resolves duplicate channels by their track start time and producer order.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state Supplies the clip state sampled for this frame.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Carries the clip set whose deterministic sample becomes resolved state.
   */
  clip: IAutoMovieClip | readonly IAutoMovieClip[] | null;

  /**
   * Channel limits to clamp sampled values against (generalized ROM).
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-numeric-stability Supplies the finite bounds used to keep sampled channel state numerically valid.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Carries the constraint set included in deterministic sample validation.
   */
  limits: IAutoMovieChannelLimit[];

  /**
   * Drivers computing channels from other channels. Channel-space drivers
   * (`copy`, `driven`) are resolved this frame; world-space ones apply in the
   * post-compose pass; only springs without a {@link springs} input are returned
   * in {@link IAutoMovieResolveOutput.deferredDrivers}. Omit for none.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Supplies the declared driver dependency graph evaluated in this frame.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Threads the driver graph through frame resolution.
   */
  drivers?: IAutoMovieDriver[];

  /**
   * Cross-frame spring stepping (state + dt + colliders). When present every
   * spring driver advances inside this frame; when absent springs defer.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Selects live spring evaluation for this frame.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Carries the explicit live-secondary adoption input for this frame.
   */
  springs?: IAutoMovieResolveSprings;

  /**
   * Profiles applied to this scene ({@link bindProfile} per entry). Their bound
   * limits and drivers merge **before** the directly-passed `limits`/`drivers`:
   * a profile is the rig's standard baseline, the direct inputs are the
   * caller's per-scene word, so a direct limit clamps last (its bound is the
   * final one) and direct world-space drivers apply after profile-bound ones.
   * Omit for none; absent, behavior is byte-identical to before profiles
   * existed.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Supplies reusable profile applications before direct scene overrides.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Carries the profile applications materialized into the frame's constraint graph.
   */
  profiles?: IAutoMovieProfileApplication[];

  /**
   * The instant to resolve, in clip-local seconds.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-scrambled-seek Selects the arbitrary clip-local instant that must resolve independently of query order.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Supplies the exact sample time for deterministic seek comparison.
   */
  seconds: number;
}

/**
 * A clamp that fired this frame, tagged with the channel it constrained.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Attaches source identity to one applied constraint.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Defines a source-addressed constraint finding in the resolved-frame receipt.
 * @author Samchon
 */
export interface IAutoMovieResolveViolation extends IAutoMovieClampViolation {
  /**
   * The {@link channelKey} of the channel that was clamped.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Identifies the exact sampled channel altered by the constraint pass.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Locates the constraint finding in the resolved channel set.
   */
  channel: string;

  /**
   * Id of the profile whose bound limit fired, when the limit arrived through
   * {@link IAutoMovieResolveInput.profiles}; absent for a directly-passed limit.
   * Lets a correction round say "the door profile's hinge range did this"
   * instead of pointing at an anonymous bound.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Preserves the profile provenance of a bound that changed resolved state.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Carries constraint-source identity in the frame evaluation receipt.
   */
  profile?: string;
}

/**
 * The resolved frame: world matrices, morph weights, and any clamps fired.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Returns the explicit receipt for one resolved sample.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Defines the deterministic result receipt for one frame.
 * @author Samchon
 */
export interface IAutoMovieResolveOutput {
  /**
   * Node id → world matrix (`number[16]`, column-major).
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Carries the resolved world state produced by this evaluation identity.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Emits the deterministic composed transform result for every node.
   */
  world: Map<string, number[]>;

  /**
   * Node id → morph-target weights, for nodes whose `weights` channel animated.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Carries resolved morph-channel state beside the world transform result.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Emits deterministic sampled weights for downstream deformation.
   */
  weights: Map<string, number[]>;

  /**
   * Every constraint breach that was clamped, in channel/component order.
   *
   * @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt Preserves each numeric correction applied during this frame evaluation.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Emits ordered constraint findings with the resolved state.
   */
  violations: IAutoMovieResolveViolation[];

  /**
   * Drivers this pass could not resolve: surfaced, never dropped. After S2 only
   * two things can appear here: springs when no
   * {@link IAutoMovieResolveInput.springs} input was given (stateful: nothing to
   * step them with), and malformed two-bone chains (length ≠ 3).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Surfaces driver edges this pass could not execute instead of silently dropping them.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Preserves the unresolved remainder of the deterministic driver graph.
   */
  deferredDrivers: IAutoMovieDriver[];
}

/**
 * Resolve one frame of a scene: SAMPLE the clip, DRIVE the channel-space
 * drivers, CONSTRAIN the values to their channel limits, COMPOSE the node
 * hierarchy into world matrices, then run the world-space DRIVE pass
 * (aim/parent/two-bone and iterative ccd/fabrik IK) and, when the caller
 * threads `springs` state, STEP every spring driver.
 *
 * This is the engine's per-frame entry point and the deterministic core of
 * automovie: given the same scene, clip, limits, drivers, time (and spring
 * state) it always yields the same matrices, the property that makes the
 * renderer a reproducible diffusion alternative. Every solver runs on a fixed
 * budget, so nothing here is host-dependent; springs without a `springs` input
 * are the one thing still surfaced in `deferredDrivers`.
 *
 * @evidence requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state Uses explicit fixed-step state for live spring evaluation.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-time-update Samples clip channels at the caller's explicit seconds before driving, constraining, and composing that frame.
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-state-isolation Produces one frame from explicit nodes, clips, limits, drivers, and optional spring state without retaining hidden scene state between calls.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-deterministic-sampling-validation Executes the deterministic frame pipeline for one sample.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Keeps time and mutable spring history in the resolve input/output boundary rather than in shared renderer state.
 * @author Samchon
 */
export const resolveFrame = (
  input: IAutoMovieResolveInput,
): IAutoMovieResolveOutput => {
  const sampled: Map<string, IAutoMovieSampledChannel> =
    input.clip === null
      ? new Map()
      : Array.isArray(input.clip)
        ? sampleClipSequence(input.clip, input.seconds)
        : sampleClip(input.clip as IAutoMovieClip, input.seconds);

  // Bind applied profiles and merge: profile-bound limits/drivers first, the
  // caller's direct inputs after (the caller's word is final: a direct limit
  // clamps last; direct world drivers apply after profile-bound ones).
  const limitEntries: ILimitEntry[] = [];
  const drivers: IAutoMovieDriver[] = [];
  for (const application of input.profiles ?? []) {
    const bound = bindProfile(application);
    for (const limit of bound.limits)
      limitEntries.push({ limit, profile: application.profile.id });
    drivers.push(...bound.drivers);
  }
  for (const limit of input.limits) limitEntries.push({ limit, profile: null });
  drivers.push(...(input.drivers ?? []));

  // DRIVE (channel-space): resolve copy/driven into the sampled map; collect the
  // world-space drivers the post-compose pass owns.
  const nodesById = new Map(input.nodes.map((n) => [n.id, n]));
  const worldSpaceDrivers =
    drivers.length > 0 ? resolveDrivers(drivers, sampled, nodesById) : [];
  validateSampledNodeChannels(sampled, nodesById);

  // CONSTRAIN: clamp each sampled channel that carries a limit, in place.
  const violations: IAutoMovieResolveViolation[] = [];
  for (const entry of limitEntries) {
    const key = channelKey(entry.limit.channel);
    const hit = sampled.get(key);
    if (hit === undefined) continue;
    const outcome = applyChannelLimit(hit.value, entry.limit);
    hit.value = outcome.value;
    for (const v of outcome.violations)
      violations.push(
        entry.profile === null
          ? { ...v, channel: key }
          : { ...v, channel: key, profile: entry.profile },
      );
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
 * never accumulate sag. Rotation/scale stay animated: spring only owns the
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

/** One limit to apply, tagged with the profile it came from (null = direct). */
interface ILimitEntry {
  limit: IAutoMovieChannelLimit;
  profile: string | null;
}

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
