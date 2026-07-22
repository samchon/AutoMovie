import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * The dependency lifecycle-script allowlist lives where pinned pnpm 10 reads
 * project settings: `pnpm-workspace.yaml`, never the root package's ignored
 * `pnpm` object (#1370). A static guard is the durable oracle because `pnpm
 * config get` reports config-file settings, not workspace-manifest fields.
 */
export const test_workspace_pnpm_policy = (): void => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
  ) as Record<string, unknown>;
  const workspace = fs.readFileSync(
    path.join(ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );
  TestValidator.equals(
    "the root package has no ignored pnpm settings object",
    manifest.pnpm,
    undefined,
  );
  TestValidator.equals(
    "pnpm 10 reads the esbuild-only lifecycle allowlist from the workspace manifest",
    workspace.match(/^onlyBuiltDependencies:\r?\n {2}- esbuild$/gm)?.length ??
      0,
    1,
  );
};
