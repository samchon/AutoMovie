import { sampleMotion } from "@motica/engine";
import { IMoticaMotion } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import {
  joint,
  keyframe,
  makeExpression,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const flex = (m: IMoticaMotion, t: number, bone = "leftLowerArm"): number => {
  const j = sampleMotion(m, t).pose.joints.find((x) => x.bone === bone);
  if (j === undefined) throw new Error(`${bone} missing from sampled pose`);
  return j.flexion ?? 0;
};

/**
 * The degenerate and asymmetric sampling inputs a tidy clip never produces,
 * each routing through a branch the standard sampling tests miss.
 *
 * Scenarios:
 *
 * 1. A keyframe whose easing is `cubicBezier` with control points routes through
 *    the Bézier solver rather than the named-curve table; [0,0,1,1] reproduces
 *    linear, so elbow 0→100 at t=0.5 is ≈ 50.
 * 2. A zero-duration clip normalizes any time to 0 and returns the first pose
 *    (sampling at t=5 still yields the start, 30°).
 * 3. A negative time on a looping clip wraps into [0, duration): t=−0.25 on a 1s
 *    loop equals t=0.75, so 0→120 gives 90.
 * 4. Keyframes with different bone sets — a bone present in only one keyframe
 *    interpolates against "no articulation" on the absent side: the shoulder,
 *    present only at the end at 40°, samples to 20° at t=0.5 (and symmetrically
 *    when present only at the start).
 * 5. Same-preset expressions where only one side carries blendshapes: the present
 *    channel scales by the eased factor (jawOpen 1.0 with the other side absent
 *    → 0.5 at t=0.5), proving the absent side contributes nothing.
 */
export const test_motion_sample_edge_cases = (): void => {
  // 1. cubicBezier easing keyframe
  const bezierClip = makeMotion(
    [
      {
        time: 0,
        pose: makePose([joint("leftLowerArm", { flexion: 0 })]),
        expression: null,
        easing: "cubicBezier",
        bezier: [0, 0, 1, 1],
      },
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 100 })])),
    ],
    1,
  );
  TestValidator.predicate(
    "cubicBezier keyframe ≈ linear midpoint",
    nclose(flex(bezierClip, 0.5), 50, 0.5),
  );

  // 2. zero-duration clip
  const zero = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 30 })])),
      keyframe(0.5, makePose([joint("leftLowerArm", { flexion: 60 })])),
    ],
    0,
  );
  TestValidator.predicate(
    "zero-duration returns first pose",
    nclose(flex(zero, 5), 30),
  );

  // 3. negative time on a loop
  const loop = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
    true,
  );
  TestValidator.predicate(
    "negative loop time wraps (-0.25 → 0.75 → 90)",
    nclose(flex(loop, -0.25), 90),
  );

  // 4. bone present in only one keyframe (both directions)
  const endOnly = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(
        1,
        makePose([
          joint("leftLowerArm", { flexion: 120 }),
          joint("leftUpperArm", { flexion: 40 }),
        ]),
      ),
    ],
    1,
  );
  TestValidator.predicate(
    "end-only shoulder → 20 at midpoint",
    nclose(flex(endOnly, 0.5, "leftUpperArm"), 20),
  );
  const startOnly = makeMotion(
    [
      keyframe(
        0,
        makePose([
          joint("leftLowerArm", { flexion: 0 }),
          joint("leftUpperArm", { flexion: 40 }),
        ]),
      ),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
  );
  TestValidator.predicate(
    "start-only shoulder → 20 at midpoint",
    nclose(flex(startOnly, 0.5, "leftUpperArm"), 20),
  );

  // 5. same-preset expression, blendshapes on only one side (both directions)
  const rest = makePose([joint("leftLowerArm", { flexion: 0 })]);
  const endBlend = makeMotion(
    [
      keyframe(0, rest, "linear", makeExpression("happy", 1)),
      keyframe(
        1,
        rest,
        "linear",
        makeExpression("happy", 1, [{ channel: "jawOpen", weight: 1 }]),
      ),
    ],
    1,
  );
  const endChannels = new Map(
    (sampleMotion(endBlend, 0.5).expression?.blendshapes ?? []).map((c) => [
      c.channel,
      c.weight,
    ]),
  );
  TestValidator.predicate(
    "blendshapes only at end → jawOpen 0.5",
    nclose(endChannels.get("jawOpen") ?? -1, 0.5),
  );

  const startBlend = makeMotion(
    [
      keyframe(
        0,
        rest,
        "linear",
        makeExpression("happy", 1, [{ channel: "jawOpen", weight: 1 }]),
      ),
      keyframe(1, rest, "linear", makeExpression("happy", 1)),
    ],
    1,
  );
  const startChannels = new Map(
    (sampleMotion(startBlend, 0.5).expression?.blendshapes ?? []).map((c) => [
      c.channel,
      c.weight,
    ]),
  );
  TestValidator.predicate(
    "blendshapes only at start → jawOpen 0.5",
    nclose(startChannels.get("jawOpen") ?? -1, 0.5),
  );
};
