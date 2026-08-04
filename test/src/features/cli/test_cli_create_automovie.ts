import { TestValidator } from "@nestia/e2e";
import { runCreateAutoMovie } from "create-automovie";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface ICreateAutoMovieFixtureFailure {
  error: unknown;
}

interface ICreateAutoMovieFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class CreateAutoMovieFixtureCleanupError extends AggregateError {}

/** Attempt every acquired fixture cleanup without replacing earlier failure. */
export const preserveCreateAutoMovieFixtureCleanup = (
  failure: ICreateAutoMovieFixtureFailure | undefined,
  resources: readonly ICreateAutoMovieFixtureCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new CreateAutoMovieFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Create-automovie fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/**
 * The package-manager-native creator delegates to the canonical scaffold.
 *
 * One call against an empty parent must create a usable project with the build,
 * lint, verifier, proxy/final render, viewer, and explicit Chromium doctor
 * surfaces; it must not install dependencies or fetch a browser implicitly.
 */
export const test_cli_create_automovie = (): void => {
  const nativeStdout = process.stdout.write;
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "create-automovie-"));
  let stdoutCaptureInstalled = false;
  let createFailure: ICreateAutoMovieFixtureFailure | undefined;
  try {
    const target = path.join(base, "my-film");
    let stdout = "";
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdout +=
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    stdoutCaptureInstalled = true;
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
        pkg.scripts?.build === "npm run compile" &&
        pkg.scripts?.lint ===
          "npm run lint:source && ttsx -P tsconfig.json scripts/lint.ts" &&
        pkg.scripts?.["lint:source"] === "ttsc --noEmit -p tsconfig.json" &&
        pkg.scripts?.verify === "tsx scripts/verify.ts" &&
        typeof pkg.scripts?.render === "string" &&
        typeof pkg.scripts?.viewer === "string" &&
        typeof pkg.scripts?.["capture:doctor"] === "string" &&
        fs.existsSync(path.join(target, ".mcp.json")) &&
        fs.readFileSync(path.join(target, ".npmrc"), "utf8") ===
          "onnxruntime-node-install-cuda=skip\n" &&
        fs.existsSync(path.join(target, "automovie.mcp.jsonc")) === false &&
        readme.includes("\nnpm run lint:source\n") &&
        readme.includes("\nnpm run lint\n") &&
        stdout.includes("\n  npm run lint:source\n  npm run lint\n") &&
        readme.includes("npm run verify") &&
        readme.includes("render all --tier proxy") &&
        readme.includes("http://127.0.0.1:5173") &&
        readme.includes("PLAYWRIGHT_DOWNLOAD_HOST") &&
        fs.existsSync(path.join(target, "node_modules")) === false &&
        fs.existsSync(path.join(target, ".automovie", "capture")) === false,
    );
  } catch (error) {
    createFailure = { error };
    throw error;
  } finally {
    const completedStdoutCapture = stdoutCaptureInstalled;
    preserveCreateAutoMovieFixtureCleanup(createFailure, [
      ...(completedStdoutCapture
        ? [
            {
              resource: "standard output",
              cleanup: (): void => {
                process.stdout.write = nativeStdout;
              },
            },
          ]
        : []),
      {
        resource: "temporary project root",
        cleanup: () => fs.rmSync(base, { force: true, recursive: true }),
      },
    ]);
  }
};
