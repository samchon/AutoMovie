import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { hasViolation, throwsError } from "../internal/predicates";

/**
 * RegisterAsset (#670): the manifest's asset index gains its MCP surface. The
 * tool tracks ONE project-relative path per call — byte-writing stays the host
 * adapter's job — and refuses duplicates and path escapes as violations on the
 * erase/set refusal ledger, so the guide's asset doctrine and the live tool
 * finally agree.
 *
 * Scenarios:
 *
 * 1. Registering a fresh backslash-spelled path returns the normalized
 *    forward-slash path, the manifest file (`automovie.json`) mirrors the
 *    index, and `nextSteps` status exposes it.
 * 2. Re-registering the same asset (spelled either way) is refused at
 *    `$input.path` and the index is unchanged — the duplicate twin.
 * 3. An empty path, an absolute path, and a `..` escape are each violations at
 *    `$input.path` with nothing registered.
 * 4. Without an active project the tool throws the actionable openProject prompt
 *    (infrastructure gate, not a ledger refusal).
 */
export const test_mcp_register_asset = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-regasset-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    const first = app.registerAsset({
      path: "renders\\beat-1\\frame_00000.png",
    });
    TestValidator.equals("fresh path registers", first.registered, true);
    TestValidator.equals(
      "path normalizes to forward slashes",
      first.path,
      "renders/beat-1/frame_00000.png",
    );
    TestValidator.equals("index carries the asset", first.assets, [
      "renders/beat-1/frame_00000.png",
    ]);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "automovie.json"), "utf8"),
    ) as { assets: string[] };
    TestValidator.equals("manifest file mirrors the index", manifest.assets, [
      "renders/beat-1/frame_00000.png",
    ]);
    TestValidator.equals(
      "nextSteps status exposes the asset",
      app.nextSteps().status.assets,
      ["renders/beat-1/frame_00000.png"],
    );

    const duplicate = app.registerAsset({
      path: "renders/beat-1/frame_00000.png",
    });
    TestValidator.equals("duplicate refused", duplicate.registered, false);
    TestValidator.equals("refused path is null", duplicate.path, null);
    TestValidator.predicate(
      "duplicate violation located at the path",
      hasViolation(duplicate.validation, "type", "$input.path"),
    );
    TestValidator.equals(
      "refused registration changes nothing",
      duplicate.assets,
      ["renders/beat-1/frame_00000.png"],
    );

    for (const bad of [" ", "/etc/passwd", "models/../escape.glb"]) {
      const refused = app.registerAsset({ path: bad });
      TestValidator.equals(
        `bad path refused: "${bad}"`,
        refused.registered,
        false,
      );
      TestValidator.predicate(
        `bad path violation at $input.path: "${bad}"`,
        hasViolation(refused.validation, "type", "$input.path"),
      );
    }
    TestValidator.equals(
      "no bad path leaked into the index",
      app.registerAsset({ path: "models/crate.glb" }).assets,
      ["renders/beat-1/frame_00000.png", "models/crate.glb"],
    );

    TestValidator.predicate(
      "no active project throws the openProject prompt",
      throwsError(
        () => new AutoMovieApplication().registerAsset({ path: "a.glb" }),
        "openProject",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
