import { IAutoMovieGait } from "../motion/IAutoMovieGait";
import { IAutoMovieChannel } from "./IAutoMovieChannel";
import { IAutoMovieChannelLimit } from "./IAutoMovieChannelLimit";
import { IAutoMovieDriver } from "./IAutoMovieDriver";

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
 * runtime, never a release. This is the mechanism that keeps automovie additive
 * and mod-friendly, and the reason the model is expressed as interfaces rather
 * than classes. Adding a control with a default is a non-breaking change (old
 * data still resolves), so profiles version only on removals/type changes.
 *
 * @author Samchon
 */
export interface IAutoMovieProfile {
  /** Stable id. */
  id: string;

  /** Profile name (e.g. `"humanoid"`, `"hinge"`). */
  name: string;

  /** The named controls this profile exposes. */
  controls: IAutoMovieProfileControl[];

  /**
   * Standard drivers that resolve the controls (eye look-at, finger curl,
   * springs).
   */
  drivers: IAutoMovieDriver[];

  /** Standard value constraints (the profile's default ROM / limits). */
  limits: IAutoMovieChannelLimit[];

  /**
   * The characteristic gaits this profile's body performs
   * ({@link IAutoMovieGait}) — a horse profile's walk/trot/canter/gallop, a
   * humanoid's walk/run. The engine binds them onto a concrete skeleton to
   * synthesise locomotion, so the same abstract "move" resolves to each body's
   * own gait. Omitted/empty for a profile that does not locomote (a door, a
   * prop).
   */
  gaits?: IAutoMovieGait[];
}

/**
 * One application of a profile to a concrete scene/model subtree.
 *
 * The profile is reusable data; a binding says where that profile lives this
 * time. Multiple characters can share one humanoid profile while each binding
 * maps the profile controls/bones onto that character's own node ids.
 *
 * @author Samchon
 */
export interface IAutoMovieProfileBinding {
  /** Id of the {@link IAutoMovieProfile} being applied. */
  profile: string;

  /** Root node id of the subtree this profile controls. */
  root: string;

  /**
   * Optional instance name for multiple applications of the same profile on one
   * model, e.g. `"hero"` / `"villain"` or `"leftDoor"` / `"rightDoor"`.
   */
  instanceName: string | null;

  /**
   * Profile semantic key -> concrete node id. For a humanoid this is equivalent
   * to VRM/HumanIK characterization (`"hips" -> "mixamorig:Hips"`); for a prop
   * it can map controls such as `"hinge"` to a door pivot node.
   */
  boneMap: Record<string, string>;
}

/**
 * One named control a profile exposes — the abstract handle an LLM or an editor
 * UI drives, mapped onto a concrete channel.
 */
export interface IAutoMovieProfileControl {
  /** Semantic control name, e.g. `"leftElbow.flexion"` or `"body.waistWidth"`. */
  name: string;

  /** The channel this control writes. */
  channel: IAutoMovieChannel;

  /** Default value, one element per channel component. */
  default: number[];

  /**
   * Category this control belongs to (e.g. `"face"`, `"legs"`), or `null`. Lets
   * an editor group controls and reveal detail progressively (beginner mode vs
   * per-part panels) rather than showing hundreds of sliders at once.
   */
  group: string | null;
}
