import {
  IAutoMovieCameraClearanceEnvelope,
  IAutoMovieCameraClearanceFinding,
  IAutoMovieCameraClearanceReport,
  IAutoMovieCameraClearanceSphere,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleTimes } from "../motion/sampleClock";

/** One current world-space obstacle bound at one fixed-clock instant. */
interface IAutoMovieCameraClearanceObstacleState {
  /** Stable resolved scene-node identity. */
  node: string;
  /** Inclusive world-space axis-aligned box. */
  bounds: { min: IAutoMovieVector3; max: IAutoMovieVector3 };
}

/** Camera and obstacle state read at one fixed-clock instant. */
interface IAutoMovieCameraClearanceSample {
  /** Shot-local sample time in seconds. */
  time: number;
  /** Resolved camera transform at this exact instant. */
  camera: IAutoMovieTransform;
  /** Every current resolved obstacle at this exact instant. */
  obstacles: IAutoMovieCameraClearanceObstacleState[];
}

/** Complete deterministic input for one camera take. */
interface IAutoMovieCameraClearanceEvaluation {
  /** Resolved camera identity. */
  camera: string;
  /** Camera-local body and optional parent-rig envelope. */
  envelope: IAutoMovieCameraClearanceEnvelope;
  /** Geometry revision from which the obstacle states were read. */
  revision: string;
  /** Geometry revision that remains current at evaluation time. */
  currentRevision: string;
  /** Endpoint-inclusive fixed-clock samples per second. */
  sampleRate: number;
  /** Shot duration in seconds. */
  duration: number;
  /** State at every base fixed-clock and additional causal-key instant. */
  samples: IAutoMovieCameraClearanceSample[];
}

/** Reject a non-finite vector or an inverted box at the evaluator boundary. */
const assertBox = (
  box: IAutoMovieCameraClearanceObstacleState["bounds"],
  path: string,
): void => {
  const coordinates = [
    box.min.x,
    box.min.y,
    box.min.z,
    box.max.x,
    box.max.y,
    box.max.z,
  ];
  if (!coordinates.every(Number.isFinite))
    throw new Error(`${path} must contain finite coordinates`);
  if (box.min.x > box.max.x || box.min.y > box.max.y || box.min.z > box.max.z)
    throw new Error(`${path} minimum must not exceed maximum`);
};

/**
 * Preserve every obstacle over an interval by uniting its two conservative
 * endpoint boxes. The performance adapter supplies rotation-invariant bounds,
 * so a linearly moving or rotating obstacle cannot escape this union.
 */
const unionBoxes = (
  first: IAutoMovieCameraClearanceObstacleState["bounds"],
  second: IAutoMovieCameraClearanceObstacleState["bounds"],
): IAutoMovieCameraClearanceObstacleState["bounds"] => ({
  min: {
    x: Math.min(first.min.x, second.min.x),
    y: Math.min(first.min.y, second.min.y),
    z: Math.min(first.min.z, second.min.z),
  },
  max: {
    x: Math.max(first.max.x, second.max.x),
    y: Math.max(first.max.y, second.max.y),
    z: Math.max(first.max.z, second.max.z),
  },
});

/** Inflate an inclusive obstacle box by a swept sphere's conservative radius. */
const inflateBox = (
  box: IAutoMovieCameraClearanceObstacleState["bounds"],
  radius: number,
): IAutoMovieCameraClearanceObstacleState["bounds"] => ({
  min: {
    x: box.min.x - radius,
    y: box.min.y - radius,
    z: box.min.z - radius,
  },
  max: {
    x: box.max.x + radius,
    y: box.max.y + radius,
    z: box.max.z + radius,
  },
});

/**
 * Inclusive segment/box slab test. Equality is collision: a camera body that
 * merely touches a wall or support has no physical clearance.
 */
