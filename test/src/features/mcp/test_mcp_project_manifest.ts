import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

/**
 * Opening an existing project is a pure read (#700): a fresh directory gets its
 * manifest created once, but reopening an unchanged project must not rewrite
 * the file: an activation that churned the mtime would turn a `get*` read into
 * a disk write, and a round-trip that reserialized through the known-fields
 * type would drop any host/future manifest field. A real mutation
 * (`registerAsset`) still rewrites, and must carry the unknown field through.
 *
 * Scenarios:
 *
 * 1. A fresh dir → the manifest is created with `{version, assets}`.
 * 2. Reopening an unchanged project leaves the manifest file byte-identical (no
 *    write on open), including an unknown `future` field a newer host wrote.
 * 3. A mutation (`registerAsset`) rewrites the manifest yet preserves the unknown
 *    `future` field (the spread keeps it).
 * 4. A parseable but invalid manifest shape reports a project-state repair error
 *    on open, not a later raw TypeError.
 * 5. Parseable manifest assets still obey the same project-relative path policy as
 *    new registrations.
 * 6. Manifest asset entries remain a unique index after path normalization.
 */
export const test_mcp_project_manifest = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-manifest-"));
  const manifestPath = path.join(root, "automovie.json");
  try {
    // 1. fresh dir initializes the manifest once.
    AutoMovieProject.open(root);
    TestValidator.equals(
      "fresh manifest created",
      JSON.parse(fs.readFileSync(manifestPath, "utf8")),
      { version: 1, assets: [] },
    );

    // 2. hand-write a manifest carrying an unknown host/future field, then open
    //    the project and assert the file was NOT touched (read purity).
    const withUnknown = `${JSON.stringify(
      { version: 1, assets: ["models/a.glb"], future: { theme: "noir" } },
      null,
      2,
    )}\n`;
    fs.writeFileSync(manifestPath, withUnknown);
    const before = fs.readFileSync(manifestPath, "utf8");
    const project = AutoMovieProject.open(root);
    TestValidator.equals(
      "opening an existing project does not rewrite the manifest",
      fs.readFileSync(manifestPath, "utf8"),
      before,
    );
    TestValidator.equals(
      "the opened project sees the existing assets",
      project.assets,
      ["models/a.glb"],
    );

    // 3. a real mutation rewrites the manifest but keeps the unknown field.
    project.registerAsset("models/b.glb");
    const after = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    TestValidator.equals("mutation appends the asset", after.assets, [
      "models/a.glb",
      "models/b.glb",
    ]);
    TestValidator.equals(
      "mutation preserves the unknown future field",
      after.future,
      { theme: "noir" },
    );

    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify({ version: 1 }, null, 2)}\n`,
    );
    TestValidator.predicate(
      "invalid manifest has project guidance",
      throwsError(
        () => AutoMovieProject.open(root),
        ["AutoMovie project file", "automovie.json", "Fix or remove", "assets"],
      ),
    );

    for (const bad of [
      "../escape.glb",
      "/etc/passwd",
      "models//gap.glb",
      " ",
    ]) {
      fs.writeFileSync(
        manifestPath,
        `${JSON.stringify({ version: 1, assets: [bad] }, null, 2)}\n`,
      );
      TestValidator.predicate(
        `invalid manifest asset refuses: "${bad}"`,
        throwsError(
          () => AutoMovieProject.open(root),
          [
            "AutoMovie project file",
            "automovie.json",
            "Fix or remove",
            "assets[0]",
            "asset path",
          ],
        ),
      );
    }

    for (const assets of [
      ["models/a.glb", "models/a.glb"],
      ["models/a.glb", "models\\a.glb"],
    ]) {
      fs.writeFileSync(
        manifestPath,
        `${JSON.stringify({ version: 1, assets }, null, 2)}\n`,
      );
      TestValidator.predicate(
        `duplicate manifest asset refuses: ${assets.join(", ")}`,
        throwsError(
          () => AutoMovieProject.open(root),
          [
            "AutoMovie project file",
            "automovie.json",
            "Fix or remove",
            "assets[1]",
            "duplicate",
            "models/a.glb",
          ],
        ),
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
