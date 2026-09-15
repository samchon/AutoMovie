import { AutoMovieProductionBinder } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

/** The reader binder resolves the reviewed final screenplay tree explicitly. */
export const test_production_document_binder_final_pass = (): void => {
  const root = path.resolve("production");
  const binder = new AutoMovieProductionBinder({
    root,
    title: "Reader Edition",
    layer: "screenplays",
    pass: "final",
  });
  TestValidator.equals(
    "a final edition exposes its exact authored source and output identity",
    {
      pass: binder.pass,
      source: binder.source,
      filename: binder.filename,
    },
    {
      pass: "final",
      source: path.join(root, "docs", "final", "screenplays"),
      filename: "reader-edition-final-screenplays.md",
    },
  );
  const construction = new AutoMovieProductionBinder({
    root,
    title: "Working Edition",
    layer: "screenplays",
  });
  TestValidator.equals(
    "the API default remains the construction tree",
    {
      pass: construction.pass,
      source: construction.source,
      filename: construction.filename,
    },
    {
      pass: "construction",
      source: path.join(root, "docs", "screenplays"),
      filename: "working-edition-screenplays.md",
    },
  );
  TestValidator.error(
    "non-screenplay final passes are refused",
    () =>
      new AutoMovieProductionBinder({
        root,
        title: "Invalid",
        layer: "scripts",
        pass: "final",
      }),
  );
};
