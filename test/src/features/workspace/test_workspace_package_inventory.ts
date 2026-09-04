import { TestValidator } from "@nestia/e2e";

import {
  IWorkspacePackageDeclaration,
  IWorkspacePackageManifest,
  planWorkspacePackageInventory,
} from "../../../../build/workspacePackageInventory";

const declaration = (
  directory: string,
  key: string = directory,
  name: string = `@example/${directory}`,
): IWorkspacePackageDeclaration => ({
  key,
  directory,
  name,
  disposition: "pack",
});

const manifest = (
  directory: string,
  name: string = `@example/${directory}`,
  privatePackage: boolean = false,
): IWorkspacePackageManifest => ({
  directory,
  name,
  private: privatePackage,
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
      declaration("same-directory", "directory-one", "@example/directory-one"),
      declaration("same-directory", "directory-two", "@example/directory-two"),
      declaration("same-name-one", "name-one", "@example/same-name"),
      declaration("same-name-two", "name-two", "@example/same-name"),
      declaration("same-key-one", "same-key", "@example/same-key-one"),
      declaration("same-key-two", "same-key", "@example/same-key-two"),
    ],
    manifests: [
      manifest("same-directory", "@example/directory-one"),
      manifest("same-directory", "@example/directory-two"),
      manifest("same-name-one", "@example/same-name"),
      manifest("same-name-two", "@example/same-name"),
      manifest("same-key-one", "@example/same-key-one"),
      manifest("same-key-two", "@example/same-key-two"),
    ],
  });
  TestValidator.equals("duplicate identities", duplicates, {
    packages: [],
    excluded: [],
    diagnostics: [
      {
        code: "duplicate-declaration-directory",
        subject: "same-directory",
      },
      { code: "duplicate-declaration-name", subject: "@example/same-name" },
      { code: "duplicate-declaration-key", subject: "same-key" },
      { code: "duplicate-manifest-directory", subject: "same-directory" },
      { code: "duplicate-manifest-name", subject: "@example/same-name" },
    ],
  });

  TestValidator.equals(
    "empty inventory",
    planWorkspacePackageInventory({ declarations: [], manifests: [] }),
    { packages: [], excluded: [], diagnostics: [] },
  );
};
