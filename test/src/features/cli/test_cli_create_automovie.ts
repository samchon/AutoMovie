import { TestValidator } from "@nestia/e2e";
import { runCreateAutoMovie } from "create-automovie";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * The package-manager-native creator delegates to the canonical scaffold.
 *
 * One call against an empty parent must create a usable project with the build,
 * lint, verifier, proxy/final render, viewer, and explicit Chromium doctor
 * surfaces; it must not install dependencies or fetch a browser implicitly.
 */
export const test_cli_create_automovie = (): void => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "create-automovie-"));
  const target = path.join(base, "my-film");
  try {
    const status = runCreateAutoMovie([
      process.execPath,
      "create-automovie",
      target,
    ]);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(target, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const readme = fs.readFileSync(path.join(target, "README.md"), "utf8");
    TestValidator.predicate(
      "one creator call writes every project workflow without hidden installs",
      status === 0 &&
        pkg.scripts?.build === "pnpm compile" &&
        typeof pkg.scripts?.lint === "string" &&
        pkg.scripts?.verify === "tsx scripts/verify.ts" &&
        typeof pkg.scripts?.render === "string" &&
        typeof pkg.scripts?.viewer === "string" &&
        typeof pkg.scripts?.["capture:doctor"] === "string" &&
        readme.includes("render all --tier proxy") &&
        readme.includes("PLAYWRIGHT_DOWNLOAD_HOST") &&
        fs.existsSync(path.join(target, "node_modules")) === false &&
        fs.existsSync(path.join(target, ".automovie", "capture")) === false,
    );
  } finally {
    fs.rmSync(base, { force: true, recursive: true });
  }
};
