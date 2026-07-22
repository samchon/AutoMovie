import { sampleMotion } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpMotion,
  toEngineMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK = {
  name: "walk",
  period: 1,
  limbs: [
    { bone: "leftUpperLeg" as const, phase: 0, duty: 0.5, amplitude: 25 },
  ],
};

const context = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const rig = createSkeleton();
  return {
    skeleton: rig.id,
    gaits: [WALK],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig,
  };
};

/**
 * A clip COMPUTED the way an agent's code would (a sampled sine arc on the arm
 * chain), never hand-written floats. Peak flexion lands at t=0.5.
 */
const computedKata = (
  skeleton: string,
  peak: number = 90,
): IAutoMovieMcpMotion => ({
  id: "kata",
  skeleton,
  duration: 1,
  loop: false,
  keyframes: Array.from({ length: 5 }, (_, i) => {
    const time = i / 4;
    const swing = Math.sin(Math.PI * time);
    return {
      time,
      pose: {
        skeleton,
        root: null,
        joints: [
          {
            bone: "leftUpperArm" as const,
            flexion: peak * swing,
            abduction: null,
            twist: null,
          },
          {
            bone: "leftLowerArm" as const,
            flexion: (peak / 2) * swing,
            abduction: null,
            twist: null,
          },
        ],
      },
      expression: null,
      easing: "linear" as const,
      bezier: null,
    };
  }),
});

/**
 * The MCP face of the engine's content seam (#1148): an `enact` action plays a
 * clip the CALLER computed, supplied in the perform call's `clips` registry:
 * dense motion enters the pipeline without abandoning its gates.
 *
 * Scenarios:
 *
 * 1. A computed clip enacts through the full pipeline: the shot compiles, the
 *    actor's composite carries the clip's peak arm flexion at mid-time.
 * 2. Enforcement is NOT bypassed: the same clip scaled past the shoulder's ROM
 *    fails the shot's ROM gate at a `$compiled` path: the registry is no back
 *    door around the shield.
 * 3. A unison cast (`actor: [a, b]`) enacts one clip without id collisions. Both
 *    actors get composites carrying the content.
 * 4. Content layering: an `enact` narrowed to `upperBody` layers with a concurrent
 *    legs-only `locomote` despite locomote's broad fullBody mask; the composite
 *    claims both the gait's leg and the clip's arm at mid-shot.
 * 5. Refusal rungs, most-actionable first: no actor context; a rig-less context
 *    (an ungated dense clip would dodge the ROM gate); a clip id the registry
 *    does not supply (including when `clips` is omitted entirely); a clip
 *    targeting another skeleton.
 * 6. Malformed registry entries fail at their `$input.clips["id"]` paths (a
 *    non-object clip, a missing keyframes array) instead of crashing the bezier
 *    lowering.
 */
