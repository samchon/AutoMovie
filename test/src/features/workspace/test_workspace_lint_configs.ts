import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const PACKAGE_CONFIG =
  /^import \{ automoviePackageLintConfig \} from "\.\.\/\.\.\/config\/lint\.config";\r?\n\r?\nexport default automoviePackageLintConfig\(\["[a-z][a-z0-9-]*"\]\);\r?\n?$/u;
const KNOWN_TTSC_PACKAGES = [
  "archetypes",
  "cli",
  "create-automovie",
  "engine",
  "face",
  "ingest",
  "interface",
  "mcp",
  "playground",
  "render",
  "viewer",
];

/** Does a shell build script invoke `ttsc` as a command? */
const invokesTtsc = (script: string): boolean =>
  /(?:^|&&\s*|\|\|\s*|;\s*)ttsc(?:\s|$)/u.test(script);

/**
 * Every direct workspace package built through `ttsc` must load the shared lint
 * policy and name its package-owned specification folder. Discovering packages
 * from build behavior keeps a new compiler package from silently bypassing the
 * graph, while the known set detects a renamed package that no longer builds.
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
    "every known package participates in ttsc config discovery",
    KNOWN_TTSC_PACKAGES.filter((name) => ttscPackages.includes(name)),
    KNOWN_TTSC_PACKAGES,
  );
  TestValidator.equals(
    "ttsc packages load the shared policy and one specification slice",
    ttscPackages.filter((name) => {
      const configPath = path.join(packageRoot, name, "lint.config.ts");
      return (
        fs.existsSync(configPath) === false ||
        PACKAGE_CONFIG.test(fs.readFileSync(configPath, "utf8")) === false
      );
    }),
    [],
  );
  TestValidator.equals(
    "ttsc packages resolve the evidence contributor from their manifest",
    ttscPackages.filter((name) => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(packageRoot, name, "package.json"), "utf8"),
      ) as { devDependencies?: Record<string, string> };
      return (
        manifest.devDependencies?.["@ttsc/evidence"] !== "catalog:typescript"
      );
    }),
    [],
  );
};
