import {
  AUTOMOVIE_DIAGNOSTIC_CODES,
  AutoMovieViolationKind,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  autoMovieSourceContentDiagnosticCode,
  compareCodeUnits,
  findAutoMovieDiagnosticCatalogEntry,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture, rewriteSource } from "./productionFixtures";

/**
 * An engine violation keeps its tier and its severity across the compiler.
 *
 * The engine judges every finding by tier and severity, and this phase used to
 * publish neither: each one became `source-scene-content-invalid` at
 * `category: "error"`. The requirements refuse both halves of that. Distinct
 * causes may not be merged into one generic identity
 * (`#diagnostics-identity-stability`), and severity follows the effect on the
 * result rather than the tone of a sentence (`#diagnostics-severity-and-outcome`).
 *
 * The severity loss ran in two opposite directions, which is why it survived. A
 * fold that produced only warnings succeeded, so the whole result was dropped and
 * an authored wall sleeve that no run passes through was never mentioned at all.
 * The same warning beside any error was published as an error, so advice a film
 * may legitimately accept refused the compile instead.
 *
 * Scenario 2 uses that first case as its subject, because a warning nobody can
 * see is the harder half to notice and the easier half to prove: the fixture's
 * network is otherwise whole, so a compile that reports nothing is the old
 * behaviour and a compile that reports one warning while still succeeding is the
 * new one.
 *
 * Scenarios:
 *
 * 1. Every violation tier maps to a code the shipped catalog explains, and the
 *    tiers whose corrections differ (`physics`, `coverage`) keep identities of
 *    their own rather than sharing the content code.
 * 2. A service network carrying a sleeve no run cites compiles successfully and
 *    reports exactly one warning-severity diagnostic under the coverage
 *    identity, naming that sleeve.
 */
export const test_mcp_source_content_diagnostic_classification = (): void => {
  inspectKindMapping();
  inspectUncitedPenetration();
};

const KINDS: readonly AutoMovieViolationKind[] = [
  "type",
  "range",
  "rom",
  "physics",
  "temporal",
  "topology",
  "coverage",
];

const inspectKindMapping = (): void => {
  TestValidator.equals(
    "every violation tier resolves to a catalogued diagnostic identity",
    KINDS.filter((kind) => {
      const code = autoMovieSourceContentDiagnosticCode(kind);
      return (
        AUTOMOVIE_DIAGNOSTIC_CODES.includes(code) === false ||
        findAutoMovieDiagnosticCatalogEntry(code) === null
      );
    }),
    [],
  );

  TestValidator.equals(
    "the tiers whose corrections differ do not share one identity",
    {
      physics: autoMovieSourceContentDiagnosticCode("physics"),
      coverage: autoMovieSourceContentDiagnosticCode("coverage"),
      type: autoMovieSourceContentDiagnosticCode("type"),
      range: autoMovieSourceContentDiagnosticCode("range"),
    },
    {
      physics: "source-scene-physics-invalid",
      coverage: "source-scene-coverage-incomplete",
      type: "source-scene-content-invalid",
      range: "source-scene-content-invalid",
    },
  );
};

/**
 * The network this fixture declares, and why its one finding is the only one.
 *
 * The graph is empty on purpose. A network with no system, node, or run has no
 * dangling port, no unreachable fitting, and no undeclared crossing to report,
 * which leaves the sleeve as the only thing in the record with anything to say
 * about it.
 *
 * The sleeve itself is legal apart from being unused. A slab boundary declares no
 * face, so the engine holds a sleeve's position only against the runs that cite
 * it, and no run cites this one. The example wet zone is not declared here, so an
 * unsealed annulus owes nothing either.
 *
 * The building comes from `src/examples/buildings.ts` because the boundary has to
 * resolve against a building this shot actually carries. The services example
 * next to it cannot be imported from shot source at all: it reaches
 * `validateServiceNetwork` and `lowerServiceNetwork`, which are script-route
 * names the sandbox withholds.
 */
const ORPHAN_NETWORK = [
  "    serviceNetworks: [",
  "      {",
  "        version: 1,",
  '        id: "orphan-network",',
  '        units: "meter",',
  "        environment: environment.id,",
  "        systems: [],",
  "        nodes: [],",
  "        segments: [],",
  "        penetrations: [",
  "          {",
  '            id: "orphan-sleeve",',
  '            boundary: "tower-slab-boundary-1",',
  "            opening: null,",
  "            position: { x: 0, y: 3, z: 0 },",
  "            radius: 0.05,",
  "            sealed: false,",
  "          },",
  "        ],",
  "        zones: [],",
  "      },",
  "    ],",
].join("\n");

const inspectUncitedPenetration = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    const withImports = rewriteSource(
      original,
      'import { defineShot } from "@automovie/engine";',
      [
        'import { defineShot } from "@automovie/engine";',
        'import { ExampleBuilding } from "../examples/buildings";',
      ].join("\n"),
    );
    const withRecords = rewriteSource(
      withImports,
      "  const performer = soloist.render(context, { from: props.openingAbduction });",
      [
        "  const performer = soloist.render(context, { from: props.openingAbduction });",
        "  const environment = new ExampleBuilding().design();",
      ].join("\n"),
    );
    fs.writeFileSync(
      sourcePath,
      rewriteSource(
        withRecords,
        "  return {\n    actors:",
        [
          "  return {",
          "    builtEnvironments: [environment],",
          ORPHAN_NETWORK,
          "    actors:",
        ].join("\n"),
      ),
      "utf8",
    );

    const project = AutoMovieProductionProject.open(fixture.root);
    const output = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    const coverage = output.diagnostics.filter(
      (diagnostic) =>
        diagnostic.code === "source-scene-coverage-incomplete" &&
        diagnostic.message.includes("orphan-sleeve"),
    );
    const errors = output.diagnostics.filter(
      (diagnostic) => diagnostic.category === "error",
    );

    // Printed before the assertion, because a failure here is read from the
    // diagnostics the compile actually produced and the named facts only say
    // which expectation broke.
    if (output.success === false || coverage.length !== 1)
      console.error(
        `compile diagnostics:\n${output.diagnostics
          .map(
            (diagnostic) =>
              `${diagnostic.category} ${diagnostic.code} ${diagnostic.message}`,
          )
          .sort(compareCodeUnits)
          .join("\n")}`,
      );

    TestValidator.equals(
      "a sleeve no run cites is reported as one warning without failing the compile",
      namedFacts([
        ["the compile succeeds", () => output.success === true],
        ["no error is reported", () => errors.length === 0],
        ["the sleeve is reported once", () => coverage.length === 1],
        [
          "it is a warning at the source phase",
          () =>
            coverage[0]?.category === "warning" &&
            coverage[0]?.phase === "source",
        ],
        [
          "it is addressed inside the record that declared it",
          () =>
            coverage[0]?.message.startsWith(
              "$program.serviceNetworks[0].penetrations[0] ",
            ) === true,
        ],
      ]),
      {
        "the compile succeeds": true,
        "no error is reported": true,
        "the sleeve is reported once": true,
        "it is a warning at the source phase": true,
        "it is addressed inside the record that declared it": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
