import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

/**
 * Pin what the experimental generator emits, which is the whole reason a
 * sandbox can be driven by a live agent against working-tree source.
 *
 * Three of these are not cosmetic. `link:` is what keeps the sandbox out of the
 * tracked lockfile while still resolving through each package's `exports` to
 * `src/*.ts`. The `ttsx` launcher is what applies typia's compile-time
 * transform to that linked source, which `tsx` does not do at all. The host's
 * own lint config is what lets the server start while the production is still
 * mid-work, since ttsx type-checks before it runs and the project's own
 * `automovie/screenplay-contract` rule fails on any unrealized screenplay.
 *
 * Scenarios:
 *
 * 1. Every `@automovie/*` dependency renders as `link:../../packages/<name>`,
 *    never `workspace:^`, and the sandbox declares Sharp's stub under `pnpm`
 *    (pnpm ignores the scaffold's npm-style top-level `overrides`) plus the
 *    lifecycle allowlist that keeps a standalone install from exiting
 *    non-zero.
 * 2. `.mcp.json` launches the host through the `ttsx` entry and the host tsconfig,
 *    and names `tsx` nowhere.
 * 3. `tsconfig.mcp.json` selects a rule-free lint config by `configFile`, and that
 *    config exists and enables no rules.
 * 4. A second run over the rendered sandbox fails without `--force`, and the
 *    message names the directory.
 * 5. `--force` renders over the same directory and succeeds.
 */
export const test_workspace_experimental_sandbox = (): void => {
  let failure: { error: unknown } | undefined = undefined;
  try {
    TestValidator.equals("the generator renders", generate().status, 0);

    const manifest = JSON.parse(readSandbox("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      pnpm: {
        overrides: Record<string, string>;
        onlyBuiltDependencies: string[];
      };
    };
    const automovie = Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    }).filter(([name]) => name.startsWith("@automovie/"));
    TestValidator.predicate(
      "every automovie dependency links to a package directory",
      automovie.length !== 0 &&
        automovie.every(
          ([name, range]) =>
            range === `link:../../packages/${name.slice("@automovie/".length)}`,
        ),
    );
    TestValidator.equals(
      "pnpm reads the Sharp stub the scaffold declares for npm",
      manifest.pnpm.overrides["@huggingface/transformers>sharp"],
      "file:vendor/sharp-disabled",
    );
    TestValidator.predicate(
      "a standalone install is allowed to run the builds it needs",
      ["esbuild", "onnxruntime-node", "protobufjs"].every((dependency) =>
        manifest.pnpm.onlyBuiltDependencies.includes(dependency),
      ),
    );

    const mcp = readSandbox(".mcp.json");
    TestValidator.predicate(
      "the host launches through ttsx and the host tsconfig",
      mcp.includes("node_modules/ttsc/lib/launcher/ttsx.js") &&
        mcp.includes("tsconfig.mcp.json") &&
        mcp.includes("scripts/mcp.ts"),
    );
    TestValidator.equals(
      "the host never launches through tsx",
      mcp.includes("tsx/dist/cli.mjs"),
      false,
    );

    const host = JSON.parse(readSandbox("tsconfig.mcp.json")) as {
      compilerOptions: { plugins: Array<Record<string, string>> };
    };
    TestValidator.predicate(
      "the host selects a lint config of its own",
      host.compilerOptions.plugins.some(
        (plugin) =>
          plugin.transform === "@ttsc/lint" &&
          plugin.configFile === "./lint.host.config.ts",
      ),
    );
    TestValidator.predicate(
      "the host lint config enables no rules",
      /rules:\s*\{\s*\}/.test(readSandbox("lint.host.config.ts")),
    );

    const repeated = generate();
    TestValidator.equals("a non-empty sandbox is refused", repeated.status, 1);
    TestValidator.predicate(
      "the refusal names the sandbox and the escape",
      repeated.stderr.includes(NAME) && repeated.stderr.includes("--force"),
    );
    TestValidator.equals(
      "--force renders over it",
      generate("--force").status,
      0,
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
