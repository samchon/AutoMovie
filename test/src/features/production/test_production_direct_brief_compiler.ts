import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { completedProductionFixture } from "./productionFixtures";

/**
 * The completed fixture's own graph-derived evidence, re-declared as a brief.
 *
 * The compiler dispatches screenplay ownership from the manifest kind alone,
 * and a brief graph cannot be validated over a fixture whose narrative layers
 * hold reviewed hosts, so the kind is overridden on the real evidence object
 * rather than rebuilt from a blank configuration.
 */
const asBrief = (
  evidence: IAutoMovieProductionEvidence,
): IAutoMovieProductionEvidence => ({
  ...evidence,
  configuration: { ...evidence.configuration, kind: "brief" },
  manifest: { ...evidence.manifest, kind: "brief" },
});

const screenplayIndex = (root: string): string =>
  path.join(root, "automovie/design/fixture-film/screenplay/index.json");

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
  const fixture = completedProductionFixture();
  const residue = completedProductionFixture();
  try {
    // Read-only verification joins an incarnated project; opening each root
    // once for writing creates that state exactly as `npm run compile` would.
    AutoMovieProductionProject.open(fixture.root);
    AutoMovieProductionProject.open(residue.root);
    fs.rmSync(screenplayIndex(fixture.root));
    const briefEvidence = asBrief(fixture.evidence);
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
      fixture.evidence,
    ).lint({ scope: "design" });
    const withResidue = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(residue.root),
      asBrief(residue.evidence),
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
