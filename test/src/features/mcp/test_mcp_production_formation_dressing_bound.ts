import type {
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
} from "@automovie/interface";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionDesign,
  shotContract,
  worldDesign,
} from "./productionFixtures";

/** One tolerance, as a layout states it. */
type IDressing = { lateral: number; depth: number };

/** The starter graph with one formation's layout and count replaced. */
const graph = (
  layout: IAutoMovieFormationDesign["layout"],
  count = 6,
): IAutoMovieProductionDesignGraph => ({
  production: productionDesign(),
  models: new Map([["soloist", modelRecipe()]]),
  world: worldDesign(),
  formations: new Map([["line", { ...formationDesign(layout), count }]]),
  shots: new Map([["opening", shotContract()]]),
  acceptance: new Map(acceptanceScenarios().map((item) => [item.id, item])),
});

/** A rectangular unit whose intervals a tolerance is measured against. */
const lattice = (props: {
  kind: "line" | "column" | "wedge";
  dressing?: IDressing;
}): IAutoMovieFormationDesign["layout"] =>
  props.kind === "wedge"
    ? {
        kind: "wedge",
        depth: 3,
        spacing: { lateral: 0.8, depth: 0.9 },
        ...(props.dressing === undefined ? {} : { dressing: props.dressing }),
      }
    : {
        kind: props.kind,
        ranks: 2,
        files: 3,
        spacing: { lateral: 0.8, depth: 0.9 },
        ...(props.dressing === undefined ? {} : { dressing: props.dressing }),
      };

/** A unit bent along an arc, whose interval is the chord between neighbours. */
const bow = (props: {
  radius: number;
  dressing?: IDressing;
}): IAutoMovieFormationDesign["layout"] => ({
  kind: "arc",
  radius: props.radius,
  arcDegrees: 180,
  ...(props.dressing === undefined ? {} : { dressing: props.dressing }),
});

const diagnostics = (
  layout: IAutoMovieFormationDesign["layout"],
  count?: number,
): IAutoMovieDiagnostic[] =>
  validateAutoMovieProductionGraph(graph(layout, count));

const messages = (
  layout: IAutoMovieFormationDesign["layout"],
  count?: number,
): string[] =>
  diagnostics(layout, count).map(
    (diagnostic: IAutoMovieDiagnostic) => diagnostic.message,
  );

/** The one refusal a case expects, as the record the caller receives. */
const refusal = (
  layout: IAutoMovieFormationDesign["layout"],
  starting: string,
  count?: number,
): IAutoMovieDiagnostic | undefined =>
  diagnostics(layout, count).find((diagnostic) =>
    diagnostic.message.startsWith(starting),
  );

/** Refusals that name a tolerance closing the interval it is drawn across. */
const closings = (
  layout: IAutoMovieFormationDesign["layout"],
  count?: number,
): string[] =>
  messages(layout, count).filter((message) => message.startsWith("Dressing "));

/**
 * A dressing tolerance may not reach the interval it is drawn across.
 *
 * A tolerance says how far a member may stand off its own place, so two
 * neighbours may each come that far toward each other. At half the interval
 * between them they can stand in exactly one place and above it they can change
 * places, which is not a loosely dressed line but a line that has stopped being
 * one. Saying so needs no knowledge of how large a member is: it is a fact
 * about the arrangement, true of dancers, animals, vehicles and machines
 * alike.
 *
 * Which interval depends on the layout, because each states its own. A lattice
 * states two spacings and each tolerance answers to the one it moves along. An
 * arc states none, so the interval is the chord between neighbouring slots that
 * its radius, covered angle and count fix together, and the tolerance measured
 * against it is the smaller of the two, because a chord runs in a direction the
 * layout chose and no tolerance is certain to close it by more than its
 * narrower side.
 *
 * Scenarios:
 *
 * 1. A tolerance below half its interval is accepted on both axes, so the rule
 *    leaves alone the dressed line it exists to keep meaningful.
 * 2. A tolerance at exactly half its lateral interval is refused, because two
 *    neighbours can then stand in one place, and the refusal names the axis,
 *    the tolerance, the interval and what to keep below what.
 * 3. A tolerance above half its depth interval is refused, and the two axes are
 *    independent: each answers to the interval it moves along and to no other.
 * 4. Both axes over at once are refused twice, so one corrected axis does not hide
 *    the other.
 * 5. A tolerance of zero is exact geometry and is accepted, and a layout that
 *    declares no tolerance at all is not measured.
 * 6. A column and a wedge are bound exactly as a line is, because the rule is
 *    about intervals and not about one layout algorithm.
 * 7. An arc whose neighbouring chord is inside twice its narrower tolerance is
 *    refused, and a wider arc holding the same tolerance is accepted: what
 *    fixes an arc's interval is its radius, its angle and its count together.
 * 8. An arc of one member has no neighbour and so no interval, and is accepted
 *    with a tolerance no arc of two could hold.
 * 9. A tolerance that is not a real measurement is refused once, as the range it
 *    is not, and never a second time as an interval nobody can read. Both axes
 *    are ranged, so a depth nobody can read is refused as its own axis rather
 *    than as the one beside it.
 * 10. Each refusal is a complete diagnostic and not only a sentence: it carries the
 *     code a host routes on, the error category, the formation it belongs to
 *     and the tracked record an author has to open. Both the interval refusal
 *     and the arc's own say the same four things.
 * 11. The chord an arc is judged by is fixed by its radius, its covered angle and
 *     the intervals BETWEEN its members, and each of the three is bracketed:
 *     one tolerance accepted at six members over half a circle is refused at
 *     eleven, refused again at six over a quarter circle, and a tolerance a
 *     little wider is refused at the first of those.
 *
 * A scatter is not among them. Its layout carries no `dressing` field at all,
 * so "a scatter is not measured" is a fact about the type rather than about
 * this gate: no scatter a caller can construct could make it answer otherwise,
 * and a case asserting it would read as coverage of a rule it never reaches.
 */
