import { IAutoMovieGait, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
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

const riglessContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const { rig: _rig, ...rest } = context(position, facingDeg);
  return rest;
};

/**
 * The MCP `perform` tool keeps the client contract JSON-only while still
 * driving the engine's rig-aware performance stage.
 *
 * Scenarios:
 *
 * 1. A client calls `stage`, `block`, then `perform` with actor contexts. The
 *    server builds the default synthesizer internally and returns a performed
 *    shot with one motion per actor and the live camera compiled.
 * 2. The same MCP wrapper returns engine violations, not thrown errors, when the
 *    performance names a beat the script never declared.
 * 3. A default-synthesizer unsupported gesture fails as data instead of succeeding
 *    with the authored action dropped.
 * 4. A rig-required reach with a rigless MCP actor context fails as data instead
 *    of succeeding with no motion for that actor.
 * 5. Malformed actor context registries fail as data with `$input.actors...` paths
 *    instead of leaking wrapper TypeErrors.
 * 6. Malformed performance action actors fail as engine validation data even
 *    though the MCP default-synthesis precheck runs first.
 * 7. Malformed performance action targets fail as engine validation data instead
 *    of leaking default-synthesis target reads.
 * 8. Malformed actor gait entries (non-object entry, blank/missing name,
 *    non-finite or non-positive period, malformed rootBob and limb fields) fail
 *    at their submitted `$input.actors.<node>.gaits[i]...` paths instead of
 *    being reinterpreted as `$input.performance.draft[i].gait` mismatches or
 *    leaking engine gait-synthesis throws.
 * 9. A structurally valid actor context that simply lacks the requested gait still
 *    fails downstream at `$input.performance.draft[0].gait`, and a fully loaded
 *    valid gait (rootBob, multi-axis limbs, neutral, named easings) still
 *    performs.
 * 10. Duplicate actor gait names and duplicate limb (bone, axis) rows fail as
 *     field-located violations at the later occurrence instead of leaking the
 *     engine's `assertUniqueActorGaits` / `assertUniqueGaitAxes` throws, while
 *     same-bone different-axis rows and per-actor independent gait sets stay
 *     valid.
 * 11. Timing/force-malformed `hold`/`react` actions skip the default-synthesis
 *     precheck and fail as `performShot`'s field-located violations at
 *     `$input.performance.draft[i].duration` / `.force` instead of leaking
 *     `holdMotion`/`reactMotion`/`impactRecoil` throws, while a valid `hold`
 *     and a `react` with `duration: "auto"` still perform.
 */
