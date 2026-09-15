import { resolveAutoMovieProductionEvidencePopulationFiles } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

/**
 * A citation base cannot enroll unrelated files into a physical evidence walk.
 *
 * Scenarios:
 *
 * 1. Project-rooted source selectors walk src, not vendored or tool files.
 * 2. Document selectors keep final screenplays inside the docs population.
 * 3. Non-selected and empty candidates disappear; output ordering stays stable.
 */
export const test_evidence_population_inventory = (): void => {
  const project = path.resolve("production");
  const walks: string[] = [];
  const source = resolveAutoMovieProductionEvidencePopulationFiles(
    project,
    ".",
    ["src/spaces/*.ts"],
    undefined,
    {
      walk: (root, directory, extension) => {
        TestValidator.equals("same project boundary", root, project);
        TestValidator.equals("source extension", extension, ".ts");
        walks.push(directory);
        return [
          "src/spaces/z.ts",
          "src/models/other.ts",
          "src/spaces/a.ts",
        ].map((file) => path.resolve(root, file));
      },
      glob: (patterns, root) => {
        TestValidator.equals("unchanged selectors", patterns, [
          "src/spaces/*.ts",
        ]);
        TestValidator.equals("citation root", root, project);
        return ["src/spaces/a.ts", "src/spaces/z.ts", "vendor/irrelevant.ts"];
      },
    },
  );
  TestValidator.equals("source inventory", source, [
    "src/spaces/a.ts",
    "src/spaces/z.ts",
  ]);
  const final = "final/screenplays/001-film/001-opening.md";
  const documents = resolveAutoMovieProductionEvidencePopulationFiles(
    project,
    "docs",
    ["final/screenplays/**/*.md"],
    ".md",
    {
      walk: (root, directory, extension) => {
        TestValidator.equals("document extension", extension, ".md");
        walks.push(directory);
        return [path.resolve(root, "docs", final)];
      },
      glob: (_patterns, root) => {
        TestValidator.equals(
          "document citation root",
          root,
          path.resolve(project, "docs"),
        );
        return [final];
      },
    },
  );
  TestValidator.equals("final source owner target", documents, [
    "docs/" + final,
  ]);
  TestValidator.equals("only controlled trees are walked", walks, [
    path.resolve(project, "src"),
    path.resolve(project, "docs"),
  ]);
  TestValidator.equals(
    "empty inventory",
    resolveAutoMovieProductionEvidencePopulationFiles(
      project,
      ".",
      ["src/*.ts"],
      ".ts",
      { walk: () => [], glob: () => [] },
    ),
    [],
  );
};
