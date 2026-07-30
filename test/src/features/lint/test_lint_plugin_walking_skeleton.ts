import { renderScaffold, writeFiles } from "@automovie/cli";
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
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

const repositoryRoot = path.resolve(__dirname, "../../../..");
const pluginCache = path.join(
  repositoryRoot,
  "node_modules",
  ".cache",
  "automovie-lint-test",
);

const linkDirectory = (source: string, destination: string): void => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(
    source,
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const dependencyRoot = (name: string): string =>
  path.dirname(require.resolve(`${name}/package.json`));

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
      env: { ...process.env, TTSC_CACHE_DIR: pluginCache },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 900_000,
    },
  );
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    status: result.status,
  };
};

const runScaffoldLint = (props: {
  mutate?: (directory: string) => void;
  name: string;
}): IRunResult => {
  const fixture = createScaffoldFixture(props.name);
  try {
    props.mutate?.(fixture.directory);
    const result: SpawnSyncReturns<string> = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["lint"],
      {
        cwd: fixture.directory,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: [
            path.join(repositoryRoot, "test", "node_modules", ".bin"),
            path.join(repositoryRoot, "node_modules", ".bin"),
            process.env.PATH ?? "",
          ].join(path.delimiter),
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
  } finally {
    fixture.cleanup();
  }
};

const runFixture = (props: {
  files: Record<string, string>;
  lintConfig: string;
  name: string;
}): IRunResult => {
  const fixture = createFixture(props);
  try {
    return runCheck(fixture.directory);
  } finally {
    fixture.cleanup();
  }
};

const sentinelConfig = [
  'import { automovie } from "@automovie/lint";',
  "",
  "export default {",
  "  plugins: { automovie },",
  '  rules: { "automovie/template-sentinel": "error" },',
  "};",
  "",
].join("\n");

const presenceConfig = [
  'import { automovie } from "@automovie/lint";',
  "",
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
 * 1. The rendered CLI scaffold runs its ordinary `pnpm lint` command both without
 *    resident design and with one exact sentinel.
 * 2. A direct toolchain warm-up distinguishes zero diagnostics from a linker or
 *    compiler failure.
 * 3. Exact sentinel boundaries fire while `$` and Unicode TypeScript identifier
 *    continuations remain silent.
 * 4. State residency is silent before records exist, rejects one orphan, and
 *    accepts valid empty upstream and downstream records.
 */
export function test_lint_plugin_walking_skeleton(): void {
  const scaffold = runScaffoldLint({ name: "clean" });
  assertSucceeded(
    scaffold,
    "The shipped scaffold's ordinary pnpm lint command must stay green before resident records exist.",
  );

  const scaffoldSentinel = runScaffoldLint({
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
    "The shipped scaffold's ordinary pnpm lint command must invoke the registered walking-skeleton rule.",
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
        "",
      ].join("\n"),
    },
  });
  assertSucceeded(
    identifiers,
    "A sentinel substring inside a valid TypeScript identifier is not the exact placeholder token.",
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
}
