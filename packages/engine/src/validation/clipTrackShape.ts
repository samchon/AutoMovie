import {
  AutoMovieChannelValueType,
  AutoMovieInterpolation,
  IAutoMovieChannel,
  IAutoMovieConstraintViolation,
} from "@automovie/interface";

type IAutoMovieNodeChannel = Extract<IAutoMovieChannel, { kind: "node" }>;
type IAutoMoviePointerChannel = Extract<IAutoMovieChannel, { kind: "pointer" }>;

/**
 * What a well-formed clip track IS, stated once for the two sides that must
 * never disagree about it (#1353).
 *
 * `sampleClip` refuses a malformed track by THROWING (a track it cannot read is
 * an engine-level defect once every gate has run), while the artifact gate
 * refuses one by returning a located violation. Those are two failure modes of
 * one rule, and holding the rule twice is what let the gate learn a single one
 * of the sampler's checks: #1331 taught it strictly increasing times, and an
 * uneven `values` stride, an empty keyframe list, a wrong value width, an
 * unsupported interpolation, a non-triplet `cubicspline` stride, a non-boolean
 * `loop`, and an unknown node channel path all still validated clean,
 * committed, persisted, and threw out of the engine at playback.
 *
 * So the rule lives here as data, and each side formats it in its own voice:
 * the sampler prefixes the track's channel key and throws the first fault, the
 * gate appends every fault at `<track path>.<field>`.
 *
 * @author Samchon
 */
export interface IAutoMovieClipShapeFault {
  /** Violation kind the artifact gate reports this fault as. */
  kind: IAutoMovieConstraintViolation["kind"];

  /**
   * Field carrying the fault, relative to the track (or the clip, for
   * {@link clipDurationFaults} / {@link clipLoopFault}), e.g. `values`,
   * `times[2]`, `interpolation`. The gate joins it onto its own path; the
   * sampler ignores it, because its message already names the field.
   */
  field: string;

  /**
   * The fault as a sentence, with no subject: the sampler reads it after `track
   * "<channel key>"`, the gate reads it as a violation's `expected`.
   */
  message: string;

  /** The offending value, for the violation record. */
  value: unknown;
}

/** The interpolation modes {@link sampleClip} implements. */
export const TRACK_INTERPOLATIONS = new Set<AutoMovieInterpolation>([
  "step",
  "linear",
  "cubicspline",
]);

/**
 * The node properties a channel may address. `channelKey` refuses anything else
 * (it can build no key for it) and the artifact gate refuses it too, so a clip
 * cannot be committed naming a property the pipeline has no writer for.
 */
export const NODE_CHANNEL_PATHS = new Set<IAutoMovieNodeChannel["path"]>([
  "translation",
  "rotation",
  "scale",
  "weights",
]);

/** The pointer value types a channel may declare. */
export const CHANNEL_VALUE_TYPES = new Set<AutoMovieChannelValueType>([
  "scalar",
  "vec2",
  "vec3",
  "vec4",
  "quaternion",
  "weights",
]);

/**
 * Per-keyframe value width of the channels that fix one. `weights` is absent
 * from both tables on purpose: a morph-target vector is as wide as the model
 * has targets, so no width can be asserted for it.
 */
const NODE_CHANNEL_WIDTHS: Partial<
  Record<IAutoMovieNodeChannel["path"], number>
> = {
  translation: 3,
  rotation: 4,
  scale: 3,
};

const CHANNEL_VALUE_WIDTHS: Partial<
  Record<IAutoMoviePointerChannel["valueType"], number>
> = {
  scalar: 1,
  vec2: 2,
  vec3: 3,
  vec4: 4,
  quaternion: 4,
};

/**
 * The per-keyframe value width this channel fixes, or `undefined` when it fixes
 * none (a `weights` channel, or a channel too malformed to read one from).
 *
 * Total over `unknown`: the gate reads channels off stored JSON, where the
 * discriminator itself may be anything.
 */
export const channelValueWidth = (channel: unknown): number | undefined => {
  if (typeof channel !== "object" || channel === null) return undefined;
  const record = channel as Record<string, unknown>;
  if (record.kind === "node")
    return NODE_CHANNEL_WIDTHS[record.path as IAutoMovieNodeChannel["path"]];
  if (record.kind === "pointer")
    return CHANNEL_VALUE_WIDTHS[
      record.valueType as IAutoMoviePointerChannel["valueType"]
    ];
  return undefined;
};

/** A clip's duration as the sampler requires it: finite and non-negative. */
export const clipDurationFault = (
  duration: unknown,
): IAutoMovieClipShapeFault | null => {
  if (typeof duration !== "number" || !Number.isFinite(duration))
    return {
      kind: "range",
      field: "duration",
      message: `duration must be finite, but was ${String(duration)}`,
      value: duration,
    };
  if (duration < 0)
    return {
      kind: "range",
      field: "duration",
      message: `duration must be non-negative, but was ${duration}`,
      value: duration,
    };
  return null;
};

