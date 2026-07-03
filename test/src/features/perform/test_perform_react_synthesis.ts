import {
  IAutoFilmActorContext,
  makeActorSynthesizer,
  sampleMotion,
  validateMotion,
} from "@autofilm/engine";
import { IAutoFilmReactAction, IAutoFilmVector3 } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const baseCtx: IAutoFilmActorContext = {
  skeleton: "skeleton-1",
  gaits: [],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0, // faces +Z
  eyeHeight: 1.6,
  restPose: makePose([]),
  rig: createSkeleton(),
};

const nodes = new Map<string, IAutoFilmVector3>([
  ["attacker", { x: 0, y: 0, z: 2 }], // dead ahead of the actor (+Z)
]);

const react = (
  force: number,
  overrides: Partial<IAutoFilmReactAction> = {},
): IAutoFilmReactAction => ({
  verb: "react",
  actor: "hero",
  start: 0,
  duration: 0.5,
  from: { kind: "node", node: "attacker" },
  force,
  ...overrides,
});

/** Largest absolute flexion across a clip's keyframes. */
const peakFlexion = (
  motion: ReturnType<
    NonNullable<ReturnType<typeof makeActorSynthesizer>>
  > extends infer M
    ? M
    : never,
): number =>
  motion === null
    ? 0
    : Math.max(
        ...motion.keyframes.flatMap((k) =>
          k.pose.joints.map((j) => Math.abs(j.flexion ?? 0)),
        ),
      );

/**
 * The reference synthesiser fattening the `react` verb into a ROM-clamped
 * flinch. The verb is a physics verb — its deflection is bounded by each
 * joint's ROM — so it needs the context's `rig`; the mapping snaps the body
 * away from where the blow comes from, scaled by `force`, and the whole flinch
 * validates against the same ROM table the engine gates on.
 *
 * Scenarios:
 *
 * 1. A blow from dead ahead at force 0.7 → a three-keyframe flinch (rest → flinch
 *    → rest) that snaps the torso back (the head, chain head, deflects most);
 *    the clip is not looped and lasts the action's duration.
 * 2. Force is monotone: a 0.9 blow flinches harder than a 0.3 blow, and both stay
 *    inside ROM (validateMotion passes) because impactRecoil clamps.
 * 3. `unbalance: true` flinches harder still than the same force upright.
 * 4. A context with no `rig` synthesises nothing (null) — the physics verb can't
 *    clamp without the body.
 * 5. Totality of the direction decomposition: a `duration: "auto"` react runs the
 *    default 0.5 s; a blow from an unresolvable target (a direction, not a
 *    point) still snaps the actor back; and a blow whose source sits exactly on
 *    the actor falls back to a straight-back flinch instead of dividing by a
 *    zero-length direction.
 */
export const test_perform_react_synthesis = (): void => {
  const rig = createSkeleton();
  const synth = makeActorSynthesizer(new Map([["hero", baseCtx]]), nodes);

  const hit = synth(react(0.7), "hero");
  TestValidator.predicate("react produced a clip", hit !== null);
  if (hit === null) return;
  TestValidator.equals("rest → flinch → rest", hit.keyframes.length, 3);
  TestValidator.equals("not looped", hit.loop, false);
  TestValidator.predicate("lasts the duration", nclose(hit.duration, 0.5));
  TestValidator.predicate("the flinch actually deflects", peakFlexion(hit) > 1);
  const mid = sampleMotion(hit, 0.16);
  const headFlex = Math.abs(
    mid.pose.joints.find((j) => j.bone === "head")?.flexion ?? 0,
  );
  const spineFlex = Math.abs(
    mid.pose.joints.find((j) => j.bone === "spine")?.flexion ?? 0,
  );
  TestValidator.predicate(
    "the head whips more than the spine (falloff down the chain)",
    headFlex > spineFlex,
  );

  const soft = synth(react(0.3), "hero");
  const hard = synth(react(0.9), "hero");
  TestValidator.predicate(
    "force is monotone (0.9 flinches harder than 0.3)",
    peakFlexion(hard) > peakFlexion(soft),
  );
  TestValidator.equals(
    "soft flinch is ROM-legal",
    validateMotion({ motion: soft!, skeleton: rig }).success,
    true,
  );
  TestValidator.equals(
    "hard flinch is ROM-legal",
    validateMotion({ motion: hard!, skeleton: rig }).success,
    true,
  );

  const floored = synth(react(0.6, { unbalance: true }), "hero");
  const upright = synth(react(0.6), "hero");
  TestValidator.predicate(
    "an unbalancing blow flinches harder",
    peakFlexion(floored) > peakFlexion(upright),
  );

  const rigless = makeActorSynthesizer(
    new Map([["hero", { ...baseCtx, rig: undefined }]]),
    nodes,
  );
  TestValidator.equals("no rig, no flinch", rigless(react(0.7), "hero"), null);

  // 5. totality of the decomposition
  const auto = synth(react(0.5, { duration: "auto" }), "hero");
  TestValidator.predicate(
    "auto duration runs the default 0.5 s",
    auto !== null && nclose(auto.duration, 0.5),
  );
  const directional = synth(
    react(0.7, { from: { kind: "direction", headingDeg: 90 } }),
    "hero",
  );
  TestValidator.predicate(
    "an unresolvable source still snaps the actor back",
    peakFlexion(directional) > 1,
  );
  const onTop = makeActorSynthesizer(
    new Map([
      ["hero", { ...baseCtx, position: { x: 0, y: 0, z: 2 } }], // on the attacker
    ]),
    nodes,
  );
  TestValidator.predicate(
    "a source on the actor falls back to a straight flinch",
    peakFlexion(onTop(react(0.7), "hero")) > 1,
  );
};
