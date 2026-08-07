// Create `experimental/<name>`: the CLI's shipped starter, rewired to consume
// this working tree instead of npm, so a change to any package can be driven by
// a live coding agent without publishing anything.
//
// This is repository-local tooling on purpose. `packages/cli/scaffold/**` and
// the published `@automovie/cli` surface stay untouched: a real user's project
// targets released versions, and only how the sandbox obtains those packages
// differs.
//
// The sandbox consumes **packed working-tree tarballs**, not a `link:` into
// `packages/`. `packWorkspace` explains why in full; the short version is that a
// link resolves each package through its `exports` to untransformed `src/*.ts`,
// and every consumer then pays a full TypeScript build on every process start.
// For an ordinary script that is merely slow. For the MCP host it is fatal: a
// client's `initialize` request times out at 60 seconds and the measured host
// took 133, so a linked sandbox served an agent no tools at all. A tarball
// carries `publishConfig`, so `exports` resolve to built `lib/*.js` with typia's
// transform already applied, the host starts in seconds, and the sandbox
// exercises the same resolution a real user's project does.
//
// `sandboxManifest` then pins every workspace package to its tarball, and
// `claudeSettings` approves the project's own MCP server so a non-interactive
// session can reach it.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORKSPACE_TEMPLATE_VERSION_KEYS,
  resolveTemplateVersions,
} from "../packages/cli/build/templateVersions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = path.join(ROOT, "packages", "cli", "scaffold");

const USAGE = `create a working-tree automovie sandbox

Usage:
  pnpm run experimental <name> [--force] [--no-install]

Options:
  --force       Render over a non-empty experimental/<name>.
  --no-install  Render only, skipping the pack and install.
`;

/**
 * The workspace packages a sandbox installs, dependencies before consumers.
 *
 * This is the scaffold's six (`WORKSPACE_TEMPLATE_VERSION_KEYS`) closed under
 * `@automovie/*` dependencies, which adds `ingest` and `render` through `mcp`.
 * The closure matters because `pnpm pack` rewrites a `workspace:^` range to a
 * plain semver one: any member left unpacked would be resolved from the public
 * registry at a version this monorepo has never published.
 */
const PACKAGES = Object.freeze([
  "interface",
  "engine",
  "render",
  "ingest",
  "viewer",
  "mcp",
  "lint",
  "cli",
]);

/**
 * Files the scaffold ships without a leading dot, because npm strips a real
 * `.gitignore` and `.npmrc` from a published package. Mirrors the rename map in
 * `packages/cli/src/renderScaffold.ts`.
 */
const RENAME = { gitignore: ".gitignore", npmrc: ".npmrc" };

/** Substitute `{{key}}` tokens, throwing on an unknown key. */
const renderTemplate = (content, variables) =>
  content.replace(/\{\{([A-Za-z0-9:_@./-]+)\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined)
      throw new Error(`unknown scaffold variable: {{${key}}}`);
    return value;
  });

/** Every file under `root`, root-relative, in deterministic sorted order. */
const listFiles = (root) => {
  const out = [];
  const walk = (dir) => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
};

/**
 * Reject a name that is not one portable directory segment, so the sandbox
 * cannot escape `experimental/` or collide with a reserved Windows device name.
 * Mirrors the guard in `renderScaffold`.
 */
