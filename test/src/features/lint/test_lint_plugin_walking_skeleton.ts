import { renderScaffold, writeFiles } from "@automovie/cli";
import type {
  IAutoMovieAcceptanceScenario,
  IAutoMovieReviewEvidence,
  IAutoMovieStoredReview,
} from "@automovie/interface";
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface IRunResult {
  output: string;
  status: number | null;
}

interface IFixture {
  cleanup(): void;
  directory: string;
}

interface ILintFixtureFailure {
  error: unknown;
}

class LintFixtureCleanupError extends AggregateError {}

/**
 * Dispose a walking-skeleton fixture without hiding the failure it guarded.
 *
 * Disposal removes a temporary tree recursively, which throws on a busy or
 * partially locked directory. Without this the disposal exception replaces the
 * lint diagnostic the run exists to report.
 */
export const preserveLintFixtureCleanup = (
  failure: ILintFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new LintFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Lint walking-skeleton fixture disposal failed after the run failed.",
    );
  }
};

const repositoryRoot = path.resolve(__dirname, "../../../..");
// Share the toolchain's own plugin cache instead of a private one. The Go lint
// and typia plugins are content-addressed there and the suite has already built
// them by the time this test runs, so a private directory only bought this test
// a second multi-minute build of the same binaries.
const pluginCache = path.join(repositoryRoot, "node_modules", ".cache", "ttsc");

/**
 * Environment for a toolchain process that represents an independent user
 * shell. The test suite itself runs through `ttsx`, whose source-runtime
 * preload and manifest deliberately propagate to descendants through these
 * variables. Letting them cross this fixture boundary makes the scaffold's own
 * `tsx` loader collide with the outer synchronous module hook.
 */
const isolatedToolchainEnvironment = (): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  delete environment.NODE_OPTIONS;
  delete environment.TTSX_RUNTIME_MANIFEST;
  return environment;
};

const DEPENDENCY_PUBLIC_ENTRIES: Readonly<Record<string, string>> = {
  "@modelcontextprotocol/sdk": "@modelcontextprotocol/sdk/server/stdio.js",
};
const IMPORT_ONLY_DEPENDENCIES = new Set(["libopus-wasm"]);

const linkDirectory = (source: string, destination: string): void => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(
    source,
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const installedDependencyRoot = (name: string): string | null => {
  for (const modules of require.resolve.paths(name) ?? []) {
    const directory = path.join(modules, ...name.split("/"));
    const manifest = path.join(directory, "package.json");
    if (fs.existsSync(manifest) === false) continue;
    const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      name?: unknown;
    };
    if (parsed.name === name) return fs.realpathSync(directory);
  }
  return null;
};

const dependencyRoot = (name: string): string => {
  let entry: string;
  try {
    entry = require.resolve(DEPENDENCY_PUBLIC_ENTRIES[name] ?? name);
  } catch (error) {
    if (
      name.startsWith("@types/") === false &&
      IMPORT_ONLY_DEPENDENCIES.has(name) === false
    )
      throw error;
    // Type-only packages and import-only ESM packages can be installed without
    // exposing any entry to CommonJS `require.resolve`. Locate those packages
    // through Node's own module search roots, but still require the manifest's
    // declared name to match before linking the directory.
    const installed = installedDependencyRoot(name);
    if (installed !== null) return installed;
    throw error;
  }
  let directory = path.dirname(entry);
  for (;;) {
    const manifest = path.join(directory, "package.json");
    if (fs.existsSync(manifest)) {
      const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
        name?: unknown;
      };
      if (parsed.name === name) return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory)
      throw new Error(
        `Resolved dependency "${name}" has no matching package.json ancestor.`,
      );
    directory = parent;
  }
};

const workspacePackageRoot = (name: string): string | null => {
  if (name.startsWith("@automovie/") === false) return null;
  const root = path.join(repositoryRoot, "packages", name.slice(11));
  return fs.existsSync(path.join(root, "package.json")) ? root : null;
};

const linkDependencies = (
  directory: string,
  names: readonly string[],
): void => {
  const modules = path.join(directory, "node_modules");
  for (const name of names)
    linkDirectory(
      workspacePackageRoot(name) ?? dependencyRoot(name),
      path.join(modules, ...name.split("/")),
    );
};

const createFixture = (props: {
  files: Record<string, string>;
  lintConfig: string;
  name: string;
}): IFixture => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), `automovie-lint-${props.name}-`),
  );
  const write = (relative: string, content: string): void => {
    const location = path.join(directory, relative);
    fs.mkdirSync(path.dirname(location), { recursive: true });
    fs.writeFileSync(location, content, "utf8");
  };

  write(
    "package.json",
    JSON.stringify(
      {
        name: `fixture-${props.name}`,
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );
  write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          noEmit: true,
          plugins: [{ transform: "@ttsc/lint" }],
          strict: true,
          target: "esnext",
        },
        include: ["src", "lint.config.ts"],
      },
      null,
      2,
    ),
  );
  write("lint.config.ts", props.lintConfig);
  for (const [relative, content] of Object.entries(props.files))
    write(relative, content);

  linkDependencies(directory, [
    "@automovie/lint",
    "@ttsc/lint",
    "ttsc",
    "typescript",
  ]);

  return {
    directory,
    cleanup: () => {
      for (let attempt = 0; attempt < 3; ++attempt)
        try {
          fs.rmSync(directory, {
            force: true,
            maxRetries: 3,
            recursive: true,
          });
          return;
        } catch {
          // Windows can retain a toolchain handle briefly after child exit.
        }
    },
  };
};

const createScaffoldFixture = (name: string): IFixture => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), `automovie-lint-scaffold-${name}-`),
  );
  const files = renderScaffold({ name: `lint-${name}` });
  writeFiles(directory, files);
  fs.rmSync(path.join(directory, ".automovie", "design"), {
    force: true,
    recursive: true,
  });
  const manifest = JSON.parse(files["package.json"]!) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  linkDependencies(directory, [
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]);
  return {
    directory,
    cleanup: () =>
      fs.rmSync(directory, {
        force: true,
        maxRetries: 3,
        recursive: true,
      }),
  };
};

