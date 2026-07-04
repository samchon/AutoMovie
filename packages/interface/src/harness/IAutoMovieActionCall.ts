import { automovieExpressionPreset } from "../expression/automovieExpressionPreset";
import { automovieBodyRegion } from "../skeleton/automovieBodyRegion";
import { automovieHumanoidBone } from "../skeleton/automovieHumanoidBone";
import { IautomovieDirectionTarget } from "./IautomovieDirectionTarget";
import { IautomovieGroupTarget } from "./IautomovieGroupTarget";
import { IautomovieNodeTarget } from "./IautomovieNodeTarget";
import { IautomovieOffscreenTarget } from "./IautomovieOffscreenTarget";
import { IautomovieOnHitReaction } from "./IautomovieOnHitReaction";
import { IautomoviePointTarget } from "./IautomoviePointTarget";

/**
 * Where an action points. Prefer a {@link IautomovieNodeTarget} (so the engine
 * resolves live world positions of moving actors) over a literal
 * {@link IautomoviePointTarget}; use {@link IautomovieDirectionTarget} /
 * {@link IautomovieOffscreenTarget} for relative goals ("walk off to the left")
 * so the model never has to invent world coordinates.
 *
 * @author Samchon
 */
export type IautomovieActionTarget =
  | IautomovieNodeTarget
  | IautomoviePointTarget
  | IautomovieGroupTarget
  | IautomovieDirectionTarget
  | IautomovieOffscreenTarget;

/**
 * A closed set of **gesture families** the engine has motion for. A closed enum
 * (not a free string) is deliberate: across many parallel generations, free
 * names drift ("wave"/"waving"/"hand-wave"); a fixed set converges. Use `note`
 * to specialise within a family ("strike" + note "jab"), or `custom` to
 * describe a one-off the engine should approximate.
 *
 * The set spans **both humanoid and creature** actors ??the project rigs horses
 * and cats on the same {@link automovieHumanoidBone} skeleton (spine = barrel,
 * the limbs retargeted), so the engine dispatches each kind to the actor's rig
 * vocabulary: `kick` is a leg snap on a fighter and a hind-leg lash on a horse;
 * `rear`/`buck`/`paw` only resolve on a quadruped rig. Idle creature poses with
 * no directed target (a cat's stretch/sit, a tail flick) are a `hold` plus an
 * `emote`, or a `custom` gesture.
 */
export type automovieGestureKind =
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
 * A single **action verb** an actor performs ??the _thin_ unit the model emits
 * and the engine **fattens into dense motion**. The model says _what_ ("jab",
 * "walk to the door", "look at her", "get knocked back"); the engine's
 * primitives (locomotion bakers, two-bone IK, aim, ROM clamp, spring,
 * projectile, impact) synthesise the per-frame {@link IautomovieMotion}. This is
 * the harness's leverage: a legible schema, rich movement.
 *
 * Discriminated on `verb`. Every action carries an actor and a placement on the
 * shot's local timeline (`start`, and a `duration` or `"auto"` to let the
 * engine choose a natural length). The engine composes an actor's actions into
 * its performance clip (`arrangeMotion`, holding the last pose across gaps).
 * The camera is an actor too ??its {@link IautomovieCameraAction}s are how it
 * moves.
 *
 * @author Samchon
 */
export type IautomovieActionCall =
  | IautomovieLocomoteAction
  | IautomovieGestureAction
  | IautomovieReachAction
  | IautomovieLookAtAction
  | IautomovieAttachAction
  | IautomovieLaunchAction
  | IautomovieReactAction
  | IautomovieEmoteAction
  | IautomovieHoldAction
  | IautomovieCameraAction;

/** Fields every action shares. */
export interface IautomovieActionBase {
  /**
   * The scene-node id(s) performing this action (reuse ids from staging). A
   * list applies the **same** verb to several actors in **unison** ??a chorus
   * line, a crowd, synchronised dancers ??instead of repeating the action per
   * actor (fewer tokens, no drift across parallel runs).
   */
  actor: string | string[];

  /** Seconds into the shot when it begins. */
  start: number;

  /**
   * Length in seconds, or `"auto"` to let the engine pick a natural duration (a
   * stride cadence, a punch's snap, a projectile's flight time).
   */
  duration: number | "auto";

  /**
   * Loop the action's motion this many times within its span (default 1) ??a
   * step repeated on the count, an idle sway. Cheaper than N near-identical
   * copies.
   */
  repeat?: number;

  /**
   * The body-region this action drives ({@link automovieBodyRegion}). Actions on
   * **disjoint** regions compose concurrently (walk while waving while
   * looking); actions sharing a region sequence. Omit to let the engine infer
   * the natural mask from the verb ??a `locomote` is `lowerBody`, a
   * `wave`/`reach` is `upperBody`, a `lookAt` is `head`, an `emote` is `face`.
   * Override only when the natural mask is wrong: a roundhouse `kick` is
   * `lowerBody` though it is a `gesture`; a `jump` or a knockdown `react` is
   * `fullBody`. Camera (`frame`) and `attachTo` actions ignore it.
   */
  region?: automovieBodyRegion;
}

