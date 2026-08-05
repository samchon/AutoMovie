import {
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  formationDesign,
  modelRecipe,
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

interface IProductionReviewDesignFixtureFailure {
  error: unknown;
}

class ProductionReviewDesignFixtureCleanupError extends AggregateError {}

export const preserveProductionReviewDesignFixtureCleanup = (
  failure: IProductionReviewDesignFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionReviewDesignFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production review-design fixture teardown failed after the test failed.",
    );
  }
};

/** Design dependencies and quotable selectors stay explicit and bounded. */
export const test_mcp_production_review_design_edges = (): void => {
  let productionReviewDesignFailure:
    | IProductionReviewDesignFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const review = new AutoMovieProductionReviewService(project);
    const denseWorld = {
      ...worldDesign(),
      landmarks: Array.from({ length: 300 }, (_, index) => ({
        id: `landmark-${index}`,
        position: { x: index, y: 0, z: 0 },
        radius: 1,
        meaning: `Bounded review landmark ${index}.`,
      })),
    };
    project.setWorldDesign(denseWorld);
    TestValidator.equals(
      "design pointer inventories are deliberately bounded",
      review.prepare({
        target: { kind: "design", design: { kind: "world" } },
      }).quotable.length,
      256,
    );
    project.setWorldDesign(worldDesign());
    const dependentModel = {
      ...modelRecipe(),
      id: "review-model",
      lod: [
        { tier: "hero" as const, maxDistance: 10, recipe: "sentinel" },
        {
          tier: "far" as const,
          maxDistance: null,
          recipe: "review-model",
        },
      ],
    };
    TestValidator.predicate(
      "model review fingerprints include referenced LOD recipes",
      project.setModelRecipe(dependentModel).accepted &&
        review
          .prepare({
            target: {
              kind: "design",
              design: { kind: "model", id: dependentModel.id },
            },
          })
          .fingerprint.startsWith("sha256:"),
    );
    const cyclicSentinel = {
      ...modelRecipe(),
      lod: [
        {
          tier: "hero" as const,
          maxDistance: null,
          recipe: dependentModel.id,
        },
      ],
    };
    const cyclicDependent = {
      ...dependentModel,
      lod: [
        {
          tier: "hero" as const,
          maxDistance: null,
          recipe: cyclicSentinel.id,
        },
      ],
    };
    TestValidator.predicate(
      "cyclic LOD references have a finite review identity",
      project.setModelRecipe(cyclicDependent).accepted &&
        project.setModelRecipe(cyclicSentinel).accepted &&
        review
          .prepare({
            target: {
              kind: "design",
              design: { kind: "model", id: cyclicSentinel.id },
            },
          })
          .fingerprint.startsWith("sha256:"),
    );
    project.setModelRecipe(modelRecipe());
    project.setModelRecipe(dependentModel);
    const dependentModelFile = path.join(
      fixture.root,
      ".automovie/design/shared/models/review-model.json",
    );
    const dependentModelBytes = fs.readFileSync(dependentModelFile);
    fs.writeFileSync(
      dependentModelFile,
      JSON.stringify({
        ...dependentModel,
        lod: [
          {
            tier: "hero",
            maxDistance: 10,
            recipe: "absent",
          },
          dependentModel.lod[1],
        ],
      }),
    );
    const missingModelDependency = review.prepare({
      target: {
        kind: "design",
        design: { kind: "model", id: dependentModel.id },
      },
    });
    fs.writeFileSync(dependentModelFile, dependentModelBytes);
    TestValidator.predicate(
      "missing model LOD dependencies are fingerprinted as absent",
      missingModelDependency.fingerprint.startsWith("sha256:"),
    );
    project.setFormationDesign(formationDesign());
    project.setShotContract({
      ...shotContract(),
      participants: [{ kind: "formation", id: "line" }],
    });
    TestValidator.predicate(
      "formation and shot fingerprints include design dependencies",
      review
        .prepare({
          target: {
            kind: "design",
            design: { kind: "formation", id: "line" },
          },
        })
        .fingerprint.startsWith("sha256:") &&
        review
          .prepare({
            target: {
              kind: "design",
              design: { kind: "shot", id: "opening" },
            },
          })
          .fingerprint.startsWith("sha256:"),
    );
    const shotDesignTarget = {
      kind: "design" as const,
      design: { kind: "shot" as const, id: "opening" },
    };
    const baselineShotFingerprint = review.prepare({
      target: shotDesignTarget,
    }).fingerprint;
    const changedWorld = worldDesign();
    changedWorld.landmarks[0]!.meaning += " Changed.";
    project.setWorldDesign(changedWorld);
    const worldChangedFingerprint = review.prepare({
      target: shotDesignTarget,
    }).fingerprint;
    project.setWorldDesign(worldDesign());
    const changedFormationModel = modelRecipe();
    changedFormationModel.palette.body = "#123456";
    project.setModelRecipe(changedFormationModel);
    const modelChangedFingerprint = review.prepare({
      target: shotDesignTarget,
    }).fingerprint;
    project.setModelRecipe(modelRecipe());
    TestValidator.predicate(
      "shot-design review identity includes world and transitive formation-model dependencies",
      baselineShotFingerprint !== worldChangedFingerprint &&
        baselineShotFingerprint !== modelChangedFingerprint,
    );
    const filmAcceptance = {
      id: "film-opening-beauty",
      target: { kind: "film" as const, id: "fixture-film" },
      criterion: {
        kind: "frame" as const,
        shot: "opening",
        frame: "signal-apex",
        pass: "beauty" as const,
        expectation: "The film preserves the opening signal frame.",
      },
      required: true,
    };
    const filmEventAcceptance = {
      id: "film-opening-event",
      target: { kind: "film" as const, id: "fixture-film" },
      criterion: {
        kind: "event" as const,
        shot: "opening",
        event: "signal-raised",
        expectation: "The film preserves the opening signal event.",
      },
      required: true,
    };
    TestValidator.predicate(
      "film acceptance fingerprints include production and criterion-shot dependencies",
      project.setAcceptanceScenario(filmAcceptance).accepted &&
        project.setAcceptanceScenario(filmEventAcceptance).accepted &&
        review
          .prepare({
            target: {
              kind: "design",
              design: { kind: "acceptance", id: filmAcceptance.id },
            },
          })
          .fingerprint.startsWith("sha256:") &&
        review
          .prepare({
            target: {
              kind: "design",
              design: { kind: "acceptance", id: filmEventAcceptance.id },
            },
          })
          .fingerprint.startsWith("sha256:") &&
        review
          .prepare({
            target: { kind: "shot", id: "opening" },
          })
          .fingerprint.startsWith("sha256:"),
    );
    TestValidator.predicate(
      "film acceptance erasure uses the same tracked path as its setter",
      project.eraseDesignArtifact({
        kind: "acceptance",
        id: filmAcceptance.id,
      }).accepted &&
        project.eraseDesignArtifact({
          kind: "acceptance",
          id: filmEventAcceptance.id,
        }).accepted,
    );
    project.setShotContract({
      ...shotContract(),
      id: "second",
    });
    TestValidator.equals(
      "shared source modules appear once in the review queue",
      new AutoMovieProductionReviewService(project)
        .queue()
        .entries.filter(
          (entry) =>
            entry.target.kind === "source" &&
            entry.target.path === "src/shots/opening.ts",
        ).length,
      1,
    );

    const formationFile = path.join(
      fixture.root,
      ".automovie/design/shared/formations/line.json",
    );
    const formationBytes = fs.readFileSync(formationFile);
    fs.writeFileSync(
      formationFile,
      JSON.stringify({
        ...formationDesign(),
        modelRecipe: "absent",
      }),
    );
    const missingFormationDependency = review.prepare({
      target: {
        kind: "design",
        design: { kind: "formation", id: "line" },
      },
    });
    fs.writeFileSync(formationFile, formationBytes);
    const shotFile = path.join(
      fixture.root,
      ".automovie/design/fixture-film/shots/opening.json",
    );
    const shotBytes = fs.readFileSync(shotFile);
    fs.writeFileSync(
      shotFile,
      JSON.stringify({
        ...shotContract(),
        participants: [{ kind: "formation", id: "absent" }],
      }),
    );
    const missingShotDependency = review.prepare({
      target: {
        kind: "design",
        design: { kind: "shot", id: "opening" },
      },
    });
    fs.writeFileSync(shotFile, shotBytes);
    const acceptanceFile = path.join(
      fixture.root,
      ".automovie/design/fixture-film/acceptance/opening-beauty.json",
    );
    const acceptanceBytes = fs.readFileSync(acceptanceFile);
    fs.writeFileSync(
      acceptanceFile,
      JSON.stringify({
        id: "opening-beauty",
        target: { kind: "shot", id: "absent-target-shot" },
        criterion: {
          kind: "frame",
          shot: "absent-criterion-shot",
          frame: "signal-apex",
          pass: "beauty",
          expectation: "A deliberately dangling review dependency.",
        },
        required: true,
      }),
    );
    const missingAcceptanceDependencies = review.prepare({
      target: {
        kind: "design",
        design: { kind: "acceptance", id: "opening-beauty" },
      },
    });
    fs.writeFileSync(acceptanceFile, acceptanceBytes);
    TestValidator.equals(
      "missing design dependencies are fingerprinted as absent",
      namedFacts([
        [
          "missingFormationDependencyFingerprintStartsWith",
          () => missingFormationDependency.fingerprint.startsWith("sha256:"),
        ],
        [
          "missingShotDependencyFingerprintStartsWith",
          () => missingShotDependency.fingerprint.startsWith("sha256:"),
        ],
        [
          "missingAcceptanceDependenciesFingerprintStartsWith",
          () => missingAcceptanceDependencies.fingerprint.startsWith("sha256:"),
        ],
      ]),
      {
        missingFormationDependencyFingerprintStartsWith: true,
        missingShotDependencyFingerprintStartsWith: true,
        missingAcceptanceDependenciesFingerprintStartsWith: true,
      },
    );
    TestValidator.predicate(
      "absent formation and shot design targets remain fingerprintable",
      review
        .prepare({
          target: {
            kind: "design",
            design: { kind: "formation", id: "absent" },
          },
        })
        .diagnostics.some((item) => item.code === "review-target-missing") &&
        review
          .prepare({
            target: {
              kind: "design",
              design: { kind: "shot", id: "absent" },
            },
          })
          .diagnostics.some((item) => item.code === "review-target-missing"),
    );

    const sourceFile = path.join(fixture.root, "src/shots/opening.ts");
    const sourceBytes = fs.readFileSync(sourceFile, "utf8");
    fs.writeFileSync(
      sourceFile,
      `${sourceBytes}\n${Array.from(
        { length: 520 },
        (_, index) => `// review selector ${index}`,
      ).join("\n")}\n`,
    );
    TestValidator.predicate(
      "source selector inventories are deliberately bounded",
      review
        .prepare({
          target: { kind: "source", path: "src/shots/opening.ts" },
        })
        .diagnostics.some((item) => item.code === "review-selector-truncated"),
    );
    fs.writeFileSync(sourceFile, sourceBytes);

    const residentReadSource = project.readSource;
    project.readSource = (() => {
      const iterator = (function* (): Generator<void> {
        yield;
      })();
      iterator.next();
      return iterator.throw("non-error source read") as never;
    }) as typeof project.readSource;
    const unreadable = review.prepare({
      target: { kind: "source", path: "src/shots/opening.ts" },
    });
    project.readSource = residentReadSource;
    TestValidator.predicate(
      "non-Error source failures remain review diagnostics",
      unreadable.diagnostics.some(
        (item) =>
          item.code === "review-source-missing" &&
          item.message.includes("cannot be read"),
      ),
    );
    project.eraseDesignArtifact({ kind: "world" });
    const missingWorld = review.prepare({
      target: { kind: "design", design: { kind: "world" } },
    });
    project.setWorldDesign(worldDesign());
    fs.rmSync(
      path.join(fixture.root, ".automovie/design/fixture-film/production.json"),
    );
    const missingProduction = review.prepare({
      target: { kind: "design", design: { kind: "production" } },
    });
    TestValidator.predicate(
      "singleton design targets have explicit missing paths",
      missingWorld.diagnostics.some(
        (item) =>
          item.code === "review-target-missing" &&
          item.path?.endsWith("world.json"),
      ) &&
        missingProduction.diagnostics.some(
          (item) =>
            item.code === "review-target-missing" &&
            item.path?.endsWith("production.json"),
        ),
    );
  } catch (error) {
    productionReviewDesignFailure = { error };
    throw error;
  } finally {
    preserveProductionReviewDesignFixtureCleanup(
      productionReviewDesignFailure,
      () => fixture.dispose(),
    );
  }
};
