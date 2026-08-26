import { renderScaffold } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

const CACHE_DIRECTORY = "node_modules/.cache/ttsc";

/**
 * Every generated TypeScript tool invocation keeps compiler state inside the
 * generated project that owns it.
 *
 * A generated project can live below the AutoMovie workspace while remaining
 * a standalone install. Without an explicit cache root, `ttsc` walks upward to
 * the workspace marker and shares the repository's plugin and Go build caches.
 * The manifest is the one execution surface a generated project launches
 * through, so this pins its whole population and refuses an empty or partial
 * inventory.
 *
 * Scenarios:
 *
 * 1. Every npm script that directly invokes `ttsc` or `ttsx` passes the same
 *    project-relative cache directory before its TypeScript entry point.
 * 2. The expected direct-script inventory is exact, so a renamed, added, or
 *    silently delegated launcher cannot escape the check.
 */
export const test_cli_scaffold_toolchain_cache = (): void => {
  const rendered = renderScaffold({ name: "cache-owned-film" });
  const manifest = JSON.parse(rendered["package.json"]!) as {
    scripts: Record<string, string>;
  };
  const direct = Object.entries(manifest.scripts)
    .flatMap(([name, script]) =>
      script
        .split("&&")
        .map((command) => command.trim())
        .filter((command) => /^(?:ttsc|ttsx)\b/u.test(command))
        .map((command) => ({ command, name })),
    )
    .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));

  TestValidator.equals(
    "every generated npm TypeScript launcher owns a project-local cache",
    {
      invocations: direct.map(({ name }) => name),
      unscoped: direct
        .filter(({ command }) => hasProjectLocalCache(command) === false)
        .map(({ name }) => name),
    },
    {
      invocations: [
        "building:report",
        "capture:doctor",
        "capture:install",
        "compile",
        "derive:example",
        "design",
        "format",
        "lint",
        "lint:source",
        "preview",
        "render",
        "test",
        "texture:scale",
        "verify",
      ],
      unscoped: [],
    },
  );
};

/** Whether the cache option exists before any TypeScript entry point. */
const hasProjectLocalCache = (command: string): boolean => {
  const cache = command.indexOf(`--cache-dir ${CACHE_DIRECTORY}`);
  const entry = command.search(/\s\S+\.(?:cts|mts|ts|tsx)(?:\s|$)/u);
  return cache >= 0 && (entry < 0 || cache < entry);
};
