import {
  IAutoMovieIKDriver,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Matrix4 } from "../math/Matrix4";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import {
  blendVec,
  readWorld,
  recompose,
  validateInfluence,
} from "./worldShared";

/**
 * Iteration budget when the driver leaves `iterations: null` — enough for a
 * short chain to converge well past the visual threshold, small enough that the
 * worst case stays a fixed, cheap constant.
 */
const DEFAULT_ITERATIONS = 10;

/**
 * Convergence early-out: once the tip sits within this many meters of the goal
 * further iterations cannot move anything visibly. Early-out keeps the budget
 * fixed-at-most, so the solve stays deterministic.
 */
const CONVERGENCE_EPSILON = 1e-6;

/**
 * Deterministic fallback direction for the measure-zero degenerate where a
 * FABRIK pass lands two adjacent joints on the same point (the segment
 * direction is undefined). Any fixed unit vector restores totality without
 * hurting determinism.
 */
const FALLBACK_DIR: IAutoMovieVector3 = { x: 1, y: 0, z: 0 };

/**
 * Apply an iterative IK driver (`ccd` or `fabrik`) to a composed world map —
 * the long-chain complement to the analytic two-bone solver, now executed
 * inside the engine so the deterministic guarantee covers it (S2 of the core
 * wiring: these used to be returned untouched for a host to run).
 *
 * Both solvers work on the chain's world positions with rigid segment lengths
 * and a **fixed iteration budget** (`driver.iterations`, else
 * {@link DEFAULT_ITERATIONS}) plus a convergence early-out
 * ({@link CONVERGENCE_EPSILON}) — same inputs, same output, always. CCD sweeps
 * the joints back-to-front rotating each toward the goal; FABRIK runs
 * backward/forward position passes (and resolves an out-of-reach goal as full
 * extension toward it). After the positional solve each joint's world rotation
 * gets the shortest-arc delta of its segment, the result is blended by
 * `influence`, and — matching the two-bone convention — the tip's subtree
 * recomposes.
 *
 * @author Samchon
 */
export const applyIterativeIK = (
  d: IAutoMovieIKDriver,
  world: Map<string, number[]>,
  localById: Map<string, IAutoMovieTransform>,
  childrenById: Map<string, string[]>,
): void => {
  validateInfluence("iterative IK", d.influence);
  const iterations = readIterations(d.iterations);
  if (d.chain.length < 2)
    throw new Error(
      `world driver iterative IK chain needs at least 2 nodes, but had ${d.chain.length}`,
    );

  const matrices = d.chain.map((id) =>
    readWorld(world, id, "iterative IK chain"),
  );
  const before = matrices.map((m) => Matrix4.position(m));
  const lengths: number[] = [];
  for (let i = 0; i + 1 < before.length; ++i) {
    const length = Vector3.length(Vector3.subtract(before[i + 1]!, before[i]!));
    if (!(length > 0))
      throw new Error(
        `world driver iterative IK segment ${i} length must be > 0, but was ${length}`,
      );
    lengths.push(length);
  }
  const goal = Matrix4.position(readWorld(world, d.goal, "iterative IK goal"));

  const after =
    d.solver === "ccd"
      ? solveCcd(before, goal, iterations)
      : solveFabrik(before, lengths, goal, iterations);

  writeChain(d, world, matrices, before, after, childrenById, localById);
};

const readIterations = (iterations: number | null): number => {
  if (iterations === null) return DEFAULT_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations <= 0)
    throw new Error(
      `world driver iterative IK iterations must be a positive integer, but was ${iterations}`,
    );
  return iterations;
};

/**
 * Cyclic coordinate descent: back-to-front, rotate each joint so the tip swings
 * toward the goal, positions only (rotations are lowered afterward).
 */
const solveCcd = (
  before: readonly IAutoMovieVector3[],
  goal: IAutoMovieVector3,
  iterations: number,
): IAutoMovieVector3[] => {
  const p = before.map((v) => ({ ...v }));
  const tip = p.length - 1;
  for (let it = 0; it < iterations; ++it) {
    if (Vector3.length(Vector3.subtract(p[tip]!, goal)) <= CONVERGENCE_EPSILON)
      break;
    for (let j = tip - 1; j >= 0; --j) {
      // A degenerate direction (tip or goal exactly on the pivot) normalizes to
      // the zero vector, and rotationBetween of a zero vector is the identity —
      // the pivot simply contributes nothing that sweep, no guard needed.
      const rot = rotationBetween(
        Vector3.normalize(Vector3.subtract(p[tip]!, p[j]!)),
        Vector3.normalize(Vector3.subtract(goal, p[j]!)),
      );
      for (let k = j + 1; k <= tip; ++k)
        p[k] = Vector3.add(
          p[j]!,
          Quaternion.rotateVector(rot, Vector3.subtract(p[k]!, p[j]!)),
        );
    }
  }
  return p;
};

