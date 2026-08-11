import {
  AutoMovieHumanoidBone,
  IAutoMovieGait,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieRestFrame } from "../rom/restFrame";

/**
 * The per-actor context the reference {@link makeActorSynthesizer} needs to
 * fatten an actor's verbs deterministically: which skeleton its clips target,
 * the gaits it can perform (whatever named locomotion its profile carries),
 * where it stands at the shot's start (so a `locomote` knows how far to
 * travel), how fast it moves, and the rest pose it holds. The host assembles
 * one of these per actor from the actor's profile and staged rig.
 *
 * @evidence requirements/actors/performance-and-story-binding.md#actor-performance-capability-plan Makes each actor's declared synthesis capability available to the performer.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state Defines the actor-state boundary used by shot-local synthesis.
 * @author Samchon
 */
export interface IAutoMovieActorContext {
  /**
   * Skeleton id every synthesised clip targets.
   *
   * @evidence requirements/actors/performance-and-story-binding.md#actor-performance-capability-plan Keeps synthesized performance attached to the skeleton selected by the actor's capability plan.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state Carries the performer identity basis into every generated clip.
   */
  skeleton: string;

  /**
   * The gaits this actor can perform, looked up by an action's gait name.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-rule-selection Supplies the explicit gait-table choice available to procedural locomotion.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Carries the actor's registered compact gait rules into synthesis.
   */
  gaits: IAutoMovieGait[];

  /**
   * Where the actor stands at the start of the shot (world meters).
   *
   * @evidence requirements/motion/root-motion-and-trajectories.md#motion-root-authority-mode Provides the staged world root from which actor motion begins.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Supplies the staged root origin to procedural trajectory resolution.
   */
  position: IAutoMovieVector3;

  /**
   * Locomotion speed (m/s): how fast a `locomote` carries it.
   *
   * @evidence requirements/motion/root-motion-and-trajectories.md#motion-path-timing Binds path distance to the actor's explicit shot-local travel rate.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Supplies the speed law used to resolve procedural root trajectory timing.
   */
  speed: number;

  /**
   * Seconds into the looping gait cycle at the shot's start (#1176): the
   * continuity twin of the beat end-state's `gaitPhase`. A beat that opens
   * mid-stride passes the previous beat's recorded phase here and the
   * synthesised gait resumes at that point of the cycle instead of restarting
   * it. Omit (or pass `null`, the end-state's non-looping marker) to start at
   * the cycle's beginning.
   *
   * @evidence requirements/motion/layers-blends-and-transitions.md#motion-phase-alignment Preserves the authored gait phase instead of restarting a cyclic layer at the shot boundary.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-layer-mask-transition-composition Supplies the phase state needed for cyclic layer alignment.
   */
  gaitPhase?: number | null;

  /**
   * Heading the actor faces, degrees about +Y (0 = +Z), for a `lookAt`'s yaw.
   *
   * @evidence requirements/motion/root-motion-and-trajectories.md#motion-facing-travel Keeps facing as explicit root state independent of travel direction.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Supplies the yaw input to procedural root resolution.
   */
  facingDeg: number;

  /**
   * Eye height above the actor's position (meters): where a `lookAt` aims from.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention Provides the measured gaze origin used to direct attention toward a target.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention Supplies the actor-local landmark from which gaze is solved.
   */
  eyeHeight: number;

  /**
   * The pose the actor settles into for a `hold`.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-space-authority Supplies the explicit rest-relative pose used by a hold action.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Carries the actor's resolved pose state rather than inventing a default hold.
   */
  restPose: IAutoMoviePose;

  /**
   * The actor's resolved skeleton geometry: the rig bones and their ROM
   * constraints. Required by the physics/IK verbs that measure or clamp against
   * the body (`react` folds a flinch bounded by each joint's ROM), and READ,
   * when present, by `lookAt`, which spreads its solved aim over the `neck` and
   * `head` ranges the rig declares instead of piling it all on the head
   * (#1360). The gait/hold/emote verbs need only the `skeleton` id, so a
   * context built for those alone may omit it; a physics verb with no `rig`
   * synthesises nothing, and a rig-less `lookAt` keeps the single-bone aim,
   * which is exactly what `performShot` gates such an actor by (no rig, no ROM
   * check).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Supplies the declared joint ranges used to constrain synthesized poses.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Supplies the resolved ROM to the performance constraint pass.
   */
  rig?: IAutoMovieSkeleton;

  /**
   * Per-bone rest frames the IK/arm verbs (`reach`/`point`/`strike`) express
   * their arm angles through, lifted by `sign·r + neutral` so a downstream
   * renderer reads them up through the same frames (abduction 180 raises either
   * arm overhead regardless of side). When supplied it must be paired with the
   * same frames on the player ({@link IAutoMovieActorContext} feeds
   * `AutoMoviePlayer`'s `restFrames`).
   *
   * **Omitting it no longer means raw rig space.** `reachPose` now defaults to
   * the canonical `HUMANOID_REST_FRAME` that pairs with the humanoid arm axes
   * it already applies unconditionally, because a pose carries clinical angles
   * by definition and is validated against the clinical ROM table by a direct
   * per-axis comparison. While this was optional, an actor context without it
   * made `perform`'s arm verbs emit rest-relative angles that the clinical
   * table then judged off by the shoulder's whole 90-degree rest abduction, and
   * disagree with `getReach`, which had always passed the frame (#1346). Supply
   * this only for a rig whose rest convention is genuinely its own.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rest-bind-deformation Keeps IK output expressed against the same declared rest basis as playback.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-skin-rigid-morph-deformation Carries the rest-frame basis that makes derived joint deformation consistent.
   */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}