const runCheck = (directory: string): IRunResult => {
  const launcher = path.join(
    dependencyRoot("ttsc"),
    "lib",
    "launcher",
    "ttsc.js",
  );
  const result: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [launcher, "check", "-p", "tsconfig.json"],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...isolatedToolchainEnvironment(),
        TTSC_CACHE_DIR: pluginCache,
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 900_000,
    },
  );
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status,
  };
};

const runScaffoldSourceLint = (props: {
  mutate?: (directory: string) => void;
  name: string;
}): IRunResult => {
  const fixture = createScaffoldFixture(props.name);
  let scaffoldRunFailure: ILintFixtureFailure | undefined;
  try {
    props.mutate?.(fixture.directory);
    const invocation =
      process.platform === "win32"
        ? {
            args: ["/d", "/s", "/c", "npm.cmd run lint:source"],
            command: process.env.ComSpec ?? "cmd.exe",
          }
        : { args: ["run", "lint:source"], command: "npm" };
    const result: SpawnSyncReturns<string> = spawnSync(
      invocation.command,
      invocation.args,
      {
        cwd: fixture.directory,
        encoding: "utf8",
        env: {
          ...isolatedToolchainEnvironment(),
          PATH: [
            path.join(repositoryRoot, "test", "node_modules", ".bin"),
            path.join(repositoryRoot, "node_modules", ".bin"),
            process.env.PATH ?? "",
          ].join(path.delimiter),
          TTSC_CACHE_DIR: pluginCache,
        },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 900_000,
        windowsHide: true,
      },
    );
    return {
      output: `${result.stdout ?? ""}${result.stderr ?? ""}${String(result.error ?? "")}`,
      status: result.status,
    };
  } catch (error) {
    scaffoldRunFailure = { error };
    throw error;
  } finally {
    preserveLintFixtureCleanup(scaffoldRunFailure, () => {
      fixture.cleanup();
    });
  }
};

const runFixture = (props: {
  files: Record<string, string>;
  lintConfig: string;
  mutate?: (directory: string) => void;
  name: string;
}): IRunResult => {
  const fixture = createFixture(props);
  let fixtureRunFailure: ILintFixtureFailure | undefined;
  try {
    props.mutate?.(fixture.directory);
    return runCheck(fixture.directory);
  } catch (error) {
    fixtureRunFailure = { error };
    throw error;
  } finally {
    preserveLintFixtureCleanup(fixtureRunFailure, () => {
      fixture.cleanup();
    });
  }
};

const automoviePluginPrelude = [
  'import type {} from "@automovie/lint";',
  'import type { ITtscLintPlugin } from "@ttsc/lint";',
  'import { createRequire } from "node:module";',
  'import path from "node:path";',
  "",
  "const require = createRequire(import.meta.url);",
  "const automovie = {",
  "  source: path.join(",
  '    path.dirname(require.resolve("@automovie/lint/package.json")),',
  '    "native",',
  "  ),",
  "} satisfies ITtscLintPlugin;",
  "",
] as const;

const sentinelConfig = [
  ...automoviePluginPrelude,
  "export default {",
  "  plugins: { automovie },",
  '  rules: { "automovie/template-sentinel": "error" },',
  "};",
  "",
].join("\n");

const presenceConfig = [
  ...automoviePluginPrelude,
  "export default {",
  "  plugins: { automovie },",
  "  rules: {",
  '    "automovie/state-presence": [',
  '      "error",',
  "      {",
  "        slots: [",
  "          {",
  '            name: "screenplay-index",',
  '            files: [".automovie/screenplay/index.json"],',
  "            requires: [],",
  "          },",
  "          {",
  '            name: "shot-contracts",',
  '            files: [".automovie/shots/*.json"],',
  '            requires: ["screenplay-index"],',
  "          },",
  "        ],",
  "      },",
  "    ],",
  "  },",
  "};",
  "",
].join("\n");

const presenceConfigWithFiles = (files: readonly string[]): string =>
  [
    ...automoviePluginPrelude,
    "export default {",
    "  plugins: { automovie },",
    "  rules: {",
    '    "automovie/state-presence": [',
    '      "error",',
    "      {",
    "        slots: [",
    "          {",
    '            name: "screenplay-index",',
    `            files: ${JSON.stringify(files)},`,
    "            requires: [],",
    "          },",
    "          {",
    '            name: "shot-contracts",',
    '            files: [".automovie/shots/*.json"],',
    '            requires: ["screenplay-index"],',
    "          },",
    "        ],",
    "      },",
    "    ],",
    "  },",
    "};",
    "",
  ].join("\n");

const assetProvenanceConfig = [
  ...automoviePluginPrelude,
  "export default {",
  "  plugins: { automovie },",
  "  rules: {",
  '    "automovie/asset-provenance": [',
  '      "error",',
  "      {",
  '        manifests: [".automovie/assets.json"],',
  "        assets: [",
  '          "public/assets/*.bin",',
  '          "public/assets/*.glb",',
  '          "public/assets/*.gltf",',
  "        ],",
  "      },",
  "    ],",
  "  },",
  "};",
  "",
].join("\n");

