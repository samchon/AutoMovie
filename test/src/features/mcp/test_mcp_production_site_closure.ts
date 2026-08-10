import { IAutoMovieEnvironmentContext } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionDesign,
  productionFixture,
  rewriteSource,
  setProductionFixtureShotContract,
  shotContract,
} from "./productionFixtures";

/**
 * The id the fixture building gives the one element the context may collide
 * with.
 */
const BUILDING_ELEMENT = "keep";

/** A building the shot contributes, so the compile has ids to reserve. */
const BUILT_ENVIRONMENT_SOURCE = `    builtEnvironments: [
      {
        version: 1 as const,
        id: "site-keep",
        units: "meter" as const,
        buildings: [
          { id: "keep", element: "${BUILDING_ELEMENT}", space: "keep-space" },
        ],
        models: [],
        modelReferences: [],
        elements: [
          {
            id: "${BUILDING_ELEMENT}",
            kind: "building",
            parent: null,
            transform: {
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
            model: null,
            space: null,
          },
        ],
        spaces: [
          { id: "keep-space", kind: "building", parent: null, cells: [] },
        ],
        boundaries: [],
        openings: [],
        connectors: [],
        surfaces: [],
        walkable: [],
      },
    ],
`;

/** Where the compiled shot lands, so a case can read what the compile decided. */
const compiledShotPath = (root: string): string =>
  path.join(root, "generated/fixture-film/shots/opening.json");

class ProductionSiteClosureCleanupError extends AggregateError {}

/** Dispose the fixture without replacing the failure that reached it. */
const preserveProductionSiteClosureCleanup = (
  failure: { error: unknown } | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionSiteClosureCleanupError(
      [failure.error, cleanupFailure],
      "Production site-closure fixture teardown failed after the test failed.",
    );
  }
};

/**
 * External conditions stay external, and a bound image stays registered.
 *
 * Two gates run at the same place in the compile, after every shot has produced
 * an artifact, because both are decided against what the production actually
 * COMPILED rather than against what it declared. A texture use is keyed by a
 * compiled model id and a site context is checked against the building's own
 * ids, and neither of those exists while the design graph is all there is.
 *
 * The site gate is what makes "read-only external context" more than a
 * sentence. Sun, sky, reference ground and a neighbouring shading mass are
 * conditions a building is subject to; the moment one of them shares an id with
 * a wall, the building appears to own it and the direction that keeps analysis
 * from becoming design is gone. So a collision is refused at compile rather
 * than resolved by precedence.
 *
 * The ledger gate closes the other direction: an image nobody registered is an
 * image nobody digests, so a material that binds one has escaped provenance
 * entirely rather than merely carrying a stale entry.
 *
 * Scenarios:
 *
 * 1. A production whose declared site context takes the id of an element its own
 *    building already carries is refused with `environment-context-invalid`
 *    naming that context, and the compile does not succeed.
 * 2. The same production with the same context renamed compiles with no site
 *    diagnostic at all, so what the gate refuses is the collision and not the
 *    mere presence of a declared context.
 * 3. A production declaring no context at all compiles with no site diagnostic,
 *    which is the additivity every production written before the field existed
 *    depends on.
 * 4. A model that binds an image the asset ledger does not carry is refused with
 *    `asset-texture-unclosed`; the same production without that binding carries
 *    no such diagnostic, so the refusal tracks the unregistered image rather
 *    than the presence of a material.
 */
export const test_mcp_production_site_closure = (): void => {
  const fixture = productionFixture();
  let failure: { error: unknown } | undefined;
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const openingSourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const stageAnchor = "    actors: [...(performer.actors ?? [])],";

    /** Give the shot a building, so the compile has ids to reserve. */
    fs.writeFileSync(
      openingSourcePath,
      rewriteSource(
        fs.readFileSync(openingSourcePath, "utf8"),
        stageAnchor,
        `${stageAnchor}\n${BUILT_ENVIRONMENT_SOURCE}`,
      ),
    );

    /** Register the production, then compile it and read every diagnostic. */
    const compileWith = (
      context: IAutoMovieEnvironmentContext | undefined,
    ): string[] => {
      const design = productionDesign();
      TestValidator.equals(
        "the production and its shot are registered",
        namedFacts([
          [
            "production",
            () =>
              project.setProductionDesign({
                ...design,
                ...(context === undefined
                  ? {}
                  : { environmentContext: context }),
              }).accepted,
          ],
          [
            "shot",
            () =>
              setProductionFixtureShotContract(project, shotContract())
                .accepted,
          ],
        ]),
        { production: true, shot: true },
      );
      const compiled = new AutoMovieProductionCompiler(project).compile({
        scope: "source",
      });
      return compiled.diagnostics.map((diagnostic) => diagnostic.code);
    };

    // 1. The context takes an id the building already carries.
    const colliding = compileWith(siteContext(BUILDING_ELEMENT));
    TestValidator.equals(
      "a site context colliding with a building element is refused",
      namedFacts([
        ["refused", () => colliding.includes("environment-context-invalid")],
        ["compiled", () => fs.existsSync(compiledShotPath(fixture.root))],
      ]),
      { refused: true, compiled: false },
    );

    // 2. The same context, renamed, is accepted.
    const renamed = compileWith(siteContext("neighbour-mass"));
    TestValidator.equals(
      "the same context renamed carries no site diagnostic",
      renamed.filter((code) => code === "environment-context-invalid"),
      [],
    );

    // 3. A production declaring no context is unaffected.
    const declaredNone = compileWith(undefined);
    TestValidator.equals(
      "a production declaring no site context carries no site diagnostic",
      declaredNone.filter((code) => code === "environment-context-invalid"),
      [],
    );

    // 4. A model binding an unregistered image is refused, and the same
    //    production without that binding is not.
    const withoutBinding = compileWith(undefined);
    TestValidator.equals(
      "a production binding no image carries no ledger diagnostic",
      withoutBinding.filter((code) => code === "asset-texture-unclosed"),
      [],
    );
    const materialAnchor = "    actors: [...(performer.actors ?? [])],";
    fs.writeFileSync(
      openingSourcePath,
      rewriteSource(
        fs.readFileSync(openingSourcePath, "utf8"),
        materialAnchor,
        `${materialAnchor}
    authoredModels: [
      {
        id: "site-panel",
        name: null,
        origin: "generated" as const,
        asset: null,
        skeleton: null,
        parts: [
          {
            id: "panel",
            name: null,
            geometry: {
              type: "primitive" as const,
              shape: {
                kind: "box" as const,
                width: 1,
                height: 1,
                depth: 0.1,
              },
            },
            material: "panel-finish",
            attachedBone: null,
            transform: null,
          },
        ],
        materials: [
          {
            id: "panel-finish",
            color: { r: 1, g: 1, b: 1, a: null, hex: null },
            baseColorTexture: "assets/textures/unregistered-tile.png",
          },
        ],
        affordances: [],
        body: null,
      },
    ],`,
      ),
    );
    const withBinding = compileWith(undefined);
    TestValidator.equals(
      "a model binding an unregistered image is refused",
      withBinding.includes("asset-texture-unclosed"),
      true,
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveProductionSiteClosureCleanup(failure, fixture.dispose);
  }
};

/** A minimal declared site context, named so a case can collide it on purpose. */
const siteContext = (id: string): IAutoMovieEnvironmentContext => ({
  version: 1,
  id,
  units: "meter",
  north: { x: 0, y: 0, z: 1 },
  ground: { up: { x: 0, y: 1, z: 0 }, elevation: 0 },
  instants: [],
  occluders: [],
});
