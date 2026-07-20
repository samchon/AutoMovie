import { IAutoMovieQuaternion } from "@automovie/interface";

/**
 * A deterministic, seeded pseudo-random generator (mulberry32) for
 * property-based invariant tests. Seeding is the whole point: a property that
 * fails on sample #137 replays byte-for-byte from the same seed, so a random
 * counterexample is a permanent, debuggable fixture rather than a flake. The
 * suite never touches `Math.random`, keeping every run reproducible.
 */
export const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A uniform float in `[min, max)`. */
export const uniform = (rng: () => number, min: number, max: number): number =>
  min + (max - min) * rng();

/**
 * A uniformly distributed unit quaternion (Shoemake's subgroup algorithm): an
 * unbiased random rotation, so quaternion invariants are probed across the
 * whole sphere rather than a hand-picked corner.
 */
export const randomUnitQuaternion = (
  rng: () => number,
): IAutoMovieQuaternion => {
  const u1 = rng();
  const u2 = rng();
  const u3 = rng();
  const s1 = Math.sqrt(1 - u1);
  const s2 = Math.sqrt(u1);
  const t1 = 2 * Math.PI * u2;
  const t2 = 2 * Math.PI * u3;
  return {
    x: s1 * Math.sin(t1),
    y: s1 * Math.cos(t1),
    z: s2 * Math.sin(t2),
    w: s2 * Math.cos(t2),
  };
};
