import {
  AUTOMOVIE_TEMPLATE_VERSIONS,
  renderScaffold,
  renderTemplate,
  scaffoldAssetDirectory,
  writeFiles,
} from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";

import {
  productionH264Mp4,
  productionPng,
} from "../mcp/productionMediaFixtures";

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
 *    and final asset bytes, rejecting authorization successors and inventory
 *    mutation before serving one descriptor-bound asset.
 * 9. Proxy publication verification accepts an exact physical bundle and rejects
 *    byte-identical file, hard-linked directory, and late-inventory
 *    successors.
 * 10. Runtime package identity binds manifest, entry, and selected asset-tree bytes
 *     to one physical snapshot and rejects their successors.
 * 11. Capture provenance descriptor-binds install receipts and keeps the exact
 *     executable identity open across its launch boundary.
 * 12. Render GC deletes only its inventoried physical candidate and preserves a
 *     successor crossing the rename boundary under reserved quarantine.
 * 13. Routine render cleanup releases or quarantines only the exact worker-state
 *     target used for its ownership or staleness decision.
 * 14. Render sessions and explicit GC apply use a two-sided lease handshake so
 *     neither process can enter state mutation after the other's liveness
 *     scan.
 * 15. Chunk completion publishes an immutable unique tree through one direct-root
 *     exclusive pointer; resume and finalize consume its exact declared bytes.
 * 16. Final conform reopens a matching proxy publication through its manifest,
 *     exact payload bytes, inventory, and physical tree identity.
 */
