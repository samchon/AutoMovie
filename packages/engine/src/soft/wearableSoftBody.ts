import type {
  AutoMovieHumanoidBone,
  IAutoMovieQuaternion,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftBodyState,
  IAutoMovieVector3,
} from "@automovie/interface";

import type { IAutoMovieResolvedBone } from "../kinematics/resolvePose";
import { Quaternion } from "../math/Quaternion";
import {
  type IAutoMovieSoftBodyBoundarySample,
  simulateSoftBodyWithBoundaries,
} from "./softBody";

/**
 * Evaluated scene-node transform available to one soft fixed step.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Resolves an object attachment from its owning frame.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Supplies one immutable moving-subject pose.
 */
export interface IAutoMovieSoftNodeTransform {
  /**
   * Stable scene-node identity.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Keeps missing attachments distinct from the world origin.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Joins the authored node binding explicitly.
   */
  node: string;
  /**
   * World position at this fixed-step boundary.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Reads primary motion on the same sample.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Supplies the current attachment translation.
   */
  worldPosition: IAutoMovieVector3;
  /**
   * World orientation at this fixed-step boundary.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Reads primary motion on the same sample.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Places the declared local offset without a stale frame.
   */
  worldRotation: IAutoMovieQuaternion;
}

/**
 * Evaluated actor skeleton available to one soft fixed step.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Resolves actor-bone attachments explicitly.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Supplies the immutable skeletal boundary.
 */
export interface IAutoMovieWearableSoftActorPose {
  /**
   * Stable actor participant identity.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Prevents a missing actor from becoming an origin collider.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Joins shared capsules to their actor.
   */
  actor: string;
  /**
   * Resolved humanoid bones at this boundary.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Reads the current primary performance.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Supplies current anchor and collider transforms.
   */
  bones: readonly IAutoMovieResolvedBone[];
}

/**
 * Complete primary-motion snapshot for one absolute soft step.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Samples attachment and collision boundaries on the cloth clock.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Makes arbitrary seek consume the same immutable inputs.
 */
export interface IAutoMovieWearableSoftFrame {
  /**
   * Absolute fixed-step index.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Aligns primary and secondary time.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Prevents cursor-dependent sampling.
   */
  step: number;
  /**
   * Evaluated object and platform nodes.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Supports moving non-actor attachments.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Resolves node-local points before the solve.
   */
  nodes: readonly IAutoMovieSoftNodeTransform[];
  /**
   * Evaluated actors and bones.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Supplies the current body boundary.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Resolves shared capsules before projection.
   */
  actors: readonly IAutoMovieWearableSoftActorPose[];
}

/**
 * Exact admission facts for one live deterministic wearable solve.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Reports the explicitly selected expensive path.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Keeps solver adoption and cost inspectable.
 */
export interface IAutoMovieWearableSoftBudget {
  /**
   * Zero-based admitted subject slot.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Does not enable a crowd implicitly.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Identifies the selected live solve.
   */
  subjectIndex: number;
  /**
   * Declared maximum simultaneous wearable subjects.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Bounds additional work.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition States the admission ceiling.
   */
  maxSubjects: number;
  /**
   * Moving anchor count per step.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Reports attachment work.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Counts resolved anchor inputs.
   */
  anchorsPerStep: number;
  /**
   * Moving body-capsule count per step.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Reports shared collision work.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Counts resolved capsule inputs.
   */
  capsulesPerStep: number;
  /**
   * Total moving boundary records consumed for the seek.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Reports exact bounded work.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Accounts for each fixed-step input.
   */
  boundaryRecords: number;
}

/**
 * Wearable cloth state and its explicit admission report.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Returns secondary state derived from primary motion.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Preserves the chosen live path and its cost.
 */
