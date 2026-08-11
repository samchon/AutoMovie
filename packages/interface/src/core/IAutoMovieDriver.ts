import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieChannel } from "./IAutoMovieChannel";
import { IAutoMovieDrivenCurve } from "./IAutoMovieDrivenCurve";

/**
 * A driver: a relationship that computes channels from other channels, the
 * joint-dependency layer that turns a bare imported model into a rig. The
 * engine resolves drivers in dependency order (a cached topological DAG) each
 * frame, after sampling tracks and before clamping constraints. This is the
 * layer glTF and USD deliberately omit (they bake the result); automovie keeps
 * it live, which is what makes it an engine rather than a model holder.
 *
 * Discriminated on `type`. The taxonomy is reduced from the established DCC
 * constraint/driver set (Blender/Maya): copy, aim, ik, parent, driven, spring.
 * (A pure value limit is a {@link IAutoMovieChannelLimit}, not a driver:
 * computation and restriction are kept separate.)
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieDriver` for the performance motion clip keytime interpolation system contract.
 * @author Samchon
 */
export type IAutoMovieDriver =
  | IAutoMovieCopyDriver
  | IAutoMovieAimDriver
  | IAutoMovieIKDriver
  | IAutoMovieParentDriver
  | IAutoMovieDrivenDriver
  | IAutoMovieSpringDriver;

/**
 * Copy a source node's transform components onto an owner (mirror, follow).
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieCopyDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieCopyDriver` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieCopyDriver {
  /**
   * Discriminator.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `type` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `type` for the performance motion clip keytime interpolation system contract.
   */
  type: "copy";
  /**
   * Node whose transform is written.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `owner` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `owner` for the performance motion clip keytime interpolation system contract.
   */
  owner: string;
  /**
   * Node whose transform is read.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `source` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `source` for the performance motion clip keytime interpolation system contract.
   */
  source: string;
  /**
   * Which components to copy.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `translation` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `translation` for the performance motion clip keytime interpolation system contract.
   */
  translation: boolean;
  /**
   * Whether the owner copies the source rotation.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies This field declares the corresponding transform dependency.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This field declares the corresponding transform dependency.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `rotation` for the performance motion clip keytime interpolation system contract.
   */
  rotation: boolean;
  /**
   * Whether the owner copies the source scale.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies This field declares the corresponding transform dependency.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This field declares the corresponding transform dependency.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `scale` for the performance motion clip keytime interpolation system contract.
   */
  scale: boolean;
  /**
   * Blend factor `[0, 1]` between the owner's prior value and the copied one.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `influence` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `influence` for the performance motion clip keytime interpolation system contract.
   */
  influence: number;
}

/**
 * Orient an owner so one of its axes points at a target (eyes, head, camera).
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieAimDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieAimDriver` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieAimDriver {
  /**
   * Discriminator.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `type` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `type` for the performance motion clip keytime interpolation system contract.
   */
  type: "aim";
  /**
   * Node to orient.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `owner` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `owner` for the performance motion clip keytime interpolation system contract.
   */
  owner: string;
  /**
   * Node to point at.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `target` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `target` for the performance motion clip keytime interpolation system contract.
   */
  target: string;
  /**
   * Owner-local axis aimed at the target (e.g. camera `(0,0,-1)`).
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `aimAxis` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `aimAxis` for the performance motion clip keytime interpolation system contract.
   */
  aimAxis: IAutoMovieVector3;
  /**
   * Owner-local up axis, kept aligned to `worldUp` to fix the remaining roll.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `upAxis` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `upAxis` for the performance motion clip keytime interpolation system contract.
   */
  upAxis: IAutoMovieVector3;
  /**
   * World reference up the `upAxis` aligns to.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `worldUp` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `worldUp` for the performance motion clip keytime interpolation system contract.
   */
  worldUp: IAutoMovieVector3;
  /**
   * Blend factor `[0, 1]`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `influence` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `influence` for the performance motion clip keytime interpolation system contract.
   */
  influence: number;
}

/**
 * Inverse kinematics: back-solve a bone chain so its tip reaches a goal.
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieIKDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieIKDriver` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieIKDriver {
  /**
   * Discriminator.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `type` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `type` for the performance motion clip keytime interpolation system contract.
   */
  type: "ik";
  /**
   * Bone chain, root → tip.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `chain` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `chain` for the performance motion clip keytime interpolation system contract.
   */
  chain: string[];
  /**
   * Node the chain tip reaches for.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `goal` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `goal` for the performance motion clip keytime interpolation system contract.
   */
  goal: string;
  /**
   * Pole/twist control for the solve plane, or `null`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `pole` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `pole` for the performance motion clip keytime interpolation system contract.
   */
  pole: IAutoMovieIKPole | null;
  /**
   * Solver. `twoBone` is the analytic, deterministic limb solver (build-first);
   * `ccd`/`fabrik` are iterative, for longer chains.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `solver` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `solver` for the performance motion clip keytime interpolation system contract.
   */
  solver: "twoBone" | "ccd" | "fabrik";
  /**
   * Iteration cap for iterative solvers (fixed for determinism); `null` for
   * `twoBone`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `iterations` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `iterations` for the performance motion clip keytime interpolation system contract.
   */
  iterations: number | null;
  /**
   * Blend factor `[0, 1]`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `influence` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `influence` for the performance motion clip keytime interpolation system contract.
   */
  influence: number;
}

/**
 * Pole target controlling which way an IK chain bends.
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieIKPole` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieIKPole` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieIKPole {
  /**
   * Node the pole points toward, or `null` to use only `angle`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `node` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `node` for the performance motion clip keytime interpolation system contract.
   */
  node: string | null;
  /**
   * Pole roll angle in degrees.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `angle` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `angle` for the performance motion clip keytime interpolation system contract.
   */
  angle: number;
}

