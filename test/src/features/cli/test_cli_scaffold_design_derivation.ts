import { renderScaffold, scaffoldAssetDirectory } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { renderCompletedFilmFixture } from "../internal/completedFilmFixture";
import { namedFacts, throwsError } from "../internal/predicates";

/**
 * A new project inherits authoring capability, never a completed production.
 *
 * The previous scaffold shipped a reviewed film's prose, evidence tags, source,
 * design records, asset use, speaker binding, and emitter. Replacing only some
 * of it left internally valid residue from another film. The public scaffold is
 * now intentionally empty at that ownership boundary; the repository-only film
 * fixture keeps compiler regression coverage elsewhere.
 */
export const test_cli_scaffold_design_derivation = (): void => {
  const scaffold = path.resolve(
    __dirname,
    "../../../../packages/template/scaffold",
  );
  const assetDirectory = scaffoldAssetDirectory();
  const existsSync = fs.existsSync;
  Object.defineProperty(fs, "existsSync", {
    configurable: true,
    value: (candidate: fs.PathLike): boolean =>
      path.resolve(candidate.toString()) === assetDirectory
        ? false
        : existsSync(candidate),
    writable: true,
  });
  try {
    TestValidator.equals(
      "a missing scaffold asset directory fails at its public boundary",
      throwsError(() => scaffoldAssetDirectory(), "assets are missing"),
      true,
    );
  } finally {
    Object.defineProperty(fs, "existsSync", {
      configurable: true,
      value: existsSync,
      writable: true,
    });
  }
  const rendered = renderScaffold({ name: "rendered-production" });
  const emitter = rendered["scripts/emitDesign.ts"]!;
  const completedEmitter = renderCompletedFilmFixture("completed-production")[
    "scripts/emitDesign.ts"
  ]!;
  const productionStudies = rendered["scripts/productionStudies.ts"]!;
  const lint = rendered["lint.config.ts"]!;
  const evidenceInDocs = Object.entries(rendered)
    .filter(([file]) => file.startsWith("docs/"))
    .filter(([, content]) => /@evidence[A-Za-z]*\b/u.test(content))
    .map(([file]) => file);
  const productionDocuments = Object.keys(rendered).filter((file) =>
    /^docs\/(?:settings|research|models|spaces|materials|instances|motions|systems|storylines|scenarios|script|briefs)\/.+\.md$/u.test(
      file,
    ),
  );
  const productionSources = Object.keys(rendered).filter((file) =>
    /^(?:src\/(?:models|spaces|materials|instances|motions|systems|shots)\/.+\.ts|src\/(?:production|film)\.ts)$/u.test(
      file,
    ),
  );
  const designRecords = Object.keys(rendered).filter((file) =>
    /^\.automovie\/design\/.+\.json$/u.test(file),
  );
  const configurationFiles = Object.keys(rendered).filter((file) =>
    file.startsWith("config/"),
  );
  const generatedArtifacts = Object.keys(rendered).filter((file) =>
    file.startsWith("generated/"),
  );
  const productionState = Object.keys(rendered).filter((file) =>
    file.startsWith("automovie/productions/"),
  );
  // Not "the review directory ships empty": the review store is retired, so
  // the scaffold must carry no path under it at all.
  const reviewStore = Object.keys(rendered).filter((file) =>
    file.startsWith("automovie/reviews"),
  );
  const renderedMedia = Object.keys(rendered).filter(
    (file) => file.startsWith("renders/") && file !== "renders/README.md",
  );
  const publicMedia = Object.keys(rendered).filter(
    (file) =>
      /^public\/(?:assets|audio)\//u.test(file) && !file.endsWith("/README.md"),
  );
  const registeredAssets = (
    JSON.parse(rendered["automovie/assets.json"]!) as {
      assets: unknown[];
    }
  ).assets;
  const localLintImports = [
    ...lint.matchAll(/\bfrom\s+["']([^"']+)["'];/gu),
    ...lint.matchAll(/^import\s+["']([^"']+)["'];/gmu),
  ]
    .map((match) => match[1]!)
    .filter((specifier) => specifier.startsWith("."));

  TestValidator.equals(
    "the generated project starts with no inherited production",
    {
      designRecords,
      evidenceInDocs,
      configurationFiles,
      generatedArtifacts,
      localLintImports,
      productionState,
      productionDocuments,
      productionSources,
      publicMedia,
      registeredAssets,
      renderedMedia,
      reviewStore,
    },
    {
      designRecords: [],
      evidenceInDocs: [],
      configurationFiles: [],
      generatedArtifacts: [],
      localLintImports: [],
      productionState: [],
      productionDocuments: [],
      productionSources: [],
      publicMedia: [],
      registeredAssets: [],
      renderedMedia: [],
      reviewStore: [],
    },
  );
  TestValidator.equals(
    "the empty emitter refuses instead of claiming it generated a design",
    namedFacts([
      ["refuses", () => emitter.includes("throw new Error(")],
      [
        "explains the first action",
        () => emitter.includes("Select a production kind in lint.config.ts"),
      ],
      [
        "imports no completed production",
        () => /from ["']\.\.\/src\//u.test(emitter) === false,
      ],
      [
        "physical design tree is empty",
        () =>
          JSON.stringify(
            fs.readdirSync(path.join(scaffold, "automovie", "design")),
          ) === JSON.stringify([".gitkeep"]),
      ],
      [
        "viewer exposes one neutral replacement slot",
        () =>
          rendered["viewer/src/viewerDocument.ts"]!.includes(
            "export const VIEWER_BACKGROUND = 0x202020;",
          ),
      ],
      [
        "completed fixture retains its production emitter",
        () =>
          completedEmitter.includes("Repository-only emitter") &&
          completedEmitter.includes('from "../src/models/soloist"'),
      ],
      [
        "inherits no environmental study obligation",
        () => productionStudies.includes("required: []"),
      ],
      [
        "refuses a blank project name",
        () => throwsError(() => renderScaffold({ name: " " }), "project name"),
      ],
      [
        "refuses a non-portable project name",
        () =>
          throwsError(
            () => renderScaffold({ name: "invalid/name" }),
            "portable directory segment",
          ),
      ],
    ]),
    {
      refuses: true,
      "explains the first action": true,
      "imports no completed production": true,
      "physical design tree is empty": true,
      "viewer exposes one neutral replacement slot": true,
      "completed fixture retains its production emitter": true,
      "inherits no environmental study obligation": true,
      "refuses a blank project name": true,
      "refuses a non-portable project name": true,
    },
  );
  TestValidator.equals(
    "all scaffold paths resolve the generated project identity",
    Object.keys(rendered).every((file) => file.includes("{{name}}") === false),
    true,
  );
};
