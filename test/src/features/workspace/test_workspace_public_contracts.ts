import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const readPackageFile = (...segments: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...segments), "utf8");

/**
 * The public entry documents must describe the product that shipped.
 *
 * These files are what a new contributor and a fresh agent read first, and
 * every claim in them is checkable against the tree beside them. They have
 * drifted repeatedly: retired command and agent surfaces outlived their removal
 * (#1385), a dependency the package no longer carries was still advertised, two
 * folds were documented as absent while their directories sat in `src`, the
 * tool counts stopped one release behind the surface, and a verb the harness
 * never had was taught as vocabulary (#1394). Prose cannot be trusted to age,
 * so each assertion reads the claim and the thing claimed.
 *
 * The negative halves are not decoration. A stale sentence usually survives
 * beside its correction rather than instead of it -- the interface README
 * asserted a `typia` dependency on line 5 and denied it on line 23 -- so a
 * positive-only pin passes while the contradiction ships.
 *
 * Scenarios:
 *
 * 1. The starter command names the published CLI binary, and no public entry
 *    document names a retired command or agent surface.
 * 2. The engine README documents the physics and topology tiers it implements, and
 *    the public violation kind calls physics a plausibility warning.
 * 3. The interface README claims no runtime dependency and names the harness and
 *    cinematics folds, with the removed `typia` claim asserted ABSENT.
 * 4. Its domain-folder table names every folder `packages/interface/src` ships,
 *    compared against the directory listing rather than against prose. `core/`
 *    was missing from the table until this comparison existed.
 * 5. The mcp README counts the current surfaces: 44 gateway operations, and 47
 *    granular tools in both places it states that number.
 * 6. The performance stage's JSDoc names real verbs only.
 * 7. The region contract documents the `fullBody` locomote default and
 *    content-aware layering -- both asserted PRESENT, both with the pre-#1383
 *    sentence they replaced asserted absent. The text is flattened across
 *    whitespace AND asterisks first, because a JSDoc continuation prefix would
 *    otherwise land mid-sentence.
 */
export const test_workspace_public_contracts = (): void => {
  const rootReadme = readPackageFile("README.md");
  const engineReadme = readPackageFile("packages", "engine", "README.md");
  const interfaceReadme = readPackageFile("packages", "interface", "README.md");
  const mcpReadme = readPackageFile("packages", "mcp", "README.md");
  const performanceApplication = readPackageFile(
    "packages",
    "interface",
    "src",
    "harness",
    "IAutoMoviePerformanceApplication.ts",
  );
  const actionCall = readPackageFile(
    "packages",
    "interface",
    "src",
    "harness",
    "IAutoMovieActionCall.ts",
  );
  const bodyRegion = readPackageFile(
    "packages",
    "interface",
    "src",
    "skeleton",
    "AutoMovieBodyRegion.ts",
  );
  const violationKind = readPackageFile(
    "packages",
    "interface",
    "src",
    "validation",
    "AutoMovieViolationKind.ts",
  );
  const violationContract = readPackageFile(
    "packages",
    "interface",
    "src",
    "validation",
    "IAutoMovieConstraintViolation.ts",
  );
  // Every document this scenario reads, so the retired-surface sweep covers
  // the same set the paragraph above claims for it: four READMEs, the harness
  // application and action-call contracts, the body-region enum, and the two
  // validation types. They reach a reader through different doors, and a
  // retired command name is equally wrong behind any of them.
  const publicContract = [
    rootReadme,
    engineReadme,
    interfaceReadme,
    mcpReadme,
    performanceApplication,
    actionCall,
    bodyRegion,
    violationKind,
    violationContract,
  ].join("\n");

  TestValidator.equals(
    "the starter command names the published CLI binary",
    rootReadme.includes("npx automovie start <dir>"),
    true,
  );
  TestValidator.equals(
    "public entry docs do not name retired command or agent surfaces",
    publicContract.match(/npx autobe|@automovie\/agent|MicroAgentica/g) ?? [],
    [],
  );
  TestValidator.equals(
    "the engine documents implemented physics and topology tiers",
    [
      engineReadme.includes("Tier 3 (physics)"),
      engineReadme.includes("Tier 5 (topology)"),
      engineReadme.includes("warning만 있으면 성공"),
    ],
    [true, true, true],
  );
  TestValidator.equals(
    "the public violation kind calls physics a plausibility warning",
    violationKind.includes("physical-plausibility warning"),
    true,
  );

  // #1394: the contract docs drifted from the shipped surface once (a removed
  // typia dependency, a harness folder claimed absent, pre-#1392 tool counts,
  // a verb that does not exist, and pre-#1383 region semantics). Pin the truth.
  TestValidator.equals(
    "the interface documents no runtime dependency and its harness folder",
    [
      interfaceReadme.includes("런타임 의존은 없다"),
      interfaceReadme.includes("`harness/`"),
      interfaceReadme.includes("`cinematics/`"),
      interfaceReadme.includes("의존성은 `typia`"),
    ],
    [true, true, true, false],
  );
  // The domain-folder table is a claim about the package's own layout, so read
  // the layout instead of trusting the prose. The table omitted `harness/` and
  // `cinematics/` until #1394, and `core/` (the node, track, and channel
  // primitives every other fold builds on) until the follow-up.
  TestValidator.equals(
    "the interface README's folder table matches the shipped folders",
    [...interfaceReadme.matchAll(/^\| `([^`]+)\/` \|/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    fs
      .readdirSync(path.join(ROOT, "packages", "interface", "src"), {
        withFileTypes: true,
      })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareCodeUnits),
  );
  TestValidator.equals(
    "the mcp README counts the current gateway and granular surfaces",
    [
      mcpReadme.includes("44 strictly typed operations"),
      mcpReadme.includes("47-tool compatibility surface"),
      mcpReadme.includes("47 times"),
    ],
    [true, true, true],
  );
  TestValidator.equals(
    "the performance stage names real verbs only",
    performanceApplication.includes("walkTo"),
    false,
  );
  TestValidator.equals(
    "the region contract documents fullBody locomote and content-aware layering",
    (() => {
      // JSDoc continuation prefixes (" * ") would land mid-sentence after a
      // whitespace-only flatten, so fold runs of whitespace AND asterisks.
      const flatCall = actionCall.replace(/[\s*]+/g, " ");
      const flatRegion = bodyRegion.replace(/[\s*]+/g, " ");
      return [
        flatCall.includes("a `locomote` is `lowerBody`"),
        flatCall.includes("a `locomote` is `fullBody`"),
        flatCall.includes("Overlap is judged on the content surviving those"),
        flatRegion.includes("cannot co-occur with any other region"),
        flatRegion.includes(
          "co-occurs with another region only while their surviving content",
        ),
      ];
    })(),
    [false, true, true, false, true],
  );
};