/**
 * FABRIK: alternate backward (tip pinned to the goal) and forward (root pinned
 * home) passes that re-place each joint at its exact segment length. A goal
 * beyond total reach resolves directly as full extension toward it — FABRIK's
 * canonical unreachable handling, and exactly "the chain points at what it
 * cannot touch".
 */
const solveFabrik = (
  before: readonly IAutoMovieVector3[],
  lengths: readonly number[],
  goal: IAutoMovieVector3,
  iterations: number,
): IAutoMovieVector3[] => {
  const p = before.map((v) => ({ ...v }));
  const tip = p.length - 1;
  const root = { ...p[0]! };
  const total = lengths.reduce((sum, l) => sum + l, 0);
  const toGoal = Vector3.subtract(goal, root);
  const goalDistance = Vector3.length(toGoal);

  if (goalDistance >= total) {
    // Segment lengths are validated strictly positive, so total > 0 and the
    // division below is always safe here.
    const dir = Vector3.scale(toGoal, 1 / goalDistance);
    let cumulative = 0;
    for (let i = 1; i <= tip; ++i) {
      cumulative += lengths[i - 1]!;
      p[i] = Vector3.add(root, Vector3.scale(dir, cumulative));
    }
    return p;
  }

  for (let it = 0; it < iterations; ++it) {
    if (Vector3.length(Vector3.subtract(p[tip]!, goal)) <= CONVERGENCE_EPSILON)
      break;
    // backward: pin the tip on the goal, walk to the root
    p[tip] = { ...goal };
    for (let j = tip - 1; j >= 0; --j)
      p[j] = Vector3.add(
        p[j + 1]!,
        Vector3.scale(unitOr(Vector3.subtract(p[j]!, p[j + 1]!)), lengths[j]!),
      );
    // forward: pin the root home, walk to the tip
    p[0] = { ...root };
    for (let j = 1; j <= tip; ++j)
      p[j] = Vector3.add(
        p[j - 1]!,
        Vector3.scale(
          unitOr(Vector3.subtract(p[j]!, p[j - 1]!)),
          lengths[j - 1]!,
        ),
      );
  }
  return p;
};

/** Unit vector of `v`, or the deterministic fallback when `v` is degenerate. */
const unitOr = (v: IAutoMovieVector3): IAutoMovieVector3 =>
  Vector3.length(v) < 1e-12 ? FALLBACK_DIR : Vector3.normalize(v);

/**
 * Exact shortest-arc rotation between two unit (or zero) vectors, `atan2`-based
 * — unlike the shared `quatFromTo` it has **no near-parallel identity
 * deadzone**, which matters here: an iterative solver's late sweeps make
 * sub-0.1° corrections, and a deadzone turns into a convergence floor (the tip
 * freezes ~2e-3 m short of the goal). A zero input degrades to the identity;
 * exact antiparallel takes a 180° flip about a deterministic perpendicular.
 */
const rotationBetween = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const cross = Vector3.cross(a, b);
  const sin = Vector3.length(cross);
  const cos = Vector3.dot(a, b);
  if (sin < 1e-12) {
    if (cos >= 0) return Quaternion.identity();
    const perp =
      Math.abs(a.x) < 0.9
        ? Vector3.cross(a, { x: 1, y: 0, z: 0 })
        : Vector3.cross(a, { x: 0, y: 1, z: 0 });
    return Quaternion.fromAxisAngle(perp, 180);
  }
  return Quaternion.fromAxisAngle(
    cross,
    (Math.atan2(sin, cos) * 180) / Math.PI,
  );
};

/**
 * Lower the positional solve into the world map: each non-tip joint's rotation
 * gets its segment's shortest-arc delta, everything blends by `influence`, and
 * the tip's subtree recomposes (the two-bone convention).
 */
const writeChain = (
  d: IAutoMovieIKDriver,
  world: Map<string, number[]>,
  matrices: readonly number[][],
  before: readonly IAutoMovieVector3[],
  after: readonly IAutoMovieVector3[],
  childrenById: Map<string, string[]>,
  localById: Map<string, IAutoMovieTransform>,
): void => {
  const t = d.influence;
  const tip = d.chain.length - 1;
  for (let j = 0; j <= tip; ++j) {
    const dec = Matrix4.decompose(matrices[j]!);
    const rotation: IAutoMovieQuaternion =
      j < tip
        ? Quaternion.slerp(
            dec.rotation,
            Quaternion.multiply(
              rotationBetween(
                unitOr(Vector3.subtract(before[j + 1]!, before[j]!)),
                unitOr(Vector3.subtract(after[j + 1]!, after[j]!)),
              ),
              dec.rotation,
            ),
            t,
          )
        : dec.rotation;
    world.set(
      d.chain[j]!,
      Matrix4.compose(blendVec(before[j]!, after[j]!, t), rotation, dec.scale),
    );
  }
  recompose(d.chain[tip]!, world, localById, childrenById);
};
