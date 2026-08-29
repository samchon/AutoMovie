// Create `experimental/<name>`: the CLI's blank scaffold, rewired to consume
// this working tree instead of npm, so a change to any package can be driven by
// a live coding agent without publishing anything.
//
// This is repository-local tooling on purpose. `packages/template/scaffold/**` and
// the published `automovie` surface stay untouched: a real user's project
// targets released versions, and only how the sandbox obtains those packages
// differs.
//
// The sandbox consumes **packed working-tree tarballs**, not a `link:` into
// `packages/`. `packWorkspace` explains why in full; the short version is that a
// link resolves each package through its `exports` to untransformed `src/*.ts`,
// and every consumer then pays a full TypeScript build on every process start.
// Every sandbox script would pay it again, and the measured cost to a first
// answer was 133 seconds. A tarball carries `publishConfig`, so `exports`
// resolve to built `lib/*.js` with typia's transform already applied, a script
// starts in seconds, and the sandbox exercises the same resolution a real
// user's project does.
//
// `sandboxManifest` then pins every workspace package to its tarball.
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { renderScaffold } from "../packages/template/src/renderScaffold";
import { writeFiles } from "../packages/template/src/writeFiles";
import { PACKAGES, packWorkspace } from "./tgz";

const ROOT = path.resolve(__dirname, "..");

const USAGE = `create a working-tree automovie sandbox

Usage:
  pnpm run experimental <name> [--force] [--refresh] [--no-install]

Options:
  --force       Render over a non-empty experimental/<name>.
  --refresh     Repack and reinstall without re-rendering, so a package change
                reaches a sandbox whose production is already under way.
  --no-install  Render only, skipping the pack and install.
`;

/**
 * The sandbox's manifest: the scaffold's, with every workspace package pinned
 * to its sibling tarball.
 *
 * Every one of them is pinned directly, including `evidence`, `ingest`, and
 * `render` which the scaffold never names. Each is pinned under its published
 * name rather than under `@automovie/` plus its directory, because the
 * command-line package publishes as `automovie`. `pnpm pack` rewrites each packed package's
 * own `workspace:^` ranges into plain semver, so an unpinned member is fetched
 * from the public registry at a version this monorepo has never published, and
 * the install dies on `ERR_PNPM_FETCH_404 .../@automovie%2Fengine`. A direct
 * entry makes npm satisfy those transitive ranges from the siblings instead,
 * which is the same technique generated-package verification relies on.
 *
 * Pnpm was tried first and its `overrides` do not reach a transitive range from
 * inside a packed tarball; the same 404 surfaced one package later. Installing
 * with npm also restores what the pnpm-specific manifest block used to
 * compensate for: the scaffold's npm-style top-level `overrides` supplies the
 * Sharp stub on its own, and pnpm 10's lifecycle-script allowlist, whose
 * refusal exits non-zero, is not npm's rule.
 */
export const sandboxManifest = (
  rendered: string,
  specifiers: Readonly<Record<string, string>>,
): string => {
  const manifest = JSON.parse(rendered) as {
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const { key, name: dependency } of PACKAGES) {
    if (specifiers[key] === undefined) continue;
    const table = Object.hasOwn(manifest.devDependencies ?? {}, dependency)
      ? manifest.devDependencies!
      : manifest.dependencies;
    table[dependency] = specifiers[key];
  }
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

export interface IExperimentalDependencies {
  readonly pack: (target: string) => Record<string, string>;
  readonly install: (target: string) => number | null;
}

export interface IExperimentalWriter {
  write(message: string): unknown;
}

export const experimentalDependencies: IExperimentalDependencies = {
  pack: packWorkspace,
  install: (target) =>
    spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: target,
      stdio: "inherit",
      shell: process.platform === "win32",
    }).status,
};

export const runExperimental = (
  args: readonly string[],
  dependencies: IExperimentalDependencies = experimentalDependencies,
  output: IExperimentalWriter = process.stdout,
  errorOutput: IExperimentalWriter = process.stderr,
): number => {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    output.write(USAGE);
    return 0;
  }
  const name = args.find((arg) => arg.startsWith("-") === false);
  if (name === undefined) {
    errorOutput.write(`a name is required\n\n${USAGE}`);
    return 1;
  }
  try {
    const target = path.join(ROOT, "experimental", name);
    // Refuse a non-empty directory, not merely an existing one, matching the
    // CLI's own `--force` semantics. Deleting a sandbox on Windows routinely
    // leaves the directory behind once its `node_modules` links are gone, and
    // an existence check would make that residue block every later attempt.
    if (
      fs.existsSync(target) &&
      fs.readdirSync(target).length !== 0 &&
      args.includes("--force") === false &&
      args.includes("--refresh") === false
    )
      throw new Error(
        `experimental/${name} is not empty. Pass --force to render over it, or remove it first.`,
      );

    // Packing writes into the target, so it precedes the render that fills it.
    const install = args.includes("--no-install") === false;
    const specifiers = install ? dependencies.pack(target) : {};

    // `--refresh` repacks and reinstalls without re-rendering the scaffold, so
    // a package fix reaches a sandbox whose production is mid-flight. Without
    // it the only way to pick up a change is `--force`, which rewrites every
    // scaffold-managed file and can destroy exactly the authored configuration,
    // guides, scripts, viewer changes, and package wiring the experiment exists
    // to exercise.
    if (args.includes("--refresh")) {
      const manifest = path.join(target, "package.json");
      if (fs.existsSync(manifest) === false)
        throw new Error(
          `experimental/${name} has no package.json to refresh. Create it first.`,
        );
      fs.writeFileSync(
        manifest,
        sandboxManifest(fs.readFileSync(manifest, "utf8"), specifiers),
        "utf8",
      );
      output.write(`Refreshed experimental/${name} against the pack\n`);
    } else {
      const files = renderScaffold({ name });
      files["package.json"] = sandboxManifest(
        files["package.json"],
        specifiers,
      );
      writeFiles(target, files, { force: true });
      output.write(
        `Rendered ${Object.keys(files).length} files into experimental/${name}\n`,
      );
    }

    if (install) {
      output.write("Installing the sandbox (npm install)\n");
      if (dependencies.install(target) !== 0)
        throw new Error(
          `npm install failed in experimental/${name}. Fix it there, then re-run with --force.`,
        );
    }

    output.write(
      `\nDrive it with Claude Code:\n` +
        `  cd experimental/${name}\n` +
        `  claude\n\n` +
        `Drive it with Codex:
` +
        `  cd experimental/${name}
` +
        `  codex

` +
        `The sandbox installs packed working-tree tarballs, so after changing a\n` +
        `package under packages/ rerun this command with --refresh, which repacks\n` +
        `and reinstalls without rewriting scaffold-managed work in progress.\n` +
        `experimental/ is gitignored: delete the directory when the experiment is done.\n`,
    );
    return 0;
  } catch (error) {
    errorOutput.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

if (path.resolve(process.argv[1] ?? "") === path.resolve(__filename))
  process.exitCode = runExperimental(process.argv.slice(2));