const assertPortableName = (name) => {
  if (name.length === 0) throw new Error("experimental sandbox needs a name");
  if (
    name === "." ||
    name === ".." ||
    name.endsWith(".") ||
    name.endsWith(" ") ||
    /[<>:"/\\|?*\u0000-\u001f]/u.test(name) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)
  )
    throw new Error(`name "${name}" must be one portable directory segment`);
};

/** Where a sandbox keeps the tarballs it installs from. */
const TARBALL_DIR = ".tarballs";

/**
 * Pack every workspace package into `experimental/<name>/.tarballs`, returning
 * each package's `file:` specifier.
 *
 * Packing rather than linking is the whole design. `pnpm pack` runs each
 * package's `prepack` build and applies `publishConfig`, so the tarball's
 * `exports` name built `lib/*.js` instead of `src/*.ts`. Three consequences
 * follow, and all three were measured before this replaced `link:`.
 *
 * The MCP host starts in seconds instead of 133, which is the difference
 * between a usable sandbox and an unusable one: an MCP client's `initialize`
 * request times out at 60 seconds, and no environment variable moves it, so a
 * linked sandbox handed a live agent zero tools no matter how long it waited.
 *
 * typia's compile-time transform is already applied, so no consumer needs
 * `ttsx` to avoid `typia.llm.controller(): no transform has been configured`,
 * and the scaffold's own `tsx` scripts run unmodified.
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
const packWorkspace = (target) => {
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

/**
 * The scaffold rendered for a sandbox: the published version tokens, with every
 * package this monorepo publishes replaced by its working-tree tarball.
 *
 * `specifiers` is empty on a render that skips the install, which leaves the
 * published ranges in place so the output is still inspectable.
 *
 * Each key names both the `{{version:*}}` token and the directory under
 * `packages/`, which is what makes the substitution a rename.
 */
const renderSandbox = (name, specifiers) => {
  const variables = { name };
  for (const [key, value] of Object.entries(resolveTemplateVersions()))
    variables[`version:${key}`] = value;
  for (const key of WORKSPACE_TEMPLATE_VERSION_KEYS)
    if (specifiers[key] !== undefined)
      variables[`version:${key}`] = specifiers[key];

  const files = {};
  for (const relative of listFiles(SCAFFOLD)) {
    const dir = path.dirname(relative);
    const base = RENAME[path.basename(relative)] ?? path.basename(relative);
    const key = renderTemplate(
      (dir === "." ? base : path.join(dir, base)).split(path.sep).join("/"),
      variables,
    );
    files[key] = renderTemplate(
      fs.readFileSync(path.join(SCAFFOLD, relative), "utf8").replaceAll(
        "\r\n",
        "\n",
      ),
      variables,
    );
  }
  return files;
};

/**
 * The scaffold's Claude settings with the project's own MCP server approved.
 *
 * A `.mcp.json` server starts life unapproved, and `claude mcp list` reports it
 * as `Pending approval (run \`claude\` to approve)`. Approval is interactive and
 * per-project, and `--dangerously-skip-permissions` does not grant it, so a
 * headless `claude -p` session against a fresh sandbox sees no automovie tools
 * at all and cannot be told to wait for any. Since the whole point of a sandbox
 * is to be driven by an agent, the generator grants that approval up front.
 *
 * The scaffold's own `hooks` block is preserved rather than replaced: it wires
 * the guard that refuses writes to compiler-owned paths, which a sandbox needs
 * exactly as much as a real project does.
 */
const claudeSettings = (rendered) => {
  const settings = JSON.parse(rendered);
  return `${JSON.stringify(
    { enableAllProjectMcpServers: true, ...settings },
    null,
    2,
  )}\n`;
};

/**
 * The sandbox's manifest: the scaffold's, plus the two settings the root
 * workspace used to supply.
 *
 * The scaffold is an npm project, so its Sharp stub is an npm-style top-level
 * `overrides` block. pnpm reads `pnpm.overrides` instead and ignores that one,
 * and a standalone install therefore pulls real Sharp in past the capability
 * wall the stub exists to hold. Mirroring it under `pnpm` restores the stub
 * without disturbing the npm form a published project still needs.
 *
 * `onlyBuiltDependencies` is not cosmetic. pnpm 10 refuses to run any
 * dependency lifecycle script that a project has not allowed, and reports the
 * refusal as `ERR_PNPM_IGNORED_BUILDS` with a **non-zero exit**, which the
 * generator would otherwise read as a failed install. The listed three are the
 * builds this dependency graph genuinely needs; Sharp is absent because the
 * override above replaces it with the stub, which has nothing to build.
 */
/**
 * The sandbox's manifest: the scaffold's, with every workspace package pinned
 * to its sibling tarball.
 *
 * Every one of the eight is pinned directly, including `ingest` and `render`
 * which the scaffold never names. `pnpm pack` rewrites each packed package's
 * own `workspace:^` ranges into plain semver, so an unpinned member is fetched
 * from the public registry at a version this monorepo has never published, and
 * the install dies on `ERR_PNPM_FETCH_404 .../@automovie%2Fengine`. A direct
 * entry makes npm satisfy those transitive ranges from the siblings instead,
 * which is the same technique `internals/e2e-tgz.mjs` relies on.
 *
 * pnpm was tried first and its `overrides` do not reach a transitive range from
 * inside a packed tarball; the same 404 surfaced one package later. Installing
 * with npm also restores what the pnpm-specific manifest block used to
 * compensate for: the scaffold's npm-style top-level `overrides` supplies the
 * Sharp stub on its own, and pnpm 10's lifecycle-script allowlist, whose
 * refusal exits non-zero, is not npm's rule.
 */
const sandboxManifest = (rendered, specifiers) => {
  const manifest = JSON.parse(rendered);
  for (const name of PACKAGES) {
    if (specifiers[name] === undefined) continue;
    const dependency = `@automovie/${name}`;
    const table = Object.hasOwn(manifest.devDependencies ?? {}, dependency)
      ? manifest.devDependencies
      : manifest.dependencies;
    table[dependency] = specifiers[name];
  }
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

const main = () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    process.stdout.write(USAGE);
    return 0;
  }
  const name = args.find((arg) => arg.startsWith("-") === false);
  if (name === undefined) {
    process.stderr.write(`a name is required\n\n${USAGE}`);
    return 1;
  }
  try {
    assertPortableName(name);
    const target = path.join(ROOT, "experimental", name);
    // Refuse a non-empty directory, not merely an existing one, matching the
    // CLI's own `--force` semantics. Deleting a sandbox on Windows routinely
    // leaves the directory behind once its `node_modules` links are gone, and
    // an existence check would make that residue block every later attempt.
    if (
      fs.existsSync(target) &&
      fs.readdirSync(target).length !== 0 &&
      args.includes("--force") === false
    )
      throw new Error(
        `experimental/${name} is not empty. Pass --force to render over it, or remove it first.`,
      );

    // Packing writes into the target, so it precedes the render that fills it.
    const install = args.includes("--no-install") === false;
    const specifiers = install ? packWorkspace(target) : {};

    const files = renderSandbox(name, specifiers);
    files["package.json"] = sandboxManifest(files["package.json"], specifiers);
    files[".claude/settings.json"] = claudeSettings(
      files[".claude/settings.json"],
    );
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(target, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, "utf8");
    }
    process.stdout.write(
      `Rendered ${Object.keys(files).length} files into experimental/${name}\n`,
    );

    if (install) {
      process.stdout.write("Installing the sandbox (npm install)\n");
      const installed = spawnSync(
        "npm",
        ["install", "--no-audit", "--no-fund"],
        {
          cwd: target,
          stdio: "inherit",
          shell: process.platform === "win32",
        },
      );
      if (installed.status !== 0)
        throw new Error(
          `npm install failed in experimental/${name}. Fix it there, then re-run with --force.`,
        );
    }

    process.stdout.write(
      `\nDrive it with Claude Code:\n` +
        `  cd experimental/${name}\n` +
        `  claude\n\n` +
        `Drive it with Codex (its MCP servers come from its own config, not .mcp.json):\n` +
        `  codex mcp add automovie -- npx tsx ${path.join(target, "scripts", "mcp.ts")}\n` +
        `  cd experimental/${name} && codex\n\n` +
        `The sandbox installs packed working-tree tarballs, so rerun this command\n` +
        `with --force after changing a package under packages/.\n` +
        `experimental/ is gitignored: delete the directory when the experiment is done.\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

process.exitCode = main();