const segmentIntersectsBox = (
  start: IAutoMovieVector3,
  end: IAutoMovieVector3,
  box: IAutoMovieCameraClearanceObstacleState["bounds"],
): boolean => {
  let lower = 0;
  let upper = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const delta = end[axis] - start[axis];
    if (delta === 0) {
      if (start[axis] < box.min[axis] || start[axis] > box.max[axis])
        return false;
      continue;
    }
    const first = (box.min[axis] - start[axis]) / delta;
    const second = (box.max[axis] - start[axis]) / delta;
    lower = Math.max(lower, Math.min(first, second));
    upper = Math.min(upper, Math.max(first, second));
    if (lower > upper) return false;
  }
  return true;
};

/** Camera-local sphere centre transformed into one resolved camera state. */
const sphereCenter = (
  transform: IAutoMovieTransform,
  center: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.add(
    transform.translation,
    Quaternion.rotateVector(transform.rotation, {
      x: center.x * transform.scale.x,
      y: center.y * transform.scale.y,
      z: center.z * transform.scale.z,
    }),
  );

/**
 * Extra radius covering the arc between two rotated local centres. Camera
 * rotation is shortest-path spherical interpolation; the sagitta bound keeps
 * the complete arc inside the endpoint chord's inflated capsule.
 */
const rotationArcMargin = (
  first: IAutoMovieTransform,
  second: IAutoMovieTransform,
  center: IAutoMovieVector3,
): number => {
  const a = Quaternion.normalize(first.rotation);
  const b = Quaternion.normalize(second.rotation);
  const dot = Math.min(
    1,
    Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w),
  );
  const angle = 2 * Math.acos(dot);
  const maximumOffset = Math.max(
    Vector3.length({
      x: center.x * first.scale.x,
      y: center.y * first.scale.y,
      z: center.z * first.scale.z,
    }),
    Vector3.length({
      x: center.x * second.scale.x,
      y: center.y * second.scale.y,
      z: center.z * second.scale.z,
    }),
  );
  return maximumOffset * (1 - Math.cos(angle / 2));
};

/** Map a sample's obstacles by identity and reject duplicate snapshots. */
const obstaclesByNode = (
  sample: IAutoMovieCameraClearanceSample,
  sampleIndex: number,
): Map<string, IAutoMovieCameraClearanceObstacleState["bounds"]> => {
  const result = new Map<
    string,
    IAutoMovieCameraClearanceObstacleState["bounds"]
  >();
  sample.obstacles.forEach((obstacle, obstacleIndex) => {
    if (result.has(obstacle.node))
      throw new Error(
        `$input.samples[${sampleIndex}].obstacles[${obstacleIndex}].node duplicates "${obstacle.node}"`,
      );
    assertBox(
      obstacle.bounds,
      `$input.samples[${sampleIndex}].obstacles[${obstacleIndex}].bounds`,
    );
    result.set(obstacle.node, obstacle.bounds);
  });
  return result;
};

/**
 * Evaluate camera-body and parent-rig clearance over every adjacent ordered
 * sample interval against current-revision resolved scene bounds.
 *
 * Every interval uses a continuous camera capsule, including a conservative
 * rotation-arc margin, against the union of same-clock obstacle endpoint
 * bounds. Contact is blocked. A revision mismatch returns `stale` without
 * applying any old geometry to the current scene.
 *
 * @param input - Complete current-revision camera and obstacle sample plan.
 * @returns Stable interval-, part-, and obstacle-ordered clearance evidence.
 * @throws Error when the supplied samples omit a base fixed-clock instant, are
 * not strictly ordered, or do not carry one coherent obstacle identity set.
 *
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-clearance Evaluates declared camera and rig volumes against resolved scene obstacles rather than treating the optical point as the body.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-dynamic-spatial-sampling Covers each adjacent fixed-clock interval with continuous conservative bounds so clear endpoints cannot hide an interior penetration.
 * @evidence requirements/camera/clipping-occlusion-and-spatial-constraints.md#camera-spatial-geometry-revision Refuses to apply a report whose resolved geometry revision is no longer current.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-constraints-refusal Returns addressed body/rig contacts rather than silently accepting a physically impossible take.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Evaluates the declared physical camera and rig envelope against current resolved geometry over every fixed-clock interval.
 * @author Samchon
 */
