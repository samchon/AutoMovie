import { sampleClip, validateClipArtifact } from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieConstraintViolation,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/** A clip carrying one track, whose payload the caller states. */
const clip = (
  channel: Record<string, unknown>,
  times: number[],
  values: number[],
  interpolation = "linear",
): unknown => ({
  id: "c",
  name: null,
  duration: 100,
  loop: false,
  tracks: [{ channel, times, values, interpolation }],
});

const NODE = (path: string): Record<string, unknown> => ({
  kind: "node",
  node: "n",
  path,
});

const faultOn = (value: unknown): IAutoMovieConstraintViolation => {
  const violations: IAutoMovieConstraintViolation[] = [];
  validateClipArtifact(value, "$input.clip", violations);
  const found = violations.find(
    (item) => item.path === "$input.clip.tracks[0].values",
  );
  if (found === undefined)
    throw new Error("the payload under test must be refused at `values`");
  return found;
};

/** Every fragment appears in the gate's message. */
const says = (value: unknown, fragments: string[]): boolean => {
  const { expected } = faultOn(value);
  return fragments.every((fragment) => expected.includes(fragment));
};

/** The S-05 trajectory that could not converge: 67 keyframes, 195 values. */
const S05_TIMES = Array.from({ length: 67 }, (_, i) => i);
const S05_VALUES = Array.from({ length: 195 }, () => 0);

/**
 * The clip-shape faults state the arithmetic that would satisfy them.
 *
 * `clipTrackShape` named its numbers in every check but one. The stride check
 * said "values length must divide evenly by keyframe count" and stopped: no
 * keyframe count, no values length, no per-keyframe width, and a `return` that
 * put the sibling check which DOES name the width out of reach, so the author
 * most lost was told least (#1362). A benchmark agent hand-authoring a 67-frame
 * trajectory failed four consecutive `commitShot` calls against that message
 * and finally collapsed its curve to two keyframes, which is not the motion it
 * was authoring.
 *
 * The width now rides the stride fault itself rather than the check below it,
 * because the width arithmetic below is meaningless on a fractional stride: it
 * would report a computed width that is not a real one. The three faults that
 * judge a dense payload also stop echoing the whole `values` array back as the
 * violation's `value`, which spent hundreds of floats of the client's context
 * saying nothing the message did not.
 *
 * Numbers below are hand arithmetic on the stated payload, never read back from
 * the validator.
 *
 * Scenarios:
 *
 * 1. The reproduction: 195 values over 67 keyframe times on a `translation` track
 *    names 67, 195, the 3 values per keyframe, and the 201 that satisfies it,
 *    and reports the LENGTH as the violation's value rather than 195 floats.
 * 2. The sampler speaks the same arithmetic, since both sides read one contract:
 *    the throw for that payload carries the same four numbers.
 * 3. The negative twin for the width clause: a `weights` channel fixes no width (a
 *    morph vector is as wide as the model), so the fault states the counts and
 *    claims no per-keyframe number it cannot know.
 * 4. `cubicspline` triples the per-keyframe cost, so the same channel demands 9
 *    per keyframe and the fault says so.
 * 5. The non-triplet `cubicspline` stride states the division it failed.
 * 6. The width fault, reachable only on a WHOLE stride, states the total the
 *    payload must hold beside the width it got.
 */
export const test_validation_clip_stride_diagnostic = (): void => {
  // 1. the reproduction, with every number the author needed.
  const uneven = clip(NODE("translation"), S05_TIMES, S05_VALUES);
  TestValidator.predicate(
    "the stride fault names the counts, the width, and the target length",
    says(uneven, [
      "keyframe count 67",
      "195 does not",
      "carries 3 per keyframe",
      "values must hold 201",
    ]),
  );
  TestValidator.equals(
    "the violation carries the length, not the 195 floats",
    faultOn(uneven).value,
    195,
  );

  // 2. one contract, two voices: the sampler throws the same arithmetic.
  TestValidator.predicate(
    "the sampler's throw carries the same numbers",
    throwsError(
      () => sampleClip(uneven as IAutoMovieClip, 0),
      ["keyframe count 67", "195 does not", "values must hold 201"],
    ),
  );

  // 3. a channel that fixes no width claims none.
  const weights = clip(NODE("weights"), [0, 1], [0, 0, 1]);
  const weightsFault = faultOn(weights);
  TestValidator.predicate(
    "a weights track states the counts and no invented width",
    weightsFault.expected.includes("keyframe count 2") &&
      weightsFault.expected.includes("3 does not") &&
      !weightsFault.expected.includes("per keyframe"),
  );

  // 4. cubicspline stores in-tangent / value / out-tangent per keyframe.
  TestValidator.predicate(
    "a cubicspline track states the tripled per-keyframe cost",
    says(clip(NODE("translation"), S05_TIMES, S05_VALUES, "cubicspline"), [
      "carries 9 per keyframe",
      "values must hold 603",
    ]),
  );

  // 5. the non-triplet cubicspline stride states its division.
  TestValidator.predicate(
    "a whole but non-triplet cubicspline stride names the stride",
    says(clip(NODE("translation"), [0], [0, 1], "cubicspline"), [
      "divisible by 3",
      "2 values / 1 times gives 2",
    ]),
  );

  // 6. the width fault, past a whole stride, states the total as well.
  TestValidator.predicate(
    "the width fault names the total the payload must hold",
    says(clip(NODE("translation"), [0, 1], [0, 0, 1, 1]), [
      "value width must be 3, but was 2",
      "4 values / 2 times must be 6",
    ]),
  );
};
