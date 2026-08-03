import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const SHARED_CONFIG =
  'export { default } from "../../internals/config/lint.config";';
const KNOWN_TTSC_PACKAGES = ["benchmark-runner", "create-automovie"];

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
};
