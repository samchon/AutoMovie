import { IautomovieVector3 } from "../geometry/IautomovieVector3";
import { IautomovieChannel } from "./IautomovieChannel";

/**
 * A driver: a relationship that computes channels from other channels ??the
 * joint-dependency layer that turns a bare imported model into a rig. The
 * engine resolves drivers in dependency order (a cached topological DAG) each
 * frame, after sampling tracks and before clamping constraints. This is the
 * layer glTF and USD deliberately omit (they bake the result); automovie keeps
 * it live, which is what makes it an engine rather than a model holder.
 *
 * Discriminated on `type`. The taxonomy is reduced from the established DCC
 * constraint/driver set (Blender/Maya): copy, aim, ik, parent, driven, spring.
 * (A pure value limit is a {@link IautomovieChannelLimit}, not a driver ?? * computation and restriction are kept separate.)
 *
 * @author Samchon
 */
export type IautomovieDriver =
  | IautomovieCopyDriver
  | IautomovieAimDriver
  | IautomovieIKDriver
  | IautomovieParentDriver
  | IautomovieDrivenDriver
  | IautomovieSpringDriver;

/** Copy a source node's transform components onto an owner (mirror, follow). */
export interface IautomovieCopyDriver {
  /** Discriminator. */
  type: "copy";
  /** Node whose transform is written. */
  owner: string;
  /** Node whose transform is read. */
  source: string;
  /** Which components to copy. */
  translation: boolean;
  rotation: boolean;
  scale: boolean;
  /** Blend factor `[0, 1]` between the owner's prior value and the copied one. */
  influence: number;
}

/** Orient an owner so one of its axes points at a target (eyes, head, camera). */
export interface IautomovieAimDriver {
  /** Discriminator. */
  type: "aim";
  /** Node to orient. */
  owner: string;
  /** Node to point at. */
  target: string;
  /** Owner-local axis aimed at the target (e.g. camera `(0,0,-1)`). */
  aimAxis: IautomovieVector3;
  /** Owner-local up axis, kept aligned to `worldUp` to fix the remaining roll. */
  upAxis: IautomovieVector3;
  /** World reference up the `upAxis` aligns to. */
  worldUp: IautomovieVector3;
  /** Blend factor `[0, 1]`. */
  influence: number;
}

/** Inverse kinematics: back-solve a bone chain so its tip reaches a goal. */
export interface IautomovieIKDriver {
  /** Discriminator. */
  type: "ik";
  /** Bone chain, root ??tip. */
  chain: string[];
  /** Node the chain tip reaches for. */
  goal: string;
  /** Pole/twist control for the solve plane, or `null`. */
  pole: IautomovieIKPole | null;
  /**
   * Solver. `twoBone` is the analytic, deterministic limb solver (build-first);
   * `ccd`/`fabrik` are iterative, for longer chains.
   */
  solver: "twoBone" | "ccd" | "fabrik";
  /**
   * Iteration cap for iterative solvers (fixed for determinism); `null` for
   * `twoBone`.
   */
  iterations: number | null;
  /** Blend factor `[0, 1]`. */
  influence: number;
}

/** Pole target controlling which way an IK chain bends. */
export interface IautomovieIKPole {
  /** Node the pole points toward, or `null` to use only `angle`. */
  node: string | null;
  /** Pole roll angle in degrees. */
  angle: number;
}

/** Parent an owner to another node as a relationship (Child-Of), per-component. */
export interface IautomovieParentDriver {
  /** Discriminator. */
  type: "parent";
  /** Node that follows. */
  owner: string;
  /** Node followed. */
  parent: string;
  /** Which components of the parent frame are inherited. */
  translation: boolean;
  rotation: boolean;
  scale: boolean;
}

/**
 * A driven relationship: one channel computed from another (the driven-key /
 * range-map / mimic-joint archetype). A finger-curl slider driving three
 * phalanx joints is three drivers reading the same source.
 *
 * The default mapping is a **linear** range remap (`inRange ??outRange`). Real
 * rigs, though, often need a **nonlinear** coupling ??a finger that curls
 * slowly then snaps, a corrective shape that only kicks in past a threshold
 * (Maya Set Driven Key curves, MJCF's `polycoef`). Supply `curve` for that: a
 * sorted set of `(x, y)` control points, piecewise-linear between them, the
 * ends held. When present it **supersedes** `inRange`/`outRange`/`clamp`.
 */
export interface IautomovieDrivenDriver {
  /** Discriminator. */
  type: "driven";
  /** Channel that receives the computed value. */
  output: IautomovieChannel;
  /** Channel read as the driver value. */
  source: IautomovieChannel;
  /** Source value range `[in0, in1]` mapped onto `outRange` (linear default). */
  inRange: [number, number];
  /** Output value range `[out0, out1]`. */
  outRange: [number, number];
  /** Clamp the output to `outRange` outside `inRange`. */
  clamp: boolean;
  /**
   * Optional **nonlinear** mapping: `(source, output)` control points sorted by
   * source value, with the output interpolated piecewise-linearly between them
   * and held flat beyond the first/last point. When set it replaces the linear
   * `inRange`/`outRange` remap ??the way a real driven key bends. `null` /
   * omitted keeps the straight-line default.
   */
  curve?: [number, number][] | null;
}

/**
 * Secondary spring dynamics (hair, skirt, tail) ??the engine's archetype
 * integrated-but-deterministic driver, modelled on VRM SpringBone and stepped
 * with Verlet integration at the fixed timestep, so it replays identically.
 */
export interface IautomovieSpringDriver {
  /** Discriminator. */
  type: "spring";
  /** Joint chain, root ??tip, whose rotations the spring writes. */
  chain: string[];
  /** Restoring force toward the rest pose. */
  stiffness: number;
  /** Damping `[0, 1]`; inertia is scaled by `(1 - drag)`. */
  drag: number;
  /** Gravity magnitude per step. */
  gravityPower: number;
  /** Gravity direction (unit). */
  gravityDir: IautomovieVector3;
  /** Collision sphere radius of the joints, meters. */
  hitRadius: number;
  /**
   * Reference node in whose frame inertia is evaluated (so the chain ignores
   * body locomotion while gravity stays world-space), or `null`.
   */
  center: string | null;
}