/**
 * Parent an owner to another node as a relationship (Child-Of), per-component.
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieParentDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieParentDriver` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieParentDriver {
  /**
   * Discriminator.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `type` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `type` for the performance motion clip keytime interpolation system contract.
   */
  type: "parent";
  /**
   * Node that follows.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `owner` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `owner` for the performance motion clip keytime interpolation system contract.
   */
  owner: string;
  /**
   * Node followed.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `parent` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `parent` for the performance motion clip keytime interpolation system contract.
   */
  parent: string;
  /**
   * Which components of the parent frame are inherited.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `translation` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `translation` for the performance motion clip keytime interpolation system contract.
   */
  translation: boolean;
  /**
   * Whether the owner inherits the parent rotation.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies This field declares the corresponding transform dependency.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This field declares the corresponding transform dependency.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `rotation` for the performance motion clip keytime interpolation system contract.
   */
  rotation: boolean;
  /**
   * Whether the owner inherits the parent scale.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies This field declares the corresponding transform dependency.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This field declares the corresponding transform dependency.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `scale` for the performance motion clip keytime interpolation system contract.
   */
  scale: boolean;
}

/**
 * A driven relationship: one scalar channel computed from another (the
 * driven-key / range-map / mimic-joint archetype). A finger-curl slider driving
 * three phalanx joints is three drivers reading the same source.
 *
 * The default mapping is a linear range remap (`inRange` to `outRange`). Real
 * rigs, though, often need a nonlinear coupling: a finger that curls slowly
 * then snaps, or a corrective shape that only kicks in past a threshold. Supply
 * `curve` for that: named source/output control points, piecewise-linear
 * between them, the ends held. When present it supersedes
 * `inRange`/`outRange`/`clamp`.
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieDrivenDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieDrivenDriver` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieDrivenDriver {
  /**
   * Discriminator.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `type` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `type` for the performance motion clip keytime interpolation system contract.
   */
  type: "driven";
  /**
   * Channel that receives the computed value.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `output` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `output` for the performance motion clip keytime interpolation system contract.
   */
  output: IAutoMovieChannel;
  /**
   * Channel read as the driver value.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `source` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `source` for the performance motion clip keytime interpolation system contract.
   */
  source: IAutoMovieChannel;
  /**
   * Source value range `[in0, in1]` mapped onto `outRange` (linear default).
   * Required for the linear remap; **omit when `curve` is set**: the curve
   * supersedes it, so a nonlinear driver need not invent a dead range.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `inRange` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `inRange` for the performance motion clip keytime interpolation system contract.
   */
  inRange?: [number, number];
  /**
   * Output value range `[out0, out1]`. Linear remap only; omit with `curve`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `outRange` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `outRange` for the performance motion clip keytime interpolation system contract.
   */
  outRange?: [number, number];
  /**
   * Clamp the linear output to `outRange` outside `inRange`. Linear only; omit
   * with `curve` (and, when omitted on a linear driver, defaults to no clamp).
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `clamp` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `clamp` for the performance motion clip keytime interpolation system contract.
   */
  clamp?: boolean;
  /**
   * Optional nonlinear map: source/output control points sorted by source
   * value, with output interpolated piecewise-linearly between them and held
   * flat beyond the first/last point. When set it replaces the linear
   * `inRange`/`outRange` remap. `null` / omitted keeps the straight-line
   * default.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `curve` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `curve` for the performance motion clip keytime interpolation system contract.
   */
  curve?: IAutoMovieDrivenCurve | null;
}

/**
 * Secondary spring dynamics (hair, skirt, tail): the engine's archetype
 * integrated-but-deterministic driver, modelled on VRM SpringBone and stepped
 * with Verlet integration at the fixed timestep, so it replays identically.
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `IAutoMovieSpringDriver` as the portable data boundary for the motion channel dependencies requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieSpringDriver` for the performance motion clip keytime interpolation system contract.
 */
export interface IAutoMovieSpringDriver {
  /**
   * Discriminator.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `type` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `type` for the performance motion clip keytime interpolation system contract.
   */
  type: "spring";
  /**
   * Joint chain, root → tip, whose rotations the spring writes.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `chain` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `chain` for the performance motion clip keytime interpolation system contract.
   */
  chain: string[];
  /**
   * Restoring force toward the rest pose.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `stiffness` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `stiffness` for the performance motion clip keytime interpolation system contract.
   */
  stiffness: number;
  /**
   * Damping `[0, 1]`; inertia is scaled by `(1 - drag)`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `drag` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `drag` for the performance motion clip keytime interpolation system contract.
   */
  drag: number;
  /**
   * Gravity magnitude per step.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `gravityPower` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `gravityPower` for the performance motion clip keytime interpolation system contract.
   */
  gravityPower: number;
  /**
   * Gravity direction (unit).
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `gravityDir` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `gravityDir` for the performance motion clip keytime interpolation system contract.
   */
  gravityDir: IAutoMovieVector3;
  /**
   * Collision sphere radius of the joints, meters.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `hitRadius` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `hitRadius` for the performance motion clip keytime interpolation system contract.
   */
  hitRadius: number;
  /**
   * Reference node in whose frame inertia is evaluated (so the chain ignores
   * body locomotion while gravity stays world-space), or `null`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies Exposes `center` as the portable data boundary for the motion channel dependencies requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `center` for the performance motion clip keytime interpolation system contract.
   */
  center: string | null;
}
