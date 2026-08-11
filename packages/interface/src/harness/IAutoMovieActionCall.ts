import { AutoMovieExpressionPreset } from "../expression/AutoMovieExpressionPreset";
import { AutoMovieBodyRegion } from "../skeleton/AutoMovieBodyRegion";
import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import { IAutoMovieBoneTarget } from "./IAutoMovieBoneTarget";
import { IAutoMovieDirectionTarget } from "./IAutoMovieDirectionTarget";
import { IAutoMovieGroupTarget } from "./IAutoMovieGroupTarget";
import { IAutoMovieNodeTarget } from "./IAutoMovieNodeTarget";
import { IAutoMovieOffscreenTarget } from "./IAutoMovieOffscreenTarget";
import { IAutoMovieOnHitReaction } from "./IAutoMovieOnHitReaction";
import { IAutoMoviePointTarget } from "./IAutoMoviePointTarget";

/**
 * Where an action points. Prefer a {@link IAutoMovieNodeTarget} (so the engine
 * resolves live world positions of moving actors) over a literal
 * {@link IAutoMoviePointTarget}; use {@link IAutoMovieDirectionTarget} /
 * {@link IAutoMovieOffscreenTarget} for relative goals ("walk off to the left")
 * so the model never has to invent world coordinates.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieActionTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieActionTarget` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export type IAutoMovieActionTarget =
  | IAutoMovieNodeTarget
  | IAutoMovieBoneTarget
  | IAutoMoviePointTarget
  | IAutoMovieGroupTarget
  | IAutoMovieDirectionTarget
  | IAutoMovieOffscreenTarget;

/**
 * A closed set of **gesture families** the engine has motion for. A closed enum
 * (not a free string) is deliberate: across many parallel generations, free
 * names drift ("wave"/"waving"/"hand-wave"); a fixed set converges. Use `note`
 * to specialise within a family ("strike" + note "jab"), or `custom` to
 * describe a one-off the engine should approximate.
 *
 * The set spans **both humanoid and creature** actors: the project rigs horses
 * and cats on the same {@link AutoMovieHumanoidBone} skeleton (spine = barrel,
 * the limbs retargeted), so the engine dispatches each kind to the actor's rig
 * vocabulary: `kick` is a leg snap on a fighter and a hind-leg lash on a horse;
 * `rear`/`buck`/`paw` only resolve on a quadruped rig. Idle creature poses with
 * no directed target (a cat's stretch/sit, a tail flick) are a `hold` plus an
 * `emote`, or a `custom` gesture.
 *
 * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `AutoMovieGestureKind` as the portable data boundary for the motion object authored vocabulary requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `AutoMovieGestureKind` for the performance interaction attachment object handoff system contract.
 */
export type AutoMovieGestureKind =
  // humanoid
  | "strike"
  | "kick"
  | "guard"
  | "wave"
  | "bow"
  | "nod"
  | "shake"
  | "point"
  | "crouch"
  | "jump"
  | "stagger"
  | "draw"
  | "throw"
  | "celebrate"
  // creature (quadruped rig)
  | "rear"
  | "buck"
  | "paw"
  // escape
  | "custom";

/**
 * A single **action verb** an actor performs: the _thin_ unit the model emits
 * and the engine **fattens into dense motion**. The model says _what_ ("jab",
 * "walk to the door", "look at her", "get knocked back"); the engine's
 * primitives (locomotion bakers, two-bone IK, aim, ROM clamp, spring,
 * projectile, impact) synthesise the per-frame {@link IAutoMovieMotion}. This is
 * the authoring standard library's leverage: a legible schema, rich movement.
 *
 * Discriminated on `verb`. Every action carries an actor and a placement on the
 * shot's local timeline (`start`, and a `duration` or `"auto"` to let the
 * engine choose a natural length). The engine composes an actor's actions into
 * its performance clip (`arrangeMotion`, holding the last pose across gaps).
 * The camera is an actor too; its {@link IAutoMovieCameraAction}s are how it
 * moves.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieActionCall` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieActionCall` for the narrative intent utterance timing action system contract.
 * @author Samchon
 */
