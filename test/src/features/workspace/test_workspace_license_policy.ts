import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

interface ILicensePolicyFixtureFailure {
  error: unknown;
}

class LicensePolicyFixtureCleanupError extends AggregateError {}

/** Remove the license-policy root without replacing its primary failure. */
const preserveLicensePolicyFixtureCleanup = (
  failure: ILicensePolicyFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new LicensePolicyFixtureCleanupError(
      [failure.error, cleanupFailure],
      "License-policy fixture cleanup failed after the test failed.",
    );
  }
};

const ROOT = path.resolve(__dirname, "../../../..");
const POLICY_SCRIPT = path.join(ROOT, "internals", "license-policy.mjs");

interface IDependencyFixtureOptions {
  dependencies?: Record<string, string>;
  manifestName?: string;
  resolution?: "commonjs" | "export-map" | "import-only";
}

/** Write a tiny installed production dependency with a selected license. */
const writeDependency = (
  root: string,
  name: string,
  license: string,
  options: IDependencyFixtureOptions = {},
): void => {
  const dependency = path.join(root, "node_modules", name);
  fs.rmSync(dependency, { force: true, recursive: true });
  fs.mkdirSync(dependency, { recursive: true });
  const resolution = options.resolution ?? "commonjs";
  fs.writeFileSync(
    path.join(dependency, "package.json"),
    JSON.stringify({
      name: options.manifestName ?? name,
      version: "1.0.0",
      ...(resolution === "export-map"
        ? {
            exports: {
              ".": "./dist/cjs/index.js",
              "./*": "./dist/cjs/*",
            },
          }
        : resolution === "import-only"
          ? {
              type: "module",
              exports: {
                ".": {
                  browser: "./dist/index.js",
                  import: "./dist/index.js",
                },
              },
            }
          : { main: "index.js" }),
      ...(options.dependencies === undefined
        ? {}
        : { dependencies: options.dependencies }),
      license,
    }),
  );
  if (resolution === "export-map") {
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
  } else if (resolution === "import-only") {
    const distribution = path.join(dependency, "dist");
    fs.mkdirSync(distribution, { recursive: true });
    fs.writeFileSync(path.join(distribution, "index.js"), "export {};\n");
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
 * 2. Wildcard exports that map `dependency/package.json` to an internal mode
 *    marker and import-only exports both resolve the licensed root manifest.
 * 3. A shipped scaffold is itself audited and can resolve dependencies either from
 *    another audited production workspace root or a declared local `file:`
 *    package, including that package's own license and identity.
 * 4. Another workspace cannot hide missing direct optional, optional-peer, or
 *    external transitive edges with its own same-named installed dependency.
 * 5. Node built-ins need no package license while npm aliases audit their physical
 *    target package manifest.
 */
export const test_workspace_license_policy = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-license-"));
  let licensePolicyFailure: ILicensePolicyFixtureFailure | undefined;
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

    writeDependency(root, "dependency", "GPL-3.0-only", {
      resolution: "export-map",
    });
    const rejected = check(root);
    writeDependency(root, "dependency", "MIT WITH GPL-3.0-only", {
      resolution: "export-map",
    });
    const disguised = check(root);
    writeDependency(root, "dependency", "MIT", {
      resolution: "export-map",
    });
    const accepted = check(root);
    writeDependency(root, "dependency", "(MIT OR Apache-2.0)", {
      resolution: "export-map",
    });
    const expression = check(root);
    writeDependency(root, "dependency", "MIT", {
      resolution: "import-only",
    });
    const importOnly = check(root);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: {
          buffer: "1.0.0",
          "typescript-compiler": "npm:typescript@1.0.0",
        },
      }),
    );
    writeDependency(root, "typescript-compiler", "Apache-2.0", {
      manifestName: "typescript",
    });
    const builtinAndAlias = check(root);
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
    const localDependency = path.join(scaffold, "vendor", "local-dependency");
    fs.mkdirSync(localDependency, { recursive: true });
    fs.writeFileSync(
      path.join(localDependency, "package.json"),
      JSON.stringify({
        name: "local-dependency",
        version: "1.0.0",
        license: "GPL-3.0-only",
      }),
    );
    fs.writeFileSync(
      path.join(scaffold, "package.json"),
      JSON.stringify({
        name: "shipped-scaffold",
        version: "1.0.0",
        license: "MIT",
        dependencies: {
          "local-dependency": "file:vendor/local-dependency",
        },
      }),
    );
    const disallowedLocalTemplate = check(root);
    fs.writeFileSync(
      path.join(localDependency, "package.json"),
      JSON.stringify({
        name: "local-dependency",
        version: "1.0.0",
        license: "MIT",
      }),
    );
    const resolvedLocalTemplate = check(root);
    fs.writeFileSync(
      path.join(localDependency, "package.json"),
      JSON.stringify({
        name: "wrong-local-identity",
        version: "1.0.0",
        license: "MIT",
      }),
    );
    const mismatchedLocalTemplate = check(root);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: { dependency: "1.0.0" },
        devDependencies: { "unowned-template": "1.0.0" },
      }),
    );
    writeDependency(root, "unowned-template", "MIT");
    fs.writeFileSync(
      path.join(scaffold, "package.json"),
      JSON.stringify({
        name: "shipped-scaffold",
        version: "1.0.0",
        license: "MIT",
        dependencies: { "unowned-template": "{{version:unowned}}" },
      }),
    );
    const unownedTemplate = check(root);
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
    fs.writeFileSync(
      path.join(scaffold, "package.json"),
      JSON.stringify({
        name: "shipped-scaffold",
        version: "1.0.0",
        license: "MIT",
      }),
    );
    fs.writeFileSync(
      path.join(audit, "package.json"),
      JSON.stringify({
        name: "audit-root",
        version: "1.0.0",
        license: "MIT",
        dependencies: {
          "shared-optional": "1.0.0",
          "shared-peer": "1.0.0",
          "template-dependency": "1.0.0",
          "transitive-missing": "1.0.0",
        },
      }),
    );
    for (const dependency of [
      "shared-optional",
      "shared-peer",
      "transitive-missing",
    ])
      writeDependency(audit, dependency, "MIT");
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: { dependency: "1.0.0" },
        optionalDependencies: { "shared-optional": "1.0.0" },
        peerDependencies: { "shared-peer": "1.0.0" },
        peerDependenciesMeta: { "shared-peer": { optional: true } },
      }),
    );
    writeDependency(root, "dependency", "MIT");
    const missingWorkspaceOptionals = check(root);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "license-fixture",
        version: "1.0.0",
        license: "MIT",
        dependencies: { dependency: "1.0.0" },
      }),
    );
    writeDependency(root, "dependency", "MIT", {
      dependencies: { "transitive-missing": "1.0.0" },
    });
    const missingTransitive = check(root);
    TestValidator.equals(
      "package identity, SPDX, optional, and shipped-template dependency boundaries fail closed",
      namedFacts([
        ["rejectedStatus", () => rejected.status === 1],
        [
          "rejectedStderrIncludes",
          () => rejected.stderr.includes("GPL-3.0-only"),
        ],
        ["disguisedStatus", () => disguised.status === 1],
        [
          "disguisedStderrIncludes",
          () => disguised.stderr.includes("disallowed license or exception"),
        ],
        ["acceptedStatus", () => accepted.status === 0],
        [
          "acceptedStdoutIncludes",
          () => accepted.stdout.includes("policy passed"),
        ],
        ["expressionStatus", () => expression.status === 0],
        ["importOnlyStatus", () => importOnly.status === 0],
        ["builtinAndAliasStatus", () => builtinAndAlias.status === 0],
        ["missingOptionalStatus", () => missingOptional.status === 1],
        [
          "missingOptionalStderrIncludes",
          () => missingOptional.stderr.includes("absent-optional"),
        ],
        [
          "missingOptionalStderrIncludes2",
          () => missingOptional.stderr.includes("absent-peer"),
        ],
        ["shippedTemplateStatus", () => shippedTemplate.status === 1],
        [
          "shippedTemplateStderrIncludes",
          () => shippedTemplate.stderr.includes("shipped-scaffold"),
        ],
        ["resolvedTemplateStatus", () => resolvedTemplate.status === 0],
        ["unownedTemplateStatus", () => unownedTemplate.status === 1],
        [
          "unownedTemplateStderrIncludes",
          () => unownedTemplate.stderr.includes("unowned-template"),
        ],
        ["missingTemplateStatus", () => missingTemplate.status === 1],
        [
          "missingTemplateStderrIncludes",
          () => missingTemplate.stderr.includes("absent-template"),
        ],
        [
          "disallowedLocalTemplateStatus",
          () => disallowedLocalTemplate.status === 1,
        ],
        [
          "disallowedLocalTemplateStderrIncludes",
          () => disallowedLocalTemplate.stderr.includes("GPL-3.0-only"),
        ],
        [
          "resolvedLocalTemplateStatus",
          () => resolvedLocalTemplate.status === 0,
        ],
        [
          "mismatchedLocalTemplateStatus",
          () => mismatchedLocalTemplate.status === 1,
        ],
        [
          "mismatchedLocalTemplateStderrIncludes",
          () => mismatchedLocalTemplate.stderr.includes("local-dependency"),
        ],
        [
          "missingWorkspaceOptionalsStatus",
          () => missingWorkspaceOptionals.status === 1,
        ],
        [
          "missingWorkspaceOptionalsStderrIncludes",
          () => missingWorkspaceOptionals.stderr.includes("shared-optional"),
        ],
        [
          "missingWorkspaceOptionalsStderrIncludes2",
          () => missingWorkspaceOptionals.stderr.includes("shared-peer"),
        ],
        ["missingTransitiveStatus", () => missingTransitive.status === 1],
        [
          "missingTransitiveStderrIncludes",
          () => missingTransitive.stderr.includes("transitive-missing"),
        ],
      ]),
      {
        rejectedStatus: true,
        rejectedStderrIncludes: true,
        disguisedStatus: true,
        disguisedStderrIncludes: true,
        acceptedStatus: true,
        acceptedStdoutIncludes: true,
        expressionStatus: true,
        importOnlyStatus: true,
        builtinAndAliasStatus: true,
        missingOptionalStatus: true,
        missingOptionalStderrIncludes: true,
        missingOptionalStderrIncludes2: true,
        shippedTemplateStatus: true,
        shippedTemplateStderrIncludes: true,
        resolvedTemplateStatus: true,
        unownedTemplateStatus: true,
        unownedTemplateStderrIncludes: true,
        missingTemplateStatus: true,
        missingTemplateStderrIncludes: true,
        disallowedLocalTemplateStatus: true,
        disallowedLocalTemplateStderrIncludes: true,
        resolvedLocalTemplateStatus: true,
        mismatchedLocalTemplateStatus: true,
        mismatchedLocalTemplateStderrIncludes: true,
        missingWorkspaceOptionalsStatus: true,
        missingWorkspaceOptionalsStderrIncludes: true,
        missingWorkspaceOptionalsStderrIncludes2: true,
        missingTransitiveStatus: true,
        missingTransitiveStderrIncludes: true,
      },
    );
  } catch (error) {
    licensePolicyFailure = { error };
    throw error;
  } finally {
    preserveLicensePolicyFixtureCleanup(licensePolicyFailure, () =>
      fs.rmSync(root, { force: true, recursive: true }),
    );
  }
};
