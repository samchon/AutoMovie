import {
  AutoMovieHumanoidBone,
  IAutoMovieCamera,
  IAutoMovieCameraAction,
  IAutoMovieCameraIntent,
  IAutoMovieClip,
  IAutoMovieModel,
  IAutoMovieQuaternion,
  IAutoMovieShotCoverage,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { tessellate } from "../geometry/tessellate";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { ease } from "../motion/easing";

/** World up: the horizon a camera keeps level. */
const UP: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };

/**
 * The rotation that points a camera's −Z down `direction` while keeping its
 * horizon level (world-up stabilized), what a shortest-arc `aimRotation` cannot
 * do: the shortest arc from −Z rolls the frame on off-axis aims, which the
 * demo's orbit shot exposed as a tilted horizon. Standard look-at basis (x = up
 * × z, y = z × x) converted to a quaternion; aiming straight up/down
 * degenerates the cross product, so +Z steps in as the reference.
 *
 * @evidence requirements/camera/scope-and-identity.md#camera-spatial-state-binding Constructs a world-up-stabilized quaternion that points camera −Z at the authored direction without rolling the horizon.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding lookRotation realizes explicit camera spatial binding: The rotation that points a camera's −Z down `direction` while keeping its horizon level (world-up stabilized), what a shortest-arc `aimRotation` cannot do: the shortest arc from −Z rolls the frame on off-axis aims, which the demo's orbit shot exposed as a tilted horizon. Standard look-at basis (x = up × z, y = z × x) converted to a quaternion; aiming straight up/down degenerates the cross product, so +Z steps in as the reference.
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
  // x.x > y.y forces trace = x.x + y.y + z.z > 0. The w-branch already
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
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing FRAMING_HEIGHT_FRACTION drives required-landmark framing: The framing grammar: how much vertical world-space the frame shows, as a multiple of the subject's height. `close` fills the frame with head and shoulders; `wide` shows the subject small in its surroundings.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations FRAMING_HEIGHT_FRACTION realizes landmark-based framing: The framing grammar: how much vertical world-space the frame shows, as a multiple of the subject's height. `close` fills the frame with head and shoulders; `wide` shows the subject small in its surroundings.
 */
export const FRAMING_HEIGHT_FRACTION: Record<
  IAutoMovieCameraAction["framing"],
  number
> = { wide: 4, full: 1.15, medium: 0.62, close: 0.28 };

/**
 * Where on the subject the camera aims, as a fraction of its height: a close
 * shot looks at the head, a full shot at the middle of the body.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing FRAMING_AIM_FRACTION drives required-landmark framing: Where on the subject the camera aims, as a fraction of its height: a close shot looks at the head, a full shot at the middle of the body.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations FRAMING_AIM_FRACTION realizes landmark-based framing: Where on the subject the camera aims, as a fraction of its height: a close shot looks at the head, a full shot at the middle of the body.
 */
export const FRAMING_AIM_FRACTION: Record<
  IAutoMovieCameraAction["framing"],
  number
> = { wide: 0.5, full: 0.5, medium: 0.72, close: 0.85 };

/**
 * Stand-in height when the subject has no skeleton to measure.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing DEFAULT_SUBJECT_HEIGHT drives required-landmark framing: Stand-in height when the subject has no skeleton to measure.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations DEFAULT_SUBJECT_HEIGHT realizes landmark-based framing: Stand-in height when the subject has no skeleton to measure.
 */
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

/** A truck crosses one solved framing distance along the camera's screen-left. */
const TRUCK_DISTANCE = 1;
const TRUCK_SEGMENTS = 8;

/** Follow moves sample the subject's animated base at this rate (Hz). */
const FOLLOW_HZ = 4;

