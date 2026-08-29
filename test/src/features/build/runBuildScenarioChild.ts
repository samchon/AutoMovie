import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

/** Names which scenario a child process was started to execute. */
export const BUILD_CHILD_ENV = "AUTOMOVIE_BUILD_SCENARIO_CHILD";

/**
 * Execute one build-tool scenario in a `tsx` child and fail with its output.
 *
 * The suite runs under `ttsx`, which cannot load `build/*.ts` in this process.
 * Three routes were measured and all three failed. A static import is `TS6059`,
 * because the suite's `tsconfig.json` roots at `test/src` and the build tools
 * are not a workspace package, so nothing resolves them through `node_modules`.
 * `tsImport` throws `ERR_METHOD_NOT_IMPLEMENTED: The resolveSync() method is not
 * implemented`, because `ttsx` installs its own module hooks. A bare
 * `require()` of the absolute path is worse than either: it emitted
 * `experimental.js`, `experimental.js.map`, and `experimental.d.ts` beside the
 * sources, which the repository's own zero-JavaScript invariant then refused by
 * name, and the module it handed back exported `renderTemplate` rather than
 * anything `build/experimental.ts` declares.
 *
 * Running the tools under `tsx` is therefore not a workaround but the faithful
 * measurement: `pnpm run build:tgz` and `pnpm run experimental` execute these
 * files as a process entry under a plain TypeScript runner, which is what the
 * child reproduces. `test_cli_capture_cleanup` reaches a scaffold script the
 * same way.
 */
export const runBuildScenarioChild = (file: string, name: string): void => {
  const environment = { ...process.env };
  // `ttsx` exports its own loader through `NODE_OPTIONS`, and inheriting it
  // would put the child back under the hooks this exists to escape.
  delete environment.NODE_OPTIONS;
  const child = spawnSync(
    process.execPath,
    [createRequire(file).resolve("tsx/cli"), file],
    { encoding: "utf8", env: { ...environment, [BUILD_CHILD_ENV]: name } },
  );
  if (child.status !== 0)
    throw new Error(
      `${name} failed in its typed consumer (${String(child.status)}):\n${child.stdout}${child.stderr}`,
    );
};

/** Run a scenario body when this process is that scenario's own child. */
export const runWhenBuildScenarioChild = (
  name: string,
  body: () => Promise<void>,
): void => {
  if (process.env[BUILD_CHILD_ENV] !== name) return;
  void body().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
};
