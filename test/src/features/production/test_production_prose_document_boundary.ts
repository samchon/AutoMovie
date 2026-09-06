import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { productionFixture } from "./productionFixtures";

/**
 * A prose document a compiler-owned record addresses is read only from inside
 * the physical project root.
 *
 * Scenarios:
 *
 * 1. A tracked screenplay document reads back as its exact text.
 * 2. A path that escapes the root, an absent document, a directory, and a
 *    regular file reached through a directory link that resolves outside the
 *    project each read as `null` rather than as prose.
 */
export const test_production_prose_document_boundary = (): void => {
  const fixture = productionFixture();
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-prose-external-"),
  );
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const screenplay = project.screenplayIndex()!;
    const document = screenplay.screenplay.path;
    fs.writeFileSync(path.join(external, "scene.md"), "# Elsewhere\n", "utf8");
    fs.symlinkSync(
      external,
      path.join(fixture.root, "docs", "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    TestValidator.equals(
      "prose documents are read only from physical files inside the root",
      {
        tracked:
          project.readProseDocument(document) ===
          fs.readFileSync(
            path.join(fixture.root, ...document.split("/")),
            "utf8",
          ),
        escaping: project.readProseDocument("../outside.md"),
        absent: project.readProseDocument("docs/absent.md"),
        directory: project.readProseDocument("docs"),
        linked: project.readProseDocument("docs/linked/scene.md"),
      },
      {
        tracked: true,
        escaping: null,
        absent: null,
        directory: null,
        linked: null,
      },
    );
  } finally {
    fs.rmSync(path.join(fixture.root, "docs", "linked"), { force: true });
    fixture.dispose();
    fs.rmSync(external, { force: true, recursive: true });
  }
};
