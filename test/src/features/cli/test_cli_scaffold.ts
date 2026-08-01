import {
  AUTOMOVIE_TEMPLATE_VERSIONS,
  renderScaffold,
  renderTemplate,
  scaffoldAssetDirectory,
  writeFiles,
} from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";

/** True when `fn` throws. */
const throws = (fn: () => unknown): boolean => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

/** True when `fn` throws an Error containing `message`. */
const throwsWith = (fn: () => unknown, message: string): boolean => {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

interface GeneratedViewerResponse {
  body: string;
  statusCode: number;
  end: (body?: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

type GeneratedViewerMiddleware = (
  request: { url?: string },
  response: GeneratedViewerResponse,
  next: () => void,
) => void;

/**
 * The `@automovie/cli` scaffolder renders the starter into an in-memory file
 * map and writes it out: the render/write split learned from the reference
 * scaffolder, so the map can be asserted without disk I/O.
 *
 * Scenarios:
 *
 * 1. `renderScaffold` yields the starter's file set with POSIX keys, and the
 *    shipped-safe `gitignore`/`npmrc` assets regain their leading dots.
 * 2. Substitution is complete: `{{name}}` becomes the project name, the
 *    `{{version:*}}` tokens become the catalog-synced versions, no `{{` token
 *    survives, and no payload carries a CRLF.
 * 3. `renderTemplate` throws on an unknown `{{token}}` (a mistyped placeholder is
 *    a loud failure, not a silently broken scaffold), and `renderScaffold`
 *    throws on a blank name.
 * 4. `writeFiles` materializes the map to disk (every rendered key becomes a
 *    file), refuses a non-empty target unless `force`, and refuses a map key
 *    that would escape the target directory.
 * 5. The scaffold assets are inside the package's published `files`, or a
 *    published `@automovie/cli` would ship no scaffold and `npx automovie
 *    start` would throw on install (#1155). Guards the packaging, which the
 *    in-repo render (workspace source) cannot.
 * 6. The pinned Kokoro/Transformers graph installs and fingerprints its Node CPU
 *    backend without an unused CUDA download, while the local MIT Sharp wall
 *    fails image calls explicitly instead of loading a native LGPL payload.
 * 7. The generated viewer middleware binds one compiled artifact descriptor to the
 *    physical file identity it checked instead of serving a replacement.
 * 8. The registered asset route applies the same binding to ownership, closure,
 *    and final asset bytes, rejecting a byte-identical successor inode.
 */
export const test_cli_scaffold = (): void => {
  // 5. packaging guard: the scaffold dir must be a published `files` entry.
  const scaffoldDir = scaffoldAssetDirectory();
  const cliPackage = JSON.parse(
    fs.readFileSync(
      path.join(path.dirname(scaffoldDir), "package.json"),
      "utf8",
    ),
  ) as { files?: string[] };
  TestValidator.predicate(
    "the scaffold directory is a published files entry",
    Array.isArray(cliPackage.files) &&
      cliPackage.files.includes(path.basename(scaffoldDir)),
  );
  TestValidator.predicate(
    "no stale 'templates' entry lingers in files",
    Array.isArray(cliPackage.files) && !cliPackage.files.includes("templates"),
  );

  const files = renderScaffold({ name: "demo-film" });
  const renderScript = files["scripts/render.ts"]!;
  const renderProgressOffset = renderScript.indexOf("const renderProgress");
  const renderProgressSource =
    renderProgressOffset < 0
      ? ""
      : renderScript.slice(
          renderProgressOffset,
          renderScript.indexOf("\ntry {", renderProgressOffset),
        );
  const renderProgressStages = [
    "finalize.start",
    "finalize.status.complete",
    "sound.start",
    "sound.plan.complete",
    "sound.synthesis.start",
    "sound.synthesis.complete",
    "sound.model.load.start",
    "sound.model.load.complete",
    "sound.dialogue.start",
    "sound.dialogue.complete",
    "sound.render.start",
    "sound.render.complete",
    "sound.evidence.render.start",
    "sound.evidence.render.complete",
    "sound.opus.encode.start",
    "sound.opus.encode.complete",
    "sound.evidence.encode.start",
    "sound.evidence.encode.complete",
    "sound.complete",
    "video.feature.encode.start",
    "video.feature.encode.complete",
    "video.feature.mux.start",
    "video.feature.mux.complete",
    "video.guide.encode.start",
    "video.guide.encode.complete",
    "publication.proxy.start",
    "publication.proxy.complete",
    "publication.final.start",
    "publication.final.complete",
    "finalize.complete",
  ] as const;

  // 1. the file set, POSIX keys, hidden names restored, IN GUARANTEED ORDER.
  // No re-sort: the order is the guarantee. `listFiles` sorts each directory's
  // entries by code unit and recurses in place, so the emitted order is a DFS
  // pre-order over the ON-DISK names, with `gitignore` renamed to `.gitignore`
  // on the key afterwards. Hence `.automovie/**` leads, while `.gitignore`
  // sits where the shipped `gitignore` asset sorts rather than at its rendered
  // position; `npmrc` behaves likewise. Re-sorting the keys here made the
  // assertion hold for ANY order the scaffolder produced, so the cross-host
  // guarantee `listFiles` exists to provide had no test at all.
  TestValidator.equals(
    "the starter renders its expected file set, in its guaranteed order",
    Object.keys(files),
    [
      ".automovie/assets.json",
      ".automovie/design/acceptance/answer-beauty.json",
      ".automovie/design/acceptance/answer-pose.json",
      ".automovie/design/acceptance/opening-beauty.json",
      ".automovie/design/acceptance/opening-effect-mask.json",
      ".automovie/design/acceptance/opening-pose.json",
      ".automovie/design/formations/army.json",
      ".automovie/design/models/army-far.json",
      ".automovie/design/models/army-hero.json",
      ".automovie/design/models/army-near.json",
      ".automovie/design/models/sentinel.json",
      ".automovie/design/production.json",
      ".automovie/design/screenplay/index.json",
      ".automovie/design/shots/answer.json",
      ".automovie/design/shots/opening.json",
      ".automovie/design/world.json",
      ".automovie/manifest.json",
      ".automovie/reviews/README.md",
      ".claude/hooks/guard-automovie-owned.mjs",
      ".claude/settings.json",
      ".mcp.json",
      "AGENTS.md",
      "CLAUDE.md",
      "README.md",
      "automovie.config.ts",
      "docs/art-direction.md",
      "docs/historical-notes.md",
      "docs/demo-film/screenplay.md",
      "docs/demo-film/treatment.md",
      ".gitignore",
      "lint.config.ts",
      ".npmrc",
      "package.json",
      "public/assets/README.md",
      "public/audio/README.md",
      "public/audio/starter-tone.json",
      "renders/README.md",
      "scripts/capture-browser.ts",
      "scripts/capture-doctor.ts",
      "scripts/capture-install.ts",
      "scripts/capture.ts",
      "scripts/compile.ts",
      "scripts/generatedShotPlugin.ts",
      "scripts/lint.ts",
      "scripts/mcp.ts",
      "scripts/preview.ts",
      "scripts/render.ts",
      "scripts/review-status.ts",
      "scripts/verify.ts",
      "src/examples/lineBattle.ts",
      "src/film.ts",
      "src/shots/opening.ts",
      "test/opening.test.ts",
      "tsconfig.json",
      "vendor/sharp-disabled/LICENSE",
      "vendor/sharp-disabled/index.cjs",
      "vendor/sharp-disabled/package.json",
      "viewer/index.html",
      "viewer/src/asset.ts",
      "viewer/src/film.ts",
      "viewer/src/loadCompiledModel.ts",
      "viewer/src/main.ts",
      "viewer/src/shot.ts",
      "viewer/src/shotRuntime.ts",
      "viewer/src/viewerDocument.ts",
      "vite.config.ts",
    ],
  );
  TestValidator.predicate(
    "every key is a POSIX path",
    Object.keys(files).every((key) => !key.includes("\\")),
  );

  // 2. substitution is complete and byte-clean.
  const pkg = files["package.json"]!;
  const parsedPackage = JSON.parse(pkg) as {
    dependencies?: Record<string, string>;
    overrides?: Record<string, Record<string, string>>;
  };
  TestValidator.predicate(
    "the project name is substituted",
    pkg.includes('"name": "demo-film"') &&
      files["README.md"]!.startsWith("# demo-film"),
  );
  TestValidator.predicate(
    "the production package versions are catalog-synced",
    pkg.includes(`"@automovie/cli": "${AUTOMOVIE_TEMPLATE_VERSIONS.cli}"`) &&
      pkg.includes(
        `"@automovie/engine": "${AUTOMOVIE_TEMPLATE_VERSIONS.engine}"`,
      ) &&
      pkg.includes(
        `"@automovie/lint": "${AUTOMOVIE_TEMPLATE_VERSIONS.lint}"`,
      ) &&
      pkg.includes(`"@automovie/mcp": "${AUTOMOVIE_TEMPLATE_VERSIONS.mcp}"`) &&
      pkg.includes(
        `"@automovie/viewer": "${AUTOMOVIE_TEMPLATE_VERSIONS.viewer}"`,
      ) &&
      pkg.includes(
        `"@huggingface/transformers": "${AUTOMOVIE_TEMPLATE_VERSIONS.huggingFaceTransformers}"`,
      ) &&
      AUTOMOVIE_TEMPLATE_VERSIONS.huggingFaceTransformers === "3.8.1" &&
      pkg.includes(
        `"h264-mp4-encoder": "${AUTOMOVIE_TEMPLATE_VERSIONS.h264Mp4Encoder}"`,
      ) &&
      pkg.includes(`"kokoro-js": "${AUTOMOVIE_TEMPLATE_VERSIONS.kokoroJs}"`) &&
      AUTOMOVIE_TEMPLATE_VERSIONS.kokoroJs === "1.2.1" &&
      pkg.includes(
        `"libopus-wasm": "${AUTOMOVIE_TEMPLATE_VERSIONS.libopusWasm}"`,
      ) &&
      pkg.includes(`"mp4box": "${AUTOMOVIE_TEMPLATE_VERSIONS.mp4box}"`) &&
      pkg.includes(
        `"onnxruntime-node": "${AUTOMOVIE_TEMPLATE_VERSIONS.onnxruntimeNode}"`,
      ) &&
      AUTOMOVIE_TEMPLATE_VERSIONS.onnxruntimeNode === "1.21.0" &&
      pkg.includes(
        `"playwright": "${AUTOMOVIE_TEMPLATE_VERSIONS.playwright}"`,
      ) &&
      pkg.includes(`"pngjs": "${AUTOMOVIE_TEMPLATE_VERSIONS.pngjs}"`) &&
      pkg.includes(
        `"@types/pngjs": "${AUTOMOVIE_TEMPLATE_VERSIONS.pngjsTypes}"`,
      ) &&
      pkg.includes(
        `"@types/node": "${AUTOMOVIE_TEMPLATE_VERSIONS.nodeTypes}"`,
      ) &&
      pkg.includes(`"three": "${AUTOMOVIE_TEMPLATE_VERSIONS.three}"`),
  );
  TestValidator.predicate(
    "the Node TTS graph owns CPU-only and image capability installation",
    parsedPackage.dependencies?.sharp === "file:vendor/sharp-disabled" &&
      parsedPackage.overrides?.["@huggingface/transformers"]?.sharp ===
        "file:vendor/sharp-disabled" &&
      files[".npmrc"] === "onnxruntime-node-install-cuda=skip\n",
  );
  TestValidator.predicate(
    "the starter separates owned source and enforces review in read-only lint",
    files["AGENTS.md"]!.includes("Never edit `generated`") &&
      files[".gitignore"]!.includes("generated/") &&
      files["scripts/compile.ts"]!.includes("compileAutoMovieProduction") &&
      files["scripts/compile.ts"]!.includes('scope: "source"') &&
      files["scripts/lint.ts"]!.includes('scope: "review"') &&
      files["README.md"]!.includes("fails while any design, source,") &&
      files["README.md"]!.includes(
        "shot, or film\nreview is missing, stale, revising, or incomplete",
      ),
  );
  TestValidator.predicate(
    "the local MCP host owns actual frame capture",
    files[".mcp.json"]!.includes("scripts/mcp.ts") &&
      files[".mcp.json"]!.includes("$" + "{CLAUDE_PROJECT_DIR:-.}") &&
      files["scripts/mcp.ts"]!.includes("createAutoMovieMcpServer") &&
      files["scripts/mcp.ts"]!.includes("captureProductionFrame") &&
      files["scripts/mcp.ts"]!.includes("fileURLToPath(import.meta.url)") &&
      files["scripts/mcp.ts"]!.includes("process.cwd()") === false &&
      files["scripts/preview.ts"]!.includes("captureFrame") &&
      files["scripts/preview.ts"]!.includes("previewFrame") === false &&
      /\.locator\("#view"\)\s*\.screenshot\(\{ type: "png" \}\)/.test(
        files["scripts/capture.ts"]!,
      ) &&
      pkg.includes('"three":') &&
      files["scripts/capture.ts"]!.includes('dedupe: ["three"]') &&
      files["vite.config.ts"]!.includes('dedupe: ["three"]') &&
      files["viewer/index.html"]!.includes('rel="icon" href="data:,"') &&
      files["viewer/src/shot.ts"]!.includes("mountViewer") &&
      files["viewer/src/shot.ts"]!.includes("preserveDrawingBuffer: true") &&
      files["viewer/src/shotRuntime.ts"]!.includes(
        "performance === undefined ? node.motion : performance.motion",
      ) &&
      files["scripts/capture.ts"]!.includes(
        'page.locator("#status").evaluate',
      ) &&
      files["scripts/capture.ts"]!.includes(
        "let sessionPromise: Promise<CaptureSession> | null",
      ) &&
      files["scripts/capture.ts"]!.includes(
        "pages: Map<string, Promise<CapturePage>>",
      ) &&
      files["scripts/capture.ts"]!.includes("productionFrameCaptureMetrics") &&
      files["scripts/capture.ts"]!.includes("avoidedPageReloads") &&
      files["scripts/capture.ts"]!.includes("capturesPerSecond") &&
      files["scripts/capture.ts"]!.includes("input.productionId") &&
      files["scripts/capture-browser.ts"]!.includes(
        "PLAYWRIGHT_BROWSERS_PATH: browserStoragePath(projectRoot)",
      ) &&
      files["scripts/capture-browser.ts"]!.includes("...process.env") &&
      files["scripts/capture-browser.ts"]!.includes(
        "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "PLAYWRIGHT_DOWNLOAD_HOST",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        'return import("playwright")',
      ) &&
      files["scripts/capture-browser.ts"]!.includes("paths: [packageRoot]") &&
      files["scripts/capture-browser.ts"]!.includes('"--no-shell"') &&
      files["scripts/capture-browser.ts"]!.includes(
        'stdio: ["ignore", "pipe", "pipe"]',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        'installSource !== "PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST"',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        'args: ["--use-angle=swiftshader"]',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        'context.getExtension("WEBGL_debug_renderer_info")',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "executableDigest: await digestFile",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        'config.source === "system-channel"',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        'source = "configured-executable"',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "parseCaptureBrowserConfig",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "Invalid capture browser config",
      ) &&
      files["scripts/capture-doctor.ts"]!.includes("PNG.sync.read") &&
      files["scripts/capture-doctor.ts"]!.includes(
        "canonicalAutoMovieCaptureRuntimeIdentity",
      ) &&
      files["scripts/capture-doctor.ts"]!.includes("visiblePixel") &&
      files["scripts/capture-install.ts"]!.includes(
        "installPackageOwnedChromium",
      ) &&
      files["automovie.config.ts"]!.includes('source: "playwright-chromium"') &&
      files["automovie.config.ts"]!.includes(
        "satisfies AutoMovieCaptureBrowserConfig",
      ) &&
      files[".gitignore"]!.includes(".automovie/capture/") &&
      files["README.md"]!.includes("npm run capture:install") &&
      files["README.md"]!.includes("PLAYWRIGHT_BROWSERS_PATH=0") &&
      files["scripts/render.ts"]!.includes(
        "await closeProductionFrameCapture()",
      ) &&
      files["scripts/render.ts"]!.includes("runProductionRenderJob") &&
      files["scripts/render.ts"]!.includes("commitProductionPublication") &&
      files["scripts/render.ts"]!.includes("probeProductionMedia") &&
      files["scripts/render.ts"]!.includes("probeProductionVideoMp4") &&
      files["scripts/render.ts"]!.includes("deriveProductionSoundPlan") &&
      files["scripts/render.ts"]!.includes("KokoroTTS.from_pretrained") &&
      files["scripts/render.ts"]!.includes("KOKORO_MODEL_REVISION") &&
      files["scripts/render.ts"]!.includes('KOKORO_DEVICE = "cpu"') &&
      files["scripts/render.ts"]!.split("device: KOKORO_DEVICE").length === 4 &&
      files["scripts/render.ts"]!.includes("productionSoundRuntimeIdentity") &&
      files["scripts/render.ts"]!.includes(
        'backend: {\n      ...resolvedPackageIdentity("onnxruntime-node"),\n      nativeAssets: onnxRuntimeNodeNativeAssets(),\n    }',
      ) &&
      files["scripts/render.ts"]!.includes(
        'path: "package:onnxruntime-node"',
      ) &&
      files["scripts/render.ts"]!.split("onnxRuntimeNodeNativeAssets()")
        .length === 3 &&
      files["scripts/render.ts"]!.includes(
        "process.platform,\n      process.arch",
      ) &&
      files["scripts/render.ts"]!.includes(
        'imageCapability: resolvedPackageIdentity("sharp")',
      ) &&
      files["scripts/render.ts"]!.includes(
        'path: "package:sharp-capability-wall"',
      ) &&
      files["scripts/render.ts"]!.includes(
        "root: modelCacheRoot,\n              directory: modelCacheRoot,\n              relative,",
      ) &&
      files["scripts/render.ts"]!.includes(
        "readRegularInside(modelCacheRoot, relative)",
      ) === false &&
      files["scripts/render.ts"]!.includes("encodeProductionOpus") &&
      files["scripts/render.ts"]!.includes("muxProductionFeatureMp4") &&
      renderProgressSource.includes("process.stderr.write") &&
      renderProgressSource.includes("[automovie:render]") &&
      renderProgressSource.includes("JSON.stringify({ stage, ...details })") &&
      renderProgressSource.includes("process.stdout.write") === false &&
      renderProgressStages.every((stage) =>
        renderScript.includes(`renderProgress("${stage}"`),
      ) &&
      files["scripts/render.ts"]!.includes('"waveform.png"') &&
      files["scripts/render.ts"]!.includes('"spectrogram.png"') &&
      files["scripts/render.ts"]!.includes('process.argv.indexOf("--tier")') &&
      files["scripts/render.ts"]!.includes("productionRenderLayersForPass") &&
      files["scripts/render.ts"]!.includes("renderGarbageCollection") &&
      files["scripts/render.ts"]!.includes("renderPublicationFingerprint") &&
      files["scripts/render.ts"]!.includes("assertMatchingProxyPublication") &&
      files["scripts/render.ts"]!.includes("assertNoLiveRenderWorkers") &&
      files["scripts/render.ts"]!.includes("captureGcPhysicalAncestry") &&
      files["scripts/render.ts"]!.includes("project.review(entry.target)") &&
      files["scripts/render.ts"]!.includes("frames/$" + "{passes[0]}/frame_") &&
      files["automovie.config.ts"]!.includes('kind: "proxy"') &&
      files["automovie.config.ts"]!.includes('kind: "final"') &&
      files["scripts/render.ts"]!.includes(
        "productionPublicationInputFingerprint",
      ) &&
      files["scripts/render.ts"]!.includes(
        "const stagedReview = new AutoMovieProductionReviewService",
      ) &&
      files["scripts/render.ts"]!.includes(
        "stagedReview.queue(status, compilerSnapshot)",
      ) &&
      files[".gitignore"]!.includes(".automovie/*") &&
      files[".gitignore"]!.includes("!.automovie/design/**") &&
      files[".gitignore"]!.includes("!.automovie/reviews/**") &&
      files["package.json"]!.includes('"build": "npm run compile"') &&
      files["package.json"]!.includes(
        '"lint": "npm run lint:source && ttsx -P tsconfig.json scripts/lint.ts"',
      ) &&
      files["package.json"]!.includes(
        '"lint:source": "ttsc --noEmit -p tsconfig.json"',
      ) &&
      files["package.json"]!.includes('"verify": "tsx scripts/verify.ts"') &&
      files["scripts/verify.ts"]!.includes('.lint({ scope: "final" })') &&
      files["scripts/verify.ts"]!.includes("openReadOnly") &&
      files[".claude/settings.json"]!.includes('"matcher": "*"') &&
      files[".claude/settings.json"]!.includes('"command": "node"') &&
      files[".claude/settings.json"]!.includes(
        '"$' + '{CLAUDE_PROJECT_DIR}/.claude/hooks/guard-automovie-owned.mjs"',
      ) &&
      files[".claude/hooks/guard-automovie-owned.mjs"]!.includes(
        "npm run compile",
      ) &&
      files[".claude/hooks/guard-automovie-owned.mjs"]!.includes(
        "process.exit(0)",
      ) &&
      files[".automovie/design/production.json"]!.includes(
        '"id": "starter-feature"',
      ) &&
      files[".automovie/design/production.json"]!.includes(
        '"id": "starter-pose-guide"',
      ) &&
      files[".automovie/design/production.json"]!.includes(
        '"id": "starter-captions"',
      ) &&
      files[".automovie/design/production.json"]!.includes(
        '"id": "starter-audio"',
      ) &&
      files["public/audio/starter-tone.json"]!.includes(
        '"sampleRate": 48000',
      ) &&
      files["public/audio/starter-tone.json"]!.includes('"channels": 2') &&
      files["scripts/generatedShotPlugin.ts"]!.includes('id.includes("/")') ===
        false &&
      files["scripts/generatedShotPlugin.ts"]!.includes(
        'pathname === "/__automovie/film.json"',
      ) &&
      files["scripts/generatedShotPlugin.ts"]!.includes(
        'const prefix = "/__automovie/assets/"',
      ) &&
      files["scripts/generatedShotPlugin.ts"]!.includes(
        "readCompiledAssetClosure",
      ) &&
      files["viewer/src/main.ts"]!.includes('await import("./film")') &&
      files["viewer/src/film.ts"]!.includes("renderCrossDissolveFrames") &&
      files["viewer/src/film.ts"]!.includes('pass !== "beauty"') &&
      files["viewer/src/loadCompiledModel.ts"]!.includes("GLTFLoader") &&
      files["viewer/src/loadCompiledModel.ts"]!.includes("VRMLoaderPlugin") &&
      files["viewer/src/loadCompiledModel.ts"]!.includes("rotateVRM0") &&
      files["viewer/src/loadCompiledModel.ts"]!.includes(
        "createImportedModelObject",
      ) &&
      files["package.json"]!.includes('"@pixiv/three-vrm": "^3"') &&
      files["viewer/src/asset.ts"]!.includes('finiteParameter("angle")') &&
      files["viewer/src/main.ts"]!.includes('from "three"') === false,
  );
  TestValidator.predicate(
    "no placeholder token survives any rendered path or payload",
    Object.entries(files).every(
      ([key, content]) => !key.includes("{{") && !content.includes("{{"),
    ),
  );
  TestValidator.predicate(
    "the starter owns prose and its machine index per production",
    files[".automovie/design/screenplay/index.json"]!.includes(
      '"production": "demo-film"',
    ) &&
      files[".automovie/design/screenplay/index.json"]!.includes(
        '"path": "docs/demo-film/screenplay.md"',
      ) &&
      files["docs/demo-film/screenplay.md"]!.includes("SCN-001") &&
      files["docs/demo-film/treatment.md"]!.includes(
        "A lone sentinel raises a signal",
      ),
  );
  TestValidator.predicate(
    "the starter ships the correctness lint ruleset",
    files["lint.config.ts"]!.startsWith('/// <reference types="node" />\n') &&
      files["lint.config.ts"]!.includes(
        '"typescript/switch-exhaustiveness-check": "error"',
      ) &&
      files["lint.config.ts"]!.includes('"typescript/no-explicit-any"') &&
      files["lint.config.ts"]!.includes(
        '"automovie/template-sentinel": "error"',
      ) &&
      files["lint.config.ts"]!.includes('"automovie/asset-provenance": [') &&
      files[".automovie/manifest.json"]!.includes(
        '"assetManifest": ".automovie/assets.json"',
      ) &&
      files[".automovie/assets.json"]!.includes(
        '"path": "public/audio/starter-tone.json"',
      ) &&
      files[".automovie/assets.json"]!.includes(
        '"digest": "sha256:f7c7178b601f4b029ba3c56ab05f2bb5ab57f9d0da21fa35cd9292656c2c48aa"',
      ) &&
      files["lint.config.ts"]!.includes('"automovie/screenplay-contract": [') &&
      files["lint.config.ts"]!.includes('".automovie/reviews/film/*.json"') &&
      files["lint.config.ts"]!.includes('".automovie/reviews/*/film/*.json"') &&
      files["lint.config.ts"]!.includes("/films/") === false,
  );
  TestValidator.predicate(
    "no payload carries a CRLF",
    Object.values(files).every((content) => !content.includes("\r\n")),
  );

  // 3. loud failures on a bad variable / blank name.
  TestValidator.predicate(
    "renderTemplate throws on an unknown token",
    throws(() => renderTemplate("{{nope}}", {})),
  );
  TestValidator.predicate(
    "renderTemplate substitutes a known token",
    renderTemplate("hi {{who}}", { who: "there" }) === "hi there",
  );
  TestValidator.predicate(
    "renderScaffold throws on a blank name",
    throws(() => renderScaffold({ name: "   " })),
  );
  TestValidator.predicate(
    "renderScaffold refuses a path-bearing production name",
    throws(() => renderScaffold({ name: "../escape" })) &&
      throws(() => renderScaffold({ name: "film/name" })),
  );

  // 4. write half: materialize, non-empty guard, traversal guard.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-scaffold-"));
  try {
    const target = path.join(base, "project");
    const written = writeFiles(target, files);
    TestValidator.equals(
      "every rendered file is written to disk",
      written.length,
      Object.keys(files).length,
    );
    // The second cross-host guarantee, previously untested: `writeFiles`
    // returns the written paths in code-unit order. Checked through the
    // relative keys so the assertion reads the same on both path separators;
    // for this asset set every pair is decided on its first character, so the
    // separator never enters the comparison. Without the sort the return would
    // carry the map's insertion order (README.md first), so this fails if the
    // guarantee is dropped.
    TestValidator.equals(
      "writeFiles returns its paths in code-unit order",
      written.map((absolute) =>
        path.relative(target, absolute).split(path.sep).join("/"),
      ),
      [
        ".automovie/assets.json",
        ".automovie/design/acceptance/answer-beauty.json",
        ".automovie/design/acceptance/answer-pose.json",
        ".automovie/design/acceptance/opening-beauty.json",
        ".automovie/design/acceptance/opening-effect-mask.json",
        ".automovie/design/acceptance/opening-pose.json",
        ".automovie/design/formations/army.json",
        ".automovie/design/models/army-far.json",
        ".automovie/design/models/army-hero.json",
        ".automovie/design/models/army-near.json",
        ".automovie/design/models/sentinel.json",
        ".automovie/design/production.json",
        ".automovie/design/screenplay/index.json",
        ".automovie/design/shots/answer.json",
        ".automovie/design/shots/opening.json",
        ".automovie/design/world.json",
        ".automovie/manifest.json",
        ".automovie/reviews/README.md",
        ".claude/hooks/guard-automovie-owned.mjs",
        ".claude/settings.json",
        ".gitignore",
        ".mcp.json",
        ".npmrc",
        "AGENTS.md",
        "CLAUDE.md",
        "README.md",
        "automovie.config.ts",
        "docs/art-direction.md",
        "docs/demo-film/screenplay.md",
        "docs/demo-film/treatment.md",
        "docs/historical-notes.md",
        "lint.config.ts",
        "package.json",
        "public/assets/README.md",
        "public/audio/README.md",
        "public/audio/starter-tone.json",
        "renders/README.md",
        "scripts/capture-browser.ts",
        "scripts/capture-doctor.ts",
        "scripts/capture-install.ts",
        "scripts/capture.ts",
        "scripts/compile.ts",
        "scripts/generatedShotPlugin.ts",
        "scripts/lint.ts",
        "scripts/mcp.ts",
        "scripts/preview.ts",
        "scripts/render.ts",
        "scripts/review-status.ts",
        "scripts/verify.ts",
        "src/examples/lineBattle.ts",
        "src/film.ts",
        "src/shots/opening.ts",
        "test/opening.test.ts",
        "tsconfig.json",
        "vendor/sharp-disabled/LICENSE",
        "vendor/sharp-disabled/index.cjs",
        "vendor/sharp-disabled/package.json",
        "viewer/index.html",
        "viewer/src/asset.ts",
        "viewer/src/film.ts",
        "viewer/src/loadCompiledModel.ts",
        "viewer/src/main.ts",
        "viewer/src/shot.ts",
        "viewer/src/shotRuntime.ts",
        "viewer/src/viewerDocument.ts",
        "vite.config.ts",
      ],
    );
    TestValidator.predicate(
      "the written tree matches the rendered keys on disk",
      Object.keys(files).every((key) => fs.existsSync(path.join(target, key))),
    );
    const sharpWall = createRequire(__filename)(
      path.join(target, "vendor", "sharp-disabled", "index.cjs"),
    ) as () => never;
    TestValidator.predicate(
      "the local Sharp replacement fails explicitly outside the TTS surface",
      throwsWith(sharpWall, "text/audio path only"),
    );
    const generatedRoot = path.join(target, "generated", "demo-film");
    const artifact = path.join(generatedRoot, "shots", "race.json");
    fs.mkdirSync(path.dirname(artifact), { recursive: true });
    fs.writeFileSync(artifact, '{"resident":true}\n');
    const generatedModule = createRequire(__filename)(
      path.join(target, "scripts", "generatedShotPlugin.ts"),
    ) as {
      generatedShotPlugin: (
        root: string,
        productionId: string,
      ) => {
        configureServer?: (server: {
          middlewares: {
            use: (handler: GeneratedViewerMiddleware) => void;
          };
        }) => void;
      };
    };
    let middleware: GeneratedViewerMiddleware | undefined;
    generatedModule.generatedShotPlugin(target, "demo-film").configureServer?.({
      middlewares: {
        use: (handler) => {
          middleware = handler;
        },
      },
    });
    const positiveHeaders = new Map<string, string>();
    const positiveResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        positiveResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: (name, value) => {
        positiveHeaders.set(name, value);
      },
    };
    middleware?.(
      { url: "/__automovie/shots/race.json" },
      positiveResponse,
      () => undefined,
    );
    TestValidator.predicate(
      "the generated viewer serves the exact resident artifact and headers",
      middleware !== undefined &&
        positiveResponse.statusCode === 200 &&
        positiveResponse.body === '{"resident":true}\n' &&
        positiveHeaders.get("Content-Type") ===
          "application/json; charset=utf-8" &&
        positiveHeaders.get("Cache-Control") === "no-store",
    );
    const mutableFs = createRequire(__filename)("node:fs") as typeof fs;
    const nativeLstat = mutableFs.lstatSync;
    const shotsDirectory = path.dirname(artifact);
    const parkedShots = `${shotsDirectory}.parked`;
    const replacementShots = `${shotsDirectory}.replacement`;
    fs.mkdirSync(replacementShots);
    fs.writeFileSync(
      path.join(replacementShots, "race.json"),
      '{"ancestorReplacement":true}\n',
    );
    let ancestorSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        ancestorSwapped === false &&
        path.resolve(file.toString()) === shotsDirectory
      ) {
        fs.renameSync(shotsDirectory, parkedShots);
        fs.renameSync(replacementShots, shotsDirectory);
        ancestorSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    const ancestorResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        ancestorResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    try {
      middleware?.(
        { url: "/__automovie/shots/race.json" },
        ancestorResponse,
        () => undefined,
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedShots)) {
        fs.rmSync(shotsDirectory, { recursive: true, force: true });
        fs.renameSync(parkedShots, shotsDirectory);
      }
      fs.rmSync(replacementShots, { recursive: true, force: true });
    }
    TestValidator.predicate(
      "the generated viewer refuses an ancestry replacement during canonicalization",
      ancestorSwapped &&
        ancestorResponse.statusCode === 400 &&
        ancestorResponse.body === "invalid compiled viewer artifact request",
    );
    const parkedArtifact = `${artifact}.parked`;
    let artifactSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        artifactSwapped === false &&
        path.resolve(file.toString()) === artifact
      ) {
        fs.renameSync(artifact, parkedArtifact);
        fs.writeFileSync(artifact, '{"replacement":true}\n');
        artifactSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    const viewerResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        viewerResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    try {
      middleware?.(
        { url: "/__automovie/shots/race.json" },
        viewerResponse,
        () => undefined,
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedArtifact)) {
        fs.rmSync(artifact, { force: true });
        fs.renameSync(parkedArtifact, artifact);
      }
    }
    TestValidator.predicate(
      "the generated viewer refuses an artifact replaced after linked identity",
      middleware !== undefined &&
        artifactSwapped &&
        viewerResponse.statusCode === 400 &&
        viewerResponse.body === "invalid compiled viewer artifact request",
    );
    const asset = path.join(target, "public", "audio", "starter-tone.json");
    const assetBytes = fs.readFileSync(asset);
    const assetDigest =
      "sha256:f7c7178b601f4b029ba3c56ab05f2bb5ab57f9d0da21fa35cd9292656c2c48aa";
    const model = path.join(generatedRoot, "models", "asset-closure.json");
    fs.mkdirSync(path.dirname(model), { recursive: true });
    fs.writeFileSync(
      model,
      `${JSON.stringify({
        imported: {
          assets: [
            {
              path: "public/audio/starter-tone.json",
              digest: assetDigest,
            },
          ],
        },
      })}\n`,
    );
    const parkedAsset = `${asset}.parked`;
    let assetSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (assetSwapped === false && path.resolve(file.toString()) === asset) {
        fs.renameSync(asset, parkedAsset);
        fs.writeFileSync(asset, assetBytes);
        assetSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    const assetResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        assetResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    try {
      middleware?.(
        { url: "/__automovie/assets/public/audio/starter-tone.json" },
        assetResponse,
        () => undefined,
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedAsset)) {
        fs.rmSync(asset, { force: true });
        fs.renameSync(parkedAsset, asset);
      }
    }
    TestValidator.predicate(
      "the generated viewer refuses a byte-identical registered asset successor",
      assetSwapped &&
        assetResponse.statusCode === 400 &&
        assetResponse.body === "invalid registered asset request",
    );
    TestValidator.predicate(
      "a non-empty target is refused without force",
      throws(() => writeFiles(target, files)),
    );
    TestValidator.predicate(
      "force scaffolds into a non-empty target",
      !throws(() => writeFiles(target, files, { force: true })),
    );
    TestValidator.predicate(
      "a traversal key is refused",
      throws(() =>
        writeFiles(path.join(base, "guard"), { "../escape.txt": "no" }),
      ),
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
};
