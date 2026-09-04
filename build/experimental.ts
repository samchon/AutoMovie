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
import { PACKAGES, isProcessEntry, packWorkspace } from "./tgz";

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

/**
 * The install this command runs, stated as the request it makes.
 *
 * `npm` rather than `pnpm` because `pnpm pack` rewrites a packed package's own
 * `workspace:^` ranges into plain semver, and npm satisfies those transitive
 * ranges from the directly installed siblings while pnpm does not.
 *
 * Split from the call so what this repository decides -- the installer, its
 * flags, the directory it runs in, and the shell only Windows needs -- can be
 * read without running an install. npm's own resolver is not this repository's
 * to verify, and a test that installs to find that out spends minutes learning
 * nothing about AutoMovie.
 */
export const experimentalInstallRequest = (
  target: string,
  platform: string = process.platform,
): {
  argv: readonly string[];
  command: string;
  options: { cwd: string; shell: boolean; stdio: "inherit" };
} => ({
  argv: ["install", "--no-audit", "--no-fund"],
  command: "npm",
  options: { cwd: target, shell: platform === "win32", stdio: "inherit" },
});

/**
 * Run one install request and report exactly what the process reported.
 *
 * The launcher is an input so the status this returns is an ordinary case. A
 * signalled installer reports a null status, and a caller that read that as
 * success would call a sandbox ready that never installed anything; that
 * mapping is this repository's to state and is stated here rather than left to
 * a test that would have to install to reach it.
 */
export const runExperimentalInstall = (
  target: string,
  // `spawnSync` itself rather than an arrow that forwards to it. An arrow here
  // is a function body no test can reach without running a real install, so it
  // would sit uncovered forever on the one line this module exists to avoid
  // executing. Taking a mutable `argv` is what lets the launcher be named
  // directly, and the spread that makes one happens at the call below.
  launch: (
    command: string,
    argv: string[],
    options: { cwd: string; shell: boolean; stdio: "inherit" },
  ) => { status: number | null } = spawnSync,
): number | null => {
  const request = experimentalInstallRequest(target);
  return launch(request.command, [...request.argv], request.options).status;
};

export const experimentalDependencies: IExperimentalDependencies = {
  pack: packWorkspace,
  install: (target) => runExperimentalInstall(target),
};

/** Where every sandbox lives, and the only directory one may be written into. */
export const EXPERIMENTAL_ROOT = path.join(ROOT, "experimental");

/**
 * Resolve `experimental/<name>`, refusing any name that does not land directly
 * inside `experimental/`.
 *
 * The portability rule belongs to `renderScaffold`, which owns what a project
 * name may be. What it cannot own is where this command writes, because
 * `--refresh` never calls it: `pnpm run experimental .. --refresh` resolved to
 * the repository root, rewrote the repository's own `package.json`, and exited
 * 0, and with the install enabled it first packed ten tarballs into whatever
 * directory the traversal reached. Containment is therefore checked here, once,
 * before anything is packed, written, or installed, and it holds for every name
 * shape a traversal can take: `..`, `a/b`, a backslash segment on Windows, an
 * absolute path, and the empty string, all of which resolve to a path whose
 * parent is not `experimental/`.
 */
export const sandboxTarget = (name: string): string => {
  const target = path.resolve(EXPERIMENTAL_ROOT, name);
  if (path.dirname(target) !== EXPERIMENTAL_ROOT)
    throw new Error(
      `experimental name "${name}" must be one directory segment inside experimental/`,
    );
  return target;
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
    const target = sandboxTarget(name);
    // `--refresh` repacks and reinstalls without re-rendering the scaffold, so
    // a package fix reaches a sandbox whose production is mid-flight. Without
    // it the only way to pick up a change is `--force`, which rewrites every
    // scaffold-managed file and can destroy exactly the authored configuration,
    // guides, scripts, viewer changes, and package wiring the experiment exists
    // to exercise.
    const refresh = args.includes("--refresh");

    // Refuse a non-empty directory, not merely an existing one, matching the
    // CLI's own `--force` semantics. Deleting a sandbox on Windows routinely
    // leaves the directory behind once its `node_modules` links are gone, and
    // an existence check would make that residue block every later attempt.
    if (
      fs.existsSync(target) &&
      fs.readdirSync(target).length !== 0 &&
      args.includes("--force") === false &&
      refresh === false
    )
      throw new Error(
        `experimental/${name} is not empty. Pass --force to render over it, or remove it first.`,
      );

    // Everything decidable from the request alone is decided before the pack,
    // because packing runs each workspace package's build and costs minutes.
    // The previous order paid that first and refused afterwards, which left ten
    // tarballs under a directory the command then declined to use: a refresh of
    // a sandbox that does not exist, and a render under a name `renderScaffold`
    // refuses, both went that way.
    const manifest = path.join(target, "package.json");
    if (refresh && fs.existsSync(manifest) === false)
      throw new Error(
        `experimental/${name} has no package.json to refresh. Create it first.`,
      );

    // Rendering is what enforces the scaffold's own name rule, so it runs
    // before the pack as well. Nothing reaches disk here; `writeFiles` below
    // still runs after the pack that fills the same directory.
    const files = refresh
      ? undefined
      : renderScaffold({ name, language: "english" });

    const install = args.includes("--no-install") === false;
    const specifiers = install ? dependencies.pack(target) : {};

    if (files === undefined) {
      fs.writeFileSync(
        manifest,
        sandboxManifest(fs.readFileSync(manifest, "utf8"), specifiers),
        "utf8",
      );
      // Say which of the two happened. `--refresh --no-install` leaves the
      // specifiers empty, so the rewrite preserves the pins the manifest
      // already carried; reporting that as a refresh against the pack tells an
      // experimenter their package change reached the sandbox when nothing was
      // packed at all, which is the one thing this command exists to answer.
      output.write(
        install
          ? `Refreshed experimental/${name} against the pack\n`
          : `Rewrote experimental/${name}'s manifest; --no-install packed nothing\n`,
      );
    } else {
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
        `Drive it with Codex:\n` +
        `  cd experimental/${name}\n` +
        `  codex\n\n` +
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

/** Publish the command's status to the process, isolated so it can be observed. */
export const setExperimentalExitCode = (code: number): void => {
  process.exitCode = code;
};

/** Run the sandbox command only when this module is the process entry. */
export const runExperimentalCli = (
  entry: boolean,
  args: readonly string[],
  setExitCode: (code: number) => void,
): void => {
  if (entry) setExitCode(runExperimental(args));
};

runExperimentalCli(
  isProcessEntry(process.argv[1], __filename),
  process.argv.slice(2),
  setExperimentalExitCode,
);
