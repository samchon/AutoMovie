export interface IWorkspacePackage {
  readonly key: string;
  readonly directory: string;
  readonly name: string;
}

export type IWorkspacePackageDeclaration =
  | (IWorkspacePackage & {
      readonly disposition: "pack";
    })
  | {
      readonly directory: string;
      readonly name: string;
      readonly disposition: "exclude";
      readonly reason: string;
    };

export interface IWorkspacePackageManifest {
  readonly directory: string;
  readonly name: string;
  readonly private: boolean;
  /**
   * Every runtime dependency name the manifest declares: `dependencies`,
   * `optionalDependencies`, and `peerDependencies`. Development dependencies
   * are not packed and therefore not listed.
   */
  readonly dependencies: readonly string[];
}

export interface IWorkspacePackageExclusion {
  readonly directory: string;
  readonly name: string;
  readonly private: boolean;
  readonly reason: string;
}

export type WorkspacePackageInventoryDiagnosticCode =
  | "duplicate-declaration-directory"
  | "duplicate-declaration-key"
  | "duplicate-declaration-name"
  | "duplicate-manifest-directory"
  | "duplicate-manifest-name"
  | "manifest-name-mismatch"
  | "missing-workspace-package"
  | "private-package-selected"
  | "undeclared-workspace-package"
  | "unpacked-workspace-dependency";

export interface IWorkspacePackageInventoryDiagnostic {
  readonly code: WorkspacePackageInventoryDiagnosticCode;
  readonly subject: string;
}

export interface IWorkspacePackageInventoryPlan {
  readonly packages: readonly IWorkspacePackage[];
  readonly excluded: readonly IWorkspacePackageExclusion[];
  readonly diagnostics: readonly IWorkspacePackageInventoryDiagnostic[];
}

/**
 * The complete package-directory inventory owned by the repository tarball build.
 *
 * A generated production receives only its closed runtime and authoring graph.
 * Public packages outside that graph are still declared here so adding or
 * renaming a workspace package cannot silently change the archive population.
 */
export const AUTOMOVIE_PACKAGE_INVENTORY = Object.freeze([
  {
    key: "interface",
    directory: "interface",
    name: "@automovie/interface",
    disposition: "pack",
  },
  {
    key: "engine",
    directory: "engine",
    name: "@automovie/engine",
    disposition: "pack",
  },
  {
    key: "archetypes",
    directory: "archetypes",
    name: "@automovie/archetypes",
    disposition: "pack",
  },
  {
    key: "evidence",
    directory: "evidence",
    name: "@automovie/evidence",
    disposition: "pack",
  },
  {
    key: "render",
    directory: "render",
    name: "@automovie/render",
    disposition: "pack",
  },
  {
    key: "ingest",
    directory: "ingest",
    name: "@automovie/ingest",
    disposition: "pack",
  },
  {
    key: "viewer",
    directory: "viewer",
    name: "@automovie/viewer",
    disposition: "pack",
  },
  {
    key: "production",
    directory: "production",
    name: "@automovie/production",
    disposition: "pack",
  },
  {
    key: "template",
    directory: "template",
    name: "@automovie/template",
    disposition: "pack",
  },
  {
    key: "cli",
    directory: "cli",
    name: "automovie",
    disposition: "pack",
  },
  {
    directory: "create-automovie",
    name: "create-automovie",
    disposition: "exclude",
    reason:
      "the creator is the front door, not a generated project's dependency",
  },
  {
    directory: "face",
    name: "@automovie/face",
    disposition: "exclude",
    reason: "the dormant compatibility package is outside the scaffold graph",
  },
  {
    directory: "playground",
    name: "@automovie/playground",
    disposition: "exclude",
    reason: "the private repository application is not publishable",
  },
] satisfies readonly IWorkspacePackageDeclaration[]);

const frequencies = (
  values: readonly string[],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
};

const repeated = (
  counts: ReadonlyMap<string, number>,
  value: string,
): boolean => (counts.get(value) ?? 0) > 1;

/**
 * Resolve a declared archive population against package manifests without I/O.
 *
 * The plan keeps exclusions observable and returns every identity fault instead
 * of beginning a partial pack. The command adapter decides how to present and
 * fail those diagnostics after it has read the workspace manifests.
 *
 * The packed set must also be closed under workspace dependencies. `pnpm pack`
 * rewrites a `workspace:^` range to a plain semver range, so a packed package
 * whose runtime dependency is a workspace member left out of the archive would
 * be resolved from the public registry at a version this monorepo has never
 * published. The comment on the archive population promised that closure for
 * years while nothing checked it; `unpacked-workspace-dependency` names the
 * packed package and the member it needs, whether that member is excluded or
 * undeclared. A dependency on a name no manifest carries is an external
 * package and is not the inventory's concern.
 */
