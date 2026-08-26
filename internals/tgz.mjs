import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The workspace packages a sandbox installs, dependencies before consumers.
 *
 * This is the scaffold's own set (`WORKSPACE_TEMPLATE_VERSION_KEYS`) closed
 * under `@automovie/*` dependencies, which adds `ingest` and `render` through
 * `production`. The closure matters because `pnpm pack` rewrites a `workspace:^` range
 * to a plain semver one: any member left unpacked would be resolved from the
 * public registry at a version this monorepo has never published.
 */
export const PACKAGES = Object.freeze([
  "interface",
  "engine",
  "archetypes",
  "evidence",
  "render",
  "ingest",
  "viewer",
  "production",
  "template",
  "cli",
]);

/** Where a sandbox keeps the tarballs it installs from. */
const TARBALL_DIR = ".tarballs";

/**
 * Pack every workspace package into `<target>/.tarballs`, returning each
 * package's `file:` specifier.
 *
 * Packing rather than linking is the whole design. `pnpm pack` runs each
 * package's `prepack` build and applies `publishConfig`, so the tarball's
 * `exports` name built `lib/*.js` instead of `src/*.ts`. Three consequences
 * follow, and all three were measured before this replaced `link:`.
 *
 * A sandbox script starts in seconds instead of 133, which is the difference
 * between a usable sandbox and an unusable one: a driver that waits two
 * request times out at 60 seconds, and no environment variable moves it, so a
 * linked sandbox handed a live agent zero tools no matter how long it waited.
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
export const packWorkspace = (target) => {
  const directory = path.join(target, TARBALL_DIR);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });

  const specifiers = {};
  for (const name of PACKAGES) {
    process.stdout.write(`Packing @automovie/${name}\n`);
    const packed = spawnSync(
      "pnpm",
      ["pack", "--pack-destination", directory],
      {
        cwd: path.join(ROOT, "packages", name),
        stdio: ["ignore", "pipe", "inherit"],
        encoding: "utf8",
        shell: process.platform === "win32",
      },
    );
    if (packed.status !== 0)
      throw new Error(`pnpm pack failed for @automovie/${name}`);
    const produced = fs
      .readdirSync(directory)
      .filter((entry) => entry.startsWith(`automovie-${name}-`));
    if (produced.length !== 1)
      throw new Error(
        `expected one tarball for @automovie/${name}, found ${produced.length}`,
      );
    const original = path.join(directory, produced[0]);
    const digest = createHash("sha256")
      .update(fs.readFileSync(original))
      .digest("hex")
      .slice(0, 12);
    const final = produced[0].replace(/\.tgz$/, `-${digest}.tgz`);
    fs.renameSync(original, path.join(directory, final));
    specifiers[name] = `file:./${TARBALL_DIR}/${final}`;
  }
  return specifiers;
};
