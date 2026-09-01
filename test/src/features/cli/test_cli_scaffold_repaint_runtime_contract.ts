import type {
  IAutoMovieAssetManifest,
  IAutoMovieProductionDesign,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  compareCodeUnits,
  digestAutoMovieBytes,
  productionRenderBundleRelativePath,
  productionRenderTargetFingerprint,
} from "@automovie/production";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { renderCompletedFilmFixture } from "../internal/completedFilmFixture";
import {
  testCaptureRuntimeIdentity,
  testRendererIdentity,
} from "../production/productionFixtures";
import {
  productionH264Mp4,
  productionPng,
} from "../production/productionMediaFixtures";
import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";
import { linkGeneratedWorkspacePackage } from "./GeneratedWorkspaceLink";

interface IGeneratedCommand {
  status: number | null;
  stderr: string;
  stdout: string;
}

interface IGeneratedCameraDepthRuntimeProbe {
  draws: number;
  negative: string;
  positive: string;
}

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

/**
 * Replace exactly one occurrence of `anchor`, refusing anything else.
 *
 * `String.replace` returns its input when the anchor is gone, so an arrangement
 * step built on it stops mutating its subject without going red and the case
 * quietly proceeds to assert something else. Every rewrite this scenario
 * performs on rendered scaffold source goes through here so that a moved anchor
 * fails the arrangement instead of weakening the experiment.
 */
const rewriteOnce = (
  what: string,
  source: string,
  anchor: string | RegExp,
  replacement: string,
): string => {
  const occurrences =
    typeof anchor === "string"
      ? source.split(anchor).length - 1
      : [
          ...source.matchAll(
            // Deduplicated, because `new RegExp(anchor, "gg")` is a syntax
            // error rather than a count.
            new RegExp(
              anchor.source,
              [...new Set(`${anchor.flags}g`)].join(""),
            ),
          ),
        ].length;
  if (occurrences !== 1)
    throw new Error(
      `${what} needs exactly one anchor, found ${String(occurrences)}: ${String(anchor)}.`,
    );
  return source.replace(anchor, replacement);
};

/**
 * Rewrite the first of several equivalent anchors, refusing an empty match.
 *
 * Some authored populations repeat one citation shape across every owner in the
 * file, and the negative this scenario plants deliberately breaks exactly one of
 * them so the graph reports exactly one diagnostic. Uniqueness is therefore the
 * wrong guard there, while "the anchor still exists" is the one that keeps the
 * arrangement honest.
 */
const rewriteFirst = (
  what: string,
  source: string,
  anchor: string | RegExp,
  replacement: string,
): string => {
  const rewritten = source.replace(anchor, replacement);
  if (rewritten === source)
    throw new Error(`${what} found no anchor to rewrite: ${String(anchor)}.`);
  return rewritten;
};

/**
 * The completed film's active graph population, keyed by the blank scaffold's
 * own selector line.
 *
 * The blank `lint.config.ts` ships every layer `"disabled"` and `kind: null`,
 * because a generated project must inherit capability rather than another
 * production's evidence state. The fixture that stands in for a finished film
 * has to raise exactly the layers its documents pay, and it raises them in the
 * one tracked declaration the generated project's lint, sync, and runtime
 * commands all read, so no test-only graph shadows the real one.
 */
const AUTHORED_EVIDENCE_POPULATION: ReadonlyArray<readonly [string, string]> = [
  ["  kind: null,", '  kind: "film",'],
  ['  settings: "disabled",', '  settings: "review",'],
  ['  models: "disabled",', '  models: "review",'],
  ['  motions: "disabled",', '  motions: "review",'],
  ['  treatments: "disabled",', '  treatments: "review",'],
  ['  scripts: "disabled",', '  scripts: "review",'],
  ['  screenplays: "disabled",', '  screenplays: "review",'],
  ['  modelSources: "disabled",', '  modelSources: "review",'],
  ['  motionSources: "disabled",', '  motionSources: "review",'],
  ['  shots: "disabled",', '  shots: "review",'],
  ['  productionSources: "disabled",', '  productionSources: "review",'],
  ['  filmSources: "disabled",', '  filmSources: "review",'],
];

const installAuthoredEvidencePopulation = (
  rendered: Record<string, string>,
): void => {
  const lint = rendered["lint.config.ts"];
  if (
    lint === undefined ||
    lint.includes("createAutoMovieEvidenceConfig(productionEvidence)") === false
  )
    throw new Error(
      "The generated consumer no longer shares one productionEvidence declaration between lint and runtime commands.",
    );
  rendered["lint.config.ts"] = AUTHORED_EVIDENCE_POPULATION.reduce(
    (source, [anchor, replacement]) =>
      rewriteOnce(
        "The generated consumer's authored evidence population",
        source,
        anchor,
        replacement,
      ),
    lint,
  );
};

const linkWorkspacePackage = (project: string, name: string): void =>
  linkGeneratedWorkspacePackage({ name, project, subject: "Fixture package" });

/**
 * The environment a real user's shell would hand a generated project.
 *
 * Only the two launcher variables proved to leak this test program's own
 * loader are removed. `NODE_OPTIONS` carries the parent's `ttsx` register hook
 * and `TTSX_RUNTIME_MANIFEST` points at the parent's PID-scoped emit, and a
 * child that inherits either resolves this repository's TypeScript sources
 * through the parent's transpiler instead of through its own module boundary,
 * which is the boundary this scenario exists to exercise. Everything else is
 * inherited, because a child scrubbed of its whole environment is no longer the
 * process a user runs.
 *
 * `AUTOMOVIE_ISSUE_2135_COVERAGE=1` is an explicit opt-out of the `NODE_OPTIONS`
 * half, set by hand and by nothing in the repository. It exists so a coverage
 * investigation can keep the parent's transpiler hook and attribute the child's
 * TypeScript to the same source paths; it costs exactly the isolation this
 * scenario otherwise enforces, which is why it is opt-in rather than the
 * default. `NODE_V8_COVERAGE` is what c8 hands down, and it is inherited either
 * way.
 */
const generatedEnvironment = (): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  if (environment.AUTOMOVIE_ISSUE_2135_COVERAGE !== "1")
    delete environment.NODE_OPTIONS;
  delete environment.TTSX_RUNTIME_MANIFEST;
  return environment;
};

/**
 * This run's own generated-command transpile cache, removed with the fixture.
 *
 * The directory is named for the running process so two suites never share one
 * cache, and it is deleted on the way out so a suite does not leave a fresh
 * orphan under `node_modules/.cache` on every invocation.
 */
const GENERATED_CACHE = path.join(
  REPOSITORY_ROOT,
  `node_modules/.cache/issue-2135-ttsc-${process.pid}`,
);

/**
 * The ceiling a cold generated command is allowed, uniform across every script.
 *
 * A generated project compiles this repository's whole TypeScript surface on its
 * first command, and how long that takes depends on the machine and on whether
 * coverage instrumentation is attached, not on which script was asked for. Two
 * different ceilings only meant that the same cold compile passed under one
 * command and was killed under another. The ceiling is not a way to let a
 * failure through: a command that reaches it throws with the script, the
 * elapsed limit, and everything the child managed to say.
 */
const GENERATED_TIMEOUT = 600_000;

const runGenerated = (
  project: string,
  script: string,
  args: readonly string[] = [],
  plugins = false,
): IGeneratedCommand => {
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      path.join(
        path.dirname(createRequire(__filename).resolve("ttsc/package.json")),
        "lib/launcher/ttsx.js",
      ),
      "--cache-dir",
      GENERATED_CACHE,
      ...(plugins ? [] : ["--no-plugins"]),
      "-P",
      path.join(project, "tsconfig.json"),
      path.join(project, script),
      ...args,
    ],
    {
      cwd: project,
      encoding: "utf8",
      env: generatedEnvironment(),
      timeout: GENERATED_TIMEOUT,
    },
  );
  if (result.error !== undefined)
    throw new Error(
      [
        `The generated command "${[script, ...args].join(" ")}" did not complete (limit ${String(GENERATED_TIMEOUT)} ms).`,
        `stdout: ${result.stdout ?? ""}`,
        `stderr: ${result.stderr ?? ""}`,
      ].join("\n"),
      { cause: result.error },
    );
  // What each child costs, said rather than inferred.
  //
  // This scenario is the single most expensive one the suite runs, and #2167
  // reduced its children from twenty to sixteen on the assumption that the
  // count was the lever. It may not be: there is one fixture here, not one per
  // child, and every child shares this run's transpile cache, so the second
  // child onward should be paying for something other than a cold compile.
  // Nobody can say which without the number, and the number costs one line.
  GENERATED_COST.push({
    elapsed: Date.now() - started,
    label: [script, ...args].join(" "),
  });
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
};

/** Every generated child this run spawned, with what it cost. */
const GENERATED_COST: Array<{ elapsed: number; label: string }> = [];

