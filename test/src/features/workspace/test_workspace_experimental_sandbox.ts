import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { preserveExperimentalSandboxCleanup } from "./ExperimentalSandboxCleanup";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const GENERATOR = path.join(ROOT, "internals", "experimental.mjs");
const NAME = "fixture_sandbox";
const TARGET = path.join(ROOT, "experimental", NAME);

/** Render a sandbox without installing it, returning the generator's result. */
const generate = (
  ...args: readonly string[]
): { status: number; stderr: string } => {
  const child = spawnSync(
    process.execPath,
    [GENERATOR, NAME, "--no-install", ...args],
    { cwd: ROOT, encoding: "utf8" },
  );
  return { status: child.status ?? 1, stderr: child.stderr };
};

const readSandbox = (relative: string): string =>
  fs.readFileSync(path.join(TARGET, ...relative.split("/")), "utf8");

/** Ask git a question from inside the rendered sandbox. */
const sandboxGit = (...args: readonly string[]): string => {
  const child = spawnSync("git", [...args], { cwd: TARGET, encoding: "utf8" });
  if (child.status !== 0)
    throw new Error(`git ${args.join(" ")} failed: ${child.stderr.trim()}`);
  return child.stdout.trim();
};

/**
 * Pin what the experimental generator emits, which is the whole reason a
 * sandbox can be driven by a live agent against working-tree code.
 *
 * Two of these are load-bearing and neither is cosmetic. A sandbox must stay
 * out of the tracked lockfile, because `experimental/` is gitignored and a
 * workspace member writes an importer no other checkout has. And the project's
 * own MCP server must be pre-approved, because approval is interactive and
 * per-project while a driven sandbox is headless by definition, so without it
 * the agent sees no automovie tools and the sandbox cannot do its one job.
 *
 * The generator otherwise leaves the rendered scaffold alone. That is the point
 * of installing packed tarballs rather than linking `packages/`: resolution
 * reaches built `lib/*.js` exactly as a published project's does, so the
 * scaffold's own `tsx` launchers and script table need no rewriting. Earlier
 * revisions rewrote both, and every one of those rewrites existed only to work
 * around `link:` resolving to untransformed `src/*.ts`.
 *
 * The pack itself is not exercised here: it runs nine package builds and would
 * dominate this suite. Package build tests cover the equivalent guarantee that
 * a packed chain resolves and serves, and creating a real sandbox covers the
 * rest.
 *
 * Scenarios:
 *
 * 1. `--no-install` renders without packing and therefore leaves the scaffold's
 *    published version ranges in place, with no `link:` or `workspace:` range
 *    anywhere in the manifest.
 * 2. The manifest carries the scaffold's own npm-style top-level `overrides`,
 *    which is what holds the Sharp capability wall, and adds no pnpm-specific
 *    block: a sandbox installs with npm, whose transitive resolution is what
 *    makes sibling tarballs satisfy the packed packages' own ranges.
 * 3. `.claude/settings.json` approves the project's MCP servers and retains a hook
 *    block.
 * 4. No host-only tsconfig or lint config is emitted.
 * 5. The sandbox is its own repository root with the generated starter as its
 *    only commit and a clean working tree. This one is load-bearing too: an
 *    agent finds its project instructions by walking up from its working
 *    directory to a repository root, and a sandbox without one leads that walk
 *    into this repository's `AGENTS.md` and `.agents/skills/**`. Being
 *    gitignored does not help, because that hides the sandbox from git and not
 *    from a reader.
 * 6. The packed tarballs are excluded through `.git/info/exclude` rather than
 *    the scaffold's shipped `.gitignore`, which stays the file a real project
 *    receives.
 * 7. A second run over the rendered sandbox fails without `--force`, and the
 *    message names the directory.
 * 8. `--refresh` runs against that same non-empty sandbox and leaves the project's
 *    own files alone, which is the whole reason it exists: a package fix has to
 *    reach a sandbox whose film is mid-production, and `--force` would write
 *    the starter back over it.
 * 9. `--force` renders over the same directory, and the work `--refresh` preserved
 *    is gone, which is the contrast that makes the two modes distinct rather
 *    than a preference.
 * 10. Neither mode restarts the sandbox's history. The commits a driven agent
 *    made are the output of an experiment, and `--force` overwrites a working
 *    tree rather than a record.
 */
