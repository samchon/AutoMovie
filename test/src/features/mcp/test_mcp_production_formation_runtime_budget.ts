import type {
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
  IAutoMovieShotContract,
} from "@automovie/interface";
import { validateAutoMovieProductionGraph } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

const formation = (props: {
  id: string;
  count: number;
  heroes?: number;
}): IAutoMovieFormationDesign => ({
  id: props.id,
  modelRecipe: "member",
  count: props.count,
  layout: {
    kind: "line",
    ranks: 1,
    files: props.count,
    spacing: { lateral: 1, depth: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 1,
  capabilities: ["hold"],
  heroOverrides: Array.from({ length: props.heroes ?? 0 }, (_, slot) => ({
    slot,
    actor: `hero-${slot}`,
  })),
});

/**
 * One shot contract, taken from the scaffold's own so the graph walks a real
 * shape, with the two fields this rule reads replaced.
 *
 * The budget rule reads a shot's `participants` and nothing else, but the graph
 * validator walks every shot whole on the way there, and a hand-trimmed
 * contract makes it throw on the first field it did not get rather than report.
 */
const scaffoldShot = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "packages",
      "cli",
      "scaffold",
      ".automovie",
      "design",
      "shots",
      "opening.json",
    ),
    "utf8",
  ),
) as IAutoMovieShotContract;

const staging = (
  id: string,
  formations: readonly string[],
): IAutoMovieShotContract => ({
  ...scaffoldShot,
  id,
  participants: formations.map((formation) => ({
    kind: "formation",
    id: formation,
  })),
});

const budgetRefusal = (
  formations: readonly IAutoMovieFormationDesign[],
  shots: readonly IAutoMovieShotContract[],
): IAutoMovieDiagnostic | undefined =>
  validateAutoMovieProductionGraph({
    production: null,
    models: new Map(),
    world: null,
    formations: new Map(formations.map((item) => [item.id, item])),
    shots: new Map(shots.map((shot) => [shot.id, shot])),
    acceptance: new Map(),
  }).find((diagnostic) =>
    diagnostic.message.includes("Estimated compact formation runtime"),
  );

/** Stage one formation across `count` shots. */
const across = (id: string, count: number): IAutoMovieShotContract[] =>
  Array.from({ length: count }, (_, index) => staging(`shot-${index}`, [id]));

/**
 * The compact-runtime refusal names the term that is actually spending.
 *
 * The budget is charged per **participation**: a unit named by six shots is
 * stored six times, member chunks, heroes and a 4,096-byte floor alike. That is
 * the term a production of many shots runs out on, and the refusal used to say
 * "reduce count or hero overrides" whatever the cause — so an author whose
 * crowds were not the problem went and shrank them. The #1825 campaign
 * integrated none of eight new shots on this rule, six of which added no
 * members at all, and read the refusal as being about its crowds.
 *
 * A diagnostic that names the wrong lever is worse than a terse one, because it
 * is followed. Each of the three terms is therefore asserted where it dominates,
 * and the fixed-floor case is asserted to say plainly that shrinking counts will
 * not help — that sentence is the whole point of the change.
 *
 * Scenarios:
 *
 * 1. One small unit in one shot is inside the budget and refused for nothing,
 *    which is the reading that keeps the rest from being an over-match.
 * 2. The same unit staged in forty shots is refused, although not one member was
 *    added. The refusal names the participation count, names the fixed floor as
 *    dominant, and says that reducing counts will not help.
 * 3. A large crowd in two shots is refused with member chunks named as dominant,
 *    so the advice still points at count when count is what is paying.
 * 4. A heavily promoted unit is refused with hero slots named as dominant.
 * 5. Every refusal states the participation count, because it multiplies all
 *    three terms and is the fact the member ceiling hides.
 */
export const test_mcp_production_formation_runtime_budget = (): void => {
  const small = formation({ id: "company", count: 100 });
  const inside = budgetRefusal([small], across("company", 1));
  const reused = budgetRefusal([small], across("company", 40));
  const crowded = budgetRefusal(
    [formation({ id: "corps", count: 100_000 })],
    across("corps", 2),
  );
  const promoted = budgetRefusal(
    [formation({ id: "staff", count: 256, heroes: 256 })],
    across("staff", 1),
  );

  TestValidator.equals(
    "the runtime refusal names the dominant term rather than always the crowd",
    namedFacts([
      ["oneUnitInOneShotIsInsideTheBudget", () => inside === undefined],
      [
        "fortyReusesAreRefusedThoughNoMemberWasAdded",
        () => reused !== undefined,
      ],
      [
        "andTheRefusalNamesTheParticipations",
        () => reused?.message.includes("40 participation(s)") === true,
      ],
      [
        "andNamesTheFixedFloorAsDominant",
        () => reused?.message.includes("fixed cost alone") === true,
      ],
      [
        "andSaysThatShrinkingCountsWillNotHelp",
        () =>
          reused?.message.includes("Shrinking counts will not help") === true,
      ],
      [
        "aLargeCrowdIsToldItsMembersAreTheCost",
        () =>
          crowded?.message.includes("Member chunks are the dominant") === true,
      ],
      [
        "aPromotedUnitIsToldItsHeroesAre",
        () =>
          promoted?.message.includes("hero slots are the dominant") === true,
      ],
      [
        "andEveryRefusalStatesTheParticipationRule",
        () =>
          [reused, crowded, promoted].every(
            (found) =>
              found?.message.includes("once per shot that names it") === true,
          ),
      ],
    ]),
    {
      oneUnitInOneShotIsInsideTheBudget: true,
      fortyReusesAreRefusedThoughNoMemberWasAdded: true,
      andTheRefusalNamesTheParticipations: true,
      andNamesTheFixedFloorAsDominant: true,
      andSaysThatShrinkingCountsWillNotHelp: true,
      aLargeCrowdIsToldItsMembersAreTheCost: true,
      aPromotedUnitIsToldItsHeroesAre: true,
      andEveryRefusalStatesTheParticipationRule: true,
    },
  );
};
