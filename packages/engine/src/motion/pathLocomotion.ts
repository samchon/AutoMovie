import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";

const IDENTITY_ROT: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };
const IDENTITY_SCALE: IAutoMovieVector3 = { x: 1, y: 1, z: 1 };
const UP: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
const MIN_SEGMENT = 1e-9;
const DEFAULT_TURN_WINDOW = 0.5;

/**
 * A ground-height source for a walked path: a constant plane height, or a
 * heightfield callback `(x, z) → y` (a slope, stairs approximated as a ramp).
 * Real surface geometry is #605; this is the scalar/callback seam it will
 * refine.
 */
export type AutoMoviePathGround = number | ((x: number, z: number) => number);

/**
 * The path frame at one baked keyframe time: where the root sits on the path
 * and which way it faces, the per-time data a later pass (a camera follow, a
 * foot-planting pass) consumes without re-deriving the path math.
 *
 * @author Samchon
 */
export interface IAutoMoviePathFrame {
  /** Seconds into the baked clip. */
  time: number;
  /** World path point: XZ on the polyline, `y` from the ground source. */
  position: IAutoMovieVector3;
  /** Facing about +Y in degrees (0 = +Z, +90 = +X), corner-blended. */
  yawDeg: number;
  /** Unit horizontal facing direction (`y` = 0), matching `yawDeg`. */
  tangent: IAutoMovieVector3;
}

/**
 * A gait baked along a path, plus the per-keyframe path frames, mirroring how
 * the ground-IK pass returns its plants (#596).
 *
 * @author Samchon
 */
export interface IAutoMoviePathLocomotion {
  /** The baked non-looping clip. */
  motion: IAutoMovieMotion;
  /** One path frame per output keyframe, in time order. */
  frames: IAutoMoviePathFrame[];
  /** Total horizontal (XZ) arc length of the path, meters. */
  length: number;
  /** Effective speed after cycle snapping, m/s (`length / duration`). */
  speed: number;
  /** Whole gait cycles baked. */
  cycles: number;
}

/** One straight XZ stretch of the polyline, arc-length addressed. */
interface ISegment {
  /** Start of the stretch on the ground plan. */
  x: number;
  z: number;
  /** Unit XZ direction. */
  dirX: number;
  dirZ: number;
  /** Facing of this stretch, degrees about +Y. */
  yawDeg: number;
  /** Stretch length, meters. */
  length: number;
  /** Cumulative arc length at the stretch start. */
  from: number;
}

/**
 * Bake a looping gait cycle **along a waypoint path**: curved walking with
 * natural turning and ground-height adaptation, where {@link locomoteMotion}
 * only walks a straight line. The motion side of long-form staging: a character
 * that rounds a corner or climbs a ramp instead of teleport-facing its goal.
 *
 * The path is a world-space polyline over the ground plan: arc length is
 * measured on XZ (piecewise linear: no smoothing solver, deterministic), and
 * **waypoint `y` is ignored**. Height comes from `ground` (a plane scalar or a
 * `(x, z) → y` callback; #605's surfaces will refine this seam). Root
 * translation follows arc length at the gait's pace; like {@link travelMotion}
 * the offset is a continuous function of global time, so it carries across
 * every cycle seam, and any root bob the gait carries is preserved on top. The
 * engine sizes the travel exactly as `locomoteMotion` does (whole cycles
 * nearest the requested `speed`, at least one), then snaps the effective speed
 * so the path completes exactly at the clip end (no end-of-path plateau for
 * feet to skate on).
 *
 * **Facing follows the path tangent**: yaw = `atan2(dx, dz)` per stretch (model
 * +Z forward, as `locomoteMotion`), composed onto the base root rotation. At a
 * corner the yaw blends linearly in arc length over a window of `min(turnWindow
 * / 2, half of each adjacent stretch)` on either side, taking the shortest
 * angular arc, a bounded turn rate instead of a snap (`turnWindow: 0` snaps).
 * Gait phase never resets: keyframe times replicate the base cycle untouched
 * (#597's continuity spirit), the corner only steers the root.
 *
 * Feed the result through {@link plantStanceFeet} (#596) to pin the stance feet.
 * Pathfinding and obstacle avoidance are out of scope: the path is authored
 * (blocking / #605's navigable space provide it).
 *
 * @author Samchon
 */