const assetProvenanceFiles = (
  variant:
    | "valid"
    | "blank-license"
    | "digest-drift"
    | "missing-entry"
    | "missing-manifest"
    | "model-decisions-missing"
    | "model-valid"
    | "model-lod-invalid"
    | "model-proxy-invalid",
): Record<string, string> => {
  const bytes =
    variant === "digest-drift" ? "substituted asset\n" : "licensed asset\n";
  const recordedBytes = "licensed asset\n";
  const digest = (value: string): string =>
    `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const assets: Array<Record<string, unknown>> = [
    {
      path: "public/assets/tone.bin",
      digest: digest(recordedBytes),
      original: {
        url: "https://example.com/tone.bin",
        digest: digest(recordedBytes),
      },
      license: {
        identifier: variant === "blank-license" ? "" : "CC0-1.0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
      processing: [],
      uses: [
        {
          production: "fixture",
          consumer: { kind: "audio-cue", id: "shot-1" },
          reason: "The shot requires this licensed tone.",
        },
      ],
    },
  ];
  const files: Record<string, string> = {
    ".automovie/assets.json": JSON.stringify({ version: 1, assets }),
    "public/assets/tone.bin": bytes,
    "src/index.ts": "export {};\n",
  };
  if (variant === "missing-manifest") delete files[".automovie/assets.json"];
  if (variant === "missing-entry")
    files["public/assets/unrecorded.bin"] = "unrecorded\n";
  if (variant.startsWith("model-")) {
    const modelBytes = JSON.stringify({
      asset: { version: "2.0" },
      buffers: [
        {
          byteLength: 36,
          uri: "data:application/octet-stream;base64,AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA",
        },
      ],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 3,
          type: "VEC3",
        },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
    });
    const model: Record<string, unknown> = {
      path: "public/assets/actor.gltf",
      digest: digest(modelBytes),
      original: {
        url: "https://example.com/actor.gltf",
        digest: digest(modelBytes),
      },
      license: {
        identifier: "CC0-1.0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
      processing: [],
      uses: [
        {
          production: "fixture",
          consumer: { kind: "model-recipe", id: "actor" },
          reason: "The production casts this external model.",
        },
      ],
      ...(variant === "model-decisions-missing"
        ? {}
        : {
            model: {
              ingestProfile: "gltf-static-v1",
              lod:
                variant === "model-lod-invalid"
                  ? [
                      { level: "hero", asset: "public/assets/actor.gltf" },
                      { level: "hero", asset: "public/assets/actor.gltf" },
                    ]
                  : [{ level: "hero", asset: "public/assets/actor.gltf" }],
              collisionProxy:
                variant === "model-proxy-invalid"
                  ? {
                      kind: "asset",
                      asset: "public/assets/missing-proxy.bin",
                    }
                  : {
                      kind: "generated",
                      recipe: "capsule-v1",
                      parameters: { radius: 0.3, height: 1.8 },
                    },
              measurementProxy: {
                kind: "generated",
                recipe: "humanoid-landmarks-v1",
                parameters: {
                  height: 1.8,
                  shoulderWidth: 0.45,
                  hipWidth: 0.32,
                },
              },
            },
          }),
    };
    assets.push(model);
    assets.sort((left, right) =>
      String(left.path) < String(right.path) ? -1 : 1,
    );
    files[".automovie/assets.json"] = JSON.stringify({ version: 1, assets });
    files["public/assets/actor.gltf"] = modelBytes;
  }
  return files;
};

const screenplayConfig = [
  ...automoviePluginPrelude,
  "export default {",
  "  plugins: { automovie },",
  "  rules: {",
  '    "automovie/screenplay-contract": [',
  '      "error",',
  "      {",
  '        indexes: [".automovie/design/*/screenplay/index.json"],',
  '        documents: ["docs/**/*.md"],',
  '        shots: [".automovie/design/*/shots/*.json"],',
  '        acceptance: [".automovie/design/*/acceptance/*.json"],',
  '        models: [".automovie/design/*/models/*.json"],',
  '        formations: [".automovie/design/*/formations/*.json"],',
  '        worlds: [".automovie/design/*/world.json"],',
  '        realizations: ["generated/*/realizations/*.json"],',
  '        reviews: [".automovie/reviews/*/shots/*.json", ".automovie/reviews/*/film/*.json", ".automovie/reviews/*/films/*.json"],',
  "      },",
  "    ],",
  "  },",
  "};",
  "",
].join("\n");

const legacyScreenplayConfig = [
  ...automoviePluginPrelude,
  "export default {",
  "  plugins: { automovie },",
  "  rules: {",
  '    "automovie/screenplay-contract": [',
  '      "error",',
  "      {",
  '        indexes: [".automovie/design/screenplay/index.json"],',
  '        documents: ["docs/**/*.md"],',
  '        shots: [".automovie/design/shots/*.json"],',
  '        acceptance: [".automovie/design/acceptance/*.json"],',
  '        models: [".automovie/design/models/*.json"],',
  '        formations: [".automovie/design/formations/*.json"],',
  '        worlds: [".automovie/design/world.json"],',
  '        realizations: ["generated/realizations/*.json"],',
  '        reviews: [".automovie/reviews/shots/*.json", ".automovie/reviews/film/*.json", ".automovie/reviews/films/*.json"],',
  "      },",
  "    ],",
  "  },",
  "};",
  "",
].join("\n");

const screenplayFiles = (
  variant:
    | "valid"
    | "dangling-scene"
    | "design-review-only"
    | "disposition-conflict"
    | "encoded-namespace"
    | "fenced-heading"
    | "intent-only"
    | "misbound-proof"
    | "missing-heading"
    | "missing-model-binding"
    | "removed-locked-scene"
    | "sibling-evidence"
    | "uncovered-beat",
): Record<string, string> => {
  const beat =
    "The signal changes the formation before the answering movement begins.";
  const production = variant === "encoded-namespace" ? "film one" : "film";
  const namespace = encodeURIComponent(production);
  const documentRoot = `docs/${production}`;
  const index = {
    version: 1,
    production,
    treatment: {
      path: `${documentRoot}/treatment.md`,
      sequences: [
        {
          id: "SEQ-1",
          title: "Signal and answer",
          beats: [{ id: "BEAT-1", text: beat }],
        },
      ],
    },
    screenplay: {
      path: `${documentRoot}/screenplay.md`,
      lock: {
        activatedBy: "agent-before-first-shot",
        reason: "A shot contract already cites the stable scene ledger.",
        sceneIds: ["SCN-001", "SCN-002"],
      },
      scenes: [
        {
          id: "SCN-001",
          title: "The Signal",
          status: "active",
          covers: [
            {
              reason: "The opening scene realizes the treatment promise.",
              beat,
            },
          ],
          location: "field",
          disposition: null as null | { phase: string; reason: string },
        },
        {
          id: "SCN-002",
          title: "OMITTED",
          status: "OMITTED",
          covers: [],
          location: null,
          disposition: null,
        },
      ],
    },
    catalog: {
      characters: [
        {
          id: "sentinel",
          name: "The Sentinel",
          evidence: [
            {
              reason: "The scene prose establishes the sentinel.",
              scene: "SCN-001",
            },
          ],
          bindings: [{ kind: "model", id: "sentinel-model" }],
        },
      ],
      factions: [
        {
          id: "formation",
          name: "The Answering Formation",
          evidence: [
            {
              reason: "The scene prose establishes the formation.",
              scene: "SCN-001",
            },
          ],
          bindings: [{ kind: "formation", id: "answering-formation" }],
        },
      ],
      locations: [
        {
          id: "field",
          name: "Signal Field",
          evidence: [
            {
              reason: "The scene prose establishes the field.",
              scene: "SCN-001",
            },
          ],
          bindings: [{ kind: "world-landmark", id: "signal-ground" }],
        },
      ],
    },
    continuity: [],
  };
  if (variant === "uncovered-beat") index.screenplay.scenes[0]!.covers = [];
  if (variant === "removed-locked-scene") index.screenplay.scenes.splice(1, 1);
  if (variant === "disposition-conflict")
    index.screenplay.scenes[0]!.disposition = {
      phase: "production",
      reason: "This scene was intentionally exempted.",
    };
  if (variant === "missing-model-binding")
    index.catalog.characters[0]!.bindings = [];
  if (variant === "misbound-proof")
    (
      index.continuity as Array<{
        evidence: Array<{ reason: string; scene: string }>;
        id: string;
        proof: {
          outcome: { id: string; kind: string };
          owner: string;
          shot: string;
        };
        text: string;
        verification: string;
      }>
    ).push({
      id: "signal-readable",
      text: "The signal remains readable.",
      verification: "geometry",
      proof: {
        owner: "geometry",
        shot: "shot-1",
        outcome: { kind: "opening", id: "raised-signal" },
      },
      evidence: [
        {
          reason: "The opening scene establishes the signal.",
          scene: "SCN-001",
        },
      ],
    });

  const citedScene = variant === "dangling-scene" ? "SCN-999" : "SCN-001";
  const files: Record<string, string> = {
    [`.automovie/design/${namespace}/screenplay/index.json`]:
      JSON.stringify(index),
    [`.automovie/design/${namespace}/production.json`]: JSON.stringify({
      id: production,
    }),
    [`.automovie/design/${namespace}/models/sentinel.json`]: JSON.stringify({
      id: "sentinel-model",
    }),
    [`.automovie/design/${namespace}/formations/answer.json`]: JSON.stringify({
      id: "answering-formation",
    }),
    [`.automovie/design/${namespace}/world.json`]: JSON.stringify({
      landmarks: [{ id: "signal-ground" }],
    }),
    [`.automovie/design/${namespace}/shots/shot-1.json`]: JSON.stringify({
      id: "shot-1",
      evidence: [
        {
          reason: "The shot realizes the authored signal.",
          scene: citedScene,
          claim: variant === "misbound-proof" ? "signal-readable" : undefined,
        },
      ],
      participants: [
        { kind: "actor", id: "sentinel-model" },
        { kind: "formation", id: "answering-formation" },
      ],
    }),
    [`.automovie/design/${namespace}/acceptance/accept-1.json`]: JSON.stringify(
      {
        id: "accept-1",
        evidence: [
          {
            reason: "The frame review observes the authored signal.",
            scene: "SCN-001",
          },
        ],
        target: { kind: "shot", id: "shot-1" },
        criterion: { kind: "frame", shot: "shot-1" },
      },
    ),
    [`.automovie/reviews/${namespace}/shots/shot-1.json`]: JSON.stringify({
      complete: true,
      target: { kind: "shot", id: "shot-1" },
      checks: [
        {
          criterion: "acceptance-scenarios",
          verdict: "pass",
          acceptanceScenarios: ["accept-1"],
        },
      ],
    }),
    [`${documentRoot}/treatment.md`]: `# Treatment\n\n${beat}\n`,
    [`${documentRoot}/screenplay.md`]:
      variant === "missing-heading"
        ? "# Screenplay\n\nThe signal occurs without its indexed heading.\n"
        : [
            "# Screenplay",
            "",
            "## SCN-001 — The Signal",
            "",
            "On the field, the sentinel signals and the formation answers.",
            "",
            "## SCN-002 — OMITTED",
            "",
          ].join("\n"),
    [`generated/${namespace}/realizations/shot-1.json`]: JSON.stringify({
      version: 1,
      shot: "shot-1",
      opening: [],
      closing: [],
      events: [],
      camera: [{ passed: true }],
      formations: [],
    }),
    "src/index.ts": "export {};\n",
  };
  if (variant === "intent-only")
    delete files[`generated/${namespace}/realizations/shot-1.json`];
  if (variant === "design-review-only") {
    delete files[`.automovie/reviews/${namespace}/shots/shot-1.json`];
    files[`.automovie/reviews/${namespace}/design/acceptances/accept-1.json`] =
      JSON.stringify({
        complete: true,
        target: {
          kind: "design",
          design: { kind: "acceptance", id: "accept-1" },
        },
      });
  }
  if (variant === "sibling-evidence") {
    delete files[`generated/${namespace}/realizations/shot-1.json`];
    delete files[`.automovie/reviews/${namespace}/shots/shot-1.json`];
    files["generated/sibling/realizations/shot-1.json"] = JSON.stringify({
      version: 1,
      shot: "shot-1",
      camera: [{ passed: true }],
    });
    files[".automovie/reviews/sibling/shots/shot-1.json"] = JSON.stringify({
      complete: true,
      target: { kind: "shot", id: "shot-1" },
      checks: [
        {
          criterion: "acceptance-scenarios",
          verdict: "pass",
          acceptanceScenarios: ["accept-1"],
        },
      ],
    });
  }
  if (variant === "fenced-heading")
    files[`${documentRoot}/screenplay.md`] = [
      "# Screenplay",
      "",
      "```md",
      "## SCN-001 — The Signal",
      "```",
      "",
      "The signal occurs without its indexed heading.",
      "",
      "## SCN-002 — OMITTED",
      "",
    ].join("\n");
  return files;
};

