import { projectileAt, solveBallisticLaunch } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const GRAVITY: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 };
const ORIGIN: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };

/**
 * `solveBallisticLaunch` on a purely vertical target must return the **first**
 * contact time, not the fall-back re-crossing.
 *
 * Fired straight up at an overhead target, the projectile passes the target
 * height twice (rising through it, then falling back through it), so the
 * quadratic `½·g·t² − v·t + h = 0` has two positive roots `(v ∓ √(v²−2gh))/g`.
 * The hit time the `launch` verb schedules a reaction against must be the
 * earlier (rising) root; returning the later root delays the reaction by the
 * whole up-and-down flight (the pre-fix bug, ~3s off for a 10 m overhead
 * shot).
 *
 * Scenarios (hand-computed oracles, not snapshots):
 *
 * 1. Overhead target, fired up: hit time is the rising root `(v−√…)/g`, well
 *    before the descending root, and the forward simulation confirms the
 *    projectile is on the target at exactly that time (rising through it).
 * 2. Below target, default (direct) arc: fired straight DOWN (#1142), so the hit
 *    is the single positive root of the downward flight: the fast direct drop,
 *    not the up-and-over lob.
 */
export const test_physics_ballistic_vertical_first_contact = (): void => {
  // 1. Overhead: origin y=0, target y=10, speed 20, g=9.81.
  //    disc = 20² − 2·9.81·10 = 203.8; √203.8 = 14.2758537…
  //    rising  root = (20 − 14.2758537)/9.81 = 0.5835012 s  ← first contact
  //    falling root = (20 + 14.2758537)/9.81 = 3.4939157 s
  const overhead: IAutoMovieVector3 = { x: 0, y: 10, z: 0 };
  const up = solveBallisticLaunch(ORIGIN, overhead, 20, GRAVITY)!;
  TestValidator.predicate(
    "overhead hit time is the rising root (first contact)",
    nclose(up.hitTime, 0.5835012, 1e-4),
  );
  TestValidator.predicate(
    "the rising root is well before the descending re-crossing",
    up.hitTime < 1 && up.hitTime * 5 < 3.4939157,
  );
  TestValidator.predicate(
    "a vertical shot fires straight up at the requested speed",
    vclose(up.velocity, { x: 0, y: 20, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "the projectile is on the overhead target at the first-contact time",
    vclose(
      projectileAt(
        { origin: ORIGIN, velocity: up.velocity, gravity: GRAVITY },
        up.hitTime,
      ).position,
      overhead,
      1e-3,
    ),
  );

  // 2. Below: origin y=0, target y=−4, speed 6, default (direct) arc.
  //    Fired down (v=−6): disc = 6² − 2·9.81·(−4) = 114.48; √114.48 = 10.699533…
  //    → single positive root = (−6 + 10.699533)/9.81 = 0.4790553 s
  const below: IAutoMovieVector3 = { x: 0, y: -4, z: 0 };
  const down = solveBallisticLaunch(ORIGIN, below, 6, GRAVITY)!;
  TestValidator.predicate(
    "a below target's direct arc fires straight down",
    vclose(down.velocity, { x: 0, y: -6, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "the direct drop hits at the downward flight's single positive root",
    nclose(down.hitTime, 0.4790553, 1e-4),
  );
  TestValidator.predicate(
    "the projectile is on the below target at that time",
    vclose(
      projectileAt(
        { origin: ORIGIN, velocity: down.velocity, gravity: GRAVITY },
        down.hitTime,
      ).position,
      below,
      1e-3,
    ),
  );
};
