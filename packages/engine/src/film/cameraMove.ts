import {
  IAutoMovieCamera,
  IAutoMovieCameraAction,
  IAutoMovieClip,
  IAutoMovieQuaternion,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { ease } from "../motion/easing";

/** World up — the horizon a camera keeps level. */
const UP: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };

/**
 * The rotation that points a camera's −Z down `direction` while keeping its
 * horizon level (world-up stabilized) — what a shortest-arc `aimRotation`
 * cannot do: the shortest arc from −Z rolls the frame on off-axis aims, which
 * the demo's orbit shot exposed as a tilted horizon. Standard look-at basis (x
 * = up × z, y = z × x) converted to a quaternion; aiming straight up/down
 * degenerates the cross product, so +Z steps in as the reference.
 */
export const lookRotation = (
  direction: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const z = Vector3.scale(Vector3.normalize(direction), -1); // camera +Z = back
  let x = Vector3.cross(UP, z);
  if (Vector3.length(x) < 1e-6) x = Vector3.cross({ x: 0, y: 0, z: 1 }, z);
  x = Vector3.normalize(x);
  const y = Vector3.cross(z, x);
  // Basis → quaternion (Shepperd's method, w-branch first). The usual
  // x-major branch is provably unreachable here: this basis keeps x
  // horizontal, so x.x = z.z/h and y.y = h ≥ 0 (h = |(z.x, z.z)|), and
  // x.x > y.y forces trace = x.x + y.y + z.z > 0 — the w-branch already
  // took it. Only w / y-major / z-major remain.
  const trace = x.x + y.y + z.z;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return Quaternion.normalize({
      w: s / 4,
      x: (y.z - z.y) / s,
      y: (z.x - x.z) / s,
      z: (x.y - y.x) / s,
    });
  }
  if (y.y > z.z) {
    const s = Math.sqrt(1 + y.y - x.x - z.z) * 2;
    return Quaternion.normalize({
      w: (z.x - x.z) / s,
      x: (y.x + x.y) / s,
      y: s / 4,
      z: (z.y + y.z) / s,
    });
  }
  const s = Math.sqrt(1 + z.z - x.x - y.y) * 2;
  return Quaternion.normalize({
    w: (x.y - y.x) / s,
    x: (z.x + x.z) / s,
    y: (z.y + y.z) / s,
    z: s / 4,
  });
};

/**
 * The framing grammar: how much vertical world-space the frame shows, as a
 * multiple of the subject's height. `close` fills the frame with head and
 * shoulders; `wide` shows the subject small in its surroundings.
 */
export const FRAMING_HEIGHT_FRACTION: Record<
  IAutoMovieCameraAction["framing"],
  number
> = { wide: 4, full: 1.15, medium: 0.62, close: 0.28 };

/**
 * Where on the subject the camera aims, as a fraction of its height: a close
 * shot looks at the head, a full shot at the middle of the body.
 */
export const FRAMING_AIM_FRACTION: Record<
  IAutoMovieCameraAction["framing"],
  number
> = { wide: 0.5, full: 0.5, medium: 0.72, close: 0.85 };

/** Stand-in height when the subject has no skeleton to measure. */
export const DEFAULT_SUBJECT_HEIGHT = 1.7;

/** A whip pan snaps to its new aim in this many seconds. */
const WHIP_SECONDS = 0.2;

/** An orbit sweeps this arc over its span, sampled at this many segments. */
const ORBIT_DEGREES = 45;
const ORBIT_SEGMENTS = 8;

/** A push-in dollies from this to this multiple of the framed distance. */
const PUSH_IN_FROM = 1.25;
const PUSH_IN_TO = 0.8;

/** A push-in eases in/out over this many segments (a smooth dolly, not a ramp). */
const PUSH_IN_SEGMENTS = 8;

/** Follow moves sample the subject's animated base at this rate (Hz). */
const FOLLOW_HZ = 4;

/**
 * What a `frame` action points the camera at, resolved by the caller: the
 * subject's base (ground) point, its measured height, and — when the subject is
 * an actor with compiled motion — its animated base over shot time (base plus
 * the clip's root displacement). `at: null` means the subject holds still; a
 * `follow` move on it degenerates to a static framing.
 *
 * @author Samchon
 */
export interface IAutoMovieFramedSubject {
  /** Base (ground) point at the move's start. */
  base: IAutoMovieVector3;