export const test_mcp_perform_enact = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");
  const nodePosition = (id: string): IAutoMovieVector3 =>
    staged.scene.nodes.find((x) => x.id === id)!.transform.translation;
  const actors = () => ({
    knightA: context(nodePosition("knightA"), 0),
    knightB: context(nodePosition("knightB"), 180),
  });
  const kata = computedKata("skeleton-1");

  // 1. the computed clip enacts through the full pipeline.
  const performed = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "enact",
          actor: "knightA",
          start: 0,
          duration: 1,
          clip: "kata",
        },
        {
          verb: "frame",
          actor: "cam-main",
          start: 0,
          duration: "auto",
          framing: "medium",
          move: "static",
          on: { kind: "node", node: "knightA" },
        },
      ],
      duration: 1,
      revise: { review: "the kata reads.", final: null },
    }),
    actors: actors(),
    clips: { kata },
  }).performed;
  TestValidator.equals("the enacted shot performs", performed.success, true);
  if (performed.success !== true) return;
  const composite = toEngineMotion(performed.motions.knightA!);
  const midArm = sampleMotion(composite, 0.5).pose.joints.find(
    (joint) => joint.bone === "leftUpperArm",
  );
  TestValidator.predicate(
    "the composite carries the computed clip's peak arm flexion",
    midArm !== undefined && nclose(midArm.flexion!, 90, 1e-6),
  );

  // 2. an out-of-ROM clip fails the shot's ROM gate: no back door.
  const outOfRom = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "enact",
          actor: "knightA",
          start: 0,
          duration: 1,
          clip: "kata",
        },
      ],
      duration: 1,
      revise: { review: "the impossible kata.", final: null },
    }),
    actors: actors(),
    clips: { kata: computedKata("skeleton-1", 400) },
  }).performed;
  TestValidator.predicate(
    "an out-of-ROM enact fails the compiled ROM gate",
    outOfRom.success === false &&
      outOfRom.violations.some(
        (violation) =>
          violation.kind === "rom" && violation.path.startsWith("$compiled["),
      ),
  );

  // 3. a unison cast enacts one clip without id collisions.
  const unison = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "enact",
          actor: ["knightA", "knightB"],
          start: 0,
          duration: 1,
          clip: "kata",
        },
      ],
      duration: 1,
      revise: { review: "the paired kata.", final: null },
    }),
    actors: actors(),
    clips: { kata },
  }).performed;
  TestValidator.equals("the unison enact performs", unison.success, true);
  if (unison.success === true)
    TestValidator.predicate(
      "both unison actors carry the enacted content",
      ["knightA", "knightB"].every((actor) => {
        const arm = sampleMotion(
          toEngineMotion(unison.motions[actor]!),
          0.5,
        ).pose.joints.find((joint) => joint.bone === "leftUpperArm");
        return arm !== undefined && nclose(arm.flexion!, 90, 1e-6);
      }),
    );

  // 4. an upperBody enact layers with a concurrent legs-only locomote.
  const layered = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "enact",
          actor: "knightA",
          start: 0,
          duration: 1,
          clip: "kata",
          region: "upperBody",
        },
        {
          verb: "locomote",
          actor: "knightA",
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
        },
      ],
      duration: 1,
      revise: { review: "the walking kata.", final: null },
    }),
    actors: actors(),
    clips: { kata },
  }).performed;
  TestValidator.equals("the layered enact performs", layered.success, true);
  if (layered.success === true) {
    const mid = sampleMotion(
      toEngineMotion(layered.motions.knightA!),
      0.5,
    ).pose;
    TestValidator.predicate(
      "the composite claims both the gait's leg and the clip's arm",
      mid.joints.some((joint) => joint.bone === "leftUpperLeg") &&
        mid.joints.some((joint) => joint.bone === "leftUpperArm"),
    );
  }

  // 5. the refusal rungs, most-actionable first.
  const enactProbe = (props: {
    actors: Record<string, IAutoMovieMcpActorContext>;
    clips?: Record<string, IAutoMovieMcpMotion>;
    clip?: string;
  }): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    app.perform({
      script,
      staged,
      performance: makePerformanceWrite({
        draft: [
          {
            verb: "enact",
            actor: "knightA",
            start: 0,
            duration: 1,
            clip: props.clip ?? "kata",
          },
        ],
        duration: 1,
        revise: { review: "the refused kata.", final: null },
      }),
      actors: props.actors,
      ...(props.clips !== undefined ? { clips: props.clips } : {}),
    }).performed;
  const refusalAt = (
    performed: ReturnType<AutoMovieApplication["perform"]>["performed"],
    path: string,
    marker: string,
  ): boolean =>
    performed.success === false &&
    performed.violations.some(
      (violation) =>
        violation.path === path && violation.expected.includes(marker),
    );

  TestValidator.predicate(
    "a context-less actor refuses at the actor path",
    refusalAt(
      enactProbe({ actors: {}, clips: { kata } }),
      "$input.performance.draft[0].actor",
      "needs an MCP actor context",
    ),
  );
  const rigless = (() => {
    const { rig: _rig, ...rest } = context(nodePosition("knightA"), 0);
    return rest;
  })();
  TestValidator.predicate(
    "a rig-less context refuses, the clip must be ROM-gated",
    refusalAt(
      enactProbe({ actors: { knightA: rigless }, clips: { kata } }),
      "$input.performance.draft[0].actor",
      "requires a rig",
    ),
  );
  TestValidator.predicate(
    "an unsupplied clip id refuses at the clip path",
    refusalAt(
      enactProbe({ actors: actors(), clips: { other: kata }, clip: "kata" }),
      "$input.performance.draft[0].clip",
      "does not supply it",
    ),
  );
  TestValidator.predicate(
    "an omitted clips registry refuses the same way",
    refusalAt(
      enactProbe({ actors: actors() }),
      "$input.performance.draft[0].clip",
      "does not supply it",
    ),
  );
  TestValidator.predicate(
    "a skeleton-mismatched clip refuses at the clip path",
    refusalAt(
      enactProbe({
        actors: actors(),
        clips: { kata: computedKata("someone-else") },
      }),
      "$input.performance.draft[0].clip",
      "targets skeleton",
    ),
  );

  // 6. malformed registry entries fail at their own paths, not as crashes.
  const malformed = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        { verb: "enact", actor: "knightA", start: 0, duration: 1, clip: "bad" },
      ],
      duration: 1,
      revise: { review: "the malformed kata.", final: null },
    }),
    actors: actors(),
    clips: {
      bad: null,
      frameless: { ...kata, keyframes: null },
    } as unknown as Record<string, IAutoMovieMcpMotion>,
  }).performed;
  TestValidator.predicate(
    "malformed registry entries fail at their submitted paths",
    malformed.success === false &&
      malformed.violations.some(
        (violation) => violation.path === '$input.clips["bad"]',
      ) &&
      malformed.violations.some(
        (violation) => violation.path === '$input.clips["frameless"].keyframes',
      ),
  );

  // 7. a malformed KEYFRAME refuses instead of crashing the bake (#1157): an
  // empty/null keyframe, a non-finite time, and an undefined/bad bezier each
  // surface a field-located violation rather than a TypeError out of perform().
  const badKeyframe = (keyframe: unknown): IAutoMovieMcpMotion =>
    ({ ...kata, keyframes: [keyframe] }) as unknown as IAutoMovieMcpMotion;
  const kfCase = (keyframe: unknown, expectedPath: string): void => {
    const performed = app.perform({
      script,
      staged,
      performance: makePerformanceWrite({
        draft: [
          { verb: "enact", actor: "knightA", start: 0, duration: 1, clip: "k" },
        ],
        duration: 1,
        revise: { review: "the malformed keyframe.", final: null },
      }),
      actors: actors(),
      clips: { k: badKeyframe(keyframe) },
    }).performed;
    TestValidator.predicate(
      `malformed keyframe refuses at ${expectedPath}`,
      performed.success === false &&
        performed.violations.some((v) => v.path === expectedPath),
    );
  };
  kfCase({}, '$input.clips["k"].keyframes[0].time');
  kfCase(null, '$input.clips["k"].keyframes[0]');
  kfCase(
    {
      time: Number.NaN,
      pose: { skeleton: "skeleton-1", root: null, joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
    '$input.clips["k"].keyframes[0].time',
  );
  kfCase(
    {
      time: 0,
      pose: { skeleton: "skeleton-1", root: null, joints: [] },
      expression: null,
      easing: "linear",
      bezier: { x1: 0, y1: 0, x2: 1 },
    },
    '$input.clips["k"].keyframes[0].bezier.y2',
  );
  kfCase(
    {
      time: 0,
      pose: { skeleton: "skeleton-1", root: null, joints: [] },
      expression: null,
      easing: "linear",
    },
    '$input.clips["k"].keyframes[0].bezier',
  );

  // 8. a well-formed cubic-bezier keyframe passes the shape gate and performs
  // (the valid path through the per-axis finite check).
  const bezierClip: IAutoMovieMcpMotion = {
    id: "curve",
    skeleton: "skeleton-1",
    duration: 1,
    loop: false,
    keyframes: [
      {
        time: 0,
        pose: { skeleton: "skeleton-1", root: null, joints: [] },
        expression: null,
        easing: "cubicBezier",
        bezier: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
      },
      {
        time: 1,
        pose: {
          skeleton: "skeleton-1",
          root: null,
          joints: [
            { bone: "leftUpperArm", flexion: 30, abduction: null, twist: null },
          ],
        },
        expression: null,
        easing: "linear",
        bezier: null,
      },
    ],
  };
  const bezierPerformed = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "enact",
          actor: "knightA",
          start: 0,
          duration: 1,
          clip: "curve",
        },
      ],
      duration: 1,
      revise: { review: "the eased kata.", final: null },
    }),
    actors: actors(),
    clips: { curve: bezierClip },
  }).performed;
  TestValidator.equals(
    "a well-formed cubic-bezier enact clip performs",
    bezierPerformed.success,
    true,
  );
};
