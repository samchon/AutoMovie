import { deriveAutoMovieDrawingSchedule } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { drawingEnvironment } from "../internal/drawingFixtures";
import { namedFacts } from "../internal/predicates";

/**
 * A gap nobody can close is filed as unsupported, and asks the product.
 *
 * `IAutoMovieDrawingGap` defines `status` as whether the derivation **does not
 * exist** or merely **had no input**, and `remedy` as exactly what would make
 * the derivation produce a result. The absent place on an opening or connector
 * row is the first of those: the row builders write `place: null` on every path
 * that reaches them, while a space row fills it. No author supplies it, because
 * nothing reads what an author would supply.
 *
 * It was filed as `not-run` with a remedy telling the author to resolve the
 * host boundary and **fill the row's place**. A `#1954` benchmark's authoring
 * agent met that while closing a stage, refused the remedy, and filed the gap
 * unmet — a careful author resisting an instruction it could not carry out. The
 * brief tells an author to close its stage's gaps, so a less careful one spends
 * the round on it, and the more it trusts the product's own words the longer it
 * spends.
 *
 * The same function already uses the vocabulary correctly twice, twenty lines
 * away: `opening-performance` and `traversal-performance` are both
 * `unsupported`, and the second's remedy is aimed squarely at this product —
 * *"run a traversal analysis once one exists"*. One entry of three was misfiled,
 * in a file that demonstrably knows the difference.
 *
 * What this does **not** decide is whether the derivation should be written.
 * The requirement behind it says every subject answers with a location, so
 * writing it may be the real answer; relabelling makes the product honest
 * without making it answer, and that is the smaller of the two claims.
 *
 * Scenarios:
 *
 * 1. Both subjects that owe a location file it as `unsupported`, so a reader
 *    holding the type's own definitions is told the derivation is missing
 *    rather than the input.
 * 2. Neither remedy instructs the author to fill the place, and both name the
 *    derivation that would produce it. The absence is asserted as well as the
 *    presence, because a remedy can name the derivation and still end by
 *    telling the author to fill the field.
 * 3. A space owes no location gap at all, so the change did not widen the set
 *    it applies to.
 */
export const test_drawing_location_gap = (): void => {
  const gapOf = (subject: "space" | "opening" | "connector") =>
    deriveAutoMovieDrawingSchedule({
      environment: drawingEnvironment(),
      subject,
    }).gaps.find((gap) => gap.subject === `${subject}-location`) ?? null;

  const opening = gapOf("opening");
  const connector = gapOf("connector");

  TestValidator.equals(
    "a place no input reaches is unsupported rather than not-run",
    namedFacts([
      ["an opening owes the gap", () => opening !== null],
      ["a connector owes it too", () => connector !== null],
      [
        "both are unsupported",
        () =>
          opening?.status === "unsupported" &&
          connector?.status === "unsupported",
      ],
      // The old remedy's exact instruction. A reader given the type's meaning
      // of `not-run` would go looking for the input that fills this.
      [
        "neither tells the author to fill the place",
        () =>
          opening?.remedy.includes("fill the row's place") === false &&
          connector?.remedy.includes("fill the row's place") === false,
      ],
      [
        "both name the derivation that would produce it",
        () =>
          opening?.remedy.includes("once that derivation exists") === true &&
          connector?.remedy.includes("once that derivation exists") === true,
      ],
      // A space answers with the space it is, so it is owed nothing here. The
      // guard and the status sit on one statement and a rewrite could take both.
      ["a space owes no location gap", () => gapOf("space") === null],
    ]),
    {
      "an opening owes the gap": true,
      "a connector owes it too": true,
      "both are unsupported": true,
      "neither tells the author to fill the place": true,
      "both name the derivation that would produce it": true,
      "a space owes no location gap": true,
    },
  );
};
