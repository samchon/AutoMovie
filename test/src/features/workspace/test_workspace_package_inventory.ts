import { TestValidator } from "@nestia/e2e";

const inventoryModule = [
  "..",
  "..",
  "..",
  "..",
  "build",
  "workspacePackageInventory",
].join("/");
interface IPlan {
  readonly packages: ReadonlyArray<{
    readonly key: string;
    readonly directory: string;
    readonly name: string;
  }>;
  readonly excluded: ReadonlyArray<{
    readonly directory: string;
    readonly name: string;
    readonly private: boolean;
    readonly reason: string;
  }>;
  readonly diagnostics: ReadonlyArray<{
    readonly code: string;
    readonly subject: string;
  }>;
}
const planWorkspacePackageInventory = (
  require(inventoryModule) as {
    readonly planWorkspacePackageInventory: (props: unknown) => IPlan;
  }
).planWorkspacePackageInventory;

const declaration = (
  directory: string,
  key: string = directory,
  name: string = `@example/${directory}`,
): {
  readonly key: string;
  readonly directory: string;
  readonly name: string;
  readonly disposition: "pack";
} => ({
  key,
  directory,
  name,
  disposition: "pack",
});

const manifest = (
  directory: string,
  name: string = `@example/${directory}`,
  privatePackage: boolean = false,
  dependencies: readonly string[] = [],
): {
  readonly directory: string;
  readonly name: string;
  readonly private: boolean;
  readonly dependencies: readonly string[];
} => ({
  directory,
  name,
  private: privatePackage,
  dependencies,
});

/**
 * The package archive inventory resolves a typed declaration without host state.
 *
 * Scenarios:
 *
 * 1. Included and deliberately excluded packages remain separate observable
 *    populations.
 * 2. Missing, undeclared, renamed, and private selected packages fail closed.
 * 3. Duplicate declaration and manifest identities are reported rather than
 *    producing an ambiguous archive plan.
 * 4. An empty declared workspace produces an empty plan.
 * 5. The packed set is closed under workspace dependencies: a packed package
 *    that depends on an excluded or undeclared workspace member is refused
 *    with the member named, while a packed dependency, an external dependency,
 *    and an excluded package's own dependencies raise nothing.
 */
