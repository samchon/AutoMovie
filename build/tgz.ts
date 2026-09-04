import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  AUTOMOVIE_PACKAGE_INVENTORY,
  type IWorkspacePackage,
  type IWorkspacePackageManifest,
  planWorkspacePackageInventory,
} from "./workspacePackageInventory";

export {
  AUTOMOVIE_PACKAGE_INVENTORY,
  planWorkspacePackageInventory,
} from "./workspacePackageInventory";
export type {
  IWorkspacePackage,
  IWorkspacePackageManifest,
} from "./workspacePackageInventory";

const ROOT = path.resolve(__dirname, "..");

export interface IPackWorkspaceDependencies {
  readonly remove: (directory: string) => void;
  readonly makeDirectory: (directory: string) => void;
  readonly makeTemporaryDirectory: (prefix: string) => string;
  readonly pack: (
    directory: string,
    destination: string,
  ) => { readonly status: number | null; readonly stdout: string };
  readonly exists: (file: string) => boolean;
  readonly read: (file: string) => Buffer;
  readonly rename: (source: string, target: string) => void;
  readonly write: (message: string) => unknown;
}

/**
 * Quote a path that is about to be joined into a Windows shell command line.
 *
 * `spawnSync` needs `shell: true` on Windows because `pnpm` is a `.CMD` shim
 * Node refuses to execute directly, and a shell invocation discards the
 * argument array: Node joins `file` and `args` with single spaces and hands
 * `cmd.exe` one string, so it is the caller's job to quote. Unquoted, a
 * destination under `C:\Users\John Doe\...` reached `pnpm` as
 * `--pack-destination C:\Users\John` plus two stray positionals, and the
 * measured result was worse than a crash: `pnpm pack` exited 0 and reported a
 * tarball written to the truncated path, so every downstream check passed while
 * bytes landed outside the requested directory.
 *
 * Windows forbids `"` in a path, so wrapping is total there; POSIX keeps the
 * argument array and must not be quoted, because the quotes would become part
 * of the path.
 */
export const shellArgument = (value: string, shell: boolean): string =>
  shell ? `"${value}"` : value;

export const packWorkspaceDependencies: IPackWorkspaceDependencies = {
  remove: (directory) => fs.rmSync(directory, { recursive: true, force: true }),
  makeDirectory: (directory) => fs.mkdirSync(directory, { recursive: true }),
  makeTemporaryDirectory: (prefix) => fs.mkdtempSync(prefix),
  pack: (directory, destination) => {
    const shell = process.platform === "win32";
    const result = spawnSync(
      "pnpm",
      ["pack", "--pack-destination", shellArgument(destination, shell)],
      {
        cwd: directory,
        stdio: ["ignore", "pipe", "inherit"],
        encoding: "utf8",
        shell,
      },
    );
    return { status: result.status, stdout: result.stdout };
  },
  exists: fs.existsSync,
  read: fs.readFileSync,
  rename: fs.renameSync,
  write: (message) => process.stdout.write(message),
};

/** Read every direct `packages/*` manifest before archive planning. */
const workspacePackageManifests = (): IWorkspacePackageManifest[] =>
  fs
    .readdirSync(path.join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const manifestPath = path.join(
        ROOT,
        "packages",
        entry.name,
        "package.json",
      );
      if (fs.existsSync(manifestPath) === false) return [];
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        name?: unknown;
        private?: unknown;
      };
      return [
        {
          directory: entry.name,
          name: typeof manifest.name === "string" ? manifest.name : "",
          private: manifest.private === true,
        },
      ];
    });

/** The declared archive population reconciled with every `packages/*` manifest. */
export const WORKSPACE_PACKAGE_INVENTORY_PLAN = planWorkspacePackageInventory({
  declarations: AUTOMOVIE_PACKAGE_INVENTORY,
  manifests: workspacePackageManifests(),
});

if (WORKSPACE_PACKAGE_INVENTORY_PLAN.diagnostics.length !== 0)
  throw new Error(
    `Workspace package inventory refused:\n${WORKSPACE_PACKAGE_INVENTORY_PLAN.diagnostics
      .map(({ code, subject }) => `${code}: ${subject}`)
      .join("\n")}`,
  );

/**
 * The workspace packages a sandbox installs, dependencies before consumers.
 *
 * This is the scaffold's own set (`WORKSPACE_TEMPLATE_VERSION_KEYS`) closed
 * under `@automovie/*` dependencies, which adds `ingest` and `render` through
 * `production`. Each entry carries the published name beside the directory
 * because the two stopped agreeing: the command-line package lives in
 * `packages/cli` and publishes as `automovie`. Deriving one from the other
 * looked for a tarball nobody produces and pinned a dependency nobody
 * publishes. The closure matters because `pnpm pack` rewrites a `workspace:^`
 * range to a plain semver one: any member left unpacked would be resolved from
 * the public registry at a version this monorepo has never published.
 */
export const PACKAGES: readonly IWorkspacePackage[] = Object.freeze([
  ...WORKSPACE_PACKAGE_INVENTORY_PLAN.packages,
]);

/** One immutable workspace package generation ready for a consumer to pin. */
export interface IPackWorkspaceResult {
  readonly directory: string;
  readonly generation: string;
  readonly specifiers: Readonly<Record<string, string>>;
}

const TARBALL_GENERATION_PREFIX = ".tarballs-";
const TARBALL_STAGING_PREFIX = ".tarballs-stage-";

