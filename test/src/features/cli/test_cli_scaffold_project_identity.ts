import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

const identity = loadSourceModule<{
  selectAutoMovieProjectProductionId: (props: {
    packageName: string;
    registered: readonly string[] | null;
    hasOwnedState: boolean;
  }) => { kind: "fresh-seed" | "registered"; productionId: string };
  readAutoMovieProjectProductionId: (root: string) => string;
  openAutoMovieProjectProduction: (root: string) => { productionId: string };
  openAutoMovieProjectProductionReadOnly: (root: string) => {
    productionId: string;
  };
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/projectIdentity.ts",
  ),
);

/** A valid registry with no production, which only recovery may repair. */
const EMPTY_REGISTRY = JSON.stringify({
  version: 1,
  layoutVersion: 1,
  productions: [],
  incarnations: {},
});

/**
 * One disposable project root; `null` writes a directory, a string a file.
 */
const scratch = (
  files: Readonly<Record<string, string | null>>,
  roots: string[],
): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-identity-"));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, ...relative.split("/"));
    if (content === null) fs.mkdirSync(absolute, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content, "utf8");
    }
  }
  return root;
};

const manifest = (name: string): string => JSON.stringify({ name });
const registryOf = (root: string): string =>
  fs.readFileSync(path.join(root, "automovie", "productions.json"), "utf8");
const exists = (root: string, relative: string): boolean =>
  fs.existsSync(path.join(root, ...relative.split("/")));

/**
 * Package identity seeds only a fresh generated production namespace.
 *
 * Scenarios:
 *
 * 1. The pure selector seeds a fresh project from the package name, keeps the
 *    one registered production across a rename, and refuses orphaned state, an
 *    empty registry, and an ambiguous registry.
 * 2. The strict read refuses an unreadable, non-JSON, non-object, or nameless
 *    manifest and a corrupt registry, seeds a fresh or lone-incarnation
 *    project, leaves the store's legacy layout to the store, and refuses
 *    orphaned production, generated, and design state while ignoring empty
 *    directories and `.gitkeep` placeholders.
 * 3. On a real disposable project the mutable wrapper registers the package
 *    seed once, an ordinary rename to `B` keeps selecting `A` with identical
 *    registry bytes and no `B` namespace, the read-only wrapper agrees, a
 *    revert changes nothing, an explicit sibling registration through the
 *    public store API turns implicit selection into a refusal, and a fresh
 *    project is refused read-only by the store rather than initialized.
 */