export interface IAutoMovieWearableSoftResult {
  /**
   * Deterministic CPU-reference cloth state.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Preserves a complete arbitrary-seek result.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Returns finalized post-contact state.
   */
  state: IAutoMovieSoftBodyState;
  /**
   * Exact moving-boundary cost facts.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-adoption-choice Makes the selected cost visible.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Reports live solver admission.
   */
  budget: IAutoMovieWearableSoftBudget;
}

/**
 * Resolve and simulate one explicitly admitted moving soft-body domain.
 *
 * Authored moving anchors and body capsules come directly from the domain. The
 * caller supplies an immutable primary-motion snapshot for every absolute soft
 * step; this function never samples an animation cursor, selects a subject, or
 * substitutes an origin for a missing target. Calling this API is the explicit
 * `live deterministic` choice. The existing {@link simulateSoftBody} path is
 * still the byte-compatible static choice.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Drives soft state from same-clock primary motion.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Implements the explicit live deterministic boundary path.
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Consumes the author-selected live deterministic solver tier.
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-claim-boundary Reports only bounded proxy state and cost.
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-static-compatibility Leaves the established static solver as a separate explicit path.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Projects contacts after each fixed-step primary boundary is resolved.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Resolves explicit node and actor-bone attachment targets.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-determinism-compatibility Consumes complete immutable boundary snapshots for deterministic seek.
 */
export const simulateAutoMovieWearableSoftBody = (props: {
  /** Authored domain carrying static or moving anchors and colliders. */
  domain: IAutoMovieSoftBodyDomain;
  /** Absolute target step. */
  step: number;
  /** Complete primary-motion snapshots from zero through the target step. */
  frames: readonly IAutoMovieWearableSoftFrame[];
  /** Zero-based selected expensive-subject slot. */
  subjectIndex: number;
  /** Declared maximum simultaneous wearable subjects. */
  maxSubjects: number;
  /** Optional named static boundary state. */
  state?: string | null;
}): IAutoMovieWearableSoftResult => {
  assertAdmission(props.subjectIndex, props.maxSubjects);
  if (!Number.isSafeInteger(props.step) || props.step < 0)
    throw new Error("wearable soft step must be a non-negative integer");
  if (props.frames.length !== props.step + 1)
    throw new Error(
      `wearable soft solve needs primary-motion frames 0 through ${props.step}`,
    );

  const movingAnchors = props.domain.anchors.filter(
    (anchor) => anchor.binding !== undefined,
  );
  const bodyCapsules = props.domain.colliders.filter(
    (collider) => collider.kind === "body-capsule",
  );
  if (movingAnchors.length === 0 && bodyCapsules.length === 0)
    throw new Error(
      `soft body "${props.domain.id}" declares no moving boundary; use the static solver`,
    );

  const boundaries: IAutoMovieSoftBodyBoundarySample[] = props.frames.map(
    (frame, index) => {
      if (frame.step !== index)
        throw new Error(
          `wearable soft frame[${index}] must name absolute step ${index}`,
        );
      const nodes = keyed(frame.nodes, (node) => node.node, "node", index);
      const actors = keyed(
        frame.actors,
        (actor) => actor.actor,
        "actor",
        index,
      );
      return {
        step: index,
        anchors: movingAnchors.map((anchor) => {
          const binding = anchor.binding!;
          if (binding.kind === "node") {
            const node = nodes.get(binding.node);
            if (node === undefined)
              throw new Error(
                `wearable soft frame[${index}] is missing node "${binding.node}"`,
              );
            return {
              particle: anchor.particle,
              position: resolveLocalPoint(
                node.worldPosition,
                node.worldRotation,
                binding.offset,
              ),
            };
          }
          const actor = actors.get(binding.actor);
          if (actor === undefined)
            throw new Error(
              `wearable soft frame[${index}] is missing actor "${binding.actor}"`,
            );
          const bone = resolvedBone(actor.bones, binding.bone, index);
          return {
            particle: anchor.particle,
            position: resolveLocalPoint(
              bone.worldPosition,
              bone.worldRotation,
              binding.offset,
            ),
          };
        }),
        capsules: bodyCapsules.map((collider) => {
          const actor = actors.get(collider.actor);
          if (actor === undefined)
            throw new Error(
              `wearable soft frame[${index}] is missing capsule actor "${collider.actor}"`,
            );
          return {
            id: collider.id,
            from: {
              ...resolvedBone(actor.bones, collider.capsule.from, index)
                .worldPosition,
            },
            to: {
              ...resolvedBone(actor.bones, collider.capsule.to, index)
                .worldPosition,
            },
            radius: collider.capsule.radius,
          };
        }),
      };
    },
  );
  return {
    state: simulateSoftBodyWithBoundaries(
      props.domain,
      props.step,
      boundaries,
      props.state ?? null,
    ),
    budget: {
      subjectIndex: props.subjectIndex,
      maxSubjects: props.maxSubjects,
      anchorsPerStep: movingAnchors.length,
      capsulesPerStep: bodyCapsules.length,
      boundaryRecords:
        boundaries.length * (movingAnchors.length + bodyCapsules.length),
    },
  };
};

