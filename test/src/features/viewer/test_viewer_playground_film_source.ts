import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PlaygroundFilmScenario } from "../../fixtures/playgroundFilmHost";

const ROOT = path.resolve(__dirname, "../../../..");
const TTSC = path.join(
  ROOT,
  "test",
  "node_modules",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const TSX = path.join(ROOT, "test", "node_modules", "tsx", "dist", "cli.mjs");
const HOST = path.join(
  ROOT,
  "test",
  "src",
  "fixtures",
  "playgroundFilmHost.ts",
);

interface IFilmCase {
  filename: string;
  scenario: PlaygroundFilmScenario;
  search: string;
}

const CASES: readonly IFilmCase[] = [
  { filename: "stage-fail.ts", scenario: "stage-fail", search: "" },
  { filename: "rig-fail.ts", scenario: "rig-fail", search: "" },
  { filename: "block-fail.ts", scenario: "block-fail", search: "" },
  { filename: "perform-fail.ts", scenario: "perform-fail", search: "" },
  { filename: "cut-fail.ts", scenario: "cut-fail", search: "" },
  { filename: "success.ts", scenario: "success", search: "" },
  {
    filename: "invalid-time.ts",
    scenario: "success",
    search: "?t=NaN",
  },
  {
    filename: "capture.ts",
    scenario: "success",
    search: "?cap=1&w=960&h=540&t=0",
  },
];

const childEnvironment = (): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  delete environment.NODE_OPTIONS;
  delete environment.TTSX_RUNTIME_MANIFEST;
  return environment;
};

const checkedSpawn = (arguments_: readonly string[], label: string): void => {
  const result = spawnSync(process.execPath, arguments_, {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    env: childEnvironment(),
  });
  if (result.status !== 0)
    throw new Error(
      `${label} failed:\n${result.stderr || result.stdout || `exit ${result.status ?? "none"}`}`,
    );
};

const stageHosts = (directory: string): readonly string[] => {
  // Drop the `.ts` the absolute host path carries. `ttsc` compiles the staged
  // project under the repository's own base configuration, which enables
  // neither `allowImportingTsExtensions` nor the `noEmit` pairing it requires,
  // so a specifier that keeps the extension is rejected with TS5097 before any
  // host runs. Every other import of this fixture, including this file's own,
  // is extensionless, and that is what the staged host must look like too.
  const importPath = path
    .relative(directory, HOST)
    .replaceAll("\\", "/")
    .replace(/\.ts$/u, "");
  const specifier = importPath.startsWith(".") ? importPath : `./${importPath}`;
  const hosts = CASES.map((entry) => path.join(directory, entry.filename));
  for (const [index, entry] of CASES.entries())
    writeFileSync(
      hosts[index],
      [
        `import { runPlaygroundFilmHost } from ${JSON.stringify(specifier)};`,
        `runPlaygroundFilmHost(${JSON.stringify(entry.scenario)}, ${JSON.stringify(entry.search)});`,
        "",
      ].join("\n"),
      "utf8",
    );
  writeFileSync(
    path.join(directory, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: path.join(ROOT, "test", "tsconfig.json"),
        compilerOptions: {
          noEmit: true,
          rootDir: ROOT,
          typeRoots: [path.join(ROOT, "test", "node_modules", "@types")],
        },
        include: hosts,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const lintPath = path
    .relative(directory, path.join(ROOT, "config", "lint.config"))
    .replaceAll("\\", "/");
  writeFileSync(
    path.join(directory, "lint.config.ts"),
    `export { default } from ${JSON.stringify(lintPath.startsWith(".") ? lintPath : `./${lintPath}`)};\n`,
    "utf8",
  );
  return hosts;
};

/** The actual playground film executes every local viewer boundary in TS. */
export const test_viewer_playground_film_source = (): void => {
  const retainedSourceHost = process.env.AUTOMOVIE_COVERAGE_SOURCE_HOST;
  const cache =
    retainedSourceHost === undefined
      ? path.join(ROOT, "node_modules", ".cache")
      : retainedSourceHost;
  mkdirSync(cache, { recursive: true });
  const directory = mkdtempSync(
    path.join(cache, "automovie-playground-film-hosts-"),
  );
  try {
    const hosts = stageHosts(directory);
    checkedSpawn(
      [TTSC, "-p", path.join(directory, "tsconfig.json"), "--noEmit"],
      "combined typed host project",
    );
    for (const host of hosts)
      checkedSpawn([TSX, host], `fresh ${path.basename(host)} host`);
  } finally {
    if (retainedSourceHost === undefined)
      rmSync(directory, { recursive: true, force: true });
  }
};