export type IAutoMovieActionCall =
  | IAutoMovieLocomoteAction
  | IAutoMovieGestureAction
  | IAutoMovieReachAction
  | IAutoMovieLookAtAction
  | IAutoMovieAttachAction
  | IAutoMovieLaunchAction
  | IAutoMovieReactAction
  | IAutoMovieEmoteAction
  | IAutoMovieHoldAction
  | IAutoMovieEnactAction
  | IAutoMovieCameraAction;

/**
 * Fields every action shares.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieActionBase` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieActionBase` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieActionBase {
  /**
   * The scene-node id(s) performing this action (reuse ids from staging). A
   * list applies the **same** verb to several actors in **unison** (a chorus
   * line, a crowd, synchronised dancers) instead of repeating the action per
   * actor (fewer tokens, no drift across parallel runs).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `actor` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `actor` for the narrative intent utterance timing action system contract.
   */
  actor: string | string[];

  /**
   * Seconds into the shot when it begins.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `start` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `start` for the narrative intent utterance timing action system contract.
   */
  start: number;

  /**
   * Length in seconds, or `"auto"` to let the engine pick a natural duration (a
   * stride cadence, a punch's snap, a projectile's flight time).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `duration` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `duration` for the narrative intent utterance timing action system contract.
   */
  duration: number | "auto";

  /**
   * Loop the action's motion this many times within its span (default 1): a
   * step repeated on the count, an idle sway. Cheaper than N near-identical
   * copies.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `repeat` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `repeat` for the narrative intent utterance timing action system contract.
   */
  repeat?: number;

  /**
   * The body-region this action drives ({@link AutoMovieBodyRegion}). Actions on
   * **disjoint** regions compose concurrently (walk while waving while
   * looking); actions sharing a region sequence. Omit to let the engine infer
   * the natural mask from the verb and, for gestures, the kind: a `locomote` is
   * `fullBody` (the shipped gaits drive hips, knees, and contralateral arms, so
   * a narrower mask strips them), a `wave`/`reach` is `upperBody`, a `lookAt`
   * or `nod`/`shake` is `head`, an `emote` is `face`, and the whole-body
   * gestures (`bow`/`crouch`/`kick`/`stagger`/`jump`/`draw`) plus `react` are
   * `fullBody`. Overlap is judged on the content surviving those masks (root,
   * bones, expression), so a `fullBody` gait still layers with a disjoint
   * head-only `lookAt`. Override only when the natural mask is wrong for the
   * staging; note the engine masks the synthesized clip to the region you pick,
   * so a narrower region trims the authored motion to those bones. Camera
   * (`frame`) and `attachTo` actions ignore it.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `region` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `region` for the narrative intent utterance timing action system contract.
   */
  region?: AutoMovieBodyRegion;

  /**
   * Acknowledge a deliberate physical implausibility so the engine's
   * physical-plausibility feedback (`"warning"`-severity, see
   * {@link IAutoMovieConstraintViolation.severity}) does not re-fire on this
   * action. A free-text intent (`"defies-gravity"`, `"superhuman-impact"`,
   * `"intentional-clip"`) that marks "this is on purpose". Omit for ordinary
   * actions; the engine warns as usual and the correction loop can address it.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `physicsIntent` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `physicsIntent` for the narrative intent utterance timing action system contract.
   */
  physicsIntent?: string;
}

