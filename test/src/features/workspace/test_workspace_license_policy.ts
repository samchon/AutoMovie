import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");
const POLICY_SCRIPT = path.join(ROOT, "internals", "license-policy.mjs");

/** Write a tiny installed production dependency with a selected license. */
const writeDependency = (root: string, license: string): void => {
  const dependency = path.join(root, "node_modules", "dependency");
  fs.mkdirSync(dependency, { recursive: true });
  fs.writeFileSync(
    path.join(dependency, "package.json"),
    JSON.stringify({
      name: "dependency",
      version: "1.0.0",
      main: "index.js",
      license,
    }),
  );
  fs.writeFileSync(path.join(dependency, "index.js"), "module.exports = {};\n");
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
 * license.
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

    writeDependency(root, "GPL-3.0-only");
    const rejected = check(root);
    writeDependency(root, "MIT WITH GPL-3.0-only");
    const disguised = check(root);
    writeDependency(root, "MIT");
    const accepted = check(root);
    writeDependency(root, "(MIT OR Apache-2.0)");
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
    TestValidator.predicate(
      "GPL, SPDX disguises, missing direct optional packages, and the shipped scaffold fail closed",
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
        shippedTemplate.stderr.includes("shipped-scaffold"),
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