/** Replace nominal shot acceptance with one current film acceptance review. */
const filmReviewScreenplayFiles = (
  layout: "legacy" | "namespaced",
  directory: "film" | "films",
): Record<string, string> => {
  const files = screenplayFiles("valid");
  delete files[".automovie/reviews/film/shots/shot-1.json"];
  const acceptance: IAutoMovieAcceptanceScenario = {
    id: "accept-1",
    evidence: [
      {
        reason: "The finished film observes the authored signal.",
        scene: "SCN-001",
      },
    ],
    target: { kind: "film", id: "film" },
    criterion: {
      kind: "frame",
      shot: "shot-1",
      frame: "beauty",
      pass: "beauty",
      expectation: "The final film preserves the authored signal.",
    },
    required: true,
  };
  files[".automovie/design/film/acceptance/accept-1.json"] =
    JSON.stringify(acceptance);
  const frameEvidence: IAutoMovieReviewEvidence = {
    kind: "frame",
    target: { kind: "shot", id: "shot-1" },
    reviewFrame: "beauty",
    bundle: "generated/film/renders/shot-1",
    frame: 0,
    time: 0,
    pass: "beauty",
    digest:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };
  const review: IAutoMovieStoredReview = {
    version: 1,
    target: { kind: "film", id: "film" },
    fingerprint:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    observations: "The completed film preserves the authored signal.",
    checks: [
      ...["narrative-completion", "tone-consistency", "delivery-readiness"].map(
        (criterion) => ({
          criterion,
          verdict: "pass" as const,
          observation: `${criterion} is visible in the current film frames.`,
          evidence: [frameEvidence],
        }),
      ),
      {
        criterion: "acceptance-scenarios",
        verdict: "pass",
        observation: "The required signal scenario passes on current evidence.",
        evidence: [
          frameEvidence,
          {
            kind: "acceptance",
            scenario: "accept-1",
            exactValue: acceptance,
          },
        ],
        acceptanceScenarios: ["accept-1"],
      },
    ],
    corrections: [],
    completionBasis:
      "narrative-completion, tone-consistency, delivery-readiness, acceptance-scenarios",
    complete: true,
  };
  files[`.automovie/reviews/film/${directory}/film.json`] =
    JSON.stringify(review);
  if (layout === "namespaced") return files;
  return Object.fromEntries(
    Object.entries(files).map(([file, content]) => [
      file
        .replace(".automovie/design/film/", ".automovie/design/")
        .replace(".automovie/reviews/film/", ".automovie/reviews/")
        .replace("generated/film/realizations/", "generated/realizations/"),
      content,
    ]),
  );
};

