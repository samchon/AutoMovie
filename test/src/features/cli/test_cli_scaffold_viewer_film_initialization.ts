import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * The scaffold's film page draws its first frame after the module is built.
 *
 * `renderFilm` reaches `sampleFilmFrame`, and `sampleFilmFrame` is a `const`,
 * so it is in its temporal dead zone until its own declaration is evaluated.
 * The initial render used to sit above that declaration, which meant the film
 * page threw `ReferenceError: Cannot access 'sampleFilmFrame' before
 * initialization` on load and rendered nothing at all. Not a degraded frame —
 * no frame.
 *
 * The reach of that is what makes it worth a case of its own. Every project
 * `create-automovie` generates inherits this file verbatim, so a single
 * statement in the wrong place meant **no generated project could play its
 * film**. It survived because nothing automated ever loads this page: the
 * viewer package is tested directly, and the scaffold's own viewer is verified
 * by hand.
 *
 * TypeScript does not catch it. `TS2448` is reported for a direct reference to
 * a later binding, not for one reached through a function call, and the call is
 * one level of indirection away.
 *
 * What is asserted is the placement rather than the spelling, because either
 * repair is legitimate — moving the call below the declarations, or making
 * `sampleFilmFrame` a hoisted function declaration — and both leave the module
 * with no lexical declaration waiting behind its first render.
 *
 * Scenarios:
 *
 * 1. The module still draws a first frame at all. A case that only checks
 *    ordering passes trivially once the render is deleted.
 * 2. That render is the module's last statement, so nothing it reaches can
 *    still be uninitialized when it runs.
 */
export const test_cli_scaffold_viewer_film_initialization = (): void => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../../packages/cli/scaffold/viewer/src/film.ts",
    ),
    "utf8",
  );
  const statements = source
    .split("\n")
    .map((line) => line.trimEnd())
    // Top-level statements only: everything nested is indented, and a comment
    // or a blank line is not a statement at all.
    .filter(
      (line) =>
        line.length > 0 &&
        line.startsWith(" ") === false &&
        line.startsWith("//") === false &&
        line.startsWith("*") === false &&
        line.startsWith("/*") === false,
    );

  TestValidator.equals(
    "the film page draws its first frame only once the module is built",
    namedFacts([
      [
        "it draws a first frame",
        () => source.includes('\nrenderFilm(0, "beauty");') === true,
      ],
      [
        "and that is the last thing the module does",
        () => statements.at(-1) === 'renderFilm(0, "beauty");',
      ],
    ]),
    {
      "it draws a first frame": true,
      "and that is the last thing the module does": true,
    },
  );
};
