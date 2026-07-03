import {
  IAutoFilmJointAxes,
  IAutoFilmMotionSample,
  IAutoFilmRestFrame,
  ISpringStep,
  clampPose,
  dampedSpring,
  sampleMotion,
} from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmExpression,
  IAutoFilmJointPose,
  IAutoFilmMotion,
  IAutoFilmPose,
  IAutoFilmSkeleton,
} from "@autofilm/interface";

import { applyPose } from "./applyPose";
import { IAutoFilmModelObject } from "./buildModel";

/**
 * Secondary-motion config: the joints that should lag/overshoot the animated
 * target (a tail, ears) and the spring that drives them.
 */
export interface IAutoFilmSpringConfig {
  joints: AutoFilmHumanoidBone[];
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
 * Expression output is sampled and exposed via {@link lastExpression} but not
 * applied to geometry: blendshape application needs morph targets, which the
 * generated-primitive models do not have (it arrives with VRM import +
 * three-vrm).
 *
 * @author Samchon
 */
export class AutoFilmPlayer {
  private lastSample: IAutoFilmMotionSample | null = null;
  private readonly springs = new Map<AutoFilmHumanoidBone, IAxisSprings>();
  private lastSeconds: number | null = null;

  public constructor(
    private readonly target: IAutoFilmModelObject,
    private readonly skeleton: IAutoFilmSkeleton,
    private motion: IAutoFilmMotion,
    private readonly jointAxes?: Partial<
      Record<AutoFilmHumanoidBone, IAutoFilmJointAxes>
    >,
    /**
     * When true, clamp each sampled pose into the skeleton's ROM before it is
     * applied — joints can no longer exceed their anatomical limits.
     */
    private readonly clampToRom = false,
    /** Secondary-motion joints (tail, ears) driven with follow-through. */
    private readonly spring?: IAutoFilmSpringConfig,
    /**
     * Per-bone rest frames: read each sampled joint angle as **clinical** and
     * map it into the rig's rest-relative space before articulating (e.g.
     * abduction 180 raises either arm overhead regardless of side). Omit to
     * treat angles as raw rig-space, the historical behaviour.
     */
    private readonly restFrames?: Partial<
      Record<AutoFilmHumanoidBone, IAutoFilmRestFrame>
    >,
  ) {}

  /** Swap the clip being played (e.g. transition to a new motion). */
  public setMotion(motion: IAutoFilmMotion): void {
    this.motion = motion;
  }

  /** Sample the clip at `seconds` and apply the pose to the model. */
  public update(seconds: number): void {
    const sample = sampleMotion(this.motion, seconds);
    this.lastSample = sample;
    let pose = this.clampToRom
      ? clampPose(sample.pose, this.skeleton)
      : sample.pose;
    if (this.spring !== undefined) pose = this.applySpring(pose, seconds);
    applyPose(this.target, pose, this.skeleton, this.jointAxes, this.restFrames);
  }

  /**
   * Replace the spring joints' angles with a damped lag toward the animated
   * target, so a tail/ears trail and overshoot the body's motion instead of
   * snapping. Stateful across frames (velocity per axis); `dt` is clamped so a
   * stall or tab-switch can't explode the integrator.
   */
  private applySpring(pose: IAutoFilmPose, seconds: number): IAutoFilmPose {
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
      if (target === null)
        return { angle: null, next: { value: 0, velocity: 0 } };
      if (dt === 0 || state === undefined)
        return { angle: target, next: { value: target, velocity: 0 } };
      const r = dampedSpring(state.value, state.velocity, target, params, dt);
      return { angle: r.value, next: r };
    };

    const joints: IAutoFilmJointPose[] = pose.joints.map((j) => {
      if (!targets.has(j.bone)) return j;
      const prev = this.springs.get(j.bone);
      const f = axis(prev?.flexion, j.flexion);
      const a = axis(prev?.abduction, j.abduction);
      const t = axis(prev?.twist, j.twist);
      this.springs.set(j.bone, {
        flexion: f.next,
        abduction: a.next,
        twist: t.next,
      });
      return {
        bone: j.bone,
        flexion: f.angle,
        abduction: a.angle,
        twist: t.angle,
      };
    });
    return { skeleton: pose.skeleton, root: pose.root, joints };
  }

  /** The most recently sampled facial expression, or `null`. */
  public get lastExpression(): IAutoFilmExpression | null {
    return this.lastSample?.expression ?? null;
  }
}
