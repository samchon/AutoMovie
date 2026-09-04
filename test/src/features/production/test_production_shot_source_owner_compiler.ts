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
    const targetPath = "docs/screenplays/opening.md";
    const targetAnchor = "opening";
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
    const filmPath = "src/film.ts";
    const filmTargetPath = "docs/screenplays/film.md";
    const filmTargetAnchor = "film";
    const filmFile = path.join(fixture.root, filmPath);
    const authoredFilm = fs.readFileSync(filmFile, "utf8");
    const filmBinding = {
      ...runtimeBinding,
      branch: "filmSources",
      sourcePath: filmPath,
      exportName: "film",
      sourceDigest: digestAutoMovieBytes(
        normalizeAutoMovieSource(Buffer.from(authoredFilm)),
      ),
      targetPath: filmTargetPath,
      targetAnchor: filmTargetAnchor,
    };
    const authoring = {
      root: fixture.root,
      packageName: "shot-owner-fixture",
      description: "shot owner fixture",
      configuration: {},
      manifest: { kind: "film" },
      designBranches: [],
      designOwners: [],
      sourceOwners: [runtimeBinding, acceptanceBinding, filmBinding],
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
    const film = compiled.success
      ? (JSON.parse(
          Buffer.from(
            project.readGeneratedFile("contracts/film-edit.json"),
          ).toString("utf8"),
        ) as { source: { target?: string } })
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
      sourceOwners: [acceptanceBinding, filmBinding],
    }).compile({ scope: "source" });
    fs.writeFileSync(shotFile, authoredShot);
    fs.writeFileSync(
      filmFile,
      rewriteSource(
        authoredFilm,
        "  build(context) {",
        '  build(context) {\n    throw new Error("film owner gate executed the builder");',
      ),
    );
    const refusedFilm = new AutoMovieProductionCompiler(project, {
      ...authoring,
      sourceOwners: [runtimeBinding, acceptanceBinding],
    }).compile({ scope: "source" });

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
          "theFilmBuildAlsoCarriesItsSelectedTarget",
          () => film?.source.target === `${filmTargetPath}#${filmTargetAnchor}`,
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
          "aFilmOutsideItsSelectedExportPopulationIsRefused",
          () =>
            refusedFilm.success === false &&
            refusedFilm.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-owner-mismatch" &&
                diagnostic.target === "film" &&
                diagnostic.path === filmPath,
            ) &&
            refusedFilm.diagnostics.every(
              (diagnostic) =>
                diagnostic.message.includes("film owner gate executed") ===
                false,
            ),
        ],
      ]),
      {
        theExactRuntimeBindingCompiles: true,
        theGeneratedShotCarriesPathExportDigestAndTarget: true,
        aReviewedSiblingIsAttributionRatherThanTheRuntimeEntry: true,
        theFilmBuildAlsoCarriesItsSelectedTarget: true,
        aStoredPointerOutsideTheSelectedExportPopulationIsRefused: true,
        aFilmOutsideItsSelectedExportPopulationIsRefused: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
