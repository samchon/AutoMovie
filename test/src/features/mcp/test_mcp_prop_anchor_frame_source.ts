import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
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
 * A shot source can turn its declared prop relation into the staged frame.
 *
 * `src/examples/props.ts` is the shipped technique rather than a test-only
 * imitation: its standing props ask `propAnchorFrame` for the room's support
 * patch, offset from that answer, and declare the matching `on-support`
 * relation. Importing the example into a real shot therefore drives the source
 * linker, JSON-only engine bridge, placement resolver, and compiler validation
 * as one path.
 *
 * Scenarios:
 *
 * 1. A real source module imports the placement example, derives its props and
 *    building, and compiles the host at the support frame plus half its height.
 * 2. Recompiling the same source yields the same generated paths and digests,
 *    so exposing the resolver adds no hidden clock or realm state.
 */
export const test_mcp_prop_anchor_frame_source = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    const withExampleImport = rewriteSource(
      original,
      'import { defineShot } from "@automovie/engine";',
      [
        'import { defineShot } from "@automovie/engine";',
        'import { ExamplePlacementSuite } from "../examples/props";',
      ].join("\n"),
    );
    const withPlacement = rewriteSource(
      withExampleImport,
      "  const performer = soloist.render(context, { from: props.openingAbduction });",
      [
        "  const performer = soloist.render(context, { from: props.openingAbduction });",
        "  const placement = new ExamplePlacementSuite().design();",
      ].join("\n"),
    );
    const withRegistry = rewriteSource(
      withPlacement,
      "  return {\n    actors:",
      [
        "  return {",
        "    models: [...(placement.models ?? [])],",
        "    builtEnvironments: [...(placement.builtEnvironments ?? [])],",
        "    actors:",
      ].join("\n"),
    );
    const withProps = rewriteSource(
      withRegistry,
      "    props: [...(fixture.props ?? [])],",
      "    props: [...(placement.props ?? []), ...(fixture.props ?? [])],",
    );
    fs.writeFileSync(
      sourcePath,
      rewriteSource(
        withProps,
        "      set: [...(fixture.set ?? [])],",
        "      set: [...(placement.set ?? []), ...(fixture.set ?? [])],",
      ),
      "utf8",
    );

    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    const first = compiler.compile({ scope: "source" });
    const second = compiler.compile({ scope: "source" });
    const compiled =
      first.success &&
      first.materialized.some((file) => file.path === "shots/opening.json")
        ? (JSON.parse(
            Buffer.from(
              project.readGeneratedFile("shots/opening.json"),
            ).toString("utf8"),
          ) as IAutoMovieCompiledShotSource)
        : null;
    const host = compiled?.scene.nodes.find(
      (node) => node.id === "example-host-prop",
    );

    TestValidator.equals(
      "declared placement relations reach their resolver from shot source",
      namedFacts([
        [
          "first compile succeeds",
          () => productionCompileSucceeded("first prop-anchor", first),
        ],
        [
          "second compile succeeds",
          () => productionCompileSucceeded("second prop-anchor", second),
        ],
        [
          "no unsupported import",
          () =>
            first.diagnostics.some(
              (diagnostic) => diagnostic.code === "source-import-unsupported",
            ) === false,
        ],
        [
          "relation and staged result survive compilation",
          () =>
            compiled?.props?.some(
              (prop) =>
                prop.node === "example-host-prop" &&
                prop.placement?.relations.some(
                  (relation) =>
                    relation.kind === "on-support" &&
                    relation.target.kind === "surface" &&
                    relation.target.surface === "room-floor",
                ),
            ) === true &&
            host?.transform.translation.x === 0 &&
            host.transform.translation.y === 0.375 &&
            host.transform.translation.z === 0,
        ],
      ]),
      {
        "first compile succeeds": true,
        "second compile succeeds": true,
        "no unsupported import": true,
        "relation and staged result survive compilation": true,
      },
    );
    TestValidator.equals(
      "the same placement source materializes byte-identical output",
      second.materialized.map(({ path: file, digest }) => ({ file, digest })),
      first.materialized.map(({ path: file, digest }) => ({ file, digest })),
    );
  } finally {
    fixture.dispose();
  }
};
