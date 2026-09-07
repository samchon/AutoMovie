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
import * as path from "node:path";

import { synchronizeAutoMovieReferenceClients } from "../packages/cli/src/synchronizeAutoMovieReferenceClients";
import {
  type AutoMovieProductionLanguage,
  isAutoMovieProductionLanguage,
} from "../packages/evidence/src/AutoMovieProductionLanguage";
import {
  AUTO_MOVIE_CONTRACT_BASELINE_PATH,
  parseAutoMovieContractBaseline,
} from "../packages/template/src/productionMaintenance";
import { renderScaffold } from "../packages/template/src/renderScaffold";
import { openExperimentalSandbox } from "./experimentalSandbox";
import {
  type IPackWorkspaceResult,
  PACKAGES,
  isProcessEntry,
  packWorkspace,
} from "./tgz";

const ROOT = path.resolve(__dirname, "..");

const USAGE = `create a working-tree automovie sandbox

Usage:
  pnpm run experimental <name> --language <chinese|english|japanese|korean> [--force] [--no-install]
  pnpm run experimental <name> --refresh [--language <existing-language>] [--no-install]

Options:
  --force       Render over a non-empty experimental/<name>.
  --language    Select the production language when creating a sandbox. During
                refresh, an optional value may only confirm the existing one.
  --refresh     Repack and reinstall without re-rendering, so a package change
                reaches a sandbox whose production is already under way.
  --no-install  Skip packing and installing; synchronize client entries.
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
  packages: readonly (typeof PACKAGES)[number][] = PACKAGES,
): string => {
  const manifest = JSON.parse(rendered) as {
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  for (const { key, name: dependency } of packages) {
    if (specifiers[key] === undefined) continue;
    const table = Object.hasOwn(manifest.devDependencies ?? {}, dependency)
      ? manifest.devDependencies!
      : manifest.dependencies;
    table[dependency] = specifiers[key];
  }
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

export interface IExperimentalDependencies {
  readonly pack: (
    target: string,
    assertCurrent: () => void,
  ) => IPackWorkspaceResult;
  readonly install: (target: string) => number | null;
  readonly openSandbox: typeof openExperimentalSandbox;
  readonly render: typeof renderScaffold;
  readonly synchronizeReferenceClients: typeof synchronizeAutoMovieReferenceClients;
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

/**
 * Carry the sandbox's captured authority into every package mutation.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Keeps packing attached to the launcher-approved sandbox rather than recapturing a successor.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Passes the same currentness callback into each package mutation boundary.
 */
export const packExperimentalWorkspace = (
  target: string,
  assertCurrent: () => void,
  pack: typeof packWorkspace = packWorkspace,
): IPackWorkspaceResult => pack(target, undefined, undefined, assertCurrent);

export const experimentalDependencies: IExperimentalDependencies = {
  pack: packExperimentalWorkspace,
  install: runExperimentalInstall,
  openSandbox: openExperimentalSandbox,
  render: renderScaffold,
  synchronizeReferenceClients: synchronizeAutoMovieReferenceClients,
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
 * directory the traversal reached. This lexical check precedes physical
 * approval by `openExperimentalSandbox` and holds for every name
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

type ExperimentalArguments =
  | {
      readonly force: boolean;
      readonly install: boolean;
      readonly language: AutoMovieProductionLanguage;
      readonly name: string;
      readonly refresh: false;
    }
  | {
      readonly force: false;
      readonly install: boolean;
      readonly language?: AutoMovieProductionLanguage;
      readonly name: string;
      readonly refresh: true;
    };

/** Parse one closed sandbox request before any package or project I/O. */
export const readExperimentalArguments = (
  args: readonly string[],
): ExperimentalArguments => {
  let force = false;
  let install = true;
  let language: AutoMovieProductionLanguage | undefined;
  let languageSeen = false;
  let name: string | undefined;
  let refresh = false;
  for (let index = 0; index < args.length; ++index) {
    const argument = args[index]!;
    if (argument === "--force") {
      if (force) throw new Error("--force may be supplied only once.");
      force = true;
    } else if (argument === "--no-install") {
      if (!install) throw new Error("--no-install may be supplied only once.");
      install = false;
    } else if (argument === "--refresh") {
      if (refresh) throw new Error("--refresh may be supplied only once.");
      refresh = true;
    } else if (argument === "--language") {
      if (languageSeen)
        throw new Error("--language may be supplied only once.");
      languageSeen = true;
      const candidate = args[++index];
      if (candidate === undefined || candidate.startsWith("-"))
        throw new Error("--language requires one supported language.");
      if (!isAutoMovieProductionLanguage(candidate))
        throw new Error(
          `Unsupported experimental production language ${JSON.stringify(candidate)}.`,
        );
      language = candidate;
    } else if (argument.startsWith("-"))
      throw new Error(`Unsupported experimental option ${argument}.`);
    else if (name !== undefined)
      throw new Error("experimental accepts exactly one sandbox name.");
    else name = argument;
  }
  if (name === undefined) throw new Error("a name is required");
  if (refresh) {
    if (force)
      throw new Error("--force and --refresh cannot describe one sandbox run.");
    return { force: false, install, language, name, refresh: true };
  }
  if (!isAutoMovieProductionLanguage(language))
    throw new Error(
      "sandbox creation requires --language with one of chinese, english, japanese, or korean.",
    );
  return { force, install, language, name, refresh: false };
};

/** The scaffold input for creation, or no render after validating refresh. */
export const experimentalScaffoldRequest = (
  request: ExperimentalArguments,
  baselineSource?: string,
):
  | { readonly language: AutoMovieProductionLanguage; readonly name: string }
  | undefined => {
  if (!request.refresh)
    return { language: request.language, name: request.name };
  if (baselineSource === undefined)
    throw new Error(
      `experimental/${request.name} has no frozen contract baseline.`,
    );
  const existing = parseAutoMovieContractBaseline(baselineSource).language;
  if (request.language !== undefined && request.language !== existing)
    throw new Error(
      `experimental/${request.name} uses ${existing}; refresh cannot change it to ${request.language}.`,
    );
  return undefined;
};

/** Recovery that preserves an authored sandbox whenever one already exists. */
export const experimentalInstallFailureMessage = (
  name: string,
  refresh: boolean,
): string =>
  `npm install failed in experimental/${name}. Fix it there, then re-run with ${
    refresh ? "--refresh" : "--force"
  }.`;

/**
 * Keep packing and cleanup causes visible when a guarded operation fails.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Reports the underlying identity refusal even when it also prevents staging cleanup.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Preserves operation and recovery causes in the launcher's terminal diagnostic.
 */
export const experimentalFailureMessage = (error: unknown): string =>
  error instanceof AggregateError
    ? `${error.message}\n${error.errors.map(experimentalFailureMessage).join("\n")}`
    : error instanceof Error
      ? error.message
      : String(error);

/**
 * Create or refresh one sandbox while retaining its physical approval through
 * packing, descriptor-bound publication, installation and client registration.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-sandbox-write-boundary Applies the same sandbox ownership contract to creation, force, refresh and no-install.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-sandbox-physical-ownership Orders preflight, packing, publication, install and registration checks without adopting replaced paths.
 */
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
  try {
    const request = readExperimentalArguments(args);
    const name = request.name;
    const target = sandboxTarget(name);
    // `--refresh` repacks and reinstalls without re-rendering the scaffold, so
    // a package fix reaches a sandbox whose production is mid-flight. Without
    // it the only way to pick up a change is `--force`, which rewrites every
    // scaffold-managed file and can destroy exactly the authored configuration,
    // guides, scripts, viewer changes, and package wiring the experiment exists
    // to exercise.
    const refresh = request.refresh;
    const files = refresh
      ? undefined
      : dependencies.render(experimentalScaffoldRequest(request)!);
    const sandbox = dependencies.openSandbox({
      create: !refresh,
      overwrite: request.force,
      root: EXPERIMENTAL_ROOT,
      target,
    });

    // Refuse a non-empty directory, not merely an existing one, matching the
    // CLI's own `--force` semantics. Deleting a sandbox on Windows routinely
    // leaves the directory behind once its `node_modules` links are gone, and
    // an existence check would make that residue block every later attempt.
    if (
      sandbox.entries.length !== 0 &&
      request.force === false &&
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
    if (refresh && sandbox.manifest === undefined)
      throw new Error(
        `experimental/${name} has no package.json to refresh. Create it first.`,
      );

    // A sandbox created before baselines were frozen has a manifest and no
    // baseline; the scaffold request names that state instead of an ENOENT.
    if (refresh)
      experimentalScaffoldRequest(
        request,
        sandbox.read(AUTO_MOVIE_CONTRACT_BASELINE_PATH),
      );
    sandbox.prepare(Object.keys(files ?? { "package.json": "" }));

    const install = request.install;
    sandbox.assertCurrent();
    const specifiers = install
      ? dependencies.pack(target, sandbox.assertCurrent).specifiers
      : {};
    sandbox.assertCurrent();

    if (files === undefined) {
      sandbox.publish({
        "package.json": sandboxManifest(sandbox.manifest!, specifiers),
      });
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
      sandbox.publish(files);
      output.write(
        `Rendered ${Object.keys(files).length} files into experimental/${name}\n`,
      );
    }

    if (install) {
      output.write("Installing the sandbox (npm install)\n");
      sandbox.assertCurrent();
      if (dependencies.install(target) !== 0)
        throw new Error(experimentalInstallFailureMessage(name, refresh));
      sandbox.assertCurrent();
    }

    sandbox.assertCurrent();
    dependencies.synchronizeReferenceClients(sandbox.physicalDirectory);
    sandbox.assertCurrent();
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
    errorOutput.write(`${experimentalFailureMessage(error)}\n`);
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
