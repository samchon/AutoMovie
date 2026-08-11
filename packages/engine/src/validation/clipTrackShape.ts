import {
  AutoMovieChannelValueType,
  AutoMovieInterpolation,
  IAutoMovieChannel,
  IAutoMovieConstraintViolation,
} from "@automovie/interface";

/**
 * The node channel arm, and the property set {@link NODE_CHANNEL_PATHS} spans.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `IAutoMovieNodeChannel` narrows track admission to the node-channel arm whose target property playback can reproduce.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `IAutoMovieNodeChannel` preserves the node discriminator and property path declared by one typed clip channel.
 */
export type IAutoMovieNodeChannel = Extract<
  IAutoMovieChannel,
  { kind: "node" }
>;
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
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `IAutoMovieClipShapeFault` carries one concrete reason an unreadable track must be refused before playback.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `IAutoMovieClipShapeFault` separates classification, track member, constraint text, and observation for one invalid clip condition.
 * @author Samchon
 */
export interface IAutoMovieClipShapeFault {
  /**
   * Violation kind the artifact gate reports this fault as.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `kind` assigns the violation category used to refuse this malformed clip condition.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `kind` keeps the refusal class independent from the invalid track member and observation.
   */
  kind: IAutoMovieConstraintViolation["kind"];

  /**
   * Field carrying the fault, relative to the track (or the clip, for
   * {@link clipDurationFault} / {@link clipLoopFault}), e.g. `values`,
   * `times[2]`, `interpolation`. The gate joins it onto its own path; the
   * sampler ignores it, because its message already names the field.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `field` names the malformed member whose state makes the owning clip unreadable.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `field` supplies the relative track segment at which the key-time or payload contract failed.
   */
  field: string;

  /**
   * The fault as a sentence, with no subject: the sampler reads it after `track
   * "<channel key>"`, the gate reads it as a violation's `expected`.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `message` states the track-shape constraint that justifies refusing this clip.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `message` remains subject-free so sampler and artifact gate apply the same refusal rule.
   */
  message: string;

  /**
   * The offending value, for the violation record. A fault about a dense
   * payload's SHAPE reports the quantity that offends (a length, a stride)
   * rather than the payload: echoing hundreds of floats back spends the
   * client's context to repeat what it just sent (#1362).
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `value` retains the decisive observation that made this clip condition invalid.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `value` records the failing quantity without echoing an entire dense keyframe payload.
   */
  value: unknown;
}

/**
 * The interpolation modes {@link sampleClip} implements.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation `TRACK_INTERPOLATIONS` enumerates the interpolation modes implemented by the clip sampler.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `TRACK_INTERPOLATIONS` keeps sampler support and track admission attached to the same interpolation identities.
 */
export const TRACK_INTERPOLATIONS = new Set<AutoMovieInterpolation>([
  "step",
  "linear",
  "cubicspline",
]);

/**
 * The node properties a channel may address. `channelKey` refuses anything else
 * (it can build no key for it) and the artifact gate refuses it too, so a clip
 * cannot be committed naming a property the pipeline has no writer for.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `NODE_CHANNEL_PATHS` enumerates the node target properties admitted before an unsupported clip address reaches playback.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `NODE_CHANNEL_PATHS` ties track admission to the concrete properties that playback can write.
 */
export const NODE_CHANNEL_PATHS = new Set<IAutoMovieNodeChannel["path"]>([
  "translation",
  "rotation",
  "scale",
  "weights",
]);

/**
 * The pointer value types a channel may declare.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation `CHANNEL_VALUE_TYPES` names the typed pointer payloads whose interpolation semantics a track may declare.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `CHANNEL_VALUE_TYPES` bounds pointer-channel interpretation before its per-key value stride is checked.
 */
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
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `channelValueWidth` derives the required component count used to refuse a mismatched track payload.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `channelValueWidth` returns only the per-key stride fixed by the declared node property or pointer type.
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

/**
 * A clip's duration as the sampler requires it: finite and non-negative.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `clipDurationFault` refuses a clip whose duration is not a finite non-negative number.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `clipDurationFault` returns the observed duration with the time-domain constraint required by key sampling.
 */
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
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-loop-trim `clipLoopFault` refuses a non-boolean loop declaration before truthiness can silently change boundary sampling.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `clipLoopFault` preserves the observed loop payload beside the explicit wrap-or-clamp contract.
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
 * Every field is read as `unknown`, because a stored track carries whatever
 * JSON it carries. A field of the wrong TYPE yields no fault here, because the
 * caller reading that JSON reports it separately and one mistake earns one
 * violation.
 *
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal `clipTrackShapeFaults` enumerates every malformed track condition that must prevent clip playback.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation `clipTrackShapeFaults` preserves sampler discovery order so the artifact gate refuses the same unreadable keyframe state.
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
  const cubic = interpolation === "cubicspline";
  const expected = channelValueWidth(channel);
  // What ONE keyframe occupies on this channel: its width, tripled for
  // `cubicspline`, which stores in-tangent / value / out-tangent per keyframe.
  // `undefined` for a `weights` channel, whose width is the model's morph
  // target count and therefore not the track's to state.
  const perKeyframe = (channelWidth: number): number =>
    cubic ? channelWidth * 3 : channelWidth;
  // Every number this fault judges rides the message (#1362). It used to say
  // only the rule ("divide evenly"), and the sibling check that names the width
  // sits below the `return` this fault takes, so the author most lost was the
  // one told least: four consecutive commits failed to converge on a 67-frame
  // trajectory because nothing stated 67, 195, or the 201 that would satisfy
  // it. The width belongs HERE rather than one check later, because the width
  // arithmetic below is meaningless on a fractional stride, so continuing would
  // report a computed width that is not a real one.
  const stride = values.length / times.length;
  if (!Number.isInteger(stride)) {
    faults.push({
      kind: "type",
      field: "values",
      message:
        `values length must divide evenly by keyframe count ${times.length}, but ${values.length} does not` +
        (expected === undefined
          ? ""
          : `; this channel carries ${perKeyframe(expected)} per keyframe, so values must hold ${perKeyframe(expected) * times.length}`),
      // The LENGTH, not the array: a dense track echoed hundreds of floats back
      // into the client's context to say nothing the message did not.
      value: values.length,
    });
    return faults;
  }
  if (cubic && stride % 3 !== 0) {
    faults.push({
      kind: "type",
      field: "values",
      message: `cubicspline stride must be divisible by 3, but ${values.length} values / ${times.length} times gives ${stride}`,
      value: values.length,
    });
    return faults;
  }
  const width = cubic ? stride / 3 : stride;
  if (expected !== undefined && width !== expected)
    faults.push({
      kind: "type",
      field: "values",
      message: `value width must be ${expected}, but was ${width}; ${values.length} values / ${times.length} times must be ${perKeyframe(expected) * times.length}`,
      value: values.length,
    });
  return faults;
};
