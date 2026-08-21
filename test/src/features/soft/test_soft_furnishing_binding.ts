import {
  lowerSoftFurnishing,
  validateAutoMovieSoftFurnishingDomainOwnership,
  validateSoftFurnishings,
} from "@automovie/engine";
import {
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftFurnishing,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts } from "../internal/predicates";
import {
  roomEnvironment,
  softFurnishing,
  softPanel,
} from "../internal/softFixtures";

/** A curtain small enough to hang well inside the room's convex cell. */
const panel = (
  overrides: Partial<IAutoMovieSoftBodyDomain> = {},
): IAutoMovieSoftBodyDomain =>
  softPanel({
    columns: 3,
    rows: 3,
    overrides: {
      anchors: [{ id: "hook", particle: 0, position: null }],
      states: [
        {
          id: "open",
          anchors: [{ anchor: "hook", position: { x: 0.5, y: 0, z: 0 } }],
        },
      ],
      ...overrides,
    },
  });

const check = (props: {
  furnishings?: IAutoMovieSoftFurnishing[];
  domains?: IAutoMovieSoftBodyDomain[];
  semantic?: boolean;
}) =>
  validateSoftFurnishings({
    environment: roomEnvironment({ semantic: props.semantic }),
    furnishings: props.furnishings ?? [softFurnishing()],
    domains: props.domains ?? [panel()],
  });

/**
 * The binding between a building and a soft-body domain resolves, and what the
 * lowering could not compute is reported as a capability status rather than
 * drawn as though it had been.
 *
 * This is the seam where the two independent records meet, so it is the only
 * place their agreement can be checked. It is also where the honesty contract
 * lives: a panel that could not be solved must arrive labelled, because a still
 * curtain nobody can distinguish from a solved one is exactly the silent pass
 * this domain exists to refuse.
 *
 * Scenarios:
 *
 * 1. A complete binding validates clean, and the panel's rest mesh really is
 *    inside the room's convex cell.
 * 2. Every reference is checked: a wrong environment, an unknown space, an unknown
 *    or duplicated support element, an unsupplied domain, a duplicated domain
 *    id, a duplicated furnishing id, a blank furnishing id, an unknown kind, an
 *    unknown mode and an undeclared named state are each named.
 * 3. A domain that fails its own validation is reported at the address the binding
 *    knows it by, keeping its original kind and severity.
 * 4. A panel hanging outside the room is refused, while a purely semantic space
 *    with no convex cells is not geometrically checked at all — inventing a
 *    volume would be the design deciding a fact nobody stated. A panel whose
 *    rest array is the wrong length is refused for that and **not**
 *    additionally accused of hanging outside the room: an unmeasurable panel is
 *    reported once, at the field that made it unmeasurable.
 * 5. Containment reads the configuration the panel is actually **held** in, not
 *    the authored rest mesh: an anchor holding its ring beyond the wall is
 *    refused even though every rest particle is inside, the named state the
 *    furnishing holds is refused for the same reason, and the identical state
 *    left unheld is not — a boundary condition nobody applied is not a panel
 *    hanging anywhere.
 * 6. Two furnishings cannot draw one panel, whether their bindings cite the
 *    same or different environments. The production-wide findings are ordered
 *    by domain and furnishing id rather than authoring order; a caller that
 *    performs that join once can skip repeating it in each environment-local
 *    validation pass.
 * 7. The lowering's capability matrix: a furnishing paired with a domain it does
 *    not draw is `not-run`, an invalid domain is `not-run` with no geometry, an
 *    undeclared named state is `not-run`, a request for cloth-on-cloth contact
 *    is `unsupported` and returns the rest configuration rather than a solve,
 *    `mode: "rest"` is reported as `rest`, only an ordinary `simulated`
 *    furnishing is reported as `solved`, and a mode this tier does not evaluate
 *    is `not-run` rather than falling through to a solve it never performed.
 * 8. The lowering never throws. A shot second that is not a real number, and one
 *    landing past the step budget the domain declared for itself, are each
 *    reported as `not-run` with no geometry — this is the call a compiler makes
 *    once per furnishing per second, and a curtain whose budget stops inside
 *    the cut must not take the render down with it.
 */