/** Print the per-child costs newest last, with their total. */
const reportGeneratedChildCost = (
  write: (line: string) => void = console.log,
): void => {
  const total = GENERATED_COST.reduce((sum, one) => sum + one.elapsed, 0);
  for (const [index, one] of GENERATED_COST.entries())
    write(
      `generated child ${String(index + 1).padStart(2)}: ${String(one.elapsed).padStart(6)} ms  ${one.label}`,
    );
  write(
    `generated children: ${GENERATED_COST.length} spawned, ${total} ms total, ${GENERATED_COST.length === 0 ? 0 : Math.round(total / GENERATED_COST.length)} ms mean`,
  );
};

/**
 * One comparable transcript of a generated command.
 *
 * A child spawned on Windows ends its lines with CRLF and `ttsc` colours its
 * diagnostics, so a raw `includes` over `stdout` alone reads differently on the
 * two platforms this contract has to hold on. Normalizing both here keeps the
 * diagnostic counts platform-independent and keeps stderr in the same window as
 * stdout, where an evidence diagnostic can land on either.
 */
const generatedOutput = (command: IGeneratedCommand): string =>
  `${command.stdout}\n${command.stderr}`
    .replaceAll("\r\n", "\n")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");

const runGeneratedFast = (
  project: string,
  script: string,
  args: readonly string[] = [],
): IGeneratedCommand => runGenerated(project, script, args);

interface IRenderActionResult {
  error: string;
  out: string;
  status: number;
}

/**
 * Run several render actions in one generated child instead of one child each.
 *
 * Every generated command pays a full compile of this repository's TypeScript
 * surface, and the shared transpile cache does not make the next one cheaper:
 * measured at 25.0 and 26.0 seconds for two consecutive `scripts/compile.ts`
 * runs of one fixture. Twenty children were twenty compiles, and this one test
 * spent 1,971 seconds across the two CI runners -- 46 percent of the whole
 * suite's test time.
 *
 * What a separate child proves is the CLI entry: that `scripts/render.ts` maps
 * a refusal to a non-zero exit and prints the diagnostic. That is proved once,
 * by the invalid action, and `scripts/render.ts` is three lines over
 * `runNodeProductionRender`. What the remaining actions assert is the command
 * contract -- which action refuses, which succeeds, and what each prints --
 * and that contract does not change with the number of processes carrying it.
 *
 * Each action keeps its own result. The command signals a refusal by throwing,
 * so the driver catches per action: a later action cannot hide an earlier one's
 * failure, and the message is reported at the action that raised it.
 */
const installGeneratedRenderDriver = (root: string): void => {
  fs.writeFileSync(
    path.join(root, "scripts", "__renderActions.ts"),
    fs.readFileSync(
      path.join(__dirname, "assets", "renderActionsDriver.ts.txt"),
      "utf8",
    ),
    "utf8",
  );
};

/** The per-action results one driver child reported, in the order asked. */
const runGeneratedRenderActions = (
  project: string,
  actions: ReadonlyArray<readonly string[]>,
): IRenderActionResult[] => {
  const command = runGenerated(project, "scripts/__renderActions.ts", [
    JSON.stringify(actions),
  ]);
  const marker = "__RENDER_ACTIONS__";
  const index = command.stderr.lastIndexOf(marker);
  if (index < 0)
    throw new Error(
      [
        "The generated render driver reported nothing.",
        command.stdout,
        command.stderr,
      ].join("\n"),
    );
  return JSON.parse(
    command.stderr.slice(index + marker.length),
  ) as IRenderActionResult[];
};

const readGeneratedJson = <T>(label: string, command: IGeneratedCommand): T => {
  try {
    return JSON.parse(command.stdout) as T;
  } catch (error) {
    throw new Error(
      `${label} emitted invalid JSON: status=${String(command.status)} stdout=${JSON.stringify(command.stdout)} stderr=${JSON.stringify(command.stderr)}.`,
      { cause: error },
    );
  }
};

