import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { captureCliOutput as captureCli } from "./CliOutputCapture";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

interface ICliRenderFixtureFailure {
  error: unknown;
}

interface ICliRenderFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class CliRenderFixtureCleanupError extends AggregateError {}

/** Attempt every acquired fixture cleanup without replacing earlier failure. */
export const preserveCliRenderFixtureCleanup = (
  failure: ICliRenderFixtureFailure | undefined,
  resources: readonly ICliRenderFixtureCleanup[],
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
    throw new CliRenderFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `CLI render fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

/**
 * The public CLI delegates bounded render and verification actions to the
 * current scaffold.
 *
 * Scenarios:
 *
 * 1. Missing/unknown actions and an uninstalled project fail with correction.
 * 2. A scaffold-local tsx entry receives the render script, action, and options in
 *    exact order.
 * 3. The public CLI propagates the child process exit status.
 * 4. `verify` accepts no arguments and delegates the read-only final verifier.
 */
export const test_cli_render = (): void => {
  const nativeCwd = process.cwd();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-cli-out-"));
  let projectRoot: string | undefined;
  let renderFailure: ICliRenderFixtureFailure | undefined;
  try {
    const project = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-cli-render-"),
    );
    projectRoot = project;
    process.chdir(outside);
    const missingAction = captureCli(["render"]);
    const unknownAction = captureCli(["render", "unknown"]);
    const missingProject = captureCli(["render", "plan"]);
    const missingVerify = captureCli(["verify"]);
    const invalidVerify = captureCli(["verify", "--repair"]);
    fs.mkdirSync(path.join(outside, "scripts"), { recursive: true });
    fs.writeFileSync(
      path.join(outside, "scripts", "render.ts"),
      "// missing tsx runtime\n",
    );
    const missingTsx = captureCli(["render", "status"]);
    TestValidator.equals(
      "render CLI rejects bad actions and missing project runtime",
      namedFacts([
        ["missingActionStatus", () => missingAction.status === 1],
        [
          "missingActionStderr",
          () => missingAction.stderr.includes("render needs one of"),
        ],
        ["unknownActionStatus", () => unknownAction.status === 1],
        [
          "unknownActionStderr",
          () => unknownAction.stderr.includes("render needs one of"),
        ],
        ["missingProjectStatus", () => missingProject.status === 1],
        [
          "missingProjectStderr",
          () => missingProject.stderr.includes("scaffolded project"),
        ],
        ["missingVerifyStatus", () => missingVerify.status === 1],
        [
          "missingVerifyStderr",
          () => missingVerify.stderr.includes("scaffolded project"),
        ],
        ["invalidVerifyStatus", () => invalidVerify.status === 1],
        [
          "invalidVerifyStderr",
          () => invalidVerify.stderr.includes("takes no arguments"),
        ],
        ["missingTsxStatus", () => missingTsx.status === 1],
        [
          "missingTsxStderr",
          () => missingTsx.stderr.includes("scaffolded project"),
        ],
      ]),
      {
        missingActionStatus: true,
        missingActionStderr: true,
        unknownActionStatus: true,
        unknownActionStderr: true,
        missingProjectStatus: true,
        missingProjectStderr: true,
        missingVerifyStatus: true,
        missingVerifyStderr: true,
        invalidVerifyStatus: true,
        invalidVerifyStderr: true,
        missingTsxStatus: true,
        missingTsxStderr: true,
      },
    );

    const script = path.join(project, "scripts", "render.ts");
    const verifyScript = path.join(project, "scripts", "verify.ts");
    const tsx = path.join(project, "node_modules", "tsx", "dist", "cli.mjs");
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.mkdirSync(path.dirname(tsx), { recursive: true });
    fs.writeFileSync(script, "// delegated scaffold render entry\n");
    fs.writeFileSync(verifyScript, "// delegated scaffold verify entry\n");
    fs.writeFileSync(
      tsx,
      `import fs from "node:fs";
fs.writeFileSync(
  "render-call.json",
  JSON.stringify(process.argv.slice(2)),
);
if (process.argv[3] === "verify") process.exitCode = 7;
if (process.argv[3] === "finalize") process.kill(process.pid, "SIGTERM");
if (process.argv[2]?.endsWith("verify.ts"))
  fs.writeFileSync("verify-call.json", JSON.stringify(process.argv.slice(2)));
`,
    );
    process.chdir(project);
    const delegated = captureCli([
      "render",
      "run",
      "--deliverable",
      "feature",
      "--workers",
      "3",
    ]);
    const call = JSON.parse(
      fs.readFileSync(path.join(project, "render-call.json"), "utf8"),
    ) as string[];
    const planned = captureCli(["render", "plan"]);
    const status = captureCli(["render", "status"]);
    const all = captureCli(["render", "all", "--tier", "proxy"]);
    const gc = captureCli(["render", "gc", "--apply"]);
    const propagated = captureCli(["render", "verify"]);
    const signaled = captureCli(["render", "finalize"]);
    const verified = captureCli(["verify"]);
    const verifyCall = JSON.parse(
      fs.readFileSync(path.join(project, "verify-call.json"), "utf8"),
    ) as string[];
    TestValidator.equals(
      "render CLI delegates exact argv and propagates child status",
      namedFacts([
        ["delegatedStatus", () => delegated.status === 0],
        ["callScript", () => path.resolve(call[0]!) === script],
        [
          "callRun",
          () =>
            call.slice(1).join(",") === "run,--deliverable,feature,--workers,3",
        ],
        ["plannedStatus", () => planned.status === 0],
        ["statusStatus", () => status.status === 0],
        ["allStatus", () => all.status === 0],
        ["gcStatus", () => gc.status === 0],
        ["propagatedStatus", () => propagated.status === 7],
        ["signaledStatus", () => signaled.status === 1],
        ["verifiedStatus", () => verified.status === 0],
        [
          "verifyCallVerifyScript",
          () => path.resolve(verifyCall[0]!) === verifyScript,
        ],
        ["verifyCallCount", () => verifyCall.length === 1],
      ]),
      {
        delegatedStatus: true,
        callScript: true,
        callRun: true,
        plannedStatus: true,
        statusStatus: true,
        allStatus: true,
        gcStatus: true,
        propagatedStatus: true,
        signaledStatus: true,
        verifiedStatus: true,
        verifyCallVerifyScript: true,
        verifyCallCount: true,
      },
    );
  } catch (error) {
    renderFailure = { error };
    throw error;
  } finally {
    const completedProjectRoot = projectRoot;
    preserveCliRenderFixtureCleanup(renderFailure, [
      {
        resource: "working directory",
        cleanup: () => process.chdir(nativeCwd),
      },
      {
        resource: "outside fixture root",
        cleanup: () => fs.rmSync(outside, { force: true, recursive: true }),
      },
      ...(completedProjectRoot === undefined
        ? []
        : [
            {
              resource: "project fixture root",
              cleanup: () =>
                fs.rmSync(completedProjectRoot, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }
};
