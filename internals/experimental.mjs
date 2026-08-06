// Create `experimental/<name>`: the CLI's shipped starter, rewired to consume
// this working tree instead of npm, so a change to any package can be driven by
// a live coding agent without a publish, an `npm pack`, or a build step.
//
// This is repository-local tooling on purpose. `packages/cli/scaffold/**` and
// the published `@automovie/cli` surface stay untouched: a real user's project
// must keep targeting released versions and `tsx`, and only the sandbox differs
// from that.
//
// Three rewrites separate a sandbox from a released project. Each one is
// explained at the function that performs it.
//
// 1. `renderSandbox` points every `@automovie/*` dependency at its package
//    directory with `link:`, so the sandbox reads source instead of tarballs
//    without joining the root workspace.
// 2. `mcpConfig` launches the MCP host under `ttsx` rather than `tsx`, because
//    a link resolves `@automovie/mcp` through its `exports` to `src/*.ts` and
//    that source has not been through typia's compile-time transform yet.
//    `tsx` runs no transformer, so the host dies on
//    `typia.llm.controller(): no transform has been configured` before it can
//    serve a single tool. `publishConfig.main` does not rescue this: it applies
//    at publish time, so building the workspace never changes what the link
//    resolves to.
// 3. `hostTsconfig` gives the host a lint config of its own, so ttsx's project
//    check cannot gate the server on a review contract the sandbox has not had
//    the chance to satisfy yet.
//
// `sandboxManifest` then restores the two settings the root workspace used to
// supply to an installed project.
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORKSPACE_TEMPLATE_VERSION_KEYS,
  resolveTemplateVersions,
} from "../packages/cli/build/templateVersions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAFFOLD = path.join(ROOT, "packages", "cli", "scaffold");

const USAGE = `create a source-linked automovie sandbox

Usage:
  pnpm run experimental <name> [--force] [--no-install]

Options:
  --force       Render over a non-empty experimental/<name>.
  --no-install  Render only, skipping the install that creates the links.
`;

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

/**
 * The scaffold rendered for a source-linked sandbox: the published version
 * tokens, with every package this monorepo publishes replaced by a `link:` to
 * its directory.
 *
 * `link:` rather than `workspace:^` is what keeps the sandbox out of the root
 * workspace. A workspace member writes its own importer into the tracked
 * `pnpm-lock.yaml`, and `experimental/` is gitignored, so committing that lock
 * would describe an importer whose directory does not exist on any other
 * checkout. `link:` produces the same symlink, and the link resolves through
 * the package's `exports` to `src/*.ts` exactly as a workspace link does, so
 * nothing about consuming working-tree source changes.
 *
 * Each key names both the `{{version:*}}` token and the directory under
 * `packages/`, which is what makes the substitution a rename.
 */
