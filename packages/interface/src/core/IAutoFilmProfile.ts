import { IAutoFilmChannel } from "./IAutoFilmChannel";
import { IAutoFilmChannelLimit } from "./IAutoFilmChannelLimit";
import { IAutoFilmDriver } from "./IAutoFilmDriver";

/**
 * A profile (= USD applied schema): a declarative capability layered onto a
 * subtree of the node graph that gives it a domain semantics — a named set of
 * controls, the standard drivers that resolve them, and the constraints that
 * bound them. The humanoid profile is the first instance (a bone-name → control
 * map plus anatomical ROM, eye look-at, finger curl); a door profile is a
 * one-DOF hinge; a costume profile is a cloth/spring rig.
 *
 * Profiles are **data, not code**: a new rig kind (or a community mod — a new
 * preset, hair pack, ethnicity) ships as a profile descriptor, registered at
 * runtime, never a release. This is the mechanism that keeps autofilm additive
 * and mod-friendly, and the reason the model is expressed as interfaces rather
 * than classes. Adding a control with a default is a non-breaking change (old
 * data still resolves), so profiles version only on removals/type changes.
 *
 * @author Samchon
 */
export interface IAutoFilmProfile {
  /** Stable id. */
  id: string;

  /** Profile name (e.g. `"humanoid"`, `"hinge"`). */
  name: string;

  /** The named controls this profile exposes. */
  controls: IAutoFilmProfileControl[];

  /**
   * Standard drivers that resolve the controls (eye look-at, finger curl,
   * springs).
   */
  drivers: IAutoFilmDriver[];

  /** Standard value constraints (the profile's default ROM / limits). */
  limits: IAutoFilmChannelLimit[];
}

/**
 * One named control a profile exposes — the abstract handle an LLM or an editor
 * UI drives, mapped onto a concrete channel.
 */
export interface IAutoFilmProfileControl {
  /** Semantic control name, e.g. `"leftElbow.flexion"` or `"body.waistWidth"`. */
  name: string;

  /** The channel this control writes. */
  channel: IAutoFilmChannel;

  /** Default value, one element per channel component. */
  default: number[];

  /**
   * Category this control belongs to (e.g. `"face"`, `"legs"`), or `null`. Lets
   * an editor group controls and reveal detail progressively (beginner mode vs
   * per-part panels) rather than showing hundreds of sliders at once.
   */
  group: string | null;
}
