import { parseAutoMovieProductionBookCommand as parseBookCommand } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Book options select the final screenplay without changing non-film defaults.
 *
 * Scenarios:
 *
 * 1. A title alone selects final screenplays; another layer selects construction.
 * 2. Explicit construction and final passes preserve the output and title.
 * 3. Invalid passes, absent titles, and malformed options fail before binding.
 */
export const test_production_book_command = (): void => {
  TestValidator.equals(
    "final screenplay default",
    parseBookCommand(["--title", "Film"]),
    {
      layer: "screenplays",
      pass: "final",
      title: "Film",
      output: undefined,
    },
  );
  TestValidator.equals(
    "non-film default",
    parseBookCommand(["--title", "Room", "--layer", "spaces"]),
    {
      layer: "spaces",
      pass: "construction",
      title: "Room",
      output: undefined,
    },
  );
  for (const pass of ["construction", "final"] as const) {
    TestValidator.equals(
      "explicit pass " + pass,
      parseBookCommand([
        "--pass",
        pass,
        "--layer",
        "screenplays",
        "--output",
        "artifacts/book.md",
        "--title",
        "Edition",
      ]),
      {
        layer: "screenplays",
        pass,
        output: "artifacts/book.md",
        title: "Edition",
      },
    );
  }
  for (const args of [
    [],
    ["--title", "Film", "--pass", "draft"],
    ["--title"],
    ["--title", "--pass", "final"],
    ["--title", "Film", "--unknown", "value"],
    ["--title", "Film", "--pass", "final", "--pass", "construction"],
  ])
    TestValidator.predicate(
      "malformed options " + args.join(" "),
      throwsError(() => parseBookCommand(args)),
    );
};