/**
 * The `loop` flag, which decides whether a query time wraps or clamps. A
 * non-boolean would take that branch on JavaScript truthiness, so a clip
 * carrying `"false"` would loop.
 *
 * Separate from {@link clipDurationFault} because the artifact gate applies a
 * STRICTER duration rule than the sampler (a committed clip must last longer
 * than zero seconds, `validateClipArtifact`), and a gate stricter than the
 * sampler cannot let a throw escape. Only the looser direction is a defect.
 */
export const clipLoopFault = (
  loop: unknown,
): IAutoMovieClipShapeFault | null =>
  typeof loop === "boolean"
    ? null
    : {
        kind: "type",
        field: "loop",
        message: `loop must be boolean, but was ${String(loop)}`,
        value: loop,
      };

/**
 * Every way one track's keyframe payload can be unreadable, in the order
 * {@link sampleClip} discovers them (its first throw is this list's first
 * entry).
 *
 * Total over `unknown`: `times`/`values`/`channel` may be any JSON. A field of
 * the wrong TYPE yields no fault here, because the caller that reads stored
 * JSON reports that separately and one mistake earns one violation.
 */
export const clipTrackShapeFaults = (
  /**
   * Structural rather than {@link IAutoMovieTrack}, so both callers pass their
   * own value without a cast and without a re-check: the gate has already
   * narrowed a stored track to a record, the sampler holds the typed one.
   */
  track: {
    times?: unknown;
    values?: unknown;
    interpolation?: unknown;
    channel?: unknown;
  },
  duration: unknown,
): IAutoMovieClipShapeFault[] => {
  const faults: IAutoMovieClipShapeFault[] = [];
  const { times, values, interpolation, channel } = track;

  if (!TRACK_INTERPOLATIONS.has(interpolation as AutoMovieInterpolation))
    faults.push({
      kind: "type",
      field: "interpolation",
      message: `interpolation "${String(interpolation)}" is not supported`,
      value: interpolation,
    });
  if (!Array.isArray(times) || !Array.isArray(values)) return faults;

  if (times.length === 0)
    faults.push({
      kind: "type",
      field: "times",
      message: "must have keyframes to sample",
      value: times,
    });
  if (values.length === 0)
    faults.push({
      kind: "type",
      field: "values",
      message: "values must not be empty",
      value: values,
    });

  values.forEach((value, i) => {
    if (!Number.isFinite(value))
      faults.push({
        kind: "range",
        field: `values[${i}]`,
        message: `values[${i}] must be finite, but was ${String(value)}`,
        value,
      });
  });

  // The clock, per keyframe. The sampler checks only the FIRST time's sign and
  // the LAST time against the duration, which is equivalent once the times are
  // strictly increasing; checking every entry says which one is wrong when they
  // are not, and refuses nothing an increasing list would have passed.
  const bounded =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration
      : null;
  times.forEach((time, i) => {
    if (typeof time !== "number" || !Number.isFinite(time))
      faults.push({
        kind: "temporal",
        field: `times[${i}]`,
        message: `keyframe times must be finite, but times[${i}] was ${String(time)}`,
        value: time,
      });
    else if (time < 0)
      faults.push({
        kind: "temporal",
        field: `times[${i}]`,
        message: `keyframe times must be non-negative, but times[${i}] was ${time}`,
        value: time,
      });
    else if (bounded !== null && time > bounded)
      faults.push({
        kind: "temporal",
        field: `times[${i}]`,
        message: `keyframe times must be within clip duration ${bounded}, but times[${i}] was ${time}`,
        value: time,
      });
  });

  let previous: number | null = null;
  times.forEach((time, i) => {
    if (typeof time !== "number" || !Number.isFinite(time)) return;
    if (previous !== null && time <= previous)
      faults.push({
        kind: "temporal",
        field: `times[${i}]`,
        message: `keyframe times must be strictly increasing; ${time} is not greater than ${previous}`,
        value: time,
      });
    previous = time;
  });

  // The stride the sampler slices each keyframe's value by. Everything below it
  // is arithmetic on that stride, so a stride that is not a whole number ends
  // the analysis: the widths it would imply are meaningless.
  if (times.length === 0 || values.length === 0) return faults;
  const stride = values.length / times.length;
  if (!Number.isInteger(stride)) {
    faults.push({
      kind: "type",
      field: "values",
      message: "values length must divide evenly by keyframe count",
      value: values,
    });
    return faults;
  }
  const cubic = interpolation === "cubicspline";
  if (cubic && stride % 3 !== 0) {
    faults.push({
      kind: "type",
      field: "values",
      message: "cubicspline stride must be divisible by 3",
      value: values,
    });
    return faults;
  }
  const width = cubic ? stride / 3 : stride;
  const expected = channelValueWidth(channel);
  if (expected !== undefined && width !== expected)
    faults.push({
      kind: "type",
      field: "values",
      message: `value width must be ${expected}, but was ${width}`,
      value: values,
    });
  return faults;
};
