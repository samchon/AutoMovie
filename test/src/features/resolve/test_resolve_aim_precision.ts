import { Matrix4, Quaternion, resolveWorldDrivers } from "@automovie/engine";
import { IAutoMovieAimDriver, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const W = (x: number, y: number, z: number): number[] =>
  Matrix4.compose(
    { x, y, z },
    { x: 0, y: 0, z: 0, w: 1 },
    { x: 1, y: 1, z: 1 },
  );

const aim = (over: Partial<IAutoMovieAimDriver>): IAutoMovieAimDriver => ({
  type: "aim",
  owner: "o",
  target: "t",
  aimAxis: { x: 0, y: 0, z: -1 },
  upAxis: { x: 0, y: 1, z: 0 },
  worldUp: { x: 0, y: 1, z: 0 },
  influence: 1,
  ...over,
});

/** Where the owner's aim axis points after the driver runs. */
const aimedDir = (
  world: Map<string, number[]>,
  aimAxis: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Quaternion.rotateVector(Matrix4.decompose(world.get("o")!).rotation, aimAxis);

const runAim = (
  d: IAutoMovieAimDriver,
  targetPos: IAutoMovieVector3,
): Map<string, number[]> => {
  const world = new Map<string, number[]>([
    ["o", W(0, 0, 0)],
    ["t", W(targetPos.x, targetPos.y, targetPos.z)],
  ]);
  resolveWorldDrivers([d], world, new Map(), new Map());
  return world;
};

/** 0.05° in radians: inside the OLD quatFromTo identity deadzone. */
const TINY = (0.05 * Math.PI) / 180;

/**
 * The aim driver's rotation is deadzone-free (#643): the shared shortest-arc
 * helper used to snap `cos > 0.999999` (≈0.08°) to the identity, so an aim
 * whose target sat a fraction of a degree off-axis silently refused to track,
 * visible as a micro-freeze on a slow camera pan. After promoting the exact
 * `atan2`-based `rotationBetween`, every angle down to numerical zero produces
 * its exact rotation, and the antiparallel flip stays deterministic on both
 * perpendicular-axis branches.
 *
 * Scenarios:
 *
 * 1. A target 0.05° off the aim axis (inside the old deadzone) now aims EXACTLY at
 *    the target (x-component = sin 0.05°, not the old identity's 0).
 * 2. A target exactly behind an owner whose aim axis has `|x| < 0.9` takes the
 *    x-perpendicular 180° flip and lands on the target.
 * 3. The same with an aim axis of `|x| >= 0.9` takes the y-perpendicular branch
 *    and also lands on the target.
 */
export const test_resolve_aim_precision = (): void => {
  const dir = { x: Math.sin(TINY), y: 0, z: -Math.cos(TINY) };
  const tracked = aimedDir(
    runAim(aim({}), { x: dir.x * 10, y: 0, z: dir.z * 10 }),
    { x: 0, y: 0, z: -1 },
  );
  TestValidator.predicate(
    "0.05° off-axis target is tracked exactly (no deadzone snap)",
    nclose(tracked.x, dir.x, 1e-9) &&
      nclose(tracked.y, 0, 1e-9) &&
      nclose(tracked.z, dir.z, 1e-9),
  );
  TestValidator.predicate(
    "the rotation is real, not the old identity (x ≈ sin 0.05° ≠ 0)",
    tracked.x > 1e-4,
  );

  const behindZ = aimedDir(runAim(aim({}), { x: 0, y: 0, z: 5 }), {
    x: 0,
    y: 0,
    z: -1,
  });
  TestValidator.predicate(
    "antiparallel flip lands on the target (|a.x| < 0.9 branch)",
    nclose(behindZ.x, 0, 1e-9) &&
      nclose(behindZ.y, 0, 1e-9) &&
      nclose(behindZ.z, 1, 1e-9),
  );

  const behindX = aimedDir(
    runAim(aim({ aimAxis: { x: 1, y: 0, z: 0 } }), { x: -5, y: 0, z: 0 }),
    { x: 1, y: 0, z: 0 },
  );
  TestValidator.predicate(
    "antiparallel flip lands on the target (|a.x| >= 0.9 branch)",
    nclose(behindX.x, -1, 1e-9) &&
      nclose(behindX.y, 0, 1e-9) &&
      nclose(behindX.z, 0, 1e-9),
  );
};