export const followPathMotion = (props: {
  /** Output clip id. */
  id: string;
  /** The looping in-place gait cycle to carry along the path. */
  gait: IAutoMovieMotion;
  /** World-space waypoints, at least two; `y` is ignored (see `ground`). */
  waypoints: readonly IAutoMovieVector3[];
  /** Requested pace along the path, m/s. The engine snaps to whole cycles. */
  speed: number;
  /** Ground height: plane scalar or `(x, z) → y` callback. Defaults to `0`. */
  ground?: AutoMoviePathGround;
  /** Corner blend span, meters of arc on both sides combined. Default `0.5`. */
  turnWindow?: number;
}): IAutoMoviePathLocomotion => {
  const turnWindow = props.turnWindow ?? DEFAULT_TURN_WINDOW;
  if (!Number.isFinite(props.speed) || props.speed <= 0)
    throw new Error("path speed must be finite and positive");
  if (!Number.isFinite(props.gait.duration) || props.gait.duration <= 0)
    throw new Error("path gait duration must be finite and positive");
  if (!Number.isFinite(turnWindow) || turnWindow < 0)
    throw new Error("path turn window must be finite and non-negative");
  if (typeof props.ground === "number" && !Number.isFinite(props.ground))
    throw new Error("path ground height must be finite");

  const segments = buildSegments(props.waypoints);
  const last = segments[segments.length - 1]!;
  const length = last.from + last.length;
  const cycles = Math.max(
    1,
    Math.round(length / (props.speed * props.gait.duration)),
  );
  const duration = cycles * props.gait.duration;
  const speed = length / duration;
  const halfWindows = cornerHalfWindows(segments, turnWindow);

  const keyframes: IAutoMovieKeyframe[] = [];
  const frames: IAutoMoviePathFrame[] = [];
  for (let c = 0; c < cycles; ++c)
    for (const k of props.gait.keyframes) {
      // drop the duplicate seam keyframe (a later cycle's time:0) so times stay
      // strictly increasing: the prior cycle's final frame covers the pose,
      // but the seam carries the incoming cycle's first-segment easing (#1012)
      if (c > 0 && k.time === 0) {
        const seam = keyframes[keyframes.length - 1]!;
        keyframes[keyframes.length - 1] = {
          ...seam,
          easing: k.easing,
          bezier: k.bezier,
        };
        continue;
      }
      const globalT = c * props.gait.duration + k.time;
      const s = Math.min(length, speed * globalT);
      const seg = segments[segmentIndexAt(segments, s)]!;
      const x = seg.x + seg.dirX * (s - seg.from);
      const z = seg.z + seg.dirZ * (s - seg.from);
      const y = groundHeightAt(props.ground, x, z);
      const yawDeg = yawAt(segments, halfWindows, s);
      const facing = Quaternion.fromAxisAngle(UP, yawDeg);
      const baseRoot = k.pose.root;
      frames.push({
        time: globalT,
        position: { x, y, z },
        yawDeg,
        tangent: {
          x: Math.sin(yawDeg * DEG2RAD),
          y: 0,
          z: Math.cos(yawDeg * DEG2RAD),
        },
      });
      // The gait's own root (a bob or sway) is model-frame data; rotate it by
      // the path facing before adding the world path position (#1012).
      const baseTranslation =
        baseRoot === null
          ? undefined
          : Quaternion.rotateVector(facing, baseRoot.translation);
      keyframes.push({
        ...k,
        time: globalT,
        pose: {
          ...k.pose,
          root: {
            translation: {
              x: (baseTranslation?.x ?? 0) + x,
              y: (baseTranslation?.y ?? 0) + y,
              z: (baseTranslation?.z ?? 0) + z,
            },
            rotation: Quaternion.multiply(
              facing,
              baseRoot?.rotation ?? IDENTITY_ROT,
            ),
            scale: baseRoot?.scale ?? IDENTITY_SCALE,
          },
        },
      });
    }

  return {
    motion: {
      id: props.id,
      skeleton: props.gait.skeleton,
      duration,
      loop: false,
      keyframes,
      // The path bake repeats the gait cycle continuously (phase never resets
      // across corners), so the composite's stride clock is the gait's own.
      gaitCycle: props.gait.gaitCycle ?? {
        period: props.gait.duration,
        phaseAt: 0,
      },
    },
    frames,
    length,
    speed,
    cycles,
  };
};

