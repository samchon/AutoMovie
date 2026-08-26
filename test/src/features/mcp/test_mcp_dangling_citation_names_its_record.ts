import { openAutoMovieProduction } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

/**
 * A design record that cites a scene nobody declares names its own file.
 *
 * Replacing a completed production is one pass over three layers, and the
 * evidence graph only watches two of them. `docs/**` and `src/**` are cited, so
 * lint catches a break in either; `automovie/design/**` is compiler-owned JSON
 * that carries no citations by design, so nothing catches it. Two measured
 * productions left legacy fixture records in that layer, and their compiles
 * kept reporting ids the author had already deleted everywhere they knew to look.
 *
 * The diagnostic was correct and unhelpful. `Shot contract "opening" cites scene
 * "SCN-001"` sends an author into `src`, because nothing said the citation was
 * written in a file they had never been told was theirs to delete. The id was
 * there; the file was not.
 *
 * `IAutoMovieDiagnostic.path` exists for exactly this, and a design record is a
 * file, so the path is now the record's. Which file a record lives in is the
 * project's decision, so the path comes from the project rather than from a
 * second spelling of the design tree's layout.
 *
 * Scenarios:
 *
 * 1. A production whose screenplay index no longer declares the scene its
 *    fixture shot contract cites is refused with `screenplay-citation-scene-absent`.
 * 2. That refusal's `path` is the design record's own project-relative file, so
 *    an author reading only the diagnostic knows which file to correct or delete.
 */
export const test_mcp_dangling_citation_names_its_record = (): void => {
  const fixture = productionFixture();
  try {
    // The docs layer moved on and the design layer did not, which is the shape
    // both measured productions were left in. Renaming the indexed scene is the
    // smallest way to reproduce it: every fixture record still cites the old id.
    const indexPath = path.join(
      fixture.root,
      "automovie/design/fixture-film/screenplay/index.json",
    );
    const index = fs.readFileSync(indexPath, "utf8");
    TestValidator.equals(
      "the fixture index declares the scene its records cite",
      index.includes('"SCN-001"'),
      true,
    );
    fs.writeFileSync(
      indexPath,
      index.replaceAll('"SCN-001"', '"SCN-900"'),
      "utf8",
    );

    const services = openAutoMovieProduction({ projectRoot: fixture.root });
    const output = services.compiler.lint({ scope: "source" });
    const dangling = output.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "screenplay-citation-scene-absent" &&
        diagnostic.message.includes('"SCN-001"'),
    );

    TestValidator.equals(
      "a dangling citation is reported at the record that wrote it",
      namedFacts([
        ["the citation is refused", () => dangling.length > 0],
        [
          "every refusal names a design record file",
          () =>
            dangling.every(
              (diagnostic) =>
                diagnostic.path !== null &&
                diagnostic.path.startsWith("automovie/design/") &&
                diagnostic.path.endsWith(".json"),
            ),
        ],
        [
          "the shot contract's own record is among them",
          () =>
            dangling.some((diagnostic) =>
              // Matched by tail rather than in full: where inside the design tree
              // a record lives is the project's decision, and restating that
              // layout here is the mistake this change exists to stop making.
              diagnostic.path?.endsWith("/shots/opening.json"),
            ),
        ],
      ]),
      {
        "the citation is refused": true,
        "every refusal names a design record file": true,
        "the shot contract's own record is among them": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