export const test_cli_scaffold_project_identity = (): void => {
  const roots: string[] = [];
  try {
    TestValidator.equals(
      "generated production selection preserves the stable registry owner",
      namedFacts([
        [
          "freshUsesPackageSeed",
          () =>
            JSON.stringify(
              identity.selectAutoMovieProjectProductionId({
                packageName: "B",
                registered: null,
                hasOwnedState: false,
              }),
            ) === '{"kind":"fresh-seed","productionId":"B"}',
        ],
        [
          "renameKeepsRegisteredOwner",
          () =>
            JSON.stringify(
              identity.selectAutoMovieProjectProductionId({
                packageName: "B",
                registered: ["A"],
                hasOwnedState: true,
              }),
            ) === '{"kind":"registered","productionId":"A"}',
        ],
        [
          "orphanStateRefused",
          () =>
            throwsError(
              () =>
                identity.selectAutoMovieProjectProductionId({
                  packageName: "B",
                  registered: null,
                  hasOwnedState: true,
                }),
              "state exists without a valid registry",
            ),
        ],
        [
          "emptyRegistryRefused",
          () =>
            throwsError(
              () =>
                identity.selectAutoMovieProjectProductionId({
                  packageName: "B",
                  registered: [],
                  hasOwnedState: true,
                }),
              "registry is empty",
            ),
        ],
        [
          "multipleProductionsRefused",
          () =>
            throwsError(
              () =>
                identity.selectAutoMovieProjectProductionId({
                  packageName: "B",
                  registered: ["A", "B"],
                  hasOwnedState: true,
                }),
              "require an explicit production selection",
            ),
        ],
      ]),
      {
        freshUsesPackageSeed: true,
        renameKeepsRegisteredOwner: true,
        orphanStateRefused: true,
        emptyRegistryRefused: true,
        multipleProductionsRefused: true,
      },
    );

    const read = (files: Readonly<Record<string, string | null>>): string =>
      identity.readAutoMovieProjectProductionId(scratch(files, roots));
    TestValidator.equals(
      "the strict read refuses what the store must not seed around",
      namedFacts([
        [
          "unreadableManifestRefused",
          () => throwsError(() => read({}), "is unreadable"),
        ],
        [
          "invalidJsonManifestRefused",
          () =>
            throwsError(() => read({ "package.json": "{" }), "not valid JSON"),
        ],
        [
          "arrayManifestRefused",
          () =>
            throwsError(
              () => read({ "package.json": "[]" }),
              "not a JSON object",
            ),
        ],
        [
          "untrimmedNameRefused",
          () =>
            throwsError(
              () => read({ "package.json": manifest(" a ") }),
              'trimmed non-empty "name"',
            ),
        ],
        [
          "freshProjectSeedsPackageName",
          () =>
            read({
              "package.json": manifest("A"),
              "automovie/design/.gitkeep": "",
              "automovie/design/shared/.gitkeep": "",
              generated: null,
            }) === "A",
        ],
        [
          "loneIncarnationStillSeeds",
          () =>
            read({
              "package.json": manifest("A"),
              "automovie/incarnation.json": '{"version":1,"id":"x"}',
            }) === "A",
        ],
        [
          "legacyLayoutLeftToStore",
          () =>
            read({
              "package.json": manifest("A"),
              "automovie/design/production.json": '{"id":"legacy"}',
              "automovie/design/shots/old.json": "{}",
            }) === "A",
        ],
        [
          "orphanProductionStateRefused",
          () =>
            throwsError(
              () =>
                read({
                  "package.json": manifest("B"),
                  "automovie/productions/A/revision.json": "{}",
                }),
              "state exists without a valid registry",
            ),
        ],
        [
          "orphanGeneratedStateRefused",
          () =>
            throwsError(
              () =>
                read({
                  "package.json": manifest("B"),
                  "generated/A/manifest.json": "{}",
                }),
              "state exists without a valid registry",
            ),
        ],
        [
          "orphanSharedDesignRefused",
          () =>
            throwsError(
              () =>
                read({
                  "package.json": manifest("B"),
                  "automovie/design/shared/models": null,
                }),
              "state exists without a valid registry",
            ),
        ],
        [
          "orphanProductionDesignRefused",
          () =>
            throwsError(
              () =>
                read({
                  "package.json": manifest("B"),
                  "automovie/design/A/production.json": '{"id":"A"}',
                }),
              "state exists without a valid registry",
            ),
        ],
        [
          "corruptRegistryRefused",
          () =>
            throwsError(
              () =>
                read({
                  "package.json": manifest("A"),
                  "automovie/productions.json": "{",
                }),
              "unreadable or invalid",
            ),
        ],
        [
          "emptyRealRegistryRefused",
          () =>
            throwsError(
              () =>
                read({
                  "package.json": manifest("A"),
                  "automovie/productions.json": EMPTY_REGISTRY,
                }),
              "registry is empty",
            ),
        ],
      ]),
      {
        unreadableManifestRefused: true,
        invalidJsonManifestRefused: true,
        arrayManifestRefused: true,
        untrimmedNameRefused: true,
        freshProjectSeedsPackageName: true,
        loneIncarnationStillSeeds: true,
        legacyLayoutLeftToStore: true,
        orphanProductionStateRefused: true,
        orphanGeneratedStateRefused: true,
        orphanSharedDesignRefused: true,
        orphanProductionDesignRefused: true,
        corruptRegistryRefused: true,
        emptyRealRegistryRefused: true,
      },
    );

    const project = scratch({ "package.json": manifest("A") }, roots);
    const fresh = scratch({ "package.json": manifest("A") }, roots);
    const empty = scratch(
      {
        "package.json": manifest("A"),
        "automovie/productions.json": EMPTY_REGISTRY,
      },
      roots,
    );
    let registryAfterSeed = "";
    TestValidator.equals(
      "an ordinary package rename never registers a second production",
      namedFacts([
        [
          "mutableOpenRegistersSeedOnce",
          () => {
            const opened = identity.openAutoMovieProjectProduction(project);
            registryAfterSeed = registryOf(project);
            return (
              opened.productionId === "A" &&
              JSON.stringify(
                AutoMovieProductionProject.registeredProductionIds(project),
              ) === '["A"]'
            );
          },
        ],
        [
          "renamedPackageStillReadsRegisteredOwner",
          () => {
            fs.writeFileSync(
              path.join(project, "package.json"),
              manifest("B"),
              "utf8",
            );
            return identity.readAutoMovieProjectProductionId(project) === "A";
          },
        ],
        [
          "renamedPackageOpensRegisteredOwner",
          () =>
            identity.openAutoMovieProjectProduction(project).productionId ===
            "A",
        ],
        [
          "renamedPackageOpensReadOnlyOwner",
          () =>
            identity.openAutoMovieProjectProductionReadOnly(project)
              .productionId === "A",
        ],
        [
          "renameLeavesRegistryAndIncarnationBytes",
          () => registryOf(project) === registryAfterSeed,
        ],
        [
          "renameMaterializesNoSecondNamespace",
          () =>
            exists(project, "automovie/design/A") &&
            exists(project, "automovie/productions/A") &&
            exists(project, "automovie/design/B") === false &&
            exists(project, "automovie/productions/B") === false &&
            exists(project, "generated/B") === false,
        ],
        [
          "revertChangesNothing",
          () => {
            fs.writeFileSync(
              path.join(project, "package.json"),
              manifest("A"),
              "utf8",
            );
            return (
              identity.openAutoMovieProjectProduction(project).productionId ===
                "A" && registryOf(project) === registryAfterSeed
            );
          },
        ],
        [
          "explicitSiblingTurnsImplicitSelectionIntoRefusal",
          () => {
            AutoMovieProductionProject.open(project, "second");
            return (
              JSON.stringify(
                AutoMovieProductionProject.registeredProductionIds(project),
              ) === '["A","second"]' &&
              throwsError(
                () => identity.readAutoMovieProjectProductionId(project),
                "require an explicit production selection",
              ) &&
              throwsError(
                () => identity.openAutoMovieProjectProduction(project),
                "require an explicit production selection",
              ) &&
              throwsError(
                () => identity.openAutoMovieProjectProductionReadOnly(project),
                "require an explicit production selection",
              )
            );
          },
        ],
        [
          "freshProjectIsRefusedReadOnlyByStore",
          () =>
            throwsError(
              () => identity.openAutoMovieProjectProductionReadOnly(fresh),
              "read-only verification",
            ) && exists(fresh, "automovie") === false,
        ],
        [
          "emptyRegistryRefusedBeforeStoreSeeds",
          () =>
            throwsError(
              () => identity.openAutoMovieProjectProduction(empty),
              "registry is empty",
            ) && registryOf(empty) === EMPTY_REGISTRY,
        ],
      ]),
      {
        mutableOpenRegistersSeedOnce: true,
        renamedPackageStillReadsRegisteredOwner: true,
        renamedPackageOpensRegisteredOwner: true,
        renamedPackageOpensReadOnlyOwner: true,
        renameLeavesRegistryAndIncarnationBytes: true,
        renameMaterializesNoSecondNamespace: true,
        revertChangesNothing: true,
        explicitSiblingTurnsImplicitSelectionIntoRefusal: true,
        freshProjectIsRefusedReadOnlyByStore: true,
        emptyRegistryRefusedBeforeStoreSeeds: true,
      },
    );
  } finally {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  }
};
