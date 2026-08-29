import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  type IPackWorkspaceDependencies,
  type ITgzModule,
  loadBuildModule,
} from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

interface IPackCall {
  readonly destination: string;
  readonly directory: string;
}

interface IRecorder {
  readonly calls: string[];
  readonly dependencies: IPackWorkspaceDependencies;
  readonly messages: string[];
  readonly packs: IPackCall[];
  readonly renames: Array<readonly [string, string]>;
}

/**
 * A pack boundary that answers with the two published SHA-256 test vectors.
 *
 * The digests are not read back from `createHash`, which would only prove the
 * function agrees with itself. `sha256("")` and `sha256("abc")` are fixed
 * values, so a suffix computed over the wrong bytes (the reported path, the
 * package name, a re-read of a different file) cannot match by construction.
 */
const recorder = (): IRecorder => {
  const calls: string[] = [];
  const messages: string[] = [];
  const packs: IPackCall[] = [];
  const renames: Array<readonly [string, string]> = [];
  const dependencies: IPackWorkspaceDependencies = {
    remove: (directory) => calls.push(`remove:${directory}`),
    makeDirectory: (directory) => calls.push(`makeDirectory:${directory}`),
    pack: (directory, destination) => {
      packs.push({ destination, directory });
      const folder = path.basename(directory);
      // The command-line package publishes as `automovie`, so its tarball does
      // not follow the sibling pattern. Answering with the real asymmetry is
      // what proves the caller takes the path `pnpm pack` reports instead of
      // composing one from the directory it was handed.
      const reported =
        folder === "cli"
          ? "automovie-0.1.0.tgz"
          : `automovie-${folder}-0.1.0.tgz`;
      return {
        status: 0,
        stdout: [
          "Tarball Contents",
          "package.json",
          "",
          "Tarball Details",
          `  ${path.join(destination, reported)}  `,
          "",
        ].join("\r\n"),
      };
    },
    exists: () => true,
    // `interface` answers with the empty vector and every other package with
    // the `abc` vector, so one run distinguishes a per-file digest from a
    // constant one.
    read: (file) =>
      Buffer.from(path.basename(file).includes("-interface-") ? "" : "abc"),
    rename: (source, target) => renames.push([source, target]),
    write: (message) => messages.push(message),
  };
  return { calls, dependencies, messages, packs, renames };
};

/**
 * `packWorkspace` packs the closed workspace set and names each tarball by its
 * own content digest.
 *
 * The inventory is the contract: `pnpm pack` rewrites a packed package's
 * `workspace:^` range into plain semver, so any member left out of this set is
 * resolved from the public registry at a version this monorepo never published,
 * and the install dies on a 404 one package later than the omission. The digest
 * is the other half: `file:` specifiers are keyed by path, so a rebuilt package
 * under an unchanged version leaves an existing sandbox installed against stale
 * bytes unless the filename moves.
 *
 * Scenarios:
 *
 * 1. The destination is cleared before it is created, in that order, so a
 *    previous run's tarballs cannot survive into this one's specifier set.
 * 2. Every entry of `PACKAGES` is packed once, in declaration order, from
 *    `packages/<directory>` and into the single `.tarballs` destination.
 * 3. `automovie` and `@automovie/interface` both appear, pinning the case where
 *    the published name and the directory disagree.
 * 4. The renamed filename carries the first twelve hex digits of the SHA-256 of
 *    the tarball's own bytes: `e3b0c44298fc` for the empty vector that
 *    `interface` answers with, `ba7816bf8f01` for the `abc` vector every other
 *    package answers with.
 * 5. Each returned specifier is the relative `file:./.tarballs/<final>` form,
 *    keyed by the package's short key rather than its published name.
 * 6. One progress line is written per package, naming the published name.
 */
const assertBuildTgzPackWorkspace = async (): Promise<void> => {
  const { PACKAGES, packWorkspace } =
    await loadBuildModule<ITgzModule>("tgz.ts");
  const target = path.join(ROOT, "node_modules", ".cache", "unit-target");
  const directory = path.join(target, ".tarballs");
  const { calls, dependencies, messages, packs, renames } = recorder();
  const specifiers = packWorkspace(target, dependencies);

  const interfaceFinal = "automovie-interface-0.1.0-e3b0c44298fc.tgz";
  const engineFinal = "automovie-engine-0.1.0-ba7816bf8f01.tgz";

  TestValidator.equals(
    "packWorkspace packs the closed set into digest-named tarballs",
    namedFacts([
      [
        "clears before creating",
        () =>
          calls.join("|") === `remove:${directory}|makeDirectory:${directory}`,
      ],
      ["packs every member once", () => packs.length === PACKAGES.length],
      [
        "packs each package directory into the one destination",
        () =>
          packs.every(
            (call, index) =>
              call.directory ===
                path.join(ROOT, "packages", PACKAGES[index]!.directory) &&
              call.destination === directory,
          ),
      ],
      [
        "keeps the published name beside the directory",
        () =>
          PACKAGES.some(
            (entry) => entry.name === "automovie" && entry.directory === "cli",
          ) &&
          PACKAGES.some(
            (entry) =>
              entry.name === "@automovie/interface" &&
              entry.directory === "interface",
          ),
      ],
      [
        "renames onto the empty-vector digest",
        () =>
          renames[0]![0] ===
            path.join(directory, "automovie-interface-0.1.0.tgz") &&
          renames[0]![1] === path.join(directory, interfaceFinal),
      ],
      [
        "renames onto the abc-vector digest",
        () => renames[1]![1] === path.join(directory, engineFinal),
      ],
      [
        "returns relative file specifiers keyed by short key",
        () =>
          specifiers["interface"] === `file:./.tarballs/${interfaceFinal}` &&
          specifiers["engine"] === `file:./.tarballs/${engineFinal}` &&
          specifiers["cli"] ===
            "file:./.tarballs/automovie-0.1.0-ba7816bf8f01.tgz",
      ],
      [
        "reports one packed package per line",
        () =>
          messages.length === PACKAGES.length &&
          messages[0] === "Packing @automovie/interface\n" &&
          messages[PACKAGES.length - 1] === "Packing automovie\n",
      ],
    ]),
    {
      "clears before creating": true,
      "packs every member once": true,
      "packs each package directory into the one destination": true,
      "keeps the published name beside the directory": true,
      "renames onto the empty-vector digest": true,
      "renames onto the abc-vector digest": true,
      "returns relative file specifiers keyed by short key": true,
      "reports one packed package per line": true,
    },
  );
};

/** Exercise the closed workspace pack set and its digest naming through a runner that can load the build tools. */
export const test_build_tgz_pack_workspace = (): void => {
  runBuildScenarioChild(__filename, "test_build_tgz_pack_workspace");
};

runWhenBuildScenarioChild(
  "test_build_tgz_pack_workspace",
  assertBuildTgzPackWorkspace,
);
