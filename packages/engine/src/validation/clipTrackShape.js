/** The interpolation modes {@link sampleClip} implements. */
export const TRACK_INTERPOLATIONS = new Set([
    "step",
    "linear",
    "cubicspline",
]);
/**
 * The node properties a channel may address. `channelKey` refuses anything else
 * (it can build no key for it) and the artifact gate refuses it too, so a clip
 * cannot be committed naming a property the pipeline has no writer for.
 */
export const NODE_CHANNEL_PATHS = new Set([
    "translation",
    "rotation",
    "scale",
    "weights",
]);
/** The pointer value types a channel may declare. */
export const CHANNEL_VALUE_TYPES = new Set([
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
const NODE_CHANNEL_WIDTHS = {
    translation: 3,
    rotation: 4,
    scale: 3,
};
const CHANNEL_VALUE_WIDTHS = {
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
export const channelValueWidth = (channel) => {
    if (typeof channel !== "object" || channel === null)
        return undefined;
    const record = channel;
    if (record.kind === "node")
        return NODE_CHANNEL_WIDTHS[record.path];
    if (record.kind === "pointer")
        return CHANNEL_VALUE_WIDTHS[record.valueType];
    return undefined;
};
/** A clip's duration as the sampler requires it: finite and non-negative. */
export const clipDurationFault = (duration) => {
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
export const clipLoopFault = (loop) => typeof loop === "boolean"
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
 */
export const clipTrackShapeFaults = (
/**
 * Structural rather than {@link IAutoMovieTrack}, so both callers pass their
 * own value without a cast and without a re-check: the gate has already
 * narrowed a stored track to a record, the sampler holds the typed one.
 */
track, duration) => {
    const faults = [];
    const { times, values, interpolation, channel } = track;
    if (!TRACK_INTERPOLATIONS.has(interpolation))
        faults.push({
            kind: "type",
            field: "interpolation",
            message: `interpolation "${String(interpolation)}" is not supported`,
            value: interpolation,
        });
    if (!Array.isArray(times) || !Array.isArray(values))
        return faults;
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
    const bounded = typeof duration === "number" && Number.isFinite(duration) && duration > 0
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
    let previous = null;
    times.forEach((time, i) => {
        if (typeof time !== "number" || !Number.isFinite(time))
            return;
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
    if (times.length === 0 || values.length === 0)
        return faults;
    const cubic = interpolation === "cubicspline";
    const expected = channelValueWidth(channel);
    // What ONE keyframe occupies on this channel: its width, tripled for
    // `cubicspline`, which stores in-tangent / value / out-tangent per keyframe.
    // `undefined` for a `weights` channel, whose width is the model's morph
    // target count and therefore not the track's to state.
    const perKeyframe = (channelWidth) => cubic ? channelWidth * 3 : channelWidth;
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
            message: `values length must divide evenly by keyframe count ${times.length}, but ${values.length} does not` +
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
//# sourceMappingURL=clipTrackShape.js.map