import { AutoMovieHumanoidBone, IAutoMovieVector3 } from "@automovie/interface";

import { IAutoMovieResolvedBone } from "../kinematics/resolvePose";
import { IAutoMovieFootLeg, IAutoMovieFootPlant } from "./plantFeet";

/**
 * The one stance predicate: `true` on every frame where the effector resolved
 * and sat at or below `groundAt(x, z) + tolerance`, mirroring
 * {@link validateGroundContact}'s contact test.
 *
 * It is extracted so the two consumers cannot disagree about what "planted"
 * means: {@link pinStanceTargets} groups the mask into stance runs for the
 * ground-IK pass, while the retarget contact pass reads it frame by frame to
 * decide which frames carry a contact worth preserving.
 *
 * @author Samchon
 */
export const contactMask = (props: {
  /** End-effector bone judged against the ground. */
  effector: AutoMovieHumanoidBone;
  /** Per-frame FK bone lookups. */
  resolved: ReadonlyArray<
    ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieResolvedBone>
  >;
  /** Ground height at a plan position. */
  groundAt: (x: number, z: number) => number;
  /** Contact tolerance above the ground counted as stance. */
  tolerance: number;
}): boolean[] =>
  props.resolved.map((map) => {
    const p = map.get(props.effector)?.worldPosition;
    return p !== undefined && p.y <= props.groundAt(p.x, p.z) + props.tolerance;
  });

/**
 * The stance detection + pinning stage of {@link plantStanceFeet}: judge every
 * frame's feet against the ground height source, group contiguous contact into
 * stance runs, and pin each run to its start contact. Returns the plants plus
 * the per-frame solve targets the re-key stage consumes.
 *
 * @author Samchon
 */
export const pinStanceTargets = (props: {
  /** Legs whose feet are planted. */
  legs: readonly IAutoMovieFootLeg[];
  /** Per-frame FK bone lookups. */
  resolved: ReadonlyArray<
    ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieResolvedBone>
  >;
  /** Frame times, parallel to `resolved`. */
  times: readonly number[];
  /** Ground height at a plan position. */
  groundAt: (x: number, z: number) => number;
  /** Contact tolerance above the ground counted as stance. */
  tolerance: number;
}): {
  plants: IAutoMovieFootPlant[];
  targets: Array<Map<AutoMovieHumanoidBone, IAutoMovieVector3>>;
} => {
  const { legs, resolved, times, groundAt, tolerance } = props;
  const plants: IAutoMovieFootPlant[] = [];
  const targets = times.map(
    () => new Map<AutoMovieHumanoidBone, IAutoMovieVector3>(),
  );

  for (const leg of legs) {
    const contact = contactMask({
      effector: leg.foot,
      resolved,
      groundAt,
      tolerance,
    });
    for (const run of stanceRuns(contact)) {
      const startFoot = resolved[run.start]!.get(leg.foot)!.worldPosition;
      const target: IAutoMovieVector3 = {
        x: startFoot.x,
        y: groundAt(startFoot.x, startFoot.z),
        z: startFoot.z,
      };
      for (let f = run.start; f <= run.end; ++f)
        targets[f]!.set(leg.foot, target);
      plants.push({
        foot: leg.foot,
        start: times[run.start]!,
        end: times[run.end]!,
        position: target,
      });
    }
  }

  return { plants, targets };
};

/** Contiguous `true` runs of a contact mask, as inclusive frame ranges. */
const stanceRuns = (
  contact: readonly boolean[],
): Array<{ start: number; end: number }> => {
  const runs: Array<{ start: number; end: number }> = [];
  let start = -1;
  contact.forEach((inContact, index) => {
    if (inContact && start === -1) start = index;
    else if (!inContact && start !== -1) {
      runs.push({ start, end: index - 1 });
      start = -1;
    }
  });
  if (start !== -1) runs.push({ start, end: contact.length - 1 });
  return runs;
};