export const test_soft_furnishing_binding = (): void => {
  TestValidator.equals(
    "a complete binding validates clean",
    check({}).success,
    true,
  );

  TestValidator.equals(
    "every reference is checked",
    namedFacts([
      [
        "environment",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing({ environment: "other" })] }),
            "type",
            "furnishings[0].environment",
          ),
      ],
      [
        "space",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing({ space: "attic" })] }),
            "type",
            "furnishings[0].space",
          ),
      ],
      [
        "support",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing({ supports: ["rail"] })] }),
            "type",
            "furnishings[0].supports[0]",
          ),
      ],
      [
        "duplicateSupport",
        () =>
          hasViolation(
            check({
              furnishings: [softFurnishing({ supports: ["track", "track"] })],
            }),
            "type",
            "furnishings[0].supports[1]",
          ),
      ],
      [
        "domain",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing({ domain: "absent" })] }),
            "type",
            "furnishings[0].domain",
          ),
      ],
      [
        "duplicateDomain",
        () =>
          hasViolation(
            check({ domains: [panel(), panel()] }),
            "type",
            "domains[1].id",
          ),
      ],
      [
        "duplicateFurnishing",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing(), softFurnishing()] }),
            "type",
            "furnishings[1].id",
          ),
      ],
      [
        "blankFurnishing",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing({ id: " " })] }),
            "type",
            "furnishings[0].id",
          ),
      ],
      [
        "kind",
        () =>
          hasViolation(
            check({
              furnishings: [
                softFurnishing({
                  kind: "tapestry" as unknown as "curtain",
                }),
              ],
            }),
            "type",
            "furnishings[0].kind",
          ),
      ],
      [
        "mode",
        () =>
          hasViolation(
            check({
              furnishings: [
                softFurnishing({ mode: "baked" as unknown as "rest" }),
              ],
            }),
            "type",
            "furnishings[0].mode",
          ),
      ],
      [
        "state",
        () =>
          hasViolation(
            check({ furnishings: [softFurnishing({ state: "shut" })] }),
            "type",
            "furnishings[0].state",
          ),
      ],
      [
        "declaredState",
        () =>
          check({ furnishings: [softFurnishing({ state: "open" })] })
            .success === true,
      ],
    ]),
    {
      environment: true,
      space: true,
      support: true,
      duplicateSupport: true,
      domain: true,
      duplicateDomain: true,
      duplicateFurnishing: true,
      blankFurnishing: true,
      kind: true,
      mode: true,
      state: true,
      declaredState: true,
    },
  );

  TestValidator.equals(
    "a domain's own refusal is re-pathed onto the binding",
    hasViolation(
      check({ domains: [panel({ mass: [1] })] }),
      "type",
      "domains[0].mass",
    ),
    true,
  );

  const outside = panel({
    rest: softPanel({
      columns: 3,
      rows: 3,
      origin: { x: 40, y: 0, z: 0 },
    }).rest,
  });
  TestValidator.equals(
    "geometry is checked only where the space has a volume",
    namedFacts([
      [
        "refused",
        () =>
          hasViolation(
            check({ domains: [outside] }),
            "type",
            "furnishings[0].domain",
          ),
      ],
      [
        "semantic",
        () => check({ domains: [outside], semantic: true }).success === true,
      ],
      [
        "unmeasurable",
        () =>
          hasViolation(
            check({ domains: [panel({ rest: [0, 0, 0] })] }),
            "type",
            "domains[0].rest",
          ),
      ],
      [
        "notAlsoGuessed",
        () => {
          const validation = check({ domains: [panel({ rest: [0, 0, 0] })] });
          return (
            validation.success === false &&
            validation.violations.every(
              (item) => item.path.includes("furnishings[0].domain") === false,
            )
          );
        },
      ],
    ]),
    { refused: true, semantic: true, unmeasurable: true, notAlsoGuessed: true },
  );

  const beyond = { x: 40, y: 0, z: 0 };
  const swung = panel({
    states: [{ id: "swung", anchors: [{ anchor: "hook", position: beyond }] }],
  });
  TestValidator.equals(
    "the panel is checked where it is held, not where it was drawn",
    namedFacts([
      [
        "anchorBeyondTheWall",
        () =>
          hasViolation(
            check({
              domains: [
                panel({
                  anchors: [{ id: "hook", particle: 0, position: beyond }],
                  states: [],
                }),
              ],
            }),
            "type",
            "furnishings[0].domain",
          ),
      ],
      [
        "heldStateBeyondTheWall",
        () =>
          hasViolation(
            check({
              furnishings: [softFurnishing({ state: "swung" })],
              domains: [swung],
            }),
            "type",
            "furnishings[0].domain",
          ),
      ],
      [
        "unheldStateIsNotApplied",
        () => check({ domains: [swung] }).success === true,
      ],
      [
        "undeclaredStateIsNotApplied",
        () => {
          const validation = check({
            furnishings: [softFurnishing({ state: "shut" })],
            domains: [swung],
          });
          return (
            validation.success === false &&
            validation.violations.every(
              (item) => item.path.includes("furnishings[0].domain") === false,
            )
          );
        },
      ],
    ]),
    {
      anchorBeyondTheWall: true,
      heldStateBeyondTheWall: true,
      unheldStateIsNotApplied: true,
      undeclaredStateIsNotApplied: true,
    },
  );

  TestValidator.equals(
    "one panel is drawn by one furnishing",
    namedFacts([
      [
        "second",
        () =>
          hasViolation(
            check({
              furnishings: [
                softFurnishing(),
                softFurnishing({ id: "second-curtain" }),
              ],
            }),
            "type",
            "furnishings[0].domain",
          ),
      ],
      [
        "distinctDomainsPass",
        () =>
          check({
            furnishings: [
              softFurnishing(),
              softFurnishing({ id: "second-curtain", domain: "twin" }),
            ],
            domains: [panel(), panel({ id: "twin" })],
          }).success === true,
      ],
    ]),
    { second: true, distinctDomainsPass: true },
  );

  const duplicateDomains = [
    softFurnishing({
      id: "zeta",
      domain: "z-domain",
    }),
    softFurnishing({
      id: "alpha",
      environment: "other",
      domain: "z-domain",
    }),
    softFurnishing({
      id: "omega",
      domain: "a-domain",
    }),
    softFurnishing({
      id: "beta",
      environment: "other",
      domain: "a-domain",
    }),
  ];
  const ownershipFacts = (furnishings: IAutoMovieSoftFurnishing[]) => {
    const validation =
      validateAutoMovieSoftFurnishingDomainOwnership(furnishings);
    return validation.success === true
      ? []
      : validation.violations.map((violation) => [
          violation.value,
          violation.expected,
        ]);
  };
  const expectedOwnershipFacts = [
    [
      "a-domain",
      'soft body domain "a-domain" is already drawn by furnishing "beta"',
    ],
    [
      "z-domain",
      'soft body domain "z-domain" is already drawn by furnishing "alpha"',
    ],
  ];
  TestValidator.equals(
    "domain ownership is global and deterministic",
    namedFacts([
      [
        "sameEnvironment",
        () =>
          validateAutoMovieSoftFurnishingDomainOwnership([
            softFurnishing(),
            softFurnishing({ id: "second-curtain" }),
          ]).success === false,
      ],
      [
        "differentEnvironment",
        () =>
          validateAutoMovieSoftFurnishingDomainOwnership([
            softFurnishing(),
            softFurnishing({ id: "second-curtain", environment: "other" }),
          ]).success === false,
      ],
      [
        "differentDomains",
        () =>
          validateAutoMovieSoftFurnishingDomainOwnership([
            softFurnishing(),
            softFurnishing({
              id: "second-curtain",
              environment: "other",
              domain: "other-panel",
            }),
          ]).success === true,
      ],
      [
        "stableOrder",
        () =>
          JSON.stringify(ownershipFacts(duplicateDomains)) ===
            JSON.stringify(expectedOwnershipFacts) &&
          JSON.stringify(ownershipFacts([...duplicateDomains].reverse())) ===
            JSON.stringify(expectedOwnershipFacts),
      ],
      [
        "prevalidated",
        () =>
          validateSoftFurnishings({
            environment: roomEnvironment(),
            furnishings: [
              softFurnishing(),
              softFurnishing({ id: "second-curtain" }),
            ],
            domains: [panel()],
            domainOwnership: "prevalidated",
          }).success === true,
      ],
    ]),
    {
      sameEnvironment: true,
      differentEnvironment: true,
      differentDomains: true,
      stableOrder: true,
      prevalidated: true,
    },
  );

  const frame = (
    furnishing: IAutoMovieSoftFurnishing,
    domain: IAutoMovieSoftBodyDomain,
  ) => lowerSoftFurnishing({ furnishing, domain, time: 0.5 });
  const notRun = frame(softFurnishing(), panel({ mass: [1] }));
  const unnamed = frame(softFurnishing({ state: "shut" }), panel());
  const unsupported = frame(softFurnishing(), panel({ selfCollision: true }));
  const resting = frame(softFurnishing({ mode: "rest" }), panel());
  const solved = frame(softFurnishing({ state: "open" }), panel());
  TestValidator.equals(
    "the capability matrix reports what was computed and what was not",
    namedFacts([
      [
        "notRun",
        () =>
          notRun.analysis.status === "not-run" &&
          notRun.state === null &&
          notRun.surface === null &&
          notRun.analysis.reason !== null,
      ],
      [
        "unnamedState",
        () => unnamed.analysis.status === "not-run" && unnamed.state === null,
      ],
      [
        "unsupported",
        () =>
          unsupported.analysis.status === "unsupported" &&
          unsupported.analysis.unsupported.includes("self-collision") &&
          unsupported.state?.step === 0 &&
          unsupported.surface !== null,
      ],
      [
        "rest",
        () =>
          resting.analysis.status === "rest" &&
          resting.state?.step === 0 &&
          resting.analysis.reason === null,
      ],
      [
        "solved",
        () =>
          solved.analysis.status === "solved" &&
          solved.state?.step === 32 &&
          solved.state?.state === "open" &&
          solved.analysis.unsupported.length === 0,
      ],
      [
        "unknownMode",
        () => {
          const odd = frame(
            softFurnishing({ mode: "baked" as unknown as "rest" }),
            panel(),
          );
          return (
            odd.analysis.status === "not-run" &&
            odd.state === null &&
            odd.surface === null
          );
        },
      ],
      [
        "mismatchedDomain",
        () => {
          const odd = frame(softFurnishing({ domain: "other" }), panel());
          return (
            odd.analysis.status === "not-run" &&
            odd.state === null &&
            odd.surface === null &&
            (odd.analysis.reason ?? "").includes('soft body "other"')
          );
        },
      ],
      ["kind", () => solved.analysis.kind === "soft-body"],
      ["furnishing", () => solved.furnishing === "window-curtain"],
      ["surfaceStep", () => solved.surface?.step === 32],
    ]),
    {
      notRun: true,
      unnamedState: true,
      unsupported: true,
      rest: true,
      solved: true,
      unknownMode: true,
      mismatchedDomain: true,
      kind: true,
      furnishing: true,
      surfaceStep: true,
    },
  );

  // The default panel steps at 1/64 s and declares 1000 of them, so its clock
  // reaches 15.625 s and no further.
  const late = lowerSoftFurnishing({
    furnishing: softFurnishing(),
    domain: panel(),
    time: 16,
  });
  TestValidator.equals(
    "a second the declared budget cannot reach is reported, not thrown",
    namedFacts([
      [
        "past",
        () =>
          late.analysis.status === "not-run" &&
          late.state === null &&
          late.surface === null &&
          (late.analysis.reason ?? "").includes("step 1024"),
      ],
      [
        "lastReachable",
        () =>
          lowerSoftFurnishing({
            furnishing: softFurnishing(),
            domain: panel(),
            time: 15.625,
          }).state?.step === 1_000,
      ],
      [
        "notReal",
        () => {
          const odd = lowerSoftFurnishing({
            furnishing: softFurnishing(),
            domain: panel(),
            time: Number.NaN,
          });
          return odd.analysis.status === "not-run" && odd.state === null;
        },
      ],
      [
        "beforeTheClock",
        () =>
          lowerSoftFurnishing({
            furnishing: softFurnishing(),
            domain: panel(),
            time: -4,
          }).state?.step === 0,
      ],
    ]),
    {
      past: true,
      lastReachable: true,
      notReal: true,
      beforeTheClock: true,
    },
  );
};
