import {
  AUTOMOVIE_TEMPLATE_VERSIONS,
  renderScaffold,
  renderTemplate,
  scaffoldAssetDirectory,
  writeFiles,
} from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
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

/**
 * The `@automovie/cli` scaffolder renders the starter into an in-memory file
 * map and writes it out: the render/write split learned from the reference
 * scaffolder, so the map can be asserted without disk I/O.
 *
 * Scenarios:
 *
 * 1. `renderScaffold` yields the starter's file set with POSIX keys, and the
 *    shipped `gitignore` asset is restored to `.gitignore`.
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

  // 1. the file set, POSIX keys, gitignore restored, IN ITS GUARANTEED ORDER.
  // No re-sort: the order is the guarantee. `listFiles` sorts each directory's
  // entries by code unit and recurses in place, so the emitted order is a DFS
  // pre-order over the ON-DISK names, with `gitignore` renamed to `.gitignore`
  // on the key afterwards. Hence `.automovie/**` leads, while `.gitignore`
  // sits where the shipped `gitignore` asset sorts rather than at its rendered
  // position. Re-sorting the keys here made the assertion hold for ANY order
  // the scaffolder produced, so the cross-host guarantee `listFiles` exists to
  // provide had no test at all.
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
      "AGENTS.md",
      "CLAUDE.md",
      "README.md",
      "automovie.config.ts",
      "automovie.mcp.jsonc",
      "docs/art-direction.md",
      "docs/historical-notes.md",
      "docs/demo-film/screenplay.md",
      "docs/demo-film/treatment.md",
      ".gitignore",
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
      "src/examples/lineBattle.ts",
      "src/film.ts",
      "src/shots/opening.ts",
      "test/opening.test.ts",
      "tsconfig.json",
      "viewer/index.html",
      "viewer/src/asset.ts",
      "viewer/src/film.ts",
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
  TestValidator.predicate(
    "the project name is substituted",
    pkg.includes('"name": "demo-film"') &&
      files["README.md"]!.startsWith("# demo-film"),
  );
  TestValidator.predicate(
    "the production package versions are catalog-synced",
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
        `"h264-mp4-encoder": "${AUTOMOVIE_TEMPLATE_VERSIONS.h264Mp4Encoder}"`,
      ) &&
      pkg.includes(`"mp4box": "${AUTOMOVIE_TEMPLATE_VERSIONS.mp4box}"`) &&
      pkg.includes(
        `"playwright": "${AUTOMOVIE_TEMPLATE_VERSIONS.playwright}"`,
      ) &&
      pkg.includes(`"pngjs": "${AUTOMOVIE_TEMPLATE_VERSIONS.pngjs}"`) &&
      pkg.includes(
        `"@types/pngjs": "${AUTOMOVIE_TEMPLATE_VERSIONS.pngjsTypes}"`,
      ) &&
      pkg.includes(`"three": "${AUTOMOVIE_TEMPLATE_VERSIONS.three}"`),
  );
  TestValidator.predicate(
    "the starter separates owned source and enforces review in read-only lint",
    files["AGENTS.md"]!.includes("Never edit `generated`") &&
      files[".gitignore"]!.includes("generated/") &&
      files["scripts/compile.ts"]!.includes('scope: "source"') &&
      files["scripts/lint.ts"]!.includes('scope: "review"') &&
      files["README.md"]!.includes("fails while any design, source,") &&
      files["README.md"]!.includes(
        "shot, or film review is missing, stale, revising, or incomplete",
      ),
  );
  TestValidator.predicate(
    "the local MCP host owns actual frame capture",
    files["automovie.mcp.jsonc"]!.includes("scripts/mcp.ts") &&
      files["scripts/mcp.ts"]!.includes("captureProductionFrame") &&
      files["scripts/capture.ts"]!.includes('locator("#view").screenshot') &&
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
      files["README.md"]!.includes("pnpm capture:install") &&
      files["README.md"]!.includes("PLAYWRIGHT_BROWSERS_PATH=0") &&
      files["scripts/render.ts"]!.includes(
        "await closeProductionFrameCapture()",
      ) &&
      files["scripts/render.ts"]!.includes("runProductionRenderJob") &&
      files["scripts/render.ts"]!.includes("commitProductionPublication") &&
      files["scripts/render.ts"]!.includes("probeProductionMedia") &&
      files["scripts/render.ts"]!.includes('process.argv.indexOf("--tier")') &&
      files["scripts/render.ts"]!.includes("productionRenderLayersForPass") &&
      files["scripts/render.ts"]!.includes("renderGarbageCollection") &&
      files["scripts/render.ts"]!.includes("project.review(entry.target)") &&
      files["scripts/render.ts"]!.includes("frames/${passes[0]}/frame_") &&
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
      files[".gitignore"]!.includes(".automovie/productions/") &&
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
      files["viewer/src/main.ts"]!.includes('await import("./film")') &&
      files["viewer/src/film.ts"]!.includes("renderCrossDissolveFrames") &&
      files["viewer/src/film.ts"]!.includes('pass !== "beauty"') &&
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
      files["lint.config.ts"]!.includes('"automovie/screenplay-contract": ['),
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
        ".gitignore",
        "AGENTS.md",
        "CLAUDE.md",
        "README.md",
        "automovie.config.ts",
        "automovie.mcp.jsonc",
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
        "src/examples/lineBattle.ts",
        "src/film.ts",
        "src/shots/opening.ts",
        "test/opening.test.ts",
        "tsconfig.json",
        "viewer/index.html",
        "viewer/src/asset.ts",
        "viewer/src/film.ts",
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