const runGeneratedCameraDepthRuntime = async (
  project: string,
): Promise<IGeneratedCameraDepthRuntimeProbe> => {
  const { build } = await import("vite");
  const output = fs.mkdtempSync(
    path.join(project, "node_modules/.camera-depth-runtime-"),
  );
  const entry = "camera-depth-runtime.cjs";
  try {
    await build({
      build: {
        // The probe is one Node entry, not a site. Copying the production's
        // `public/` tree beside it would only add megabytes and make the
        // single-chunk closure check below read a directory listing instead of
        // the bundle.
        copyPublicDir: false,
        emptyOutDir: true,
        outDir: output,
        rollupOptions: {
          output: {
            entryFileNames: entry,
            format: "cjs",
            inlineDynamicImports: true,
          },
        },
        ssr: "test/camera-depth-runtime.ts",
      },
      configFile: false,
      logLevel: "silent",
      root: project,
      ssr: {
        // Every workspace package stays in the bundle. A generated project's
        // `node_modules/@automovie/*` is this repository's own package root,
        // whose development `exports` resolve to `src/*.ts`, so any package
        // left external makes bare Node open a TypeScript file and die with
        // `ERR_UNKNOWN_FILE_EXTENSION`. A single CommonJS chunk is what carries
        // the CJS-only transitive dependencies these packages pull in; an ESM
        // chunk holding one of them fails with `require is not defined`, and
        // the dynamic `viewer/src/shotRuntime` import has to be inlined for the
        // single-file output to be complete.
        noExternal: [/^@automovie\//u, "three"],
      },
    });
    // Reading the emitted bundle is what makes the closure a measurement rather
    // than a configuration. `noExternal` is a request, and rollup answers it
    // silently: a package it declined to inline leaves an ordinary `require` in
    // the output, and the probe then dies on the first workspace `.ts` file it
    // opens. Both halves are checked, because a second chunk is the same
    // unclosed bundle in a different shape.
    const emitted = fs.readdirSync(output).sort(compareCodeUnits);
    const bundle = fs.readFileSync(path.join(output, entry), "utf8");
    const escapes = [...bundle.matchAll(/(?:require|import)\("([^"]+)"\)/gu)]
      .map((match) => match[1] ?? "")
      .filter(
        (specifier) =>
          specifier.startsWith("@automovie/") ||
          specifier === "three" ||
          specifier.startsWith("three/"),
      )
      .sort(compareCodeUnits);
    TestValidator.equals(
      "the generated camera-depth runtime bundle closes over every workspace package",
      { emitted, escapes },
      { emitted: [entry], escapes: [] },
    );
    const command = spawnSync(process.execPath, [path.join(output, entry)], {
      cwd: project,
      encoding: "utf8",
      env: generatedEnvironment(),
      timeout: GENERATED_TIMEOUT,
    });
    if (command.error !== undefined)
      throw new Error(
        [
          `The generated camera-depth runtime probe did not complete (limit ${String(GENERATED_TIMEOUT)} ms).`,
          `stdout: ${command.stdout ?? ""}`,
          `stderr: ${command.stderr ?? ""}`,
        ].join("\n"),
        { cause: command.error },
      );
    if (command.status !== 0)
      throw new Error(
        `The generated camera-depth runtime probe failed (${String(command.status)}).\n${command.stdout}\n${command.stderr}`,
      );
    const prefix = "CAMERA_DEPTH_RUNTIME ";
    const line = command.stdout
      .split(/\r?\n/u)
      .find((candidate) => candidate.startsWith(prefix));
    if (line === undefined)
      throw new Error(
        `The generated camera-depth runtime probe returned no receipt.\n${command.stdout}\n${command.stderr}`,
      );
    return JSON.parse(
      line.slice(prefix.length),
    ) as IGeneratedCameraDepthRuntimeProbe;
  } finally {
    fs.rmSync(output, { force: true, recursive: true });
  }
};

const runtimeRoot = (): { preserve: boolean; root: string } => {
  const configured = process.env.AUTOMOVIE_ISSUE_2135_RUNTIME_ROOT;
  if (configured === undefined)
    return {
      preserve: false,
      root: fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-repaint-runtime-contract-"),
      ),
    };
  const root = path.resolve(configured);
  const cache = path.join(REPOSITORY_ROOT, "node_modules/.cache");
  const relative = path.relative(cache, root);
  if (
    relative.length === 0 ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  )
    throw new Error(
      "The retained coverage fixture must be a dedicated child of node_modules/.cache.",
    );
  fs.rmSync(root, { force: true, recursive: true });
  fs.mkdirSync(root, { recursive: true });
  return { preserve: true, root };
};

const assertGeneratedRuntimeParity = (
  rendered: Readonly<Record<string, string>>,
): void => {
  const scaffold = path.join(REPOSITORY_ROOT, "packages/template/scaffold");
  const entrypoints = [
    "repaintSelectionReviews.ts",
    "scripts/capture-browser.ts",
    "scripts/capture-doctor.ts",
    "scripts/capture.ts",
    "scripts/captureDialogueRuntime.ts",
    "scripts/captureRuntimeClosure.ts",
    "scripts/generatedShotPlugin.ts",
    "scripts/preview.ts",
    "scripts/productionConfiguration.ts",
    "scripts/productionRuntimeState.ts",
    "scripts/render.ts",
    "scripts/renderCommand.ts",
    "scripts/renderHost.ts",
    "scripts/renderRuntime.ts",
    "scripts/renderChunkRuntime.ts",
    "scripts/renderFrameCaptureInput.ts",
    "scripts/renderSoundRuntime.ts",
    "scripts/renderPlanningRuntime.ts",
    "scripts/renderPublicationRuntime.ts",
    "scripts/renderGcRuntime.ts",
    "scripts/repaint.ts",
    "scripts/repaintCancellationRuntime.ts",
    "scripts/repaintCommand.ts",
    "scripts/repaintAdapter.ts",
    "scripts/withKokoroRuntimeOverrides.ts",
    "viewer/src/film.ts",
    "viewer/src/shot.ts",
    "viewer/src/shotRuntime.ts",
    "vite.config.ts",
  ];
  TestValidator.equals(
    "every generated runtime owner preserves the scaffold's own bytes in the rendered consumer",
    entrypoints.map((relative) => ({
      relative,
      rendered: rendered[relative],
      source: fs.readFileSync(path.join(scaffold, relative), "utf8"),
    })),
    entrypoints.map((relative) => {
      const source = fs.readFileSync(path.join(scaffold, relative), "utf8");
      return { relative, rendered: source, source };
    }),
  );
};

/** Actual generated-product consumer for the camera depth render gate. */
const generatedCameraDepthRuntimeProbe = (): string =>
  [
    'import type { IAutoMovieCompiledShotSource } from "@automovie/interface";',
    "",
    "const identity = {",
    "  translation: { x: 0, y: 0, z: 5 },",
    "  rotation: { x: 0, y: 0, z: 0, w: 1 },",
    "  scale: { x: 1, y: 1, z: 1 },",
    "};",
    "const compiled = {",
    "  eventSamples: [],",
    "  scene: {",
    '    id: "camera-depth-scene",',
    "    name: null,",
    "    nodes: [],",
    "    cameras: [{",
    '      id: "camera-depth",',
    "      transform: identity,",
    "      fovY: 45,",
    "      near: 0.25,",
    "      far: 250,",
    "      depthPrecision: { minimumDepthBits: 24, maximumStepMeters: 0.1 },",
    "    }],",
    "    lights: [],",
    "    environment: null,",
    "    space: null,",
    "    fog: null,",
    "  },",
    "  motions: [],",
    "  models: [],",
    "  formations: [],",
    "  instanceSets: [],",
    "  formationMotions: [],",
    "  formationSlotMotions: [],",
    "  effects: [],",
    "  shot: {",
    '    id: "camera-depth-shot",',
    "    name: null,",
    '    scene: "camera-depth-scene",',
    '    camera: "camera-depth",',
    "    duration: 1,",
    "    performances: [],",
    "    objectMotions: [],",
    "    cameraMotion: null,",
    "    lightMotions: [],",
    "  },",
    "} as unknown as IAutoMovieCompiledShotSource;",
    "",
    "export const cameraDepthRuntimeProbe = async () => {",
    '  const { createCompiledShotRuntime } = await import("../viewer/src/shotRuntime");',
    "  const runtime = await createCompiledShotRuntime(compiled);",
    "  let depthBits = 16;",
    "  let draws = 0;",
    "  const depthParameter = 0x0d56;",
    "  const renderer = {",
    "    capabilities: { logarithmicDepthBuffer: false, reverseDepthBuffer: false },",
    "    getContext: () => ({",
    "      DEPTH_BITS: depthParameter,",
    "      getParameter: (parameter: number) =>",
    "        parameter === depthParameter ? depthBits : null,",
    "    }),",
    "    domElement: { height: 100 },",
    "    toneMapping: 0,",
    "    toneMappingExposure: 1,",
    "    shadowMap: { enabled: false, type: 1 },",
    "    render: () => { ++draws; },",
    "  } as never;",
    "  const negative = (() => {",
    "    try {",
    '      runtime.render(renderer, 0, "beauty");',
    '      return "accepted";',
    "    } catch (error) {",
    "      return (error as Error).message;",
    "    }",
    "  })();",
    "  depthBits = 24;",
    '  const positive = runtime.render(renderer, 0, "beauty");',
    "  await runtime.dispose();",
    '  if (negative.includes("insufficient-capability") === false || draws !== 1)',
    '    throw new Error("depth runtime assertion did not gate the draw: " + negative + "; draws=" + String(draws));',
    "  return { negative, positive, draws };",
    "};",
    "",
    "void cameraDepthRuntimeProbe()",
    "  .then((result) => {",
    '    console.log("CAMERA_DEPTH_RUNTIME " + JSON.stringify(result));',
    "  })",
    "  .catch((error: unknown) => {",
    "    console.error(error);",
    "    process.exitCode = 1;",
    "  });",
    "",
  ].join("\n");

const REPAINT_RUNTIME_IDENTITY = {
  protocolVersion: "automovie.repaint-runtime.v1",
  provider: "generated-contract-host",
  model: "generated-contract-model",
  version: "sha256:generated-contract-revision",
  execution: "local",
} as const;

const REPAINT_PROVENANCE = {
  source: "local://generated-contract-host",
  license: "test-only generated fixture",
  termsCheckedAt: "2026-08-28",
  cost: "local test execution",
  consumer: {
    kind: "repaint" as const,
    reason: "Exercise the selected generated repaint command end to end.",
  },
};

const installGeneratedRepaintRuntimeFixtures = (root: string): void => {
  const repaintPath = path.join(root, "scripts/repaint.ts");
  const repaintSource = fs.readFileSync(repaintPath, "utf8");
  fs.writeFileSync(
    repaintPath,
    rewriteOnce(
      "The generated repaint entrypoint's capture-runtime import seam",
      repaintSource,
      'import { createProductionFrameCaptureRuntime } from "./capture";',
      'import { createProductionFrameCaptureRuntime } from "./repaintCaptureFixture";',
    ),
    "utf8",
  );
  const bytes = Buffer.from(productionPng(16, 16)).toString("base64");
  fs.writeFileSync(
    path.join(root, "scripts/repaintCaptureFixture.ts"),
    [
      'import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";',
      'import type { IProductionFrameCaptureRuntime } from "./capture";',
      "",
      `const bytes = Buffer.from(${JSON.stringify(bytes)}, "base64");`,
      `const runtimeIdentity: IAutoMovieCaptureRuntimeIdentity = ${JSON.stringify(testCaptureRuntimeIdentity())};`,
      "",
      "export const createProductionFrameCaptureRuntime = (): IProductionFrameCaptureRuntime => {",
      '  let dialogue: ReturnType<IProductionFrameCaptureRuntime["dialogue"]> = null;',
      '  let deliveryCrop: ReturnType<IProductionFrameCaptureRuntime["deliveryCrop"]> = null;',
      "  return {",
      "    capture: async (input) => {",
      "      const width = input.width ?? 0;",
      "      const height = input.height ?? 0;",
      "      if (width !== 16 || height !== 16)",
      '        throw new Error("The repaint capture fixture accepts only 16x16, received " + String(width) + "x" + String(height) + ".");',
      "      return {",
      "        bytes: new Uint8Array(bytes),",
      "        dialogueRuntimeIdentity: null,",
      "        runtimeIdentity,",
      "        width,",
      "        height,",
      '        observation: { status: "not-run", reason: "The repaint capture fixture draws no scene graph." },',
      '        maskSidecar: { status: "not-run", reason: "The repaint capture fixture derives no semantic mask." },',
      "      };",
      "    },",
      "    close: async () => undefined,",
      "    dialogue: () => structuredClone(dialogue),",
      "    deliveryCrop: () => structuredClone(deliveryCrop),",
      "    installDeliveryCrop: async (value) => { deliveryCrop = structuredClone(value); },",
      "    installDialogue: async (value) => { dialogue = structuredClone(value); },",
      "    pageIdentity: (input) => JSON.stringify(input),",
      "    viewerRuntime: () => ({",
      "      dialogue: () => structuredClone(dialogue),",
      "      deliveryCrop: () => structuredClone(deliveryCrop),",
      "    }),",
      "    metrics: () => ({",
      "      pagesOpened: 0, navigations: 0, seeks: 0, captures: 0,",
      "      captureMilliseconds: 0, avoidedPageReloads: 0,",
      "      capturesPerNavigation: 0, capturesPerSecond: 0,",
      "    }),",
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "scripts/repaintAdapter.ts"),
    [
      'import type { AutoMovieProductionShotRepaint } from "@automovie/interface";',
      'import fs from "node:fs";',
      'import path from "node:path";',
      "",
      "export const repaintProductionShot: AutoMovieProductionShotRepaint = async (input) => {",
      '  const mode = fs.readFileSync(path.join(input.projectRoot, "repaint-adapter-mode.txt"), "utf8").trim();',
      '  if (mode === "impossible") {',
      '    fs.writeFileSync(path.join(input.projectRoot, "repaint-impossible-policy-invoked.txt"), "called\\n", "utf8");',
      '    throw new Error("The impossible-policy adapter must never run.");',
      "  }",
      '  if (mode === "default")',
      '    throw new Error("This project supplies no repaint adapter. Implement repaintProductionShot in scripts/repaintAdapter.ts with a local model or an API client, or set visualDelivery to \\"deterministic\\". AutoMovie will not fabricate diffusion output.");',
      '  if (mode === "transport") {',
      '    const marker = path.join(input.projectRoot, "repaint-transport-observed.txt");',
      "    if (fs.existsSync(marker) === false) {",
      '      fs.writeFileSync(marker, "observed\\n", "utf8");',
      '      const error = new Error("The deterministic adapter transport closed once.");',
      '      error.name = "FetchError";',
      "      throw error;",
      "    }",
      "  }",
      "  return {",
      '    bytes: fs.readFileSync(path.join(input.projectRoot, "repaint-success.mp4")),',
      '    mediaType: "video/mp4",',
      "    costUnits: 1,",
      `    runtimeIdentity: ${JSON.stringify(REPAINT_RUNTIME_IDENTITY)},`,
      "  };",
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "repaint-adapter-mode.txt"),
    "default\n",
    "utf8",
  );
};

const configureGeneratedRepaint = async (
  root: string,
): Promise<{
  adapterBytes: Uint8Array;
  referencePath: string;
  sourceBundle: string;
}> => {
  const referencePath = "public/repaint/generated-repaint-reference.png";
  /**
   * The reviewed repaint adoption this generated production authors.
   *
   * It goes on the design record rather than into a configuration file beside
   * `src`, so a changed prompt, seed, reference, or policy stales the compile
   * that consumed it. The per-candidate selection review deliberately does not
   * travel with it: a request is design, while a candidate review is an
   * observation of a render the current source already produced, and recording
   * one must not invalidate that render. `repaintSelectionReviews.ts` therefore
   * stays outside compiler content and the runtime joins it by shot.
   */
  const authoredRepaint: NonNullable<IAutoMovieProductionDesign["repaint"]> = {
    generator: {
      runtimeIdentity: REPAINT_RUNTIME_IDENTITY,
      generatorProvenance: REPAINT_PROVENANCE,
    },
    executionPolicy: {
      maximumAttempts: 3,
      attemptTimeoutMs: 30_000,
      maximumElapsedMs: 120_000,
      maximumCostUnits: 3,
      backoffMs: [0, 0],
      retryableFailures: ["rate-limit", "timeout", "transport"],
    },
    requests: [
      {
        shot: "opening",
        parameters: {
          prompt: "Preserve every deterministic structure.",
          negativePrompt: "Do not alter camera, timing, or motion.",
          seed: 2135,
          strength: 0.25,
          controls: { contract: true },
        },
        references: [{ role: "structure", path: referencePath }],
        evidence: {
          prompt:
            "docs/settings/050-art-direction.md#art-delivery-review-condition",
          continuity: "docs/treatments/001-cue.md#event-call",
          settings:
            "docs/settings/050-art-direction.md#art-delivery-review-condition",
          design: "docs/models/010-soloist.md#soloist-blocking-representation",
          screenplayOrBrief: "docs/screenplays/001-cue/001-cue.md#scn-001",
          shot: "src/shots/opening.ts#opening",
        },
      },
    ],
  };
  const productionPath = path.join(root, "src/production.ts");
  fs.writeFileSync(
    productionPath,
    (
      [
        ['visualDelivery: "deterministic"', 'visualDelivery: "repainted"'],
        ["width: 1280", "width: 16"],
        ["height: 720", "height: 16"],
      ] as const
    ).reduce(
      (source, [anchor, replacement]) =>
        rewriteOnce(
          "The generated repaint production's delivery slot",
          source,
          anchor,
          replacement,
        ),
      fs.readFileSync(productionPath, "utf8"),
    ),
    "utf8",
  );
  const productionContractPath = path.join(
    root,
    "automovie/design/repaint-runtime-film/production.json",
  );
  const productionContract = JSON.parse(
    fs.readFileSync(productionContractPath, "utf8"),
  ) as IAutoMovieProductionDesign;
  if (
    productionContract.visualDelivery !== "deterministic" ||
    productionContract.frameFormat.width !== 1280 ||
    productionContract.frameFormat.height !== 720
  )
    throw new Error(
      "Generated repaint production contract no longer has the deterministic 1280 by 720 baseline.",
    );
  productionContract.visualDelivery = "repainted";
  productionContract.frameFormat.width = 16;
  productionContract.frameFormat.height = 16;
  productionContract.repaint = authoredRepaint;
  fs.writeFileSync(
    productionContractPath,
    `${JSON.stringify(productionContract, null, 2)}\n`,
    "utf8",
  );
  const referenceBytes = productionPng(16, 16);
  const generationPrompt =
    "Create the deterministic 16 by 16 repaint structure reference fixture.";
  const referenceFile = path.join(root, referencePath);
  fs.mkdirSync(path.dirname(referenceFile), { recursive: true });
  fs.writeFileSync(referenceFile, referenceBytes);
  const manifestPath = path.join(root, "automovie/assets.json");
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as IAutoMovieAssetManifest;
  manifest.assets.push({
    path: referencePath,
    digest: digestAutoMovieBytes(referenceBytes),
    generated: {
      provider: "automovie-test-fixture",
      model: "production-png-v1",
      request: null,
      prompt: generationPrompt,
      promptDigest: digestAutoMovieBytes(Buffer.from(generationPrompt, "utf8")),
      inputs: [],
      outputDigest: digestAutoMovieBytes(referenceBytes),
      reproducible: false,
      seed: null,
    },
    license: {
      identifier: "MIT",
      url: "https://github.com/samchon/AutoMovie/blob/master/LICENSE",
      notice: "Generated entirely inside the repaint runtime contract test.",
    },
    processing: [],
    uses: [
      {
        production: "repaint-runtime-film",
        consumer: { kind: "rendition-reference", id: "opening" },
        reason:
          "The generated repaint command consumes this structural reference.",
      },
    ],
  });
  manifest.assets.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const compiled = runGeneratedFast(root, "scripts/compile.ts");
  if (compiled.status !== 0)
    throw new Error(
      `Generated repaint fixture did not compile: ${compiled.stderr}`,
    );
  const project = AutoMovieProductionProject.open(root, "repaint-runtime-film");
  const generated = project.generatedManifest();
  const design = project.graph();
  const production = design.production;
  const shot = design.shots.get("opening");
  if (generated === null || production === null || shot === undefined)
    throw new Error(
      "Generated repaint fixture has no compiled opening design.",
    );
  if (
    production.visualDelivery !== "repainted" ||
    production.frameFormat.width !== 16 ||
    production.frameFormat.height !== 16
  )
    throw new Error(
      "Generated repaint fixture compile did not publish the repainted 16 by 16 production contract.",
    );
  const frameCount = Math.round(
    shot.durationSeconds * production.frameFormat.fps,
  );
  const frameBytes = productionPng(
    production.frameFormat.width,
    production.frameFormat.height,
  );
  const frames: IAutoMovieRenderBundleManifest["frames"] = Array.from(
    { length: frameCount },
    (_, index) =>
      (["beauty", "depth"] as const).map((pass) => ({
        index,
        time: index / production.frameFormat.fps,
        pass,
        path: `${pass}-${String(index).padStart(6, "0")}.png`,
        digest: digestAutoMovieBytes(frameBytes),
        width: production.frameFormat.width,
        height: production.frameFormat.height,
      })),
  ).flat();
  const sourceManifest: IAutoMovieRenderBundleManifest = {
    version: 5,
    target: { kind: "shot", id: "opening" },
    compileFingerprint: generated.inputFingerprint,
    dialogueRuntimeIdentity: null,
    rendererIdentity: testRendererIdentity(),
    targetFingerprint: productionRenderTargetFingerprint(project, generated, {
      kind: "shot",
      id: "opening",
    }),
    renderSpec: {
      target: "opening",
      frameFormat: {
        width: production.frameFormat.width,
        height: production.frameFormat.height,
        fps: production.frameFormat.fps,
        ...(production.frameFormat.crop === undefined
          ? {}
          : { crop: structuredClone(production.frameFormat.crop) }),
      },
      toneMapping: "none",
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 24,
    },
    frames,
  };
  const sourceBundle = productionRenderBundleRelativePath(sourceManifest);
  project.commitRenderBundle(
    sourceBundle,
    new Map(frames.map((frame) => [frame.path, frameBytes])),
    sourceManifest,
  );
  if (
    project.verifiedRenderManifest(
      path.join(project.renderRoot(), sourceBundle, "manifest.json"),
    ) === null
  )
    throw new Error(
      "Generated repaint fixture could not verify its just-committed source bundle.",
    );
  return {
    adapterBytes: await productionH264Mp4({
      width: production.frameFormat.width,
      height: production.frameFormat.height,
      fps: production.frameFormat.fps,
      frameCount,
    }),
    referencePath,
    sourceBundle,
  };
};

const withGeneratedRepaintSelectionReview = (candidate: {
  attemptId: string;
  output: { digest: string };
}): string => {
  const review = {
    opening: {
      candidateAttemptId: candidate.attemptId,
      candidateOutputDigest: candidate.output.digest,
      reason:
        "The reviewed candidate preserves the authored blocking and delivery intent.",
      structuralReview:
        "The deterministic depth pass preserves camera, geometry, contact, and timing.",
      continuityReview: {
        baseline: "docs/treatments/001-cue.md#event-call",
        playbackEvidence:
          "The candidate passed full-speed sequence playback against both adjoining cuts.",
        mixedDeliveryPolicy: null,
        flicker: "pass",
        identityDrift: "pass",
        geometryWarp: "pass",
        textureCrawl: "pass",
        transitionMismatch: "pass",
      },
    },
  };
  return [
    'import type { IAutoMovieProductionRepaintSelectionReview } from "./scripts/productionConfiguration";',
    "",
    "export const repaintSelectionReviews =",
    `  ${JSON.stringify(review, null, 2).replaceAll("\n", "\n  ")} satisfies Readonly<`,
    "    Record<string, IAutoMovieProductionRepaintSelectionReview>",
    "  >;",
    "",
  ].join("\n");
};

/**
 * Generated repaint entrypoints preserve authored selection and publication.
 *
 * Scenarios:
 *
 * 1. The actual rendered docs are byte-identical to the completed fixture and
 *    a removed citation makes the normal evidence-active command red once;
 *    restoration makes the same normal compiler green.
 * 2. The generated compiler publishes one current completed-film state.
 * 3. Unknown, unplanned verification and finalization actions refuse through
 *    the generated render entrypoint instead of fabricating current output.
 * 4. Dry and applied garbage collection accept the compiled state before any
 *    render-job root exists, publish explicit results, and clean up their
 *    acquired runtime resources.
 * 5. The actual generated repaint entrypoint refuses invalid operations and a
 *    stale source mutation before any request identity can exist.
 * 6. A default-adapter terminal refusal returns its durable request id but is
 *    not retryable; a transient transport failure is stored as retryable and
 *    the next bounded automatic attempt recovers into a candidate.
 * 7. A fresh successful reroll creates a second unselected candidate, a
 *    control-plane review keeps its deterministic compile current, selection
 *    activates it, stale config refuses another candidate, and restoration
 *    permits an explicit reversal to the earlier candidate.
 * 8. Only after every semantic action runs, every source runtime owner must be
 *    byte-identical in scaffold, rendered consumer, and main-owned gate cache.
 */
export const test_cli_scaffold_repaint_runtime_contract =
  async (): Promise<void> => {
    const fixture = runtimeRoot();
    let failure: { error: unknown } | undefined;
    try {
      const rendered = renderScaffold({ name: "repaint-runtime-film" });
      const completed = renderCompletedFilmFixture("repaint-runtime-film");
      for (const [file, content] of Object.entries(completed))
        rendered[file] = content;
      rendered["test/camera-depth-runtime.ts"] =
        generatedCameraDepthRuntimeProbe();
      installAuthoredEvidencePopulation(rendered);
      rendered["src/film.ts"] = rewriteOnce(
        "The generated-runtime fixture's caption population for the no-synthesis render twin",
        rendered["src/film.ts"]!,
        /[ ]{8}captions: \[\n(?:.|\n)*?[ ]{8}\],\n[ ]{8}effects: \[\],/u,
        "        captions: [],\n        effects: [],",
      );
      writeFiles(fixture.root, rendered);
      const completedDocuments = Object.entries(completed)
        .filter(([file]) => /^docs\/.+\.md$/u.test(file))
        .sort(([left], [right]) => left.localeCompare(right));
      TestValidator.equals(
        "the evidence graph reads the byte-identical actual completed-film documents",
        completedDocuments.map(([file, source]) => ({
          file,
          rendered: fs.readFileSync(path.join(fixture.root, file), "utf8"),
          source,
        })),
        completedDocuments.map(([file, source]) => ({
          file,
          rendered: source,
          source,
        })),
      );
      for (const name of [
        "@automovie/archetypes",
        "@automovie/engine",
        "@automovie/evidence",
        "@automovie/interface",
        "@automovie/production",
        "@automovie/render",
        "@automovie/template",
        "@automovie/viewer",
        "@huggingface/transformers",
        "@ttsc/evidence",
        "@ttsc/lint",
        "@types/node",
        "@types/pngjs",
        "@types/three",
        "automovie",
        "h264-mp4-encoder",
        "kokoro-js",
        "libopus-wasm",
        "mp4box",
        "onnxruntime-node",
        "playwright",
        "pngjs",
        "three",
        // What a real generated project installs. The fixture had only the
        // repository's 5.9 alias, and `ttsc` wants the native compiler; while
        // `@automovie/production` was a symlink to the workspace, resolution
        // walked out of it and found the repository's own 7.0. Handing over the
        // published shape closes that walk, and the borrowed compiler became a
        // missing one.
        "typescript",
        "typescript-compiler",
        "vite",
      ])
        linkWorkspacePackage(fixture.root, name);
      installGeneratedRepaintRuntimeFixtures(fixture.root);

      const cameraDepthRuntime = await runGeneratedCameraDepthRuntime(
        fixture.root,
      );
      TestValidator.equals(
        "the actual generated shot runtime gates the current draw framebuffer before rendering",
        {
          negative: cameraDepthRuntime.negative.includes(
            'Camera depth precision refused "camera-depth": insufficient-capability',
          ),
          positive: cameraDepthRuntime.positive.includes(
            "camera-depth-shot  t=0.000s  beauty",
          ),
          draws: cameraDepthRuntime.draws === 1,
        },
        { negative: true, positive: true, draws: true },
      );

      const evidenceDelivery = path.join(
        fixture.root,
        "docs/settings/000-governing-aim.md",
      );
      const evidenceBytes = fs.readFileSync(evidenceDelivery);
      const evidenceDigest = digestAutoMovieBytes(evidenceBytes);
      fs.writeFileSync(
        evidenceDelivery,
        rewriteFirst(
          "The generated-runtime evidence negative",
          evidenceBytes.toString("utf8"),
          /^@evidence principles\/core\/common\.md#machine-default .+\n@evidenceReview principles\/core\/common\.md#machine-default .+\n/mu,
          "",
        ),
        "utf8",
      );
      const rejectedEvidence = runGenerated(
        fixture.root,
        "scripts/compile.ts",
        [],
        true,
      );
      fs.writeFileSync(evidenceDelivery, evidenceBytes);
      // The accepted half only means something if the restore was exact. A
      // near-restore would let a real refusal read as a harness artifact and a
      // harness artifact read as a product defect, which is the confusion this
      // scenario exists to remove.
      const restoredDigest = digestAutoMovieBytes(
        fs.readFileSync(evidenceDelivery),
      );
      if (restoredDigest !== evidenceDigest)
        throw new Error(
          `The generated-runtime evidence negative did not restore its authored bytes: ${evidenceDigest} became ${restoredDigest}.`,
        );
      const acceptedEvidence = runGenerated(
        fixture.root,
        "scripts/compile.ts",
        [],
        true,
      );
      const rejectedEvidenceOutput = generatedOutput(rejectedEvidence);
      const acceptedEvidenceOutput = generatedOutput(acceptedEvidence);
      if (
        acceptedEvidence.status !== 0 ||
        acceptedEvidenceOutput.includes("[evidence/graph]")
      )
        throw new Error(
          [
            `The restored generated evidence graph refused its own byte-for-byte authored population (status ${String(acceptedEvidence.status)}).`,
            `stdout: ${acceptedEvidence.stdout}`,
            `stderr: ${acceptedEvidence.stderr}`,
          ].join("\n"),
        );
      TestValidator.equals(
        "normal generated commands keep the completed fixture's real evidence guard active",
        {
          acceptedStatus: acceptedEvidence.status,
          acceptedGraphDiagnostics:
            acceptedEvidenceOutput.includes("[evidence/graph]"),
          negativeFailed: rejectedEvidence.status !== 0,
          negativeNamedTarget: rejectedEvidenceOutput.includes(
            "principles/core/common.md#machine-default",
          ),
          negativeSingleDiagnostic:
            [...rejectedEvidenceOutput.matchAll(/\[evidence\/graph\]/gu)]
              .length === 1,
        },
        {
          acceptedStatus: 0,
          acceptedGraphDiagnostics: false,
          negativeFailed: true,
          negativeNamedTarget: true,
          negativeSingleDiagnostic: true,
        },
      );

      // The measurement `review-verification/measurements.md` tells an author
      // to run. `npm run texture:scale` is wired, is documented, and no test
      // had ever run it once, so its charged lines were ordinary debt rather
      // than a reading that lost its address. It rides here because the script
      // requires the project state to be `current` and the compile above just
      // made it so; a fixture of its own would pay for a second compile to
      // reach the same condition.
      const textureScale = runGenerated(
        fixture.root,
        "scripts/measureTextureScale.ts",
        [],
        true,
      );
      const textureScaleOutput = generatedOutput(textureScale);
      TestValidator.equals(
        "the documented texture-scale measurement runs and reports its own census",
        {
          status: textureScale.status,
          // The census line is unconditional, so its absence is the script
          // failing to reach its own end rather than a fixture with nothing to
          // measure. Whether this fixture declares a checkable coordinate
          // source is not this test's claim: both endings are honest readings
          // and the script says which one it took.
          census:
            /measured \d+ model\(s\), \d+ part\(s\), \d+ carrying texture coordinates; \d+ structured texture binding\(s\), \d+ of them declaring a checkable coordinate source/u.test(
              textureScaleOutput,
            ),
          verdict:
            textureScaleOutput.includes(
              "no binding declared a checkable coordinate source",
            ) ||
            /every one of those \d+ claim\(s\) agrees with the surface it is bound to/u.test(
              textureScaleOutput,
            ),
        },
        { status: 0, census: true, verdict: true },
      );

      // The rest of the documented commands that need no browser. Ten of the
      // scaffold's commands read as never loaded by any process in the whole
      // suite, and these are the four a headless fixture can answer for; the
      // others open a capture host and belong with the GPU path.
      //
      // Order is part of the contract rather than a convenience. `design`
      // rewrites `production.json`, which makes the compile fingerprint stale,
      // and every command that requires current state refuses after it -- which
      // is the product refusing correctly. Running them in the other order was
      // how that was learned: `building:report` answered
      // `current-compile-invalid, compile-fingerprint-stale`, naming the
      // command to run first.
      const buildingReport = runGenerated(
        fixture.root,
        "scripts/deriveBuilding.ts",
        [],
        true,
      );
      const exampleArtifact = runGenerated(
        fixture.root,
        "scripts/deriveExampleArtifact.ts",
        [],
        true,
      );
      // `lint` belongs with these rather than after `design`, for the reason
      // the order comment above gives: run once the design has been rewritten
      // it answers `generated-manifest-stale`, which is a true reading of a
      // stale project and a useless one about the command. Here it judges the
      // project this fixture actually compiled. It costs 36 seconds, not the
      // 106 it cost before a generated consumer stopped type-checking every
      // workspace source tree it imports.
      const linted = runGenerated(fixture.root, "scripts/lint.ts", [], true);
      const verifyRun = runGenerated(
        fixture.root,
        "scripts/verify.ts",
        [],
        true,
      );
      const emittedDesign = runGenerated(
        fixture.root,
        "scripts/emitDesign.ts",
        [],
        true,
      );
      const verifiedOutput = generatedOutput(verifyRun);
      // `verify` prints a verdict rather than a message, and its exit code is
      // that verdict's own `success`. This fixture has no render deliverable,
      // so the honest answer here is a refusal carrying the reason -- and the
      // pair is what the assertion reads, because a script that printed a
      // verdict and exited on a different code would be the defect.
      const verdict = JSON.parse(
        verifiedOutput.slice(verifiedOutput.indexOf("{")),
      ) as {
        compiler?: { inputFingerprint?: string };
        diagnostics?: Array<{ code?: string }>;
        success?: boolean;
      };
      const lintText = generatedOutput(linted);
      const lintVerdict = JSON.parse(lintText.slice(lintText.indexOf("{"))) as {
        compiler?: { inputFingerprint?: string };
        success?: boolean;
      };
      TestValidator.equals(
        "every documented headless command runs and answers in its own shape",
        {
          buildingStatus: buildingReport.status,
          exampleStatus: exampleArtifact.status,
          exampleWrote:
            /updated automovie\/derived\/examples\/[^ ]+ \(sha256:[0-9a-f]{64}\)/u.test(
              generatedOutput(exampleArtifact),
            ),
          designStatus: emittedDesign.status,
          designNamedProduction:
            generatedOutput(emittedDesign).includes("production.json"),
          verifyAgrees:
            verdict.success === (verifyRun.status === 0) ||
            verdict.success === undefined,
          verifyFingerprinted: (
            verdict.compiler?.inputFingerprint ?? ""
          ).startsWith("sha256:"),
          // `lint` answers in the same shape, so it is read the same way: a
          // verdict whose exit code is its own `success`, carrying the
          // fingerprint it judged.
          lintAgrees: lintVerdict.success === (linted.status === 0),
          lintFingerprinted: (
            lintVerdict.compiler?.inputFingerprint ?? ""
          ).startsWith("sha256:"),
          verifyReasoned:
            verdict.success === true ||
            (verdict.diagnostics ?? []).some(
              (one) => typeof one?.code === "string",
            ),
        },
        {
          buildingStatus: 0,
          exampleStatus: 0,
          exampleWrote: true,
          designStatus: 0,
          designNamedProduction: true,
          verifyAgrees: true,
          verifyFingerprinted: true,
          lintAgrees: true,
          lintFingerprinted: true,
          verifyReasoned: true,
        },
      );

      // The first of the commands that opens a capture host, and the only one
      // of those four a fixture without a browser can answer for. It reads as
      // loaded by no process in the whole suite, which for a command whose
      // whole job is to tell an author what is wrong with their capture
      // runtime is worse than untested: nobody had seen it diagnose anything.
      //
      // No browser is installed here, so the honest answer is a refusal, and
      // what makes the refusal worth having is that it names the command to
      // run next. A doctor that reports a fault without saying what to do
      // about it has not finished its job, and that sentence is the assertion.
      const doctor = runGenerated(
        fixture.root,
        "scripts/capture-doctor.ts",
        [],
        true,
      );
      const doctorOutput = generatedOutput(doctor);
      TestValidator.equals(
        "the capture doctor diagnoses a missing browser and names the remedy",
        {
          status: doctor.status,
          named: doctorOutput.includes(
            "Package-owned Chromium is not installed for this project",
          ),
          remedy: doctorOutput.includes("npm run capture:install"),
          // And it says to come back, so the author is not left holding a
          // half-finished instruction.
          returns:
            [...doctorOutput.matchAll(/npm run capture:doctor/gu)].length >= 1,
        },
        { status: 1, named: true, remedy: true, returns: true },
      );

      // The last two documented commands, read for what they answer without a
      // capture host. "Requires a browser" was taken for "cannot be tested",
      // and that step does not follow: a command that needs a host still runs
      // everything up to the point of needing one, and what it does there is
      // the contract an author meets first. `capture:doctor` proved it -- its
      // refusal path is tested and its charge fell from nine lines to four.
      //
      // Here that point is argument validation. An author who types
      // `npm run preview` with nothing after it is told exactly what to pass,
      // and a command that answered with a stack trace or a usage-free
      // non-zero exit would be failing them at the first step.
      const previewed = runGenerated(
        fixture.root,
        "scripts/preview.ts",
        [],
        true,
      );
      const spun = runGenerated(fixture.root, "scripts/turntable.ts", [], true);
      TestValidator.equals(
        "a capture command with no argument names the argument it needs",
        {
          previewStatus: previewed.status,
          previewNames: generatedOutput(previewed).includes(
            "preview requires --shot <authored-shot-id>",
          ),
          turntableStatus: spun.status,
          turntableNames: generatedOutput(spun).includes(
            "turntable requires --asset <compiled-model-id>",
          ),
        },
        {
          previewStatus: 1,
          previewNames: true,
          turntableStatus: 1,
          turntableNames: true,
        },
      );

      // The one action that still needs its own process: it asks the CLI entry
      // whether a refusal becomes a non-zero exit and a printed diagnostic.
      // Everything after it asks the command contract instead, and rides in one
      // driver child rather than five more compiles.
      const invalid = runGeneratedFast(fixture.root, "scripts/render.ts", [
        "unknown",
      ]);
      // Installed before the compile, not after. A generated project's input
      // fingerprint covers its own scripts, so adding one afterwards makes the
      // manifest stale and every later action refuses -- which is the product
      // refusing correctly, and the constraint any batching has to obey.
      installGeneratedRenderDriver(fixture.root);
      const compiled = runGeneratedFast(fixture.root, "scripts/compile.ts");
      const [status, verified, finalized, dryGc, appliedGc] =
        runGeneratedRenderActions(fixture.root, [
          ["status"],
          ["verify"],
          ["finalize"],
          ["gc"],
          ["gc", "--apply"],
        ]) as [
          IRenderActionResult,
          IRenderActionResult,
          IRenderActionResult,
          IRenderActionResult,
          IRenderActionResult,
        ];
      if (compiled.status !== 0)
        throw new Error(
          `Generated no-plugin compile failed: ${compiled.stdout}\n${compiled.stderr}`,
        );
      // The render cleanup actions are the only two commands here expected to
      // succeed, so a boolean is all the assertion below can say about them and
      // a reader of a red run learns nothing. Both CI platforms reported
      // `dryGcStatus` and `appliedGcStatus` false with every earlier outcome
      // true, which is a command that ran and failed rather than a contract
      // that changed. Surface what it printed.
      for (const [label, result] of [
        ["gc", dryGc],
        ["gc --apply", appliedGc],
      ] as const)
        if (result.status !== 0)
          throw new Error(
            [
              `Generated render ${label} refused: ${result.error}`,
              result.out,
            ].join("\n"),
          );
      TestValidator.equals(
        "generated compile and render actions keep explicit refusal and cleanup outcomes",
        {
          invalidStatus: invalid.status !== 0,
          invalidDiagnostic: invalid.stderr.includes("Unknown render action"),
          compiledStatus: compiled.status === 0,
          compiledPublication: fs.existsSync(
            path.join(
              fixture.root,
              "generated/repaint-runtime-film/manifests/compile.json",
            ),
          ),
          statusRefusal: status.status !== 0,
          verifyRefusal: verified.status !== 0,
          finalizeRefusal: finalized.status !== 0,
          dryGcStatus: dryGc.status === 0,
          appliedGcStatus: appliedGc.status === 0,
          dryGcPublication: dryGc.out.includes('"applied": false'),
          appliedGcPublication: appliedGc.out.includes('"applied": true'),
        },
        {
          invalidStatus: true,
          invalidDiagnostic: true,
          compiledStatus: true,
          compiledPublication: true,
          statusRefusal: true,
          verifyRefusal: true,
          finalizeRefusal: true,
          dryGcStatus: true,
          appliedGcStatus: true,
          dryGcPublication: true,
          appliedGcPublication: true,
        },
      );
      const repaint = await configureGeneratedRepaint(fixture.root);
      const confinedRepaint = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        ["opening"],
      );
      // The two negatives below mutate the authored repaint adoption, which now
      // lives on the design record rather than in a configuration file. They
      // keep rewriting bytes through `rewriteOnce` on purpose: that helper
      // throws when its anchor is gone, which is what makes a negative case go
      // red instead of quietly asserting against unmutated material.
      const configuredPath = path.join(
        fixture.root,
        "automovie/design/repaint-runtime-film/production.json",
      );
      const selectionReviewsPath = path.join(
        fixture.root,
        "repaintSelectionReviews.ts",
      );
      const configuredSource = fs.readFileSync(configuredPath, "utf8");
      fs.writeFileSync(
        configuredPath,
        rewriteOnce(
          "The generated repaint stale-source negative's reference slot",
          configuredSource,
          repaint.referencePath,
          "public/repaint/generated-repaint-reference-missing.png",
        ),
        "utf8",
      );
      const staleSourceRefusal = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        ["reroll", "--shot", "opening"],
      );
      fs.writeFileSync(configuredPath, configuredSource, "utf8");
      const adapterMode = path.join(fixture.root, "repaint-adapter-mode.txt");
      const impossiblePolicyInvocation = path.join(
        fixture.root,
        "repaint-impossible-policy-invoked.txt",
      );
      fs.writeFileSync(
        configuredPath,
        rewriteOnce(
          "The generated repaint config's transport retry slot",
          configuredSource,
          '"transport"',
          '"cancelled"',
        ),
        "utf8",
      );
      fs.writeFileSync(adapterMode, "impossible\n", "utf8");
      const impossiblePolicyRefusal = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        ["reroll", "--shot", "opening"],
      );
      fs.writeFileSync(configuredPath, configuredSource, "utf8");
      fs.writeFileSync(adapterMode, "default\n", "utf8");
      // The impossible retry class must be refused before any adapter runs, and
      // the refusal has to name what was wrong.
      //
      // This case used to require exit 2 and the type name
      // `AutoMovieRepaintRetryableFailureClass`, and both belonged to a guard
      // that moved rather than one that was lost. The value lived in a
      // TypeScript configuration file, so an invalid union member was a compile
      // error and `ttsx` refused to start the script at all, which is where the
      // exit code and the type name came from. The authored value now lives in
      // governed source that `emitDesign` publishes as the design record, so the
      // compile-time guard still holds at its owner, and this case mutates the
      // emitted record instead, which no author edits by hand. What it exercises
      // is the runtime guard on a derived artifact, and that guard names the
      // exact path and the accepted set rather than the type.
      //
      // It does not echo the rejected value, so this pins the indexed position
      // instead: `retryableFailures[2]` locates the member an author has to
      // correct, and naming one accepted member proves the refusal came from
      // the union rather than from a missing field.
      //
      // Both halves survive, in different places. Requiring the old exit code
      // here would pin a compile-time refusal to a file TypeScript cannot see.
      if (impossiblePolicyRefusal.status !== 1)
        throw new Error(
          [
            `The impossible retry policy exited ${impossiblePolicyRefusal.status} rather than refusing with 1.`,
            impossiblePolicyRefusal.stdout,
            impossiblePolicyRefusal.stderr,
          ].join("\n"),
        );
      if (
        AutoMovieProductionProject.open(
          fixture.root,
          "repaint-runtime-film",
        ).verifiedRenderManifest(
          path.join(
            fixture.root,
            "renders",
            "repaint-runtime-film",
            repaint.sourceBundle,
            "manifest.json",
          ),
        ) === null
      )
        throw new Error(
          "Generated repaint source bundle became unverifiable after restoring the policy and adapter bytes.",
        );
      const defaultAdapterRefusal = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        ["reroll", "--shot", "opening"],
      );
      const repaintProject = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      );
      const beforeRenditions = repaintProject.verifiedRepaintRenditions([
        "opening",
      ]);
      const defaultAdapterOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        diagnostics: Array<{ code: string; message: string }>;
      }>("The generated default-adapter refusal", defaultAdapterRefusal);
      if (defaultAdapterOutput.requestId === null)
        throw new Error(
          `The terminal default-adapter attempt emitted no resumable request id: status=${String(defaultAdapterRefusal.status)} stdout=${JSON.stringify(defaultAdapterRefusal.stdout)} stderr=${JSON.stringify(defaultAdapterRefusal.stderr)}.`,
        );
      const terminalAttempts = repaintProject.repaintRequestAttempts(
        defaultAdapterOutput.requestId,
      );
      TestValidator.equals(
        "the actual generated repaint CLI separates stale source refusal from a durable terminal attempt",
        {
          confinedStatus: confinedRepaint.status !== 0,
          confinedDiagnostic: confinedRepaint.stderr.includes(
            "repaint requires exactly one operation",
          ),
          staleSourceStatus: staleSourceRefusal.status,
          staleSourceStdout: staleSourceRefusal.stdout,
          staleSourceDiagnostic:
            staleSourceRefusal.stderr.includes(
              "Dialogue capture requires a current source compile",
            ) && staleSourceRefusal.stderr.includes("generated-stale"),
          impossiblePolicyStatus: impossiblePolicyRefusal.status,
          impossiblePolicyStdout: impossiblePolicyRefusal.stdout,
          impossiblePolicyDiagnostic:
            impossiblePolicyRefusal.stderr.includes(
              "repaint.executionPolicy.retryableFailures[2]",
            ) && impossiblePolicyRefusal.stderr.includes('"provider-refusal"'),
          impossiblePolicyInvoked: fs.existsSync(impossiblePolicyInvocation),
          defaultStatus: defaultAdapterRefusal.status,
          defaultRepainted: defaultAdapterOutput.repainted,
          defaultSelected: defaultAdapterOutput.selected,
          defaultRequestId: defaultAdapterOutput.requestId,
          defaultCode: defaultAdapterOutput.diagnostics[0]?.code,
          namesDefaultAdapter: terminalAttempts[0]?.failure?.message.includes(
            "supplies no repaint adapter",
          ),
          terminalAttempts: terminalAttempts.map((attempt) => ({
            requestId: attempt.requestId,
            status: attempt.status,
          })),
          beforeRenditions,
        },
        {
          confinedStatus: true,
          confinedDiagnostic: true,
          staleSourceStatus: 1,
          staleSourceStdout: "",
          staleSourceDiagnostic: true,
          impossiblePolicyStatus: 1,
          impossiblePolicyStdout: "",
          impossiblePolicyDiagnostic: true,
          impossiblePolicyInvoked: false,
          defaultStatus: 1,
          defaultRepainted: false,
          defaultSelected: false,
          defaultRequestId: defaultAdapterOutput.requestId,
          defaultCode: "repaint-failed",
          namesDefaultAdapter: true,
          terminalAttempts: [
            {
              requestId: defaultAdapterOutput.requestId,
              status: "failed",
            },
          ],
          beforeRenditions: [],
        },
      );
      const nonretryableRetry = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        [
          "retry",
          "--shot",
          "opening",
          "--request",
          defaultAdapterOutput.requestId,
        ],
      );
      const nonretryableRetryOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        diagnostics: Array<{ code: string }>;
      }>("The generated nonretryable retry", nonretryableRetry);
      const adapterMedia = path.join(fixture.root, "repaint-success.mp4");
      fs.writeFileSync(adapterMedia, repaint.adapterBytes);
      fs.writeFileSync(adapterMode, "transport\n", "utf8");
      const transportRecovery = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        ["reroll", "--shot", "opening"],
      );
      const transportOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        receipt: {
          compileFingerprint: string;
          requestId: string;
          attemptId: string;
          output: { digest: string };
          adapterIdentity: string;
          generatorProvenance: unknown;
          parameters: unknown;
          references: Array<{ path: string; role: string }>;
        } | null;
        diagnostics: Array<{ code: string; message: string }>;
      }>("The generated transport recovery", transportRecovery);
      if (
        transportOutput.requestId === null ||
        transportOutput.receipt === null
      )
        throw new Error(
          `The retryable transport attempt did not recover automatically: status=${String(transportRecovery.status)} stdout=${JSON.stringify(transportRecovery.stdout)} stderr=${JSON.stringify(transportRecovery.stderr)}.`,
        );
      const transportAttempts = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).repaintRequestAttempts(transportOutput.requestId);
      fs.writeFileSync(adapterMode, "success\n", "utf8");
      const rerolled = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "reroll",
        "--shot",
        "opening",
      ]);
      const rerolledOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        receipt: {
          compileFingerprint: string;
          requestId: string;
          attemptId: string;
          output: { digest: string };
        } | null;
      }>("The generated fresh reroll", rerolled);
      if (rerolledOutput.receipt === null)
        throw new Error("The explicit reroll produced no repaint candidate.");
      const candidateProject = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      );
      const candidates = candidateProject.verifiedRepaintCandidates([
        "opening",
      ]);
      const candidateRenditions = candidateProject.verifiedRepaintRenditions([
        "opening",
      ]);
      const rerolledReviewSource = withGeneratedRepaintSelectionReview(
        rerolledOutput.receipt,
      );
      fs.writeFileSync(selectionReviewsPath, rerolledReviewSource, "utf8");
      const reviewedCompile = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.openReadOnly(
          fixture.root,
          "repaint-runtime-film",
        ),
      ).lint({ scope: "source" });
      const selected = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "select",
        "--shot",
        "opening",
        "--attempt",
        rerolledOutput.receipt.attemptId,
      ]);
      const selectedOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
      }>("The generated candidate selection", selected);
      const selectedRenditions = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).verifiedRepaintRenditions(["opening"]);
      const transportReviewSource = withGeneratedRepaintSelectionReview(
        transportOutput.receipt,
      );
      // The authored request cites this settings anchor for both its prompt and
      // its settings evidence, and moving either one is enough to make the
      // adoption stale, so this negative deliberately changes the first.
      const changedEvidence = rewriteFirst(
        "The generated repaint adoption negative's evidence slot",
        configuredSource,
        "docs/settings/050-art-direction.md#art-delivery-review-condition",
        "docs/settings/050-art-direction.md#art-palette",
      );
      fs.writeFileSync(selectionReviewsPath, transportReviewSource, "utf8");
      fs.writeFileSync(configuredPath, changedEvidence, "utf8");
      const staleSelection = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        [
          "select",
          "--shot",
          "opening",
          "--attempt",
          transportOutput.receipt.attemptId,
        ],
      );
      fs.writeFileSync(configuredPath, configuredSource, "utf8");
      const staleSelectionOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        diagnostics: Array<{ code: string }>;
      }>("The generated stale-review selection", staleSelection);
      const preservedSelection = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).verifiedRepaintRenditions(["opening"]);
      const reversed = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "reverse",
        "--shot",
        "opening",
        "--attempt",
        transportOutput.receipt.attemptId,
      ]);
      const reversedOutput = readGeneratedJson<{
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
      }>("The generated repaint reversal", reversed);
      const reversedRenditions = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).verifiedRepaintRenditions(["opening"]);
      TestValidator.equals(
        "automatic retry, reroll, selection refusal, and reversal preserve reviewed candidate state",
        {
          nonretryableRetryStatus: nonretryableRetry.status,
          nonretryableRetryRepainted: nonretryableRetryOutput.repainted,
          nonretryableRetrySelected: nonretryableRetryOutput.selected,
          nonretryableRetryRequestId: nonretryableRetryOutput.requestId,
          nonretryableRetryCode: nonretryableRetryOutput.diagnostics[0]?.code,
          transportStatus: transportRecovery.status,
          transportRepainted: transportOutput.repainted,
          transportSelected: transportOutput.selected,
          transportRequestId: transportOutput.requestId,
          transportDiagnostics: transportOutput.diagnostics.length,
          transportAttempts: transportAttempts.map((attempt) => ({
            requestId: attempt.requestId,
            retryable: attempt.failure?.retryable ?? null,
            status: attempt.status,
          })),
          transportReceiptRequestId: transportOutput.receipt.requestId,
          transportAdapterIdentity: JSON.parse(
            transportOutput.receipt.adapterIdentity,
          ) as unknown,
          transportProvenance: transportOutput.receipt.generatorProvenance,
          transportParameters: transportOutput.receipt.parameters,
          transportReferences: transportOutput.receipt.references.map(
            ({ path: referencePath, role }) => ({ path: referencePath, role }),
          ),
          rerollStatus: rerolled.status,
          rerollRepainted: rerolledOutput.repainted,
          rerollSelected: rerolledOutput.selected,
          distinctRerollRequest:
            rerolledOutput.requestId !== transportOutput.requestId,
          candidates: candidates
            .map((receipt) => receipt.attemptId)
            .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
          candidateRenditions: candidateRenditions.length,
          reviewedCompileSuccess: reviewedCompile.success,
          reviewedCompileCurrent:
            reviewedCompile.compiler.inputFingerprint ===
            rerolledOutput.receipt.compileFingerprint,
          selectStatus: selected.status,
          selectRepainted: selectedOutput.repainted,
          selectSelected: selectedOutput.selected,
          selectedAttempt: selectedRenditions[0]?.attemptId,
          staleStatus: staleSelection.status,
          staleRepainted: staleSelectionOutput.repainted,
          staleSelected: staleSelectionOutput.selected,
          staleRequestId: staleSelectionOutput.requestId,
          staleCode: staleSelectionOutput.diagnostics[0]?.code,
          preservedAttempt: preservedSelection[0]?.attemptId,
          reverseStatus: reversed.status,
          reverseRepainted: reversedOutput.repainted,
          reverseSelected: reversedOutput.selected,
          reversedAttempt: reversedRenditions[0]?.attemptId,
        },
        {
          nonretryableRetryStatus: 1,
          nonretryableRetryRepainted: false,
          nonretryableRetrySelected: false,
          nonretryableRetryRequestId: defaultAdapterOutput.requestId,
          nonretryableRetryCode: "repaint-input-invalid",
          transportStatus: 0,
          transportRepainted: true,
          transportSelected: false,
          transportRequestId: transportOutput.requestId,
          transportDiagnostics: 0,
          transportAttempts: [
            {
              requestId: transportOutput.requestId,
              retryable: true,
              status: "failed",
            },
            {
              requestId: transportOutput.requestId,
              retryable: null,
              status: "succeeded",
            },
          ],
          transportReceiptRequestId: transportOutput.requestId,
          transportAdapterIdentity: REPAINT_RUNTIME_IDENTITY,
          transportProvenance: REPAINT_PROVENANCE,
          transportParameters: {
            prompt: "Preserve every deterministic structure.",
            negativePrompt: "Do not alter camera, timing, or motion.",
            seed: 2135,
            strength: 0.25,
            controls: { contract: true },
          },
          transportReferences: [
            { path: repaint.referencePath, role: "structure" },
          ],
          rerollStatus: 0,
          rerollRepainted: true,
          rerollSelected: false,
          distinctRerollRequest: true,
          candidates: [
            transportOutput.receipt.attemptId,
            rerolledOutput.receipt.attemptId,
          ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
          candidateRenditions: 0,
          reviewedCompileSuccess: true,
          reviewedCompileCurrent: true,
          selectStatus: 0,
          selectRepainted: true,
          selectSelected: true,
          selectedAttempt: rerolledOutput.receipt.attemptId,
          staleStatus: 1,
          staleRepainted: false,
          staleSelected: false,
          staleRequestId: transportOutput.receipt.requestId,
          staleCode: "repaint-commit-refused",
          preservedAttempt: rerolledOutput.receipt.attemptId,
          reverseStatus: 0,
          reverseRepainted: true,
          reverseSelected: true,
          reversedAttempt: transportOutput.receipt.attemptId,
        },
      );
      assertGeneratedRuntimeParity(rendered);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      // Printed on a passing run as well as a failing one: this is the most
      // expensive scenario in the suite and the number is why anyone would
      // work on it next.
      reportGeneratedChildCost();
      if (fixture.preserve === false)
        preserveCliHarnessCleanup(failure, [
          {
            resource: "repaint runtime fixture root",
            cleanup: () =>
              fs.rmSync(fixture.root, { force: true, recursive: true }),
          },
          {
            resource: "generated command transpile cache",
            cleanup: () =>
              fs.rmSync(GENERATED_CACHE, { force: true, recursive: true }),
          },
        ]);
    }
  };
