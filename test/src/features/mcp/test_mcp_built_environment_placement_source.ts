import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

/**
 * A shot source can author a named building-support relation and execute both
 * placement queries through the deterministic sandbox bridge.
 *
 * The probe uses the shipped `ExampleBuilding`, not a test-only JSON result. Its
 * first door leaf begins 0.1 metres inside the first slab's world bound, and
 * the same slab overlaps the partition by positive volume, so the expected
 * statuses come from the example's authored transforms and unit-box geometry.
 *
 * Scenarios:
 *
 * 1. A real source module imports the support and overlap functions, declares
 *    an `IAutoMovieBuiltSupportQuery`, and executes both during shot build.
 * 2. The compiler reports neither an unsupported import nor an execution
 *    failure, proving the API is reachable rather than merely exported.
 * 3. Recompiling the same source produces byte-identical materialized output,
 *    so the bridge adds no hidden time, state, or member expansion.
 */
export const test_mcp_built_environment_placement_source = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    const withImports = rewriteSource(
      original,
      'import { defineShot } from "@automovie/engine";',
      [
        "import {",
        "  builtEnvironmentPlacementOverlap,",
        "  builtEnvironmentSupportStatus,",
        "  defineShot,",
        '} from "@automovie/engine";',
        'import type { IAutoMovieBuiltSupportQuery } from "@automovie/interface";',
        'import { ExampleBuilding } from "../examples/buildings";',
      ].join("\n"),
    );
    const withPlacementReview = rewriteSource(
      withImports,
      "  const performer = soloist.render(context, { from: props.openingAbduction });",
      [
        "  const performer = soloist.render(context, { from: props.openingAbduction });",
        "  const building = new ExampleBuilding().design();",
        "  const relation = {",
        '    subject: { kind: "element", id: "tower-door-leaf-0" },',
        '    support: { kind: "element", id: "tower-slab-0" },',
        '    kind: "bearing",',
        "  } satisfies IAutoMovieBuiltSupportQuery;",
        "  const supportStatus = builtEnvironmentSupportStatus({",
        "    environment: building,",
        "    query: relation,",
        "  });",
        '  if (supportStatus.status !== "sunk" || supportStatus.gap !== -0.1)',
        '    throw new Error("building support query disagreed with authored transforms");',
        "  const overlap = builtEnvironmentPlacementOverlap({",
        "    environment: building,",
        '    left: { kind: "element", id: "tower-slab-0" },',
        '    right: { kind: "element", id: "tower-partition-0" },',
        "  });",
        '  if (overlap.status !== "overlapping")',
        '    throw new Error("building overlap query missed the authored intersection");',
      ].join("\n"),
    );
    fs.writeFileSync(sourcePath, withPlacementReview, "utf8");

    const compiler = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    );
    const first = compiler.compile({ scope: "source" });
    const second = compiler.compile({ scope: "source" });

    TestValidator.equals(
      "building placement queries execute from ordinary shot source",
      namedFacts([
        [
          "first compile succeeds",
          () => productionCompileSucceeded("first building-placement", first),
        ],
        [
          "second compile succeeds",
          () => productionCompileSucceeded("second building-placement", second),
        ],
        [
          "surface imports are admitted",
          () =>
            first.diagnostics.some(
              (diagnostic) => diagnostic.code === "source-import-unsupported",
            ) === false,
        ],
        [
          "query execution completes",
          () =>
            first.diagnostics.some(
              (diagnostic) => diagnostic.code === "source-execution-failed",
            ) === false,
        ],
      ]),
      {
        "first compile succeeds": true,
        "second compile succeeds": true,
        "surface imports are admitted": true,
        "query execution completes": true,
      },
    );
    TestValidator.equals(
      "repeated query compilation is byte-identical",
      second.materialized.map(({ path: file, digest }) => ({ file, digest })),
      first.materialized.map(({ path: file, digest }) => ({ file, digest })),
    );
  } finally {
    fixture.dispose();
  }
};