/**
 * What a `frame` action points the camera at, resolved by the caller: the
 * subject's base (ground) point, its measured height, and, when the subject has
 * an actor or effective object motion, its animated base over shot time. `at:
 * null` means the subject holds still; a `follow` move on it degenerates to a
 * static framing.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedSubject drives required-landmark framing: What a `frame` action points the camera at, resolved by the caller: the subject's base (ground) point, its measured height, and, when the subject has an actor or effective object motion, its animated base over shot time. `at: null` means the subject holds still; a `follow` move on it degenerates to a static framing.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedSubject realizes landmark-based framing: What a `frame` action points the camera at, resolved by the caller: the subject's base (ground) point, its measured height, and, when the subject has an actor or effective object motion, its animated base over shot time. `at: null` means the subject holds still; a `follow` move on it degenerates to a static framing.
 * @author Samchon
 */
export interface IAutoMovieFramedSubject {
  /**
   * Base (ground) point at the move's start.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedSubject.base drives required-landmark framing: Base (ground) point at the move's start.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedSubject.base realizes landmark-based framing: Base (ground) point at the move's start.
   */
  base: IAutoMovieVector3;

  /**
   * Subject height in meters (drives framing distance and aim height).
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedSubject.height drives required-landmark framing: Subject height in meters (drives framing distance and aim height).
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedSubject.height realizes landmark-based framing: Subject height in meters (drives framing distance and aim height).
   */
  height: number;

  /**
   * Half the subject's widest horizontal span about {@link base}, in meters.
   *
   * Measured from what the subject draws, on every subject that draws anything:
   * a mass from its members' union, a single node from its model's own rest box
   * ({@link computeModelRestExtent}). Height alone decides a distance only when
   * nothing horizontal could be measured, which is what an absent or zero value
   * states.
   *
   * The fit is `max(vertical, horizontal)`, so a measured width changes a
   * framing only where it demands the further stand: for a raster of aspect `a`
   * that is `width > height * a`. A figure never reaches it — it is taller than
   * it is wide at every shot size — which is why solving a person from height
   * alone was right and stays byte-identical. A mass and a building both do
   * reach it: two thousand figures on a field are a hundred meters across and
   * one and a half tall, and a 60 m facade is 24 m high, and framing either from
   * height alone puts the camera where one person would fill the frame while the
   * subject runs off both edges.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedSubject.radius supplies the horizontal half-span the framing solve must contain when subject width demands more distance than height.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedSubject.radius realizes landmark-based framing: Half the subject's widest horizontal span about {@link base}, in meters. Measured from what the subject draws, on every subject that draws anything: a mass from its members' union, a single node from its model's own rest box. Height alone decides a distance only when nothing horizontal could be measured, which is what an absent or zero value states. The fit is max(vertical, horizontal), so a measured width changes a framing only where it demands the further stand: for a raster of aspect a that is width > height * a. A figure never reaches it — it is taller than it is wide at every shot size — which is why solving a person from height alone was right and stays byte-identical. A mass and a building both do reach it: two thousand figures on a field are a hundred meters across and one and a half tall, and a 60 m facade is 24 m high, and framing either from height alone puts the camera where one person would fill the frame while the subject runs off both edges.
   */
  radius?: number;

  /**
   * Animated base over shot-local seconds, or null when static.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieFramedSubject.at drives required-landmark framing: Animated base over shot-local seconds, or null when static.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieFramedSubject.at realizes landmark-based framing: Animated base over shot-local seconds, or null when static.
   */
  at: ((seconds: number) => IAutoMovieVector3) | null;
}

/**
 * One `frame` action paired with its resolved subject.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieCameraFrameEntry drives required-landmark framing: One `frame` action paired with its resolved subject.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieCameraFrameEntry realizes landmark-based framing: One `frame` action paired with its resolved subject.
 */
export interface IAutoMovieCameraFrameEntry {
  /**
   * Authored camera action whose framing and move are compiled.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieCameraFrameEntry.action drives required-landmark framing: Authored camera action whose framing and move are compiled.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieCameraFrameEntry.action realizes landmark-based framing: Authored camera action whose framing and move are compiled.
   */
  action: IAutoMovieCameraAction;
  /**
   * Resolved subject extent and trajectory used by the framing solve.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieCameraFrameEntry.subject drives required-landmark framing: Resolved subject extent and trajectory used by the framing solve.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieCameraFrameEntry.subject realizes landmark-based framing: Resolved subject extent and trajectory used by the framing solve.
   */
  subject: IAutoMovieFramedSubject;
}

