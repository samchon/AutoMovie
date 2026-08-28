import type {
  IAutoMovieAssetManifest,
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  digestAutoMovieBytes,
  productionRenderBundleRelativePath,
} from "@automovie/production";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { renderCompletedFilmFixture } from "../internal/completedFilmFixture";
import { testRendererIdentity } from "../production/productionFixtures";
import {
  productionH264Mp4,
  productionPng,
} from "../production/productionMediaFixtures";
import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";

interface IGeneratedCommand {
  status: number | null;
  stderr: string;
  stdout: string;
}

const AUTHORED_CLAIM_NAMES = [
  "settings H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "models files account for inherited settings, designs, and parent files",
  "models H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "motions files account for inherited settings, designs, and parent files",
  "motions H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "treatments files account for inherited settings, designs, and parent files",
  "treatments H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "scripts files account for inherited settings, designs, and parent files",
  "scripts H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "scripts H3 units answer their principle checklists and account for inherited work",
  "scripts H4 units answer their principle checklists and account for inherited work",
  "screenplays files account for inherited settings, designs, and parent files",
  "screenplays H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "screenplays H3 units answer their principle checklists and account for inherited work",
  "screenplays H4 units answer their principle checklists and account for inherited work",
] as const;

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

const installAuthoredEvidencePopulation = (
  rendered: Record<string, string>,
): void => {
  rendered["docs/contracts/index.md"] = [
    "<!--",
    "@evidenceExclude discovery/core/common.md#shared-local-boundary This focused runtime regression does not claim a completed work-specific discovery audit.",
    "-->",
    "",
    "# Focused generated-runtime evidence boundary",
    "",
  ].join("\n");
  rendered["lint.config.ts"] = [
    'import { createAutoMovieEvidenceConfig, evidence } from "@automovie/evidence";',
    'import type { ITtscEvidenceGraphClaim } from "@ttsc/evidence";',
    'import type { ITtscLintConfig } from "@ttsc/lint";',
    'import path from "node:path";',
    "",
    `const names = ${JSON.stringify(AUTHORED_CLAIM_NAMES, null, 2)} as const;`,
    "/**",
    " * Exercise the repository-only completed film's actual authored Markdown.",
    " * This is the same focused historical-fixture boundary as #2130: that",
    " * fixture predates current source-population topology, so source claims",
    " * stay deliberately outside this regression. The public scaffold graph is",
    " * neither copied nor weakened; the linked docs are the generated project's",
    " * one physical docs population and the current reusable graph owns claims.",
    " */",
    'const location = path.join(import.meta.dirname, ".automovie/runtime-evidence");',
    "const full = createAutoMovieEvidenceConfig({",
    "  location,",
    '  kind: "film",',
    '  populationScope: { mode: "complete-production" },',
    '  settings: "review",',
    '  research: "disabled",',
    '  maps: "disabled",',
    '  models: "review",',
    '  spaces: "disabled",',
    '  materials: "disabled",',
    '  instances: "disabled",',
    '  motions: "review",',
    '  systems: "disabled",',
    '  treatments: "review",',
    '  scripts: "review",',
    '  screenplays: "review",',
    '  briefs: "disabled",',
    '  mapSources: "disabled",',
    '  modelSources: "disabled",',
    '  spaceSources: "disabled",',
    '  materialSources: "disabled",',
    '  instanceSources: "disabled",',
    '  motionSources: "disabled",',
    '  systemSources: "disabled",',
    '  shots: "disabled",',
    '  productionSources: "disabled",',
    '  filmSources: "disabled",',
    "  claims: [],",
    "});",
    "const claims: ITtscEvidenceGraphClaim[] = names.map((name) => {",
    "  const matches = full.claims.filter((claim) => claim.name === name);",
    "  if (matches.length !== 1)",
    '    throw new Error("Expected one current authored claim named " + name + "; received " + matches.length + ".");',
    "  return matches[0]!;",
    "});",
    "for (const claim of claims) {",
    '  if ("root" in claim)',
    '    claim.root = path.resolve(location, claim.root ?? ".");',
    "  const references = Array.isArray(claim.reference)",
    "    ? claim.reference",
    "    : [claim.reference];",
    "  for (const reference of references)",
    '    if ("root" in reference && typeof reference.root === "string")',
    "      reference.root = path.resolve(location, reference.root);",
    "}",
    "const graph = { claims };",
    "",
    "export default {",
    "  plugins: { evidence },",
    '  rules: { "evidence/graph": ["error", graph] },',
    "} satisfies ITtscLintConfig;",
    "",
  ].join("\n");
};

