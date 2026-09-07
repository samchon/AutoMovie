import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

interface IDependency {
  entry: string;
  package: string;
  specifier: string;
}

const unit = loadSourceModule<{
  capturePackageDependency: (props: {
    optionalVersion?: unknown;
    specifier: string;
    version: unknown;
  }) => Omit<IDependency, "entry"> & { optional: boolean };
  assertCapturePackageDependencyCurrent: (props: {
    dependency: IDependency;
    resolved: string;
    packages: readonly { entry: string; snapshot: { package: string } }[];
  }) => void;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/capturePackageDependency.ts",
  ),
);

/**
 * Capture seals the canonical package behind an npm alias while rechecking the
 * original import spelling against the same resolved generation.
 *
 * Scenarios:
 *
 * 1. Normal, scoped, versioned, and unversioned aliases retain distinct import
 *    and manifest names; missing or non-string versions keep normal identity.
 * 2. Empty and malformed npm aliases fail instead of silently changing the
 *    package identity admitted by the snapshot boundary.
 * 3. An unchanged alias binding passes among unrelated packages; a redirected
 *    entry, wrong manifest name, or missing sealed package fails.
 * 4. An optional declaration overrides a duplicate required dependency,
 *    including its canonical alias name and permitted absence.
 */
export const test_cli_scaffold_capture_package_dependency = (): void => {
  const { capturePackageDependency, assertCapturePackageDependencyCurrent } =
    unit;
  const dependency = {
    entry: "/installed/compiler/lib/index.js",
    ...capturePackageDependency({
      specifier: "compiler-alias",
      version: "npm:typescript@5.9.3",
    }),
  };
  TestValidator.equals(
    "alias retains import and canonical identities",
    dependency,
    {
      entry: "/installed/compiler/lib/index.js",
      optional: false,
      package: "typescript",
      specifier: "compiler-alias",
    },
  );
  TestValidator.equals(
    "optional declaration overrides the required alias",
    capturePackageDependency({
      specifier: "adapter",
      version: "npm:required-package@1",
      optionalVersion: "npm:@scope/optional-package@2",
    }),
    {
      optional: true,
      package: "@scope/optional-package",
      specifier: "adapter",
    },
  );
  TestValidator.equals(
    "non-string optional metadata does not replace a required declaration",
    capturePackageDependency({
      specifier: "adapter",
      version: "npm:required-package@1",
      optionalVersion: false,
    }),
    { optional: false, package: "required-package", specifier: "adapter" },
  );
  TestValidator.equals(
    "dependency name shapes",
    [
      undefined,
      3,
      "^1.0.0",
      "file:../pkg",
      "npm:plain",
      "npm:plain@next",
      "npm:@scope/name",
      "npm:@scope/name@^2.0.0",
    ].map(
      (version) =>
        capturePackageDependency({
          specifier: "import-name",
          version,
        }).package,
    ),
    [
      "import-name",
      "import-name",
      "import-name",
      "import-name",
      "plain",
      "plain",
      "@scope/name",
      "@scope/name",
    ],
  );
  for (const version of [
    "npm:",
    "npm:@scope",
    "npm:@scope/",
    "npm:plain@",
    "npm:bad name@1",
  ])
    TestValidator.equals(
      `malformed alias ${version}`,
      throwsError(
        () =>
          capturePackageDependency({
            specifier: "alias",
            version,
          }),
        "invalid npm alias",
      ),
      true,
    );
  const packages = [
    { entry: "/other", snapshot: { package: "typescript" } },
    { entry: dependency.entry, snapshot: { package: "different" } },
    { entry: dependency.entry, snapshot: { package: "typescript" } },
  ];
  assertCapturePackageDependencyCurrent({
    dependency,
    resolved: dependency.entry,
    packages,
  });
  for (const props of [
    {
      resolved: "/redirected",
      packages: [{ entry: "/redirected", snapshot: { package: "typescript" } }],
    },
    { resolved: dependency.entry, packages: packages.slice(0, 2) },
    { resolved: dependency.entry, packages: [] },
  ])
    TestValidator.equals(
      "changed binding refuses",
      throwsError(
        () => assertCapturePackageDependencyCurrent({ dependency, ...props }),
        "changed its resolved package generation",
      ),
      true,
    );
};
