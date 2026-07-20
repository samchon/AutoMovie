import { IAutoMovieImpactBody, resolveImpact } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const v = (x: number, y: number, z: number) => ({ x, y, z });
const N = v(0, 0, 1); // contact normal, a → b (b sits ahead on +z)

const body = (over: Partial<IAutoMovieImpactBody>): IAutoMovieImpactBody => ({
  mass: 1,
  velocity: v(0, 0, 0),
  restitution: 0.2,
  hardness: 0.5,
  penetrability: 0.1,
  ...over,
});

/**
 * `resolveImpact`, abstracted collision response: impulse + post-velocities + a
 * qualitative kind from a material heuristic.
 *
 * Scenarios:
 *
 * 1. Bounce: a hard, bouncy pair (e≈0.81) closing at 10 m/s → `bounce`; the
 *    striker slows and the target springs forward.
 * 2. Embed: a light fast arrow into a soft, penetrable torso → `embed`; the arrow
 *    stops (no rebound) and the heavy target barely moves.
 * 3. Through: into a _very_ soft body at high speed → `through`; only a fraction
 *    of momentum transfers, the striker keeps most of its speed.
 * 4. Deflect (separating): bodies already moving apart → `deflect`, zero impulse,
 *    velocities unchanged.
 * 5. Deflect (final): a slow, non-bouncy, non-penetrable hit → `deflect` with an
 *    inelastic impulse.
 */
export const test_physics_impact = (): void => {
  // 1. bounce
  const bnc = resolveImpact(
    body({ mass: 1, velocity: v(0, 0, 10), restitution: 0.9, hardness: 0.9 }),
    body({ mass: 1, restitution: 0.9, hardness: 0.9 }),
    N,
  );
  TestValidator.equals("hard+bouncy → bounce", bnc.kind, "bounce");
  TestValidator.predicate("closing speed 10", nclose(bnc.speed, 10));
  TestValidator.predicate(
    "striker slows to ~0.95",
    nclose(bnc.velocityA.z, 0.95, 0.02),
  );
  TestValidator.predicate(
    "target springs to ~9.05",
    nclose(bnc.velocityB.z, 9.05, 0.02),
  );

  // 2. embed
  const emb = resolveImpact(
    body({
      mass: 0.08,
      velocity: v(0, 0, 40),
      restitution: 0.2,
      hardness: 0.9,
    }),
    body({ mass: 75, restitution: 0.1, hardness: 0.2, penetrability: 0.7 }),
    N,
  );
  TestValidator.equals("fast into soft → embed", emb.kind, "embed");
  TestValidator.predicate(
    "arrow ~stops (no rebound)",
    emb.velocityA.z >= 0 && emb.velocityA.z < 1,
  );
  TestValidator.predicate(
    "heavy target barely moves",
    emb.velocityB.z > 0 && emb.velocityB.z < 0.3,
  );

  // 3. through
  const thr = resolveImpact(
    body({
      mass: 0.08,
      velocity: v(0, 0, 40),
      restitution: 0.2,
      hardness: 0.9,
    }),
    body({ mass: 75, restitution: 0.1, hardness: 0.2, penetrability: 0.9 }),
    N,
  );
  TestValidator.equals("very soft + very fast → through", thr.kind, "through");
  TestValidator.predicate(
    "striker keeps most of its speed",
    thr.velocityA.z > 20,
  );

  // 3b. very soft but only moderately fast → embed (not through): the body is
  // penetrable enough, but the speed is below the pass-through threshold
  const emb2 = resolveImpact(
    body({
      mass: 0.08,
      velocity: v(0, 0, 10),
      restitution: 0.2,
      hardness: 0.9,
    }),
    body({ mass: 75, restitution: 0.1, hardness: 0.2, penetrability: 0.9 }),
    N,
  );
  TestValidator.equals("soft but moderate speed → embed", emb2.kind, "embed");

  // 4. deflect: already separating
  const sep = resolveImpact(body({ velocity: v(0, 0, -5) }), body({}), N);
  TestValidator.equals("separating → deflect", sep.kind, "deflect");
  TestValidator.predicate("no impulse", nclose(sep.impulse.z, 0));
  TestValidator.predicate("velocity unchanged", nclose(sep.velocityA.z, -5));

  // 5. deflect: slow, non-bouncy, non-penetrable (final else, inelastic impulse)
  const dfl = resolveImpact(
    body({ mass: 1, velocity: v(0, 0, 4), restitution: 0.2, hardness: 0.3 }),
    body({ mass: 1, restitution: 0.2, hardness: 0.3, penetrability: 0.2 }),
    N,
  );
  TestValidator.equals("slow scuff → deflect", dfl.kind, "deflect");
  TestValidator.predicate(
    "inelastic: both end at ~2 m/s",
    nclose(dfl.velocityA.z, 2) && nclose(dfl.velocityB.z, 2),
  );
};