export const test_mcp_perform_tool = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");

  const nodePosition = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((x) => x.id === id);
    if (node === undefined) throw new Error(`missing staged node ${id}`);
    return node.transform.translation;
  };

  const blocking = app.block({
    script,
    staged,
    blocking: makeBlockingWrite({
      duration: 1,
      actors: [
        {
          node: "knightA",
          beats: "advances into the beat",
          anchors: [{ t: 0.5, cue: "mid-step" }],
        },
      ],
    }),
  }).blocked;
  if (blocking.success !== true) throw new Error("blocking must succeed");

  const performance = makePerformanceWrite({
    draft: [
      {
        verb: "locomote",
        actor: ["knightA", "knightB"],
        start: 0,
        duration: 1,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
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
    revise: { review: "unchanged.", final: null },
  });

  const performed = app.perform({
    script,
    staged,
    performance,
    actors: {
      knightA: context(nodePosition("knightA"), 0),
      knightB: context(nodePosition("knightB"), 180),
    },
    blocking: blocking.blocking,
  }).performed;

  TestValidator.equals("perform succeeds", performed.success, true);
  if (performed.success !== true) return;

  TestValidator.equals("shot camera", performed.shot.camera, "cam-main");
  TestValidator.predicate(
    "camera motion compiled",
    performed.shot.cameraMotion !== null,
  );
  TestValidator.equals(
    "one synthesized motion per actor",
    Object.keys(performed.motions).sort((a, b) => a.localeCompare(b)),
    ["knightA", "knightB"],
  );
  TestValidator.equals(
    "knightA clip id",
    performed.motions.knightA!.id,
    "perform:knightA",
  );

  const malformedRequest = app.perform(null as never).performed;
  TestValidator.predicate(
    "malformed request root returns violations",
    malformedRequest.success === false &&
      malformedRequest.violations.some(
        (violation) => violation.kind === "type" && violation.path === "$input",
      ),
  );

  const malformedScript = app.perform({
    script: { ...script, beats: null as unknown as typeof script.beats },
    staged,
    performance,
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed script beats return violations",
    malformedScript.success === false &&
      malformedScript.violations.some(
        (violation) =>
          violation.kind === "type" && violation.path === "$input.script.beats",
      ),
  );

  const failed = app.perform({
    script,
    staged,
    performance: { ...performance, beat: "missing-beat" },
    actors: {
      knightA: context(nodePosition("knightA"), 0),
      knightB: context(nodePosition("knightB"), 180),
    },
  }).performed;

  TestValidator.predicate(
    "invalid beat returns violations",
    failed.success === false &&
      failed.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.beat",
      ),
  );
  const malformedActors = app.perform({
    script,
    staged,
    performance,
    actors: null as unknown as Record<string, IAutoMovieMcpActorContext>,
  }).performed;
  TestValidator.predicate(
    "malformed actors registry returns violations",
    malformedActors.success === false &&
      malformedActors.violations.some(
        (violation) =>
          violation.kind === "type" && violation.path === "$input.actors",
      ),
  );
  const malformedActor = app.perform({
    script,
    staged,
    performance,
    actors: {
      knightA: undefined,
    } as unknown as Record<string, IAutoMovieMcpActorContext>,
  }).performed;
  TestValidator.predicate(
    "malformed actor entry returns violations",
    malformedActor.success === false &&
      malformedActor.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.actors.knightA",
      ),
  );
  const malformedGaits = app.perform({
    script,
    staged,
    performance,
    actors: {
      knightA: {
        ...context(nodePosition("knightA"), 0),
        gaits: null,
      } as unknown as IAutoMovieMcpActorContext,
    },
  }).performed;
  TestValidator.predicate(
    "malformed actor gaits return violations",
    malformedGaits.success === false &&
      malformedGaits.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.actors.knightA.gaits",
      ),
  );

  const gaitProbe = (
    gaits: unknown,
  ): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    app.perform({
      script,
      staged,
      performance,
      actors: {
        knightA: {
          ...context(nodePosition("knightA"), 0),
          gaits,
        } as unknown as IAutoMovieMcpActorContext,
        knightB: context(nodePosition("knightB"), 180),
      },
    }).performed;
  const hasGaitViolation = (
    performed: ReturnType<AutoMovieApplication["perform"]>["performed"],
    kind: "type" | "range",
    path: string,
  ): boolean =>
    performed.success === false &&
    performed.violations.some(
      (violation) => violation.kind === kind && violation.path === path,
    );

  const nullGaitEntry = gaitProbe([null]);
  TestValidator.predicate(
    "null gait entry fails at its own path",
    hasGaitViolation(nullGaitEntry, "type", "$input.actors.knightA.gaits[0]"),
  );
  TestValidator.predicate(
    "null gait entry is not reinterpreted as an action gait mismatch",
    nullGaitEntry.success === false &&
      nullGaitEntry.violations.every(
        (violation) => violation.path !== "$input.performance.draft[0].gait",
      ),
  );

  const emptyGaitEntry = gaitProbe([{}]);
  TestValidator.predicate(
    "empty gait entry names its missing fields",
    hasGaitViolation(
      emptyGaitEntry,
      "type",
      "$input.actors.knightA.gaits[0].name",
    ) &&
      hasGaitViolation(
        emptyGaitEntry,
        "type",
        "$input.actors.knightA.gaits[0].period",
      ) &&
      hasGaitViolation(
        emptyGaitEntry,
        "type",
        "$input.actors.knightA.gaits[0].limbs",
      ),
  );

  const blankGaitFields = gaitProbe([{ name: "  ", period: 0, limbs: [null] }]);
  TestValidator.predicate(
    "blank gait name, zero period, and null limb fail at their paths",
    hasGaitViolation(
      blankGaitFields,
      "type",
      "$input.actors.knightA.gaits[0].name",
    ) &&
      hasGaitViolation(
        blankGaitFields,
        "range",
        "$input.actors.knightA.gaits[0].period",
      ) &&
      hasGaitViolation(
        blankGaitFields,
        "type",
        "$input.actors.knightA.gaits[0].limbs[0]",
      ),
  );

  const nanGaitPeriod = gaitProbe([
    { name: "walk", period: Number.NaN, limbs: [] },
  ]);
  TestValidator.predicate(
    "non-finite gait period fails as a type violation",
    hasGaitViolation(
      nanGaitPeriod,
      "type",
      "$input.actors.knightA.gaits[0].period",
    ),
  );

  const nullRootBob = gaitProbe([
    { name: "walk", period: 1, rootBob: null, limbs: [] },
  ]);
  TestValidator.predicate(
    "present null rootBob fails at its path",
    hasGaitViolation(
      nullRootBob,
      "type",
      "$input.actors.knightA.gaits[0].rootBob",
    ),
  );

  const rootBobScalars = gaitProbe([
    {
      name: "walk",
      period: 1,
      rootBob: { amplitude: null, phase: 0, center: "x" },
      limbs: [],
    },
  ]);
  TestValidator.predicate(
    "malformed rootBob scalars fail per field while valid ones pass",
    hasGaitViolation(
      rootBobScalars,
      "type",
      "$input.actors.knightA.gaits[0].rootBob.amplitude",
    ) &&
      hasGaitViolation(
        rootBobScalars,
        "type",
        "$input.actors.knightA.gaits[0].rootBob.center",
      ) &&
      rootBobScalars.success === false &&
      rootBobScalars.violations.every(
        (violation) =>
          violation.path !== "$input.actors.knightA.gaits[0].rootBob.phase",
      ),
  );

  const malformedLimbFields = gaitProbe([
    {
      name: "walk",
      period: 1,
      limbs: [
        {
          bone: "",
          axis: "yaw",
          phase: null,
          duty: 2,
          amplitude: "big",
          neutral: null,
          stanceEasing: "bounce",
          swingEasing: 5,
        },
        { bone: "leftUpperLeg", axis: 5, phase: 0, duty: 0, amplitude: 1 },
      ],
    },
  ]);
  const limbPath = "$input.actors.knightA.gaits[0].limbs";
  TestValidator.predicate(
    "malformed limb fields fail at their submitted paths",
    hasGaitViolation(malformedLimbFields, "type", `${limbPath}[0].bone`) &&
      hasGaitViolation(malformedLimbFields, "type", `${limbPath}[0].axis`) &&
      hasGaitViolation(malformedLimbFields, "type", `${limbPath}[0].phase`) &&
      hasGaitViolation(malformedLimbFields, "range", `${limbPath}[0].duty`) &&
      hasGaitViolation(
        malformedLimbFields,
        "type",
        `${limbPath}[0].amplitude`,
      ) &&
      hasGaitViolation(malformedLimbFields, "type", `${limbPath}[0].neutral`) &&
      hasGaitViolation(
        malformedLimbFields,
        "type",
        `${limbPath}[0].stanceEasing`,
      ) &&
      hasGaitViolation(
        malformedLimbFields,
        "type",
        `${limbPath}[0].swingEasing`,
      ) &&
      hasGaitViolation(malformedLimbFields, "type", `${limbPath}[1].axis`) &&
      hasGaitViolation(malformedLimbFields, "range", `${limbPath}[1].duty`),
  );

  const duplicateGaitName = gaitProbe([WALK, { ...WALK }]);
  TestValidator.predicate(
    "duplicate actor gait name fails as data at the later entry",
    hasGaitViolation(
      duplicateGaitName,
      "type",
      "$input.actors.knightA.gaits[1].name",
    ),
  );

  const duplicateLimbRow = gaitProbe([
    {
      name: "walk",
      period: 1,
      limbs: [
        { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 },
        {
          bone: "leftUpperLeg",
          axis: "flexion",
          phase: 0.5,
          duty: 0.5,
          amplitude: 10,
        },
      ],
    },
  ]);
  TestValidator.predicate(
    "duplicate limb (bone, axis) row fails as data at the later row",
    hasGaitViolation(duplicateLimbRow, "type", `${limbPath}[1]`),
  );

  const emptyLimb = gaitProbe([{ name: "walk", period: 1, limbs: [{}, {}] }]);
  TestValidator.predicate(
    "an empty limb names its missing fields without a duplicate-row report",
    hasGaitViolation(emptyLimb, "type", `${limbPath}[0].bone`) &&
      hasGaitViolation(emptyLimb, "type", `${limbPath}[0].phase`) &&
      hasGaitViolation(emptyLimb, "type", `${limbPath}[0].duty`) &&
      hasGaitViolation(emptyLimb, "type", `${limbPath}[0].amplitude`) &&
      emptyLimb.success === false &&
      emptyLimb.violations.every(
        (violation) => violation.path !== `${limbPath}[1]`,
      ),
  );

  const cameraFrame = {
    verb: "frame",
    actor: "cam-main",
    start: 0,
    duration: "auto",
    framing: "medium",
    move: "static",
    on: { kind: "node", node: "knightA" },
  } as const;
  const timingProbe = (
    action: Record<string, unknown>,
  ): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    app.perform({
      script,
      staged,
      performance: makePerformanceWrite({
        draft: [action as never, cameraFrame],
        duration: 1,
        revise: { review: "unchanged.", final: null },
      }),
      actors: {
        knightA: context(nodePosition("knightA"), 0),
      },
    }).performed;
  const hasTimingViolation = (
    performed: ReturnType<AutoMovieApplication["perform"]>["performed"],
    path: string,
  ): boolean =>
    performed.success === false &&
    performed.violations.some((violation) => violation.path === path);

  const negativeHold = timingProbe({
    verb: "hold",
    actor: "knightA",
    start: 0,
    duration: -1,
  });
  TestValidator.predicate(
    "a negative hold duration fails as data, not a holdMotion throw",
    hasTimingViolation(negativeHold, "$input.performance.draft[0].duration"),
  );

  const negativeReact = timingProbe({
    verb: "react",
    actor: "knightA",
    start: 0,
    duration: -1,
    from: { kind: "point", point: { x: 0, y: 0, z: 2 } },
    force: 0.5,
  });
  TestValidator.predicate(
    "a negative react duration fails as data, not a reactMotion throw",
    hasTimingViolation(negativeReact, "$input.performance.draft[0].duration"),
  );

  const forcelessReact = timingProbe({
    verb: "react",
    actor: "knightA",
    start: 0,
    duration: 0.5,
    from: { kind: "point", point: { x: 0, y: 0, z: 2 } },
  });
  TestValidator.predicate(
    "a react without force fails as data, not an impactRecoil throw",
    hasTimingViolation(forcelessReact, "$input.performance.draft[0].force"),
  );

  TestValidator.equals(
    "a valid hold still performs",
    timingProbe({ verb: "hold", actor: "knightA", start: 0, duration: 0.5 })
      .success,
    true,
  );
  TestValidator.equals(
    "a react with auto duration still performs",
    timingProbe({
      verb: "react",
      actor: "knightA",
      start: 0,
      duration: "auto",
      from: { kind: "point", point: { x: 0, y: 0, z: 2 } },
      force: 0.5,
    }).success,
    true,
  );

  const missingGait = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: "knightA",
          start: 0,
          duration: 1,
          gait: "run",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "a valid context lacking the requested gait still fails downstream",
    missingGait.success === false &&
      missingGait.violations.some(
        (violation) => violation.path === "$input.performance.draft[0].gait",
      ),
  );

  const richGait = app.perform({
    script,
    staged,
    performance,
    actors: {
      knightA: {
        ...context(nodePosition("knightA"), 0),
        gaits: [
          {
            name: "walk",
            period: 1,
            rootBob: { amplitude: 0.03, phase: 0.25, center: 0 },
            limbs: [
              {
                bone: "leftUpperLeg",
                phase: 0,
                duty: 0.5,
                amplitude: 25,
                neutral: 5,
                stanceEasing: "easeInOut",
                swingEasing: "cubicBezier",
              },
              {
                bone: "leftUpperLeg",
                axis: "abduction",
                phase: 0.5,
                duty: 0.4,
                amplitude: 8,
              },
            ],
          },
        ],
      },
      knightB: context(nodePosition("knightB"), 180),
    },
  }).performed;
  TestValidator.equals(
    "fully loaded valid gait performs",
    richGait.success,
    true,
  );

  const malformedDraftActor = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: {} as never,
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 1, y: 0, z: 0 } },
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed draft actor returns violations",
    malformedDraftActor.success === false &&
      malformedDraftActor.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.draft[0].actor",
      ),
  );

  const malformedFinalActor = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [],
      duration: 1,
      revise: {
        review: "use the revised malformed payload.",
        final: [
          {
            verb: "gesture",
            actor: null as never,
            start: 0,
            duration: 1,
            kind: "wave",
          },
        ],
      },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed final actor returns violations",
    malformedFinalActor.success === false &&
      malformedFinalActor.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.revise.final[0].actor",
      ),
  );

  const malformedDraftTarget = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "reach",
          actor: "knightA",
          start: 0,
          duration: 1,
          hand: "right",
          to: null as never,
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed draft target returns violations",
    malformedDraftTarget.success === false &&
      malformedDraftTarget.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.draft[0].to",
      ),
  );

  const malformedFinalTarget = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [],
      duration: 1,
      revise: {
        review: "use the revised malformed target.",
        final: [
          {
            verb: "lookAt",
            actor: "knightA",
            start: 0,
            duration: 1,
            to: { kind: "group", nodes: null } as never,
          },
        ],
      },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed final target returns violations",
    malformedFinalTarget.success === false &&
      malformedFinalTarget.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.revise.final[0].to.nodes",
      ),
  );

  const malformedLaunchTarget = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "launch",
          actor: "knightA",
          start: 0,
          duration: 1,
          projectile: "arrow",
          at: null as never,
          speed: 12,
          onHit: { force: 0.5 },
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed launch target returns violations",
    malformedLaunchTarget.success === false &&
      malformedLaunchTarget.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.draft[0].at",
      ),
  );

  const unsupportedGesture = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind: "guard",
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "unsupported default gesture returns violations",
    unsupportedGesture.success === false &&
      unsupportedGesture.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.draft[0].kind",
      ),
  );

  const riglessReach = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "reach",
          actor: "knightA",
          start: 0,
          duration: 1,
          hand: "right",
          to: { kind: "node", node: "knightB" },
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: riglessContext(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "rigless reach returns violations",
    riglessReach.success === false &&
      riglessReach.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.draft[0].actor",
      ),
  );

  const malformedStaged = app.perform({
    script,
    staged: null as never,
    performance,
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed staged root returns violations",
    malformedStaged.success === false &&
      malformedStaged.violations.some(
        (violation) =>
          violation.kind === "type" && violation.path === "$input.staged",
      ),
  );

  const malformedPerformance = app.perform({
    script,
    staged,
    performance: null as never,
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed performance root returns violations",
    malformedPerformance.success === false &&
      malformedPerformance.violations.some(
        (violation) =>
          violation.kind === "type" && violation.path === "$input.performance",
      ),
  );

  const malformedDraftEntry = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [null as never],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "malformed draft action root returns violations",
    malformedDraftEntry.success === false &&
      malformedDraftEntry.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.performance.draft[0]",
      ),
  );
};
