import { openAutoMovieProduction } from "@automovie/mcp";
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
 * A production builds its own site with the engine, from the module a shot imports.
 *
 * `packages/engine/src/worldKit.ts` is where a production's site is built, and
 * the sandbox served exactly one of its names. That mattered because a world
 * module is shot-source code: the starter's `src/shots/opening.ts` imports
 * `../world/plaza`, and the import gate reads the whole module rather than the
 * method the shot happens to call, so a piece that built its patch with
 * `worldTerrain` was refused at compile time. A production authoring its own
 * ground could reach `worldSurfaceHeight` and nothing else.
 *
 * Reach stays per name, and `worldHeightfield` is why it has to be: it samples a
 * caller's `(x, z) => y` function, a function does not survive a JSON round trip,
 * and standing it in would put a second copy of the sampling math inside the
 * sandbox. That copy is the failure the bridge exists to prevent, and four
 * rounding disagreements in one cycle are what taught it. It is not the only
 * name of that module still off the surface — `worldGroundSurface` and
 * `worldGroundHeight` are too — so this case names what it compiles rather than
 * counting a family, which is how `BUILT_ENVIRONMENT` came to publish a count of
 * six against eight reachable queries.
 *
 * `assertWorldPlacements` is the one member of the kit whose whole purpose is to
 * stop work, and stopping work is the half a bridge can lose quietly: the engine
 * refuses on the host side, the refusal crosses back as a message rather than as
 * an error object, and a boundary that dropped it would leave an author compiling
 * a building standing on nothing. So the grounded block and the floating one are
 * both compiled here, one property apart.
 *
 * Scenarios:
 *
 * 1. Shot source imports the bridged site builders, builds a terrain patch, a
 *    ramp, and a grounded box-proxy block, calls the contradiction gate over
 *    them, and the production compiles.
 * 2. The same source recompiles to byte-identical output, so a bridged builder
 *    carries no clock, realm, or iteration-order state across the boundary.
 * 3. Lifting that block off the terrain, and changing nothing else, fails the
 *    compile with the engine's own refusal naming the block, so the gate's
 *    verdict survives the bridge instead of being swallowed by it.
 * 4. `worldHeightfield` is refused by name with the reason, rather than resolving
 *    to a stand-in nobody reviewed.
 */
export const test_mcp_site_kit_from_shot_source = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(sourcePath, siteSource(original, 0), "utf8");

    const services = openAutoMovieProduction({ projectRoot: fixture.root });
    const first = services.compiler.compile({ scope: "source" });
    const second = services.compiler.compile({ scope: "source" });

    TestValidator.equals(
      "shot source builds its own site through the bridged kit",
      namedFacts([
        [
          "the first compile succeeds",
          () => productionCompileSucceeded("site kit", first),
        ],
        [
          "no import was refused",
          () =>
            first.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-import-unsupported" ||
                diagnostic.code === "source-capability-forbidden",
            ) === false,
        ],
        [
          "the same source materializes byte-identical output",
          () =>
            JSON.stringify(
              second.materialized.map(({ path: file, digest }) => ({
                file,
                digest,
              })),
            ) ===
            JSON.stringify(
              first.materialized.map(({ path: file, digest }) => ({
                file,
                digest,
              })),
            ),
        ],
      ]),
      {
        "the first compile succeeds": true,
        "no import was refused": true,
        "the same source materializes byte-identical output": true,
      },
    );

    // The same site with the podium lifted a clear five metres off the terrain
    // it was resting on. Nothing else moves, so a refusal here is the placement
    // gate's and not a second defect the rewrite introduced.
    fs.writeFileSync(sourcePath, siteSource(original, 5), "utf8");
    const refused = openAutoMovieProduction({
      projectRoot: fixture.root,
    }).compiler.compile({ scope: "source" });
    TestValidator.equals(
      "the site gate's refusal crosses the bridge in the engine's own words",
      namedFacts([
        ["the compile does not succeed", () => refused.success === false],
        [
          "the operator is told which block floats",
          () =>
            refused.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-execution-failed" &&
                diagnostic.message.includes(
                  'World block "site-podium" floats or lacks a supporting surface at its base.',
                ),
            ),
        ],
      ]),
      {
        "the compile does not succeed": true,
        "the operator is told which block floats": true,
      },
    );

    fs.writeFileSync(
      sourcePath,
      rewriteSource(
        original,
        'import { defineShot } from "@automovie/engine";',
        'import { defineShot, worldHeightfield } from "@automovie/engine";',
      ),
      "utf8",
    );
    const withheld = openAutoMovieProduction({
      projectRoot: fixture.root,
    }).compiler.compile({ scope: "source" });
    TestValidator.equals(
      "the one builder the boundary cannot carry is refused by name",
      withheld.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "source-import-unsupported" &&
          diagnostic.message.includes("worldHeightfield"),
      ),
      true,
    );
  } finally {
    fixture.dispose();
  }
};

/**
 * The starter's opening shot, rewritten to build the site it plays on.
 *
 * The podium's base height is the only parameter, because the grounded case and
 * the refused one must differ by exactly the property the gate reads. Writing
 * two separate sources instead would let an unrelated edit produce the refusal
 * and read as proof of this one.
 */
const siteSource = (original: string, podiumBaseY: number): string =>
  rewriteSource(
    rewriteSource(
      original,
      'import { defineShot } from "@automovie/engine";',
      [
        "import {",
        "  assertWorldPlacements,",
        "  defineShot,",
        "  worldBlock,",
        "  worldRamp,",
        "  worldTerrain,",
        '} from "@automovie/engine";',
      ].join("\n"),
    ),
    "  const performer = soloist.render(context, { from: props.openingAbduction });",
    [
      "  const performer = soloist.render(context, { from: props.openingAbduction });",
      "  const ground = worldTerrain({",
      '    id: "site-ground",',
      "    polygon: [",
      "      { x: -12, z: -12 },",
      "      { x: 12, z: -12 },",
      "      { x: 12, z: 12 },",
      "      { x: -12, z: 12 },",
      "    ],",
      "    height: 0,",
      "    walkable: true,",
      "  });",
      "  const approach = worldRamp({",
      '    id: "site-approach",',
      "    from: { x: -6, z: 10 },",
      "    to: { x: -6, z: 4 },",
      "    width: 2.4,",
      "    baseHeight: 0,",
      "    rise: 1.2,",
      "    walkable: true,",
      "  });",
      "  const podium = worldBlock({",
      '    id: "site-podium",',
      '    kind: "building",',
      `    base: { x: 6, y: ${podiumBaseY}, z: 0 },`,
      "    size: { x: 4, y: 1.2, z: 4 },",
      '    color: "#8a8f98",',
      "  });",
      "  assertWorldPlacements({",
      "    blocks: [podium],",
      "    surfaces: [ground, approach],",
      "    routes: [],",
      "    landmarks: [],",
      "  });",
    ].join("\n"),
  );
