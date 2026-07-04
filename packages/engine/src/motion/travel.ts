import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";

const IDENTITY_ROT: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };
const IDENTITY_SCALE: IAutoMovieVector3 = { x: 1, y: 1, z: 1 };

/**
 * Bake continuous root **travel** onto an in-place locomotion cycle — turning a
 * walk/run that marches on the spot into one that actually crosses the floor.
 *
 * A locomotion clip (walk, run) is authored looping and stationary so its
 * footwork reads cleanly; to move the character through the world you add root
 * translation. Doing that per keyframe by hand is tedious and snaps back at
 * every loop boundary. `travelMotion` instead repeats `base` `cycles` times and
 * adds a root offset that grows **linearly with elapsed time** (`velocity · t`,
 * world meters/second). Because the offset is a continuous function of the
 * global time — not reset per cycle — it carries smoothly across every seam, so
 * the figure glides forward while its legs keep cycling. Any root transform the
 * base already carries (e.g. a hop's vertical bob) is preserved and the travel
 * is added on top.
 *
 * The result is an ordinary non-looping {@link IAutoMovieMotion} (it has a
 * finite extent in space), sampled like any other clip — and a camera can
 * follow its root to keep the moving character in frame.
 *
 * `facing`, when given, orients the root by that rotation (composed onto any
 * rotation the base root already carries) — so a walk that travels sideways can
 * turn the body to face where it is going instead of strafing.
 *
 * @author Samchon
 */
export const travelMotion = (
  id: string,
  base: IAutoMovieMotion,
  cycles: number,
  velocity: IAutoMovieVector3,
  facing?: IAutoMovieQuaternion,
): IAutoMovieMotion => {
  const keyframes: IAutoMovieKeyframe[] = [];
  for (let c = 0; c < cycles; ++c) {
    for (const k of base.keyframes) {
      // drop the duplicate seam keyframe (a later cycle's time:0) so times stay
      // strictly increasing — the prior cycle's final frame already covers it
      if (c > 0 && k.time === 0) continue;
      const globalT = c * base.duration + k.time;
      const baseRoot = k.pose.root;
      keyframes.push({
        ...k,
        time: globalT,
        pose: {
          ...k.pose,
          root: {
            translation: {
              x: (baseRoot?.translation.x ?? 0) + velocity.x * globalT,
              y: (baseRoot?.translation.y ?? 0) + velocity.y * globalT,
              z: (baseRoot?.translation.z ?? 0) + velocity.z * globalT,
            },
            rotation:
              facing === undefined
                ? (baseRoot?.rotation ?? IDENTITY_ROT)
                : Quaternion.multiply(
                    facing,
                    baseRoot?.rotation ?? IDENTITY_ROT,
                  ),
            scale: baseRoot?.scale ?? IDENTITY_SCALE,
          },
        },
      });
    }
  }
  return {
    id,
    skeleton: base.skeleton,
    duration: cycles * base.duration,
    loop: false,
    keyframes,
  };
};
