import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");
const POLICY_SCRIPT = path.join(ROOT, "internals", "license-policy.mjs");

interface IDependencyFixtureOptions {
  dependencies?: Record<string, string>;
  manifestName?: string;
  resolution?: "commonjs" | "export-map" | "import-only";
}

interface IPackageManifest {
  dependencies?: Record<string, string>;
  license?: string;
  name: string;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface IScaffoldPackageManifest extends IPackageManifest {
  overrides?: {
    "@huggingface/transformers"?: {
      sharp?: string;
    };
  };
}

/** Scaffold dependencies without one installed production owner. */
const unauditedScaffoldDependencies = (): string[] => {
  const packageFiles = [
    path.join(ROOT, "package.json"),
    path.join(ROOT, "test", "package.json"),
    ...fs
      .readdirSync(path.join(ROOT, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(ROOT, "packages", entry.name, "package.json"))
      .filter(fs.existsSync),
  ];
  const manifests = packageFiles.map(
    (file) => JSON.parse(fs.readFileSync(file, "utf8")) as IPackageManifest,
  );
  const workspaceNames = new Set(manifests.map((manifest) => manifest.name));
  const productionDependencies = new Set(
    manifests.flatMap((manifest) => [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]),
  );
  const scaffoldFile = path.join(
    ROOT,
    "packages",
    "cli",
    "scaffold",
    "package.json",
  );
  const scaffold = JSON.parse(
    fs.readFileSync(scaffoldFile, "utf8"),
  ) as IPackageManifest;
  return Object.entries(scaffold.dependencies ?? {})
    .filter(([dependency, specifier]) => {
      if (specifier.startsWith("file:")) {
        const localManifest = path.join(
          path.resolve(
            path.dirname(scaffoldFile),
            specifier.slice("file:".length),
          ),
          "package.json",
        );
        return (
          fs.existsSync(localManifest) === false ||
          (
            JSON.parse(fs.readFileSync(localManifest, "utf8")) as {
              name?: string;
            }
          ).name !== dependency
        );
      }
      return (
        workspaceNames.has(dependency) === false &&
        productionDependencies.has(dependency) === false
      );
    })
    .map(([dependency]) => dependency)
    .sort(compareCodeUnits);
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Drift in the local permissive-only Transformers.js image capability wall. */
const invalidSharpCapabilityWall = (): string[] => {
  const scaffold = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "packages", "cli", "scaffold", "package.json"),
      "utf8",
    ),
  ) as IScaffoldPackageManifest;
  const wallRoot = path.join(
    ROOT,
    "packages",
    "cli",
    "scaffold",
    "vendor",
    "sharp-disabled",
  );
  const wall = JSON.parse(
    fs.readFileSync(path.join(wallRoot, "package.json"), "utf8"),
  ) as IPackageManifest;
  return [
    ...(scaffold.dependencies?.sharp === "file:vendor/sharp-disabled"
      ? []
      : ["scaffold direct dependency"]),
    ...(scaffold.overrides?.["@huggingface/transformers"]?.sharp ===
    "file:vendor/sharp-disabled"
      ? []
      : ["scaffold override"]),
    ...(wall.name === "sharp" && wall.license === "MIT"
      ? []
      : ["replacement identity"]),
    ...(fs
      .readFileSync(path.join(wallRoot, "index.cjs"), "utf8")
      .includes("text/audio path only")
      ? []
      : ["capability-wall error"]),
  ];
};

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
 * 6. The shipped Kokoro graph redirects Transformers.js's Sharp edge to the
 *    complete local MIT capability wall instead of a native LGPL package.
 */
export const test_workspace_license_policy = (): void => {
  TestValidator.equals(
    "every shipped scaffold runtime dependency has an audited production owner",
    unauditedScaffoldDependencies(),
    [],
  );
  TestValidator.equals(
    "the Kokoro graph replaces Sharp with a local permissive capability wall",
    invalidSharpCapabilityWall(),
    [],
  );
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
    TestValidator.predicate(
      "package identity, SPDX, optional, and shipped-template dependency boundaries fail closed",
      rejected.status === 1 &&
        rejected.stderr.includes("GPL-3.0-only") &&
        disguised.status === 1 &&
        disguised.stderr.includes("disallowed license or exception") &&
        accepted.status === 0 &&
        accepted.stdout.includes("policy passed") &&
        expression.status === 0 &&
        importOnly.status === 0 &&
        builtinAndAlias.status === 0 &&
        missingOptional.status === 1 &&
        missingOptional.stderr.includes("absent-optional") &&
        missingOptional.stderr.includes("absent-peer") &&
        shippedTemplate.status === 1 &&
        shippedTemplate.stderr.includes("shipped-scaffold") &&
        resolvedTemplate.status === 0 &&
        unownedTemplate.status === 1 &&
        unownedTemplate.stderr.includes("unowned-template") &&
        missingTemplate.status === 1 &&
        missingTemplate.stderr.includes("absent-template") &&
        disallowedLocalTemplate.status === 1 &&
        disallowedLocalTemplate.stderr.includes("GPL-3.0-only") &&
        resolvedLocalTemplate.status === 0 &&
        mismatchedLocalTemplate.status === 1 &&
        mismatchedLocalTemplate.stderr.includes("local-dependency") &&
        missingWorkspaceOptionals.status === 1 &&
        missingWorkspaceOptionals.stderr.includes("shared-optional") &&
        missingWorkspaceOptionals.stderr.includes("shared-peer") &&
        missingTransitive.status === 1 &&
        missingTransitive.stderr.includes("transitive-missing"),
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
