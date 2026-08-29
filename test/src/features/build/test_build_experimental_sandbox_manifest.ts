import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { type IExperimentalModule, loadBuildModule } from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

const rendered = (): string =>
  `${JSON.stringify(
    {
      dependencies: {
        "@automovie/engine": "^0.1.0",
        "@automovie/interface": "^0.1.0",
        three: "^0.169.0",
      },
      devDependencies: { automovie: "^0.1.0", typescript: "^5.9.3" },
      name: "sandbox",
      private: true,
    },
    null,
    2,
  )}\n`;

interface IManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

/**
 * A rendered scaffold manifest is repinned onto working-tree tarballs without
 * moving a dependency between its tables.
 *
 * Every workspace package is pinned directly, including the ones the scaffold
 * never names, because `pnpm pack` rewrites each packed package's own
 * `workspace:^` ranges into plain semver: an unpinned member is fetched from the
 * public registry at a version this monorepo has never published, and the
 * install dies one package after the omission. The table a dependency already
 * sits in is part of the scaffold's contract, so a pin that promoted a
 * development tool into runtime dependencies would change what a generated
 * project ships.
 *
 * Scenarios:
 *
 * 1. A runtime dependency is repinned in place, to the `file:` specifier and not
 *    to a version range.
 * 2. A development dependency is repinned inside `devDependencies`. The
 *    command-line package is the case that matters, because it publishes as
 *    `automovie` rather than under the `@automovie/` scope.
 * 3. A package with no specifier keeps the range the scaffold rendered, which is
 *    what `--no-install` relies on to leave a manifest alone.
 * 4. A dependency the workspace does not own is untouched.
 * 5. A workspace package the scaffold never names is added to `dependencies`.
 *    That is the point rather than a side effect: `evidence`, `ingest`, and
 *    `render` are absent from the rendered manifest, and leaving them absent is
 *    exactly the omission that resolves them from the public registry.
 * 6. `devDependencies` gains nothing, so an added pin cannot promote itself into
 *    the development table it was never declared in.
 * 7. The result is two-space JSON terminated by a newline, matching what the
 *    scaffold rendered, so a refresh does not reformat the file it rewrites.
 * 8. A manifest with no `devDependencies` at all is still repinned, because
 *    `Object.hasOwn` is asked about a table that may not exist.
 */
const assertBuildExperimentalSandboxManifest = async (): Promise<void> => {
  const { sandboxManifest } =
    await loadBuildModule<IExperimentalModule>("experimental.ts");
  const output = sandboxManifest(rendered(), {
    cli: "file:./.tarballs/automovie-0.1.0-aaaaaaaaaaaa.tgz",
    engine: "file:./.tarballs/automovie-engine-0.1.0-bbbbbbbbbbbb.tgz",
    render: "file:./.tarballs/automovie-render-0.1.0-cccccccccccc.tgz",
  });
  const manifest = JSON.parse(output) as IManifest;
  const before = JSON.parse(rendered()) as IManifest;

  const runtimeOnly = sandboxManifest(
    `${JSON.stringify({ dependencies: { automovie: "^0.1.0" } }, null, 2)}\n`,
    { cli: "file:./.tarballs/automovie-0.1.0-dddddddddddd.tgz" },
  );

  TestValidator.equals(
    "the sandbox manifest repins workspace packages inside their own tables",
    namedFacts([
      [
        "a runtime dependency is repinned in place",
        () =>
          manifest.dependencies["@automovie/engine"] ===
          "file:./.tarballs/automovie-engine-0.1.0-bbbbbbbbbbbb.tgz",
      ],
      [
        "a development dependency stays in devDependencies",
        () =>
          manifest.devDependencies["automovie"] ===
            "file:./.tarballs/automovie-0.1.0-aaaaaaaaaaaa.tgz" &&
          Object.hasOwn(manifest.dependencies, "automovie") === false,
      ],
      [
        "an unspecified package keeps its rendered range",
        () =>
          manifest.dependencies["@automovie/interface"] ===
          before.dependencies["@automovie/interface"],
      ],
      [
        "a foreign dependency is untouched",
        () => manifest.dependencies["three"] === before.dependencies["three"],
      ],
      [
        "a package the scaffold never names is pinned into dependencies",
        () =>
          manifest.dependencies["@automovie/render"] ===
            "file:./.tarballs/automovie-render-0.1.0-cccccccccccc.tgz" &&
          Object.keys(manifest.dependencies).join() ===
            `${Object.keys(before.dependencies).join()},@automovie/render`,
      ],
      [
        "devDependencies gains nothing",
        () =>
          Object.keys(manifest.devDependencies).join() ===
          Object.keys(before.devDependencies).join(),
      ],
      [
        "the rendered shape is preserved",
        () => output === `${JSON.stringify(manifest, null, 2)}\n`,
      ],
      [
        "a manifest without devDependencies is repinned",
        () =>
          (JSON.parse(runtimeOnly) as IManifest).dependencies["automovie"] ===
          "file:./.tarballs/automovie-0.1.0-dddddddddddd.tgz",
      ],
    ]),
    {
      "a runtime dependency is repinned in place": true,
      "a development dependency stays in devDependencies": true,
      "an unspecified package keeps its rendered range": true,
      "a foreign dependency is untouched": true,
      "a package the scaffold never names is pinned into dependencies": true,
      "devDependencies gains nothing": true,
      "the rendered shape is preserved": true,
      "a manifest without devDependencies is repinned": true,
    },
  );
};

/** Exercise the sandbox manifest repin through a runner that can load the build tools. */
export const test_build_experimental_sandbox_manifest = (): void => {
  runBuildScenarioChild(__filename, "test_build_experimental_sandbox_manifest");
};

runWhenBuildScenarioChild(
  "test_build_experimental_sandbox_manifest",
  assertBuildExperimentalSandboxManifest,
);
