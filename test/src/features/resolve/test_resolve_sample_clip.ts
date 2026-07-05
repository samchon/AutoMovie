import { sampleClip } from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieClip,
  IAutoMovieTrack,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, qclose, throwsError } from "../internal/predicates";

const NODE = (
  path: "translation" | "rotation" | "scale" | "weights",
): IAutoMovieChannel => ({ kind: "node", node: "n", path });

const PTR: IAutoMovieChannel = {
  kind: "pointer",
  pointer: "/x",
  valueType: "scalar",
};

const track = (
  channel: IAutoMovieChannel,
  times: number[],
  values: number[],
  interpolation: IAutoMovieTrack["interpolation"],
): IAutoMovieTrack => ({ channel, times, values, interpolation });

const clip = (
  tracks: IAutoMovieTrack[],
  duration: number,
  loop = false,
): IAutoMovieClip => ({ id: "c", name: null, duration, loop, tracks });

const val = (c: IAutoMovieClip, t: number, key: string): number[] => {
  const hit = sampleClip(c, t).get(key);
  if (hit === undefined) throw new Error(`${key} missing`);
  return hit.value;
};

const close = (a: number[], b: number[], eps = 1e-6): boolean =>
  a.length === b.length && a.every((v, i) => nclose(v, b[i]!, eps));

/**
 * The SAMPLE pass across every interpolation mode, channel width, and the
 * time-normalization branches a real clip exercises.
 *
 * Scenarios:
 *
 * 1. Linear interpolation of a vec3 translation: 0→(10,20,30) at t=0.5 is
 *    (5,10,15); the result keys to `node:n:translation`.
 * 2. Step interpolation holds the left keyframe: the same span at t=0.5 stays at
 *    the start value (0,0,0).
 * 3. A linear rotation track slerps (not lerps): identity→90°-about-Y at t=0.5 is
 *    the 45° quaternion, and stays unit length.
 * 4. Cubicspline with zero tangents reduces to the Hermite blend of the values:
 *    0→10 at t=0.5 is 5 (the `[in,value,out]` triplet layout is read
 *    correctly).
 * 5. Cubicspline on a rotation renormalizes the drifted result to a unit
 *    quaternion.
 * 6. Sampling before the first keyframe time (which is > 0) returns the first
 *    value; sampling at/after the last returns the last.
 * 7. A single-keyframe track returns that key at any time.
 * 8. A three-keyframe track samples the _interior_ segment (selecting [1,2], not
 *    [0,1]) — the segment search advances past the first pair.
 * 9. A looping clip wraps the query time into `[0, duration)`: t=1.25 → 0.25 and a
 *    negative t=−0.25 → 0.75.
 * 10. A non-looping clip clamps past the end (t=5 on a 1s clip → the last value),
 *     and a zero-duration clip normalizes any time to 0.
 * 11. A forged non-boolean `loop` flag rejects before JavaScript truthiness can
 *     change wrap/clamp semantics.
 * 12. A forged interpolation mode rejects instead of falling through to linear.
 * 13. Fixed-width channels reject tracks whose flattened value width does not match
 *     the channel's declared width, while `weights` remains variable-width.
 * 14. Negative timeline values reject instead of being normalized into a
 *     zero-duration or pre-roll sample.
 * 15. Tracks on positive-duration clips reject keyframes after the declared clip
 *     end.
 */