/**
 * Travel across the floor on a gait; engine: locomotion + `travelMotion`.
 *
 * `gait` names one of the gaits the actor's context actually supplies
 * ({@link IAutoMovieGait.name}); it is matched by name, so the vocabulary is the
 * actor's own, not a fixed set: a biped declares `walk`/`run`/`sprint`/
 * `sneak`/`march`, a horse declares `walk`/`trot`/`canter`/`gallop`, a cat
 * `walk`/`stalk`/`pounce`. Naming a gait the actor did not supply is a
 * validation error (the shot's perform gate reports it), not a silent freeze,
 * so the schema's free string cannot drift from the runtime's actual set.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieLocomoteAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieLocomoteAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieLocomoteAction extends IAutoMovieActionBase {
  /**
   * Selects locomotion as the action family.
   *
   * @evidence requirements/motion/root-motion-and-trajectories.md#motion-root-authority-mode This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `verb` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `verb` for the narrative intent utterance timing action system contract.
   */
  verb: "locomote";

  /**
   * Name of the actor-provided gait used for the travel action.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule This action member carries the cited authoring intent in the typed action contract.
   */
  gait: string;

  /**
   * Where to go (the engine sizes the gait cycles to cover the distance).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `to` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `to` for the narrative intent utterance timing action system contract.
   */
  to: IAutoMovieActionTarget;

  /**
   * Face the travel direction (false keeps facing a separate look target).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `faceTravel` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `faceTravel` for the narrative intent utterance timing action system contract.
   */
  faceTravel?: boolean;
}

/**
 * A whole-body gesture from the engine's motion vocabulary. Pick the closest
 * `kind`; refine with `note`. The engine owns the keyframes; keep this intent,
 * not animation.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieGestureAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieGestureAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieGestureAction extends IAutoMovieActionBase {
  /**
   * Selects a gesture as the action family.
   *
   * @evidence requirements/actors/performance-and-story-binding.md#actor-performance-capability-plan This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state This action member carries the cited authoring intent in the typed action contract.
   */
  verb: "gesture";

  /**
   * Gesture family named by the authored action.
   *
   * @evidence requirements/actors/performance-and-story-binding.md#actor-performance-capability-plan This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-story-performance-state This action member carries the cited authoring intent in the typed action contract.
   */
  kind: AutoMovieGestureKind;

  /**
   * Specialise the family ("jab" for `strike`, "roundhouse" for `kick`) or
   * describe a `custom` one.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `note` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `note` for the narrative intent utterance timing action system contract.
   */
  note?: string;

  /**
   * What the gesture is directed at (a strike's target, a wave's recipient).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `at` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `at` for the narrative intent utterance timing action system contract.
   */
  at?: IAutoMovieActionTarget;
}

/**
 * Reach a hand to a target; engine: two-bone IK (`solveTwoBoneIK`). A
 * humanoid-rig verb (left/right arm); a quadruped pawing at something uses
 * `gesture` (`paw`) instead.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieReachAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieReachAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieReachAction extends IAutoMovieActionBase {
  /**
   * Selects a reach as the action family.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-reachability This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `verb` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `verb` for the narrative intent utterance timing action system contract.
   */
  verb: "reach";

  /**
   * Side of the actor that reaches for the target.
   *
   * @evidence requirements/actors/body-scale-and-landmarks.md#actor-left-right-asymmetry This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `hand` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `hand` for the narrative intent utterance timing action system contract.
   */
  hand: "left" | "right";

  /**
   * Spatial target that the selected hand attempts to reach.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `to` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `to` for the narrative intent utterance timing action system contract.
   */
  to: IAutoMovieActionTarget;
}

/**
 * Turn the head/eyes to track a target; engine: `aimRotation` look-at.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieLookAtAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieLookAtAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieLookAtAction extends IAutoMovieActionBase {
  /**
   * Selects gaze tracking as the action family.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention This action member carries the cited authoring intent in the typed action contract.
   */
  verb: "lookAt";

  /**
   * Target to which the actor directs its gaze.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-gaze-expression-attention This action member carries the cited authoring intent in the typed action contract.
   */
  to: IAutoMovieActionTarget;
}

/**
 * Rigidly couple this actor to another node's bone for the action's span: a
 * sword in a hand, a prop carried. Engine: `resolveAttachment`. (A _persistent_
 * mount, e.g. a rider on a horse, is better declared once in staging than
 * repeated as an action every shot.)
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieAttachAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieAttachAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieAttachAction extends IAutoMovieActionBase {
  /**
   * Selects an attachment as the action family.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-handoff This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff This action member carries the cited authoring intent in the typed action contract.
   */
  verb: "attachTo";

  /**
   * Scene node that owns the attachment bone.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-coupled-objects This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff This action member carries the cited authoring intent in the typed action contract.
   */
  parent: string;

  /**
   * Semantic bone on the parent to which the actor is attached.
   *
   * @evidence requirements/actors/appearance-costume-and-attachments.md#actor-attachment-contact This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `bone` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `bone` for the narrative intent utterance timing action system contract.
   */
  bone: AutoMovieHumanoidBone;
}

