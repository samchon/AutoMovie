import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  normalizeAutoMovieSource,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

/**
 * Compilation admits the exact graph-selected shot export and persists it.
 *
 * The binding resolver is independently exhaustive, but only this boundary
 * proves the compiler asks it before executing a shot and carries the answer
 * into the generated artifact. A second reviewed export on the same authored
 * target is acceptance attribution, not another runtime entry.
 */
export const test_production_shot_source_owner_compiler = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const contract = project.graph().shots.get("opening")!;
    const shotFile = path.join(
      fixture.root,
      ...contract.source.module.split("/"),
    );
    const authoredShot = fs.readFileSync(shotFile, "utf8");
    const sourceDigest = digestAutoMovieBytes(
      normalizeAutoMovieSource(Buffer.from(authoredShot)),
    );
    const screenplay = project.screenplayIndex()!;
    const scene = screenplay.screenplay.scenes.find(
      (candidate) => candidate.id === contract.evidence?.[0]?.scene,
    )!;
    const targetPath = scene.path ?? screenplay.screenplay.path;
    const targetAnchor = scene.id.toLowerCase();
    const runtimeBinding = {
      branch: "shots",
      stage: "review",
      enforced: true,
      relationship: "lineage" as const,
      sourcePath: contract.source.module,
      exportName: contract.source.export,
      symbolKind: "property" as const,
      sourceDigest,
      targetPath,
      targetAnchor,
      reviewed: true,
    };
    const acceptanceBinding = {
      ...runtimeBinding,
      exportName: "answer",
    };
    const authoring = {
      root: fixture.root,
      packageName: "shot-owner-fixture",
      description: "shot owner fixture",
      configuration: {},
      manifest: { kind: "film" },
      designBranches: [],
      designOwners: [],
      sourceOwners: [runtimeBinding, acceptanceBinding],
      contracts: [],
    } as unknown as IAutoMovieProductionEvidence;
    const compiled = new AutoMovieProductionCompiler(
      project,
      authoring,
    ).compile({ scope: "source" });
    const output = compiled.success
      ? (JSON.parse(
          Buffer.from(project.readGeneratedFile("shots/opening.json")).toString(
            "utf8",
          ),
        ) as IAutoMovieCompiledShotSource)
      : null;
    fs.writeFileSync(
      shotFile,
      rewriteSource(
        authoredShot,
        "): IAutoMovieProductionShotProgram => {",
        '): IAutoMovieProductionShotProgram => {\n  throw new Error("shot owner gate executed the builder");',
      ),
    );
    const refused = new AutoMovieProductionCompiler(project, {
      ...authoring,
      sourceOwners: [acceptanceBinding],
    }).compile({ scope: "source" });
    const wrongTarget = new AutoMovieProductionCompiler(project, {
      ...authoring,
      sourceOwners: [
        { ...runtimeBinding, targetAnchor: `${targetAnchor}-other` },
        acceptanceBinding,
      ],
    }).compile({ scope: "source" });
    fs.writeFileSync(shotFile, authoredShot);

    TestValidator.equals(
      "the graph-selected runtime export is admitted and carried separately from acceptance attribution",
      namedFacts([
        [
          "theExactRuntimeBindingCompiles",
          () => productionCompileSucceeded("exact shot source owner", compiled),
        ],
        [
          "theGeneratedShotCarriesPathExportDigestAndTarget",
          () =>
            output?.sourceOwner?.path === contract.source.module &&
            output.sourceOwner.export === contract.source.export &&
            output.sourceOwner.digest === sourceDigest &&
            output.sourceOwner.target === `${targetPath}#${targetAnchor}`,
        ],
        [
          "aReviewedSiblingIsAttributionRatherThanTheRuntimeEntry",
          () =>
            output?.acceptanceSources?.length === 1 &&
            output.acceptanceSources[0]?.export === "answer" &&
            output.acceptanceSources[0]?.target ===
              `${targetPath}#${targetAnchor}`,
        ],
        [
          "aStoredPointerOutsideTheSelectedExportPopulationIsRefused",
          () =>
            refused.success === false &&
            refused.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-owner-mismatch" &&
                diagnostic.path === contract.source.module &&
                diagnostic.message.includes("has no graph-selected owner edge"),
            ) &&
            refused.diagnostics.every(
              (diagnostic) =>
                diagnostic.message.includes("shot owner gate executed") ===
                false,
            ),
        ],
        [
          "aReviewedExportForAnotherSceneCannotBorrowTheStoredPointer",
          () =>
            wrongTarget.success === false &&
            wrongTarget.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-owner-mismatch" &&
                diagnostic.message.includes("not runtime owner"),
            ) &&
            wrongTarget.diagnostics.every(
              (diagnostic) =>
                diagnostic.message.includes("shot owner gate executed") ===
                false,
            ),
        ],
      ]),
      {
        theExactRuntimeBindingCompiles: true,
        theGeneratedShotCarriesPathExportDigestAndTarget: true,
        aReviewedSiblingIsAttributionRatherThanTheRuntimeEntry: true,
        aStoredPointerOutsideTheSelectedExportPopulationIsRefused: true,
        aReviewedExportForAnotherSceneCannotBorrowTheStoredPointer: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
