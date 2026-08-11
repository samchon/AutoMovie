import type {
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
} from "@automovie/interface";
import { validateAutoMovieProductionGraph } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/** One formation, alone in a design graph, validated on its own terms. */
const diagnose = (
  layout: IAutoMovieFormationDesign["layout"],
  count: number,
): IAutoMovieDiagnostic[] =>
  validateAutoMovieProductionGraph({
    production: null,
    models: new Map(),
    world: null,
    formations: new Map([
      [
        "ring",
        {
          id: "ring",
          modelRecipe: "member",
          count,
          layout,
          anchor: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
          seed: 3,
          capabilities: ["hold"],
          heroOverrides: [],
        } satisfies IAutoMovieFormationDesign,
      ],
    ]),
    shots: new Map(),
    acceptance: new Map(),
    // The graph holds no model recipe, so the formation's reference to one is
    // reported and is not this case's subject. Ranges are.
  }).filter(
    (diagnostic) =>
      diagnostic.target === "formation:ring" &&
      diagnostic.code === "design-range-invalid",
  );

/** The refusals a perimeter owns, told apart by the phrase each one leads on. */
const said = (
  diagnostics: readonly IAutoMovieDiagnostic[],
  phrase: string,
): boolean => diagnostics.some((it) => it.message.includes(phrase));

const perimeter = (props: {
  files: number;
  ranks: number;
  thickness: number;
}): IAutoMovieFormationDesign["layout"] => ({
  kind: "perimeter",
  files: props.files,
  ranks: props.ranks,
  thickness: props.thickness,
  spacing: { lateral: 2, depth: 3 },
});

/**
 * What a closed hollow perimeter is refused for, and what it is not.
 *
 * The layout's two invariants are geometric rather than budgetary. A side of
 * fewer than two members has no inside to stand around, so it is a line that
 * arrived under the wrong name; and a thickness that eats past the middle asks
 * for a ring that does not exist. Both have to be said before capacity is
 * quoted, because a capacity summed over impossible rings is a number no author
 * can act on.
 *
 * Every refusal here has a twin one property away that must stay silent. A
 * capacity rule that fires on an arrangement that does fit, or a side rule that
 * fires at exactly two, would be caught by nothing else: the design would simply
 * be impossible to author and the diagnostic would look reasonable.
 *
 * Scenarios:
 *
 * 1. A five-by-four ring holding fourteen is accepted: `2*5 + 2*4 - 4` is
 *    exactly fourteen, so the boundary between fits and does not fit is read at
 *    the boundary and not near it.
 * 2. Fifteen in that same ring is refused, and the refusal quotes the capacity
 *    it computed rather than only naming the field.
 * 3. A side of one member is refused. Two is accepted, which is what keeps the
 *    rule at "a ring needs an inside" instead of at a taste for larger units.
 * 4. A thickness whose innermost ring falls below two by two is refused and the
 *    refusal names the ring it would have needed.
 * 5. When the thickness is impossible, only that is reported: no capacity is
 *    quoted, because summing rings that cannot exist produces a total that
 *    describes nothing.
 * 6. A thickness that lands exactly on a two-by-two innermost ring is accepted,
 *    the negative twin of scenario 4 at its own boundary.
 */
export const test_mcp_production_formation_perimeter_design = (): void => {
  const RING = "a ring needs at least 2 by 2";
  const CAPACITY = "Perimeter capacity";

  const exact = diagnose(perimeter({ files: 5, ranks: 4, thickness: 1 }), 14);
  const overfull = diagnose(
    perimeter({ files: 5, ranks: 4, thickness: 1 }),
    15,
  );
  const narrow = diagnose(perimeter({ files: 1, ranks: 4, thickness: 1 }), 14);
  const twoWide = diagnose(perimeter({ files: 2, ranks: 4, thickness: 1 }), 8);
  // Six by six can hold three rings at most by two of its sides; four would
  // need an innermost ring of zero by zero.
  const tooThick = diagnose(
    perimeter({ files: 6, ranks: 6, thickness: 4 }),
    40,
  );
  // Three rings of six by six: 20 + 12 + 4 = 36, and the innermost is exactly
  // two by two.
  const exactlyThick = diagnose(
    perimeter({ files: 6, ranks: 6, thickness: 3 }),
    36,
  );

  TestValidator.equals(
    "a perimeter is refused for having no inside and for not seating its count, and for nothing else",
    namedFacts([
      ["anExactlyFullRingIsAccepted", () => exact.length === 0],
      [
        "oneMemberTooManyIsRefused",
        () => said(overfull, CAPACITY) && said(overfull, "14"),
      ],
      ["aSideOfOneIsRefused", () => narrow.length !== 0],
      ["aSideOfTwoIsNot", () => twoWide.length === 0],
      ["aThicknessPastTheMiddleIsRefused", () => said(tooThick, RING)],
      [
        "andItIsNotAlsoToldAboutACapacityOverRingsThatCannotExist",
        () => said(tooThick, CAPACITY) === false,
      ],
      [
        "aThicknessEndingOnATwoByTwoRingIsAccepted",
        () => exactlyThick.length === 0,
      ],
    ]),
    {
      anExactlyFullRingIsAccepted: true,
      oneMemberTooManyIsRefused: true,
      aSideOfOneIsRefused: true,
      aSideOfTwoIsNot: true,
      aThicknessPastTheMiddleIsRefused: true,
      andItIsNotAlsoToldAboutACapacityOverRingsThatCannotExist: true,
      aThicknessEndingOnATwoByTwoRingIsAccepted: true,
    },
  );
};