/**
 * Loose a projectile toward a target; engine: `projectileAt` +
 * `projectileSphereHit` (it leads a moving target). Because the **contact time
 * is computed by the engine**, the model cannot hand-time the target's
 * reaction; instead give `onHit`, and the engine schedules the target's `react`
 * at the **detected** moment of impact (the reactive event: "shoot him off his
 * horse" without knowing when the arrow lands).
 *
 * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `IAutoMovieLaunchAction` as the portable data boundary for the story action reaction requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `IAutoMovieLaunchAction` for the narrative intent action reaction knowledge system contract.
 */
export interface IAutoMovieLaunchAction extends IAutoMovieActionBase {
  /**
   * Selects a projectile launch as the action family.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-multi-subject-interaction This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-interaction-choreography-role This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `verb` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `verb` for the narrative intent action reaction knowledge system contract.
   */
  verb: "launch";

  /**
   * What is thrown (a scene-node prop, or a named projectile).
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `projectile` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `projectile` for the narrative intent action reaction knowledge system contract.
   */
  projectile: string;

  /**
   * Who/what it is aimed at.
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `at` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `at` for the narrative intent action reaction knowledge system contract.
   */
  at: IAutoMovieActionTarget;

  /**
   * Launch speed (m/s).
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `speed` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `speed` for the narrative intent action reaction knowledge system contract.
   */
  speed: number;

  /**
   * The reaction the engine applies to the struck target at the detected hit.
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `onHit` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `onHit` for the narrative intent action reaction knowledge system contract.
   */
  onHit?: IAutoMovieOnHitReaction;
}

/**
 * React to being struck: the engine resolves the impact (`resolveImpact`) and
 * the ROM-bounded flinch/knock-back (`impactRecoil`). Usually emitted by the
 * engine from a {@link IAutoMovieLaunchAction}'s `onHit`; author it directly for
 * a melee blow whose timing you control.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieReactAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieReactAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieReactAction extends IAutoMovieActionBase {
  /**
   * Selects an impact reaction as the action family.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-multi-subject-interaction This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-interaction-choreography-role This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `verb` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `verb` for the narrative intent utterance timing action system contract.
   */
  verb: "react";

  /**
   * Where the blow comes from.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `from` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `from` for the narrative intent utterance timing action system contract.
   */
  from: IAutoMovieActionTarget;

  /**
   * Force `[0,1]` (a graze vs. a knockout); the engine scales the impulse.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `force` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `force` for the narrative intent utterance timing action system contract.
   */
  force: number;

  /**
   * If it unseats/floors the actor (drives a fall within ROM + balance).
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `unbalance` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `unbalance` for the narrative intent utterance timing action system contract.
   */
  unbalance?: boolean;
}

/**
 * Play a facial expression; engine: blendshape/expression channels.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieEmoteAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieEmoteAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieEmoteAction extends IAutoMovieActionBase {
  /**
   * Selects a facial expression as the action family.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state This action member carries the cited authoring intent in the typed action contract.
   */
  verb: "emote";

  /**
   * Named expression preset applied by the action.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state This action member carries the cited authoring intent in the typed action contract.
   */
  preset: AutoMovieExpressionPreset;

  /**
   * Strength `[0,1]`.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `intensity` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `intensity` for the narrative intent utterance timing action system contract.
   */
  intensity: number;
}

/**
 * Hold the current pose (a beat of stillness) for the duration.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieHoldAction` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieHoldAction` for the narrative intent utterance timing action system contract.
 */
export interface IAutoMovieHoldAction extends IAutoMovieActionBase {
  /**
   * Selects a pose hold as the action family.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-story-film-time This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event This action member carries the cited authoring intent in the typed action contract.
   */
  verb: "hold";