export const test_resolve_sample_clip = (): void => {
  // 1. linear vec3
  const lin = clip(
    [track(NODE("translation"), [0, 1], [0, 0, 0, 10, 20, 30], "linear")],
    1,
  );
  TestValidator.predicate(
    "linear vec3 midpoint",
    close(val(lin, 0.5, "node:n:translation"), [5, 10, 15]),
  );

  // 2. step holds left
  const stepClip = clip(
    [track(NODE("translation"), [0, 1], [0, 0, 0, 10, 20, 30], "step")],
    1,
  );
  TestValidator.predicate(
    "step holds left keyframe",
    close(val(stepClip, 0.5, "node:n:translation"), [0, 0, 0]),
  );

  const weights = clip(
    [track(NODE("weights"), [0, 1], [0, 0, 1, 1], "linear")],
    1,
  );
  TestValidator.predicate(
    "weights channel accepts variable width",
    close(val(weights, 0.5, "node:n:weights"), [0.5, 0.5]),
  );

  // 3. linear rotation slerps
  const s = Math.SQRT1_2;
  const rot = clip(
    [track(NODE("rotation"), [0, 1], [0, 0, 0, 1, 0, s, 0, s], "linear")],
    1,
  );
  const half = val(rot, 0.5, "node:n:rotation");
  const c225 = Math.cos(Math.PI / 8);
  const s225 = Math.sin(Math.PI / 8);
  TestValidator.predicate(
    "linear rotation slerps to the 45° quaternion",
    qclose(
      { x: half[0]!, y: half[1]!, z: half[2]!, w: half[3]! },
      { x: 0, y: s225, z: 0, w: c225 },
    ),
  );

  // 4. cubicspline scalar, zero tangents → Hermite blend
  const cubic = clip(
    [track(PTR, [0, 1], [0, 0, 0, 0, 10, 0], "cubicspline")],
    1,
  );
  TestValidator.predicate(
    "cubicspline zero-tangent midpoint",
    close(val(cubic, 0.5, "ptr:/x"), [5]),
  );
  // sampling a cubicspline track at/after its end reads the keyframe value
  // through the [in, value, out] triplet offset (not the interior Hermite path)
  TestValidator.predicate(
    "cubicspline end reads the value past the in-tangent",
    close(val(cubic, 1, "ptr:/x"), [10]),
  );

  // 5. cubicspline rotation renormalizes
  const cubicRot = clip(
    [
      track(
        NODE("rotation"),
        [0, 1],
        [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          s,
          0,
          s,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
        "cubicspline",
      ),
    ],
    1,
  );
  const cr = val(cubicRot, 0.5, "node:n:rotation");
  TestValidator.predicate(
    "cubicspline rotation stays unit length",
    nclose(Math.hypot(cr[0]!, cr[1]!, cr[2]!, cr[3]!), 1),
  );

  // 6. before first (first key time > 0) and at/after last
  const offset = clip([track(PTR, [0.5, 1], [3, 9], "linear")], 1);
  TestValidator.predicate(
    "before first keyframe returns first value",
    close(val(offset, 0.2, "ptr:/x"), [3]),
  );
  TestValidator.predicate(
    "at last keyframe returns last value",
    close(val(offset, 1, "ptr:/x"), [9]),
  );

  // 7. single keyframe
  const single = clip([track(PTR, [0.5], [7], "linear")], 1);
  TestValidator.predicate(
    "single keyframe returns its value",
    close(val(single, 0.5, "ptr:/x"), [7]),
  );

  // 8. interior segment of three keyframes
  const three = clip([track(PTR, [0, 1, 2], [0, 10, 30], "linear")], 2);
  TestValidator.predicate(
    "three-keyframe interior segment",
    close(val(three, 1.5, "ptr:/x"), [20]),
  );

  // 9. looping wrap (positive and negative)
  const loop = clip([track(PTR, [0, 1], [0, 10], "linear")], 1, true);
  TestValidator.predicate(
    "loop wraps t=1.25 to 0.25",
    close(val(loop, 1.25, "ptr:/x"), [2.5]),
  );
  TestValidator.predicate(
    "loop wraps negative t=−0.25 to 0.75",
    close(val(loop, -0.25, "ptr:/x"), [7.5]),
  );

  // 10. clamp past end, and zero-duration
  TestValidator.predicate(
    "non-loop clamps past end to last value",
    close(val(lin, 5, "node:n:translation"), [10, 20, 30]),
  );
  const zero = clip([track(PTR, [0, 1], [4, 8], "linear")], 0);
  TestValidator.predicate(
    "zero-duration normalizes to start",
    close(val(zero, 5, "ptr:/x"), [4]),
  );

  TestValidator.predicate(
    "empty track keyframes reject sampling",
    throwsError(
      () => sampleClip(clip([track(PTR, [], [], "linear")], 1), 0),
      'track "ptr:/x" must have keyframes to sample',
    ),
  );

  TestValidator.predicate(
    "non-finite sample time rejects",
    throwsError(
      () => sampleClip(lin, Number.NaN),
      ["sampleClip seconds", "finite"],
    ),
  );

  TestValidator.predicate(
    "non-finite clip duration rejects",
    throwsError(
      () => sampleClip({ ...lin, duration: Infinity }, 0),
      ["clip duration", "finite"],
    ),
  );

  TestValidator.predicate(
    "negative clip duration rejects",
    throwsError(
      () => sampleClip({ ...lin, duration: -1 }, 0),
      ["clip duration", "non-negative", "-1"],
    ),
  );

  TestValidator.predicate(
    "non-boolean clip loop rejects",
    throwsError(
      () => sampleClip({ ...lin, loop: "false" as unknown as boolean }, 2),
      ["clip loop", "boolean", "false"],
    ),
  );

  TestValidator.predicate(
    "unknown interpolation rejects",
    throwsError(
      () =>
        sampleClip(
          clip(
            [
              track(
                PTR,
                [0, 1],
                [0, 1],
                "bezier" as IAutoMovieTrack["interpolation"],
              ),
            ],
            1,
          ),
          0.5,
        ),
      ['track "ptr:/x"', "interpolation", "bezier"],
    ),
  );

  TestValidator.predicate(
    "track keyframe times reject NaN",
    throwsError(
      () =>
        sampleClip(clip([track(PTR, [0, Number.NaN], [0, 1], "linear")], 1), 0),
      ['track "ptr:/x"', "keyframe times", "finite"],
    ),
  );

  TestValidator.predicate(
    "track keyframe times reject negative start",
    throwsError(
      () => sampleClip(clip([track(PTR, [-0.5, 0.5], [0, 1], "linear")], 1), 0),
      ['track "ptr:/x"', "keyframe times", "non-negative", "-0.5"],
    ),
  );

  TestValidator.predicate(
    "track keyframe times reject past clip duration",
    throwsError(
      () => sampleClip(clip([track(PTR, [0, 2], [0, 1], "linear")], 1), 0),
      ['track "ptr:/x"', "clip duration", "1", "2"],
    ),
  );

  TestValidator.predicate(
    "track keyframe times reject duplicates",
    throwsError(
      () => sampleClip(clip([track(PTR, [0, 0], [0, 1], "linear")], 1), 0),
      ['track "ptr:/x"', "strictly increasing"],
    ),
  );

  TestValidator.predicate(
    "track values reject empty payload",
    throwsError(
      () => sampleClip(clip([track(PTR, [0], [], "linear")], 1), 0),
      ['track "ptr:/x"', "values", "must not be empty"],
    ),
  );

  TestValidator.predicate(
    "track values reject NaN",
    throwsError(
      () =>
        sampleClip(clip([track(PTR, [0, 1], [0, Number.NaN], "linear")], 1), 0),
      ['track "ptr:/x"', "values[1]", "finite", "NaN"],
    ),
  );

  TestValidator.predicate(
    "track values reject infinity",
    throwsError(
      () =>
        sampleClip(clip([track(PTR, [0, 1], [0, Infinity], "linear")], 1), 0),
      ['track "ptr:/x"', "values[1]", "finite", "Infinity"],
    ),
  );

  TestValidator.predicate(
    "track values reject uneven keyframe stride",
    throwsError(
      () => sampleClip(clip([track(PTR, [0, 1], [0, 1, 2], "linear")], 1), 0),
      ['track "ptr:/x"', "values length", "divide evenly"],
    ),
  );

  TestValidator.predicate(
    "cubicspline values reject non-triplet stride",
    throwsError(
      () => sampleClip(clip([track(PTR, [0], [0, 1], "cubicspline")], 1), 0),
      ['track "ptr:/x"', "cubicspline", "divisible by 3"],
    ),
  );

  TestValidator.predicate(
    "scalar channel rejects vec2-width values",
    throwsError(
      () =>
        sampleClip(clip([track(PTR, [0, 1], [0, 0, 1, 1], "linear")], 1), 0),
      ['track "ptr:/x"', "value width", "1", "2"],
    ),
  );

  TestValidator.predicate(
    "rotation channel rejects vec3-width values",
    throwsError(
      () =>
        sampleClip(
          clip(
            [track(NODE("rotation"), [0, 1], [0, 0, 1, 0, 0, 1], "linear")],
            1,
          ),
          0,
        ),
      ['track "node:n:rotation"', "value width", "4", "3"],
    ),
  );
};