  /** Subject height in meters (drives framing distance and aim height). */
  height: number;

  /** Animated base over shot-local seconds, or null when static. */
  at: ((seconds: number) => IAutoMovieVector3) | null;
}

/** One `frame` action paired with its resolved subject. */
export interface IAutoMovieCameraFrameEntry {
  action: IAutoMovieCameraAction;
  subject: IAutoMovieFramedSubject;
}

/**
 * Compile a shot's `frame` actions into the live camera's motion clip — the
 * deterministic shot grammar: **framing** picks the distance (the fraction of
 * the subject's height the frame shows, fitted to the camera's vertical FOV by
 * `d = (visible/2) / tan(fovY/2)`) and the aim height; **move** picks the path
 * — `static` locks the framed position, `push-in` dollies from 1.25× to 0.8× of
 * the framed distance, `orbit` sweeps 45° around the subject, `follow`
 * re-frames against the subject's animated base, and `whip` pans in place from
 * the staged orientation onto the subject.
 *
 * The camera approaches along its **staged bearing** — the direction from the
 * subject's aim point to where staging placed the camera — so the side the
 * director chose is preserved; only the distance is solved. Consecutive entries
 * are keyed back to back, so the sampler's linear interpolation plays the gap
 * between two framings as a deliberate re-frame move.
 *
 * Entries must be sorted by `start` and non-overlapping (the shot compiler
 * gates that); returns null when there is nothing to compile.
 */
export const compileCameraMove = (props: {
  clipId: string;
  camera: IAutoMovieCamera;
  entries: IAutoMovieCameraFrameEntry[];
  shotDuration: number;
}): IAutoMovieClip | null => {
  const { clipId, camera, entries, shotDuration } = props;
  if (entries.length === 0) return null;

  const keys: {
    t: number;
    pos: IAutoMovieVector3;
    rot: IAutoMovieQuaternion;
  }[] = [];
  const push = (
    t: number,
    pos: IAutoMovieVector3,
    rot: IAutoMovieQuaternion,
  ): void => {
    const last = keys[keys.length - 1];
    // Two moves may abut on the same instant; the later framing wins the key
    // (a zero-width span would divide the sampler's local time by zero).
    if (last !== undefined && t <= last.t + 1e-9)
      keys[keys.length - 1] = { t: last.t, pos, rot };
    else keys.push({ t, pos, rot });
  };

  entries.forEach((entry, i) => {
    const { action, subject } = entry;
    const t0 = action.start;
    const t1 =
      action.duration === "auto"
        ? (entries[i + 1]?.action.start ?? shotDuration)
        : Math.min(t0 + action.duration, shotDuration);

    const aimFraction = FRAMING_AIM_FRACTION[action.framing];
    const aimOffset = subject.height * aimFraction;
    const aimOf = (base: IAutoMovieVector3): IAutoMovieVector3 => ({
      x: base.x,
      y: base.y + aimOffset,
      z: base.z,
    });
    const aim0 = aimOf(subject.base);

    const visible = subject.height * FRAMING_HEIGHT_FRACTION[action.framing];
    const distance =
      visible / 2 / Math.tan(((camera.fovY / 2) * Math.PI) / 180);

    // The staged bearing: subject → staged camera. A camera staged exactly on
    // the aim point has no bearing; fall back to +Z so the solve stays total.
    const toCamera = Vector3.subtract(camera.transform.translation, aim0);
    const bearing =
      Vector3.length(toCamera) < 1e-9
        ? { x: 0, y: 0, z: 1 }
        : Vector3.normalize(toCamera);

    const framedAt = (
      base: IAutoMovieVector3,
      d: number,
    ): { pos: IAutoMovieVector3; rot: IAutoMovieQuaternion } => {
      const aim = aimOf(base);
      const pos = Vector3.add(aim, Vector3.scale(bearing, d));
      return { pos, rot: lookRotation(Vector3.subtract(aim, pos)) };
    };

    switch (action.move) {
      case "static": {
        const k = framedAt(subject.base, distance);
        push(t0, k.pos, k.rot);
        break;
      }
      case "push-in": {
        // Ease the dolly in and out instead of ramping at constant speed: the
        // distance eases from 1.25× to 0.8× of framed, so the camera creeps in,
        // accelerates, and settles — a cinematic push, not a mechanical slide.
        for (let k = 0; k <= PUSH_IN_SEGMENTS; ++k) {
          const p = k / PUSH_IN_SEGMENTS;
          const scale =
            PUSH_IN_FROM + (PUSH_IN_TO - PUSH_IN_FROM) * ease("easeInOut", p);
          const f = framedAt(subject.base, distance * scale);
          push(t0 + (t1 - t0) * p, f.pos, f.rot);
        }
        break;
      }
      case "orbit": {
        // Ease the swept angle in and out (not the radius or the endpoints): the
        // orbit creeps off its mark, accelerates through the mid-arc, and settles
        // onto the far bearing — a reveal orbit, not a turntable at constant rate.
        for (let k = 0; k <= ORBIT_SEGMENTS; ++k) {
          const p = k / ORBIT_SEGMENTS;
          const swing = Quaternion.fromAxisAngle(
            { x: 0, y: 1, z: 0 },
            ORBIT_DEGREES * ease("easeInOut", p),
          );
          const u = Quaternion.rotateVector(swing, bearing);
          const pos = Vector3.add(aim0, Vector3.scale(u, distance));
          push(
            t0 + (t1 - t0) * p,
            pos,
            lookRotation(Vector3.subtract(aim0, pos)),
          );
        }
        break;
      }
      case "follow": {
        if (subject.at === null) {
          const k = framedAt(subject.base, distance);
          push(t0, k.pos, k.rot);
          break;
        }
        const steps = Math.max(2, Math.ceil((t1 - t0) * FOLLOW_HZ) + 1);
        for (let k = 0; k < steps; ++k) {
          const t = t0 + ((t1 - t0) * k) / (steps - 1);
          const f = framedAt(subject.at(t), distance);
          push(t, f.pos, f.rot);
        }
        break;
      }
      case "whip": {
        const k = framedAt(subject.base, distance);
        push(t0, camera.transform.translation, camera.transform.rotation);
        push(
          Math.min(t0 + WHIP_SECONDS, t1),
          camera.transform.translation,
          lookRotation(Vector3.subtract(aim0, camera.transform.translation)),
        );
        // Whip pans in place — the framed distance is not honored; `k` exists
        // only to keep the framing math total for future dolly-after-whip.
        void k;
        break;
      }
    }
  });

  return {
    id: clipId,
    name: null,
    duration: shotDuration,
    loop: false,
    tracks: [
      {
        channel: { kind: "node", node: camera.id, path: "translation" },
        times: keys.map((k) => k.t),
        values: keys.flatMap((k) => [k.pos.x, k.pos.y, k.pos.z]),
        interpolation: "linear",
      },
      {
        channel: { kind: "node", node: camera.id, path: "rotation" },
        times: keys.map((k) => k.t),
        values: keys.flatMap((k) => [k.rot.x, k.rot.y, k.rot.z, k.rot.w]),
        interpolation: "linear",
      },
    ],
  };
};