  /**
   * Shot-local length of the held pose in seconds.
   *
   * @evidence requirements/motion/timing-and-semantic-events.md#motion-story-film-time This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clock-semantic-event This action member carries the cited authoring intent in the typed action contract.
   */
  duration: number;
}

/**
 * Play a clip the caller **authored itself**: the escape for the expressive
 * motion no thin verb covers (a sword kata, a stumble-and-recover, a
 * character-specific idiom). Where every other verb is fattened by a
 * synthesizer, `enact` inverts the direction: the caller **computes** the dense
 * {@link IAutoMovieMotion} (motion authoring is, at the limit, a coding
 * activity: parametric curves, phase composition, sampled solvers) and hands it
 * in by `clip` id; the host's synthesizer resolves the id against the clips it
 * was given.
 *
 * Enforcement is NOT bypassed: the engine masks the clip to its region (default
 * `fullBody`; narrow via `region`), layers it with disjoint-region actions,
 * sequences same-region overlaps, and ROM-gates the compiled composite exactly
 * like synthesized content: "engine enforces, model creates", with the model
 * creating at code bandwidth. Prefer a thin verb whenever one fits; reach for
 * `enact` when you can compute the keyframes.
 *
 * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `IAutoMovieEnactAction` as the portable data boundary for the motion object authored vocabulary requirement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `IAutoMovieEnactAction` for the performance interaction attachment object handoff system contract.
 */
export interface IAutoMovieEnactAction extends IAutoMovieActionBase {
  /**
   * Selects caller-authored motion playback as the action family.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `verb` as the portable data boundary for the motion object authored vocabulary requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `verb` for the performance interaction attachment object handoff system contract.
   */
  verb: "enact";

  /**
   * Id of the caller-authored clip, resolved by the host's synthesizer.
   *
   * @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary Exposes `clip` as the portable data boundary for the motion object authored vocabulary requirement.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-interaction-attachment-object-handoff Types `clip` for the performance interaction attachment object handoff system contract.
   */
  clip: string;
}

/**
 * The camera is an actor; this is how it moves. A _list_ of camera actions
 * composes a move that changes mid-shot ("follow the charge, then hold static
 * on the fall"). The engine realises the framing/move against the target as a
 * camera-node clip (`cameraMotion` on the shot).
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieCameraAction` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieCameraAction` for the clv focus diagnostics refusal system contract.
 */
export interface IAutoMovieCameraAction extends IAutoMovieActionBase {
  /**
   * Selects camera framing as the action family.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-source-trace This action member carries the cited authoring intent in the typed action contract.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations This action member carries the cited authoring intent in the typed action contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `verb` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `verb` for the clv focus diagnostics refusal system contract.
   */
  verb: "frame";

  /**
   * How tight the framing is.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `framing` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `framing` for the clv focus diagnostics refusal system contract.
   */
  framing: "wide" | "full" | "medium" | "close";

  /**
   * How the camera behaves over this span.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `move` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `move` for the clv focus diagnostics refusal system contract.
   */
  move: "static" | "follow" | "orbit" | "push-in" | "truck" | "whip";

  /**
   * What it frames/tracks.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `on` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `on` for the clv focus diagnostics refusal system contract.
   */
  on: IAutoMovieActionTarget;

  /**
   * What the lens holds sharp, when it differs from `on` (a rack focus onto the
   * approaching rider while the frame stays on the gate). Structural guide
   * INTENT for a diffusion/render host (#1187): the deterministic camera solve
   * never reads it, and it is not depth-of-field blur (that is diffusion's
   * job). Omit when the framed subject is the focus.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `focus` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `focus` for the clv focus diagnostics refusal system contract.
   */
  focus?: IAutoMovieActionTarget;

  /**
   * Lens intent in millimetres (full-frame equivalent: 24 wide, 50 normal, 85
   * portrait). Structural guide INTENT only (#1187): the scene camera's `fovY`
   * stays the geometric truth and this never changes the solve. Omit when the
   * lens is not a directorial choice.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `focalLength` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `focalLength` for the clv focus diagnostics refusal system contract.
   */
  focalLength?: number;
}
