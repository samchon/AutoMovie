import { realizeShotContract } from "@automovie/engine";
import {
  IAutoMovieCompiledShotSource,
  IAutoMovieModel,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieTransform,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  materializeCompiledFormation,
  materializeCompiledShot,
  materializeProductionModels,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  formationDesign,
  modelRecipe,
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

const transform = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

interface IProductionRealizationFixtureFailure {
  error: unknown;
}

class ProductionRealizationFixtureCleanupError extends AggregateError {}

export const preserveProductionRealizationFixtureCleanup = (
  failure: IProductionRealizationFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionRealizationFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-realization fixture teardown failed after the test failed.",
    );
  }
};

/**
 * Contract realization is recomputed from compiled scene, pose and clip data.
 *
 * The test spans every spatial selector, every scalar operator, performed and
 * static pose sampling, root composition, object TRS tracks, compiler-owned
 * formation slots, camera projection, event sampling, and failed/missing
 * evidence. No source-authored boolean or echoed contract id can pass it.
 */
export const test_mcp_production_realization = (): void => {
  let productionRealizationFailure:
    | IProductionRealizationFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    TestValidator.predicate(
      "the base realization fixture compiles",
      productionCompileSucceeded(
        "base realization fixture",
        compiler.compile({ scope: "source" }),
      ),
    );
    const base = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "generated/fixture-film/shots/opening.json"),
        "utf8",
      ),
    ) as IAutoMovieCompiledShotSource;
    const baseOutcome = realizeShotContract({
      contract: shotContract(),
      production: productionDesign(),
      world: worldDesign(),
      formations: new Map(),
      compiled: base,
      collisions: [],
    });
    TestValidator.equals(
      "the starter contract passes from actual pose and camera output",
      namedFacts([
        ["baseOutcomeDiagnostics", () => baseOutcome.diagnostics.length === 0],
        [
          "baseOutcomeRealizationOpening",
          () => baseOutcome.realization.opening.every((item) => item.passed),
        ],
        [
          "baseOutcomeRealizationClosing",
          () => baseOutcome.realization.closing.every((item) => item.passed),
        ],
        [
          "baseOutcomeRealizationEvents",
          () => baseOutcome.realization.events.every((item) => item.passed),
        ],
        [
          "baseOutcomeRealizationCamera",
          () => baseOutcome.realization.camera.every((item) => item.passed),
        ],
      ]),
      {
        baseOutcomeDiagnostics: true,
        baseOutcomeRealizationOpening: true,
        baseOutcomeRealizationClosing: true,
        baseOutcomeRealizationEvents: true,
        baseOutcomeRealizationCamera: true,
      },
    );
    const held = structuredClone(base);
    held.shot.performances = [
      { node: "soloist", motion: null, startOffset: 0 },
    ];
    const heldOutcome = realizeShotContract({
      contract: shotContract(),
      production: productionDesign(),
      world: worldDesign(),
      formations: new Map(),
      compiled: held,
      collisions: [],
    });
    TestValidator.equals(
      "an explicit null performance holds instead of falling back to the node motion",
      namedFacts([
        [
          "heldOutcomeRealizationOpening",
          () => heldOutcome.realization.opening.every((item) => item.passed),
        ],
        [
          "heldOutcomeRealizationClosing",
          () =>
            heldOutcome.realization.closing.some(
              (item) => item.passed === false,
            ),
        ],
      ]),
      {
        heldOutcomeRealizationOpening: true,
        heldOutcomeRealizationClosing: true,
      },
    );

    const formation = formationDesign();
    const formations = new Map([[formation.id, formation]]);
    const runtimeModels = materializeProductionModels(
      new Map([[modelRecipe().id, modelRecipe()]]),
    );
    const sourceStageContract: IAutoMovieShotContract = {
      ...shotContract(),
      participants: [
        ...shotContract().participants,
        { kind: "formation", id: formation.id },
      ],
    };
    const sourceStageOutcome = realizeShotContract({
      contract: sourceStageContract,
      production: null,
      frameFormat: productionDesign().frameFormat,
      world: worldDesign(),
      formations,
      compiled: {
        ...structuredClone(base),
        formations: [materializeCompiledFormation(formation)],
      },
      collisions: [],
    });
    TestValidator.equals(
      "source-stage formation realization precedes compiler-owned hero nodes",
      namedFacts([
        [
          "sourceStageOutcomeDiagnosticsLength",
          () => sourceStageOutcome.diagnostics.length === 0,
        ],
        [
          "sourceStageOutcomeRealizationFormations",
          () =>
            sourceStageOutcome.diagnostics.length === 0 &&
            sourceStageOutcome.realization.formations.some(
              (item) => item.id === formation.id && item.passed,
            ),
        ],
      ]),
      {
        sourceStageOutcomeDiagnosticsLength: true,
        sourceStageOutcomeRealizationFormations: true,
      },
    );
    const {
      models: _baseModels,
      formations: _baseFormations,
      ...sourceValue
    } = structuredClone(base);
    const source = sourceValue as IAutoMovieShotSourceOutput;
    const contract: IAutoMovieShotContract = {
      ...shotContract(),
      participants: [
        { kind: "actor", id: "soloist" },
        { kind: "formation", id: formation.id },
      ],
      opening: [
        {
          id: "measured-opening",
          description: "Every spatial selector resolves from current data.",
          predicates: [
            {
              kind: "position",
              subject: { kind: "point", position: { x: 3, y: 4, z: 5 } },
              axis: "x",
              operator: "<=",
              value: 3,
              tolerance: 0,
            },
            {
              kind: "position",
              subject: { kind: "landmark", id: "signal-ground" },
              axis: "z",
              operator: ">=",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "position",
              subject: { kind: "node", id: "prop" },
              axis: "x",
              operator: "==",
              value: 2,
              tolerance: 0,
            },
            {
              kind: "distance",
              from: { kind: "node", id: "prop" },
              to: { kind: "landmark", id: "signal-ground" },
              operator: "==",
              value: 2,
              tolerance: 0,
            },
            {
              kind: "position",
              subject: { kind: "formation", id: formation.id },
              axis: "x",
              operator: "==",
              value: 0,
              tolerance: 1e-9,
            },
            {
              kind: "joint-angle",
              actor: "unperformed",
              bone: "leftUpperArm",
              axis: "abduction",
              operator: "==",
              value: 0,
              tolerance: 1e-9,
            },
            {
              kind: "joint-angle",
              actor: "soloist",
              bone: "leftHand",
              axis: "twist",
              operator: "==",
              value: 0,
              tolerance: 1e-9,
            },
          ],
        },
      ],
      closing: [
        {
          id: "measured-closing",
          description: "Root and object clips change current transforms.",
          predicates: [
            {
              kind: "position",
              subject: { kind: "node", id: "soloist" },
              axis: "x",
              operator: "==",
              value: 0,
              tolerance: 1e-9,
            },
            {
              kind: "position",
              subject: { kind: "node", id: "soloist" },
              axis: "z",
              operator: "==",
              value: -0.5,
              tolerance: 1e-9,
            },
            {
              kind: "position",
              subject: { kind: "node", id: "prop" },
              axis: "x",
              operator: "==",
              value: 3,
              tolerance: 1e-9,
            },
          ],
        },
      ],
      camera: {
        ...shotContract().camera,
        requiredSubjects: [formation.id],
      },
      events: [
        {
          ...shotContract().events[0]!,
          subjects: [formation.id],
          predicates: [
            ...shotContract().events[0]!.predicates,
            {
              kind: "distance",
              from: { kind: "formation", id: formation.id },
              to: { kind: "point", position: { x: 0, y: 0, z: 0 } },
              operator: "<=",
              value: 0.45,
              tolerance: 1e-9,
            },
          ],
        },
      ],
    };
    const materialized = materializeCompiledShot({
      contract,
      formations,
      runtimeModels,
      source,
    }).value;
    const measuredCamera = materialized.scene.cameras.find(
      (camera) => camera.id === materialized.shot.camera,
    );
    if (measuredCamera === undefined)
      throw new Error("measured realization fixture has no camera");
    measuredCamera.transform = transform(0, 0, 5);
    materialized.shot.cameraMotion = null;
    const staticModel = materializeProductionModels(
      new Map([
        [
          "prop",
          {
            ...modelRecipe(),
            id: "prop",
            role: "prop",
            archetype: "primitive-prop",
            parameters: {
              shape: "box",
              width: 1,
              height: 1,
              depth: 1,
            },
            lod: [{ tier: "hero", maxDistance: null, recipe: "prop" }],
            capabilities: [],
          },
        ],
      ]),
    ).get("prop")!;
    materialized.models.push(staticModel);
    materialized.scene.nodes.push({
      id: "prop",
      model: staticModel.id,
      transform: transform(2, 0, 0),
      motion: null,
      pose: null,
    });
    materialized.scene.nodes.push({
      ...materialized.scene.nodes.find((node) => node.id === "soloist")!,
      id: "unperformed",
    });
    for (const keyframe of materialized.motions[0]!.keyframes)
      keyframe.pose.root = transform(0.25, 0, 0);
    materialized.shot.objectMotions = [
      {
        id: "object-trs",
        name: "Measured object and actor transforms",
        duration: contract.durationSeconds,
        loop: false,
        tracks: [
          {
            channel: { kind: "node", node: "prop", path: "translation" },
            times: [0, contract.durationSeconds],
            values: [2, 0, 0, 3, 0, 0],
            interpolation: "linear",
          },
          {
            channel: { kind: "node", node: "soloist", path: "rotation" },
            times: [0, contract.durationSeconds],
            values: [0, 0, 0, 1, 0, 0.7071067811865475, 0, 0.7071067811865476],
            interpolation: "linear",
          },
          {
            channel: { kind: "node", node: "soloist", path: "scale" },
            times: [0, contract.durationSeconds],
            values: [1, 1, 1, 2, 2, 2],
            interpolation: "linear",
          },
        ],
      },
    ];
    const measured = realizeShotContract({
      contract,
      production: productionDesign(),
      world: worldDesign(),
      formations,
      compiled: materialized,
      collisions: [],
    });
    if (measured.diagnostics.length !== 0)
      throw new Error(
        `Measured realization fixture failed:\n${JSON.stringify(measured, null, 2)}`,
      );
    TestValidator.equals(
      "typed predicates and formations pass only from measured output",
      namedFacts([
        [
          "measuredRealizationOpening",
          () =>
            measured.realization.opening[0]?.predicates.every(
              (item) => item.passed,
            ) === true,
        ],
        [
          "measuredRealizationClosing",
          () =>
            measured.realization.closing[0]?.predicates.every(
              (item) => item.passed,
            ) === true,
        ],
        [
          "measuredRealizationEvents",
          () => measured.realization.events[0]?.passed === true,
        ],
        [
          "measuredRealizationFormations",
          () => measured.realization.formations[0]?.count === formation.count,
        ],
        [
          "measuredRealizationFormations2",
          () => measured.realization.formations[0]?.passed === true,
        ],
      ]),
      {
        measuredRealizationOpening: true,
        measuredRealizationClosing: true,
        measuredRealizationEvents: true,
        measuredRealizationFormations: true,
        measuredRealizationFormations2: true,
      },
    );
    const ghostSubjectContract = structuredClone(contract);
    ghostSubjectContract.events[0]!.subjects = ["ghost"];
    const ghostSubjectOutcome = realizeShotContract({
      contract: ghostSubjectContract,
      production: productionDesign(),
      world: worldDesign(),
      formations,
      compiled: materialized,
      collisions: [],
    });
    TestValidator.equals(
      "an event cannot pass while a declared subject is absent",
      namedFacts([
        [
          "ghostSubjectOutcomeRealizationEvents",
          () => ghostSubjectOutcome.realization.events[0]?.passed === false,
        ],
        [
          "ghostSubjectOutcomeDiagnosticsSome",
          () =>
            ghostSubjectOutcome.realization.events[0]?.passed === false &&
            ghostSubjectOutcome.diagnostics.some((item) =>
              item.message.includes("resolve every declared subject"),
            ),
        ],
      ]),
      {
        ghostSubjectOutcomeRealizationEvents: true,
        ghostSubjectOutcomeDiagnosticsSome: true,
      },
    );
    const emptyFormationSubjectOutcome = realizeShotContract({
      contract,
      production: productionDesign(),
      world: worldDesign(),
      formations,
      compiled: { ...materialized, formations: [] },
      collisions: [],
    });
    TestValidator.predicate(
      "an empty formation cannot satisfy an event subject",
      emptyFormationSubjectOutcome.realization.events[0]?.passed === false,
    );
    const missingFormationRuntimeOutcome = realizeShotContract({
      contract,
      production: productionDesign(),
      world: worldDesign(),
      formations,
      compiled: { ...materialized, formations: [] },
      collisions: [],
    });
    const missingFormationDesignOutcome = realizeShotContract({
      contract,
      production: productionDesign(),
      world: worldDesign(),
      formations: new Map(),
      compiled: materialized,
      collisions: [],
    });
    TestValidator.equals(
      "formation realization reports absent compact runtimes and designs",
      namedFacts([
        [
          "missingFormationRuntimeOutcomeRealizationFormations",
          () =>
            missingFormationRuntimeOutcome.realization.formations[0]?.count ===
            0,
        ],
        [
          "missingFormationRuntimeOutcomeRealizationFormations2",
          () =>
            missingFormationRuntimeOutcome.realization.formations[0]?.passed ===
            false,
        ],
        [
          "missingFormationDesignOutcomeRealizationFormations",
          () =>
            missingFormationDesignOutcome.realization.formations[0]?.count ===
            formation.count,
        ],
        [
          "missingFormationDesignOutcomeRealizationFormations2",
          () =>
            missingFormationDesignOutcome.realization.formations[0]?.passed ===
            false,
        ],
        [
          "missingFormationDesignOutcomeDiagnosticsItem",
          () =>
            missingFormationDesignOutcome.diagnostics.some((item) =>
              item.message.includes("compact 0-slot runtime"),
            ),
        ],
      ]),
      {
        missingFormationRuntimeOutcomeRealizationFormations: true,
        missingFormationRuntimeOutcomeRealizationFormations2: true,
        missingFormationDesignOutcomeRealizationFormations: true,
        missingFormationDesignOutcomeRealizationFormations2: true,
        missingFormationDesignOutcomeDiagnosticsItem: true,
      },
    );
    const heroModelTampered = structuredClone(materialized);
    heroModelTampered.scene.nodes.find((node) => node.id === "captain")!.model =
      staticModel.id;
    const heroModelOutcome = realizeShotContract({
      contract,
      production: productionDesign(),
      world: worldDesign(),
      formations,
      compiled: heroModelTampered,
      collisions: [],
    });
    const missingHeroNode = structuredClone(materialized);
    missingHeroNode.scene.nodes = missingHeroNode.scene.nodes.filter(
      (node) => node.id !== "captain",
    );
    const missingHeroNodeOutcome = realizeShotContract({
      contract,
      production: productionDesign(),
      world: worldDesign(),
      formations,
      compiled: missingHeroNode,
      collisions: [],
    });
    TestValidator.equals(
      "named heroes must retain their compiler-owned model and scene node",
      namedFacts([
        [
          "heroModelOutcomeRealizationFormations",
          () =>
            heroModelOutcome.realization.formations.some(
              (item) => item.id === formation.id && item.passed === false,
            ),
        ],
        [
          "missingHeroNodeOutcomeRealizationFormations",
          () =>
            missingHeroNodeOutcome.realization.formations.some(
              (item) => item.id === formation.id && item.passed === false,
            ),
        ],
      ]),
      {
        heroModelOutcomeRealizationFormations: true,
        missingHeroNodeOutcomeRealizationFormations: true,
      },
    );

    const unreadable = structuredClone(base);
    unreadable.scene.nodes.find(
      (node) => node.id === "soloist",
    )!.transform.translation.x = 1_000;
    const unreadableOutcome = realizeShotContract({
      contract: shotContract(),
      production: productionDesign(),
      world: worldDesign(),
      formations: new Map(),
      compiled: unreadable,
      collisions: [],
    });
    const missingCameraOutcome = realizeShotContract({
      contract: {
        ...shotContract(),
        participants: [
          ...shotContract().participants,
          { kind: "formation", id: formation.id },
        ],
      },
      production: null,
      world: null,
      formations: new Map([[formation.id, formation]]),
      compiled: {
        ...structuredClone(base),
        eventSamples: [
          { id: "wrong-event", time: Number.NaN },
          { id: "wrong-event", time: Number.NaN },
        ],
        models: [] as IAutoMovieModel[],
        scene: {
          ...structuredClone(base.scene),
          nodes: [],
          cameras: [],
        },
      },
      collisions: ["formation:line:slot:000001"],
    });
    TestValidator.equals(
      "unreadable, absent, duplicate and colliding evidence all fail closed",
      namedFacts([
        [
          "unreadableOutcomeRealizationCamera",
          () =>
            unreadableOutcome.realization.camera.some(
              (item) => item.passed === false,
            ),
        ],
        [
          "missingCameraOutcomeRealizationOpening",
          () =>
            missingCameraOutcome.realization.opening.some(
              (item) => item.passed === false,
            ),
        ],
        [
          "missingCameraOutcomeRealizationClosing",
          () =>
            missingCameraOutcome.realization.closing.some(
              (item) => item.passed === false,
            ),
        ],
        [
          "missingCameraOutcomeRealizationEvents",
          () =>
            missingCameraOutcome.realization.events.some(
              (item) => item.passed === false,
            ),
        ],
        [
          "missingCameraOutcomeRealizationCamera",
          () =>
            missingCameraOutcome.realization.camera.every(
              (item) => item.passed === false,
            ),
        ],
        [
          "missingCameraOutcomeRealizationFormations",
          () =>
            missingCameraOutcome.realization.formations.some(
              (item) =>
                item.count === 0 &&
                item.min.x === 0 &&
                item.max.z === 0 &&
                item.passed === false,
            ),
        ],
        [
          "missingCameraOutcomeDiagnosticsItem",
          () =>
            missingCameraOutcome.diagnostics.some((item) =>
              item.message.includes("collides"),
            ),
        ],
        [
          "missingCameraOutcomeDiagnosticsItem2",
          () =>
            missingCameraOutcome.diagnostics.some((item) =>
              item.message.includes('actor "soloist"'),
            ),
        ],
      ]),
      {
        unreadableOutcomeRealizationCamera: true,
        missingCameraOutcomeRealizationOpening: true,
        missingCameraOutcomeRealizationClosing: true,
        missingCameraOutcomeRealizationEvents: true,
        missingCameraOutcomeRealizationCamera: true,
        missingCameraOutcomeRealizationFormations: true,
        missingCameraOutcomeDiagnosticsItem: true,
        missingCameraOutcomeDiagnosticsItem2: true,
      },
    );

    const brokenCompiled = structuredClone(materialized);
    brokenCompiled.scene.nodes.push({
      ...brokenCompiled.scene.nodes.find((node) => node.id === "soloist")!,
      id: "missing-motion",
      motion: "absent-motion",
    });
    brokenCompiled.scene.nodes.push({
      ...brokenCompiled.scene.nodes.find((node) => node.id === "prop")!,
      id: "missing-model",
      model: "absent-model",
    });
    const missingOperands: IAutoMovieShotContract = {
      ...shotContract(),
      opening: [
        {
          id: "missing-operands",
          description: "Every missing operand fails instead of defaulting.",
          predicates: [
            {
              kind: "position",
              subject: { kind: "landmark", id: "absent-landmark" },
              axis: "x",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "position",
              subject: { kind: "formation", id: "absent-formation" },
              axis: "x",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "position",
              subject: { kind: "node", id: "absent-node" },
              axis: "x",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "joint-angle",
              actor: "missing-motion",
              bone: "leftUpperArm",
              axis: "abduction",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "joint-angle",
              actor: "absent-actor",
              bone: "leftUpperArm",
              axis: "abduction",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "position",
              subject: { kind: "node", id: "missing-model" },
              axis: "x",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "joint-angle",
              actor: "prop",
              bone: "leftUpperArm",
              axis: "abduction",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
            {
              kind: "joint-angle",
              actor: "soloist",
              bone: "rightLowerLeg",
              axis: "twist",
              operator: "==",
              value: 0,
              tolerance: 0,
            },
          ],
        },
      ],
    };
    const missingOperandsOutcome = realizeShotContract({
      contract: missingOperands,
      production: productionDesign(),
      world: worldDesign(),
      formations: new Map(),
      compiled: brokenCompiled,
      collisions: [],
    });
    const missingOperandPredicates =
      missingOperandsOutcome.realization.opening[0]?.predicates ?? [];
    TestValidator.predicate(
      "missing selector operands produce null measured values",
      ([0, 1, 2, 3, 4, 6] as const).every((index) => {
        const item = missingOperandPredicates[index];
        return item?.actual === null && item.passed === false;
      }),
    );
    TestValidator.equals(
      "node transforms and omitted joint channels remain measurable",
      namedFacts([
        [
          "missingOperandPredicatesActual",
          () => missingOperandPredicates[5]?.actual === 2,
        ],
        [
          "missingOperandPredicatesPassed",
          () => missingOperandPredicates[5].passed === false,
        ],
        [
          "missingOperandPredicatesActual2",
          () => missingOperandPredicates[7]?.actual === 0,
        ],
        [
          "missingOperandPredicatesPassed2",
          () => missingOperandPredicates[7].passed === true,
        ],
      ]),
      {
        missingOperandPredicatesActual: true,
        missingOperandPredicatesPassed: true,
        missingOperandPredicatesActual2: true,
        missingOperandPredicatesPassed2: true,
      },
    );
  } catch (error) {
    productionRealizationFailure = { error };
    throw error;
  } finally {
    preserveProductionRealizationFixtureCleanup(
      productionRealizationFailure,
      () => fixture.dispose(),
    );
  }
};