export const test_workspace_package_inventory = (): void => {
  const planned = planWorkspacePackageInventory({
    declarations: [
      declaration("runtime", "runtime", "@example/runtime"),
      {
        directory: "application",
        name: "@example/application",
        disposition: "exclude",
        reason: "private application",
      },
    ],
    manifests: [
      manifest("runtime", "@example/runtime"),
      manifest("application", "@example/application", true),
    ],
  });
  TestValidator.equals("valid inventory plan", planned, {
    packages: [
      {
        key: "runtime",
        directory: "runtime",
        name: "@example/runtime",
      },
    ],
    excluded: [
      {
        directory: "application",
        name: "@example/application",
        private: true,
        reason: "private application",
      },
    ],
    diagnostics: [],
  });

  const invalid = planWorkspacePackageInventory({
    declarations: [
      declaration("missing"),
      declaration("renamed"),
      declaration("private"),
    ],
    manifests: [
      manifest("renamed", "@example/other-name"),
      manifest("private", "@example/private", true),
      manifest("extra"),
    ],
  });
  TestValidator.equals("identity failures", invalid, {
    packages: [],
    excluded: [],
    diagnostics: [
      { code: "missing-workspace-package", subject: "missing" },
      {
        code: "manifest-name-mismatch",
        subject: "renamed:@example/other-name",
      },
      { code: "private-package-selected", subject: "private" },
      { code: "undeclared-workspace-package", subject: "extra" },
    ],
  });

  const duplicates = planWorkspacePackageInventory({
    declarations: [
      declaration(
        "same-declaration-directory",
        "directory-one",
        "@example/directory-one",
      ),
      declaration(
        "same-declaration-directory",
        "directory-two",
        "@example/directory-two",
      ),
      declaration(
        "missing-duplicate-directory",
        "missing-directory-one",
        "@example/missing-directory-one",
      ),
      declaration(
        "missing-duplicate-directory",
        "missing-directory-two",
        "@example/missing-directory-two",
      ),
      declaration(
        "same-declaration-name-one",
        "name-one",
        "@example/same-declaration-name",
      ),
      declaration(
        "same-declaration-name-two",
        "name-two",
        "@example/same-declaration-name",
      ),
      declaration("same-key-one", "same-key", "@example/same-key-one"),
      declaration("same-key-two", "same-key", "@example/same-key-two"),
      declaration(
        "same-manifest-directory",
        "manifest-directory",
        "@example/manifest-directory",
      ),
      declaration(
        "same-manifest-name-one",
        "manifest-name-one",
        "@example/manifest-name-one",
      ),
      declaration(
        "same-manifest-name-two",
        "manifest-name-two",
        "@example/manifest-name-two",
      ),
    ],
    manifests: [
      manifest("same-declaration-directory", "@example/directory-one"),
      manifest("same-declaration-name-one", "@example/actual-name-one"),
      manifest("same-declaration-name-two", "@example/actual-name-two"),
      manifest("same-key-one", "@example/same-key-one"),
      manifest("same-key-two", "@example/same-key-two"),
      manifest("same-manifest-directory", "@example/manifest-directory"),
      manifest("same-manifest-directory", "@example/manifest-directory-copy"),
      manifest("same-manifest-name-one", "@example/shared-manifest-name"),
      manifest("same-manifest-name-two", "@example/shared-manifest-name"),
      manifest("same-undeclared-directory", "@example/undeclared-one"),
      manifest("same-undeclared-directory", "@example/undeclared-two"),
    ],
  });
  TestValidator.equals("duplicate identities", duplicates, {
    packages: [],
    excluded: [],
    diagnostics: [
      {
        code: "duplicate-declaration-directory",
        subject: "same-declaration-directory",
      },
      {
        code: "duplicate-declaration-directory",
        subject: "missing-duplicate-directory",
      },
      {
        code: "duplicate-declaration-name",
        subject: "@example/same-declaration-name",
      },
      { code: "duplicate-declaration-key", subject: "same-key" },
      {
        code: "duplicate-manifest-directory",
        subject: "same-manifest-directory",
      },
      {
        code: "duplicate-manifest-directory",
        subject: "same-undeclared-directory",
      },
      {
        code: "duplicate-manifest-name",
        subject: "@example/shared-manifest-name",
      },
      {
        code: "missing-workspace-package",
        subject: "missing-duplicate-directory",
      },
      {
        code: "undeclared-workspace-package",
        subject: "same-undeclared-directory",
      },
    ],
  });

  TestValidator.equals(
    "empty inventory",
    planWorkspacePackageInventory({ declarations: [], manifests: [] }),
    { packages: [], excluded: [], diagnostics: [] },
  );

  const closed = planWorkspacePackageInventory({
    declarations: [
      declaration("core"),
      declaration("runtime"),
      {
        directory: "application",
        name: "@example/application",
        disposition: "exclude",
        reason: "private application",
      },
    ],
    manifests: [
      manifest("core", "@example/core", false, ["typescript"]),
      manifest("runtime", "@example/runtime", false, [
        "@example/core",
        "three",
      ]),
      manifest("application", "@example/application", true, [
        "@example/runtime",
        "@example/nowhere",
      ]),
    ],
  });
  TestValidator.equals("closed packed set", closed.diagnostics, []);
  TestValidator.equals(
    "closed packed set keeps its packages",
    closed.packages.map((entry) => entry.key),
    ["core", "runtime"],
  );

  const open = planWorkspacePackageInventory({
    declarations: [
      declaration("runtime"),
      {
        directory: "creator",
        name: "@example/creator",
        disposition: "exclude",
        reason: "front door",
      },
    ],
    manifests: [
      manifest("runtime", "@example/runtime", false, [
        "@example/creator",
        "@example/extra",
        "left-pad",
      ]),
      manifest("creator", "@example/creator"),
      manifest("extra"),
    ],
  });
  TestValidator.equals("open packed set", open.diagnostics, [
    { code: "undeclared-workspace-package", subject: "extra" },
    {
      code: "unpacked-workspace-dependency",
      subject: "runtime:@example/creator",
    },
    {
      code: "unpacked-workspace-dependency",
      subject: "runtime:@example/extra",
    },
  ]);
};
