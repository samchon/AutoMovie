import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/** Keep the public entry instructions aligned with the shipped product. */
export const test_workspace_public_contracts = (): void => {
  const rootReadme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const engineReadme = fs.readFileSync(
    path.join(ROOT, "packages", "engine", "README.md"),
    "utf8",
  );
  const violationKind = fs.readFileSync(
    path.join(
      ROOT,
      "packages",
      "interface",
      "src",
      "validation",
      "AutoMovieViolationKind.ts",
    ),
    "utf8",
  );
  const violationContract = fs.readFileSync(
    path.join(
      ROOT,
      "packages",
      "interface",
      "src",
      "validation",
      "IAutoMovieConstraintViolation.ts",
    ),
    "utf8",
  );
  const publicContract = [
    rootReadme,
    engineReadme,
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
};
