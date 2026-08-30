import { renderScaffold } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** The notional install root a generated project's launchers resolve against. */
const PROJECT_ROOT = path.resolve(path.sep, "generated-project");

/** One `ttsc`/`ttsx` invocation a generated npm script launches directly. */
interface ILauncher {
  command: string;
  script: string;
}

/**
 * Every `ttsc`/`ttsx` invocation a generated npm script starts, in the order the
 * manifest declares them.
 *
 * Read from the rendered manifest rather than from a remembered list, because
 * the population is the thing under test: a launcher that is added, renamed, or
 * split out of an existing script has to answer the same question, and a list
 * would answer it only for the scripts that existed when the list was written.
 *
 * What it reads is a segment that starts with the launcher's own name, which is
 * every spelling the manifest currently uses. A script that reached the same
 * compiler through `npx`, through `node` and a resolved path, or through another
 * script this reading cannot follow would not be counted, and that limit is
 * recorded rather than papered over with a wider pattern nothing exercises.
 */
const launchers = (manifest: string): ILauncher[] =>
  Object.entries(
    (JSON.parse(manifest) as { scripts: Record<string, string> }).scripts,
  ).flatMap(([script, command]) =>
    command
      .split("&&")
      .map((segment) => segment.trim())
      .filter((segment) => /^(?:ttsc|ttsx)\b/u.test(segment))
      .map((segment) => ({ command: segment, script })),
  );

/**
 * Where one invocation's compiler cache lands, or `null` when it never says.
 *
 * A `--cache-dir` that arrives after the TypeScript entry point is an argument
 * to the program rather than to the launcher, so it is read as absent: the
 * option has to be on the launcher's own side of the entry to configure it.
 */
const cacheRoot = (command: string): string | null => {
  const option = /--cache-dir[ =]([^\s]+)/u.exec(command);
  if (option === null) return null;
  const entry = command.search(/\s\S+\.(?:cts|mts|ts|tsx)(?:\s|$)/u);
  if (entry >= 0 && option.index > entry) return null;
  return path.resolve(PROJECT_ROOT, option[1]!);
};

/** Whether a resolved cache root stays inside the generated project. */
const contained = (root: string | null): boolean =>
  root !== null &&
  (root === PROJECT_ROOT || root.startsWith(`${PROJECT_ROOT}${path.sep}`));

/**
 * A generated project's compiler cache stays inside the project that owns it.
 *
 * `ttsc` resolves a relative `--cache-dir` against the project root, and with no
 * `--cache-dir` and no `TTSC_CACHE_DIR` it falls back to
 * `<workspaceRoot>/node_modules/.cache/ttsc`, where `workspaceRoot` is the
 * NEAREST ancestor holding `pnpm-workspace.yaml` or a `workspaces` manifest
 * (`node_modules/ttsc/lib/plugin/internal/buildSourcePlugin.js`,
 * `resolveSourceBuildCacheRoot` and `resolveWorkspaceRoot`). A generated project
 * is routinely created below the AutoMovie checkout while remaining a standalone
 * install, so a launcher that omits the option writes its plugin and Go build
 * caches into the repository above it instead of into itself. Containment is
 * therefore a property of the generated product, not a spelling preference,
 * which is why what is asserted is where each cache resolves rather than which
 * scripts exist or how the option is written.
 *
 * Scenarios:
 *
 * 1. The manifest really launches the toolchain, so an empty population cannot
 *    report the same green as a project whose launchers are all scoped.
 * 2. Every launcher's cache resolves inside the generated project, and the ones
 *    that do not are named rather than counted.
 * 3. The same reading refuses a launcher with no option at all, one whose cache
 *    escapes upward, and one that passes the option after its entry point, where
 *    it configures the program rather than the launcher. Without these the check
 *    would report the same green over a reading that accepts everything.
 */
export const test_cli_scaffold_toolchain_cache = (): void => {
  const rendered = renderScaffold({ name: "cache-owned-film" });
  const manifest = rendered["package.json"];
  if (manifest === undefined)
    throw new Error("The rendered scaffold must carry a project manifest.");
  const direct = launchers(manifest);

  TestValidator.equals(
    "the generated manifest launches the toolchain at all",
    direct.length > 0,
    true,
  );

  TestValidator.equals(
    "every generated toolchain launcher keeps its cache inside the project",
    direct
      .filter(({ command }) => contained(cacheRoot(command)) === false)
      .map(({ script }) => script),
    [],
  );

  TestValidator.equals(
    "a launcher that does not scope its cache is read as unscoped",
    namedFacts([
      [
        "no option at all",
        () => cacheRoot("ttsx -P tsconfig.json a.ts") === null,
      ],
      [
        "an escaping option",
        () =>
          contained(
            cacheRoot("ttsx --cache-dir ../shared -P tsconfig.json a.ts"),
          ) === false,
      ],
      [
        "an option behind the entry point",
        () => cacheRoot("ttsx -P tsconfig.json a.ts --cache-dir x") === null,
      ],
      [
        "and a scoped option is accepted",
        () =>
          contained(
            cacheRoot("ttsx --cache-dir node_modules/.cache/ttsc a.ts"),
          ) === true,
      ],
    ]),
    {
      "no option at all": true,
      "an escaping option": true,
      "an option behind the entry point": true,
      "and a scoped option is accepted": true,
    },
  );
};