const linkWorkspacePackage = (project: string, name: string): void => {
  const manifest = createRequire(__filename)
    .resolve.paths(name)
    ?.map((base) => path.join(base, ...name.split("/"), "package.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (manifest === undefined)
    throw new Error(`Fixture package root did not resolve: ${name}.`);
  const packageRoot = path.dirname(manifest);
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    packageRoot,
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const runGenerated = (
  project: string,
  script: string,
  args: readonly string[] = [],
  plugins = false,
): IGeneratedCommand => {
  const environment = { ...process.env };
  if (environment.AUTOMOVIE_ISSUE_2135_COVERAGE !== "1")
    delete environment.NODE_OPTIONS;
  delete environment.TTSX_RUNTIME_MANIFEST;
  const result = spawnSync(
    process.execPath,
    [
      path.join(
        path.dirname(createRequire(__filename).resolve("ttsc/package.json")),
        "lib/launcher/ttsx.js",
      ),
      "--cache-dir",
      path.join(
        REPOSITORY_ROOT,
        `node_modules/.cache/issue-2135-ttsc-${process.pid}`,
      ),
      ...(plugins ? [] : ["--no-plugins"]),
      "-P",
      path.join(project, "tsconfig.json"),
      path.join(project, script),
      ...args,
    ],
    {
      cwd: project,
      encoding: "utf8",
      env: environment,
      timeout: plugins ? 600_000 : 180_000,
    },
  );
  if (result.error !== undefined) throw result.error;
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
};

const runGeneratedFast = (
  project: string,
  script: string,
  args: readonly string[] = [],
): IGeneratedCommand => runGenerated(project, script, args);

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
  const cache = path.join(
    REPOSITORY_ROOT,
    "packages/template/.cache/automovie-scaffold-evidence-gate",
  );
  const entrypoints = [
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
    "scripts/renderSoundRuntime.ts",
    "scripts/renderPlanningRuntime.ts",
    "scripts/renderPublicationRuntime.ts",
    "scripts/renderGcRuntime.ts",
    "scripts/repaint.ts",
    "scripts/repaintCancellationRuntime.ts",
    "scripts/repaintCommand.ts",
    "scripts/repaintAdapter.ts",
    "scripts/withKokoroRuntimeOverrides.cjs",
    "vite.config.ts",
  ];
  TestValidator.equals(
    "every generated runtime owner preserves scaffold, consumer, and gate-cache bytes",
    entrypoints.map((relative) => ({
      relative,
      cache: fs.readFileSync(path.join(cache, relative), "utf8"),
      rendered: rendered[relative],
      source: fs.readFileSync(path.join(scaffold, relative), "utf8"),
    })),
    entrypoints.map((relative) => {
      const source = fs.readFileSync(path.join(scaffold, relative), "utf8");
      return { relative, cache: source, rendered: source, source };
    }),
  );
};

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

const configureGeneratedRepaint = async (
  root: string,
): Promise<{ adapterBytes: Uint8Array; referencePath: string }> => {
  const configPath = path.join(root, "automovie.config.ts");
  const configSource = fs.readFileSync(configPath, "utf8");
  const repaintSlot = "    repaint: null,";
  if (configSource.split(repaintSlot).length !== 2)
    throw new Error("Generated repaint config no longer has one null slot.");
  const referencePath = "assets/generated-repaint-reference.png";
  fs.writeFileSync(
    configPath,
    configSource.replace(
      repaintSlot,
      `    repaint: ${JSON.stringify(
        {
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
                design:
                  "docs/models/010-soloist.md#soloist-blocking-representation",
                screenplayOrBrief:
                  "docs/screenplays/001-cue/001-cue.md#scn-001",
                shot: "src/shots/opening.ts#opening",
              },
              selectionReview: null,
            },
          ],
        },
        null,
        2,
      ).replaceAll("\n", "\n    ")},`,
    ),
    "utf8",
  );
  const productionPath = path.join(root, "src/production.ts");
  const productionSource = fs.readFileSync(productionPath, "utf8");
  for (const from of [
    ['visualDelivery: "deterministic"', 'visualDelivery: "repainted"'],
    ["width: 1280", "width: 16"],
    ["height: 720", "height: 16"],
  ].map(([from]) => from))
    if (productionSource.split(from).length !== 2)
      throw new Error(
        `Generated repaint production has no exact ${from} slot.`,
      );
  fs.writeFileSync(
    productionPath,
    productionSource
      .replace('visualDelivery: "deterministic"', 'visualDelivery: "repainted"')
      .replace("width: 1280", "width: 16")
      .replace("height: 720", "height: 16"),
    "utf8",
  );
  const referenceBytes = productionPng(16, 16);
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
    original: {
      url: "local://generated-repaint-reference",
      digest: digestAutoMovieBytes(referenceBytes),
    },
    license: {
      identifier: "test-only",
      url: "local://generated-fixture-license",
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
    targetFingerprint: digestAutoMovieBytes(
      Buffer.from("generated-repaint-opening-target"),
    ),
    renderSpec: {
      target: "opening",
      frameFormat: production.frameFormat,
      toneMapping: "none",
      codec: "h264",
      pixelFormat: "yuv420p",
      crf: 24,
    },
    frames,
  };
  project.commitRenderBundle(
    productionRenderBundleRelativePath(sourceManifest),
    new Map(frames.map((frame) => [frame.path, frameBytes])),
    sourceManifest,
  );
  return {
    adapterBytes: await productionH264Mp4({
      width: production.frameFormat.width,
      height: production.frameFormat.height,
      fps: production.frameFormat.fps,
      frameCount,
    }),
    referencePath,
  };
};

const withGeneratedRepaintSelectionReview = (
  source: string,
  candidate: { attemptId: string; output: { digest: string } },
): string => {
  const slot = '"selectionReview": null';
  if (source.split(slot).length !== 2)
    throw new Error(
      "The generated repaint config no longer has one unbound selection-review slot.",
    );
  return source.replace(
    slot,
    `"selectionReview": ${JSON.stringify({
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
    })}`,
  );
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
 * 4. Dry and applied garbage collection publish explicit results and clean up
 *    their acquired runtime resources.
 * 5. The actual generated repaint entrypoint refuses invalid operations and a
 *    source-preflight failure before any request identity exists.
 * 6. A default-adapter terminal attempt returns its durable request id; retry
 *    keeps it and creates a candidate without changing the active rendition.
 * 7. A fresh reroll creates a second unselected candidate, explicit selection
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
      installAuthoredEvidencePopulation(rendered);
      const film = rendered["src/film.ts"]!;
      const captionPopulation =
        /[ ]{8}captions: \[\n(?:.|\n)*?[ ]{8}\],\n[ ]{8}effects: \[\],/u;
      if ([...film.matchAll(new RegExp(captionPopulation, "gu"))].length !== 1)
        throw new Error(
          "The generated-runtime fixture must expose one caption population for the no-synthesis render twin.",
        );
      rendered["src/film.ts"] = film.replace(
        captionPopulation,
        "        captions: [],\n        effects: [],",
      );
      writeFiles(fixture.root, rendered);
      const evidenceRoot = path.join(
        fixture.root,
        ".automovie/runtime-evidence",
      );
      fs.mkdirSync(evidenceRoot, { recursive: true });
      const actualDocuments = path.resolve(fixture.root, "docs");
      const linkedDocuments = path.join(evidenceRoot, "docs");
      const relativeDocuments = path.relative(fixture.root, actualDocuments);
      if (
        relativeDocuments.startsWith("..") ||
        path.isAbsolute(relativeDocuments)
      )
        throw new Error(
          "The focused evidence link must resolve to this generated project's actual docs directory.",
        );
      fs.symlinkSync(
        actualDocuments,
        linkedDocuments,
        process.platform === "win32" ? "junction" : "dir",
      );
      TestValidator.equals(
        "the focused graph link resolves to the generated project's actual docs",
        path.normalize(fs.realpathSync(linkedDocuments)),
        path.normalize(fs.realpathSync(actualDocuments)),
      );
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
        "vite",
      ])
        linkWorkspacePackage(fixture.root, name);

      const evidenceDelivery = path.join(
        fixture.root,
        "docs/settings/000-governing-aim.md",
      );
      const evidenceSource = fs.readFileSync(evidenceDelivery, "utf8");
      const evidenceNegative = evidenceSource.replace(
        /^@evidence principles\/core\/common\.md#machine-default .+\n@evidenceReview principles\/core\/common\.md#machine-default .+\n/mu,
        "",
      );
      if (evidenceNegative === evidenceSource)
        throw new Error(
          "The generated-runtime evidence negative must remove one authored principle citation pair.",
        );
      fs.writeFileSync(evidenceDelivery, evidenceNegative, "utf8");
      const rejectedEvidence = runGenerated(
        fixture.root,
        "scripts/compile.ts",
        [],
        true,
      );
      fs.writeFileSync(evidenceDelivery, evidenceSource, "utf8");
      const acceptedEvidence = runGenerated(
        fixture.root,
        "scripts/compile.ts",
        [],
        true,
      );
      const rejectedEvidenceOutput =
        `${rejectedEvidence.stdout}\n${rejectedEvidence.stderr}`
          .replaceAll("\r\n", "\n")
          .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");
      TestValidator.equals(
        "normal generated commands keep the completed fixture's real evidence guard active",
        {
          acceptedCommandSuccess:
            acceptedEvidence.status === 0 &&
            acceptedEvidence.stderr.includes("[evidence/graph]") === false,
          negativeFailed: rejectedEvidence.status !== 0,
          negativeNamedTarget: rejectedEvidenceOutput.includes(
            "principles/core/common.md#machine-default",
          ),
          negativeSingleDiagnostic:
            [...rejectedEvidenceOutput.matchAll(/\[evidence\/graph\]/gu)]
              .length === 1,
        },
        {
          acceptedCommandSuccess: true,
          negativeFailed: true,
          negativeNamedTarget: true,
          negativeSingleDiagnostic: true,
        },
      );

      const invalid = runGeneratedFast(fixture.root, "scripts/render.ts", [
        "unknown",
      ]);
      const compiled = runGeneratedFast(fixture.root, "scripts/compile.ts");
      const status = runGeneratedFast(fixture.root, "scripts/render.ts", [
        "status",
      ]);
      const verified = runGeneratedFast(fixture.root, "scripts/render.ts", [
        "verify",
      ]);
      const finalized = runGeneratedFast(fixture.root, "scripts/render.ts", [
        "finalize",
      ]);
      const dryGc = runGeneratedFast(fixture.root, "scripts/render.ts", ["gc"]);
      const appliedGc = runGeneratedFast(fixture.root, "scripts/render.ts", [
        "gc",
        "--apply",
      ]);
      if (compiled.status !== 0)
        throw new Error(
          `Generated no-plugin compile failed: ${compiled.stdout}\n${compiled.stderr}`,
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
              "generated/repaint-runtime-film/compile.json",
            ),
          ),
          statusRefusal: status.status !== 0,
          verifyRefusal: verified.status !== 0,
          finalizeRefusal: finalized.status !== 0,
          dryGcStatus: dryGc.status === 0,
          appliedGcStatus: appliedGc.status === 0,
          dryGcPublication: dryGc.stdout.includes('"applied": false'),
          appliedGcPublication: appliedGc.stdout.includes('"applied": true'),
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
      const configuredPath = path.join(fixture.root, "automovie.config.ts");
      const configuredSource = fs.readFileSync(configuredPath, "utf8");
      const missingReferenceSource = configuredSource.replace(
        repaint.referencePath,
        "assets/generated-repaint-reference-missing.png",
      );
      if (missingReferenceSource === configuredSource)
        throw new Error(
          "The generated repaint preflight negative has no reference slot.",
        );
      fs.writeFileSync(configuredPath, missingReferenceSource, "utf8");
      const preflightRefusal = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        ["reroll", "--shot", "opening"],
      );
      fs.writeFileSync(configuredPath, configuredSource, "utf8");
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
      const preflightOutput = JSON.parse(preflightRefusal.stdout) as {
        repainted: boolean;
        requestId: string | null;
        diagnostics: Array<{ code: string; message: string }>;
      };
      const defaultAdapterOutput = JSON.parse(defaultAdapterRefusal.stdout) as {
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        diagnostics: Array<{ code: string; message: string }>;
      };
      if (defaultAdapterOutput.requestId === null)
        throw new Error(
          "The terminal default-adapter attempt emitted no resumable request id.",
        );
      const terminalAttempts = repaintProject.repaintRequestAttempts(
        defaultAdapterOutput.requestId,
      );
      TestValidator.equals(
        "the actual generated repaint CLI separates preflight refusal from a durable terminal attempt",
        {
          confinedStatus: confinedRepaint.status !== 0,
          confinedDiagnostic: confinedRepaint.stderr.includes(
            "repaint requires exactly one operation",
          ),
          preflightStatus: preflightRefusal.status,
          preflightRepainted: preflightOutput.repainted,
          preflightRequestId: preflightOutput.requestId,
          defaultStatus: defaultAdapterRefusal.status,
          defaultRepainted: defaultAdapterOutput.repainted,
          defaultSelected: defaultAdapterOutput.selected,
          defaultRequestId: defaultAdapterOutput.requestId,
          defaultCode: defaultAdapterOutput.diagnostics[0]?.code,
          namesDefaultAdapter:
            defaultAdapterOutput.diagnostics[0]?.message.includes(
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
          preflightStatus: 1,
          preflightRepainted: false,
          preflightRequestId: null,
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
      const adapterMedia = path.join(fixture.root, "repaint-success.mp4");
      fs.writeFileSync(adapterMedia, repaint.adapterBytes);
      fs.writeFileSync(
        path.join(fixture.root, "scripts/repaintAdapter.ts"),
        [
          'import type { AutoMovieProductionShotRepaint } from "@automovie/interface";',
          'import fs from "node:fs";',
          'import path from "node:path";',
          "",
          "export const repaintProductionShot: AutoMovieProductionShotRepaint = async (input) => ({",
          '  bytes: fs.readFileSync(path.join(input.projectRoot, "repaint-success.mp4")),',
          '  mediaType: "video/mp4",',
          "  costUnits: 1,",
          `  runtimeIdentity: ${JSON.stringify(REPAINT_RUNTIME_IDENTITY)},`,
          "});",
          "",
        ].join("\n"),
        "utf8",
      );
      const retried = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "retry",
        "--shot",
        "opening",
        "--request",
        defaultAdapterOutput.requestId,
      ]);
      const retriedOutput = JSON.parse(retried.stdout) as {
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        receipt: {
          requestId: string;
          attemptId: string;
          output: { digest: string };
          adapterIdentity: string;
          generatorProvenance: unknown;
          parameters: unknown;
          references: Array<{ path: string; role: string }>;
        } | null;
      };
      if (retriedOutput.receipt === null)
        throw new Error("The explicit retry produced no repaint candidate.");
      const rerolled = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "reroll",
        "--shot",
        "opening",
      ]);
      const rerolledOutput = JSON.parse(rerolled.stdout) as {
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        receipt: {
          requestId: string;
          attemptId: string;
          output: { digest: string };
        } | null;
      };
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
        configuredSource,
        rerolledOutput.receipt,
      );
      fs.writeFileSync(configuredPath, rerolledReviewSource, "utf8");
      const selected = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "select",
        "--shot",
        "opening",
        "--attempt",
        rerolledOutput.receipt.attemptId,
      ]);
      const selectedOutput = JSON.parse(selected.stdout) as {
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
      };
      const selectedRenditions = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).verifiedRepaintRenditions(["opening"]);
      const retriedReviewSource = withGeneratedRepaintSelectionReview(
        configuredSource,
        retriedOutput.receipt,
      );
      const changedEvidence = retriedReviewSource.replace(
        "docs/settings/050-art-direction.md#art-delivery-review-condition",
        "docs/settings/050-art-direction.md#art-palette",
      );
      if (changedEvidence === retriedReviewSource)
        throw new Error(
          "The generated repaint adoption negative has no evidence slot.",
        );
      fs.writeFileSync(configuredPath, changedEvidence, "utf8");
      const staleSelection = runGeneratedFast(
        fixture.root,
        "scripts/repaint.ts",
        [
          "select",
          "--shot",
          "opening",
          "--attempt",
          retriedOutput.receipt.attemptId,
        ],
      );
      fs.writeFileSync(configuredPath, retriedReviewSource, "utf8");
      const staleSelectionOutput = JSON.parse(staleSelection.stdout) as {
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
        diagnostics: Array<{ code: string }>;
      };
      const preservedSelection = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).verifiedRepaintRenditions(["opening"]);
      const reversed = runGeneratedFast(fixture.root, "scripts/repaint.ts", [
        "reverse",
        "--shot",
        "opening",
        "--attempt",
        retriedOutput.receipt.attemptId,
      ]);
      const reversedOutput = JSON.parse(reversed.stdout) as {
        repainted: boolean;
        selected: boolean;
        requestId: string | null;
      };
      const reversedRenditions = AutoMovieProductionProject.open(
        fixture.root,
        "repaint-runtime-film",
      ).verifiedRepaintRenditions(["opening"]);
      TestValidator.equals(
        "explicit retry, reroll, selection refusal, and reversal preserve reviewed candidate state",
        {
          retryStatus: retried.status,
          retryRepainted: retriedOutput.repainted,
          retrySelected: retriedOutput.selected,
          retryRequestId: retriedOutput.requestId,
          retryReceiptRequestId: retriedOutput.receipt.requestId,
          retryAdapterIdentity: retriedOutput.receipt.adapterIdentity,
          retryProvenance: retriedOutput.receipt.generatorProvenance,
          retryParameters: retriedOutput.receipt.parameters,
          retryReferences: retriedOutput.receipt.references.map(
            ({ path: referencePath, role }) => ({ path: referencePath, role }),
          ),
          rerollStatus: rerolled.status,
          rerollRepainted: rerolledOutput.repainted,
          rerollSelected: rerolledOutput.selected,
          distinctRerollRequest:
            rerolledOutput.requestId !== retriedOutput.requestId,
          candidates: candidates
            .map((receipt) => receipt.attemptId)
            .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
          candidateRenditions: candidateRenditions.length,
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
          retryStatus: 0,
          retryRepainted: true,
          retrySelected: false,
          retryRequestId: defaultAdapterOutput.requestId,
          retryReceiptRequestId: defaultAdapterOutput.requestId,
          retryAdapterIdentity: JSON.stringify(REPAINT_RUNTIME_IDENTITY),
          retryProvenance: REPAINT_PROVENANCE,
          retryParameters: {
            prompt: "Preserve every deterministic structure.",
            negativePrompt: "Do not alter camera, timing, or motion.",
            seed: 2135,
            strength: 0.25,
            controls: { contract: true },
          },
          retryReferences: [{ path: repaint.referencePath, role: "structure" }],
          rerollStatus: 0,
          rerollRepainted: true,
          rerollSelected: false,
          distinctRerollRequest: true,
          candidates: [
            retriedOutput.receipt.attemptId,
            rerolledOutput.receipt.attemptId,
          ].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
          candidateRenditions: 0,
          selectStatus: 0,
          selectRepainted: true,
          selectSelected: true,
          selectedAttempt: rerolledOutput.receipt.attemptId,
          staleStatus: 1,
          staleRepainted: false,
          staleSelected: false,
          staleRequestId: retriedOutput.receipt.requestId,
          staleCode: "repaint-commit-refused",
          preservedAttempt: rerolledOutput.receipt.attemptId,
          reverseStatus: 0,
          reverseRepainted: true,
          reverseSelected: true,
          reversedAttempt: retriedOutput.receipt.attemptId,
        },
      );
      assertGeneratedRuntimeParity(rendered);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      if (fixture.preserve === false)
        preserveCliHarnessCleanup(failure, [
          {
            resource: "repaint runtime fixture root",
            cleanup: () =>
              fs.rmSync(fixture.root, { force: true, recursive: true }),
          },
        ]);
    }
  };
