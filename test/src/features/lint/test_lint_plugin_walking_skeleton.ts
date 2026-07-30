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
  mutate?: (directory: string) => void;
  name: string;
}): IRunResult => {
  const fixture = createFixture(props);
  try {
    props.mutate?.(fixture.directory);
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

const presenceConfigWithFiles = (files: readonly string[]): string =>
  [
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

const screenplayConfig = [
  'import { automovie } from "@automovie/lint";',
  "",
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
  '        realizations: ["generated/*/realizations/*.json"],',
  '        reviews: [".automovie/reviews/*/design/acceptances/*.json"],',
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
    | "disposition-conflict"
    | "intent-only"
    | "missing-heading"
    | "removed-locked-scene"
    | "uncovered-beat",
): Record<string, string> => {
  const beat =
    "The signal changes the formation before the answering movement begins.";
  const index = {
    version: 1,
    production: "film",
    treatment: {
      path: "docs/film/treatment.md",
      sequences: [
        {
          id: "SEQ-1",
          title: "Signal and answer",
          beats: [{ id: "BEAT-1", text: beat }],
        },
      ],
    },
    screenplay: {
      path: "docs/film/screenplay.md",
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
      characters: [],
      factions: [],
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

  const citedScene = variant === "dangling-scene" ? "SCN-999" : "SCN-001";
  const files: Record<string, string> = {
    ".automovie/design/film/screenplay/index.json": JSON.stringify(index),
    ".automovie/design/film/shots/shot-1.json": JSON.stringify({
      id: "shot-1",
      evidence: [
        {
          reason: "The shot realizes the authored signal.",
          scene: citedScene,
        },
      ],
      participants: [],
    }),
    ".automovie/design/film/acceptance/accept-1.json": JSON.stringify({
      id: "accept-1",
      evidence: [
        {
          reason: "The frame review observes the authored signal.",
          scene: "SCN-001",
        },
      ],
      criterion: { kind: "frame" },
    }),
    ".automovie/reviews/film/design/acceptances/accept-1.json": JSON.stringify({
      complete: true,
      target: {
        kind: "design",
        design: { kind: "acceptance", id: "accept-1" },
      },
    }),
    "docs/film/treatment.md": `# Treatment\n\n${beat}\n`,
    "docs/film/screenplay.md":
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
    "generated/film/realizations/shot-1.json": JSON.stringify({
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
    delete files["generated/film/realizations/shot-1.json"];
  return files;
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
 * 1. The rendered CLI scaffold runs its ordinary `pnpm lint` command both without
 *    resident design and with one exact sentinel.
 * 2. A direct toolchain warm-up distinguishes zero diagnostics from a linker or
 *    compiler failure.
 * 3. Exact sentinel boundaries fire while `$` and Unicode TypeScript identifier
 *    continuations remain silent.
 * 4. State residency is silent before records exist, rejects one orphan, and
 *    accepts valid empty upstream and downstream records.
 * 5. The screenplay project rule accepts a grounded locked ledger and diagnoses
 *    uncovered prose, missing headings, removed lock ids and dangling evidence,
 *    intent-only coverage and disposition/realization contradictions.
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
        "export const ℘AUTOMOVIE_IMPLEMENT_ME = 7;",
        "export const AUTOMOVIE_IMPLEMENT_ME℮ = 8;",
        "export const ゛AUTOMOVIE_IMPLEMENT_ME = 9;",
        "export const AUTOMOVIE_IMPLEMENT_ME゜ = 10;",
        "export const \\u{61}AUTOMOVIE_IMPLEMENT_ME = 11;",
        "export const AUTOMOVIE_IMPLEMENT_ME\\u{61} = 12;",
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

  const validScreenplay = runFixture({
    name: "screenplay-valid",
    lintConfig: screenplayConfig,
    files: screenplayFiles("valid"),
  });
  assertSucceeded(
    validScreenplay,
    "A grounded scene, passing compiled realization, completed acceptance and retained OMITTED tombstone must satisfy the screenplay ledger.",
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