const assertSucceeded = (result: IRunResult, because: string): void => {
  if (result.status === 0) return;
  throw new Error(
    `${because}\nExpected status 0, received ${String(result.status)}.\n${result.output}`,
  );
};

const assertFailedWith = (
  result: IRunResult,
  expected: string,
  because: string,
): void => {
  if (
    result.status !== null &&
    result.status !== 0 &&
    result.output.includes(expected)
  )
    return;
  throw new Error(
    `${because}\nExpected a non-zero status containing ${JSON.stringify(expected)}, received ${String(result.status)}.\n${result.output}`,
  );
};

/**
 * Drives the installed plugin through the real `ttsc check` command.
 *
 * Scenarios:
 *
 * 1. The rendered CLI scaffold runs its source/plugin lint command both without
 *    resident design and with one exact sentinel.
 * 2. A direct toolchain warm-up distinguishes zero diagnostics from a linker or
 *    compiler failure.
 * 3. Exact sentinel boundaries fire while `$` and Unicode TypeScript identifier
 *    continuations remain silent.
 * 4. State residency is silent before records exist, rejects one orphan, and
 *    accepts valid empty upstream and downstream records.
 * 5. Asset provenance accepts one byte-exact licensed ledger and rejects a missing
 *    ledger, digest drift, blank license, missing entries and model records
 *    without ingest/LOD/proxy decisions.
 * 6. The screenplay project rule accepts a grounded locked ledger and diagnoses
 *    uncovered prose, missing headings, removed lock ids and dangling evidence,
 *    intent-only coverage, production-isolated proof, exact continuity proof,
 *    explicit design bindings, exact film-review path identity, and
 *    disposition/realization contradictions.
 */
