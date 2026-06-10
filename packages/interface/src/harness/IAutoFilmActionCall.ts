import { AutoFilmExpressionPreset } from "../expression/AutoFilmExpressionPreset";
import { IAutoFilmVector3 } from "../geometry/IAutoFilmVector3";
import { AutoFilmHumanoidBone } from "../skeleton/AutoFilmHumanoidBone";

/**
 * Where an action points: a placed scene node (by id) or a world point. Most
 * verbs accept a target so the model can say "walk **to the door**" or "look
 * **at the other knight**" without computing coordinates.
 */
export type IAutoFilmActionTarget =
  | { kind: "node"; node: string }
  | { kind: "point"; point: IAutoFilmVector3 };

/**
 * A single **action verb** an actor performs — the _thin_ unit the model emits
 * and the engine **fattens into dense motion**. The model says _what_ ("jab",
 * "walk to the door", "look at her", "get knocked back"); the engine's
 * primitives (locomotion bakers, two-bone IK, aim, ROM clamp, spring,
 * projectile, impact) synthesise the per-frame {@link IAutoFilmMotion}. This is
 * the harness's leverage: a legible schema, rich movement.
 *
 * Discriminated on `verb`. Every action carries an actor and a placement on the
 * shot's local timeline (`start`, and a `duration` or `"auto"` to let the
 * engine choose a natural length). The list of an actor's actions in a shot
 * composes — via `sequenceMotion` — into that actor's performance clip.
 *
 * @author Samchon
 */
export type IAutoFilmActionCall =
  | IAutoFilmLocomoteAction
  | IAutoFilmGestureAction
  | IAutoFilmReachAction
  | IAutoFilmLookAtAction
  | IAutoFilmAttachAction
  | IAutoFilmLaunchAction
  | IAutoFilmReactAction
  | IAutoFilmEmoteAction
  | IAutoFilmHoldAction;

/** Fields every action shares. */
export interface IAutoFilmActionBase {
  /** The scene node performing this action. */
  actor: string;
  /** Seconds into the shot when it begins. */
  start: number;
  /**
   * Length in seconds, or `"auto"` to let the engine pick a natural duration (a
   * stride cadence, a punch's snap, the flight time of a projectile).
   */
  duration: number | "auto";
}

/** Travel across the floor on a chosen gait — engine: locomotion + travelMotion. */
export interface IAutoFilmLocomoteAction extends IAutoFilmActionBase {
  verb: "locomote";
  /** The gait. */
  gait: "walk" | "run" | "sprint" | "sneak" | "march";
  /** Where to go (the engine paces the cycle to cover the distance). */
  to: IAutoFilmActionTarget;
  /** Face the travel direction (false to keep facing a separate target). */
  faceTravel?: boolean;
}

/**
 * A whole-body gesture from the motion vocabulary — a punch, a kick, a wave, a
 * bow. The engine maps the named gesture (optionally aimed at a target) to a
 * pose/clip. Keep the name descriptive; the engine owns the keyframes.
 */
export interface IAutoFilmGestureAction extends IAutoFilmActionBase {
  verb: "gesture";
  /** E.g. "jab", "cross", "roundhouse", "wave", "bow", "draw-bow". */
  name: string;
  /**
   * Optional thing the gesture is directed at (a strike's target, a wave's
   * recipient).
   */
  at?: IAutoFilmActionTarget;
}

/** Reach a hand to a target — engine: two-bone IK (`solveTwoBoneIK`). */
export interface IAutoFilmReachAction extends IAutoFilmActionBase {
  verb: "reach";
  hand: "left" | "right";
  to: IAutoFilmActionTarget;
}

/** Turn the head/eyes to track a target — engine: `aimRotation` look-at. */
export interface IAutoFilmLookAtAction extends IAutoFilmActionBase {
  verb: "lookAt";
  to: IAutoFilmActionTarget;
}

/**
 * Rigidly couple this actor to another node's bone for the action's span — a
 * rider on a saddle, a sword in a hand. Engine: `resolveAttachment`.
 */
export interface IAutoFilmAttachAction extends IAutoFilmActionBase {
  verb: "attachTo";
  /** The parent node to ride. */
  parent: string;
  /** The parent bone (e.g. a horse's `spine` saddle). */
  bone: AutoFilmHumanoidBone;
}

/**
 * Loose a projectile (arrow, ball, spear) from the actor toward a target —
 * engine: `projectileAt` + `projectileSphereHit`. A hit detected against the
 * target may emit a {@link IAutoFilmReactAction} on it (the reactive event).
 */
export interface IAutoFilmLaunchAction extends IAutoFilmActionBase {
  verb: "launch";
  /** What is thrown (a scene node prop, or a named projectile). */
  projectile: string;
  /** Who/what it is aimed at. */
  at: IAutoFilmActionTarget;
  /** Launch speed (m/s); the engine leads a moving target. */
  speed: number;
}

/**
 * React to being struck — the engine resolves the impact (`resolveImpact`) and
 * the ROM-bounded flinch/knock-back (`impactRecoil`). The model only says "I
 * get hit, hard, from there"; the engine decides bounce/embed/knock-back and
 * how far the body yields.
 */
export interface IAutoFilmReactAction extends IAutoFilmActionBase {
  verb: "react";
  /** Where the blow comes from. */
  from: IAutoFilmActionTarget;
  /**
   * Rough force `[0,1]` (a graze vs. a knockout); the engine scales the
   * impulse.
   */
  force: number;
  /** If the reaction unseats/floors the actor (drives a fall). */
  unbalance?: boolean;
}

/** Play a facial expression — engine: blendshape/expression channels. */
export interface IAutoFilmEmoteAction extends IAutoFilmActionBase {
  verb: "emote";
  preset: AutoFilmExpressionPreset;
  /** Strength `[0,1]`. */
  intensity: number;
}

/** Hold the current pose (a beat of stillness) for the duration. */
export interface IAutoFilmHoldAction extends IAutoFilmActionBase {
  verb: "hold";
  duration: number;
}
