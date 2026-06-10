import { AutoFilmExpressionPreset } from "../expression/AutoFilmExpressionPreset";
import { IAutoFilmVector3 } from "../geometry/IAutoFilmVector3";
import { AutoFilmHumanoidBone } from "../skeleton/AutoFilmHumanoidBone";

/**
 * Where an action points. Prefer a `node` (so the engine resolves live world
 * positions of moving actors) over a literal `point`; use `direction` /
 * `offscreen` for relative goals ("walk off to the left") so the model never
 * has to invent world coordinates.
 *
 * @author Samchon
 */
export type IAutoFilmActionTarget =
  | { kind: "node"; node: string }
  | { kind: "point"; point: IAutoFilmVector3 }
  /**
   * Several nodes at once — a camera frames their collective extent (a
   * two-shot, a crowd).
   */
  | { kind: "group"; nodes: string[] }
  /**
   * A heading relative to the actor's current facing (0 = ahead, +90 = its
   * left).
   */
  | { kind: "direction"; headingDeg: number }
  /** Exit/aim toward a frame edge ("off-screen left"). */
  | { kind: "offscreen"; edge: "left" | "right" | "forward" | "back" };

/**
 * A closed set of **gesture families** the engine has motion for. A closed enum
 * (not a free string) is deliberate: across many parallel generations, free
 * names drift ("wave"/"waving"/"hand-wave"); a fixed set converges. Use `note`
 * to specialise within a family ("strike" + note "jab", or with `custom` to
 * describe a one-off the engine should approximate).
 */
export type AutoFilmGestureKind =
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
  | "custom";

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
 * engine choose a natural length). The engine composes an actor's actions into
 * its performance clip (`arrangeMotion`, holding the last pose across gaps).
 * The camera is an actor too — its {@link IAutoFilmCameraAction}s are how it
 * moves.
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
  | IAutoFilmHoldAction
  | IAutoFilmCameraAction;

/** Fields every action shares. */
export interface IAutoFilmActionBase {
  /**
   * The scene-node id(s) performing this action (reuse ids from staging). A
   * list applies the **same** verb to several actors in **unison** — a chorus
   * line, a crowd, synchronised dancers — instead of repeating the action per
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
   * Loop the action's motion this many times within its span (default 1) — a
   * step repeated on the count, an idle sway. Cheaper than N near-identical
   * copies.
   */
  repeat?: number;
}

/** Travel across the floor on a gait — engine: locomotion + `travelMotion`. */
export interface IAutoFilmLocomoteAction extends IAutoFilmActionBase {
  verb: "locomote";

  gait: "walk" | "run" | "sprint" | "sneak" | "march";

  /** Where to go (the engine sizes the gait cycles to cover the distance). */
  to: IAutoFilmActionTarget;

  /** Face the travel direction (false keeps facing a separate look target). */
  faceTravel?: boolean;
}

/**
 * A whole-body gesture from the engine's motion vocabulary. Pick the closest
 * `kind`; refine with `note`. The engine owns the keyframes — keep this intent,
 * not animation.
 */
export interface IAutoFilmGestureAction extends IAutoFilmActionBase {
  verb: "gesture";

  kind: AutoFilmGestureKind;

  /**
   * Specialise the family ("jab" for `strike`, "roundhouse" for `kick`) or
   * describe a `custom` one.
   */
  note?: string;

  /** What the gesture is directed at (a strike's target, a wave's recipient). */
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
 * sword in a hand, a prop carried. Engine: `resolveAttachment`. (A _persistent_
 * mount, e.g. a rider on a horse, is better declared once in staging than
 * repeated as an action every shot.)
 */
export interface IAutoFilmAttachAction extends IAutoFilmActionBase {
  verb: "attachTo";

  parent: string;

  bone: AutoFilmHumanoidBone;
}

/**
 * Loose a projectile toward a target — engine: `projectileAt` +
 * `projectileSphereHit` (it leads a moving target). Because the **contact time
 * is computed by the engine**, the model cannot hand-time the target's
 * reaction; instead give `onHit`, and the engine schedules the target's `react`
 * at the **detected** moment of impact (the reactive event — "shoot him off his
 * horse" without knowing when the arrow lands).
 */
export interface IAutoFilmLaunchAction extends IAutoFilmActionBase {
  verb: "launch";

  /** What is thrown (a scene-node prop, or a named projectile). */
  projectile: string;

  /** Who/what it is aimed at. */
  at: IAutoFilmActionTarget;

  /** Launch speed (m/s). */
  speed: number;

  /** The reaction the engine applies to the struck target at the detected hit. */
  onHit?: { force: number; unbalance?: boolean };
}

/**
 * React to being struck — the engine resolves the impact (`resolveImpact`) and
 * the ROM-bounded flinch/knock-back (`impactRecoil`). Usually emitted by the
 * engine from a {@link IAutoFilmLaunchAction}'s `onHit`; author it directly for
 * a melee blow whose timing you control.
 */
export interface IAutoFilmReactAction extends IAutoFilmActionBase {
  verb: "react";

  /** Where the blow comes from. */
  from: IAutoFilmActionTarget;

  /** Force `[0,1]` (a graze vs. a knockout); the engine scales the impulse. */
  force: number;

  /** If it unseats/floors the actor (drives a fall within ROM + balance). */
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

/**
 * The camera is an actor; this is how it moves. A _list_ of camera actions
 * composes a move that changes mid-shot ("follow the charge, then hold static
 * on the fall"). The engine realises the framing/move against the target as a
 * camera-node clip (`cameraMotion` on the shot).
 */
export interface IAutoFilmCameraAction extends IAutoFilmActionBase {
  verb: "frame";

  /** How tight the framing is. */
  framing: "wide" | "full" | "medium" | "close";

  /** How the camera behaves over this span. */
  move: "static" | "follow" | "orbit" | "push-in" | "whip";

  /** What it frames/tracks. */
  on: IAutoFilmActionTarget;
}
