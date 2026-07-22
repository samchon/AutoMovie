import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieTrack,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { segmentIndex } from "../math/bisect";
import { cubicHermiteValue } from "../math/cubicHermite";
import {
  clipDurationFault,
  clipLoopFault,
  clipTrackShapeFaults,
} from "../validation/clipTrackShape";
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
 * (constrain → compose) consumes, the universal generalization of the
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
  validateSampleTime(seconds, clip.duration, clip.loop);
  const time = normalizeTime(seconds, clip.duration, clip.loop);
  const out = new Map<string, IAutoMovieSampledChannel>();
  for (const track of clip.tracks) {
    const key = channelKey(track.channel);
    if (out.has(key)) throw new Error(`duplicate track channel "${key}"`);
    out.set(key, {
      channel: track.channel,
      value: sampleTrack(track, time, clip.duration),
    });
  }
  return out;
};

/**
 * Sample a sequence of clips under shot-time channel authority.
 *
 * Authority is selected independently for every channel: among tracks whose
 * first key has started by `seconds`, the track with the latest first key wins;
 * equal starts go to the later clip in producer order. A future track writes
 * nothing, instead of letting {@link sampleClip}'s before-first-key clamp
 * overwrite the authority that is currently in effect.
 *
 * @author Samchon
 */
export const sampleClipSequence = (
  clips: readonly IAutoMovieClip[],
  seconds: number,
): Map<string, IAutoMovieSampledChannel> => {
  if (!Number.isFinite(seconds))
    throw new Error(
      `sampleClipSequence seconds must be finite, but was ${seconds}`,
    );
  const sampledByClip = new Map(
    clips.map((clip) => [clip, sampleClip(clip, seconds)] as const),
  );
  const authority = new Map<string, { start: number; clip: IAutoMovieClip }>();
  for (const clip of clips)
    for (const track of clip.tracks) {
      const start = track.times[0]!;
      if (start > seconds) continue;
      const key = channelKey(track.channel);
      const previous = authority.get(key);
      if (previous === undefined || start >= previous.start)
        authority.set(key, { start, clip });
    }

  const out = new Map<string, IAutoMovieSampledChannel>();
  for (const [key, entry] of authority) {
    out.set(key, sampledByClip.get(entry.clip)!.get(key)!);
  }
  return out;
};

/**
 * Sample one track at an already-normalized `time`. Splits on interpolation
 * mode: `step` holds the left key, `linear` lerps (slerp for rotations), and
 * `cubicspline` evaluates the glTF cubic Hermite spline from the keyframes'
 * tangents.
 */
const sampleTrack = (
  track: IAutoMovieTrack,
  time: number,
  duration: number,
): number[] => {
  const { times, values, interpolation, channel } = track;
  const key = channelKey(channel);
  validateTrackShape(track, key, duration);

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

  // Strictly increasing times (validateTrackShape) let the binary search land on
  // the straddling segment; its tie rule matches the old linear scan exactly.
  const lo = segmentIndex(times.length, (i) => times[i]!, time);
  const hi = lo + 1;
  const span = times[hi]! - times[lo]!;
  const localT = (time - times[lo]!) / span;

  // glTF STEP holds v_k for t_k <= t < t_{k+1}: an EXACT hit on the right key
  // (the bisect tie resolves it into the segment ENDING there, localT = 1)
  // belongs to the segment STARTING at that key (#1054). The fixed sampling
  // clock lands exactly on frame-aligned keys, so without this every step
  // change played one sample late, and asymmetrically to `ease("step", 1)`.
  if (interpolation === "step") return localT >= 1 ? valueAt(hi) : valueAt(lo);
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
  const out = new Array<number>(width);
  for (let c = 0; c < width; ++c) {
    const vLo = values[lo * stride + width + c]!;
    const bLo = values[lo * stride + 2 * width + c]!;
    const vHi = values[hi * stride + width + c]!;
    const aHi = values[hi * stride + c]!;
    out[c] = cubicHermiteValue(vLo, bLo, vHi, aHi, span, t);
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

/**
 * The clip's own shape, plus the query time. Duration and `loop` come from the
 * shared contract ({@link clipDurationFault}, {@link clipLoopFault}), so the
 * artifact gate that exists to spare a consumer this throw refuses exactly what
 * would reach it (#1353).
 */
const validateSampleTime = (
  seconds: number,
  duration: number,
  loop: boolean,
): void => {
  if (!Number.isFinite(seconds))
    throw new Error(`sampleClip seconds must be finite, but was ${seconds}`);
  const fault = clipDurationFault(duration) ?? clipLoopFault(loop);
  if (fault !== null) throw new Error(`sampleClip clip ${fault.message}`);
};

/**
 * One track's keyframe payload, read through the shared contract. The sampler
 * throws its FIRST fault: reaching an unreadable track means every gate in
 * front of this one let it through, which is an engine defect rather than an
 * authoring one, and one sentence is what a stack trace can carry (#1353).
 */
const validateTrackShape = (
  track: IAutoMovieTrack,
  key: string,
  duration: number,
): void => {
  const fault = clipTrackShapeFaults(track, duration)[0];
  if (fault !== undefined) throw new Error(`track "${key}" ${fault.message}`);
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