/** Validate the waypoints and cut them into arc-length-addressed stretches. */
const buildSegments = (waypoints: readonly IAutoMovieVector3[]): ISegment[] => {
  if (waypoints.length < 2)
    throw new Error("path needs at least two waypoints");
  for (let i = 0; i < waypoints.length; ++i) {
    if (!Number.isFinite(waypoints[i]!.x))
      throw new Error(`path waypoint[${i}].x must be finite`);
    if (!Number.isFinite(waypoints[i]!.z))
      throw new Error(`path waypoint[${i}].z must be finite`);
  }
  const segments: ISegment[] = [];
  let from = 0;
  for (let i = 0; i + 1 < waypoints.length; ++i) {
    const dx = waypoints[i + 1]!.x - waypoints[i]!.x;
    const dz = waypoints[i + 1]!.z - waypoints[i]!.z;
    const stretch = Math.hypot(dx, dz);
    if (stretch <= MIN_SEGMENT)
      throw new Error(`path waypoints ${i} and ${i + 1} coincide in XZ`);
    segments.push({
      x: waypoints[i]!.x,
      z: waypoints[i]!.z,
      dirX: dx / stretch,
      dirZ: dz / stretch,
      yawDeg: Math.atan2(dx, dz) * RAD2DEG,
      length: stretch,
      from,
    });
    from += stretch;
  }
  return segments;
};

/**
 * Half-width of the yaw blend at each corner (indexed by the segment the corner
 * starts): capped so adjacent corners' windows never overlap past a stretch
 * midpoint. Index 0 (the path start) has no corner.
 */
const cornerHalfWindows = (
  segments: readonly ISegment[],
  turnWindow: number,
): number[] => {
  const halves = [0];
  for (let i = 1; i < segments.length; ++i)
    halves.push(
      Math.min(
        turnWindow / 2,
        segments[i - 1]!.length / 2,
        segments[i]!.length / 2,
      ),
    );
  return halves;
};

/** The stretch containing arc length `s`; boundaries go to the earlier one. */
const segmentIndexAt = (segments: readonly ISegment[], s: number): number => {
  for (let i = 0; i + 1 < segments.length; ++i)
    if (s <= segments[i]!.from + segments[i]!.length) return i;
  return segments.length - 1;
};

/** Facing at arc length `s`, linearly blended inside a corner window. */
const yawAt = (
  segments: readonly ISegment[],
  halfWindows: readonly number[],
  s: number,
): number => {
  const k = segmentIndexAt(segments, s);
  const seg = segments[k]!;
  if (k + 1 < segments.length) {
    const corner = seg.from + seg.length;
    const half = halfWindows[k + 1]!;
    if (half > 0 && s >= corner - half)
      return blendYaw(
        seg.yawDeg,
        segments[k + 1]!.yawDeg,
        (s - (corner - half)) / (2 * half),
      );
  }
  if (k > 0) {
    const corner = seg.from;
    const half = halfWindows[k]!;
    if (half > 0 && s < corner + half)
      return blendYaw(
        segments[k - 1]!.yawDeg,
        seg.yawDeg,
        (s - (corner - half)) / (2 * half),
      );
  }
  return seg.yawDeg;
};

/** Blend from `a` toward `b` (degrees) along the shortest angular arc. */
const blendYaw = (a: number, b: number, t: number): number =>
  a + (((((b - a) % 360) + 540) % 360) - 180) * t;

/** Ground height at a plan point: scalar plane, callback, or flat 0. */
const groundHeightAt = (
  ground: AutoMoviePathGround | undefined,
  x: number,
  z: number,
): number => {
  if (ground === undefined) return 0;
  if (typeof ground === "number") return ground;
  const y = ground(x, z);
  if (!Number.isFinite(y))
    throw new Error(`path ground height at (${x}, ${z}) must be finite`);
  return y;
};
