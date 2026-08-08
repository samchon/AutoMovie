import {
  IAutoMovieActionSynthesizer,
  performShot,
  stageScene,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

const synth: IAutoMovieActionSynthesizer = (action, actor) =>
  action.verb === "launch" || action.verb === "attachTo"
    ? null
    : validSynthesizer(action, actor);

/**
 * Secondary action references are consumed directly by launch, target
 * resolution, and attach compilation. Matching blank staged ids must not pass
 * just because they are present in the staged scene map.
 *
 * Scenario: blank projectile, node target, group member, gesture target, and
 * attach parent references fail at their own fields.
 */
export const test_film_perform_shot_secondary_nonempty_refs = (): void => {
  const script = makeScriptWrite();
  const baseStaged = stageScene(script, makeStagingWrite());
  if (baseStaged.success !== true) throw new Error("staging must succeed");

  const blankTarget = {
    ...baseStaged.scene.nodes[0]!,
    id: " ",
    transform: {
      ...baseStaged.scene.nodes[0]!.transform,
      translation: { x: 1.5, y: 0, z: 0 },
    },
  };
  const blankProjectile = {
    ...baseStaged.scene.nodes[0]!,
    id: "\t",
    transform: {
      ...baseStaged.scene.nodes[0]!.transform,
      translation: { x: 0.2, y: 1, z: 0 },
    },
  };
  const arrow = {
    ...baseStaged.scene.nodes[0]!,
    id: "arrow",
    transform: {
      ...baseStaged.scene.nodes[0]!.transform,
      translation: { x: 0, y: 1, z: 0 },
    },
  };
  const staged = {
    ...baseStaged,
    scene: {
      ...baseStaged.scene,
      nodes: [...baseStaged.scene.nodes, blankTarget, blankProjectile, arrow],
    },
  };

  const performed = performShot({
    script,
    staged,
    performance: makePerformanceWrite({
      duration: 6,
      draft: [
        {
          verb: "launch",
          actor: "knightA",
          start: 0,
          duration: 0.4,
          projectile: "\t",
          at: { kind: "point", point: { x: 1, y: 1, z: 0 } },
          speed: 10,
        },
        {
          verb: "launch",
          actor: "knightA",
          start: 1,
          duration: 0.4,
          projectile: "arrow",
          at: { kind: "node", node: " " },
          speed: 10,
        },
        {
          verb: "lookAt",
          actor: "knightA",
          start: 2,
          duration: 0.4,
          to: { kind: "node", node: " " },
        },
        {
          verb: "reach",
          actor: "knightA",
          start: 3,
          duration: 0.4,
          hand: "right",
          to: { kind: "group", nodes: [" "] },
        },
        {
          verb: "gesture",
          actor: "knightA",
          start: 4,
          duration: 0.4,
          kind: "point",
          at: { kind: "node", node: " " },
        },
        {
          verb: "attachTo",
          actor: "knightB",
          start: 5,
          duration: 0.4,
          parent: " ",
          bone: "leftHand",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: synth,
    skeleton: () => createSkeleton(),
  });

  TestValidator.equals(
    "blank secondary performance refs fail",
    performed.success,
    false,
  );
  TestValidator.equals(
    "blank projectile violation",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () =>
          performed.success === false &&
          hasViolation(performed, "type", "$input.draft[0].projectile"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "blank launch node target violation",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () =>
          performed.success === false &&
          hasViolation(performed, "type", "$input.draft[1].at.node"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "blank lookAt node target violation",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () =>
          performed.success === false &&
          hasViolation(performed, "type", "$input.draft[2].to.node"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "blank reach group target violation",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () =>
          performed.success === false &&
          hasViolation(performed, "type", "$input.draft[3].to.nodes[0]"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "blank gesture node target violation",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () =>
          performed.success === false &&
          hasViolation(performed, "type", "$input.draft[4].at.node"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "blank attach parent violation",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () =>
          performed.success === false &&
          hasViolation(performed, "type", "$input.draft[5].parent"),
      ],
    ]),
    { refused: true, violated: true },
  );
};