/**
 * A skeleton's rest-pose height: compose each bone's rest transform down the
 * parent chain (rotation and translation; rigs keep unit scale) and take the
 * world-Y extent. This is the subject height the framing grammar measures
 * distance from — the same "measure from the rig, not hope" doctrine as
 * staging's reach/stride.
 */
export const computeRestHeight = (skeleton: IAutoMovieSkeleton): number => {
  const byName = new Map(skeleton.bones.map((b) => [b.bone, b]));
  const world = new Map<
    string,
    { pos: IAutoMovieVector3; rot: IAutoMovieQuaternion }
  >();
  const resolve = (
    name: (typeof skeleton.bones)[number]["bone"],
  ): { pos: IAutoMovieVector3; rot: IAutoMovieQuaternion } => {
    const cached = world.get(name);
    if (cached !== undefined) return cached;
    const bone = byName.get(name)!;
    const frame =
      bone.parent === null
        ? { pos: bone.rest.translation, rot: bone.rest.rotation }
        : (() => {
            const parent = resolve(bone.parent);
            return {
              pos: Vector3.add(
                parent.pos,
                Quaternion.rotateVector(parent.rot, bone.rest.translation),
              ),
              rot: Quaternion.multiply(parent.rot, bone.rest.rotation),
            };
          })();
    world.set(name, frame);
    return frame;
  };
  let min = Infinity;
  let max = -Infinity;
  for (const bone of skeleton.bones) {
    const y = resolve(bone.bone).pos.y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return skeleton.bones.length === 0 ? 0 : max - min;
};
