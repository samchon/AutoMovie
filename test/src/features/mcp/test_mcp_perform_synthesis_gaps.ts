import { IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

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

const riglessContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const { rig: _rig, ...rest } = context(position, facingDeg);
  return rest;
};

/**
 * A structurally valid rig (unique bones, one root, no cycle; it passes
 * `validateActorRig`) that nonetheless LACKS the arm chain `reachPose` needs. A
 * `reach`/`point`/`strike` to a resolvable target therefore synthesises `null`
 * from a present rig, driving the "could not solve" describer arms that an
 * arm-bearing rig never reaches.
 */
const armlessRigContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const rest = createSkeleton().bones[0]!.rest;
  return {
    ...riglessContext(position, facingDeg),
    rig: {
      id: "skeleton-1",
      bones: [
        { bone: "hips", parent: null, rest, constraint: null },
        { bone: "spine", parent: "hips", rest, constraint: null },
      ],
    },
  } as unknown as IAutoMovieMcpActorContext;
};

const cameraFrame = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
} as const;

/**
 * The MCP `perform` tool's default-synthesis gap describers (#998, #1005,
 * #1148): when the reference synthesiser returns `null` for an action, the
 * pipeline turns that silence into a field-located violation rather than a
 * dropped action or a downstream throw. This scenario drives each describer arm
 * through `app.perform(...)` with its own malformed-but-shaped payload.
 *
 * Scenarios:
 *
 * 1. A `launch` whose `onHit` targets a staged node fails when that node has no
 *    MCP context, and again when the context is rig-less, both at
 *    `$input.performance.draft[i].onHit`, while a launch whose target carries a
 *    full context returns no synthesis gap (its shot compiles).
 * 2. A non-launch/non-enact action naming an actor with no MCP context at all
 *    fails at that action's `actor` path before the default performer reads
 *    it.
 * 3. A `lookAt` toward a node the scene never placed produces no synthesis gap
 *    (the target does not resolve, so the describer yields to `performShot`),
 *    while a `reach` and a `gesture point`/`strike` toward a RESOLVABLE node on
 *    an arm-less-but-present rig each fail at their `to`/`at` path (the rig
 *    resolves but the arm cannot).
 * 4. A `gesture point`/`strike`/`reach` on a rig-less context fails at the
 *    action's `actor` path (the rig-required rung), and a rig-less `react` with
 *    valid timing/force fails the same way.
 * 5. A unison (`actor: [a, b]`) rig-less gesture locates each refusal at its own
 *    `actor[i]` index.
 * 6. A successful perform whose second actor carries a rig-less context still
 *    compiles: the `skeleton(node) => rig ?? null` accessor returns null for it
 *    without failing the shot.
 */
