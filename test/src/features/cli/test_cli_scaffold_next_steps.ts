import { TestValidator } from "@nestia/e2e";
import { renderAutoMovieScaffoldNextSteps } from "automovie";

/** A blank harness explains ownership and ordering without promising a render. */
export const test_cli_scaffold_next_steps = (): void => {
  const guide = renderAutoMovieScaffoldNextSteps("작품 with spaces");
  TestValidator.predicate(
    "selected working directory stays visible",
    guide.includes("from 작품 with spaces"),
  );
  TestValidator.predicate(
    "all production shapes are selectable",
    guide.includes("film, brief, or library"),
  );
  TestValidator.predicate(
    "authorship precedes design and compilation",
    guide.indexOf("Author and review") < guide.indexOf("npm run design"),
  );
  TestValidator.predicate(
    "emitter ownership is explicit",
    guide.includes("scripts/emitDesign.ts"),
  );
  TestValidator.predicate(
    "blank refusal is expected",
    guide.includes("kind:null") && guide.includes("deliberately refuse"),
  );
  TestValidator.predicate(
    "no unconditional render chain",
    !guide.includes("npm run render -- all") &&
      !guide.includes("npm run build"),
  );
  TestValidator.predicate(
    "a library does not owe film source",
    guide.includes("a library does not need a film"),
  );
};