/**
 * Compile a shot's `frame` actions into the live camera's motion clip, the
 * deterministic shot grammar: **framing** picks the distance (the fraction of
 * the subject's extent the frame shows, fitted to the camera's field of view by
 * `d = (visible/2) / tan(half-angle)`, vertically against the subject's height
 * and horizontally against its width, whichever demands the greater distance)
 * and the aim height; **move** picks the path: `static` locks the framed
 * position, `push-in` dollies from 1.25× to 0.8× of the framed distance,
 * `orbit` sweeps 45° around the subject, `follow` re-frames against the
 * subject's animated base, and `whip` pans in place from the staged orientation
 * onto the subject.
 *
 * The camera approaches along its **staged bearing** (the direction from the
 * subject's aim point to where staging placed the camera), so the side the
 * director chose is preserved; only the distance is solved. Consecutive entries
 * are keyed back to back, so the sampler's linear interpolation plays the gap
 * between two framings as a deliberate re-frame move.
 *
 * Entries must be sorted by `start` and non-overlapping (the shot compiler
 * gates that); returns null when there is nothing to compile.
 *
 * @param props.aspect Frame width over height, for the horizontal half of the
 *   fit. A camera states only its VERTICAL field of view, so the raster is the
 *   only thing that knows how wide the frame is, and a subject with a measured
 *   `radius` cannot be fitted across the frame without it. Omitted, the solve
 *   assumes a square frame: the widest subject any raster of that height could
 *   fail to hold, so an unknown aspect pulls back far enough rather than
 *   cropping a mass it could not measure. A subject with no `radius` is
 *   unaffected either way.
 * @evidence requirements/camera/position-and-movement.md#camera-path-time-sampling Fits authored subjects through the declared lens and emits camera keyframes at each framing span on the shot clock.
 * @evidence requirements/camera/position-and-movement.md#camera-speed-easing Samples push-in, orbit, and truck moves at fixed bounded segment counts and applies the same `easeInOut` curve to their authored progress.
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-sampling Samples a moving framed subject through `subject.at(t)` at each emitted truck or follow key time instead of reusing its opening position.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-camera-path-direct-sampling compileCameraMove resolves the authored camera move at explicit shot-local times, making the camera path directly sampleable.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Resolves the framed subject at the same shot-local instant used to emit each camera transform; it does not claim a target-loss transition policy.
 */