export const test_mcp_perform_synthesis_gaps = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");

  const nodePosition = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((x) => x.id === id);
    if (node === undefined) throw new Error(`missing staged node ${id}`);
    return node.transform.translation;
  };

  const performDraft = (
    draft: Record<string, unknown>[],
    actors: Record<string, IAutoMovieMcpActorContext>,
  ): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    app.perform({
      script,
      staged,
      performance: makePerformanceWrite({
        draft: [...draft, cameraFrame] as never,
        duration: 1,
        revise: { review: "unchanged.", final: null },
      }),
      actors,
    }).performed;

  const hasType = (
    performed: ReturnType<AutoMovieApplication["perform"]>["performed"],
    path: string,
  ): boolean =>
    performed.success === false &&
    performed.violations.some(
      (violation) => violation.kind === "type" && violation.path === path,
    );

  // 1. launch onHit gaps: the target node lacks a context, then a rig.
  const launchAt = (
    onHitTargetActors: Record<string, IAutoMovieMcpActorContext>,
  ): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    performDraft(
      [
        {
          verb: "launch",
          actor: "knightA",
          start: 0,
          duration: 1,
          projectile: "arrow",
          at: { kind: "node", node: "knightB" },
          speed: 12,
          onHit: { force: 0.5 },
        },
      ],
      onHitTargetActors,
    );

  const launchNoTargetContext = launchAt({
    knightA: context(nodePosition("knightA"), 0),
  });
  TestValidator.predicate(
    "launch onHit fails when the target node has no MCP context",
    hasType(launchNoTargetContext, "$input.performance.draft[0].onHit"),
  );

  const launchRiglessTarget = launchAt({
    knightA: context(nodePosition("knightA"), 0),
    knightB: riglessContext(nodePosition("knightB"), 180),
  });
  TestValidator.predicate(
    "launch onHit fails when the target context has no rig",
    hasType(launchRiglessTarget, "$input.performance.draft[0].onHit"),
  );

  const launchResolved = launchAt({
    knightA: context(nodePosition("knightA"), 0),
    knightB: context(nodePosition("knightB"), 180),
  });
  TestValidator.predicate(
    "launch onHit toward a fully-contexted node yields no onHit synthesis gap",
    launchResolved.success === true ||
      (launchResolved.success === false &&
        launchResolved.violations.every(
          (violation) => violation.path !== "$input.performance.draft[0].onHit",
        )),
  );

  // 2. an action naming an actor with no context fails at the actor path.
  const ghostActor = performDraft(
    [{ verb: "gesture", actor: "ghost", start: 0, duration: 1, kind: "wave" }],
    { knightA: context(nodePosition("knightA"), 0) },
  );
  TestValidator.predicate(
    "a gesture for a context-less actor fails at the actor path",
    hasType(ghostActor, "$input.performance.draft[0].actor"),
  );

  // 3a. a lookAt toward an unplaced node resolves to no point: no synthesis gap
  //     at `.to` (the describer yields to performShot).
  const lookAtGhost = performDraft(
    [
      {
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 1,
        to: { kind: "node", node: "ghostNode" },
      },
    ],
    { knightA: context(nodePosition("knightA"), 0) },
  );
  TestValidator.equals(
    "a lookAt toward an unplaced node fails as data (the describer yields null)",
    lookAtGhost.success,
    false,
  );

  // 3b. a reach toward a RESOLVABLE node on an arm-less rig fails at `.to`.
  const reachArmless = performDraft(
    [
      {
        verb: "reach",
        actor: "knightA",
        start: 0,
        duration: 1,
        hand: "right",
        to: { kind: "node", node: "knightB" },
      },
    ],
    { knightA: armlessRigContext(nodePosition("knightA"), 0) },
  );
  TestValidator.predicate(
    "a reach an arm-less rig cannot solve fails at .to",
    hasType(reachArmless, "$input.performance.draft[0].to"),
  );

  // 3c. a gesture point/strike toward a resolvable node on an arm-less rig
  //     fails at `.at`.
  for (const kind of ["point", "strike"] as const) {
    const gestureArmless = performDraft(
      [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind,
          at: { kind: "node", node: "knightB" },
        },
      ],
      { knightA: armlessRigContext(nodePosition("knightA"), 0) },
    );
    TestValidator.predicate(
      `a gesture ${kind} an arm-less rig cannot solve fails at .at`,
      hasType(gestureArmless, "$input.performance.draft[0].at"),
    );
  }

  // 3c'. a reach toward an unplaced node resolves to no point: the reach
  //      describer yields null (no gap at `.to`) and performShot owns it.
  const reachUnresolvable = performDraft(
    [
      {
        verb: "reach",
        actor: "knightA",
        start: 0,
        duration: 1,
        hand: "right",
        to: { kind: "node", node: "ghostNode" },
      },
    ],
    { knightA: context(nodePosition("knightA"), 0) },
  );
  TestValidator.equals(
    "a reach toward an unplaced node fails as data (the describer yields null)",
    reachUnresolvable.success,
    false,
  );

  // 3d. a gesture point with an unresolvable target yields no gap at `.at`
  //     (the describer returns null; performShot owns the outcome).
  const pointUnresolvable = performDraft(
    [
      {
        verb: "gesture",
        actor: "knightA",
        start: 0,
        duration: 1,
        kind: "point",
        at: { kind: "node", node: "ghostNode" },
      },
    ],
    { knightA: context(nodePosition("knightA"), 0) },
  );
  TestValidator.equals(
    "a gesture point toward an unplaced node fails as data (the describer yields null)",
    pointUnresolvable.success,
    false,
  );

  // 4. rig-required rungs on rig-less contexts.
  for (const kind of ["point", "strike"] as const) {
    const gestureRigless = performDraft(
      [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind,
          at: { kind: "node", node: "knightB" },
        },
      ],
      { knightA: riglessContext(nodePosition("knightA"), 0) },
    );
    TestValidator.predicate(
      `a rig-less gesture ${kind} fails at the actor path`,
      hasType(gestureRigless, "$input.performance.draft[0].actor"),
    );
  }

  const riglessReact = performDraft(
    [
      {
        verb: "react",
        actor: "knightA",
        start: 0,
        duration: 0.5,
        from: { kind: "point", point: { x: 0, y: 0, z: 2 } },
        force: 0.5,
      },
    ],
    { knightA: riglessContext(nodePosition("knightA"), 0) },
  );
  TestValidator.predicate(
    "a rig-less react with valid timing fails at the actor path",
    hasType(riglessReact, "$input.performance.draft[0].actor"),
  );

  // 5. a unison rig-less gesture locates each refusal at its own actor index.
  const unisonRigless = performDraft(
    [
      {
        verb: "gesture",
        actor: ["knightA", "knightB"],
        start: 0,
        duration: 1,
        kind: "point",
        at: { kind: "node", node: "knightA" },
      },
    ],
    {
      knightA: riglessContext(nodePosition("knightA"), 0),
      knightB: riglessContext(nodePosition("knightB"), 180),
    },
  );
  TestValidator.predicate(
    "a unison rig-less gesture locates each refusal at its actor index",
    hasType(unisonRigless, "$input.performance.draft[0].actor[0]") &&
      hasType(unisonRigless, "$input.performance.draft[0].actor[1]"),
  );

  // 6. a successful perform whose second actor is rig-less still compiles: the
  //    skeleton(node) => rig ?? null accessor returns null for it.
  const riglessSecond = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: ["knightA", "knightB"],
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
        },
        cameraFrame,
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
      knightB: riglessContext(nodePosition("knightB"), 180),
    },
  }).performed;
  TestValidator.equals(
    "a perform with a rig-less second actor still compiles",
    riglessSecond.success,
    true,
  );

  // 7. a successful perform coupling a staged mount exercises the
  //    restFrames(node) accessor performShot hands to coupleObjects.
  const mountedPerform = app.perform({
    script,
    staged: {
      ...staged,
      mounts: [
        { node: "knightB", binding: { parent: "knightA", bone: "hips" } },
      ],
    },
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: "knightA",
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
        },
        cameraFrame,
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
      knightB: context(nodePosition("knightB"), 180),
    },
  }).performed;
  TestValidator.equals(
    "a mounted perform compiles through object coupling",
    mountedPerform.success,
    true,
  );
};
