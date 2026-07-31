import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");
const POLICY_SCRIPT = path.join(ROOT, "internals", "license-policy.mjs");

/** Write a tiny installed production dependency with a selected license. */
const writeDependency = (
  root: string,
  name: string,
  license: string,
  internalManifest: boolean = false,
): void => {
  const dependency = path.join(root, "node_modules", name);
  fs.mkdirSync(dependency, { recursive: true });
  fs.writeFileSync(
    path.join(dependency, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      ...(internalManifest
        ? {
            exports: {
              ".": "./dist/cjs/index.js",
              "./*": "./dist/cjs/*",
            },
          }
        : { main: "index.js" }),
      license,
    }),
  );
  if (internalManifest) {
    const distribution = path.join(dependency, "dist", "cjs");
    fs.mkdirSync(distribution, { recursive: true });
    fs.writeFileSync(
      path.join(distribution, "package.json"),
      JSON.stringify({ type: "commonjs" }),
    );
    fs.writeFileSync(
      path.join(distribution, "index.js"),
      "module.exports = {};\n",
    );
  } else
    fs.writeFileSync(
      path.join(dependency, "index.js"),
      "module.exports = {};\n",
    );
};

/** Run the repository license checker against the isolated fixture. */
const check = (root: string) =>
  spawnSync(
    process.execPath,
    [POLICY_SCRIPT, "--root", root, "--policy", "policy.json"],
    { encoding: "utf8" },
  );

/**
 * CI's production-license policy fails on an installed GPL dependency and
 * accepts the same graph once its package metadata carries an allowed SPDX
 * license. It resolves package identity above an export-mapped internal mode
 * manifest and lets a shipped template use dependencies installed by another
 * audited workspace root without allowing an uninstalled dependency.
 *
 * Scenarios:
 *
 * 1. A GPL license, a disallowed SPDX exception, and missing direct optional
 *    dependencies fail closed while allowed SPDX expressions pass.
 * 2. A wildcard export that maps `dependency/package.json` to an internal mode
 *    marker still resolves the named package's licensed root manifest.
 * 3. A shipped scaffold is itself audited, can resolve a dependency installed by
 *    another audited workspace root, and cannot name an absent dependency.
 */
export const test_workspace_license_policy = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-license-"));
  try {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: { dependency: "1.0.0" },
      }),
    );
    fs.writeFileSync(
      path.join(root, "policy.json"),
      JSON.stringify({
        allowed: ["Apache-2.0", "MIT"],
        allowedExceptions: [],
      }),
    );

    writeDependency(root, "dependency", "GPL-3.0-only", true);
    const rejected = check(root);
    writeDependency(root, "dependency", "MIT WITH GPL-3.0-only", true);
    const disguised = check(root);
    writeDependency(root, "dependency", "MIT", true);
    const accepted = check(root);
    writeDependency(root, "dependency", "(MIT OR Apache-2.0)", true);
    const expression = check(root);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: { dependency: "1.0.0" },
        optionalDependencies: { "absent-optional": "1.0.0" },
        peerDependencies: { "absent-peer": "1.0.0" },
        peerDependenciesMeta: { "absent-peer": { optional: true } },
      }),
    );
    const missingOptional = check(root);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: { dependency: "1.0.0" },
      }),
    );
    const scaffold = path.join(root, "packages", "cli", "scaffold");
    fs.mkdirSync(scaffold, { recursive: true });
    fs.writeFileSync(
      path.join(scaffold, "package.json"),
      JSON.stringify({
        name: "shipped-scaffold",
        version: "1.0.0",
        license: "GPL-3.0-only",
      }),
    );
    const shippedTemplate = check(root);
    const audit = path.join(root, "packages", "audit");
    fs.mkdirSync(audit, { recursive: true });
    fs.writeFileSync(
      path.join(audit, "package.json"),
      JSON.stringify({
        name: "audit-root",
        version: "1.0.0",
        license: "MIT",
        dependencies: { "template-dependency": "1.0.0" },
      }),
    );
    writeDependency(audit, "template-dependency", "MIT");
    fs.writeFileSync(
      path.join(scaffold, "package.json"),
      JSON.stringify({
        name: "shipped-scaffold",
        version: "1.0.0",
        license: "MIT",
        dependencies: { "template-dependency": "{{version:template}}" },
      }),
    );
    const resolvedTemplate = check(root);
    fs.writeFileSync(
      path.join(scaffold, "package.json"),
      JSON.stringify({
        name: "shipped-scaffold",
        version: "1.0.0",
        license: "MIT",
        dependencies: { "absent-template": "{{version:absent}}" },
      }),
    );
    const missingTemplate = check(root);
    TestValidator.predicate(
      "package identity, SPDX, optional, and shipped-template dependency boundaries fail closed",
      rejected.status === 1 &&
        rejected.stderr.includes("GPL-3.0-only") &&
        disguised.status === 1 &&
        disguised.stderr.includes("disallowed license or exception") &&
        accepted.status === 0 &&
        accepted.stdout.includes("policy passed") &&
        expression.status === 0 &&
        missingOptional.status === 1 &&
        missingOptional.stderr.includes("absent-optional") &&
        missingOptional.stderr.includes("absent-peer") &&
        shippedTemplate.status === 1 &&
        shippedTemplate.stderr.includes("shipped-scaffold") &&
        resolvedTemplate.status === 0 &&
        missingTemplate.status === 1 &&
        missingTemplate.stderr.includes("absent-template"),
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