export const test_cli_scaffold = async (): Promise<void> => {
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
  const recoveryProtectionModule = files["scripts/renderChunkSnapshot.ts"]!;
  const recoveryProtectionOffset = recoveryProtectionModule.indexOf(
    "export const currentRenderChunkPublicationProtectsTree",
  );
  const recoveryProtectionSource =
    recoveryProtectionOffset < 0
      ? ""
      : recoveryProtectionModule.slice(
          recoveryProtectionOffset,
          recoveryProtectionModule.indexOf(
            "export const readRenderChunkPublicationFile",
            recoveryProtectionOffset,
          ),
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
      "scripts/assertProxyBundle.ts",
      "scripts/capture-browser.ts",
      "scripts/capture-doctor.ts",
      "scripts/capture-install.ts",
      "scripts/capture.ts",
      "scripts/captureExecutableSnapshot.ts",
      "scripts/compile.ts",
      "scripts/generatedShotPlugin.ts",
      "scripts/lint.ts",
      "scripts/mcp.ts",
      "scripts/preview.ts",
      "scripts/publishProxyBundle.ts",
      "scripts/render.ts",
      "scripts/renderChunkSnapshot.ts",
      "scripts/renderGcSnapshot.ts",
      "scripts/renderLiveness.ts",
      "scripts/review-status.ts",
      "scripts/runtimePackageSnapshot.ts",
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
      files["scripts/capture-browser.ts"]!.includes(
        "paths: [playwright.root]",
      ) &&
      files["scripts/capture-browser.ts"]!.includes('"--no-shell"') &&
      files["scripts/capture-browser.ts"]!.includes(
        'stdio: ["ignore", "pipe", "pipe", cli.descriptor]',
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "runDescriptorBoundNodeCli",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "launchWithCaptureExecutableSnapshot",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "publishCaptureInstallReceipt",
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
        "executableDigest: executable.digest",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "readAutoMovieProductionOwnedFile",
      ) &&
      files["scripts/capture-browser.ts"]!.includes(
        "assertCaptureExecutable(executable)",
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
        "backend: onnxRuntimeNodeIdentity()",
      ) &&
      files["scripts/render.ts"]!.includes(
        'path: "package:onnxruntime-node"',
      ) &&
      files["scripts/render.ts"]!.split("onnxRuntimeNodeIdentity()").length ===
        3 &&
      files["scripts/render.ts"]!.includes(
        '["bin", "napi-v3", process.platform, process.arch]',
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
      files["scripts/renderChunkSnapshot.ts"]!.includes(
        'kind: "chunk-pointer"',
      ) &&
      files["scripts/renderChunkSnapshot.ts"]!.includes('kind: "chunk-tree"') &&
      files["scripts/renderChunkSnapshot.ts"]!.includes(
        "captureRenderChunkPublicationFromPointer(pointer)",
      ) &&
      files["scripts/renderChunkSnapshot.ts"]!.includes(
        "exactTreeContent(authenticated.tree, snapshot)",
      ) &&
      files["scripts/renderChunkSnapshot.ts"]!.includes(
        "authenticated === undefined && props.processAlive(Number(match[2]))",
      ) &&
      files["scripts/render.ts"]!.includes("inventoryRenderChunkGarbage") &&
      files["scripts/render.ts"]!.includes(
        "retainedChunkPaths: [...retainedChunkPaths]",
      ) &&
      files["scripts/render.ts"]!.includes("const base = snapshot.base.path") &&
      files["scripts/render.ts"]!.includes(
        "path.resolve(renderJobRoot, candidate.path)",
      ) === false &&
      files["scripts/render.ts"]!.includes("captureRenderGcTarget") &&
      files["scripts/render.ts"]!.includes("removeCapturedRenderGcTarget") &&
      files["scripts/render.ts"]!.includes("quarantineCapturedRenderTarget") &&
      files["scripts/render.ts"]!.includes("readCapturedRenderGcFile") &&
      files["scripts/render.ts"]!.includes("RENDER_LOCK_JSON_MAX_BYTES") &&
      files["scripts/render.ts"]!.includes(
        "captureAbandonedRenderStateTarget",
      ) &&
      files["scripts/render.ts"]!.includes("held.snapshot") &&
      files["scripts/render.ts"]!.includes(
        "quarantineStaleSlotOutputs(current.chunks)",
      ) &&
      files["scripts/render.ts"]!.includes("acquireRenderSessionLease") &&
      files["scripts/render.ts"]!.includes("acquireRenderGcLease") &&
      files["scripts/render.ts"]!.includes("coordinationRoot: root") &&
      files["scripts/render.ts"]!.includes("renderCoordinationRoot") ===
        false &&
      files[".gitignore"]!.includes(".automovie-liveness-*") &&
      files["scripts/render.ts"]!.includes("publishRenderChunkSnapshot") &&
      files["scripts/render.ts"]!.includes("captureRenderChunkPublication") &&
      files["scripts/render.ts"]!.includes("renderChunkPublicationPath") &&
      files["scripts/render.ts"]!.includes(
        "loadCurrentRenderChunkPublication",
      ) &&
      files["scripts/render.ts"]!.includes("consumeCurrentRenderChunkFrames") &&
      files["scripts/render.ts"]!.includes(
        "removeCapturedRenderChunkPointer(pointerSnapshot)",
      ) &&
      files["scripts/render.ts"]!.includes(
        "currentPublicationProtectsTree(currentChunks, entry.name, snapshot)",
      ) &&
      recoveryProtectionSource.includes(
        "const chunk = props.chunks.get(digest)",
      ) &&
      recoveryProtectionSource.includes("for (const chunk of chunks)") ===
        false &&
      files[".gitignore"]!.includes(".automovie-chunk-*") &&
      files["scripts/render.ts"]!.includes(
        "fs.renameSync(temporary, destination)",
      ) === false &&
      files["scripts/render.ts"]!.includes(
        "readRegularInside(chunkDirectory(chunk.id), frame.path)",
      ) === false &&
      files["scripts/render.ts"]!.includes("renderPublicationFingerprint") &&
      files["scripts/render.ts"]!.includes("assertMatchingProxyPublication") &&
      files["scripts/render.ts"]!.includes("inspectPublishedProxyBundle") &&
      files["scripts/render.ts"]!.includes("publishProxyBundle({") &&
      files["scripts/publishProxyBundle.ts"]!.includes(
        "fs.mkdirSync(props.target)",
      ) &&
      files["scripts/publishProxyBundle.ts"]!.includes(
        'fs.writeFileSync(destination, bytes, { flag: "wx" })',
      ) &&
      files["scripts/publishProxyBundle.ts"]!.includes(
        "removeCapturedRenderGcTarget",
      ) &&
      files["scripts/publishProxyBundle.ts"]!.includes(
        "fs.renameSync(candidate, target)",
      ) === false &&
      files["scripts/publishProxyBundle.ts"]!.includes(
        "fs.rmSync(candidate",
      ) === false &&
      files["scripts/render.ts"]!.includes("assertNoLiveRenderWorkers") &&
      files["scripts/render.ts"]!.includes("captureGcPhysicalAncestry") ===
        false &&
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
        "scripts/assertProxyBundle.ts",
        "scripts/capture-browser.ts",
        "scripts/capture-doctor.ts",
        "scripts/capture-install.ts",
        "scripts/capture.ts",
        "scripts/captureExecutableSnapshot.ts",
        "scripts/compile.ts",
        "scripts/generatedShotPlugin.ts",
        "scripts/lint.ts",
        "scripts/mcp.ts",
        "scripts/preview.ts",
        "scripts/publishProxyBundle.ts",
        "scripts/render.ts",
        "scripts/renderChunkSnapshot.ts",
        "scripts/renderGcSnapshot.ts",
        "scripts/renderLiveness.ts",
        "scripts/review-status.ts",
        "scripts/runtimePackageSnapshot.ts",
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
    const mutableFs = createRequire(__filename)("node:fs") as {
      lstatSync: typeof fs.lstatSync;
      fsyncSync: typeof fs.fsyncSync;
      mkdirSync: typeof fs.mkdirSync;
      openSync: typeof fs.openSync;
      readFileSync: typeof fs.readFileSync;
      readdirSync: typeof fs.readdirSync;
      renameSync: typeof fs.renameSync;
      statSync: typeof fs.statSync;
      writeFileSync: typeof fs.writeFileSync;
    };
    const nativeFsync = mutableFs.fsyncSync;
    const nativeLstat = mutableFs.lstatSync;
    const nativeMkdir = mutableFs.mkdirSync;
    const nativeOpen = mutableFs.openSync;
    const nativeReadFile = mutableFs.readFileSync;
    const nativeStat = mutableFs.statSync;
    const nativeWriteFile = mutableFs.writeFileSync;
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
    const positiveAssetResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        positiveAssetResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    middleware?.(
      { url: "/__automovie/assets/public/audio/starter-tone.json" },
      positiveAssetResponse,
      () => undefined,
    );
    TestValidator.predicate(
      "the generated viewer serves one ledger-and-closure-bound asset",
      positiveAssetResponse.statusCode === 200 &&
        positiveAssetResponse.body === assetBytes.toString("utf8"),
    );
    const requestRegisteredAsset = (): GeneratedViewerResponse => {
      const response: GeneratedViewerResponse = {
        body: "",
        statusCode: 0,
        end: (body) => {
          response.body = Buffer.isBuffer(body)
            ? body.toString("utf8")
            : String(body ?? "");
        },
        setHeader: () => undefined,
      };
      middleware?.(
        { url: "/__automovie/assets/public/audio/starter-tone.json" },
        response,
        () => undefined,
      );
      return response;
    };
    const ledger = path.join(target, ".automovie", "assets.json");
    const ledgerBytes = fs.readFileSync(ledger);
    const parkedLedger = `${ledger}.parked`;
    let ledgerSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (ledgerSwapped === false && path.resolve(file.toString()) === ledger) {
        fs.renameSync(ledger, parkedLedger);
        fs.writeFileSync(ledger, ledgerBytes);
        ledgerSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let ledgerResponse: GeneratedViewerResponse;
    try {
      ledgerResponse = requestRegisteredAsset();
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedLedger)) {
        fs.rmSync(ledger, { force: true });
        fs.renameSync(parkedLedger, ledger);
      }
    }
    TestValidator.predicate(
      "the generated viewer refuses a byte-identical asset ledger successor",
      ledgerSwapped &&
        ledgerResponse.statusCode === 400 &&
        ledgerResponse.body === "invalid registered asset request",
    );
    const modelBytes = fs.readFileSync(model);
    const parkedModel = `${model}.parked`;
    let modelSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (modelSwapped === false && path.resolve(file.toString()) === model) {
        fs.renameSync(model, parkedModel);
        fs.writeFileSync(model, modelBytes);
        modelSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let modelResponse: GeneratedViewerResponse;
    try {
      modelResponse = requestRegisteredAsset();
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedModel)) {
        fs.rmSync(model, { force: true });
        fs.renameSync(parkedModel, model);
      }
    }
    TestValidator.predicate(
      "the generated viewer refuses a byte-identical compiled model successor",
      modelSwapped &&
        modelResponse.statusCode === 400 &&
        modelResponse.body === "invalid registered asset request",
    );
    const modelsDirectory = path.dirname(model);
    const extraModel = path.join(modelsDirectory, "late-inventory.json");
    const nativeReaddir = mutableFs.readdirSync;
    let inventoryMutated = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        inventoryMutated === false &&
        path.resolve(directory.toString()) === modelsDirectory
      ) {
        fs.writeFileSync(extraModel, '{"imported":{"assets":[]}}\n');
        inventoryMutated = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    let inventoryResponse: GeneratedViewerResponse;
    try {
      inventoryResponse = requestRegisteredAsset();
    } finally {
      mutableFs.readdirSync = nativeReaddir;
      fs.rmSync(extraModel, { force: true });
    }
    TestValidator.predicate(
      "the generated viewer refuses compiled model inventory mutation",
      inventoryMutated &&
        inventoryResponse.statusCode === 400 &&
        inventoryResponse.body === "invalid registered asset request",
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
    const proxy = path.join(base, "proxy-publication");
    const proxyFiles = new Map<string, Uint8Array>([
      ["manifest.json", Buffer.from('{"proxy":true}\n')],
      ["media/proxy.mp4", Buffer.from("proxy bytes")],
    ]);
    for (const [relative, bytes] of proxyFiles) {
      const file = path.join(proxy, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    const proxyModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "assertProxyBundle.ts"),
    ) as {
      assertPublishedProxyBundle: (
        directory: string,
        expected: ReadonlyMap<string, Uint8Array>,
      ) => void;
      inspectPublishedProxyBundle: (
        renderRoot: string,
        directory: string,
      ) => {
        compileFingerprint: string;
        editFingerprint: string;
        publicationFingerprint: string;
        tier: { kind: string };
      };
    };
    const proxyPublisherModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "publishProxyBundle.ts"),
    ) as {
      publishProxyBundle: (props: {
        expected: ReadonlyMap<string, Uint8Array>;
        parent: string;
        processAlive: (pid: number) => boolean;
        renderRoot: string;
        target: string;
      }) => { reused: boolean };
    };
    TestValidator.predicate(
      "an exact physical proxy bundle passes immutable verification",
      !throws(() => proxyModule.assertPublishedProxyBundle(proxy, proxyFiles)),
    );
    const proxyPublishRoot = path.join(base, "proxy-publisher");
    const proxyPublishParent = path.join(
      proxyPublishRoot,
      "deliverables",
      "proxy",
    );
    fs.mkdirSync(proxyPublishParent, { recursive: true });
    const proxyPublishFiles = new Map<string, Uint8Array>([
      ["publication.json", Buffer.from('{"publication":true}\n')],
      ["feature/feature.mp4", Buffer.from("published proxy bytes")],
    ]);
    const writeProxyPublishFixture = (target: string): void => {
      for (const [relative, bytes] of proxyPublishFiles) {
        const file = path.join(target, ...relative.split("/"));
        Reflect.apply(nativeMkdir, mutableFs, [
          path.dirname(file),
          {
            recursive: true,
          },
        ]);
        fs.writeFileSync(file, bytes);
      }
    };
    const proxyPublishTarget = path.join(proxyPublishParent, "normal");
    const firstProxyPublication = proxyPublisherModule.publishProxyBundle({
      expected: proxyPublishFiles,
      parent: proxyPublishParent,
      processAlive: () => false,
      renderRoot: proxyPublishRoot,
      target: proxyPublishTarget,
    });
    const reusedProxyPublication = proxyPublisherModule.publishProxyBundle({
      expected: proxyPublishFiles,
      parent: proxyPublishParent,
      processAlive: () => false,
      renderRoot: proxyPublishRoot,
      target: proxyPublishTarget,
    });
    TestValidator.predicate(
      "proxy publisher reserves a new target and independently verifies reuse",
      firstProxyPublication.reused === false &&
        reusedProxyPublication.reused &&
        !throws(() =>
          proxyModule.assertPublishedProxyBundle(
            proxyPublishTarget,
            proxyPublishFiles,
          ),
        ),
    );

    const emptySuccessorTarget = path.join(
      proxyPublishParent,
      "empty-successor",
    );
    let emptySuccessorInserted = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        emptySuccessorInserted === false &&
        path.resolve(directory.toString()) === emptySuccessorTarget
      ) {
        Reflect.apply(nativeMkdir, mutableFs, [emptySuccessorTarget]);
        emptySuccessorInserted = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let emptySuccessorRejected = false;
    try {
      emptySuccessorRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: emptySuccessorTarget,
        }),
      );
    } finally {
      mutableFs.mkdirSync = nativeMkdir;
    }
    TestValidator.predicate(
      "proxy publisher never replaces a destination appearing at commit",
      emptySuccessorInserted &&
        emptySuccessorRejected &&
        fs.existsSync(emptySuccessorTarget) &&
        fs.readdirSync(emptySuccessorTarget).length === 0,
    );

    const exactSuccessorTarget = path.join(
      proxyPublishParent,
      "exact-successor",
    );
    let exactSuccessorInserted = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        exactSuccessorInserted === false &&
        path.resolve(directory.toString()) === exactSuccessorTarget
      ) {
        writeProxyPublishFixture(exactSuccessorTarget);
        exactSuccessorInserted = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let exactSuccessorReused = false;
    try {
      exactSuccessorReused = proxyPublisherModule.publishProxyBundle({
        expected: proxyPublishFiles,
        parent: proxyPublishParent,
        processAlive: () => false,
        renderRoot: proxyPublishRoot,
        target: exactSuccessorTarget,
      }).reused;
    } finally {
      mutableFs.mkdirSync = nativeMkdir;
    }
    TestValidator.predicate(
      "proxy publisher verifies an exact commit competitor without overwriting it",
      exactSuccessorInserted &&
        exactSuccessorReused &&
        !throws(() =>
          proxyModule.assertPublishedProxyBundle(
            exactSuccessorTarget,
            proxyPublishFiles,
          ),
        ),
    );

    const candidateSwapTarget = path.join(proxyPublishParent, "candidate-swap");
    let candidateSwapPath = "";
    let parkedCandidateSwap = "";
    let candidateTreeSwapped = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        candidateTreeSwapped === false &&
        path.dirname(path.resolve(directory.toString())) ===
          proxyPublishParent &&
        path.basename(directory.toString()).endsWith(".candidate") &&
        Array.isArray(entries) &&
        entries.length > 0
      ) {
        candidateSwapPath = path.resolve(directory.toString());
        parkedCandidateSwap = `${candidateSwapPath}.parked`;
        nativeRename(candidateSwapPath, parkedCandidateSwap);
        fs.cpSync(parkedCandidateSwap, candidateSwapPath, { recursive: true });
        candidateTreeSwapped = true;
        return Reflect.apply(nativeReaddir, mutableFs, [directory, ...args]);
      }
      return entries;
    }) as typeof fs.readdirSync;
    let candidateTreeSwapRejected = false;
    try {
      candidateTreeSwapRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: candidateSwapTarget,
        }),
      );
    } finally {
      mutableFs.readdirSync = nativeReaddir;
    }
    TestValidator.predicate(
      "proxy publisher rejects and preserves a byte-identical candidate tree successor",
      candidateTreeSwapped &&
        candidateTreeSwapRejected &&
        fs.existsSync(candidateSwapPath) &&
        fs.existsSync(parkedCandidateSwap) &&
        fs.existsSync(candidateSwapTarget) === false,
    );
    fs.rmSync(candidateSwapPath, { recursive: true, force: true });
    fs.rmSync(parkedCandidateSwap, { recursive: true, force: true });

    const candidateCleanupTarget = path.join(
      proxyPublishParent,
      "candidate-cleanup-successor",
    );
    let parkedCleanupCandidate = "";
    let movedCleanupSuccessor = "";
    let candidateCleanupSwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        candidateCleanupSwapped === false &&
        path.dirname(path.resolve(oldPath.toString())) === proxyPublishParent &&
        path.basename(oldPath.toString()).endsWith(".candidate")
      ) {
        parkedCleanupCandidate = `${path.resolve(oldPath.toString())}.parked`;
        nativeRename(oldPath, parkedCleanupCandidate);
        fs.mkdirSync(oldPath.toString());
        fs.writeFileSync(
          path.join(oldPath.toString(), "successor.marker"),
          "x",
        );
        candidateCleanupSwapped = true;
        movedCleanupSuccessor = path.resolve(newPath.toString());
      }
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let candidateCleanupRejected = false;
    try {
      candidateCleanupRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: candidateCleanupTarget,
        }),
      );
    } finally {
      mutableFs.renameSync = nativeRename;
    }
    TestValidator.predicate(
      "proxy publisher preserves a candidate pathname successor during cleanup",
      candidateCleanupSwapped &&
        candidateCleanupRejected &&
        fs.existsSync(candidateCleanupTarget) === false &&
        fs.existsSync(parkedCleanupCandidate) &&
        fs.readFileSync(
          path.join(movedCleanupSuccessor, "successor.marker"),
          "utf8",
        ) === "x",
    );
    fs.rmSync(parkedCleanupCandidate, { recursive: true, force: true });
    fs.rmSync(path.dirname(movedCleanupSuccessor), {
      recursive: true,
      force: true,
    });

    const parentSwapTarget = path.join(proxyPublishParent, "parent-swap");
    const parkedProxyPublishParent = `${proxyPublishParent}.parked`;
    let proxyParentSwapped = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        proxyParentSwapped === false &&
        path.dirname(path.resolve(directory.toString())) ===
          proxyPublishParent &&
        path.basename(directory.toString()).endsWith(".candidate")
      ) {
        nativeRename(proxyPublishParent, parkedProxyPublishParent);
        Reflect.apply(nativeMkdir, mutableFs, [
          proxyPublishParent,
          {
            recursive: true,
          },
        ]);
        proxyParentSwapped = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let proxyParentSwapRejected = false;
    try {
      proxyParentSwapRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: parentSwapTarget,
        }),
      );
    } finally {
      mutableFs.mkdirSync = nativeMkdir;
    }
    TestValidator.predicate(
      "proxy publisher rejects and preserves a physical parent successor",
      proxyParentSwapped &&
        proxyParentSwapRejected &&
        fs.existsSync(proxyPublishParent) &&
        fs.existsSync(parkedProxyPublishParent),
    );
    fs.rmSync(proxyPublishParent, { recursive: true, force: true });
    nativeRename(parkedProxyPublishParent, proxyPublishParent);

    const rootSwapTarget = path.join(proxyPublishParent, "root-swap");
    const parkedProxyPublishRoot = `${proxyPublishRoot}.parked`;
    let proxyRootSwapped = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        proxyRootSwapped === false &&
        path.dirname(path.resolve(directory.toString())) ===
          proxyPublishParent &&
        path.basename(directory.toString()).endsWith(".candidate")
      ) {
        nativeRename(proxyPublishRoot, parkedProxyPublishRoot);
        Reflect.apply(nativeMkdir, mutableFs, [
          proxyPublishParent,
          {
            recursive: true,
          },
        ]);
        proxyRootSwapped = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let proxyRootSwapRejected = false;
    try {
      proxyRootSwapRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: rootSwapTarget,
        }),
      );
    } finally {
      mutableFs.mkdirSync = nativeMkdir;
    }
    TestValidator.predicate(
      "proxy publisher rejects and preserves a physical render-root successor",
      proxyRootSwapped &&
        proxyRootSwapRejected &&
        fs.existsSync(proxyPublishRoot) &&
        fs.existsSync(parkedProxyPublishRoot),
    );
    fs.rmSync(proxyPublishRoot, { recursive: true, force: true });
    nativeRename(parkedProxyPublishRoot, proxyPublishRoot);

    const postSnapshotTarget = path.join(
      proxyPublishParent,
      "post-snapshot-candidate-swap",
    );
    let postSnapshotCandidate = "";
    let postSnapshotCandidateSwapped = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        postSnapshotCandidateSwapped === false &&
        path.resolve(directory.toString()) === postSnapshotTarget
      ) {
        postSnapshotCandidate = fs
          .readdirSync(proxyPublishParent)
          .map((name) => path.join(proxyPublishParent, name))
          .find((candidate) => candidate.endsWith(".candidate"))!;
        const source = path.join(
          postSnapshotCandidate,
          "feature",
          "feature.mp4",
        );
        fs.rmSync(source);
        fs.writeFileSync(source, proxyPublishFiles.get("feature/feature.mp4")!);
        postSnapshotCandidateSwapped = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let postSnapshotCandidateRejected = false;
    try {
      postSnapshotCandidateRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: postSnapshotTarget,
        }),
      );
    } finally {
      mutableFs.mkdirSync = nativeMkdir;
    }
    TestValidator.predicate(
      "proxy publisher rejects a candidate file successor after its complete snapshot",
      postSnapshotCandidateSwapped &&
        postSnapshotCandidateRejected &&
        fs.existsSync(postSnapshotCandidate) &&
        fs.existsSync(postSnapshotTarget) === false,
    );
    fs.rmSync(postSnapshotCandidate, { recursive: true, force: true });

    const receiptCompetitorTarget = path.join(
      proxyPublishParent,
      "receipt-competitor",
    );
    let receiptCompetitorInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        receiptCompetitorInserted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) ===
          path.join(receiptCompetitorTarget, "publication.json") &&
        flags === "wx+"
      ) {
        nativeWriteFile(file, proxyPublishFiles.get("publication.json")!);
        receiptCompetitorInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [file, flags, ...args]);
    }) as typeof fs.openSync;
    let receiptCompetitorRejected = false;
    try {
      receiptCompetitorRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: receiptCompetitorTarget,
        }),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "proxy cleanup preserves a byte-identical competing receipt",
      receiptCompetitorInserted &&
        receiptCompetitorRejected &&
        fs
          .readFileSync(path.join(receiptCompetitorTarget, "publication.json"))
          .equals(proxyPublishFiles.get("publication.json")!) &&
        fs.existsSync(
          path.join(receiptCompetitorTarget, ".publication-claim.json"),
        ),
    );
    fs.rmSync(receiptCompetitorTarget, { recursive: true, force: true });

    const crashRecoveryTarget = path.join(proxyPublishParent, "crash-recovery");
    fs.mkdirSync(path.join(crashRecoveryTarget, "feature"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(crashRecoveryTarget, "feature", "feature.mp4"),
      proxyPublishFiles.get("feature/feature.mp4")!,
    );
    const crashExpectedFacts = [...proxyPublishFiles]
      .map(
        ([relative, bytes]) =>
          [
            relative,
            { bytes: bytes.length, digest: fixtureDigest(bytes) },
          ] as const,
      )
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    fs.writeFileSync(
      path.join(crashRecoveryTarget, ".publication-claim.json"),
      `${JSON.stringify({
        version: 1,
        expected: fixtureDigest(
          Buffer.from(JSON.stringify(crashExpectedFacts)),
        ),
        pid: 919191,
        token: "11111111-1111-4111-8111-111111111111",
      })}\n`,
    );
    const recoveredCrashPublication = proxyPublisherModule.publishProxyBundle({
      expected: proxyPublishFiles,
      parent: proxyPublishParent,
      processAlive: () => false,
      renderRoot: proxyPublishRoot,
      target: crashRecoveryTarget,
    });
    TestValidator.predicate(
      "proxy publisher recovers an exact dead-owner partial publication",
      recoveredCrashPublication.reused === false &&
        fs.existsSync(
          path.join(crashRecoveryTarget, ".publication-claim.json"),
        ) === false &&
        !throws(() =>
          proxyModule.assertPublishedProxyBundle(
            crashRecoveryTarget,
            proxyPublishFiles,
          ),
        ),
    );

    const publishScaleFixture = (name: string, count: number): number => {
      const target = path.join(proxyPublishParent, name);
      const entries = new Map<string, Uint8Array>([
        ["publication.json", Buffer.from(`{"count":${count}}\n`)],
        ...Array.from(
          { length: count },
          (_, index) =>
            [
              `frames/${String(index).padStart(4, "0")}.png`,
              Buffer.from(`frame-${index}`),
            ] as const,
        ),
      ]);
      let observations = 0;
      mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
        if (
          path
            .resolve(file.toString())
            .startsWith(`${path.resolve(proxyPublishParent)}${path.sep}`)
        )
          observations++;
        return Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      }) as typeof fs.lstatSync;
      try {
        proxyPublisherModule.publishProxyBundle({
          expected: entries,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target,
        });
      } finally {
        mutableFs.lstatSync = nativeLstat;
      }
      return observations;
    };
    const smallProxyPublicationWork = publishScaleFixture("scale-8", 8);
    const largeProxyPublicationWork = publishScaleFixture("scale-32", 32);
    TestValidator.predicate(
      "proxy publication inventory work scales linearly with bundle entries",
      largeProxyPublicationWork <= smallProxyPublicationWork * 6,
    );
    const proxyMedia = path.join(proxy, "media", "proxy.mp4");
    const parkedProxyMedia = `${proxyMedia}.parked`;
    let proxyMediaSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        proxyMediaSwapped === false &&
        path.resolve(file.toString()) === proxyMedia
      ) {
        fs.renameSync(proxyMedia, parkedProxyMedia);
        fs.writeFileSync(proxyMedia, proxyFiles.get("media/proxy.mp4")!);
        proxyMediaSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let proxyRaceRejected = false;
    try {
      proxyRaceRejected = throws(() =>
        proxyModule.assertPublishedProxyBundle(proxy, proxyFiles),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedProxyMedia)) {
        fs.rmSync(proxyMedia, { force: true });
        fs.renameSync(parkedProxyMedia, proxyMedia);
      }
    }
    TestValidator.predicate(
      "proxy verification rejects a byte-identical successor after inventory",
      proxyMediaSwapped && proxyRaceRejected,
    );
    const proxyMediaDirectory = path.dirname(proxyMedia);
    const parkedProxyMediaDirectory = path.join(
      base,
      "proxy-media-directory-parked",
    );
    const successorProxyMediaDirectory = path.join(
      base,
      "proxy-media-directory-successor",
    );
    fs.mkdirSync(successorProxyMediaDirectory);
    fs.linkSync(
      proxyMedia,
      path.join(successorProxyMediaDirectory, path.basename(proxyMedia)),
    );
    let proxyMediaObservations = 0;
    let proxyDirectorySwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (path.resolve(file.toString()) === proxyMedia) {
        proxyMediaObservations++;
        if (proxyMediaObservations === 2) {
          fs.renameSync(proxyMediaDirectory, parkedProxyMediaDirectory);
          fs.renameSync(successorProxyMediaDirectory, proxyMediaDirectory);
          proxyDirectorySwapped = true;
        }
      }
      return status;
    }) as typeof fs.lstatSync;
    let proxyDirectoryRaceRejected = false;
    try {
      proxyDirectoryRaceRejected = throws(() =>
        proxyModule.assertPublishedProxyBundle(proxy, proxyFiles),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedProxyMediaDirectory)) {
        fs.rmSync(proxyMediaDirectory, { recursive: true, force: true });
        fs.renameSync(parkedProxyMediaDirectory, proxyMediaDirectory);
      }
      fs.rmSync(successorProxyMediaDirectory, {
        recursive: true,
        force: true,
      });
    }
    TestValidator.predicate(
      "proxy verification rejects a hard-linked directory successor",
      proxyDirectorySwapped && proxyDirectoryRaceRejected,
    );
    const lateProxyFile = path.join(proxyMediaDirectory, "late.bin");
    proxyMediaObservations = 0;
    let proxyInventoryMutated = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (path.resolve(file.toString()) === proxyMedia) {
        proxyMediaObservations++;
        if (proxyMediaObservations === 2) {
          fs.writeFileSync(lateProxyFile, "late inventory");
          proxyInventoryMutated = true;
        }
      }
      return status;
    }) as typeof fs.lstatSync;
    let proxyInventoryRaceRejected = false;
    try {
      proxyInventoryRaceRejected = throws(() =>
        proxyModule.assertPublishedProxyBundle(proxy, proxyFiles),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      fs.rmSync(lateProxyFile, { force: true });
    }
    TestValidator.predicate(
      "proxy verification rejects a late unexpected inventory entry",
      proxyInventoryMutated && proxyInventoryRaceRejected,
    );

    const fixtureDigest = (bytes: Uint8Array): string =>
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const verifiedProxyRoot = path.join(base, "verified-proxy-root");
    const verifiedProxyPublication = fixtureDigest(
      Buffer.from("verified proxy publication"),
    );
    const verifiedProxyCompile = fixtureDigest(
      Buffer.from("verified proxy compile"),
    );
    const verifiedProxyEdit = fixtureDigest(Buffer.from("verified proxy edit"));
    const verifiedProxyBundleRelative = `deliverables/proxy/${verifiedProxyPublication.slice(7)}`;
    const verifiedProxyBundle = path.join(
      verifiedProxyRoot,
      ...verifiedProxyBundleRelative.split("/"),
    );
    const verifiedProxyPayload = path.join(
      verifiedProxyBundle,
      "feature",
      "feature.mp4",
    );
    const verifiedProxyPayloadBytes = Buffer.from("reviewed proxy payload");
    const proxyReceipt = (props: {
      fileBytes?: number;
      filePath?: string;
      malformedDeliverable?: boolean;
      publicationFingerprint: string;
      rendition?: "invalid" | "valid";
      withPayload?: boolean;
    }) => ({
      version: 1,
      tier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
      publicationFingerprint: props.publicationFingerprint,
      compileFingerprint: verifiedProxyCompile,
      editFingerprint: verifiedProxyEdit,
      frameFormat: { width: 640, height: 360, fps: 12 },
      sourceFrameFormat: { width: 1280, height: 720, fps: 24 },
      totalFrames: 12,
      manifest: {
        version: 1,
        compileFingerprint: verifiedProxyCompile,
        deliverables:
          props.withPayload === false
            ? []
            : [
                props.malformedDeliverable === true
                  ? {
                      files: [
                        {
                          path:
                            props.filePath ??
                            `${verifiedProxyBundleRelative}/feature/feature.mp4`,
                          digest: fixtureDigest(verifiedProxyPayloadBytes),
                          bytes:
                            props.fileBytes ?? verifiedProxyPayloadBytes.length,
                          mediaType: "video/mp4",
                        },
                      ],
                    }
                  : {
                      id: "feature",
                      kind: "feature",
                      files: [
                        {
                          path:
                            props.filePath ??
                            `${verifiedProxyBundleRelative}/feature/feature.mp4`,
                          digest: fixtureDigest(verifiedProxyPayloadBytes),
                          bytes:
                            props.fileBytes ?? verifiedProxyPayloadBytes.length,
                          mediaType: "video/mp4",
                        },
                      ],
                      runtimeSeconds: 1,
                      frameCount: 12,
                      codec: "h264",
                      ...(props.rendition === undefined
                        ? {}
                        : {
                            rendition: {
                              kind: "repainted",
                              shots: [
                                {
                                  shot: "opening",
                                  path: "renditions/opening.mp4",
                                  digest: verifiedProxyCompile,
                                  receiptDigest: verifiedProxyEdit,
                                  sourceReviewFingerprint: verifiedProxyCompile,
                                  renditionReviewFingerprint: verifiedProxyEdit,
                                },
                              ],
                              aggregateReviews: [
                                props.rendition === "valid"
                                  ? {
                                      kind: "film",
                                      id: "feature",
                                      fingerprint: verifiedProxyCompile,
                                    }
                                  : {
                                      kind: "scene",
                                      id: "feature",
                                    },
                              ],
                            },
                          }),
                    },
              ],
      },
    });
    fs.mkdirSync(path.dirname(verifiedProxyPayload), { recursive: true });
    fs.writeFileSync(verifiedProxyPayload, verifiedProxyPayloadBytes);
    fs.writeFileSync(
      path.join(verifiedProxyBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          publicationFingerprint: verifiedProxyPublication,
          rendition: "valid",
        }),
      )}\n`,
    );
    const inspectedProxy = proxyModule.inspectPublishedProxyBundle(
      verifiedProxyRoot,
      verifiedProxyBundle,
    );
    TestValidator.predicate(
      "the final proxy consumer accepts one exact manifest-backed bundle",
      inspectedProxy.tier.kind === "proxy" &&
        inspectedProxy.publicationFingerprint === verifiedProxyPublication &&
        inspectedProxy.compileFingerprint === verifiedProxyCompile &&
        inspectedProxy.editFingerprint === verifiedProxyEdit,
    );

    const sameLengthProxyMutation = Buffer.from(verifiedProxyPayloadBytes);
    sameLengthProxyMutation[0] ^= 1;
    fs.writeFileSync(verifiedProxyPayload, sameLengthProxyMutation);
    const mutatedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        verifiedProxyBundle,
      ),
    );
    fs.writeFileSync(verifiedProxyPayload, verifiedProxyPayloadBytes);
    fs.rmSync(verifiedProxyPayload);
    const deletedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        verifiedProxyBundle,
      ),
    );
    fs.writeFileSync(verifiedProxyPayload, verifiedProxyPayloadBytes);
    TestValidator.predicate(
      "the final proxy consumer rejects mutated and deleted payloads",
      mutatedProxyRejected && deletedProxyRejected,
    );

    const unmanifestedProxyFile = path.join(
      verifiedProxyBundle,
      "feature",
      "extra.bin",
    );
    fs.writeFileSync(unmanifestedProxyFile, "unmanifested bytes");
    const unmanifestedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        verifiedProxyBundle,
      ),
    );
    fs.rmSync(unmanifestedProxyFile);

    const receiptOnlyPublication = fixtureDigest(
      Buffer.from("receipt only proxy"),
    );
    const receiptOnlyBundle = path.join(
      verifiedProxyRoot,
      "deliverables",
      "proxy",
      receiptOnlyPublication.slice(7),
    );
    fs.mkdirSync(receiptOnlyBundle);
    fs.writeFileSync(
      path.join(receiptOnlyBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          publicationFingerprint: receiptOnlyPublication,
          withPayload: false,
        }),
      )}\n`,
    );
    const receiptOnlyProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        receiptOnlyBundle,
      ),
    );

    const escapingPublication = fixtureDigest(Buffer.from("escaping proxy"));
    const escapingBundleRelative = `deliverables/proxy/${escapingPublication.slice(7)}`;
    const escapingBundle = path.join(
      verifiedProxyRoot,
      ...escapingBundleRelative.split("/"),
    );
    fs.mkdirSync(escapingBundle);
    fs.writeFileSync(
      path.join(escapingBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          filePath: `${escapingBundleRelative}/../escape.mp4`,
          publicationFingerprint: escapingPublication,
        }),
      )}\n`,
    );
    const escapingProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        escapingBundle,
      ),
    );

    const malformedPublication = fixtureDigest(Buffer.from("malformed proxy"));
    const malformedBundleRelative = `deliverables/proxy/${malformedPublication.slice(7)}`;
    const malformedBundle = path.join(
      verifiedProxyRoot,
      ...malformedBundleRelative.split("/"),
    );
    fs.mkdirSync(malformedBundle);
    fs.writeFileSync(
      path.join(malformedBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          fileBytes: 0,
          filePath: `${malformedBundleRelative}/feature/feature.mp4`,
          publicationFingerprint: malformedPublication,
        }),
      )}\n`,
    );
    const malformedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        malformedBundle,
      ),
    );

    const duplicatePublication = fixtureDigest(Buffer.from("duplicate proxy"));
    const duplicateBundleRelative = `deliverables/proxy/${duplicatePublication.slice(7)}`;
    const duplicateBundle = path.join(
      verifiedProxyRoot,
      ...duplicateBundleRelative.split("/"),
    );
    const duplicatePayload = path.join(
      duplicateBundle,
      "feature",
      "feature.mp4",
    );
    fs.mkdirSync(path.dirname(duplicatePayload), { recursive: true });
    fs.writeFileSync(duplicatePayload, verifiedProxyPayloadBytes);
    const duplicateReceipt = proxyReceipt({
      filePath: `${duplicateBundleRelative}/feature/feature.mp4`,
      publicationFingerprint: duplicatePublication,
    });
    duplicateReceipt.manifest.deliverables.push(
      duplicateReceipt.manifest.deliverables[0]!,
    );
    fs.writeFileSync(
      path.join(duplicateBundle, "publication.json"),
      `${JSON.stringify(duplicateReceipt)}\n`,
    );
    const duplicateProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        duplicateBundle,
      ),
    );

    const malformedMetadataPublication = fixtureDigest(
      Buffer.from("malformed metadata proxy"),
    );
    const malformedMetadataBundleRelative = `deliverables/proxy/${malformedMetadataPublication.slice(7)}`;
    const malformedMetadataBundle = path.join(
      verifiedProxyRoot,
      ...malformedMetadataBundleRelative.split("/"),
    );
    const malformedMetadataPayload = path.join(
      malformedMetadataBundle,
      "feature",
      "feature.mp4",
    );
    fs.mkdirSync(path.dirname(malformedMetadataPayload), { recursive: true });
    fs.writeFileSync(malformedMetadataPayload, verifiedProxyPayloadBytes);
    fs.writeFileSync(
      path.join(malformedMetadataBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          filePath: `${malformedMetadataBundleRelative}/feature/feature.mp4`,
          malformedDeliverable: true,
          publicationFingerprint: malformedMetadataPublication,
        }),
      )}\n`,
    );
    const malformedMetadataRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        malformedMetadataBundle,
      ),
    );

    const invalidRenditionPublication = fixtureDigest(
      Buffer.from("invalid rendition proxy"),
    );
    const invalidRenditionBundleRelative = `deliverables/proxy/${invalidRenditionPublication.slice(7)}`;
    const invalidRenditionBundle = path.join(
      verifiedProxyRoot,
      ...invalidRenditionBundleRelative.split("/"),
    );
    const invalidRenditionPayload = path.join(
      invalidRenditionBundle,
      "feature",
      "feature.mp4",
    );
    fs.mkdirSync(path.dirname(invalidRenditionPayload), { recursive: true });
    fs.writeFileSync(invalidRenditionPayload, verifiedProxyPayloadBytes);
    fs.writeFileSync(
      path.join(invalidRenditionBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          filePath: `${invalidRenditionBundleRelative}/feature/feature.mp4`,
          publicationFingerprint: invalidRenditionPublication,
          rendition: "invalid",
        }),
      )}\n`,
    );
    const invalidRenditionRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        invalidRenditionBundle,
      ),
    );
    TestValidator.predicate(
      "the final proxy consumer rejects unowned and malformed manifests",
      unmanifestedProxyRejected &&
        receiptOnlyProxyRejected &&
        escapingProxyRejected &&
        malformedProxyRejected &&
        duplicateProxyRejected &&
        malformedMetadataRejected &&
        invalidRenditionRejected,
    );

    const parkedVerifiedProxyBundle = `${verifiedProxyBundle}.parked`;
    const successorVerifiedProxyBundle = `${verifiedProxyBundle}.successor`;
    fs.cpSync(verifiedProxyBundle, successorVerifiedProxyBundle, {
      recursive: true,
    });
    let verifiedPayloadObservations = 0;
    let verifiedProxyTreeSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (path.resolve(file.toString()) === verifiedProxyPayload) {
        verifiedPayloadObservations++;
        if (verifiedPayloadObservations === 2) {
          fs.renameSync(verifiedProxyBundle, parkedVerifiedProxyBundle);
          fs.renameSync(successorVerifiedProxyBundle, verifiedProxyBundle);
          verifiedProxyTreeSwapped = true;
        }
      }
      return status;
    }) as typeof fs.lstatSync;
    let verifiedProxyTreeSuccessorRejected = false;
    try {
      verifiedProxyTreeSuccessorRejected = throws(() =>
        proxyModule.inspectPublishedProxyBundle(
          verifiedProxyRoot,
          verifiedProxyBundle,
        ),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedVerifiedProxyBundle)) {
        fs.rmSync(verifiedProxyBundle, { recursive: true, force: true });
        fs.renameSync(parkedVerifiedProxyBundle, verifiedProxyBundle);
      }
      fs.rmSync(successorVerifiedProxyBundle, {
        recursive: true,
        force: true,
      });
    }
    TestValidator.predicate(
      "the final proxy consumer rejects a byte-identical tree successor",
      verifiedProxyTreeSwapped && verifiedProxyTreeSuccessorRejected,
    );
    const lateVerifiedProxyFile = path.join(
      verifiedProxyBundle,
      "late-after-read.bin",
    );
    const verifiedPayloadDescriptors = new Set<number>();
    let verifiedPayloadReadComplete = false;
    let verifiedProxyLateMutation = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === verifiedProxyPayload
      )
        verifiedPayloadDescriptors.add(descriptor);
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.readFileSync = ((file, ...args: unknown[]): unknown => {
      const bytes = Reflect.apply(nativeReadFile, mutableFs, [file, ...args]);
      if (typeof file === "number" && verifiedPayloadDescriptors.has(file))
        verifiedPayloadReadComplete = true;
      return bytes;
    }) as typeof fs.readFileSync;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        verifiedProxyLateMutation === false &&
        verifiedPayloadReadComplete &&
        path.resolve(directory.toString()) === verifiedProxyBundle
      ) {
        fs.writeFileSync(lateVerifiedProxyFile, "late after all reads");
        verifiedProxyLateMutation = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    let verifiedProxyLateMutationRejected = false;
    try {
      verifiedProxyLateMutationRejected = throws(() =>
        proxyModule.inspectPublishedProxyBundle(
          verifiedProxyRoot,
          verifiedProxyBundle,
        ),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
      mutableFs.readFileSync = nativeReadFile;
      mutableFs.readdirSync = nativeReaddir;
      fs.rmSync(lateVerifiedProxyFile, { force: true });
    }
    TestValidator.predicate(
      "the final proxy consumer revalidates exact inventory after all reads",
      verifiedProxyLateMutation && verifiedProxyLateMutationRejected,
    );
    const runtimePackage = path.join(base, "runtime-package");
    const runtimeManifest = path.join(runtimePackage, "package.json");
    const runtimeEntry = path.join(runtimePackage, "index.mjs");
    const runtimeAssets = path.join(runtimePackage, "native");
    const runtimeAsset = path.join(runtimeAssets, "runtime.node");
    const runtimeManifestBytes = Buffer.from(
      '{"name":"fixture-runtime","version":"1.2.3"}\n',
    );
    const runtimeEntryBytes = Buffer.from("export const fixture = true;\n");
    const runtimeAssetBytes = Buffer.from("native fixture bytes");
    fs.mkdirSync(runtimeAssets, { recursive: true });
    fs.writeFileSync(runtimeManifest, runtimeManifestBytes);
    fs.writeFileSync(runtimeEntry, runtimeEntryBytes);
    fs.writeFileSync(runtimeAsset, runtimeAssetBytes);
    const runtimePackageModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "runtimePackageSnapshot.ts"),
    ) as {
      snapshotRuntimePackage: (props: {
        assets?: ReadonlyArray<{
          kind: "file" | "tree";
          relative: string;
        }>;
        entry: string;
        packageName: string;
      }) => {
        assets: Array<{ digest: string; path: string }>;
        entryDigest: string;
        package: string;
        version: string;
      };
    };
    const snapshotRuntimeFixture = () =>
      runtimePackageModule.snapshotRuntimePackage({
        assets: [{ kind: "tree", relative: "native" }],
        entry: runtimeEntry,
        packageName: "fixture-runtime",
      });
    const runtimeSnapshot = snapshotRuntimeFixture();
    TestValidator.predicate(
      "runtime package identity captures exact manifest-owned entry and assets",
      runtimeSnapshot.package === "fixture-runtime" &&
        runtimeSnapshot.version === "1.2.3" &&
        runtimeSnapshot.entryDigest === fixtureDigest(runtimeEntryBytes) &&
        runtimeSnapshot.assets.length === 1 &&
        runtimeSnapshot.assets[0]?.path === "native/runtime.node" &&
        runtimeSnapshot.assets[0]?.digest === fixtureDigest(runtimeAssetBytes),
    );
    const parkedRuntimeManifest = `${runtimeManifest}.parked`;
    let runtimeManifestSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        runtimeManifestSwapped === false &&
        path.resolve(file.toString()) === runtimeManifest
      ) {
        fs.renameSync(runtimeManifest, parkedRuntimeManifest);
        fs.writeFileSync(runtimeManifest, runtimeManifestBytes);
        runtimeManifestSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let runtimeManifestRaceRejected = false;
    try {
      runtimeManifestRaceRejected = throws(snapshotRuntimeFixture);
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedRuntimeManifest)) {
        fs.rmSync(runtimeManifest, { force: true });
        fs.renameSync(parkedRuntimeManifest, runtimeManifest);
      }
    }
    TestValidator.predicate(
      "runtime package identity rejects a byte-identical manifest successor",
      runtimeManifestSwapped && runtimeManifestRaceRejected,
    );
    const parkedRuntimeEntry = `${runtimeEntry}.parked`;
    let runtimeEntrySwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        runtimeEntrySwapped === false &&
        path.resolve(file.toString()) === runtimeEntry
      ) {
        fs.renameSync(runtimeEntry, parkedRuntimeEntry);
        fs.writeFileSync(runtimeEntry, runtimeEntryBytes);
        runtimeEntrySwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let runtimeEntryRaceRejected = false;
    try {
      runtimeEntryRaceRejected = throws(snapshotRuntimeFixture);
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedRuntimeEntry)) {
        fs.rmSync(runtimeEntry, { force: true });
        fs.renameSync(parkedRuntimeEntry, runtimeEntry);
      }
    }
    TestValidator.predicate(
      "runtime package identity rejects a byte-identical entry successor",
      runtimeEntrySwapped && runtimeEntryRaceRejected,
    );
    const lateRuntimeAsset = path.join(runtimeAssets, "late.node");
    const runtimeNativeReaddir = mutableFs.readdirSync;
    let runtimeInventoryMutated = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(runtimeNativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        runtimeInventoryMutated === false &&
        path.resolve(directory.toString()) === runtimeAssets
      ) {
        fs.writeFileSync(lateRuntimeAsset, "late native asset");
        runtimeInventoryMutated = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    let runtimeInventoryRaceRejected = false;
    try {
      runtimeInventoryRaceRejected = throws(snapshotRuntimeFixture);
    } finally {
      mutableFs.readdirSync = runtimeNativeReaddir;
      fs.rmSync(lateRuntimeAsset, { force: true });
    }
    TestValidator.predicate(
      "runtime package identity rejects native asset inventory mutation",
      runtimeInventoryMutated && runtimeInventoryRaceRejected,
    );
    const captureExecutableModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "captureExecutableSnapshot.ts"),
    ) as {
      assertCaptureExecutable: (snapshot: {
        descriptor: number;
        digest: string;
        path: string;
      }) => void;
      closeCaptureExecutable: (snapshot: { descriptor: number }) => void;
      openCaptureExecutable: (file: string) => {
        descriptor: number;
        digest: string;
        path: string;
      };
    };
    const captureExecutable = path.join(base, "capture-executable.bin");
    const captureExecutableBytes = Buffer.from("capture executable bytes");
    fs.writeFileSync(captureExecutable, captureExecutableBytes);
    const captureSnapshot =
      captureExecutableModule.openCaptureExecutable(captureExecutable);
    let captureSnapshotAccepted = false;
    try {
      captureExecutableModule.assertCaptureExecutable(captureSnapshot);
      captureSnapshotAccepted =
        captureSnapshot.path === captureExecutable &&
        captureSnapshot.digest === fixtureDigest(captureExecutableBytes);
    } finally {
      captureExecutableModule.closeCaptureExecutable(captureSnapshot);
    }
    TestValidator.predicate(
      "capture executable snapshot preserves exact resident bytes and identity",
      captureSnapshotAccepted,
    );
    const parkedCaptureExecutable = `${captureExecutable}.parked`;
    let captureExecutableSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        captureExecutableSwapped === false &&
        path.resolve(file.toString()) === captureExecutable
      ) {
        fs.renameSync(captureExecutable, parkedCaptureExecutable);
        fs.writeFileSync(captureExecutable, captureExecutableBytes);
        captureExecutableSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let captureExecutableRaceRejected = false;
    try {
      captureExecutableRaceRejected = throws(() =>
        captureExecutableModule.openCaptureExecutable(captureExecutable),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedCaptureExecutable)) {
        fs.rmSync(captureExecutable, { force: true });
        fs.renameSync(parkedCaptureExecutable, captureExecutable);
      }
    }
    TestValidator.predicate(
      "capture executable snapshot rejects a byte-identical successor",
      captureExecutableSwapped && captureExecutableRaceRejected,
    );
    const captureBrowserModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "capture-browser.ts"),
    ) as {
      capturePlaywrightMetadata: (props: {
        corePackagePath: string;
        playwrightEntry: string;
      }) => {
        browser: { revision: string };
        cliDigest: string;
        packageVersion: string;
      };
      launchWithCaptureExecutableSnapshot: <Output>(props: {
        close: (output: Output) => Promise<void>;
        launch: (executablePath: string) => Promise<Output>;
        snapshot: unknown;
      }) => Promise<Output>;
      publishCaptureInstallReceipt: (
        projectRoot: string,
        receipt: unknown,
        assertCurrent: () => void,
      ) => void;
      readCaptureInstallReceipt: (projectRoot: string) => {
        browser: { revision: string };
        version: number;
      };
      runDescriptorBoundNodeCli: (props: {
        args: readonly string[];
        cliDigest: string;
        cliPath: string;
        cwd: string;
        env: NodeJS.ProcessEnv;
      }) => number | null;
    };
    const metadataRoot = path.join(base, "capture-metadata");
    const playwrightRoot = path.join(metadataRoot, "playwright");
    const playwrightEntry = path.join(playwrightRoot, "index.js");
    const playwrightCli = path.join(playwrightRoot, "cli.js");
    const coreRoot = path.join(metadataRoot, "playwright-core");
    const coreManifest = path.join(coreRoot, "package.json");
    const coreBrowsers = path.join(coreRoot, "browsers.json");
    const playwrightCliBytes = Buffer.from("module.exports = 'cli';\n");
    fs.mkdirSync(playwrightRoot, { recursive: true });
    fs.mkdirSync(coreRoot, { recursive: true });
    fs.writeFileSync(
      path.join(playwrightRoot, "package.json"),
      `${JSON.stringify({ name: "playwright", version: "1.2.3" })}\n`,
    );
    fs.writeFileSync(playwrightEntry, "module.exports = {};\n");
    fs.writeFileSync(playwrightCli, playwrightCliBytes);
    fs.writeFileSync(
      coreManifest,
      `${JSON.stringify({ name: "playwright-core", version: "1.2.3" })}\n`,
    );
    fs.writeFileSync(
      coreBrowsers,
      `${JSON.stringify({
        browsers: [
          {
            name: "chromium",
            revision: "123",
            browserVersion: "123.0.0",
          },
        ],
      })}\n`,
    );
    const metadataFixture = () =>
      captureBrowserModule.capturePlaywrightMetadata({
        corePackagePath: coreManifest,
        playwrightEntry,
      });
    const metadataSnapshot = metadataFixture();
    TestValidator.predicate(
      "capture metadata revalidates Playwright, core, browsers and CLI together",
      metadataSnapshot.packageVersion === "1.2.3" &&
        metadataSnapshot.browser.revision === "123" &&
        metadataSnapshot.cliDigest === fixtureDigest(playwrightCliBytes),
    );
    const parkedPlaywrightCli = `${playwrightCli}.parked`;
    let compositeMetadataSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        compositeMetadataSwapped === false &&
        path.resolve(file.toString()) === coreManifest
      ) {
        fs.renameSync(playwrightCli, parkedPlaywrightCli);
        fs.writeFileSync(playwrightCli, playwrightCliBytes);
        compositeMetadataSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let compositeMetadataRaceRejected = false;
    try {
      compositeMetadataRaceRejected = throws(metadataFixture);
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedPlaywrightCli)) {
        fs.rmSync(playwrightCli, { force: true });
        fs.renameSync(parkedPlaywrightCli, playwrightCli);
      }
    }
    TestValidator.predicate(
      "capture metadata rejects a CLI successor between package snapshots",
      compositeMetadataSwapped && compositeMetadataRaceRejected,
    );
    const coreBrowserBytes = fs.readFileSync(coreBrowsers);
    const parkedCoreBrowsers = `${coreBrowsers}.parked`;
    let coreBrowsersSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        coreBrowsersSwapped === false &&
        path.resolve(file.toString()) === coreBrowsers
      ) {
        fs.renameSync(coreBrowsers, parkedCoreBrowsers);
        fs.writeFileSync(coreBrowsers, coreBrowserBytes);
        coreBrowsersSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let coreBrowsersRaceRejected = false;
    try {
      coreBrowsersRaceRejected = throws(metadataFixture);
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedCoreBrowsers)) {
        fs.rmSync(coreBrowsers, { force: true });
        fs.renameSync(parkedCoreBrowsers, coreBrowsers);
      }
    }
    TestValidator.predicate(
      "capture metadata rejects a core browsers successor while captured",
      coreBrowsersSwapped && coreBrowsersRaceRejected,
    );
    const descriptorCli = path.join(base, "descriptor-cli.cjs");
    const descriptorCliMarker = path.join(base, "descriptor-cli.marker");
    const descriptorCliBytes = Buffer.from(
      [
        'const fs = require("node:fs");',
        'if (process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") process.exit(17);',
        'fs.writeFileSync(process.argv[2], "captured-cli");',
      ].join("\n"),
    );
    fs.writeFileSync(descriptorCli, descriptorCliBytes);
    const descriptorCliStatus = captureBrowserModule.runDescriptorBoundNodeCli({
      args: [descriptorCliMarker],
      cliDigest: fixtureDigest(descriptorCliBytes),
      cliPath: descriptorCli,
      cwd: base,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
    });
    TestValidator.predicate(
      "capture install executes exact CLI bytes with package-local browser storage",
      descriptorCliStatus === 0 &&
        fs.readFileSync(descriptorCliMarker, "utf8") === "captured-cli",
    );
    const descriptorCliParked = `${descriptorCli}.parked`;
    const descriptorBoundaryBytes = Buffer.from(
      [
        'const fs = require("node:fs");',
        "fs.renameSync(__filename, `${__filename}.parked`);",
        `fs.writeFileSync(__filename, ${JSON.stringify("process.exit(29);\n")});`,
        'fs.writeFileSync(process.argv[2], "captured-cli");',
      ].join("\n"),
    );
    fs.writeFileSync(descriptorCli, descriptorBoundaryBytes);
    fs.rmSync(descriptorCliMarker, { force: true });
    const descriptorBoundaryRejected = throws(() =>
      captureBrowserModule.runDescriptorBoundNodeCli({
        args: [descriptorCliMarker],
        cliDigest: fixtureDigest(descriptorBoundaryBytes),
        cliPath: descriptorCli,
        cwd: base,
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
      }),
    );
    TestValidator.predicate(
      "capture install runs captured CLI bytes and rejects its pathname successor",
      descriptorBoundaryRejected &&
        fs.readFileSync(descriptorCliMarker, "utf8") === "captured-cli" &&
        fs.existsSync(descriptorCliParked),
    );
    fs.rmSync(descriptorCli, { force: true });
    fs.renameSync(descriptorCliParked, descriptorCli);
    const launchExecutable = path.join(base, "launch-executable.bin");
    fs.writeFileSync(launchExecutable, captureExecutableBytes);
    const launchSnapshot =
      captureExecutableModule.openCaptureExecutable(launchExecutable);
    const launchedPath =
      await captureBrowserModule.launchWithCaptureExecutableSnapshot({
        snapshot: launchSnapshot,
        launch: async (executablePath) => executablePath,
        close: async () => undefined,
      });
    captureExecutableModule.closeCaptureExecutable(launchSnapshot);
    TestValidator.predicate(
      "capture launch accepts one unchanged executable snapshot",
      launchedPath === launchExecutable,
    );
    const launchBoundarySnapshot =
      captureExecutableModule.openCaptureExecutable(launchExecutable);
    const parkedLaunchExecutable = `${launchExecutable}.parked`;
    let rejectedLaunchClosed = false;
    let launchBoundaryRejected = false;
    try {
      await captureBrowserModule.launchWithCaptureExecutableSnapshot({
        snapshot: launchBoundarySnapshot,
        launch: async () => {
          fs.renameSync(launchExecutable, parkedLaunchExecutable);
          fs.writeFileSync(launchExecutable, captureExecutableBytes);
          return "opened";
        },
        close: async () => {
          rejectedLaunchClosed = true;
        },
      });
    } catch {
      launchBoundaryRejected = true;
    } finally {
      captureExecutableModule.closeCaptureExecutable(launchBoundarySnapshot);
      fs.rmSync(launchExecutable, { force: true });
      fs.renameSync(parkedLaunchExecutable, launchExecutable);
    }
    TestValidator.predicate(
      "capture launch closes and rejects an executable successor during launch",
      launchBoundaryRejected && rejectedLaunchClosed,
    );
    const captureProject = path.join(base, "capture-project");
    const captureReceipt = path.join(
      captureProject,
      ".automovie",
      "capture",
      "install-receipt.json",
    );
    const captureReceiptValue = {
      version: 1,
      playwright: { package: "playwright", version: "1.2.3" },
      browser: {
        product: "chromium",
        revision: "123",
        version: "123.0.0",
        executablePath: captureExecutable,
        executableDigest: fixtureDigest(captureExecutableBytes),
      },
      installSource: "playwright-cdn",
    } as const;
    const captureReceiptBytes = Buffer.from(
      `${JSON.stringify(captureReceiptValue)}\n`,
    );
    fs.mkdirSync(path.dirname(captureReceipt), { recursive: true });
    fs.writeFileSync(captureReceipt, captureReceiptBytes);
    TestValidator.predicate(
      "capture install receipt is read through project-owned bytes",
      captureBrowserModule.readCaptureInstallReceipt(captureProject).version ===
        1,
    );
    const parkedCaptureReceipt = `${captureReceipt}.parked`;
    let captureReceiptSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        captureReceiptSwapped === false &&
        path.resolve(file.toString()) === captureReceipt
      ) {
        fs.renameSync(captureReceipt, parkedCaptureReceipt);
        fs.writeFileSync(captureReceipt, captureReceiptBytes);
        captureReceiptSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let captureReceiptRaceRejected = false;
    try {
      captureReceiptRaceRejected = throws(() =>
        captureBrowserModule.readCaptureInstallReceipt(captureProject),
      );
    } finally {
      mutableFs.lstatSync = nativeLstat;
      if (fs.existsSync(parkedCaptureReceipt)) {
        fs.rmSync(captureReceipt, { force: true });
        fs.renameSync(parkedCaptureReceipt, captureReceipt);
      }
    }
    TestValidator.predicate(
      "capture install receipt rejects a byte-identical successor",
      captureReceiptSwapped && captureReceiptRaceRejected,
    );
    const nextCaptureReceipt = {
      ...captureReceiptValue,
      browser: { ...captureReceiptValue.browser, revision: "456" },
    };
    const failedReceiptPublication = throws(() =>
      captureBrowserModule.publishCaptureInstallReceipt(
        captureProject,
        nextCaptureReceipt,
        () => {
          throw new Error("provenance changed");
        },
      ),
    );
    TestValidator.predicate(
      "capture install preserves the prior receipt when final validation fails",
      failedReceiptPublication &&
        fs.readFileSync(captureReceipt).equals(captureReceiptBytes) &&
        fs
          .readdirSync(path.dirname(captureReceipt))
          .every((name) => name.endsWith(".tmp") === false),
    );
    const receiptBeforeTempMutation = fs.readFileSync(captureReceipt);
    let createdReceiptDescriptor: number | null = null;
    let createdReceiptTemporary = "";
    let parkedCreatedReceipt = "";
    let createdReceiptSwapped = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.dirname(path.resolve(file.toString())) ===
          path.dirname(captureReceipt)
      ) {
        createdReceiptDescriptor = descriptor;
        createdReceiptTemporary = path.resolve(file.toString());
      }
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fsyncSync = ((descriptor) => {
      nativeFsync(descriptor);
      if (
        createdReceiptSwapped === false &&
        descriptor === createdReceiptDescriptor
      ) {
        createdReceiptSwapped = true;
        parkedCreatedReceipt = `${createdReceiptTemporary}.parked`;
        fs.renameSync(createdReceiptTemporary, parkedCreatedReceipt);
        nativeWriteFile(
          createdReceiptTemporary,
          `${JSON.stringify(nextCaptureReceipt, null, 2)}\n`,
        );
      }
    }) as typeof fs.fsyncSync;
    let createdReceiptSuccessorRejected = false;
    try {
      createdReceiptSuccessorRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          captureProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
      mutableFs.fsyncSync = nativeFsync;
    }
    TestValidator.predicate(
      "capture install rejects a successor before staged descriptor capture",
      createdReceiptSwapped &&
        createdReceiptSuccessorRejected &&
        fs.existsSync(createdReceiptTemporary) &&
        fs.existsSync(parkedCreatedReceipt) &&
        fs.readFileSync(captureReceipt).equals(receiptBeforeTempMutation),
    );
    fs.rmSync(createdReceiptTemporary, { force: true });
    fs.rmSync(parkedCreatedReceipt, { force: true });
    let receiptTemporaryMutated = false;
    const mutatedReceiptTemporaryRejected = throws(() =>
      captureBrowserModule.publishCaptureInstallReceipt(
        captureProject,
        nextCaptureReceipt,
        () => {
          const temporary = fs
            .readdirSync(path.dirname(captureReceipt))
            .find((name) => name.endsWith(".tmp"));
          if (temporary === undefined)
            throw new Error("missing staged receipt");
          fs.writeFileSync(
            path.join(path.dirname(captureReceipt), temporary),
            "mutated receipt bytes",
          );
          receiptTemporaryMutated = true;
        },
      ),
    );
    TestValidator.predicate(
      "capture install rejects in-place temporary receipt mutation",
      receiptTemporaryMutated &&
        mutatedReceiptTemporaryRejected &&
        fs.readFileSync(captureReceipt).equals(receiptBeforeTempMutation) &&
        fs
          .readdirSync(path.dirname(captureReceipt))
          .every((name) => name.endsWith(".tmp") === false),
    );
    let receiptTemporarySucceeded = false;
    let receiptTemporarySuccessor = "";
    let receiptTemporaryOriginal = "";
    const receiptTemporarySuccessorRejected = throws(() =>
      captureBrowserModule.publishCaptureInstallReceipt(
        captureProject,
        nextCaptureReceipt,
        () => {
          const temporary = fs
            .readdirSync(path.dirname(captureReceipt))
            .find((name) => name.endsWith(".tmp"));
          if (temporary === undefined)
            throw new Error("missing staged receipt");
          receiptTemporarySuccessor = path.join(
            path.dirname(captureReceipt),
            temporary,
          );
          receiptTemporaryOriginal = `${receiptTemporarySuccessor}.parked`;
          fs.renameSync(receiptTemporarySuccessor, receiptTemporaryOriginal);
          fs.writeFileSync(
            receiptTemporarySuccessor,
            `${JSON.stringify(nextCaptureReceipt, null, 2)}\n`,
          );
          receiptTemporarySucceeded = true;
        },
      ),
    );
    TestValidator.predicate(
      "capture install preserves a same-root temporary receipt successor",
      receiptTemporarySucceeded &&
        receiptTemporarySuccessorRejected &&
        fs.existsSync(receiptTemporarySuccessor) &&
        fs.existsSync(receiptTemporaryOriginal) &&
        fs.readFileSync(captureReceipt).equals(receiptBeforeTempMutation),
    );
    fs.rmSync(receiptTemporarySuccessor, { force: true });
    fs.rmSync(receiptTemporaryOriginal, { force: true });
    let receiptPublicationValidated = false;
    captureBrowserModule.publishCaptureInstallReceipt(
      captureProject,
      nextCaptureReceipt,
      () => {
        receiptPublicationValidated = true;
      },
    );
    TestValidator.predicate(
      "capture install publishes only after its final provenance validation",
      receiptPublicationValidated &&
        captureBrowserModule.readCaptureInstallReceipt(captureProject).browser
          .revision === "456",
    );
    const linkedReceiptProject = path.join(base, "linked-receipt-project");
    const linkedReceiptOutside = path.join(base, "linked-receipt-outside");
    const linkedReceiptMarker = path.join(linkedReceiptOutside, "marker.txt");
    fs.mkdirSync(linkedReceiptProject);
    fs.mkdirSync(linkedReceiptOutside);
    fs.writeFileSync(linkedReceiptMarker, "outside");
    fs.symlinkSync(
      linkedReceiptOutside,
      path.join(linkedReceiptProject, ".automovie"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedReceiptRejected = throws(() =>
      captureBrowserModule.publishCaptureInstallReceipt(
        linkedReceiptProject,
        nextCaptureReceipt,
        () => undefined,
      ),
    );
    TestValidator.predicate(
      "capture install refuses a linked receipt ancestry before external writes",
      linkedReceiptRejected &&
        fs.readFileSync(linkedReceiptMarker, "utf8") === "outside" &&
        fs.existsSync(
          path.join(linkedReceiptOutside, "capture", "install-receipt.json"),
        ) === false,
    );
    const segmentReceiptProject = path.join(base, "segment-receipt-project");
    const segmentReceiptOutside = path.join(base, "segment-receipt-outside");
    const segmentAutomovie = path.join(segmentReceiptProject, ".automovie");
    const parkedSegmentAutomovie = `${segmentAutomovie}.parked`;
    fs.mkdirSync(segmentReceiptProject);
    fs.mkdirSync(segmentReceiptOutside);
    let receiptSegmentSwapped = false;
    mutableFs.statSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeStat, mutableFs, [file, ...args]);
      if (
        receiptSegmentSwapped === false &&
        path.resolve(file.toString()) === segmentAutomovie
      ) {
        receiptSegmentSwapped = true;
        fs.renameSync(segmentAutomovie, parkedSegmentAutomovie);
        fs.symlinkSync(
          segmentReceiptOutside,
          segmentAutomovie,
          process.platform === "win32" ? "junction" : "dir",
        );
      }
      return status;
    }) as typeof fs.statSync;
    let receiptSegmentRaceRejected = false;
    try {
      receiptSegmentRaceRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          segmentReceiptProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } finally {
      mutableFs.statSync = nativeStat;
    }
    TestValidator.predicate(
      "capture install revalidates each created segment before the next write",
      receiptSegmentSwapped &&
        receiptSegmentRaceRejected &&
        fs.existsSync(path.join(segmentReceiptOutside, "capture")) === false,
    );
    fs.rmSync(segmentAutomovie, { force: true });
    fs.renameSync(parkedSegmentAutomovie, segmentAutomovie);
    const publishedReceiptBytes = fs.readFileSync(captureReceipt);
    const parkedCaptureProject = `${captureProject}.parked`;
    let receiptRootSwapped = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        receiptRootSwapped === false &&
        typeof file !== "number" &&
        path.dirname(path.resolve(file.toString())) ===
          path.dirname(captureReceipt) &&
        path.basename(file.toString()).startsWith("install-receipt.json.") &&
        path.basename(file.toString()).endsWith(".tmp")
      ) {
        receiptRootSwapped = true;
        fs.renameSync(captureProject, parkedCaptureProject);
        fs.mkdirSync(path.dirname(captureReceipt), { recursive: true });
        nativeWriteFile(captureReceipt, publishedReceiptBytes);
      }
      return descriptor;
    }) as typeof fs.openSync;
    let receiptRootRaceRejected = false;
    try {
      receiptRootRaceRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          captureProject,
          captureReceiptValue,
          () => undefined,
        ),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "capture install rejects a project root successor without cleaning it",
      receiptRootSwapped &&
        receiptRootRaceRejected &&
        fs.readFileSync(captureReceipt).equals(publishedReceiptBytes) &&
        fs
          .readdirSync(path.join(parkedCaptureProject, ".automovie", "capture"))
          .some((name) => name.endsWith(".tmp")),
    );
    fs.rmSync(captureProject, { recursive: true, force: true });
    fs.renameSync(parkedCaptureProject, captureProject);
    for (const name of fs.readdirSync(path.dirname(captureReceipt)))
      if (name.endsWith(".tmp"))
        fs.rmSync(path.join(path.dirname(captureReceipt), name), {
          force: true,
        });
    const renderLivenessModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderLiveness.ts"),
    ) as {
      acquireRenderGcLease: (props: {
        coordinationRoot: string;
        pid: number;
        processAlive: (pid: number) => boolean;
        scope: string;
      }) => unknown;
      acquireRenderSessionLease: (props: {
        coordinationRoot: string;
        pid: number;
        processAlive: (pid: number) => boolean;
        scope: string;
        tier: "final" | "proxy";
      }) => unknown;
      releaseRenderLivenessLease: (lease: unknown) => boolean;
    };
    const livenessRoot = path.join(base, "render-liveness");
    const livenessScope = "a".repeat(64);
    fs.mkdirSync(livenessRoot);
    let partialLeaseDescriptor: number | null = null;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.dirname(path.resolve(file.toString())) === livenessRoot
      )
        partialLeaseDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fsyncSync = ((descriptor) => {
      if (descriptor === partialLeaseDescriptor)
        throw new Error("fixture lease fsync failure");
      nativeFsync(descriptor);
    }) as typeof fs.fsyncSync;
    let partialLeaseRejected = false;
    try {
      partialLeaseRejected = throws(() =>
        renderLivenessModule.acquireRenderGcLease({
          coordinationRoot: livenessRoot,
          pid: 31000,
          processAlive: (pid) => pid === 31000,
          scope: livenessScope,
        }),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
      mutableFs.fsyncSync = nativeFsync;
    }
    TestValidator.predicate(
      "a failed descriptor-bound lease creation removes only its partial file",
      partialLeaseRejected && fs.readdirSync(livenessRoot).length === 0,
    );
    let interleavedGc: unknown;
    let workerOpenInterleaved = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        workerOpenInterleaved === false &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(file.toString()).includes(".session.")
      ) {
        workerOpenInterleaved = true;
        interleavedGc = renderLivenessModule.acquireRenderGcLease({
          coordinationRoot: livenessRoot,
          pid: 31009,
          processAlive: (pid) => pid === 31009 || pid === 31010,
          scope: livenessScope,
        });
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let interleavedWorkerRejected = false;
    try {
      interleavedWorkerRejected = throws(() =>
        renderLivenessModule.acquireRenderSessionLease({
          coordinationRoot: livenessRoot,
          pid: 31010,
          processAlive: (pid) => pid === 31009 || pid === 31010,
          scope: livenessScope,
          tier: "proxy",
        }),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
      if (interleavedGc !== undefined)
        renderLivenessModule.releaseRenderLivenessLease(interleavedGc);
    }
    TestValidator.predicate(
      "a worker rechecks a GC guard published after its first check",
      workerOpenInterleaved &&
        interleavedWorkerRejected &&
        fs.readdirSync(livenessRoot).length === 0,
    );
    let inventoryWorker: unknown;
    let inventoryWorkerRejected = false;
    let gcInventoryInterleaved = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        gcInventoryInterleaved === false &&
        path.resolve(directory.toString()) === livenessRoot
      ) {
        gcInventoryInterleaved = true;
        try {
          inventoryWorker = renderLivenessModule.acquireRenderSessionLease({
            coordinationRoot: livenessRoot,
            pid: 31014,
            processAlive: (pid) => pid === 31013 || pid === 31014,
            scope: livenessScope,
            tier: "final",
          });
        } catch {
          inventoryWorkerRejected = true;
        }
      }
      return entries;
    }) as typeof fs.readdirSync;
    let inventoryGc: unknown;
    try {
      inventoryGc = renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31013,
        processAlive: (pid) => pid === 31013 || pid === 31014,
        scope: livenessScope,
      });
    } finally {
      mutableFs.readdirSync = nativeReaddir;
    }
    if (inventoryGc !== undefined)
      renderLivenessModule.releaseRenderLivenessLease(inventoryGc);
    if (inventoryWorker !== undefined)
      renderLivenessModule.releaseRenderLivenessLease(inventoryWorker);
    TestValidator.predicate(
      "GC publishes its guard before the session inventory boundary",
      gcInventoryInterleaved &&
        inventoryWorkerRejected &&
        fs.readdirSync(livenessRoot).length === 0,
    );
    const gcFirstAlive = new Set([31001, 31002]);
    const gcFirst = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31001,
      processAlive: (pid) => gcFirstAlive.has(pid),
      scope: livenessScope,
    });
    const gcFirstWorkerRejected = throws(() =>
      renderLivenessModule.acquireRenderSessionLease({
        coordinationRoot: livenessRoot,
        pid: 31002,
        processAlive: (pid) => gcFirstAlive.has(pid),
        scope: livenessScope,
        tier: "proxy",
      }),
    );
    const gcFirstPeerRejected = throws(() =>
      renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31002,
        processAlive: (pid) => gcFirstAlive.has(pid),
        scope: livenessScope,
      }),
    );
    const gcFirstReleased =
      renderLivenessModule.releaseRenderLivenessLease(gcFirst);
    TestValidator.predicate(
      "a GC-first lease blocks a later render session",
      gcFirstWorkerRejected &&
        gcFirstPeerRejected &&
        gcFirstReleased &&
        fs.readdirSync(livenessRoot).length === 0,
    );
    const workerFirstAlive = new Set([31003, 31004]);
    const workerFirst = renderLivenessModule.acquireRenderSessionLease({
      coordinationRoot: livenessRoot,
      pid: 31003,
      processAlive: (pid) => workerFirstAlive.has(pid),
      scope: livenessScope,
      tier: "final",
    });
    const workerFirstGcRejected = throws(() =>
      renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31004,
        processAlive: (pid) => workerFirstAlive.has(pid),
        scope: livenessScope,
      }),
    );
    const workerFirstEntries = fs.readdirSync(livenessRoot);
    TestValidator.predicate(
      "a worker-first session makes GC release its guard and refuse apply",
      workerFirstGcRejected &&
        workerFirstEntries.length === 1 &&
        workerFirstEntries[0]!.includes(".session."),
    );
    renderLivenessModule.releaseRenderLivenessLease(workerFirst);
    const staleGc = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31005,
      processAlive: (pid) => pid === 31005,
      scope: livenessScope,
    });
    const afterStaleGc = renderLivenessModule.acquireRenderSessionLease({
      coordinationRoot: livenessRoot,
      pid: 31006,
      processAlive: (pid) => pid === 31006,
      scope: livenessScope,
      tier: "proxy",
    });
    const staleGcAlreadyRemoved =
      renderLivenessModule.releaseRenderLivenessLease(staleGc) === false;
    renderLivenessModule.releaseRenderLivenessLease(afterStaleGc);
    const staleSession = renderLivenessModule.acquireRenderSessionLease({
      coordinationRoot: livenessRoot,
      pid: 31007,
      processAlive: (pid) => pid === 31007,
      scope: livenessScope,
      tier: "final",
    });
    const afterStaleSession = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31008,
      processAlive: (pid) => pid === 31008,
      scope: livenessScope,
    });
    const staleSessionAlreadyRemoved =
      renderLivenessModule.releaseRenderLivenessLease(staleSession) === false;
    renderLivenessModule.releaseRenderLivenessLease(afterStaleSession);
    TestValidator.predicate(
      "dead GC and session owners are recovered through exact lease cleanup",
      staleGcAlreadyRemoved &&
        staleSessionAlreadyRemoved &&
        fs.readdirSync(livenessRoot).length === 0,
    );
    const staleSuccessorLease = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31015,
      processAlive: (pid) => pid === 31015,
      scope: livenessScope,
    });
    const staleSuccessorGuard = path.join(
      livenessRoot,
      fs
        .readdirSync(livenessRoot)
        .find((name) => name.includes(".gc-apply.lock"))!,
    );
    const staleSuccessorBytes = fs.readFileSync(staleSuccessorGuard);
    const staleOriginal = path.join(livenessRoot, "stale-gc-original.lock");
    const nativeLivenessRename = mutableFs.renameSync;
    let isolatedStaleSuccessor: string | null = null;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        isolatedStaleSuccessor === null &&
        path.resolve(oldPath.toString()) === staleSuccessorGuard
      ) {
        nativeLivenessRename(oldPath, staleOriginal);
        fs.writeFileSync(staleSuccessorGuard, staleSuccessorBytes);
        isolatedStaleSuccessor = path.resolve(newPath.toString());
      }
      nativeLivenessRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let staleSuccessorRejected = false;
    try {
      staleSuccessorRejected = throws(() =>
        renderLivenessModule.acquireRenderSessionLease({
          coordinationRoot: livenessRoot,
          pid: 31016,
          processAlive: (pid) => pid === 31016,
          scope: livenessScope,
          tier: "proxy",
        }),
      );
    } finally {
      mutableFs.renameSync = nativeLivenessRename;
    }
    const isolatedStaleSuccessorPath = isolatedStaleSuccessor as string | null;
    const staleSuccessorPreserved =
      isolatedStaleSuccessorPath !== null &&
      fs.existsSync(staleSuccessorGuard) === false &&
      fs.existsSync(staleOriginal) &&
      fs.readFileSync(isolatedStaleSuccessorPath).equals(staleSuccessorBytes) &&
      path
        .basename(path.dirname(isolatedStaleSuccessorPath))
        .includes(".preserved-");
    const staleSuccessorOriginalReleaseRefused =
      renderLivenessModule.releaseRenderLivenessLease(staleSuccessorLease) ===
      false;
    TestValidator.predicate(
      "stale guard cleanup preserves a pathname successor and refuses the worker",
      staleSuccessorRejected &&
        staleSuccessorPreserved &&
        staleSuccessorOriginalReleaseRefused,
    );
    fs.rmSync(staleOriginal);
    if (isolatedStaleSuccessorPath !== null) {
      fs.rmSync(isolatedStaleSuccessorPath);
      fs.rmdirSync(path.dirname(isolatedStaleSuccessorPath));
    }
    const malformedGuard = path.join(
      livenessRoot,
      `.automovie-liveness-${livenessScope}.gc-apply.lock`,
    );
    fs.writeFileSync(
      malformedGuard,
      `${JSON.stringify({ kind: "gc", pid: 31017, tier: null, token: 7 })}\n`,
    );
    const malformedGuardRejected = throws(() =>
      renderLivenessModule.acquireRenderSessionLease({
        coordinationRoot: livenessRoot,
        pid: 31018,
        processAlive: (pid) => pid === 31018,
        scope: livenessScope,
        tier: "final",
      }),
    );
    TestValidator.predicate(
      "malformed GC owner tokens fail closed without deleting the guard",
      malformedGuardRejected && fs.existsSync(malformedGuard),
    );
    fs.rmSync(malformedGuard);
    const renderGcModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderGcSnapshot.ts"),
    ) as {
      assertCapturedRenderGcFileEntry: (props: {
        directory: unknown;
        file: unknown;
        relative: string;
      }) => void;
      assertCapturedRenderTarget: (snapshot: unknown) => void;
      captureRenderGcTarget: (
        base: string,
        target: string,
      ) => { bytes: number; target: string };
      ensureRenderPhysicalDirectory: (base: string, relative: string) => string;
      isRenderGcPreservedPath: (relative: string) => boolean;
      quarantineCapturedRenderTarget: (props: {
        destination: string;
        isolated: string;
        quarantine: string;
        snapshot: unknown;
      }) => void;
      readCapturedRenderGcFile: (
        snapshot: unknown,
        maximumBytes: number,
      ) => Uint8Array;
      removeCapturedRenderGcTarget: (props: {
        isolated: string;
        quarantine: string;
        snapshot: unknown;
      }) => void;
    };
    const renderChunkSnapshotModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderChunkSnapshot.ts"),
    ) as {
      assertRenderChunkPublication: (publication: unknown) => void;
      captureRenderChunkPublication: (
        root: string,
        pointer: string,
      ) => { pointer: unknown; receipt: unknown; tree: { target: string } };
      captureRenderChunkPublicationFromPointer: (pointer: unknown) => {
        pointer: unknown;
        receipt: unknown;
        tree: { target: string };
      };
      consumeCurrentRenderChunkFrames: (
        current: {
          frames: Array<{
            bytes: Uint8Array;
            receipt: { globalFrame: number };
          }>;
        },
        consume: (frame: {
          bytes: Uint8Array;
          receipt: { globalFrame: number };
        }) => void,
      ) => void;
      currentRenderChunkPublicationProtectsTree: (props: {
        candidate: unknown;
        candidateName: string;
        capture: (chunk: { id: string; slot: string }) => {
          pointer: unknown;
          receipt: { chunk: string; slot: string };
          tree: { target: string };
        } | null;
        chunks: ReadonlyMap<string, { id: string; slot: string }>;
      }) => boolean;
      inventoryRenderChunkGarbage: (props: {
        assertReceipt: (
          chunk: { id: string; slot: string },
          receipt: { chunk: string; slot: string },
        ) => void;
        chunks: ReadonlyMap<string, { id: string; slot: string }>;
        processAlive: (pid: number) => boolean;
        renderJobRoot: string;
        root: string;
        scope: string;
        tier: "final" | "proxy";
      }) => {
        entries: Array<{
          candidate: { bytes: number; kind: string; path: string };
          snapshot: {
            base: { path: string };
            contentFingerprint: string;
            targetIdentity: string;
          };
        }>;
        retainedChunkPaths: string[];
      };
      loadCurrentRenderChunkPublication: (props: {
        assertReceipt: (receipt: { chunk: string }) => void;
        chunk: { frames: unknown[] };
        frameFormat: { fps: number; height: number; width: number };
        pointer: unknown;
      }) => {
        frames: Array<{
          bytes: Uint8Array;
          receipt: { globalFrame: number };
        }>;
        receipt: { chunk: string };
      } | null;
      loadRenderChunkPublication: (
        root: string,
        pointer: string,
      ) => {
        encoded: Uint8Array;
        frames: Array<{ bytes: Uint8Array; receipt: { globalFrame: number } }>;
        publication: unknown;
        receipt: unknown;
      };
      publishRenderChunkSnapshot: (props: {
        chunk: string;
        receipt: unknown;
        root: string;
        scope: string;
        tier: "final" | "proxy";
        tree: string;
      }) => {
        publication: { pointer: unknown; receipt: unknown };
        reused: boolean;
      };
      readRenderChunkPublicationFile: (
        publication: unknown,
        relative: string,
      ) => Uint8Array;
      removeRenderChunkPublication: (root: string, pointer: string) => boolean;
      removeCapturedRenderChunkPointer: (pointer: unknown) => void;
      renderChunkPublicationProtectsTree: (
        publication: unknown,
        candidate: unknown,
      ) => boolean;
      renderChunkContentFingerprint: (snapshot: unknown) => string;
      renderChunkPublicationPath: (props: {
        chunk: string;
        root: string;
        scope: string;
        tier: "final" | "proxy";
      }) => string;
    };
    const chunkPublicationRoot = path.join(base, "chunk-publication");
    const chunkPublicationScope = "b".repeat(64);
    const chunkPublicationId = fixtureDigest(
      Buffer.from("published chunk identity"),
    );
    const chunkFrameBytes = Buffer.from(productionPng(16, 16));
    const chunkVideoBytes = Buffer.from(
      await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 24,
        frameCount: 1,
      }),
    );
    const populateChunkSource = (
      directory: string,
      chunk: string,
    ): {
      encoded: { bytes: number; digest: string; path: string };
      frames: Array<{
        bytes: number;
        digest: string;
        globalFrame: number;
        height: number;
        path: string;
        width: number;
      }>;
      slot: string;
      chunk: string;
      version: 1;
    } => {
      fs.mkdirSync(path.join(directory, "frames"), { recursive: true });
      fs.writeFileSync(
        path.join(directory, "frames", "frame_00000000.png"),
        chunkFrameBytes,
      );
      fs.writeFileSync(path.join(directory, "chunk.mp4"), chunkVideoBytes);
      return {
        version: 1,
        slot: "feature:beauty:00000000",
        chunk,
        frames: [
          {
            globalFrame: 0,
            path: "frames/frame_00000000.png",
            digest: fixtureDigest(chunkFrameBytes),
            bytes: chunkFrameBytes.length,
            width: 16,
            height: 16,
          },
        ],
        encoded: {
          path: "chunk.mp4",
          digest: fixtureDigest(chunkVideoBytes),
          bytes: chunkVideoBytes.length,
        },
      };
    };
    fs.mkdirSync(chunkPublicationRoot);
    const normalChunkSource = path.join(chunkPublicationRoot, "normal-source");
    const normalChunkReceipt = populateChunkSource(
      normalChunkSource,
      chunkPublicationId,
    );
    const normalChunkPointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: chunkPublicationId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    let receiptPublishedLast = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === normalChunkPointer &&
        flags === "wx+"
      )
        receiptPublishedLast =
          fs.existsSync(path.join(normalChunkSource, "chunk.mp4")) &&
          fs.existsSync(
            path.join(normalChunkSource, "frames", "frame_00000000.png"),
          ) &&
          fs.existsSync(normalChunkPointer) === false;
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    const normalChunkPublished = (() => {
      try {
        return renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: chunkPublicationId,
          receipt: normalChunkReceipt,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: normalChunkSource,
        });
      } finally {
        mutableFs.openSync = nativeOpen;
      }
    })();
    const normalChunkPublication =
      renderChunkSnapshotModule.captureRenderChunkPublication(
        chunkPublicationRoot,
        normalChunkPointer,
      );
    const normalLoadedChunk =
      renderChunkSnapshotModule.loadRenderChunkPublication(
        chunkPublicationRoot,
        normalChunkPointer,
      );
    const normalCurrentChunk =
      renderChunkSnapshotModule.loadCurrentRenderChunkPublication({
        assertReceipt: (receipt) => {
          if (receipt.chunk !== chunkPublicationId)
            throw new Error("current chunk receipt changed identity");
        },
        chunk: { frames: [{}] },
        frameFormat: { fps: 24, height: 16, width: 16 },
        pointer: normalChunkPublication.pointer,
      });
    renderChunkSnapshotModule.assertRenderChunkPublication(
      normalChunkPublication,
    );
    const guideFrames = new Map<number, Uint8Array>();
    const encodedFrames: Uint8Array[] = [];
    if (normalCurrentChunk !== null) {
      renderChunkSnapshotModule.consumeCurrentRenderChunkFrames(
        normalCurrentChunk,
        (frame) => guideFrames.set(frame.receipt.globalFrame, frame.bytes),
      );
      renderChunkSnapshotModule.consumeCurrentRenderChunkFrames(
        normalCurrentChunk,
        (frame) => encodedFrames.push(frame.bytes),
      );
    }
    TestValidator.predicate(
      "render chunk pointer loads complete resume and finalize bytes from one tree",
      normalChunkPublished.reused === false &&
        receiptPublishedLast &&
        normalCurrentChunk !== null &&
        Buffer.from(normalLoadedChunk.encoded).equals(chunkVideoBytes) &&
        Buffer.from(guideFrames.get(0)!).equals(chunkFrameBytes) &&
        encodedFrames.length === 1 &&
        Buffer.from(encodedFrames[0]!).equals(chunkFrameBytes),
    );
    const parkedPublishedTree = path.join(
      chunkPublicationRoot,
      "normal-tree-original",
    );
    fs.renameSync(normalChunkSource, parkedPublishedTree);
    fs.cpSync(parkedPublishedTree, normalChunkSource, {
      recursive: true,
    });
    const consumerSuccessorRejected = throws(() =>
      renderChunkSnapshotModule.loadRenderChunkPublication(
        chunkPublicationRoot,
        normalChunkPointer,
      ),
    );
    TestValidator.predicate(
      "a consumer refuses a byte-identical successor installed after tree capture",
      consumerSuccessorRejected &&
        fs.existsSync(normalChunkSource) &&
        fs.existsSync(parkedPublishedTree),
    );

    const tempRaceId = fixtureDigest(Buffer.from("temp successor chunk"));
    const tempRaceSource = path.join(chunkPublicationRoot, "temp-race-source");
    const tempRaceParked = path.join(
      chunkPublicationRoot,
      "temp-race-original",
    );
    const tempRaceReceipt = populateChunkSource(tempRaceSource, tempRaceId);
    const tempRacePointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: tempRaceId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    let tempSuccessorInstalled = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        tempSuccessorInstalled === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === tempRacePointer &&
        flags === "wx+"
      ) {
        nativeLivenessRename(tempRaceSource, tempRaceParked);
        fs.cpSync(tempRaceParked, tempRaceSource, { recursive: true });
        tempSuccessorInstalled = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let tempSuccessorRejected = false;
    try {
      tempSuccessorRejected = throws(() =>
        renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: tempRaceId,
          receipt: tempRaceReceipt,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: tempRaceSource,
        }),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "publication refuses a temp successor without modifying its tree bytes",
      tempSuccessorInstalled &&
        tempSuccessorRejected &&
        fs.existsSync(tempRaceParked) &&
        fs
          .readFileSync(path.join(tempRaceSource, "chunk.mp4"))
          .equals(chunkVideoBytes) &&
        fs
          .readFileSync(path.join(tempRaceParked, "chunk.mp4"))
          .equals(chunkVideoBytes),
    );

    const byteMismatchId = fixtureDigest(Buffer.from("byte mismatch chunk"));
    const byteMismatchSource = path.join(
      chunkPublicationRoot,
      "byte-mismatch-source",
    );
    const byteMismatchReceipt = populateChunkSource(
      byteMismatchSource,
      byteMismatchId,
    );
    const byteMismatchVideo = Buffer.from(chunkVideoBytes);
    byteMismatchVideo[byteMismatchVideo.length - 1] ^= 1;
    fs.writeFileSync(
      path.join(byteMismatchSource, "chunk.mp4"),
      byteMismatchVideo,
    );
    const byteMismatchPointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: byteMismatchId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    const byteMismatchRejected = throws(() =>
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: byteMismatchId,
        receipt: byteMismatchReceipt,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
        tree: byteMismatchSource,
      }),
    );
    TestValidator.predicate(
      "publication refuses receipt facts from a byte-different temp tree",
      byteMismatchRejected && fs.existsSync(byteMismatchPointer) === false,
    );

    const recoveryId = fixtureDigest(Buffer.from("late recovery pointer"));
    const recoverySource = path.join(chunkPublicationRoot, "recovery-source");
    const recoveryReceipt = populateChunkSource(recoverySource, recoveryId);
    const recoveryCandidate = renderGcModule.captureRenderGcTarget(
      chunkPublicationRoot,
      recoverySource,
    );
    renderChunkSnapshotModule.publishRenderChunkSnapshot({
      chunk: recoveryId,
      receipt: recoveryReceipt,
      root: chunkPublicationRoot,
      scope: chunkPublicationScope,
      tier: "final",
      tree: recoverySource,
    });
    const recoveryDecoys = [0, 1].map((index) => {
      const id = fixtureDigest(Buffer.from(`recovery decoy ${index}`));
      const source = path.join(chunkPublicationRoot, `recovery-decoy-${index}`);
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: id,
        receipt: populateChunkSource(source, id),
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
        tree: source,
      });
      return {
        id,
        pointer: renderChunkSnapshotModule.renderChunkPublicationPath({
          chunk: id,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
        }),
        source,
      };
    });
    let recoveryDecoyOpens = 0;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        typeof file !== "number" &&
        recoveryDecoys.some(
          (decoy) =>
            path.resolve(file.toString()) === path.resolve(decoy.pointer) ||
            path
              .resolve(file.toString())
              .startsWith(`${path.resolve(decoy.source)}${path.sep}`),
        )
      )
        recoveryDecoyOpens++;
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let recoveryProtected = false;
    try {
      recoveryProtected =
        renderChunkSnapshotModule.currentRenderChunkPublicationProtectsTree({
          candidate: recoveryCandidate,
          candidateName: `${recoveryId.slice(7)}.candidate.999999`,
          capture: (chunk) =>
            renderChunkSnapshotModule.captureRenderChunkPublication(
              chunkPublicationRoot,
              renderChunkSnapshotModule.renderChunkPublicationPath({
                chunk: chunk.id,
                root: chunkPublicationRoot,
                scope: chunkPublicationScope,
                tier: "final",
              }),
            ),
          chunks: new Map([
            [recoveryId, { id: recoveryId, slot: recoveryReceipt.slot }],
            ...recoveryDecoys.map(
              (decoy, index) =>
                [decoy.id, { id: decoy.id, slot: `decoy-${index}` }] as const,
            ),
          ]),
        });
    } finally {
      mutableFs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "late recovery checks only the candidate's canonical pointer and tree",
      recoveryProtected && recoveryDecoyOpens === 0,
    );

    const chunkGcRoot = path.join(base, "chunk-gc-project");
    const chunkGcRenderJobRoot = path.join(
      chunkGcRoot,
      ".automovie",
      "productions",
      "feature",
      "render-job",
    );
    const chunkGcTemporaryRoot = path.join(
      chunkGcRenderJobRoot,
      "final",
      "tmp",
    );
    fs.mkdirSync(chunkGcTemporaryRoot, { recursive: true });
    const chunkGcCurrentId = fixtureDigest(Buffer.from("gc current chunk"));
    const chunkGcCurrentName = `${chunkGcCurrentId.slice(7)}.current.701`;
    const chunkGcCurrentTree = path.join(
      chunkGcTemporaryRoot,
      chunkGcCurrentName,
    );
    const chunkGcCurrentReceipt = populateChunkSource(
      chunkGcCurrentTree,
      chunkGcCurrentId,
    );
    renderChunkSnapshotModule.publishRenderChunkSnapshot({
      chunk: chunkGcCurrentId,
      receipt: chunkGcCurrentReceipt,
      root: chunkGcRoot,
      scope: chunkPublicationScope,
      tier: "final",
      tree: chunkGcCurrentTree,
    });
    const chunkGcOrphanName = `${chunkGcCurrentId.slice(7)}.orphan.702`;
    populateChunkSource(
      path.join(chunkGcTemporaryRoot, chunkGcOrphanName),
      chunkGcCurrentId,
    );
    const chunkGcStaleId = fixtureDigest(Buffer.from("gc stale chunk"));
    const chunkGcStaleName = `${chunkGcStaleId.slice(7)}.stale.703`;
    const chunkGcStaleTree = path.join(chunkGcTemporaryRoot, chunkGcStaleName);
    renderChunkSnapshotModule.publishRenderChunkSnapshot({
      chunk: chunkGcStaleId,
      receipt: populateChunkSource(chunkGcStaleTree, chunkGcStaleId),
      root: chunkGcRoot,
      scope: chunkPublicationScope,
      tier: "final",
      tree: chunkGcStaleTree,
    });
    const chunkGcLiveId = fixtureDigest(Buffer.from("gc live temp"));
    const chunkGcLiveName = `${chunkGcLiveId.slice(7)}.live.704`;
    populateChunkSource(
      path.join(chunkGcTemporaryRoot, chunkGcLiveName),
      chunkGcLiveId,
    );
    const inventoryChunkGarbage = () =>
      renderChunkSnapshotModule.inventoryRenderChunkGarbage({
        assertReceipt: (chunk, receipt) => {
          if (chunk.id !== receipt.chunk || chunk.slot !== receipt.slot)
            throw new Error("test chunk receipt mismatch");
        },
        chunks: new Map([
          [
            chunkGcCurrentId,
            {
              id: chunkGcCurrentId,
              slot: chunkGcCurrentReceipt.slot,
            },
          ],
        ]),
        processAlive: (pid) => pid === 704,
        renderJobRoot: chunkGcRenderJobRoot,
        root: chunkGcRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    const chunkGcInventory = inventoryChunkGarbage();
    const currentPointerCandidate = `final/pointers/${chunkGcCurrentId.slice(7)}`;
    const currentTreeCandidate = `final/tmp/${chunkGcCurrentName}`;
    const chunkGcPointerEntry = chunkGcInventory.entries.find(
      (entry) => entry.candidate.path === currentPointerCandidate,
    );
    const chunkGcTreeEntry = chunkGcInventory.entries.find(
      (entry) => entry.candidate.path === currentTreeCandidate,
    );
    TestValidator.predicate(
      "chunk GC inventories exact current/stale/orphan publications and excludes live temp",
      chunkGcInventory.retainedChunkPaths.join() ===
        [currentPointerCandidate, currentTreeCandidate].sort().join() &&
        chunkGcInventory.entries.some(
          (entry) => entry.candidate.path === `final/tmp/${chunkGcOrphanName}`,
        ) &&
        chunkGcInventory.entries.some(
          (entry) =>
            entry.candidate.path ===
            `final/pointers/${chunkGcStaleId.slice(7)}`,
        ) &&
        chunkGcInventory.entries.some(
          (entry) => entry.candidate.path === `final/tmp/${chunkGcStaleName}`,
        ) &&
        chunkGcInventory.entries.some((entry) =>
          entry.candidate.path.endsWith(chunkGcLiveName),
        ) === false &&
        chunkGcPointerEntry?.snapshot.base.path === chunkGcRoot &&
        chunkGcTreeEntry?.snapshot.base.path === chunkGcRenderJobRoot,
    );
    const chunkGcCurrentPayload = path.join(chunkGcCurrentTree, "chunk.mp4");
    const changedChunkGcPayload = Buffer.from(chunkVideoBytes);
    changedChunkGcPayload[changedChunkGcPayload.length - 1] ^= 1;
    let chunkGcPayloadMutated = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        chunkGcPayloadMutated === false &&
        path.resolve(directory.toString()) === chunkGcTemporaryRoot
      ) {
        fs.writeFileSync(chunkGcCurrentPayload, changedChunkGcPayload);
        chunkGcPayloadMutated = true;
      }
      return Reflect.apply(nativeReaddir, mutableFs, [directory, ...args]);
    }) as typeof fs.readdirSync;
    let mutatedChunkGcInventory: ReturnType<
      typeof inventoryChunkGarbage
    > | null = null;
    try {
      mutatedChunkGcInventory = inventoryChunkGarbage();
    } finally {
      mutableFs.readdirSync = nativeReaddir;
      fs.writeFileSync(chunkGcCurrentPayload, chunkVideoBytes);
    }
    TestValidator.predicate(
      "chunk GC refuses same-inode tree content changed after pointer authentication",
      chunkGcPayloadMutated &&
        mutatedChunkGcInventory !== null &&
        mutatedChunkGcInventory.retainedChunkPaths.length === 0,
    );

    const pointerRaceId = fixtureDigest(Buffer.from("pointer successor chunk"));
    const pointerRaceSource = path.join(
      chunkPublicationRoot,
      "pointer-race-source",
    );
    const pointerRaceReceipt = populateChunkSource(
      pointerRaceSource,
      pointerRaceId,
    );
    const pointerRacePointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: pointerRaceId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "proxy",
      });
    const pointerRacePublished =
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: pointerRaceId,
        receipt: pointerRaceReceipt,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "proxy",
        tree: pointerRaceSource,
      });
    const pointerSuccessorBytes = fs.readFileSync(pointerRacePointer);
    const parkedPointer = `${pointerRacePointer}.parked`;
    fs.renameSync(pointerRacePointer, parkedPointer);
    fs.writeFileSync(pointerRacePointer, pointerSuccessorBytes);
    const capturedPointerRemovalRejected = throws(() =>
      renderChunkSnapshotModule.removeCapturedRenderChunkPointer(
        pointerRacePublished.publication.pointer,
      ),
    );
    const pointerSuccessorRejected = throws(() =>
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: pointerRaceId,
        receipt: pointerRaceReceipt,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "proxy",
        tree: pointerRaceSource,
      }),
    );
    TestValidator.predicate(
      "O_EXCL pointer publication preserves a reappearing successor",
      capturedPointerRemovalRejected &&
        pointerSuccessorRejected &&
        fs.existsSync(parkedPointer) &&
        fs.readFileSync(pointerRacePointer).equals(pointerSuccessorBytes),
    );

    const rootSwapParent = path.join(base, "chunk-root-swap");
    const rootSwapRoot = path.join(rootSwapParent, "root");
    const rootSwapParked = path.join(rootSwapParent, "root-original");
    const rootSwapSource = path.join(rootSwapRoot, "source");
    const rootSwapId = fixtureDigest(Buffer.from("root swap chunk"));
    fs.mkdirSync(rootSwapRoot, { recursive: true });
    const rootSwapReceipt = populateChunkSource(rootSwapSource, rootSwapId);
    const rootSwapPointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: rootSwapId,
        root: rootSwapRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    let publicationRootSwapped = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        publicationRootSwapped === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === rootSwapPointer &&
        flags === "wx+"
      ) {
        nativeLivenessRename(rootSwapRoot, rootSwapParked);
        nativeMkdir(rootSwapRoot);
        publicationRootSwapped = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let publicationRootSwapRejected = false;
    try {
      publicationRootSwapRejected = throws(() =>
        renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: rootSwapId,
          receipt: rootSwapReceipt,
          root: rootSwapRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: rootSwapSource,
        }),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "chunk pointer publication fails closed across a physical root swap",
      publicationRootSwapped &&
        publicationRootSwapRejected &&
        fs
          .readFileSync(path.join(rootSwapParked, "source", "chunk.mp4"))
          .equals(chunkVideoBytes) &&
        fs
          .readFileSync(
            path.join(rootSwapParked, "source", "frames", "frame_00000000.png"),
          )
          .equals(chunkFrameBytes),
    );
    fs.rmSync(rootSwapParent, { recursive: true });
    fs.rmSync(chunkPublicationRoot, { recursive: true });
    const gcBase = path.join(base, "render-gc");
    const gcTarget = path.join(gcBase, "stale-chunk");
    const gcFile = path.join(gcTarget, "chunk.bin");
    const gcQuarantine = path.join(gcBase, ".gc-preserved-fixture");
    const gcBytes = Buffer.from("stale chunk bytes");
    const writeGcCandidate = (): void => {
      fs.mkdirSync(gcTarget, { recursive: true });
      fs.writeFileSync(gcFile, gcBytes);
    };
    fs.mkdirSync(gcQuarantine, { recursive: true });
    writeGcCandidate();
    const gcSnapshot = renderGcModule.captureRenderGcTarget(gcBase, gcTarget);
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: path.join(gcQuarantine, "normal"),
      quarantine: gcQuarantine,
      snapshot: gcSnapshot,
    });
    TestValidator.predicate(
      "render GC removes only one exact inventoried candidate",
      gcSnapshot.bytes === gcBytes.length &&
        fs.existsSync(gcTarget) === false &&
        fs.existsSync(path.join(gcQuarantine, "normal")) === false,
    );
    const gcPhysicalRoot = path.join(base, "render-gc-physical-root");
    const gcAliasRoot = path.join(base, "render-gc-alias-root");
    const gcAliasedBase = path.join(gcAliasRoot, "nested");
    const gcAliasedTarget = path.join(gcAliasedBase, "candidate");
    const gcAliasedQuarantine = path.join(gcAliasedBase, ".gc-fixture");
    fs.mkdirSync(path.join(gcPhysicalRoot, "nested", "candidate"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(gcPhysicalRoot, "nested", ".gc-fixture"));
    fs.symlinkSync(
      gcPhysicalRoot,
      gcAliasRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.writeFileSync(path.join(gcAliasedTarget, "chunk.bin"), gcBytes);
    const gcAliasedSnapshot = renderGcModule.captureRenderGcTarget(
      gcAliasedBase,
      gcAliasedTarget,
    );
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: path.join(gcAliasedQuarantine, "candidate"),
      quarantine: gcAliasedQuarantine,
      snapshot: gcAliasedSnapshot,
    });
    TestValidator.predicate(
      "render GC accepts a physical base reached through an alias ancestor",
      fs.existsSync(gcAliasedTarget) === false,
    );
    writeGcCandidate();
    const preRenameSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcTarget,
    );
    const parkedPreRenameGc = path.join(gcBase, "pre-rename-original");
    fs.renameSync(gcTarget, parkedPreRenameGc);
    writeGcCandidate();
    const preRenameGcRejected = throws(() =>
      renderGcModule.removeCapturedRenderGcTarget({
        isolated: path.join(gcQuarantine, "pre-rename"),
        quarantine: gcQuarantine,
        snapshot: preRenameSnapshot,
      }),
    );
    TestValidator.predicate(
      "render GC refuses a successor installed before quarantine",
      preRenameGcRejected &&
        fs.existsSync(gcTarget) &&
        fs.existsSync(parkedPreRenameGc),
    );
    fs.rmSync(gcTarget, { recursive: true, force: true });
    fs.rmSync(parkedPreRenameGc, { recursive: true, force: true });
    writeGcCandidate();
    const renameBoundarySnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcTarget,
    );
    const parkedRenameBoundaryGc = path.join(gcBase, "rename-original");
    const renameBoundaryIsolated = path.join(gcQuarantine, "rename-boundary");
    const nativeGcRename = mutableFs.renameSync;
    let gcRenameBoundarySwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        gcRenameBoundarySwapped === false &&
        path.resolve(oldPath.toString()) === gcTarget &&
        path.resolve(newPath.toString()) === renameBoundaryIsolated
      ) {
        nativeGcRename(gcTarget, parkedRenameBoundaryGc);
        writeGcCandidate();
        gcRenameBoundarySwapped = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let gcRenameBoundaryRejected = false;
    try {
      gcRenameBoundaryRejected = throws(() =>
        renderGcModule.removeCapturedRenderGcTarget({
          isolated: renameBoundaryIsolated,
          quarantine: gcQuarantine,
          snapshot: renameBoundarySnapshot,
        }),
      );
    } finally {
      mutableFs.renameSync = nativeGcRename;
    }
    TestValidator.predicate(
      "render GC preserves a successor crossing rename outside later plans",
      gcRenameBoundarySwapped &&
        gcRenameBoundaryRejected &&
        fs.existsSync(gcTarget) === false &&
        fs.existsSync(parkedRenameBoundaryGc) &&
        fs
          .readFileSync(path.join(renameBoundaryIsolated, "chunk.bin"))
          .equals(gcBytes) &&
        renderGcModule.isRenderGcPreservedPath(
          path.relative(gcBase, renameBoundaryIsolated),
        ) &&
        renderGcModule.isRenderGcPreservedPath(
          "deliverables/.gc-preserved-fixture/file",
        ) === false &&
        renderGcModule.isRenderGcPreservedPath(".gc-preserved/file") ===
          false &&
        renderGcModule.isRenderGcPreservedPath("ordinary/file") === false,
    );
    fs.rmSync(renameBoundaryIsolated, { recursive: true, force: true });
    fs.rmSync(parkedRenameBoundaryGc, { recursive: true, force: true });
    const gcPublicationFile = path.join(gcBase, "stale-publication.mp4");
    const gcPublicationBytes = Buffer.from("stale publication bytes");
    fs.writeFileSync(gcPublicationFile, gcPublicationBytes);
    const gcPublicationSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcPublicationFile,
    );
    const gcPublicationNormalIsolated = path.join(
      gcQuarantine,
      "normal-publication",
    );
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: gcPublicationNormalIsolated,
      quarantine: gcQuarantine,
      snapshot: gcPublicationSnapshot,
    });
    TestValidator.predicate(
      "render GC removes one exact inventoried publication file",
      gcPublicationSnapshot.bytes === gcPublicationBytes.length &&
        fs.existsSync(gcPublicationFile) === false &&
        fs.existsSync(gcPublicationNormalIsolated) === false,
    );
    const gcSparsePublication = path.join(gcBase, "large-publication.mp4");
    const gcSparseBytes = 2 * 1024 * 1024 + 17;
    const gcSparseDescriptor = fs.openSync(gcSparsePublication, "wx");
    try {
      fs.ftruncateSync(gcSparseDescriptor, gcSparseBytes);
    } finally {
      fs.closeSync(gcSparseDescriptor);
    }
    const gcSparseSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcSparsePublication,
    );
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: path.join(gcQuarantine, "large-publication"),
      quarantine: gcQuarantine,
      snapshot: gcSparseSnapshot,
    });
    TestValidator.predicate(
      "render GC streams a multi-chunk publication without resident bytes",
      gcSparseSnapshot.bytes === gcSparseBytes &&
        fs.existsSync(gcSparsePublication) === false,
    );
    fs.writeFileSync(gcPublicationFile, gcPublicationBytes);
    const gcPublicationBoundarySnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcPublicationFile,
    );
    const parkedGcPublication = path.join(gcBase, "publication-original.mp4");
    const gcPublicationBoundaryIsolated = path.join(
      gcQuarantine,
      "publication-boundary",
    );
    let gcPublicationBoundarySwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        gcPublicationBoundarySwapped === false &&
        path.resolve(oldPath.toString()) === gcPublicationFile &&
        path.resolve(newPath.toString()) === gcPublicationBoundaryIsolated
      ) {
        nativeGcRename(gcPublicationFile, parkedGcPublication);
        fs.writeFileSync(gcPublicationFile, gcPublicationBytes);
        gcPublicationBoundarySwapped = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let gcPublicationBoundaryRejected = false;
    try {
      gcPublicationBoundaryRejected = throws(() =>
        renderGcModule.removeCapturedRenderGcTarget({
          isolated: gcPublicationBoundaryIsolated,
          quarantine: gcQuarantine,
          snapshot: gcPublicationBoundarySnapshot,
        }),
      );
    } finally {
      mutableFs.renameSync = nativeGcRename;
    }
    TestValidator.predicate(
      "render GC preserves a publication file successor crossing rename",
      gcPublicationBoundarySwapped &&
        gcPublicationBoundaryRejected &&
        fs.existsSync(gcPublicationFile) === false &&
        fs.readFileSync(parkedGcPublication).equals(gcPublicationBytes) &&
        fs
          .readFileSync(gcPublicationBoundaryIsolated)
          .equals(gcPublicationBytes) &&
        renderGcModule.isRenderGcPreservedPath(
          path.relative(gcBase, gcPublicationBoundaryIsolated),
        ),
    );
    fs.rmSync(gcPublicationBoundaryIsolated, { force: true });
    fs.rmSync(parkedGcPublication, { force: true });
    const workerQuarantine = renderGcModule.ensureRenderPhysicalDirectory(
      gcBase,
      "quarantine",
    );
    const workerPreserved = renderGcModule.ensureRenderPhysicalDirectory(
      gcBase,
      ".gc-preserved-worker-fixture",
    );
    const workerClaim = path.join(gcBase, "worker-claim.lock");
    const workerClaimBytes = Buffer.from("exact worker claim");
    fs.writeFileSync(workerClaim, workerClaimBytes);
    const workerClaimSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerClaim,
    );
    const workerClaimIsolated = path.join(workerPreserved, "claim");
    const workerClaimDestination = path.join(
      workerQuarantine,
      "worker-claim.released",
    );
    renderGcModule.quarantineCapturedRenderTarget({
      destination: workerClaimDestination,
      isolated: workerClaimIsolated,
      quarantine: workerPreserved,
      snapshot: workerClaimSnapshot,
    });
    TestValidator.predicate(
      "routine worker cleanup quarantines one exact captured file",
      fs.existsSync(workerClaim) === false &&
        fs.existsSync(workerClaimIsolated) === false &&
        fs.readFileSync(workerClaimDestination).equals(workerClaimBytes),
    );
    const workerPartial = path.join(gcBase, "worker-partial");
    const workerPartialFile = path.join(workerPartial, "frame.bin");
    fs.mkdirSync(workerPartial);
    fs.writeFileSync(workerPartialFile, gcBytes);
    const workerPartialSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerPartial,
    );
    const parkedWorkerPartial = path.join(gcBase, "worker-partial-original");
    const workerPartialIsolated = path.join(workerPreserved, "partial");
    const workerPartialDestination = path.join(
      workerQuarantine,
      "worker-partial.abandoned",
    );
    let workerPartialSwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        workerPartialSwapped === false &&
        path.resolve(oldPath.toString()) === workerPartial &&
        path.resolve(newPath.toString()) === workerPartialIsolated
      ) {
        nativeGcRename(workerPartial, parkedWorkerPartial);
        fs.mkdirSync(workerPartial);
        fs.writeFileSync(workerPartialFile, gcBytes);
        workerPartialSwapped = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let workerPartialRejected = false;
    try {
      workerPartialRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerPartialDestination,
          isolated: workerPartialIsolated,
          quarantine: workerPreserved,
          snapshot: workerPartialSnapshot,
        }),
      );
    } finally {
      mutableFs.renameSync = nativeGcRename;
    }
    TestValidator.predicate(
      "routine worker cleanup preserves a directory successor at its private boundary",
      workerPartialSwapped &&
        workerPartialRejected &&
        fs.existsSync(workerPartial) === false &&
        fs.existsSync(parkedWorkerPartial) &&
        fs
          .readFileSync(path.join(workerPartialIsolated, "frame.bin"))
          .equals(gcBytes) &&
        fs.existsSync(workerPartialDestination) === false,
    );
    fs.rmSync(workerClaimDestination, { force: true });
    fs.rmSync(workerPartialIsolated, { recursive: true, force: true });
    fs.rmSync(parkedWorkerPartial, { recursive: true, force: true });
    const heldClaimDirectory = path.join(gcBase, "held-locks");
    const heldClaim = path.join(heldClaimDirectory, "held-claim.lock");
    const heldClaimSibling = path.join(
      heldClaimDirectory,
      "held-claim-sibling.lock",
    );
    fs.mkdirSync(heldClaimDirectory);
    fs.writeFileSync(heldClaim, workerClaimBytes);
    const heldClaimSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      heldClaim,
    );
    fs.writeFileSync(heldClaimSibling, "sibling namespace mutation");
    TestValidator.predicate(
      "an exact held claim survives unrelated sibling namespace mutation",
      !throws(() =>
        renderGcModule.assertCapturedRenderTarget(heldClaimSnapshot),
      ),
    );
    const decisionSuccessor = path.join(gcBase, "decision-successor.lock");
    fs.writeFileSync(decisionSuccessor, workerClaimBytes);
    TestValidator.predicate(
      "captured worker decisions read their exact descriptor bytes",
      Buffer.from(
        renderGcModule.readCapturedRenderGcFile(heldClaimSnapshot, 1024 * 1024),
      ).equals(workerClaimBytes),
    );
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === heldClaim
      )
        return Reflect.apply(nativeOpen, mutableFs, [
          decisionSuccessor,
          flags,
          ...args,
        ]) as number;
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let decisionSuccessorRejected = false;
    try {
      decisionSuccessorRejected = throws(() =>
        renderGcModule.readCapturedRenderGcFile(heldClaimSnapshot, 1024 * 1024),
      );
    } finally {
      mutableFs.openSync = nativeOpen;
    }
    TestValidator.predicate(
      "captured worker decisions reject a pathname-opened successor descriptor",
      decisionSuccessorRejected &&
        fs.readFileSync(heldClaim).equals(workerClaimBytes) &&
        fs.readFileSync(decisionSuccessor).equals(workerClaimBytes),
    );
    fs.rmSync(heldClaimDirectory, { recursive: true, force: true });
    fs.rmSync(decisionSuccessor, { force: true });
    const largeDecision = path.join(gcBase, "large-decision.json");
    const largeDecisionBytes = Buffer.alloc(1024 * 1024 + 17, 0x61);
    fs.writeFileSync(largeDecision, largeDecisionBytes);
    const largeDecisionSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      largeDecision,
    );
    TestValidator.predicate(
      "captured receipt decisions have no arbitrary one-megabyte boundary",
      Buffer.from(
        renderGcModule.readCapturedRenderGcFile(
          largeDecisionSnapshot,
          largeDecisionSnapshot.bytes,
        ),
      ).equals(largeDecisionBytes),
    );
    fs.rmSync(largeDecision, { force: true });
    const decisionTree = path.join(gcBase, "decision-tree");
    const decisionReceipt = path.join(decisionTree, "receipt.json");
    const parkedDecisionTree = path.join(gcBase, "decision-tree-original");
    fs.mkdirSync(decisionTree);
    fs.writeFileSync(decisionReceipt, '{"slot":"fixture"}\n');
    const decisionReceiptSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      decisionReceipt,
    );
    const decisionTreeSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      decisionTree,
    );
    TestValidator.predicate(
      "stale receipt decisions bind to their exact directory inventory",
      !throws(() =>
        renderGcModule.assertCapturedRenderGcFileEntry({
          directory: decisionTreeSnapshot,
          file: decisionReceiptSnapshot,
          relative: "receipt.json",
        }),
      ),
    );
    fs.renameSync(decisionTree, parkedDecisionTree);
    fs.mkdirSync(decisionTree);
    fs.writeFileSync(decisionReceipt, '{"slot":"fixture"}\n');
    const decisionTreeSuccessor = renderGcModule.captureRenderGcTarget(
      gcBase,
      decisionTree,
    );
    TestValidator.predicate(
      "stale receipt decisions reject a byte-identical successor tree inventory",
      throws(() =>
        renderGcModule.assertCapturedRenderGcFileEntry({
          directory: decisionTreeSuccessor,
          file: decisionReceiptSnapshot,
          relative: "receipt.json",
        }),
      ),
    );
    fs.rmSync(decisionTree, { recursive: true, force: true });
    fs.rmSync(parkedDecisionTree, { recursive: true, force: true });
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