export const test_workspace_experimental_sandbox = (): void => {
  let failure: { error: unknown } | undefined = undefined;
  try {
    TestValidator.equals("the generator renders", generate().status, 0);

    const manifest = JSON.parse(readSandbox("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      overrides: Record<string, Record<string, string>>;
      pnpm?: unknown;
    };
    const ranges = Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    }).filter(([name]) => name.startsWith("@automovie/"));
    TestValidator.equals(
      "a render without a pack keeps the published ranges",
      namedFacts([
        ["rangesLength", () => ranges.length !== 0],
        [
          "rangesEveryRange",
          () =>
            ranges.length !== 0 &&
            ranges.every(([, range]) => /^\^\d+\.\d+\.\d+$/.test(range)),
        ],
      ]),
      { rangesLength: true, rangesEveryRange: true },
    );
    TestValidator.equals(
      "no dependency reaches into the workspace",
      Object.values({
        ...manifest.dependencies,
        ...manifest.devDependencies,
      }).some(
        (range) => range.startsWith("link:") || range.startsWith("workspace:"),
      ),
      false,
    );
    TestValidator.equals(
      "the Sharp capability wall stands in the form npm reads",
      manifest.overrides["@huggingface/transformers"]?.sharp,
      "file:vendor/sharp-disabled",
    );
    TestValidator.equals(
      "no pnpm-specific block survives the npm install path",
      Object.hasOwn(manifest, "pnpm"),
      false,
    );

    const settings = JSON.parse(readSandbox(".claude/settings.json")) as {
      enableAllProjectMcpServers: boolean;
      hooks: unknown;
    };
    TestValidator.equals(
      "the project's own MCP server is approved up front",
      settings.enableAllProjectMcpServers,
      true,
    );
    TestValidator.equals(
      "the generated project retains its hook configuration",
      settings.hooks === undefined,
      false,
    );
    TestValidator.equals(
      "no host-only project config is emitted",
      ["tsconfig.mcp.json", "lint.host.config.ts"].some((file) =>
        fs.existsSync(path.join(TARGET, file)),
      ),
      false,
    );

    TestValidator.equals(
      "the sandbox is its own repository root, so an upward search for project instructions stops inside it",
      sandboxGit("rev-parse", "--git-dir"),
      ".git",
    );
    TestValidator.equals(
      "the generated starter is committed and nothing is left uncommitted",
      namedFacts([
        [
          "starterIsTheOnlyCommit",
          () => sandboxGit("rev-list", "--count", "HEAD") === "1",
        ],
        ["worktreeIsClean", () => sandboxGit("status", "--porcelain") === ""],
      ]),
      { starterIsTheOnlyCommit: true, worktreeIsClean: true },
    );
    TestValidator.equals(
      "the tarballs are excluded locally, leaving the shipped ignore file alone",
      namedFacts([
        [
          "excludeNamesTheTarballs",
          () => readSandbox(".git/info/exclude").includes(".tarballs/"),
        ],
        [
          "shippedIgnoreStaysTheOneAProjectReceives",
          () => readSandbox(".gitignore").includes(".tarballs") === false,
        ],
      ]),
      {
        excludeNamesTheTarballs: true,
        shippedIgnoreStaysTheOneAProjectReceives: true,
      },
    );

    const repeated = generate();
    TestValidator.equals("a non-empty sandbox is refused", repeated.status, 1);
    TestValidator.equals(
      "the refusal names the sandbox and the escape",
      namedFacts([
        ["repeatedStderrIncludes", () => repeated.stderr.includes(NAME)],
        ["repeatedStderrIncludes2", () => repeated.stderr.includes("--force")],
      ]),
      { repeatedStderrIncludes: true, repeatedStderrIncludes2: true },
    );

    // Stand in for a film in progress: any rendered file the production owns.
    const inProgress = path.join(TARGET, "docs", NAME, "01-logline.md");
    const rendered = fs.readFileSync(inProgress, "utf8");
    fs.writeFileSync(inProgress, `${rendered}\nSEQ-PRATZEN authored here.\n`);
    TestValidator.equals(
      "--refresh runs on a non-empty sandbox",
      generate("--refresh").status,
      0,
    );
    TestValidator.equals(
      "--refresh leaves the production in progress alone",
      fs.readFileSync(inProgress, "utf8").includes("SEQ-PRATZEN"),
      true,
    );

    TestValidator.equals(
      "--force renders over it",
      generate("--force").status,
      0,
    );
    TestValidator.equals(
      "--force is the mode that writes the starter back over that work",
      fs.readFileSync(inProgress, "utf8").includes("SEQ-PRATZEN"),
      false,
    );
    TestValidator.equals(
      "neither mode restarts the history the run is recorded in",
      namedFacts([
        [
          "historyIsStillTheStarterCommit",
          () => sandboxGit("rev-list", "--count", "HEAD") === "1",
        ],
        [
          "repositoryRootIsStillTheSandbox",
          () => sandboxGit("rev-parse", "--git-dir") === ".git",
        ],
      ]),
      {
        historyIsStillTheStarterCommit: true,
        repositoryRootIsStillTheSandbox: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveExperimentalSandboxCleanup(
      failure,
      () => fs.rmSync(TARGET, { recursive: true, force: true }),
      `sandbox ${NAME}`,
    );
  }
};
