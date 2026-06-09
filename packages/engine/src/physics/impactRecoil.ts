import {
  AutoFilmHumanoidBone,
  IAutoFilmAngleRange,
  IAutoFilmJointPose,
  IAutoFilmPose,
  IAutoFilmSkeleton,
} from "@autofilm/interface";

/** A reactive deflection (degrees) the impact pushes a joint toward. */
export interface IAutoFilmRecoilPush {
  flexion?: number;
  abduction?: number;
  twist?: number;
}

const clampAxis = (value: number, range: IAutoFilmAngleRange | null): number =>
  range === null ? value : Math.max(range.min, Math.min(range.max, value));

/**
 * Build the **flinch** a struck body yields under an impact: the reactive
 * `push` (a deflection driven by the impulse) propagates down a `chain` of
 * bones — from the contact bone toward the body — losing strength by `falloff`
 * each link, and **each joint only yields as far as its ROM allows**
 * ({@link IAutoFilmJointConstraint}). So what the hit _does_ to the body is
 * bounded by the same joint ranges the engine already validates against: a neck
 * can only snap so far, a spine only bend so much.
 *
 * This is the ROM-aware half of collision response — the reactive force decides
 * how hard the push is, the joint ROM decides how far the body actually goes.
 * The caller maps an {@link IAutoFilmImpact}'s impulse to the `push` magnitude.
 *
 * @author Samchon
 */
export const impactRecoil = (
  push: IAutoFilmRecoilPush,
  chain: AutoFilmHumanoidBone[],
  skeleton: IAutoFilmSkeleton,
  falloff = 0.6,
): IAutoFilmPose => {
  const joints: IAutoFilmJointPose[] = chain.map((bone, i) => {
    const constraint =
      skeleton.bones.find((b) => b.bone === bone)?.constraint ?? null;
    const k = Math.pow(falloff, i);
    return {
      bone,
      flexion: clampAxis((push.flexion ?? 0) * k, constraint?.flexion ?? null),
      abduction: clampAxis(
        (push.abduction ?? 0) * k,
        constraint?.abduction ?? null,
      ),
      twist: clampAxis((push.twist ?? 0) * k, constraint?.twist ?? null),
    };
  });
  return { skeleton: skeleton.id, root: null, joints };
};