/**
 * Travel across the floor on a gait ??engine: locomotion + `travelMotion`. The
 * gait names are bipedal, but the engine maps them onto the actor's rig: on a
 * quadruped `run`/`sprint` become a gallop, `sneak` a stalk/prowl, `walk` the
 * four-beat walk.
 */
export interface IautomovieLocomoteAction extends IautomovieActionBase {
  verb: "locomote";

  gait: "walk" | "run" | "sprint" | "sneak" | "march";

  /** Where to go (the engine sizes the gait cycles to cover the distance). */
  to: IautomovieActionTarget;

  /** Face the travel direction (false keeps facing a separate look target). */
  faceTravel?: boolean;
}

/**
 * A whole-body gesture from the engine's motion vocabulary. Pick the closest
 * `kind`; refine with `note`. The engine owns the keyframes ??keep this intent,
 * not animation.
 */
export interface IautomovieGestureAction extends IautomovieActionBase {
  verb: "gesture";

  kind: automovieGestureKind;

  /**
   * Specialise the family ("jab" for `strike`, "roundhouse" for `kick`) or
   * describe a `custom` one.
   */
  note?: string;

  /** What the gesture is directed at (a strike's target, a wave's recipient). */
  at?: IautomovieActionTarget;
}

/**
 * Reach a hand to a target ??engine: two-bone IK (`solveTwoBoneIK`). A
 * humanoid-rig verb (left/right arm); a quadruped pawing at something uses
 * `gesture` (`paw`) instead.
 */
export interface IautomovieReachAction extends IautomovieActionBase {
  verb: "reach";

  hand: "left" | "right";

  to: IautomovieActionTarget;
}

/** Turn the head/eyes to track a target ??engine: `aimRotation` look-at. */
export interface IautomovieLookAtAction extends IautomovieActionBase {
  verb: "lookAt";

  to: IautomovieActionTarget;
}

/**
 * Rigidly couple this actor to another node's bone for the action's span ??a
 * sword in a hand, a prop carried. Engine: `resolveAttachment`. (A _persistent_
 * mount, e.g. a rider on a horse, is better declared once in staging than
 * repeated as an action every shot.)
 */
export interface IautomovieAttachAction extends IautomovieActionBase {
  verb: "attachTo";

  parent: string;

  bone: automovieHumanoidBone;
}

/**
 * Loose a projectile toward a target ??engine: `projectileAt` +
 * `projectileSphereHit` (it leads a moving target). Because the **contact time
 * is computed by the engine**, the model cannot hand-time the target's
 * reaction; instead give `onHit`, and the engine schedules the target's `react`
 * at the **detected** moment of impact (the reactive event ??"shoot him off his
 * horse" without knowing when the arrow lands).
 */
export interface IautomovieLaunchAction extends IautomovieActionBase {
  verb: "launch";

  /** What is thrown (a scene-node prop, or a named projectile). */
  projectile: string;

  /** Who/what it is aimed at. */
  at: IautomovieActionTarget;

  /** Launch speed (m/s). */
  speed: number;

  /** The reaction the engine applies to the struck target at the detected hit. */
  onHit?: IautomovieOnHitReaction;
}

/**
 * React to being struck ??the engine resolves the impact (`resolveImpact`) and
 * the ROM-bounded flinch/knock-back (`impactRecoil`). Usually emitted by the
 * engine from a {@link IautomovieLaunchAction}'s `onHit`; author it directly for
 * a melee blow whose timing you control.
 */
export interface IautomovieReactAction extends IautomovieActionBase {
  verb: "react";

  /** Where the blow comes from. */
  from: IautomovieActionTarget;

  /** Force `[0,1]` (a graze vs. a knockout); the engine scales the impulse. */
  force: number;

  /** If it unseats/floors the actor (drives a fall within ROM + balance). */
  unbalance?: boolean;
}

/** Play a facial expression ??engine: blendshape/expression channels. */
export interface IautomovieEmoteAction extends IautomovieActionBase {
  verb: "emote";

  preset: automovieExpressionPreset;

  /** Strength `[0,1]`. */
  intensity: number;
}

/** Hold the current pose (a beat of stillness) for the duration. */
export interface IautomovieHoldAction extends IautomovieActionBase {
  verb: "hold";

  duration: number;
}

/**
 * The camera is an actor; this is how it moves. A _list_ of camera actions
 * composes a move that changes mid-shot ("follow the charge, then hold static
 * on the fall"). The engine realises the framing/move against the target as a
 * camera-node clip (`cameraMotion` on the shot).
 */
export interface IautomovieCameraAction extends IautomovieActionBase {
  verb: "frame";

  /** How tight the framing is. */
  framing: "wide" | "full" | "medium" | "close";

  /** How the camera behaves over this span. */
  move: "static" | "follow" | "orbit" | "push-in" | "whip";

  /** What it frames/tracks. */
  on: IautomovieActionTarget;
}