export const compileCameraMove = (props: {
  clipId: string;
  camera: IAutoMovieCamera;
  entries: IAutoMovieCameraFrameEntry[];
  shotDuration: number;
  aspect?: number;
}): IAutoMovieClip | null => {
  const { clipId, camera, entries, shotDuration } = props;
  if (entries.length === 0) return null;
  const halfY = Math.tan(((camera.fovY / 2) * Math.PI) / 180);
  // A non-finite or non-positive aspect describes no raster; the square
  // assumption above is what an absent one already means, so they agree.
  const aspect =
    props.aspect !== undefined &&
    Number.isFinite(props.aspect) &&
    props.aspect > 0
      ? props.aspect
      : 1;
  const halfX = halfY * aspect;

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

    if (
      !Object.prototype.hasOwnProperty.call(
        FRAMING_AIM_FRACTION,
        action.framing,
      )
    )
      throw new Error(`unknown camera framing "${String(action.framing)}"`);
    const framing = action.framing as keyof typeof FRAMING_AIM_FRACTION;
    const aimFraction = FRAMING_AIM_FRACTION[framing];
    const aimOffset = subject.height * aimFraction;
    const aimOf = (base: IAutoMovieVector3): IAutoMovieVector3 => ({
      x: base.x,
      y: base.y + aimOffset,
      z: base.z,
    });
    const aim0 = aimOf(subject.base);

    // Fit both ways and take the demanding one. The framing grammar states how
    // much of the frame the subject fills; for a figure that is a question
    // about height, and for a mass it is a question about width, so the frame
    // has to hold `fraction` times each of them and the camera stands at
    // whichever distance is the further back. `radius` is absent or zero for
    // every subject that is one body, which leaves the vertical fit alone and
    // the solved distance byte-identical to what it has always been.
    const fraction = FRAMING_HEIGHT_FRACTION[framing];
    const width = (subject.radius ?? 0) * 2;
    const distance = Math.max(
      (subject.height * fraction) / 2 / halfY,
      (width * fraction) / 2 / halfX,
    );

    // The staged bearing: subject → staged camera. A camera staged exactly on
    // the aim point has no bearing; fall back to +Z so the solve stays total.
    const toCamera = Vector3.subtract(camera.transform.translation, aim0);
    const bearing =
      Vector3.length(toCamera) < 1e-9
        ? { x: 0, y: 0, z: 1 }
        : Vector3.normalize(toCamera);
    // Horizontal screen-left under the staged bearing. A vertically staged
    // camera has no horizontal side from that bearing, so keep the move total
    // with the conventional world -X fallback.
    const side = Vector3.cross(bearing, UP);
    const screenLeft =
      Vector3.length(side) < 1e-9
        ? { x: -1, y: 0, z: 0 }
        : Vector3.normalize(side);

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
        // accelerates, and settles: a cinematic push, not a mechanical slide.
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
        // onto the far bearing: a reveal orbit, not a turntable at constant rate.
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
      case "truck": {
        // A lateral truck preserves the staged depth axis (movement is
        // perpendicular to `bearing`) while its look-at rotation keeps the
        // subject framed. "truck" is screen-left; stage the camera on the
        // reverse side when the composition calls for rightward travel.
        for (let k = 0; k <= TRUCK_SEGMENTS; ++k) {
          const p = k / TRUCK_SEGMENTS;
          const t = t0 + (t1 - t0) * p;
          const base = subject.at?.(t) ?? subject.base;
          const aim = aimOf(base);
          const framed = framedAt(base, distance);
          const pos = Vector3.add(
            framed.pos,
            Vector3.scale(
              screenLeft,
              distance * TRUCK_DISTANCE * ease("easeInOut", p),
            ),
          );
          push(t, pos, lookRotation(Vector3.subtract(aim, pos)));
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
        // Whip pans in place. The framed distance is not honored; `k` exists
        // only to keep the framing math total for future dolly-after-whip.
        void k;
        break;
      }
      default:
        throw new Error(`unknown camera frame move "${String(action.move)}"`);
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
 * One `frame` action paired with its resolved subject and its resolved intent
 * record: the bundle a coverage take compiles from. Carrying the intent beside
 * the action keeps the take's `cameraIntent` in one-to-one correspondence with
 * the spans its `cameraMotion` plays, by construction.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieCameraCoverageEntry drives required-landmark framing: One `frame` action paired with its resolved subject and its resolved intent record: the bundle a coverage take compiles from. Carrying the intent beside the action keeps the take's `cameraIntent` in one-to-one correspondence with the spans its `cameraMotion` plays, by construction.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieCameraCoverageEntry realizes landmark-based framing: One `frame` action paired with its resolved subject and its resolved intent record: the bundle a coverage take compiles from. Carrying the intent beside the action keeps the take's `cameraIntent` in one-to-one correspondence with the spans its `cameraMotion` plays, by construction.
 */
export interface IAutoMovieCameraCoverageEntry extends IAutoMovieCameraFrameEntry {
  /**
   * This span's resolved intent record (as the hero take's entries emit).
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing IAutoMovieCameraCoverageEntry.intent drives required-landmark framing: This span's resolved intent record (as the hero take's entries emit).
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations IAutoMovieCameraCoverageEntry.intent realizes landmark-based framing: This span's resolved intent record (as the hero take's entries emit).
   */
  intent: IAutoMovieCameraIntent;
}

/**
 * Compile one beat's coverage take (#1187): the alternate angle another staged
 * camera plays over the beat, paired with its per-span intent as one
 * {@link IAutoMovieShotCoverage} record. The move compiles through the same
 * {@link compileCameraMove} framing grammar the hero take uses (the camera is a
 * parameter, so a side camera's staged bearing frames its own angle), and the
 * deterministic solve stays the only consumer of the geometry: the intent
 * records ride as guide metadata, never back into the math.
 *
 * Entries carry the same precondition as the hero take's: sorted by `start`,
 * non-overlapping (the shot compiler gates that). An empty list is a locked-off
 * covering camera: `cameraMotion: null`, no intent spans, the same convention
 * as a shot with no `frame` action.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing Compiles an alternate staged camera and its per-span intent through the same subject-framing solver as the hero take.
 * @evidence requirements/camera/scope-and-identity.md#camera-shot-distinction Keeps the alternate camera id and motion separate from the hero shot camera while compiling both from the same beat.
 * @evidence requirements/camera/scope-and-identity.md#camera-take-lineage Carries each coverage take's camera id, motion, and ordered intent spans without merging them into the elected hero take.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations compileCameraCoverage realizes landmark-based framing: Compile one beat's coverage take (#1187): the alternate angle another staged camera plays over the beat, paired with its per-span intent as one {@link IAutoMovieShotCoverage} record. The move compiles through the same {@link compileCameraMove} framing grammar the hero take uses (the camera is a parameter, so a side camera's staged bearing frames its own angle), and the deterministic solve stays the only consumer of the geometry: the intent records ride as guide metadata, never back into the math. Entries carry the same precondition as the hero take's: sorted by `start`, non-overlapping (the shot compiler gates that). An empty list is a locked-off covering camera: `cameraMotion: null`, no intent spans, the same convention as a shot with no `frame` action.
 * @evidence specifications/camera-light-and-visibility/camera-state-projection-and-gate.md#clv-camera-authority-spatial-binding Preserves one independent camera identity and timed intent record for the coverage branch while retaining the common shot source.
 */
export const compileCameraCoverage = (props: {
  camera: IAutoMovieCamera;
  clipId: string;
  entries: IAutoMovieCameraCoverageEntry[];
  shotDuration: number;
  /** Frame width over height, as {@link compileCameraMove} reads it. */
  aspect?: number;
}): IAutoMovieShotCoverage => ({
  camera: props.camera.id,
  cameraMotion: compileCameraMove({
    clipId: props.clipId,
    camera: props.camera,
    entries: props.entries,
    shotDuration: props.shotDuration,
    aspect: props.aspect,
  }),
  cameraIntent: props.entries.map((entry) => entry.intent),
});

/**
 * A skeleton's rest-pose joint span: compose each bone's rest transform down
 * the parent chain (rotation and translation; rigs keep unit scale) and take
 * the world-Y extent of the joints.
 *
 * This is the span between the extreme **joints**, which is not the subject's
 * height and must not be used as one. A rig ends at the joints it needs for
 * animation, and geometry continues past them at both ends: the generated
 * `stickman` puts its highest joint at 0.92 of the declared height and its
 * lowest at 0.24, so this returns 0.680 of the real figure. Framing solved from
 * that number crops an actor's head off. {@link computeModelRestExtentY}
 * measures what a renderer actually draws; use it for anything the camera
 * frames, and keep this for questions genuinely about the rig.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing computeRestHeight derives the skeleton's rest-pose vertical landmark span used when framing a rigged subject.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations computeRestHeight realizes landmark-based framing: A skeleton's rest-pose joint span: compose each bone's rest transform down the parent chain (rotation and translation; rigs keep unit scale) and take the world-Y extent of the joints. This is the span between the extreme **joints**, which is not the subject's height and must not be used as one. A rig ends at the joints it needs for animation, and geometry continues past them at both ends: the generated `stickman` puts its highest joint at 0.92 of the declared height and its lowest at 0.24, so this returns 0.680 of the real figure. Framing solved from that number crops an actor's head off. {@link computeModelRestExtentY} measures what a renderer actually draws; use it for anything the camera frames, and keep this for questions genuinely about the rig.
 */
export const computeRestHeight = (skeleton: IAutoMovieSkeleton): number => {
  if (skeleton.bones.length === 0) return 0;
  const world = restWorldFrames(skeleton);
  let min = Infinity;
  let max = -Infinity;
  for (const bone of skeleton.bones) {
    const y = world.get(bone.bone)!.pos.y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return max - min;
};

/** One bone's rest-pose placement in model space. */
interface IRestFrame {
  pos: IAutoMovieVector3;
  rot: IAutoMovieQuaternion;
}

/**
 * Every bone's rest-pose model-space frame, composed down the parent chain.
 * Rigs keep unit scale, so translation and rotation are the whole transform.
 */
const restWorldFrames = (
  skeleton: IAutoMovieSkeleton,
): ReadonlyMap<AutoMovieHumanoidBone, IRestFrame> => {
  const byName = new Map<
    AutoMovieHumanoidBone,
    { bone: (typeof skeleton.bones)[number]; index: number }
  >();
  skeleton.bones.forEach((bone, index) => {
    const existing = byName.get(bone.bone);
    if (existing !== undefined)
      throw new Error(
        `skeleton "${skeleton.id}" bone "${bone.bone}" is duplicated at bones[${index}].bone; first declared at bones[${existing.index}].bone`,
      );
    byName.set(bone.bone, { bone, index });
  });
  const world = new Map<AutoMovieHumanoidBone, IRestFrame>();
  const resolving = new Set<AutoMovieHumanoidBone>();
  const resolve = (name: AutoMovieHumanoidBone): IRestFrame => {
    const cached = world.get(name);
    if (cached !== undefined) return cached;
    if (resolving.has(name))
      throw new Error(
        `skeleton "${skeleton.id}" bone parent cycle includes "${name}"`,
      );
    const entry = byName.get(name);
    if (entry === undefined)
      throw new Error(
        `skeleton "${skeleton.id}" bone "${name}" was not provided`,
      );
    resolving.add(name);
    try {
      const bone = entry.bone;
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
    } finally {
      resolving.delete(name);
    }
  };
  for (const bone of skeleton.bones) resolve(bone.bone);
  return world;
};

/**
 * A model's rest-pose vertical extent in model space: the world-Y range of the
 * geometry a renderer would actually draw.
 *
 * This is the subject height the framing grammar needs, and the reason it is
 * not {@link computeRestHeight}. A rig stops at the joints animation requires;
 * the figure does not. The generated `stickman` has no foot bone and no
 * head-top bone, so its joint span is 0.680 of the declared height, and a
 * `full` shot solved from that number shows an actor from the shins up.
 *
 * Every part is placed the way the renderer places it — its own transform, then
 * its attached bone's rest frame, or model space when it rides no bone — and
 * primitives are measured through {@link tessellate}, the same code that
 * produces the vertices, so the extent cannot drift from the picture. Returns
 * null when a model has nothing to measure, leaving the caller's own fallback
 * in charge rather than inventing a height.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing computeModelRestExtentY measures drawn geometry in model space so landmark framing uses the subject's visible vertical extent.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations computeModelRestExtentY realizes landmark-based framing: A model's rest-pose vertical extent in model space: the world-Y range of the geometry a renderer would actually draw. This is the subject height the framing grammar needs, and the reason it is not {@link computeRestHeight}. A rig stops at the joints animation requires; the figure does not. The generated `stickman` has no foot bone and no head-top bone, so its joint span is 0.680 of the declared height, and a `full` shot solved from that number shows an actor from the shins up. Every part is placed the way the renderer places it — its own transform, then its attached bone's rest frame, or model space when it rides no bone — and primitives are measured through {@link tessellate}, the same code that produces the vertices, so the extent cannot drift from the picture. Returns null when a model has nothing to measure, leaving the caller's own fallback in charge rather than inventing a height.
 */
export const computeModelRestExtentY = (
  model: IAutoMovieModel,
): { min: number; max: number } | null => {
  const extent = computeModelRestExtent(model);
  return extent === null ? null : { min: extent.min.y, max: extent.max.y };
};

/**
 * A model's rest-pose box in model space: the axis-aligned range of the geometry
 * a renderer would actually draw, on all three axes.
 *
 * {@link computeModelRestExtentY} is this measurement read on one axis, and the
 * two are the same traversal for the reason the vertical one gives: every part
 * is placed the way the renderer places it, and primitives are measured through
 * {@link tessellate}, the code that produces the vertices, so the extent cannot
 * drift from the picture.
 *
 * The horizontal half is what a subject wider than it is tall is framed and
 * graded from. A figure is taller than it is wide at every shot size, so its
 * width never decides its distance; a building element is the opposite, and a
 * 60 m facade authored outward from its element origin has a drawn box of
 * `x 0…60, y 0…24, z −1…1` where the vertical read alone reports only
 * `y 0…24`. Returns null when a model has nothing to measure, leaving the
 * caller's own fallback in charge rather than inventing an extent.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing computeModelRestExtent measures drawn geometry in model space on all three axes so landmark framing uses the subject's visible horizontal extent as well as its vertical one.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations computeModelRestExtent realizes landmark-based framing: A model's rest-pose box in model space: the axis-aligned range of the geometry a renderer would actually draw, on all three axes. computeModelRestExtentY is this measurement read on one axis, and the two are the same traversal for the reason the vertical one gives: every part is placed the way the renderer places it, and primitives are measured through tessellate, the code that produces the vertices, so the extent cannot drift from the picture. The horizontal half is what a subject wider than it is tall is framed and graded from. A figure is taller than it is wide at every shot size, so its width never decides its distance; a building element is the opposite, and a 60 m facade authored outward from its element origin has a drawn box of x 0…60, y 0…24, z −1…1 where the vertical read alone reports only y 0…24. Returns null when a model has nothing to measure, leaving the caller's own fallback in charge rather than inventing an extent.
 */
export const computeModelRestExtent = (
  model: IAutoMovieModel,
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } | null => {
  const frames =
    model.skeleton === null ? null : restWorldFrames(model.skeleton);
  const min: IAutoMovieVector3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: IAutoMovieVector3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const part of model.parts) {
    const positions =
      part.geometry.type === "primitive"
        ? tessellate(part.geometry.shape).positions
        : part.geometry.mesh.positions;
    const local = part.transform;
    const frame =
      part.attachedBone === null ? undefined : frames?.get(part.attachedBone);
    for (let index = 0; index + 2 < positions.length; index += 3) {
      const point: IAutoMovieVector3 = {
        x: positions[index]!,
        y: positions[index + 1]!,
        z: positions[index + 2]!,
      };
      const placed =
        local === null ? point : placeTransformedPoint(local, point);
      const world =
        frame === undefined
          ? placed
          : Vector3.add(frame.pos, Quaternion.rotateVector(frame.rot, placed));
      if (world.x < min.x) min.x = world.x;
      if (world.y < min.y) min.y = world.y;
      if (world.z < min.z) min.z = world.z;
      if (world.x > max.x) max.x = world.x;
      if (world.y > max.y) max.y = world.y;
      if (world.z > max.z) max.z = world.z;
    }
  }
  return min.y === Infinity ? null : { min, max };
};

/**
 * Apply one TRS transform to a point, scale first, as a renderer does.
 *
 * Exported because the same arithmetic places a model's parts for measurement
 * and carries a measured model box out into the world a camera frames it in. A
 * second copy is how the box a shot is graded against comes to disagree with
 * the box it was solved from.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-landmark-framing placeTransformedPoint applies one placement to a measured landmark point so framing reads geometry where the renderer draws it.
 * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations placeTransformedPoint realizes landmark-based framing: Apply one TRS transform to a point, scale first, as a renderer does. Exported because the same arithmetic places a model's parts for measurement and carries a measured model box out into the world a camera frames it in. A second copy is how the box a shot is graded against comes to disagree with the box it was solved from.
 */
export const placeTransformedPoint = (
  transform: IAutoMovieTransform,
  point: IAutoMovieVector3,
): IAutoMovieVector3 =>
  Vector3.add(
    transform.translation,
    Quaternion.rotateVector(transform.rotation, {
      x: point.x * transform.scale.x,
      y: point.y * transform.scale.y,
      z: point.z * transform.scale.z,
    }),
  );
