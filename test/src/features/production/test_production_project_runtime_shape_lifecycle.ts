import {
  IAutoMovieDesignTarget,
  IAutoMovieModelRecipe,
} from "@automovie/interface";
import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  AutoMovieProductionSourcePathError,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";
import {
  acceptanceScenarios,
  fixtureWorldDesign,
  formationDesign,
  modelRecipe,
  productionDesign,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
} from "./productionFixtures";

interface IRuntimeShapeCleanupFailure {
  error: unknown;
}

class RuntimeShapeCleanupError extends AggregateError {}

const removeFixture = (
  failure: IRuntimeShapeCleanupFailure | undefined,
  dispose: () => void,
): void => {
  try {
    dispose();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new RuntimeShapeCleanupError(
      [failure.error, cleanupFailure],
      "Runtime-shape fixture cleanup failed after the behavior assertion failed.",
    );
  }
};

const diagnosticCodes = (value: {
  diagnostics: readonly { code: string }[];
}): string[] => value.diagnostics.map((entry) => entry.code);

/**
 * Exercise the production project's ordinary lifecycle as an externally
 * observable repository contract: initialization and read-only reopening,
 * every design address and setter, rejected and accepted mutations, source and
 * owned-file reads, optimistic snapshot confirmation, and audited erasure.
 *
 * Scenarios:
 *
 * 1. Fresh and initialized roots distinguish writable initialization from a
 *    non-materializing read-only refusal and reopening.
 * 2. Summary, registry, incarnation, content, source, screenplay, inventory,
 *    and all six design addresses return independently known resident facts.
 * 3. Every setter has accepted, schema-refused, semantic-refused, collision,
 *    dependency, and downstream-invalidation twins with revision/file oracles.
 * 4. Referenced/missing/blank-reason erase refusals protect the graph, while an
 *    unreferenced formation writes its audit and disappears.
 * 5. Read-only snapshot confirmation accepts the observed revision, rejects a
 *    changed guard, and cannot mutate world bytes.
 * 6. Production erasure unregisters only its target, preserves its sibling,
 *    and invalidates the erased handle.
 */