const keyed = <Entry>(
  entries: readonly Entry[],
  key: (entry: Entry) => string,
  label: string,
  step: number,
): ReadonlyMap<string, Entry> => {
  const output = new Map<string, Entry>();
  for (const entry of entries) {
    const id = key(entry);
    if (id.trim().length === 0 || output.has(id))
      throw new Error(
        `wearable soft frame[${step}] ${label} ids must be non-blank and unique`,
      );
    output.set(id, entry);
  }
  return output;
};

const resolvedBone = (
  bones: readonly IAutoMovieResolvedBone[],
  name: AutoMovieHumanoidBone,
  step: number,
): IAutoMovieResolvedBone => {
  let resolved: IAutoMovieResolvedBone | undefined;
  for (const bone of bones)
    if (bone.bone === name) {
      if (resolved !== undefined)
        throw new Error(`wearable soft frame[${step}] repeats bone "${name}"`);
      resolved = bone;
    }
  if (resolved === undefined)
    throw new Error(`wearable soft frame[${step}] is missing bone "${name}"`);
  return resolved;
};

const resolveLocalPoint = (
  position: IAutoMovieVector3,
  rotation: IAutoMovieQuaternion,
  offset: IAutoMovieVector3,
): IAutoMovieVector3 => {
  assertVector(position, "moving subject position");
  assertVector(offset, "moving subject local offset");
  assertQuaternion(rotation, "moving subject rotation");
  const rotated = Quaternion.rotateVector(rotation, offset);
  return {
    x: position.x + rotated.x,
    y: position.y + rotated.y,
    z: position.z + rotated.z,
  };
};

const assertQuaternion = (value: IAutoMovieQuaternion, label: string): void => {
  if ([value.x, value.y, value.z, value.w].every(Number.isFinite) === false)
    throw new Error(`${label} must contain finite coordinates`);
  const squaredLength =
    value.x * value.x +
    value.y * value.y +
    value.z * value.z +
    value.w * value.w;
  if (Math.abs(squaredLength - 1) > 1e-6)
    throw new Error(`${label} must be unit length`);
};

const assertAdmission = (subjectIndex: number, maxSubjects: number): void => {
  if (!Number.isSafeInteger(maxSubjects) || maxSubjects < 0)
    throw new Error(
      "wearable soft max subjects must be a non-negative integer",
    );
  if (!Number.isSafeInteger(subjectIndex) || subjectIndex < 0)
    throw new Error(
      "wearable soft subject index must be a non-negative integer",
    );
  if (subjectIndex >= maxSubjects)
    throw new Error(
      `wearable soft subject index ${subjectIndex} exceeds the declared ${maxSubjects}-subject budget`,
    );
};

const assertVector = (value: IAutoMovieVector3, label: string): void => {
  if ([value.x, value.y, value.z].every(Number.isFinite) === false)
    throw new Error(`${label} must contain finite coordinates`);
};
