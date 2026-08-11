import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const SHARED_CONFIG = 'export { default } from "../../config/lint.config";';
const KNOWN_TTSC_PACKAGES = ["create-automovie"];

/** Does a shell build script invoke `ttsc` as a command? */
const invokesTtsc = (script: string): boolean =>
  /(?:^|&&\s*|\|\|\s*|;\s*)ttsc(?:\s|$)/u.test(script);

/**
 * Every direct workspace package built through `ttsc` must load the shared lint
 * policy from its own package root, which is where `@ttsc/lint` starts config
 * discovery. Discovering packages from their build behavior keeps a newly added
 * compiler package from silently bypassing this gate.
 */
export const test_workspace_lint_configs = (): void => {
  const packageRoot = path.join(ROOT, "packages");
  const ttscPackages = fs
    .readdirSync(packageRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const manifestPath = path.join(packageRoot, name, "package.json");
      if (fs.existsSync(manifestPath) === false) return false;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        scripts?: { build?: string };
      };
      return invokesTtsc(manifest.scripts?.build ?? "");
    })
    .sort(compareCodeUnits);

  TestValidator.equals(
    "known ttsc package roots participate in lint config discovery",
    KNOWN_TTSC_PACKAGES.filter((name) => ttscPackages.includes(name)),
    KNOWN_TTSC_PACKAGES,
  );
  TestValidator.equals(
    "ttsc workspace packages load the shared lint policy",
    ttscPackages.filter((name) => {
      const configPath = path.join(packageRoot, name, "lint.config.ts");
      return (
        fs.existsSync(configPath) === false ||
        fs.readFileSync(configPath, "utf8").trim() !== SHARED_CONFIG
      );
    }),
    [],
  );

  const workspace = fs.readFileSync(
    path.join(ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );
  const configManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "config", "package.json"), "utf8"),
  ) as { scripts?: { build?: string } };
  const docsManifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "docs", "package.json"), "utf8"),
  ) as { scripts?: { build?: string } };
  const docsLint = fs.readFileSync(
    path.join(ROOT, "docs", "lint.config.ts"),
    "utf8",
  );
  TestValidator.equals(
    "configuration and documentation are workspace packages",
    [workspace.includes("  - config\n"), workspace.includes("  - docs\n")],
    [true, true],
  );
  TestValidator.equals(
    "legacy internal configuration files are gone",
    ["assertBuild.js", "lint.config.ts", "tsconfig.json"].filter((file) =>
      fs.existsSync(path.join(ROOT, "internals", "config", file)),
    ),
    [],
  );
  TestValidator.equals(
    "configuration and documentation build through ttsc",
    [
      invokesTtsc(configManifest.scripts?.build ?? ""),
      invokesTtsc(docsManifest.scripts?.build ?? ""),
    ],
    [true, true],
  );
  TestValidator.equals(
    "documentation extends the shared lint policy and installs its evidence graph",
    [
      docsLint.includes('extends: "../config/lint.config.ts"'),
      docsLint.includes('"evidence/graph": ["error", graph]'),
      docsLint.includes('files: ["specifications/**/*.md"]'),
      docsLint.includes('files: ["requirements/**/*.md"]'),
      docsLint.includes("noEvidenceExclude: true"),
    ],
    [true, true, true, true, true],
  );
};