export const planWorkspacePackageInventory = (props: {
  readonly declarations: readonly IWorkspacePackageDeclaration[];
  readonly manifests: readonly IWorkspacePackageManifest[];
}): IWorkspacePackageInventoryPlan => {
  const declarationDirectories = frequencies(
    props.declarations.map((entry) => entry.directory),
  );
  const declarationNames = frequencies(
    props.declarations.map((entry) => entry.name),
  );
  const declarationKeys = frequencies(
    props.declarations.flatMap((entry) =>
      entry.disposition === "pack" ? [entry.key] : [],
    ),
  );
  const manifestDirectories = frequencies(
    props.manifests.map((entry) => entry.directory),
  );
  const manifestNames = frequencies(props.manifests.map((entry) => entry.name));
  const manifestsByDirectory = new Map(
    props.manifests.map((entry) => [entry.directory, entry] as const),
  );
  const declaredDirectories = new Set(
    props.declarations.map((entry) => entry.directory),
  );
  const diagnostics: IWorkspacePackageInventoryDiagnostic[] = [];
  const packages: IWorkspacePackage[] = [];
  const excluded: IWorkspacePackageExclusion[] = [];
  const missingDirectories = new Set<string>();
  const undeclaredDirectories = new Set<string>();

  for (const [subject, count] of declarationDirectories)
    if (count > 1)
      diagnostics.push({ code: "duplicate-declaration-directory", subject });
  for (const [subject, count] of declarationNames)
    if (count > 1)
      diagnostics.push({ code: "duplicate-declaration-name", subject });
  for (const [subject, count] of declarationKeys)
    if (count > 1)
      diagnostics.push({ code: "duplicate-declaration-key", subject });
  for (const [subject, count] of manifestDirectories)
    if (count > 1)
      diagnostics.push({ code: "duplicate-manifest-directory", subject });
  for (const [subject, count] of manifestNames)
    if (count > 1)
      diagnostics.push({ code: "duplicate-manifest-name", subject });

  for (const declaration of props.declarations) {
    const manifest = manifestsByDirectory.get(declaration.directory);
    if (manifest === undefined) {
      if (!missingDirectories.has(declaration.directory)) {
        missingDirectories.add(declaration.directory);
        diagnostics.push({
          code: "missing-workspace-package",
          subject: declaration.directory,
        });
      }
      continue;
    }
    if (
      repeated(declarationDirectories, declaration.directory) ||
      repeated(declarationNames, declaration.name) ||
      (declaration.disposition === "pack" &&
        repeated(declarationKeys, declaration.key)) ||
      repeated(manifestDirectories, manifest.directory) ||
      repeated(manifestNames, manifest.name)
    )
      continue;
    if (manifest.name !== declaration.name) {
      diagnostics.push({
        code: "manifest-name-mismatch",
        subject: `${declaration.directory}:${manifest.name}`,
      });
      continue;
    }
    if (declaration.disposition === "exclude") {
      excluded.push({
        directory: manifest.directory,
        name: manifest.name,
        private: manifest.private,
        reason: declaration.reason,
      });
      continue;
    }
    if (manifest.private) {
      diagnostics.push({
        code: "private-package-selected",
        subject: declaration.directory,
      });
      continue;
    }
    packages.push({
      key: declaration.key,
      directory: declaration.directory,
      name: declaration.name,
    });
  }

  for (const manifest of props.manifests)
    if (
      !declaredDirectories.has(manifest.directory) &&
      !undeclaredDirectories.has(manifest.directory)
    ) {
      undeclaredDirectories.add(manifest.directory);
      diagnostics.push({
        code: "undeclared-workspace-package",
        subject: manifest.directory,
      });
    }

  const packedNames = new Set(packages.map((entry) => entry.name));
  for (const entry of packages) {
    const manifest = manifestsByDirectory.get(entry.directory)!;
    for (const dependency of manifest.dependencies)
      if (manifestNames.has(dependency) && !packedNames.has(dependency))
        diagnostics.push({
          code: "unpacked-workspace-dependency",
          subject: `${entry.directory}:${dependency}`,
        });
  }

  return { packages, excluded, diagnostics };
};
