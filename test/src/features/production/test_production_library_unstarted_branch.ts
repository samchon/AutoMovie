import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_SECOND_ANCHOR,
  libraryAuthoring,
  libraryFixture,
} from "./libraryFixtures";

/**
 * A design owner whose source has not been started owes no registration.
 *
 * The compiler walks every design owner outside `design` scope and charges each
 * of its units with `source-export-missing` when nothing registers them. Two
 * owners are skipped before that charge: one whose binding is null, which is a
 * branch nobody has begun writing source for, and one whose binding selects no
 * file. Neither had a fixture, so the skip was written and never taken.
 *
 * The pair is what makes this a reading rather than an assertion. The same
 * owner, with the same unregistered unit, is charged when it carries an
 * ordinary binding and not charged when it does not, so the difference is the
 * binding and nothing else.
 */
export const test_production_library_unstarted_branch = (): void => {
  const fixture = libraryFixture();
  try {
    const compile = (binding?: "empty" | "none"): string[] => {
      const currentAuthoringEvidence = () =>
        libraryAuthoring({
          anchors: [LIBRARY_ANCHOR, LIBRARY_SECOND_ANCHOR],
          binding,
          root: fixture.root,
        });
      return new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
        // Two units, of which the fixture's source registers only the first.
        // The second is what makes the charge appear at all, so the three
        // readings below differ by the binding rather than by having nothing
        // to charge.
        currentAuthoringEvidence(),
        currentAuthoringEvidence,
      )
        .compile({ scope: "source" })
        .diagnostics.filter(
          (diagnostic) => diagnostic.code === "source-export-missing",
        )
        .map((diagnostic) => diagnostic.target);
    };

    TestValidator.equals(
      "an owner is charged for its unregistered unit only once its source begins",
      {
        // The ordinary binding, which charges the unregistered second unit.
        bound: compile(),
        started: compile("none"),
        selecting: compile("empty"),
      },
      {
        bound: [`library:spaces:${LIBRARY_DESIGN}#${LIBRARY_SECOND_ANCHOR}`],
        started: [],
        selecting: [],
      },
    );
  } finally {
    fixture.dispose();
  }
};
