import { IAutoMovieGait } from "../motion/IAutoMovieGait";
import { IAutoMovieProfileTrait } from "./IAutoMovieCapability";
import { IAutoMovieChannel } from "./IAutoMovieChannel";
import { IAutoMovieChannelLimit } from "./IAutoMovieChannelLimit";
import { IAutoMovieDriver } from "./IAutoMovieDriver";

/**
 * A profile (= USD applied schema): a declarative capability layered onto a
 * subtree of the node graph that gives it a domain semantics: a named set of
 * controls, the standard drivers that resolve them, and the constraints that
 * bound them. The humanoid profile is the first instance (a bone-name → control
 * map plus anatomical ROM, eye look-at, finger curl); a door profile is a
 * one-DOF hinge; a costume profile is a cloth/spring rig.
 *
 * Profiles are **data, not code**: a new rig kind (or a community mod: a new
 * preset, hair pack, ethnicity) ships as a profile descriptor, registered at
 * runtime, never a release. This is the mechanism that keeps automovie additive
 * and mod-friendly, and the reason the model is expressed as interfaces rather
 * than classes. Adding a control with a default is a non-breaking change (old
 * data still resolves), so profiles version only on removals/type changes.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `IAutoMovieProfile` as the portable data boundary for actor rig controls and their driver dependencies.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `IAutoMovieProfile` as the open profile that owns semantic controls, limits, and driver graphs.
 * @author Samchon
 */
export interface IAutoMovieProfile {
  /**
   * Stable id.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `id` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `id` for the performance rig ROM control driver graph system contract.
   */
  id: string;

  /**
   * Profile name (e.g. `"humanoid"`, `"hinge"`).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `name` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `name` for the performance rig ROM control driver graph system contract.
   */
  name: string;

  /**
   * The named controls this profile exposes.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `controls` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `controls` for the performance rig ROM control driver graph system contract.
   */
  controls: IAutoMovieProfileControl[];

  /**
   * Standard drivers that resolve the controls (eye look-at, finger curl,
   * springs).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `drivers` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `drivers` for the performance rig ROM control driver graph system contract.
   */
  drivers: IAutoMovieDriver[];

  /**
   * Standard value constraints (the profile's default ROM / limits).
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `limits` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `limits` for the performance rig ROM control driver graph system contract.
   */
  limits: IAutoMovieChannelLimit[];

  /**
   * Typed semantic capabilities this profile proves.
   *
   * Omitted is equivalent to an empty list. An engine verb must find the
   * matching trait here; model names and free-form capability labels never
   * grant permission. Locomotion remains the existing `gaits` capability and is
   * not duplicated as a second trait marker.
   *
   * @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery Exposes `traits` as the typed distinction between implemented capabilities and unavailable gaps.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Types `traits` as explicit capability state rather than inferred content.
   */
  traits?: IAutoMovieProfileTrait[];

  /**
   * The characteristic gaits this profile's body performs
   * ({@link IAutoMovieGait}): a horse profile's walk/trot/canter/gallop, a
   * humanoid's walk/run. The engine binds them onto a concrete skeleton to
   * synthesise locomotion, so the same abstract "move" resolves to each body's
   * own gait. Omitted/empty for a profile that does not locomote (a door, a
   * prop).
   *
   * This field is core's one upward reference (`core → motion`), kept
   * deliberately: a gait names humanoid bones and easing curves, so moving it
   * into core would drag `core → skeleton` and a second `core → motion` edge
   * along, replacing one documented type-only reference on an optional field
   * with two worse ones. The dependency is acyclic and confined to this field.
   *
   * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Exposes `gaits` as the declared gait table owned by the profile.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Types `gaits` as open profile data for deterministic procedural locomotion.
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
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `IAutoMovieProfileBinding` as the semantic-profile-to-concrete-node mapping boundary.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `IAutoMovieProfileBinding` as an authoritative semantic rig binding.
 * @author Samchon
 */
export interface IAutoMovieProfileBinding {
  /**
   * Id of the {@link IAutoMovieProfile} being applied.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `profile` as the stable semantic profile identity selected by the binding.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `profile` as the identity of an open semantic rig mapping.
   */
  profile: string;

  /**
   * Root node id of the subtree this profile controls.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `root` as the concrete subtree receiving the semantic mapping.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `root` as the concrete rig binding root.
   */
  root: string;

  /**
   * Optional instance name for multiple applications of the same profile on one
   * model, e.g. `"hero"` / `"villain"` or `"leftDoor"` / `"rightDoor"`.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `instanceName` as the stable identity for one application of a semantic mapping.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `instanceName` as a distinct semantic mapping instance.
   */
  instanceName: string | null;

  /**
   * Profile semantic key -> concrete node id. For a humanoid this is equivalent
   * to VRM/HumanIK characterization (`"hips" -> "mixamorig:Hips"`); for a prop
   * it can map controls such as `"hinge"` to a door pivot node.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-humanoid-mapping Exposes `boneMap` as the explicit semantic-role-to-model-node mapping.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-semantic-joint-mapping Types `boneMap` as authoritative mapping data rather than a name guess.
   */
  boneMap: Record<string, string>;
}

/**
 * One named control a profile exposes: the abstract handle an LLM or an editor
 * UI drives, mapped onto a concrete channel.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `IAutoMovieProfileControl` as the portable data boundary for the actor rig control drivers requirement.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `IAutoMovieProfileControl` for the performance rig ROM control driver graph system contract.
 */
export interface IAutoMovieProfileControl {
  /**
   * Semantic control name, e.g. `"leftElbow.flexion"` or `"body.waistWidth"`.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `name` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `name` for the performance rig ROM control driver graph system contract.
   */
  name: string;

  /**
   * The channel this control writes.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `channel` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `channel` for the performance rig ROM control driver graph system contract.
   */
  channel: IAutoMovieChannel;

  /**
   * Default value, one element per channel component.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `default` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `default` for the performance rig ROM control driver graph system contract.
   */
  default: number[];

  /**
   * Category this control belongs to (e.g. `"face"`, `"legs"`), or `null`. Lets
   * an editor group controls and reveal detail progressively (beginner mode vs
   * per-part panels) rather than showing hundreds of sliders at once.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-rig-control-drivers Exposes `group` as the portable data boundary for the actor rig control drivers requirement.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Types `group` for the performance rig ROM control driver graph system contract.
   */
  group: string | null;
}
