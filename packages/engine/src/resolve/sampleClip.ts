import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieTrack,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { channelIsRotation, channelKey } from "./channel";

/** One channel's value sampled at an instant, with the channel it targets. */
export interface IAutoMovieSampledChannel {
  /** The channel this value belongs to. */
  channel: IAutoMovieChannel;

  /** The sampled value, one number per channel component. */
  value: number[];
}

/**
 * The SAMPLE pass: evaluate every track of a clip at time `seconds`, returning
 * the sampled value of each channel keyed by {@link channelKey}.
 *
 * This is the engine's bridge from the sparse keyframes an LLM (or an imported
 * glTF) emits to the dense per-frame channel values the rest of the pipeline
 * (constrain → compose) consumes — the universal generalization of the
 * humanoid-only {@link sampleMotion}: a track may drive a node's TRS, morph
 * weights, a camera FOV, or any pointer-addressed property, and they all sample
 * identically.
 *
 * Time is normalized to the clip: clamped to `[0, duration]`, or wrapped modulo
 * `duration` when the clip `loop`s. A track with a single keyframe (or sampled
 * before its first / after its last key) yields that key's value verbatim.
 *
 * @author Samchon
 */
export const sampleClip = (
  clip: IAutoMovieClip,
  seconds: number,
): Map<string, IAutoMovieSampledChannel> => {
  validateSampleTime(seconds, clip.duration);
  const time = normalizeTime(seconds, clip.duration, clip.loop);
  const out = new Map<string, IAutoMovieSampledChannel>();
  for (const track of clip.tracks)
    out.set(channelKey(track.channel), {
      channel: track.channel,
      value: sampleTrack(track, time),
    });
  return out;
};

/**
 * Sample one track at an already-normalized `time`. Splits on interpolation
 * mode: `step` holds the left key, `linear` lerps (slerp for rotations), and
 * `cubicspline` evaluates the glTF cubic Hermite spline from the keyframes'
 * tangents.
 */
const sampleTrack = (track: IAutoMovieTrack, time: number): number[] => {
  const { times, values, interpolation, channel } = track;
  const key = channelKey(channel);
  validateTrackShape(track, key);

  const cubic = interpolation === "cubicspline";
  // Stored stride per keyframe; cubicspline stores in-tangent/value/out-tangent.
  const stride = values.length / times.length;
  const width = cubic ? stride / 3 : stride;

  // For cubicspline the value sits between the two tangents, offset by `width`.
  const valueAt = (i: number): number[] => {
    const base = i * stride + (cubic ? width : 0);
    return values.slice(base, base + width);
  };

  if (time <= times[0]!) return valueAt(0);
  const lastIdx = times.length - 1;
  if (time >= times[lastIdx]!) return valueAt(lastIdx);

  let lo = 0;
  for (let i = 0; i < lastIdx; ++i)
    if (time >= times[i]! && time <= times[i + 1]!) {
      lo = i;
      break;
    }
  const hi = lo + 1;
  const span = times[hi]! - times[lo]!;
  const localT = (time - times[lo]!) / span;

  if (interpolation === "step") return valueAt(lo);
  if (cubic) return cubicHermite(track, lo, hi, span, localT, width, stride);
  return channelIsRotation(channel)
    ? slerpArray(valueAt(lo), valueAt(hi), localT)
    : lerpArray(valueAt(lo), valueAt(hi), localT);
};

/**
 * GlTF cubic-spline (Hermite) evaluation between keyframes `lo` and `hi`. Each
 * keyframe stores `[inTangent, value, outTangent]`; the spline uses `lo`'s
 * out-tangent and `hi`'s in-tangent, scaled by the segment's `span`. Rotation
 * results are renormalized (interpolated quaternions drift off the unit
 * sphere).
 */
const cubicHermite = (
  track: IAutoMovieTrack,
  lo: number,
  hi: number,
  span: number,
  t: number,
  width: number,
  stride: number,
): number[] => {
  const { values, channel } = track;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const out = new Array<number>(width);
  for (let c = 0; c < width; ++c) {
    const vLo = values[lo * stride + width + c]!;
    const bLo = values[lo * stride + 2 * width + c]!;
    const vHi = values[hi * stride + width + c]!;
    const aHi = values[hi * stride + c]!;
    out[c] = h00 * vLo + h10 * span * bLo + h01 * vHi + h11 * span * aHi;
  }
  return channelIsRotation(channel) ? normalizeQuatArray(out) : out;
};

const lerpArray = (a: number[], b: number[], t: number): number[] =>
  a.map((v, i) => v + (b[i]! - v) * t);

const slerpArray = (a: number[], b: number[], t: number): number[] => {
  const q = Quaternion.slerp(
    { x: a[0]!, y: a[1]!, z: a[2]!, w: a[3]! },
    { x: b[0]!, y: b[1]!, z: b[2]!, w: b[3]! },
    t,
  );
  return [q.x, q.y, q.z, q.w];
};

const normalizeQuatArray = (q: number[]): number[] => {
  const n = Quaternion.normalize({ x: q[0]!, y: q[1]!, z: q[2]!, w: q[3]! });
  return [n.x, n.y, n.z, n.w];
};

const validateSampleTime = (seconds: number, duration: number): void => {
  if (!Number.isFinite(seconds))
    throw new Error(`sampleClip seconds must be finite, but was ${seconds}`);
  if (!Number.isFinite(duration))
    throw new Error(
      `sampleClip clip duration must be finite, but was ${duration}`,
    );
};

const validateTrackShape = (track: IAutoMovieTrack, key: string): void => {
  const { times, values, interpolation } = track;
  if (times.length === 0)
    throw new Error(`track "${key}" must have keyframes to sample`);
  if (values.length === 0)
    throw new Error(`track "${key}" values must not be empty`);
  for (let i = 0; i < values.length; ++i)
    if (!Number.isFinite(values[i]!))
      throw new Error(
        `track "${key}" values[${i}] must be finite, but was ${values[i]!}`,
      );

  for (const time of times)
    if (!Number.isFinite(time))
      throw new Error(`track "${key}" keyframe times must be finite`);

  for (let i = 1; i < times.length; ++i)
    if (times[i]! <= times[i - 1]!)
      throw new Error(
        `track "${key}" keyframe times must be strictly increasing`,
      );

  const stride = values.length / times.length;
  if (!Number.isInteger(stride))
    throw new Error(
      `track "${key}" values length must divide evenly by keyframe count`,
    );
  if (interpolation === "cubicspline" && stride % 3 !== 0)
    throw new Error(`track "${key}" cubicspline stride must be divisible by 3`);
};

/** Clamp (or wrap, when looping) a query time into the clip's duration. */
const normalizeTime = (
  seconds: number,
  duration: number,
  loop: boolean,
): number => {
  if (duration <= 0) return 0;
  if (loop) {
    const m = seconds % duration;
    return m < 0 ? m + duration : m;
  }
  return Math.min(duration, Math.max(0, seconds));
};
