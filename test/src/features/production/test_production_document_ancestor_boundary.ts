import {
  type AutoMovieProductionDocumentPass,
  validateAutoMovieProductionDocumentAncestors,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

/**
 * A final edition must not follow a linked docs ancestor hidden above final.
 *
 * Scenarios:
 * 1. Construction observes docs alone; final observes docs then docs/final.
 * 2. A missing, linked, or non-directory ancestor refuses either selected pass.
 * 3. A normal physical final ancestor remains accepted after each negative.
 */
export const test_production_document_ancestor_boundary =
  async (): Promise<void> => {
    const root = path.resolve("production");
    const docs = path.join(root, "docs");
    for (const pass of [
      "construction",
      "final",
    ] as const satisfies readonly AutoMovieProductionDocumentPass[]) {
      const expected =
        pass === "final" ? [docs, path.join(docs, "final")] : [docs];
      const observed: string[] = [];
      await validateAutoMovieProductionDocumentAncestors(
        root,
        pass,
        async (directory) => {
          observed.push(directory);
          return { isSymbolicLink: () => false, isDirectory: () => true };
        },
      );
      TestValidator.equals(
        `${pass} checks its complete ancestor chain`,
        observed,
        expected,
      );
      for (const failed of expected)
        for (const defect of ["missing", "link", "file"] as const) {
          const result = await validateAutoMovieProductionDocumentAncestors(
            root,
            pass,
            async (directory) => {
              if (directory === failed && defect === "missing")
                throw new Error("Absent directory");
              return {
                isSymbolicLink: () => directory === failed && defect === "link",
                isDirectory: () => directory !== failed || defect !== "file",
              };
            },
          )
            .then(() => "accepted")
            .catch((error: unknown) => String(error));
          TestValidator.predicate(
            `${pass} refuses ${defect} at ${failed}`,
            result.includes(
              `${failed}: authored docs must be one physical directory.`,
            ),
          );
        }
      await validateAutoMovieProductionDocumentAncestors(
        root,
        pass,
        async () => ({ isSymbolicLink: () => false, isDirectory: () => true }),
      );
    }
  };
