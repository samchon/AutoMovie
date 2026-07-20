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
import { hasViolation } from "../internal/predicates";

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

const rest = createSkeleton().bones[0]!.rest;

/**
 * The MCP `perform` structural shape gate: the malformed-payload branches the
 * base perform tool test does not reach: a non-object script/staged/
 * performance sub-shape, a non-object scene node transform, a non-array action
 * list, a non-object clips registry, and the actor rig's own bones-array /
 * bone-object / bone-name floor. Each fails as a field-located violation
 * before the synthesizer or engine dereferences it.
 *
 * Scenarios:
 *
 * 1. A non-object script, a non-object beat, a non-object staged scene, a
 *    non-object staged camera, a non-object staged node, and a non-object node
 *    transform each fail at their submitted `$input...` paths.
 * 2. A non-object performance revision and a non-array performance draft fail at
 *    their paths.
 * 3. A non-object clips registry fails at `$input.clips`.
 * 4. An actor rig whose `bones` is not an array, whose bone is not an object, and
 *    whose bone name is not a string each fail at their rig paths.
 */
export const test_mcp_perform_shape_edges = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");
  const nodePosition = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((x) => x.id === id);
    if (node === undefined) throw new Error(`missing staged node ${id}`);
    return node.transform.translation;
  };
  const actors = (): Record<string, IAutoMovieMcpActorContext> => ({
    knightA: context(nodePosition("knightA"), 0),
  });
  const performance = makePerformanceWrite({
    draft: [
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

  const perform = (props: {
    script?: unknown;
    staged?: unknown;
    performance?: unknown;
    clips?: unknown;
    actors?: Record<string, IAutoMovieMcpActorContext>;
  }): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    app.perform({
      script: (props.script ?? script) as never,
      staged: (props.staged ?? staged) as never,
      performance: (props.performance ?? performance) as never,
      actors: props.actors ?? actors(),
      ...(props.clips !== undefined ? { clips: props.clips as never } : {}),
    }).performed;

  const nonObjectScript = perform({ script: 5 });
  TestValidator.predicate(
    "a non-object script fails at its path",
    hasViolation(nonObjectScript, "type", "$input.script"),
  );

  const nonObjectBeat = perform({ script: { ...script, beats: [null] } });
  TestValidator.predicate(
    "a non-object script beat fails at its path",
    hasViolation(nonObjectBeat, "type", "$input.script.beats[0]"),
  );

  const nonObjectScene = perform({ staged: { ...staged, scene: 5 } });
  TestValidator.predicate(
    "a non-object staged scene fails at its path",
    hasViolation(nonObjectScene, "type", "$input.staged.scene"),
  );

  const nonObjectCamera = perform({
    staged: { ...staged, scene: { ...staged.scene, cameras: [null] } },
  });
  TestValidator.predicate(
    "a non-object staged camera fails at its path",
    hasViolation(nonObjectCamera, "type", "$input.staged.scene.cameras[0]"),
  );

  const nonObjectNode = perform({
    staged: { ...staged, scene: { ...staged.scene, nodes: [null] } },
  });
  TestValidator.predicate(
    "a non-object staged node fails at its path",
    hasViolation(nonObjectNode, "type", "$input.staged.scene.nodes[0]"),
  );

  const nonObjectTransform = perform({
    staged: {
      ...staged,
      scene: { ...staged.scene, nodes: [{ id: "x", transform: 5 }] },
    },
  });
  TestValidator.predicate(
    "a non-object staged node transform fails at its path",
    hasViolation(
      nonObjectTransform,
      "type",
      "$input.staged.scene.nodes[0].transform",
    ),
  );

  const nonObjectRevise = perform({
    performance: { ...performance, revise: 5 },
  });
  TestValidator.predicate(
    "a non-object performance revision fails at its path",
    hasViolation(nonObjectRevise, "type", "$input.performance.revise"),
  );

  const nonArrayDraft = perform({
    performance: { ...performance, draft: 5 },
  });
  TestValidator.predicate(
    "a non-array performance draft fails at its path",
    hasViolation(nonArrayDraft, "type", "$input.performance.draft"),
  );

  const nonObjectClips = perform({ clips: 5 });
  TestValidator.predicate(
    "a non-object clips registry fails at its path",
    hasViolation(nonObjectClips, "type", "$input.clips"),
  );

  const rigProbe = (
    rig: unknown,
  ): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    perform({
      actors: {
        knightA: {
          ...context(nodePosition("knightA"), 0),
          rig,
        } as unknown as IAutoMovieMcpActorContext,
      },
    });

  const nonArrayBones = rigProbe({ id: "skeleton-1", bones: 5 });
  TestValidator.predicate(
    "a rig whose bones is not an array fails at its path",
    hasViolation(nonArrayBones, "type", "$input.actors.knightA.rig.bones"),
  );

  const nonObjectBone = rigProbe({ id: "skeleton-1", bones: [null] });
  TestValidator.predicate(
    "a rig whose bone is not an object fails at its path",
    hasViolation(nonObjectBone, "type", "$input.actors.knightA.rig.bones[0]"),
  );

  const nonStringBoneName = rigProbe({
    id: "skeleton-1",
    bones: [{ bone: 5, parent: null, rest, constraint: null }],
  });
  TestValidator.predicate(
    "a rig whose bone name is not a string fails at its path",
    hasViolation(
      nonStringBoneName,
      "type",
      "$input.actors.knightA.rig.bones[0].bone",
    ),
  );
};
