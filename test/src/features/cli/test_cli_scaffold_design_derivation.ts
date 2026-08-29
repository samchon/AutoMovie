import { renderScaffold, scaffoldAssetDirectory } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { throwsError } from "../internal/predicates";

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
  const productionDocumentPattern =
    /^docs\/(?:settings|research|maps|models|spaces|materials|instances|motions|systems|treatments|scripts|screenplays|briefs)\/.+\.md$/u;
  const evidenceInProductionDocs = Object.entries(rendered)
    .filter(([file]) => productionDocumentPattern.test(file))
    .filter(([, content]) => /@evidence[A-Za-z]*\b/u.test(content))
    .map(([file]) => file);
  const productionSourcePattern =
    /^(?:src\/(?:maps|models|spaces|materials|instances|motions|systems|shots)\/.+\.ts|src\/(?:production|film)\.ts)$/u;
  const productionDocuments = Object.keys(rendered).filter((file) =>
    productionDocumentPattern.test(file),
  );
  const productionSources = Object.keys(rendered).filter((file) =>
    productionSourcePattern.test(file),
  );
  const designRecords = Object.keys(rendered).filter((file) =>
    /^(?:\.automovie|automovie)\/design\/.+\.json$/u.test(file),
  );
  const productionState = Object.keys(rendered).filter((file) =>
    /^(?:\.automovie|automovie)\/(?:productions|reviews)\//u.test(file),
  );
  const renderedMedia = Object.keys(rendered).filter(
    (file) => file.startsWith("renders/") && file !== "renders/README.md",
  );
  const publicMedia = Object.keys(rendered).filter(
    (file) =>
      /^public\/(?:assets|audio)\//u.test(file) && !file.endsWith("/README.md"),
  );
  TestValidator.equals(
    "the generated project starts with no inherited production",
    {
      designRecords,
      evidenceInProductionDocs,
      productionState,
      productionDocuments,
      productionSources,
      publicMedia,
      renderedMedia,
    },
    {
      designRecords: [],
      evidenceInProductionDocs: [],
      productionState: [],
      productionDocuments: [],
      productionSources: [],
      publicMedia: [],
      renderedMedia: [],
    },
  );
  TestValidator.equals(
    "the renderer refuses invalid project identities",
    {
      blank: throwsError(() => renderScaffold({ name: " " }), "project name"),
      nonPortable: throwsError(
        () => renderScaffold({ name: "invalid/name" }),
        "portable directory segment",
      ),
    },
    { blank: true, nonPortable: true },
  );
  TestValidator.equals(
    "all scaffold paths resolve the generated project identity",
    Object.keys(rendered).every((file) => file.includes("{{name}}") === false),
    true,
  );
};