export function evaluateCameraClearance(
  input: IAutoMovieCameraClearanceEvaluation,
): IAutoMovieCameraClearanceReport {
  if (!(Number.isFinite(input.sampleRate) && input.sampleRate > 0))
    throw new Error("$input.sampleRate must be finite and greater than zero");
  if (!(Number.isFinite(input.duration) && input.duration >= 0))
    throw new Error("$input.duration must be finite and non-negative");

  if (input.revision !== input.currentRevision)
    return {
      camera: input.camera,
      revision: input.revision,
      currentRevision: input.currentRevision,
      sampleRate: input.sampleRate,
      sampleTimes: [],
      intervals: 0,
      status: "stale",
      findings: [],
    };

  const fixedTimes = sampleTimes(input.duration, input.sampleRate);
  const suppliedTimes = input.samples.map((sample) => sample.time);
  const suppliedTimeSet = new Set(suppliedTimes);
  if (
    suppliedTimes.some(
      (time) => !Number.isFinite(time) || time < 0 || time > input.duration,
    ) ||
    suppliedTimes.some(
      (time, index) => index > 0 && time <= suppliedTimes[index - 1]!,
    ) ||
    fixedTimes.some((time) => !suppliedTimeSet.has(time))
  )
    throw new Error(
      "$input.samples must contain every endpoint-inclusive fixed-clock instant in strict time order; additional causal instants are allowed",
    );

  const obstacleMaps = input.samples.map(obstaclesByNode);
  for (let index = 1; index < obstacleMaps.length; index++) {
    const previous = obstacleMaps[index - 1]!;
    const current = obstacleMaps[index]!;
    if (
      previous.size !== current.size ||
      [...previous.keys()].some((node) => !current.has(node))
    )
      throw new Error(
        `$input.samples[${index}].obstacles must preserve the current resolved identity set`,
      );
  }

  const findings: IAutoMovieCameraClearanceFinding[] = [];
  const intervalEnds =
    input.samples.length === 1
      ? [0]
      : input.samples.slice(1).map((_, index) => index + 1);
  for (const index of intervalEnds) {
    const first = input.samples[Math.max(0, index - 1)]!;
    const second = input.samples[index]!;
    const firstObstacles = obstacleMaps[Math.max(0, index - 1)]!;
    const secondObstacles = obstacleMaps[index]!;
    const parts: Array<
      readonly ["body" | "parent-rig", IAutoMovieCameraClearanceSphere]
    > = [["body", input.envelope.body]];
    if (input.envelope.parentRig !== null)
      parts.push(["parent-rig", input.envelope.parentRig]);

    for (const [part, sphere] of parts) {
      const start = sphereCenter(first.camera, sphere.center);
      const end = sphereCenter(second.camera, sphere.center);
      const scale = Math.max(
        Math.abs(first.camera.scale.x),
        Math.abs(first.camera.scale.y),
        Math.abs(first.camera.scale.z),
        Math.abs(second.camera.scale.x),
        Math.abs(second.camera.scale.y),
        Math.abs(second.camera.scale.z),
      );
      const radius =
        sphere.radius * scale +
        rotationArcMargin(first.camera, second.camera, sphere.center);
      for (const node of [...firstObstacles.keys()].sort((a, b) =>
        a.localeCompare(b),
      )) {
        const obstacle = unionBoxes(
          firstObstacles.get(node)!,
          secondObstacles.get(node)!,
        );
        if (segmentIntersectsBox(start, end, inflateBox(obstacle, radius)))
          findings.push({
            part,
            obstacle: node,
            start: first.time,
            end: second.time,
          });
      }
    }
  }

  return {
    camera: input.camera,
    revision: input.revision,
    currentRevision: input.currentRevision,
    sampleRate: input.sampleRate,
    sampleTimes: suppliedTimes,
    intervals: Math.max(0, input.samples.length - 1),
    status: findings.length === 0 ? "clear" : "blocked",
    findings,
  };
}
