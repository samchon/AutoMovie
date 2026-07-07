import { AutoMovieHumanoidBone, IAutoMovieVector3 } from "@automovie/interface";

import { IAutoMovieResolvedBone } from "../kinematics/resolvePose";
import { IAutoMovieFootLeg, IAutoMovieFootPlant } from "./plantFeet";

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
    const contact = resolved.map((map) => {
      const foot = map.get(leg.foot);
      const p = foot?.worldPosition;
      return p !== undefined && p.y <= groundAt(p.x, p.z) + tolerance;
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