export const test_production_project_runtime_shape_lifecycle = (): void => {
  const absent = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-project-readonly-"),
  );
  let absentFailure: IRuntimeShapeCleanupFailure | undefined;
  try {
    TestValidator.predicate(
      "read-only open refuses an uninitialized physical project",
      throwsError(
        () => AutoMovieProductionProject.openReadOnly(absent),
        ["state root", "missing"],
      ),
    );
    TestValidator.equals(
      "read-only refusal creates no AutoMovie state",
      fs.existsSync(path.join(absent, "automovie")),
      false,
    );
  } catch (error) {
    absentFailure = { error };
    throw error;
  } finally {
    removeFixture(absentFailure, () =>
      fs.rmSync(absent, { force: true, recursive: true }),
    );
  }

  const fixture = productionFixture();
  let fixtureFailure: IRuntimeShapeCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(
      fixture.root,
      "fixture-film",
    );
    const summary = project.summary();
    TestValidator.equals("summary identifies the active production", summary, {
      root: fixture.root,
      productionId: "fixture-film",
      productions: ["fixture-film"],
      formatVersion: 2,
      revision: project.revision(),
      initialized: true,
    });
    TestValidator.equals(
      "static and live registry views independently identify the fixture",
      [
        AutoMovieProductionProject.registeredProductionIds(fixture.root),
        project.productionIds(),
      ],
      [["fixture-film"], ["fixture-film"]],
    );
    TestValidator.equals(
      "project incarnation is the resident byte-exact state record",
      Buffer.from(project.projectStateRecords().incarnation),
      fs.readFileSync(path.join(fixture.root, "automovie/incarnation.json")),
    );
    TestValidator.equals(
      "manifest identity preserves the migrated fixture project id",
      project.manifest().projectId,
      "fixture-film",
    );
    const contentInputs = project.contentInputs();
    TestValidator.equals(
      "content inventory includes source, render, and absent optional inputs",
      [
        contentInputs.some(
          (entry) => entry.path === "src/film.ts" && entry.source,
        ),
        contentInputs.some(
          (entry) =>
            entry.path === "scripts/emitDesign.ts" &&
            entry.render &&
            entry.source === false &&
            entry.bytes !== null,
        ),
        contentInputs.some(
          (entry) => entry.path === "package-lock.json" && entry.bytes === null,
        ),
      ],
      [true, true, true],
    );
    TestValidator.predicate(
      "source read returns the registered film module",
      Buffer.from(project.readSource("src/film.ts"))
        .toString("utf8")
        .includes("export const film"),
    );
    TestValidator.predicate(
      "missing source has a stable structured reason",
      (() => {
        try {
          project.readSource("src/missing.ts");
          return false;
        } catch (error) {
          return (
            error instanceof AutoMovieProductionSourcePathError &&
            error.reason === "missing"
          );
        }
      })(),
    );
    TestValidator.predicate(
      "source traversal refuses outside the configured root",
      throwsError(() => project.resolveSourcePath("../outside.ts"), "outside"),
    );
    TestValidator.equals(
      "tracked/generated absence remains distinct from the resident screenplay index",
      [
        project.readTrackedStateFile("not-present.json"),
        project.generatedManifest(),
        project.screenplayIndex() === null,
      ],
      [null, null, false],
    );

    const graph = project.graph();
    const targetValues: Array<[IAutoMovieDesignTarget, unknown]> = [
      [{ kind: "production" }, graph.production],
      [{ kind: "model", id: "soloist" }, graph.models.get("soloist")],
      [{ kind: "world" }, graph.world],
      [{ kind: "formation", id: "missing" }, null],
      [{ kind: "shot", id: "opening" }, graph.shots.get("opening")],
      [
        { kind: "acceptance", id: "opening-beauty" },
        graph.acceptance.get("opening-beauty"),
      ],
    ];
    for (const [target, expected] of targetValues) {
      TestValidator.equals(
        `design address ${target.kind}`,
        project.design(target),
        expected ?? null,
      );
      TestValidator.predicate(
        `design path ${target.kind} is project-relative`,
        project.designRecordPath(target).startsWith("automovie/design/"),
      );
    }
    TestValidator.equals(
      "inventory reflects the stored graph",
      project.inventory(),
      {
        production: true,
        models: ["soloist"],
        world: true,
        formations: [],
        shots: ["opening"],
        acceptance: ["opening-beauty", "opening-pose"],
      },
    );

    const mismatched = project.setProductionDesign(
      productionDesign({ id: "other-film" }),
    );
    TestValidator.equals(
      "production address mismatch is rejected without a revision",
      [mismatched.accepted, diagnosticCodes(mismatched), project.revision()],
      [false, ["production-address-mismatch"], summary.revision],
    );
    const invalidModel = project.setModelRecipe({} as IAutoMovieModelRecipe);
    TestValidator.predicate(
      "strict model shape is refused at the setter boundary",
      invalidModel.accepted === false &&
        diagnosticCodes(invalidModel).length > 1 &&
        diagnosticCodes(invalidModel).every(
          (code) => code === "design-schema-invalid",
        ),
    );

    const mutations = [
      project.setProductionDesign(productionDesign()),
      project.setModelRecipe(modelRecipe()),
      project.setWorldDesign(fixtureWorldDesign()),
      project.setFormationDesign(formationDesign()),
      setProductionFixtureShotContract(project, shotContract()),
      project.setAcceptanceScenario(acceptanceScenarios()[0]!),
    ];
    TestValidator.predicate(
      "all six typed design setters persist accepted records",
      mutations.every(
        (result) => result.accepted && result.fingerprint !== null,
      ),
    );
    TestValidator.equals(
      "formation setter materializes its canonical record",
      project.design({ kind: "formation", id: "line" }),
      formationDesign(),
    );

    const landmarkShot = shotContract();
    landmarkShot.opening[0]!.predicates.push({
      kind: "position",
      subject: { kind: "landmark", id: "plaza-center" },
      axis: "x",
      operator: "==",
      value: 0,
      tolerance: 0.001,
    });
    const landmarkMutation = setProductionFixtureShotContract(
      project,
      landmarkShot,
    );
    const worldEraseCodes = diagnosticCodes(
      project.eraseDesignArtifact({ kind: "world" }),
    );
    TestValidator.predicate(
      "landmark-dependent shot is accepted and makes world erasure unsafe",
      landmarkMutation.accepted &&
        worldEraseCodes.length > 0 &&
        worldEraseCodes.every((code) => code === "design-reference-active"),
    );

    const collision = project.setModelRecipe({
      ...modelRecipe(),
      id: "SOLOIST",
    });
    TestValidator.equals(
      "portable case collision is refused",
      [collision.accepted, diagnosticCodes(collision)],
      [false, ["design-id-collision"]],
    );
    const formationCollision = project.setFormationDesign({
      ...formationDesign(),
      id: "LINE",
    });
    const shotCollision = project.setShotContract({
      ...shotContract(),
      id: "OPENING",
    });
    const acceptanceCollision = project.setAcceptanceScenario({
      ...acceptanceScenarios()[0]!,
      id: "OPENING-BEAUTY",
    });
    TestValidator.equals(
      "every keyed design family enforces portable case identity",
      [formationCollision, shotCollision, acceptanceCollision].map((result) => [
        result.accepted,
        diagnosticCodes(result),
      ]),
      [
        [false, ["design-id-collision"]],
        [false, ["design-id-collision"]],
        [false, ["design-id-collision"]],
      ],
    );

    const missingModelFormation = project.setFormationDesign({
      ...formationDesign(),
      id: "unsupported-formation",
      modelRecipe: "missing-model",
    });
    const aggregateFormation = project.setFormationDesign({
      ...formationDesign(),
      id: "oversized-formation",
      count: 100_001,
      heroOverrides: [],
    });
    TestValidator.predicate(
      "formation setters retain aggregate family-budget diagnostics",
      aggregateFormation.accepted === false &&
        aggregateFormation.diagnostics.some(
          (diagnostic) => diagnostic.target === "formations",
        ),
    );
    const missingActorShot = project.setShotContract({
      ...shotContract(),
      id: "unsupported-shot",
      participants: [{ kind: "formation", id: "missing-formation" }],
    });
    const missingShotAcceptance = project.setAcceptanceScenario({
      ...acceptanceScenarios()[0]!,
      id: "unsupported-acceptance",
      target: { kind: "shot", id: "missing-shot" },
    });
    TestValidator.predicate(
      "schema-valid but semantically disconnected designs refuse persistence",
      [missingModelFormation, missingActorShot, missingShotAcceptance].every(
        (result) =>
          result.accepted === false &&
          result.diagnostics.some(
            (diagnostic) => diagnostic.category === "error",
          ),
      ),
    );

    const worldWithoutLandmark = {
      ...fixtureWorldDesign(),
      landmarks: [],
    };
    const downstream = project.setWorldDesign(worldWithoutLandmark);
    TestValidator.predicate(
      "valid upstream edit is accepted while naming newly invalidated shot",
      downstream.accepted &&
        downstream.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "design-downstream-invalidated" &&
            diagnostic.target === "shot:opening",
        ),
    );
    TestValidator.predicate(
      "restoring landmark authority clears the downstream warning",
      project.setWorldDesign(fixtureWorldDesign()).accepted,
    );

    const dependency = {
      ...modelRecipe(),
      id: "dependency",
      lod: [{ tier: "hero" as const, maxDistance: null, recipe: "dependency" }],
    };
    const dependent = {
      ...modelRecipe(),
      id: "dependent",
      lod: [{ tier: "hero" as const, maxDistance: null, recipe: "dependency" }],
    };
    TestValidator.predicate(
      "model dependency chain is accepted in dependency order",
      project.setModelRecipe(dependency).accepted &&
        project.setModelRecipe(dependent).accepted,
    );
    const dependencyMutation = project.setModelRecipe({
      ...dependency,
      palette: { body: "#ffffff" },
    });
    TestValidator.predicate(
      "model mutation consequences traverse dependent recipes",
      dependencyMutation.accepted &&
        dependencyMutation.consequences.staleReviews.some(
          (target) =>
            target.kind === "design" &&
            target.design.kind === "model" &&
            target.design.id === "dependent",
        ),
    );
    const referencedModelCodes = diagnosticCodes(
      project.eraseDesignArtifact({ kind: "model", id: "soloist" }),
    );
    TestValidator.predicate(
      "referenced model cannot be erased",
      referencedModelCodes.length > 0 &&
        referencedModelCodes.every(
          (code) => code === "design-reference-active",
        ),
    );
    TestValidator.equals(
      "missing design erase is a stable nonmutation",
      diagnosticCodes(
        project.eraseDesignArtifact({ kind: "shot", id: "missing" }),
      ),
      ["design-missing"],
    );
    TestValidator.predicate(
      "blank erase reason refuses before mutation",
      throwsError(
        () =>
          project.eraseDesignArtifact({ kind: "formation", id: "line" }, "   "),
        "must not be blank",
      ),
    );
    const erasedFormation = project.eraseDesignArtifact(
      { kind: "formation", id: "line" },
      "remove the isolated lifecycle fixture",
    );
    TestValidator.equals(
      "unreferenced design erase writes an audit and removes the record",
      [
        erasedFormation.accepted,
        project.design({ kind: "formation", id: "line" }),
        fs.existsSync(
          path.join(fixture.root, "automovie/audit/shared-design-mutations"),
        ),
      ],
      [true, null, true],
    );

    const corruptFormation = formationDesign();
    corruptFormation.modelRecipe = "missing-model";
    fs.writeFileSync(
      path.join(
        fixture.root,
        "automovie/design/shared/formations/corrupt.json",
      ),
      `${JSON.stringify({ ...corruptFormation, id: "corrupt" }, null, 2)}\n`,
    );
    const residentCorruption = project.setFormationDesign({
      ...corruptFormation,
      id: "corrupt",
    });
    const unrelatedMutation = project.setProductionDesign(productionDesign());
    TestValidator.predicate(
      "pre-existing semantic diagnostic is identified rather than relabeled downstream",
      residentCorruption.accepted === false &&
        residentCorruption.diagnostics.some(
          (diagnostic) =>
            diagnostic.category === "error" &&
            diagnostic.target === "formation:corrupt",
        ) &&
        unrelatedMutation.accepted &&
        unrelatedMutation.diagnostics.every(
          (diagnostic) =>
            diagnostic.code !== "design-downstream-invalidated" ||
            diagnostic.target !== "formation:corrupt",
        ),
    );
    fs.rmSync(
      path.join(
        fixture.root,
        "automovie/design/shared/formations/corrupt.json",
      ),
    );

    TestValidator.equals(
      "absent repaint selections enumerate once per unique requested shot",
      project.verifiedRepaintRenditions(["missing", "missing"]),
      [],
    );

    const readOnly = AutoMovieProductionProject.openReadOnly(
      fixture.root,
      "fixture-film",
    );
    const readOnlyRevision = readOnly.revision();
    TestValidator.equals(
      "read-only snapshot confirms the exact observed revision",
      readOnly.confirmCurrentSnapshot(() => true, readOnlyRevision),
      readOnlyRevision,
    );
    TestValidator.predicate(
      "read-only snapshot negative twin rejects a changed guard",
      (() => {
        try {
          readOnly.confirmCurrentSnapshot(() => false, readOnlyRevision);
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
    const worldFile = path.join(
      fixture.root,
      "automovie/design/shared/world.json",
    );
    const worldBytesBefore = fs.readFileSync(worldFile);
    TestValidator.predicate(
      "read-only mutation refuses and preserves the design bytes",
      throwsError(
        () => readOnly.setWorldDesign(fixtureWorldDesign()),
        "read-only",
      ) && fs.readFileSync(worldFile).equals(worldBytesBefore),
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    removeFixture(fixtureFailure, fixture.dispose);
  }

  const eraseRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-project-erase-"),
  );
  let eraseFailure: IRuntimeShapeCleanupFailure | undefined;
  try {
    const project = AutoMovieProductionProject.open(eraseRoot, "erase-me");
    AutoMovieProductionProject.open(eraseRoot, "keep-me");
    TestValidator.predicate(
      "blank production erase reason refuses without unregistering",
      throwsError(() => project.eraseProduction("  "), "must not be blank"),
    );
    const erased = project.eraseProduction("lifecycle test completed");
    TestValidator.equals("production erase preserves its sibling", erased, {
      erased: true,
      productionId: "erase-me",
      remaining: ["keep-me"],
    });
    TestValidator.equals(
      "registry contains only the sibling after erasure",
      AutoMovieProductionProject.registeredProductionIds(eraseRoot),
      ["keep-me"],
    );
    TestValidator.predicate(
      "erased handle refuses further reads",
      (() => {
        try {
          project.revision();
          return false;
        } catch (error) {
          return error instanceof AutoMovieProductionInputRaceError;
        }
      })(),
    );
  } catch (error) {
    eraseFailure = { error };
    throw error;
  } finally {
    removeFixture(eraseFailure, () =>
      fs.rmSync(eraseRoot, { force: true, recursive: true }),
    );
  }
};
