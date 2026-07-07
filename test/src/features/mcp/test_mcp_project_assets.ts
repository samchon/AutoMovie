import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { throwsError } from "../internal/predicates";

/**
 * Binary assets are first-class managed artifacts (#614): the manifest tracks
 * project-relative paths, bytes write atomically when supplied, and nothing is
 * ever silently overwritten — an existing registration or an existing file is a
 * refusal, not a replace.
 *
 * Scenarios:
 *
 * 1. Registering with bytes writes the file and the manifest index — and the index
 *    survives reopen (durability).
 * 2. Registering the same path twice throws (assets are never replaced).
 * 3. Bytes aimed at an existing file throw (never overwrite), while registering
 *    WITHOUT bytes tracks a host-written file legally.
 * 4. Absolute, drive-lettered, `..`-escaping, and empty-segment paths throw.
 */
export const test_mcp_project_assets = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-assets-"));
  try {
    const project = AutoMovieProject.open(root);
    const registered = project.registerAsset(
      "models/crate.glb",
      new Uint8Array([103, 108, 84, 70]),
    );
    TestValidator.equals(
      "normalized path returned",
      registered,
      "models/crate.glb",
    );
    TestValidator.equals(
      "bytes written",
      fs.readFileSync(path.join(root, "models", "crate.glb")).length,
      4,
    );
    TestValidator.equals(
      "manifest tracks the asset across reopen",
      AutoMovieProject.open(root).summary().assets,
      ["models/crate.glb"],
    );

    TestValidator.predicate(
      "duplicate registration refuses",
      throwsError(
        () => project.registerAsset("models/crate.glb"),
        "already registered",
      ),
    );

    fs.writeFileSync(path.join(root, "models", "host.glb"), "host-made");
    TestValidator.predicate(
      "bytes at an existing file refuse",
      throwsError(
        () => project.registerAsset("models/host.glb", new Uint8Array([1])),
        "refusing to overwrite",
      ),
    );
    TestValidator.equals(
      "byte-less registration tracks a host-written file",
      project.registerAsset("models/host.glb"),
      "models/host.glb",
    );

    for (const bad of [
      "/etc/passwd",
      "C:/windows/system32",
      "models/../escape.glb",
      "models//gap.glb",
    ])
      TestValidator.predicate(
        `invalid path refuses: ${bad}`,
        throwsError(() => project.registerAsset(bad), "asset path"),
      );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