export function test_lint_plugin_walking_skeleton(): void {
  const scaffold = runScaffoldSourceLint({ name: "clean" });
  assertSucceeded(
    scaffold,
    "The shipped scaffold's npm run lint:source command must stay green before resident records exist.",
  );

  const scaffoldSentinel = runScaffoldSourceLint({
    name: "sentinel",
    mutate: (directory) =>
      fs.writeFileSync(
        path.join(directory, "src", "sentinel.ts"),
        'export const status = "AUTOMOVIE_IMPLEMENT_ME";\n',
        "utf8",
      ),
  });
  assertFailedWith(
    scaffoldSentinel,
    "Template sentinel 'AUTOMOVIE_IMPLEMENT_ME' remains in compiled source.",
    "The shipped scaffold's npm run lint:source command must invoke the registered walking-skeleton rule.",
  );

  const empty = runFixture({
    name: "empty",
    lintConfig: sentinelConfig,
    files: { "src/index.ts": "export {};\n" },
  });
  assertSucceeded(
    empty,
    "A project with no design records and no sentinel must be green after the real toolchain warms up.",
  );

  const clean = runFixture({
    name: "sentinel-clean",
    lintConfig: sentinelConfig,
    files: { "src/index.ts": 'export const status = "ready";\n' },
  });
  assertSucceeded(clean, "The implemented sentinel twin must stay silent.");

  const identifiers = runFixture({
    name: "sentinel-identifiers",
    lintConfig: sentinelConfig,
    files: {
      "src/index.ts": [
        "export const $AUTOMOVIE_IMPLEMENT_ME = 1;",
        "export const AUTOMOVIE_IMPLEMENT_ME$ = 2;",
        "export const éAUTOMOVIE_IMPLEMENT_ME = 3;",
        "export const a·AUTOMOVIE_IMPLEMENT_ME = 4;",
        "export const AUTOMOVIE_IMPLEMENT_ME\\u0061 = 5;",
        "export const \\u0061AUTOMOVIE_IMPLEMENT_ME = 6;",
        "export const ℘AUTOMOVIE_IMPLEMENT_ME = 7;",
        "export const AUTOMOVIE_IMPLEMENT_ME℮ = 8;",
        "export const ゛AUTOMOVIE_IMPLEMENT_ME = 9;",
        "export const AUTOMOVIE_IMPLEMENT_ME゜ = 10;",
        "export const \\u{62}AUTOMOVIE_IMPLEMENT_ME = 11;",
        "export const AUTOMOVIE_IMPLEMENT_ME\\u{62} = 12;",
        "export const a፩AUTOMOVIE_IMPLEMENT_ME = 13;",
        "export const AUTOMOVIE_IMPLEMENT_ME፱ = 14;",
        "",
      ].join("\n"),
    },
  });
  assertSucceeded(
    identifiers,
    "A sentinel substring inside a valid TypeScript identifier is not the exact placeholder token.",
  );

  const identifierRangeBefore = runFixture({
    name: "sentinel-identifier-range-before",
    lintConfig: sentinelConfig,
    files: {
      "src/index.ts": 'export const before = "፨AUTOMOVIE_IMPLEMENT_ME";\n',
    },
  });
  assertFailedWith(
    identifierRangeBefore,
    "Template sentinel 'AUTOMOVIE_IMPLEMENT_ME' remains in compiled source.",
    "U+1368 immediately below Other_ID_Continue must not hide the exact sentinel.",
  );
  const identifierRangeAfter = runFixture({
    name: "sentinel-identifier-range-after",
    lintConfig: sentinelConfig,
    files: {
      "src/index.ts": 'export const after = "AUTOMOVIE_IMPLEMENT_ME፲";\n',
    },
  });
  assertFailedWith(
    identifierRangeAfter,
    "Template sentinel 'AUTOMOVIE_IMPLEMENT_ME' remains in compiled source.",
    "U+1372 immediately above Other_ID_Continue must not hide the exact sentinel.",
  );

  const sentinel = runFixture({
    name: "sentinel-resident",
    lintConfig: sentinelConfig,
    files: {
      "src/index.ts": 'export const status = "AUTOMOVIE_IMPLEMENT_ME";\n',
    },
  });
  assertFailedWith(
    sentinel,
    "Template sentinel 'AUTOMOVIE_IMPLEMENT_ME' remains in compiled source.",
    "The resident scaffold sentinel must fire through the packaged rule.",
  );

  const noRecords = runFixture({
    name: "state-empty",
    lintConfig: presenceConfig,
    files: { "src/index.ts": "export {};\n" },
  });
  assertSucceeded(
    noRecords,
    "A project with no resident state slots must stay silent.",
  );

  const validAssetProvenance = runFixture({
    name: "asset-provenance-valid",
    lintConfig: assetProvenanceConfig,
    files: assetProvenanceFiles("valid"),
  });
  assertSucceeded(
    validAssetProvenance,
    "One byte-exact asset with source, license and production use must satisfy the provenance ledger.",
  );
  assertSucceeded(
    runFixture({
      name: "asset-provenance-model-valid",
      lintConfig: assetProvenanceConfig,
      files: assetProvenanceFiles("model-valid"),
    }),
    "A model with ordered model-byte LOD and closed generated proxies must satisfy the provenance ledger.",
  );

  for (const [variant, expected, because] of [
    [
      "missing-manifest",
      "but no physical asset manifest",
      "Distributable bytes without a provenance manifest must fail lint.",
    ],
    [
      "digest-drift",
      "but current bytes are",
      "Replacing licensed bytes without updating verified provenance must fail lint.",
    ],
    [
      "blank-license",
      "license identity/URL",
      "A blank distribution license must fail lint.",
    ],
    [
      "missing-entry",
      "has no entry for distributable asset",
      "Every configured distributable asset must have one manifest entry.",
    ],
    [
      "model-decisions-missing",
      "without ingest profile, explicit LOD, collision proxy or measurement proxy",
      "An external model must record its ingest, LOD and proxy decisions.",
    ],
    [
      "model-lod-invalid",
      "duplicate/out of order",
      "A model LOD ledger must keep unique hero/near/far levels in order.",
    ],
    [
      "model-proxy-invalid",
      "is not a byte-grounded version-1 JSON proxy",
      "A model proxy must resolve to byte-grounded version-1 JSON proxy bytes or a closed generated recipe.",
    ],
  ] as const) {
    const result = runFixture({
      name: `asset-provenance-${variant}`,
      lintConfig: assetProvenanceConfig,
      files: assetProvenanceFiles(variant),
    });
    assertFailedWith(result, expected, because);
  }

  const validScreenplay = runFixture({
    name: "screenplay-valid",
    lintConfig: screenplayConfig,
    files: screenplayFiles("valid"),
  });
  assertSucceeded(
    validScreenplay,
    "A grounded scene, passing compiled realization, completed acceptance and retained OMITTED tombstone must satisfy the screenplay ledger.",
  );

  const filmReview = runFixture({
    name: "screenplay-film-review",
    lintConfig: screenplayConfig,
    files: filmReviewScreenplayFiles("namespaced", "film"),
  });
  assertSucceeded(
    filmReview,
    "A current review in the runtime-owned singular film directory must discharge film-target acceptance.",
  );

  const pluralFilmReview = runFixture({
    name: "screenplay-plural-film-review",
    lintConfig: screenplayConfig,
    files: filmReviewScreenplayFiles("namespaced", "films"),
  });
  assertFailedWith(
    pluralFilmReview,
    "A completed design review is not observation.",
    "A plural films directory is not runtime-owned evidence and must not discharge acceptance.",
  );

  const legacyFilmReview = runFixture({
    name: "screenplay-legacy-film-review",
    lintConfig: legacyScreenplayConfig,
    files: filmReviewScreenplayFiles("legacy", "film"),
  });
  assertSucceeded(
    legacyFilmReview,
    "A current review in the runtime-owned legacy singular film directory must discharge film-target acceptance.",
  );

  const legacyPluralFilmReview = runFixture({
    name: "screenplay-legacy-plural-film-review",
    lintConfig: legacyScreenplayConfig,
    files: filmReviewScreenplayFiles("legacy", "films"),
  });
  assertFailedWith(
    legacyPluralFilmReview,
    "A completed design review is not observation.",
    "A legacy plural films directory is not runtime-owned evidence and must not discharge acceptance.",
  );

  const uncoveredBeat = runFixture({
    name: "screenplay-uncovered-beat",
    lintConfig: screenplayConfig,
    files: screenplayFiles("uncovered-beat"),
  });
  assertFailedWith(
    uncoveredBeat,
    "treatment beat 'BEAT-1' is not covered verbatim",
    "A treatment promise without a covering active scene must fail at build-time lint.",
  );

  const missingHeading = runFixture({
    name: "screenplay-missing-heading",
    lintConfig: screenplayConfig,
    files: screenplayFiles("missing-heading"),
  });
  assertFailedWith(
    missingHeading,
    "no exact SCN heading exists",
    "Direct prose edits that remove an indexed scene heading must leave a loud dangling ledger.",
  );

  const fencedHeading = runFixture({
    name: "screenplay-fenced-heading",
    lintConfig: screenplayConfig,
    files: screenplayFiles("fenced-heading"),
  });
  assertFailedWith(
    fencedHeading,
    "no exact SCN heading exists",
    "A heading-shaped example inside a Markdown code fence must not masquerade as an authored scene.",
  );

  const removedLockedScene = runFixture({
    name: "screenplay-removed-locked-scene",
    lintConfig: screenplayConfig,
    files: screenplayFiles("removed-locked-scene"),
  });
  assertFailedWith(
    removedLockedScene,
    "lock ledger retains scene id 'SCN-002'",
    "A locked scene id must remain as an OMITTED tombstone instead of disappearing.",
  );

  const danglingScene = runFixture({
    name: "screenplay-dangling-scene",
    lintConfig: screenplayConfig,
    files: screenplayFiles("dangling-scene"),
  });
  assertFailedWith(
    danglingScene,
    "cites unknown scene 'SCN-999'",
    "A downstream shot citation must resolve through its production screenplay index.",
  );

  const intentOnly = runFixture({
    name: "screenplay-intent-only",
    lintConfig: screenplayConfig,
    files: screenplayFiles("intent-only"),
  });
  assertFailedWith(
    intentOnly,
    "Shot intent alone cannot drain scene coverage.",
    "A declared shot without a passing compiler-owned realization must leave its scene uncovered.",
  );

  const designReviewOnly = runFixture({
    name: "screenplay-design-review-only",
    lintConfig: screenplayConfig,
    files: screenplayFiles("design-review-only"),
  });
  assertFailedWith(
    designReviewOnly,
    "A completed design review is not observation.",
    "Completing an acceptance design review must not stand in for an observed shot or film acceptance pass.",
  );

  const siblingEvidence = runFixture({
    name: "screenplay-sibling-evidence",
    lintConfig: screenplayConfig,
    files: screenplayFiles("sibling-evidence"),
  });
  assertFailedWith(
    siblingEvidence,
    "Shot intent alone cannot drain scene coverage.",
    "A sibling production's same-named realization and review must not drain this production's screenplay coverage.",
  );

  const missingModelBinding = runFixture({
    name: "screenplay-missing-model-binding",
    lintConfig: screenplayConfig,
    files: screenplayFiles("missing-model-binding"),
  });
  assertFailedWith(
    missingModelBinding,
    "is not bound by the grounded character catalog",
    "A shot actor must join through an explicit production character-to-model binding instead of implicit id equality.",
  );

  const misboundProof = runFixture({
    name: "screenplay-misbound-proof",
    lintConfig: screenplayConfig,
    files: screenplayFiles("misbound-proof"),
  });
  assertFailedWith(
    misboundProof,
    "its exact proof selector has no passing citing evidence",
    "A continuity claim must cite the exact passing geometry outcome rather than any generic successful realization.",
  );

  const encodedNamespace = runFixture({
    name: "screenplay-encoded-namespace",
    lintConfig: screenplayConfig,
    files: screenplayFiles("encoded-namespace"),
  });
  assertSucceeded(
    encodedNamespace,
    "A URL-encoded physical namespace must resolve ownership through production.json's raw production id.",
  );

  const dispositionConflict = runFixture({
    name: "screenplay-disposition-conflict",
    lintConfig: screenplayConfig,
    files: screenplayFiles("disposition-conflict"),
  });
  assertFailedWith(
    dispositionConflict,
    "Intentional omission and realized work contradict each other.",
    "A phase-local disposition must not coexist with evidence that the scene was realized and accepted.",
  );

  const orphan = runFixture({
    name: "state-orphan",
    lintConfig: presenceConfig,
    files: {
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
  });
  assertFailedWith(
    orphan,
    "State slot 'shot-contracts' is present while required upstream slot 'screenplay-index' is absent.",
    "A downstream slot without its upstream must fail even when its record is an empty array.",
  );

  const ordered = runFixture({
    name: "state-ordered",
    lintConfig: presenceConfig,
    files: {
      ".automovie/screenplay/index.json": "[]\n",
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
  });
  assertSucceeded(
    ordered,
    "Present upstream and downstream slots must pass even when both records are valid empty arrays.",
  );

  let caseInsensitive = false;
  const caseSpelling = runFixture({
    name: "state-filesystem-case",
    lintConfig: presenceConfigWithFiles([".automovie/SCREENPLAY/INDEX.*"]),
    files: {
      ".automovie/screenplay/index.json": "[]\n",
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
    mutate: (directory) => {
      caseInsensitive = fs.existsSync(
        path.join(directory, ".automovie", "SCREENPLAY", "INDEX.JSON"),
      );
    },
  });
  if (caseInsensitive)
    assertSucceeded(
      caseSpelling,
      "A differently cased glob must follow a case-insensitive filesystem.",
    );
  else
    assertFailedWith(
      caseSpelling,
      "State slot 'shot-contracts' is present while required upstream slot 'screenplay-index' is absent.",
      "A differently cased glob must remain absent on a case-sensitive filesystem.",
    );

  const mixedEvidence = runFixture({
    name: "state-bad-link-good-file",
    lintConfig: presenceConfigWithFiles([
      ".automovie/linked/*.json",
      ".automovie/screenplay/*.json",
    ]),
    files: {
      ".automovie/link-target/index.json": "[]\n",
      ".automovie/screenplay/index.json": "[]\n",
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
    mutate: (directory) =>
      linkDirectory(
        path.join(directory, ".automovie", "link-target"),
        path.join(directory, ".automovie", "linked"),
      ),
  });
  assertSucceeded(
    mixedEvidence,
    "A bad linked witness and a good project-owned witness must prove presence independent of file-pattern order.",
  );
  const reversedEvidence = runFixture({
    name: "state-good-file-bad-link",
    lintConfig: presenceConfigWithFiles([
      ".automovie/screenplay/*.json",
      ".automovie/linked/*.json",
    ]),
    files: {
      ".automovie/link-target/index.json": "[]\n",
      ".automovie/screenplay/index.json": "[]\n",
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
    mutate: (directory) =>
      linkDirectory(
        path.join(directory, ".automovie", "link-target"),
        path.join(directory, ".automovie", "linked"),
      ),
  });
  assertSucceeded(
    reversedEvidence,
    "A good project-owned witness must prove presence before a later bad linked witness is inspected.",
  );

  let recursiveCaseInsensitive = false;
  const recursiveGlob = runFixture({
    name: "state-recursive-glob",
    lintConfig: presenceConfigWithFiles([".automovie/**/SCREENPLAY/*.json"]),
    files: {
      ".automovie/nested/screenplay/index.json": "[]\n",
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
    mutate: (directory) => {
      recursiveCaseInsensitive = fs.existsSync(
        path.join(
          directory,
          ".automovie",
          "nested",
          "SCREENPLAY",
          "index.json",
        ),
      );
    },
  });
  if (recursiveCaseInsensitive)
    assertSucceeded(
      recursiveGlob,
      "A recursive glob must use the real nested parent when its complete alternate spelling resolves there.",
    );
  else
    assertFailedWith(
      recursiveGlob,
      "State slot 'shot-contracts' is present while required upstream slot 'screenplay-index' is absent.",
      "A recursive glob must retain the real case-sensitive nested parent while checking its next segment.",
    );

  let hardLinkCaseInsensitive = false;
  const completeSpelling = runFixture({
    name: "state-complete-case-spelling",
    lintConfig: presenceConfigWithFiles([".automovie/screenplay/A*A.json"]),
    files: {
      ".automovie/screenplay/aa.json": "[]\n",
      ".automovie/shots/shot-1.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
    mutate: (directory) => {
      const screenplay = path.join(directory, ".automovie", "screenplay");
      const resident = path.join(screenplay, "aa.json");
      hardLinkCaseInsensitive = fs.existsSync(path.join(screenplay, "AA.json"));
      if (hardLinkCaseInsensitive === false) {
        fs.linkSync(resident, path.join(screenplay, "Aa.json"));
        fs.linkSync(resident, path.join(screenplay, "aA.json"));
      }
    },
  });
  if (hardLinkCaseInsensitive)
    assertSucceeded(
      completeSpelling,
      "A complete alternate spelling that resolves to the resident file must match on a case-insensitive filesystem.",
    );
  else
    assertFailedWith(
      completeSpelling,
      "State slot 'shot-contracts' is present while required upstream slot 'screenplay-index' is absent.",
      "Independent hard links for partial case substitutions must not prove that the complete glob spelling exists.",
    );

  const linkedAncestor = runFixture({
    name: "state-linked-ancestor",
    lintConfig: presenceConfig,
    files: {
      ".automovie/link-target/shot-1.json": "[]\n",
      ".automovie/screenplay/index.json": "[]\n",
      "src/index.ts": "export {};\n",
    },
    mutate: (directory) =>
      linkDirectory(
        path.join(directory, ".automovie", "link-target"),
        path.join(directory, ".automovie", "shots"),
      ),
  });
  assertFailedWith(
    linkedAncestor,
    "crosses symbolic link '.automovie/shots'",
    "A linked ancestor of a glob candidate must remain unknown rather than count as project-owned state.",
  );
}