const renderSandbox = (name) => {
  const variables = { name };
  for (const [key, value] of Object.entries(resolveTemplateVersions()))
    variables[`version:${key}`] = value;
  for (const key of WORKSPACE_TEMPLATE_VERSION_KEYS)
    variables[`version:${key}`] = `link:../../packages/${key}`;

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
 * The MCP host launcher. `node <ttsx entry>` rather than the `ttsx` bin keeps
 * this working on Windows, where `node_modules/.bin/ttsx` is a `.CMD` shim that
 * `node` cannot execute, and off a configured PATH.
 */
const TTSX_ENTRY = "node_modules/ttsc/lib/launcher/ttsx.js";

/** The host's own tsconfig and lint config, separate from the project's. */
const HOST_TSCONFIG = "tsconfig.mcp.json";
const HOST_LINT_CONFIG = "lint.host.config.ts";

/**
 * The host's project settings: the scaffold's own tsconfig, pointed at a
 * rule-free lint config.
 *
 * `ttsx` type-checks the project before it runs anything, and ttsc discovers
 * every installed plugin, so a scaffold's `@ttsc/lint` and its `automovie`
 * rules run on the way to starting the MCP server. Those rules gate the
 * production's review contract: a project whose scenes are not yet realized and
 * reviewed fails `automovie/screenplay-contract`, the project check fails, and
 * the host never starts. A freshly created sandbox is exactly that project, so
 * a host gated on it would only start once the film was already finished.
 *
 * The published scaffold does not hit this because `tsx` type-checks nothing.
 * Selecting a rule-free config for the host restores that property for the one
 * process that needs it, without touching the project's own gate: the sandbox's
 * `npm run lint` and `npm run lint:source` still read `lint.config.ts` and run
 * the full rule set, which is where the review contract belongs.
 *
 * Narrowing `include` and pinning `plugins` were both tried first and neither
 * works: the rule reads `.automovie/design/screenplay/index.json` off disk
 * rather than from the program, and an explicit `plugins` entry adds to package
 * auto-discovery instead of replacing it. `configFile` is the documented lever,
 * named by `@ttsc/lint`'s own missing-config error.
 */
const hostTsconfig = () =>
  `${JSON.stringify(
    {
      extends: "./tsconfig.json",
      compilerOptions: {
        plugins: [{ transform: "@ttsc/lint", configFile: `./${HOST_LINT_CONFIG}` }],
        noEmit: true,
      },
    },
    null,
    2,
  )}\n`;

/** A valid `@ttsc/lint` config that enables nothing. */
const hostLintConfig = () =>
  `import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The MCP host's lint config. Empty on purpose: the host must start while the
 * production is still mid-work, so it cannot be gated on the review contract
 * that \`lint.config.ts\` enforces for the project itself.
 */
const config = {
  rules: {},
} satisfies ITtscLintConfig;

export default config;
`;

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
const sandboxManifest = (rendered) => {
  const manifest = JSON.parse(rendered);
  manifest.pnpm = {
    overrides: {
      "@huggingface/transformers>sharp": "file:vendor/sharp-disabled",
    },
    onlyBuiltDependencies: ["esbuild", "onnxruntime-node", "protobufjs"],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

const mcpConfig = () =>
  `${JSON.stringify(
    {
      mcpServers: {
        automovie: {
          command: "node",
          args: [
            `\${CLAUDE_PROJECT_DIR:-.}/${TTSX_ENTRY}`,
            "-P",
            `\${CLAUDE_PROJECT_DIR:-.}/${HOST_TSCONFIG}`,
            "${CLAUDE_PROJECT_DIR:-.}/scripts/mcp.ts",
          ],
        },
      },
    },
    null,
    2,
  )}\n`;

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

    const files = renderSandbox(name);
    files[".mcp.json"] = mcpConfig();
    files[HOST_TSCONFIG] = hostTsconfig();
    files[HOST_LINT_CONFIG] = hostLintConfig();
    files["package.json"] = sandboxManifest(files["package.json"]);
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(target, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, "utf8");
    }
    process.stdout.write(
      `Rendered ${Object.keys(files).length} files into experimental/${name}\n`,
    );

    if (args.includes("--no-install") === false) {
      process.stdout.write("Installing the sandbox (pnpm install)\n");
      // `--ignore-workspace` keeps this a standalone project. Without it pnpm
      // walks up, finds the repository's `pnpm-workspace.yaml`, and refuses a
      // directory that is not one of its members.
      const install = spawnSync("pnpm", ["install", "--ignore-workspace"], {
        cwd: target,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      if (install.status !== 0)
        throw new Error(
          `pnpm install failed in experimental/${name}. Fix it there, then re-run with --force.`,
        );
    }

    process.stdout.write(
      `\nDrive it with Claude Code:\n` +
        `  cd experimental/${name}\n` +
        `  claude\n\n` +
        `Drive it with Codex (its MCP servers come from its own config, not .mcp.json):\n` +
        `  codex mcp add automovie -- node ${path.join(target, ...TTSX_ENTRY.split("/"))} -P ${path.join(target, HOST_TSCONFIG)} ${path.join(target, "scripts", "mcp.ts")}\n` +
        `  cd experimental/${name} && codex\n\n` +
        `The sandbox reads packages/*/src directly, so an edit is live on the next host start.\n` +
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