const digestBytes = (value: Buffer): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Pack every workspace package into one immutable generation, returning each
 * package's `file:` specifier.
 *
 * Packing rather than linking is the whole design. `pnpm pack` runs each
 * package's `prepack` build and applies `publishConfig`, so the tarball's
 * `exports` name built `lib/*.js` instead of `src/*.ts`. Three consequences
 * follow, and all three were measured before this replaced `link:`.
 *
 * A sandbox script starts in seconds instead of 133, which is the difference
 * between a usable sandbox and an unusable one: under a link every script pays
 * a full TypeScript build of the product tree before it does anything, and
 * pays it again on the next run.
 *
 * Typia's compile-time transform is already applied, so no consumer needs to
 * re-run it to avoid `typia.llm.controller(): no transform has been
 * configured`, and the scaffold's own scripts run unmodified under the
 * launcher this repository ships.
 *
 * `lib/index.js` is CommonJS emitted by `tsc`, whose `__exportStar` form
 * `cjs-module-lexer` does follow, so an ESM importer sees every name the index
 * re-exports. Under a link the same import lost every `export * from` line.
 *
 * The digest in each filename is not decoration. `file:` specifiers are keyed
 * by path, so a rebuilt package under an unchanged name and version would leave
 * an existing sandbox installed against stale bytes; changing the specifier is
 * what forces pnpm to resolve the new tarball.
 */
export const packWorkspace = (
  target: string,
  dependencies: IPackWorkspaceDependencies = packWorkspaceDependencies,
  packages: readonly IWorkspacePackage[] = PACKAGES,
): IPackWorkspaceResult => {
  dependencies.makeDirectory(target);
  const staging = dependencies.makeTemporaryDirectory(
    path.join(target, TARBALL_STAGING_PREFIX),
  );

  try {
    const packedFiles: Array<{
      digest: string;
      file: string;
      key: string;
      name: string;
    }> = [];
    for (const { key, directory: folder, name } of packages) {
      dependencies.write(`Packing ${name}\n`);
      const packed = dependencies.pack(
        path.join(ROOT, "packages", folder),
        staging,
      );
      if (packed.status !== 0) throw new Error(`pnpm pack failed for ${name}`);
      // Take the path pack reports rather than guessing the filename. The
      // command-line package publishes as `automovie`, so every scoped sibling
      // packs to `automovie-<member>-<version>.tgz` and a prefix match on its
      // own name claims all ten.
      const produced = packed.stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.endsWith(".tgz"));
      if (produced.length !== 1)
        throw new Error(
          `pnpm pack named ${produced.length} tarballs for ${name}; expected one.`,
        );
      const original = produced[0];
      if (!dependencies.exists(original))
        throw new Error(`pnpm pack reported a missing tarball for ${name}`);
      const digest = digestBytes(dependencies.read(original));
      const file = path
        .basename(original)
        .replace(/\.tgz$/u, `-${digest.slice(0, 12)}.tgz`);
      dependencies.rename(original, path.join(staging, file));
      packedFiles.push({ digest, file, key, name });
    }

    const generation = createHash("sha256")
      .update(
        JSON.stringify(
          packedFiles.map(({ digest, key, name }) => ({ digest, key, name })),
        ),
      )
      .digest("hex")
      .slice(0, 12);
    const relativeDirectory = `${TARBALL_GENERATION_PREFIX}${generation}`;
    const directory = path.join(target, relativeDirectory);
    const specifiers = Object.fromEntries(
      packedFiles.map(({ file, key }) => [
        key,
        `file:./${relativeDirectory}/${file}`,
      ]),
    );

    if (dependencies.exists(directory)) {
      const invalid = packedFiles.find(({ digest, file }) => {
        const existing = path.join(directory, file);
        return (
          !dependencies.exists(existing) ||
          digestBytes(dependencies.read(existing)) !== digest
        );
      });
      if (invalid !== undefined)
        throw new Error(
          `workspace package generation ${generation} cannot be reused: ${invalid.file} is missing or has different bytes`,
        );
      dependencies.remove(staging);
    } else dependencies.rename(staging, directory);

    return { directory, generation, specifiers };
  } catch (error) {
    if (dependencies.exists(staging)) dependencies.remove(staging);
    throw error;
  }
};

/** Build the complete local package tarball set into the repository cache. */
export const buildTgz = (
  root: string = ROOT,
  pack: (target: string) => IPackWorkspaceResult = packWorkspace,
  write: (message: string) => unknown = (message) =>
    process.stdout.write(message),
): string => {
  const target = path.join(root, "node_modules", ".cache", "automovie-tgz");
  const result = pack(target);
  write(`TGZ packages built under ${result.directory}\n`);
  return result.directory;
};

/**
 * True when Node started this file rather than importing it.
 *
 * The entry arrives as a parameter so both answers can be exercised without
 * spawning a process for each: a module-scope comparison is only ever taken one
 * way inside a test run, which is how an entry guard reaches a release having
 * never been observed to fire. The comparison stays on `process.argv[1]`
 * because that is the form `pnpm run build:tgz` is proven to execute under; the
 * `undefined` arm covers a host that starts Node without a script path at all,
 * where `path.resolve` would throw.
 */
export const isProcessEntry = (
  entry: string | undefined,
  file: string,
): boolean => {
  if (entry === undefined) return false;
  const actual = path.resolve(entry);
  const expected = path.resolve(file);
  return process.platform === "win32"
    ? actual.toLowerCase() === expected.toLowerCase()
    : actual === expected;
};

/** Pack the workspace only when this module is the process entry. */
export const buildTgzCli = (entry: boolean, run: () => unknown): void => {
  if (entry) run();
};

buildTgzCli(isProcessEntry(process.argv[1], __filename), buildTgz);
