import {
  type IAutoMovieProductionEvidence,
  createAutoMovieContractBindingManifest,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
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
import { productionFixture } from "./productionFixtures";

const evidence = (
  root: string,
  kind: "brief" | "film",
): IAutoMovieProductionEvidence => {
  const configuration = {
    ...createBlankAutoMovieProductionEvidence(root, "english"),
    kind,
  };
  const owner = (props: {
    branch: "filmSources" | "shots";
    sourcePath: string;
    exportName: string;
    targetAnchor: string;
  }): IAutoMovieProductionEvidence["sourceOwners"][number] => ({
    branch: props.branch,
    stage: "review",
    enforced: true,
    relationship: "lineage",
    sourcePath: props.sourcePath,
    exportName: props.exportName,
    symbolKind: "property",
    sourceDigest: digestAutoMovieBytes(
      normalizeAutoMovieSource(
        fs.readFileSync(path.join(root, ...props.sourcePath.split("/"))),
      ),
    ),
    targetPath:
      kind === "brief"
        ? "docs/briefs/direct.md"
        : "docs/screenplays/completed-film.md",
    targetAnchor: props.targetAnchor,
    reviewed: true,
  });
  return {
    root,
    packageName: "fixture-film",
    description: "timed compiler fixture",
    configuration,
    manifest: createAutoMovieContractBindingManifest(configuration),
    designBranches: [],
    designOwners: [],
    sourceOwners: [
      owner({
        branch: "shots",
        sourcePath: "src/shots/opening.ts",
        exportName: "opening",
        targetAnchor: "opening-shot",
      }),
      owner({
        branch: "filmSources",
        sourcePath: "src/film.ts",
        exportName: "film",
        targetAnchor: "delivery",
      }),
    ],
    contracts: [],
    contractRules: [],
    reviewAlarms: { alarms: [], questionPasteChecked: false },
  };
};

/**
 * A direct brief reaches the timed compiler without acquiring film narrative.
 *
 * Scenarios:
 *
 * 1. With the same valid runtime graph and source, a brief has no screenplay
 *    diagnostic in design or source scope when the prohibited index is absent.
 * 2. A film with the same resident shot retains the missing-screenplay refusal.
 * 3. A brief carrying screenplay residue is refused rather than treating that
 *    forbidden file as the workaround for a film-only prerequisite.
 */
export const test_production_direct_brief_compiler = (): void => {
  const fixture = productionFixture();
  const residue = productionFixture();
  try {
    fs.rmSync(
      path.join(
        fixture.root,
        "automovie/design/fixture-film/screenplay/index.json",
      ),
    );
    const briefEvidence = evidence(fixture.root, "brief");
    const design = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      briefEvidence,
    ).lint({ scope: "design" });
    const source = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      briefEvidence,
    ).lint({ scope: "source" });
    const film = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      evidence(fixture.root, "film"),
    ).lint({ scope: "design" });
    const withResidue = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(residue.root),
      evidence(residue.root, "brief"),
    ).lint({ scope: "design" });
    const screenplayDiagnostics = (
      diagnostics: readonly { code: string }[],
    ): string[] =>
      diagnostics
        .map((diagnostic) => diagnostic.code)
        .filter((code) => code.startsWith("screenplay-"));

    TestValidator.equals(
      "direct brief and film keep separate authoring prerequisites",
      namedFacts([
        [
          "briefDesignPassesWithoutScreenplay",
          () =>
            design.success &&
            screenplayDiagnostics(design.diagnostics).length === 0,
        ],
        [
          "briefSourceHasNoScreenplayDiagnostic",
          () => screenplayDiagnostics(source.diagnostics).length === 0,
        ],
        [
          "filmStillRequiresScreenplay",
          () =>
            film.success === false &&
            screenplayDiagnostics(film.diagnostics).includes(
              "screenplay-index-missing",
            ),
        ],
        [
          "briefRejectsNarrativeResidue",
          () =>
            withResidue.success === false &&
            screenplayDiagnostics(withResidue.diagnostics).includes(
              "screenplay-index-forbidden",
            ),
        ],
      ]),
      {
        briefDesignPassesWithoutScreenplay: true,
        briefSourceHasNoScreenplayDiagnostic: true,
        filmStillRequiresScreenplay: true,
        briefRejectsNarrativeResidue: true,
      },
    );
  } finally {
    fixture.dispose();
    residue.dispose();
  }
};
