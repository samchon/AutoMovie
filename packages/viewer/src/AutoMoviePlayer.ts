import {
  IAutoMovieJointAxes,
  IAutoMovieMotionSample,
  IAutoMovieRestFrame,
  ISpringStep,
  clampPose,
  dampedSpring,
  sampleMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieExpression,
  IAutoMovieJointPose,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { applyExpression } from "./applyExpression";
import { applyPose } from "./applyPose";
import { IAutoMovieModelObject } from "./buildModel";

/**
 * Secondary-motion config: the joints that should lag/overshoot the animated
 * target (a tail, ears) and the spring that drives them.
 */
export interface IAutoMovieSpringConfig {
  joints: AutoMovieHumanoidBone[];
  stiffness: number;
  damping: number;
}

interface IAxisSprings {
  flexion: ISpringStep;
  abduction: ISpringStep;
  twist: ISpringStep;
}

/**
 * Drives a motion clip onto a built model: given an elapsed time it samples the
 * clip (via the engine's interpolation) and applies the resulting pose to the
 * model's bones.
 *
 * The player is pure with respect to time — call {@link update} with seconds
 * elapsed and it renders nothing itself; the host owns the animation loop (see
 * {@link mountViewer}). This keeps playback deterministic and testable.
 *
 * Expression output is sampled on the same frame clock and applied to morph
 * targets or imported-runtime expression sinks when the target provides them.
 *
 * @author Samchon
 */
export class AutoMoviePlayer {
  private lastSample: IAutoMovieMotionSample | null = null;
  private readonly springs = new Map<AutoMovieHumanoidBone, IAxisSprings>();
  private lastSeconds: number | null = null;
  private lastUpdateSeconds: number | null = null;

  public constructor(
    private readonly target: IAutoMovieModelObject,
    private readonly skeleton: IAutoMovieSkeleton,
    private motion: IAutoMovieMotion,
    private readonly jointAxes?: Partial<
      Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>
    >,
    /**
     * When true, clamp each sampled pose into the skeleton's ROM before it is
     * applied — and again AFTER the secondary-motion springs, which overshoot
     * by design (#1048) — so joints can no longer exceed their anatomical
     * limits.
     */
    private readonly clampToRom = false,
    /** Secondary-motion joints (tail, ears) driven with follow-through. */
    private readonly spring?: IAutoMovieSpringConfig,
    /**
     * Per-bone rest frames: read each sampled joint angle as **clinical** and
     * map it into the rig's rest-relative space before articulating (e.g.
     * abduction 180 raises either arm overhead regardless of side). Omit to
     * treat angles as raw rig-space, the historical behaviour.
     */
    private readonly restFrames?: Partial<
      Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
    >,
  ) {}

  /** Swap the clip being played (e.g. transition to a new motion). */
  public setMotion(motion: IAutoMovieMotion): void {
    this.motion = motion;
  }

  /** Sample the clip at `seconds` and apply the pose to the model. */
  public update(seconds: number): void {
    const deltaSeconds =
      this.lastUpdateSeconds === null
        ? 0
        : Math.max(0, seconds - this.lastUpdateSeconds);
    this.lastUpdateSeconds = seconds;
    const sample = sampleMotion(this.motion, seconds);
    this.lastSample = sample;
    let pose = this.clampToRom
      ? clampPose(sample.pose, this.skeleton)
      : sample.pose;
    if (this.spring !== undefined) {
      pose = this.applySpring(pose, seconds);
      // dampedSpring overshoots by design (ζ<1), so the pre-spring clamp
      // alone rendered poses past the promised limits (#1048). Re-clamp the
      // OUTPUT only — the spring state keeps its overshoot and converges
      // naturally; the render just never shows it outside the ROM.
      if (this.clampToRom) pose = clampPose(pose, this.skeleton);
    }
    applyPose(
      this.target,
      pose,
      this.skeleton,
      this.jointAxes,
      this.restFrames,
    );
    applyExpression(this.target, sample.expression);
    this.target.afterAutoMovieFrame?.({
      seconds,
      deltaSeconds,
      pose,
      expression: sample.expression,
    });
  }

  /**
   * Replace the spring joints' angles with a damped lag toward the animated
   * target, so a tail/ears trail and overshoot the body's motion instead of
   * snapping. Stateful across frames (velocity per axis); `dt` is clamped so a
   * stall or tab-switch can't explode the integrator.
   */
  private applySpring(pose: IAutoMoviePose, seconds: number): IAutoMoviePose {
    const cfg = this.spring!;
    const dt =
      this.lastSeconds === null
        ? 0
        : Math.min(Math.max(seconds - this.lastSeconds, 0), 1 / 15);
    this.lastSeconds = seconds;
    const targets = new Set(cfg.joints);
    const params = { stiffness: cfg.stiffness, damping: cfg.damping };

    const axis = (
      state: ISpringStep | undefined,
      target: number | null,
    ): { angle: number | null; next: ISpringStep } => {
      // A vanished axis DECAYS toward neutral instead of hard-resetting
      // (#1048): follow-through settles smoothly when a keyframe segment
      // stops authoring the joint, rather than popping to rest.
      //
      // dt=0 means "no time elapsed", NOT "never sprung" (#1098): a paused
      // host loop re-calling update(sameT), a backwards scrub (negative
      // delta clamps to 0), or a frozen-frame capture must HOLD the live
      // spring — value and velocity — on both the decay and tracking sides.
      // Conflating the two popped a mid-decay joint to rest (and zeroed its
      // state), and re-seeded a lagging joint AT its target.
      if (target === null) {
        if (state === undefined)
          return { angle: null, next: { value: 0, velocity: 0 } };
        if (dt === 0) return { angle: state.value, next: state };
        const r = dampedSpring(state.value, state.velocity, 0, params, dt);
        return { angle: r.value, next: r };
      }
      if (state === undefined)
        return { angle: target, next: { value: target, velocity: 0 } };
      if (dt === 0) return { angle: state.value, next: state };
      const r = dampedSpring(state.value, state.velocity, target, params, dt);
      return { angle: r.value, next: r };
    };

    const springJoint = (
      bone: AutoMovieHumanoidBone,
      j: IAutoMovieJointPose | null,
    ): IAutoMovieJointPose => {
      const prev = this.springs.get(bone);
      const f = axis(prev?.flexion, j?.flexion ?? null);
      const a = axis(prev?.abduction, j?.abduction ?? null);
      const t = axis(prev?.twist, j?.twist ?? null);
      this.springs.set(bone, {
        flexion: f.next,
        abduction: a.next,
        twist: t.next,
      });
      return { bone, flexion: f.angle, abduction: a.angle, twist: t.angle };
    };

    const joints: IAutoMovieJointPose[] = pose.joints.map((j) =>
      targets.has(j.bone) ? springJoint(j.bone, j) : j,
    );
    // A configured joint ABSENT from the pose still decays its follow-through
    // (#1048): the spring keeps integrating toward neutral instead of the
    // joint vanishing mid-swing.
    const present = new Set(pose.joints.map((j) => j.bone));
    for (const bone of cfg.joints) {
      if (present.has(bone) || !this.springs.has(bone)) continue;
      const decayed = springJoint(bone, null);
      if (
        decayed.flexion !== null ||
        decayed.abduction !== null ||
        decayed.twist !== null
      )
        joints.push(decayed);
    }
    return { skeleton: pose.skeleton, root: pose.root, joints };
  }

  /** The most recently sampled facial expression, or `null`. */
  public get lastExpression(): IAutoMovieExpression | null {
    return this.lastSample?.expression ?? null;
  }
}
