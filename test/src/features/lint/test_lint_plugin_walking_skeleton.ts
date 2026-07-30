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

  const modules = path.join(directory, "node_modules");
  linkDirectory(
    path.join(repositoryRoot, "packages", "lint"),
    path.join(modules, "@automovie", "lint"),
  );
  linkDirectory(
    dependencyRoot("@ttsc/lint"),
    path.join(modules, "@ttsc", "lint"),
  );
  linkDirectory(dependencyRoot("ttsc"), path.join(modules, "ttsc"));
  linkDirectory(dependencyRoot("typescript"), path.join(modules, "typescript"));

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
 * The warm-up success proves the toolchain returned normally, and each one-line
 * failing twin must then produce its rule-specific message. A missing plugin
 * cannot masquerade as "zero diagnostics" because the failing twins would
 * remain green.
 */
export function test_lint_plugin_walking_skeleton(): void {
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