export const test_mcp_production_formation_dressing_bound = (): void => {
  TestValidator.equals(
    "a tolerance below half its interval is accepted",
    closings(
      lattice({ kind: "line", dressing: { lateral: 0.35, depth: 0.4 } }),
    ),
    [],
  );

  const halved = closings(
    lattice({ kind: "line", dressing: { lateral: 0.4, depth: 0.1 } }),
  );
  TestValidator.equals(
    "a tolerance at half its lateral interval is refused, and the refusal says which and against what",
    namedFacts([
      ["one", () => halved.length === 1],
      ["tolerance", () => halved[0]!.includes("0.4 m")],
      ["interval", () => halved[0]!.includes("0.8 m lateral interval")],
      [
        "correction",
        () =>
          halved[0]!.includes(
            "Keep twice layout.dressing.lateral below layout.spacing.lateral",
          ),
      ],
    ]),
    { one: true, tolerance: true, interval: true, correction: true },
  );

  const deepened = closings(
    lattice({ kind: "line", dressing: { lateral: 0.1, depth: 0.5 } }),
  );
  TestValidator.equals(
    "each axis answers to the interval it moves along and to no other",
    namedFacts([
      ["one", () => deepened.length === 1],
      ["interval", () => deepened[0]!.includes("0.9 m depth interval")],
    ]),
    { one: true, interval: true },
  );

  TestValidator.equals(
    "both axes over at once are refused twice",
    closings(lattice({ kind: "line", dressing: { lateral: 0.4, depth: 0.5 } }))
      .length,
    2,
  );

  TestValidator.equals(
    "an exact layout and an undeclared one are both left alone",
    namedFacts([
      [
        "exact",
        () =>
          closings(
            lattice({ kind: "line", dressing: { lateral: 0, depth: 0 } }),
          ).length === 0,
      ],
      ["undeclared", () => closings(lattice({ kind: "line" })).length === 0],
    ]),
    { exact: true, undeclared: true },
  );

  TestValidator.equals(
    "a column and a wedge are bound exactly as a line is",
    namedFacts([
      [
        "column",
        () =>
          closings(
            lattice({ kind: "column", dressing: { lateral: 0.4, depth: 0.1 } }),
          ).length === 1,
      ],
      [
        "wedge",
        () =>
          closings(
            lattice({ kind: "wedge", dressing: { lateral: 0.4, depth: 0.1 } }),
          ).length === 1,
      ],
    ]),
    { column: true, wedge: true },
  );

  // Six members over half a circle stand a fifth of the arc apart, so the chord
  // between neighbours is 2 r sin(18 deg): about 0.618 r. A tolerance of 0.35 m
  // closes 0.7 m, which a radius of 1 cannot hold and a radius of 4 can.
  TestValidator.equals(
    "an arc is bound by the chord its radius, angle and count fix together",
    namedFacts([
      [
        "tightArcRefused",
        () =>
          closings(bow({ radius: 1, dressing: { lateral: 0.35, depth: 0.35 } }))
            .length === 1,
      ],
      [
        "wideArcAccepted",
        () =>
          closings(bow({ radius: 4, dressing: { lateral: 0.35, depth: 0.35 } }))
            .length === 0,
      ],
      [
        "narrowerSideIsWhatCounts",
        () =>
          closings(bow({ radius: 1, dressing: { lateral: 0.35, depth: 0 } }))
            .length === 0,
      ],
    ]),
    {
      tightArcRefused: true,
      wideArcAccepted: true,
      narrowerSideIsWhatCounts: true,
    },
  );

  TestValidator.equals(
    "an arc of one member has no neighbour to stand on",
    closings(bow({ radius: 1, dressing: { lateral: 5, depth: 5 } }), 1),
    [],
  );

  const unreal = messages(
    lattice({ kind: "line", dressing: { lateral: Number.NaN, depth: 0.1 } }),
  );
  TestValidator.equals(
    "a tolerance nobody can read is refused as the range it is not, and not twice",
    namedFacts([
      [
        "range",
        () =>
          unreal.filter((message) =>
            message.startsWith(
              "layout.dressing.lateral must be a finite value",
            ),
          ).length === 1,
      ],
      [
        "notAsAnInterval",
        () =>
          unreal.filter((message) => message.startsWith("Dressing ")).length ===
          0,
      ],
    ]),
    { range: true, notAsAnInterval: true },
  );

  // The two axes are ranged separately, so a depth nobody can read is refused
  // as `depth` and not as the axis beside it.
  const unrealDepth = messages(
    lattice({ kind: "line", dressing: { lateral: 0.1, depth: Number.NaN } }),
  );
  TestValidator.equals(
    "a depth tolerance nobody can read is refused as its own axis",
    namedFacts([
      [
        "depthRanged",
        () =>
          unrealDepth.filter((message) =>
            message.startsWith("layout.dressing.depth must be a finite value"),
          ).length === 1,
      ],
      [
        "notTheOtherAxis",
        () =>
          unrealDepth.some((message) =>
            message.startsWith("layout.dressing.lateral"),
          ) === false,
      ],
      [
        "notAsAnInterval",
        () =>
          unrealDepth.filter((message) => message.startsWith("Dressing "))
            .length === 0,
      ],
    ]),
    { depthRanged: true, notTheOtherAxis: true, notAsAnInterval: true },
  );

  // A refusal is a routed record, not a sentence. Filtering on the sentence is
  // what left every other field of these two unread.
  const interval = refusal(
    lattice({ kind: "line", dressing: { lateral: 0.4, depth: 0.1 } }),
    "Dressing tolerance",
  );
  const chord = refusal(
    bow({ radius: 1, dressing: { lateral: 0.35, depth: 0.35 } }),
    "Dressing can move",
  );
  TestValidator.equals(
    "both refusals carry the code, the category, the unit and the record to open",
    namedFacts([
      ["bothPresent", () => interval !== undefined && chord !== undefined],
      [
        "code",
        () =>
          [interval!, chord!].every(
            (diagnostic) => diagnostic.code === "design-range-invalid",
          ),
      ],
      [
        "category",
        () =>
          [interval!, chord!].every(
            (diagnostic) => diagnostic.category === "error",
          ),
      ],
      [
        "target",
        () =>
          [interval!, chord!].every(
            (diagnostic) => diagnostic.target === "formation:line",
          ),
      ],
      [
        "path",
        () =>
          [interval!, chord!].every(
            (diagnostic) =>
              diagnostic.path?.endsWith("/formations/line.json") === true,
          ),
      ],
    ]),
    {
      bothPresent: true,
      code: true,
      category: true,
      target: true,
      path: true,
    },
  );

  // Six members over half a circle stand a fifth of the arc apart, so the chord
  // between neighbours is `2 sin(18 deg) = 0.618` m. Each of the three things
  // that fix it is bracketed by moving one of them alone: eleven members over
  // the same arc, and six over a quarter of one, both close it to `2 sin(9 deg)
  // = 0.313` m, which the same tolerance then reaches.
  TestValidator.equals(
    "the chord is fixed by the radius, the angle and the intervals between members",
    namedFacts([
      [
        "insideTheChordIsAccepted",
        () =>
          closings(bow({ radius: 1, dressing: { lateral: 0.28, depth: 0.28 } }))
            .length === 0,
      ],
      [
        "pastTheChordIsRefused",
        () =>
          closings(
            bow({ radius: 1, dressing: { lateral: 0.325, depth: 0.325 } }),
          ).length === 1,
      ],
      [
        "moreMembersCloseIt",
        () =>
          closings(
            bow({ radius: 1, dressing: { lateral: 0.28, depth: 0.28 } }),
            11,
          ).length === 1,
      ],
      [
        "aNarrowerArcClosesIt",
        () =>
          closings({
            kind: "arc",
            radius: 1,
            arcDegrees: 90,
            dressing: { lateral: 0.28, depth: 0.28 },
          }).length === 1,
      ],
    ]),
    {
      insideTheChordIsAccepted: true,
      pastTheChordIsRefused: true,
      moreMembersCloseIt: true,
      aNarrowerArcClosesIt: true,
    },
  );
};
