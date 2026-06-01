import { IMoticaMotionSample, sampleMotion } from "@motica/engine";
import {
  IMoticaExpression,
  IMoticaMotion,
  IMoticaSkeleton,
} from "@motica/interface";

import { applyPose } from "./applyPose";
import { IMoticaModelObject } from "./buildModel";

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
export class MoticaPlayer {
  private lastSample: IMoticaMotionSample | null = null;

  public constructor(
    private readonly target: IMoticaModelObject,
    private readonly skeleton: IMoticaSkeleton,
    private motion: IMoticaMotion,
  ) {}

  /** Swap the clip being played (e.g. transition to a new motion). */
  public setMotion(motion: IMoticaMotion): void {
    this.motion = motion;
  }

  /** Sample the clip at `seconds` and apply the pose to the model. */
  public update(seconds: number): void {
    const sample = sampleMotion(this.motion, seconds);
    this.lastSample = sample;
    applyPose(this.target, sample.pose, this.skeleton);
  }

  /** The most recently sampled facial expression, or `null`. */
  public get lastExpression(): IMoticaExpression | null {
    return this.lastSample?.expression ?? null;
  }
}
