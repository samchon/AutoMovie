import { run } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface ICliResult {
  status: number;
  stdout: string;
  stderr: string;
}

const captureCli = (args: readonly string[]): ICliResult => {
  const nativeStdout = process.stdout.write;
  const nativeStderr = process.stderr.write;
  let stdout = "";
  let stderr = "";
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  try {
    return {
      status: run(["node", "automovie", ...args]),
      stdout,
      stderr,
    };
  } finally {
    process.stdout.write = nativeStdout;
    process.stderr.write = nativeStderr;
  }
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
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-cli-out-"));
  const project = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-cli-render-"),
  );
  const nativeCwd = process.cwd();
  try {
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
    TestValidator.predicate(
      "render CLI rejects bad actions and missing project runtime",
      missingAction.status === 1 &&
        missingAction.stderr.includes("render needs one of") &&
        unknownAction.status === 1 &&
        unknownAction.stderr.includes("render needs one of") &&
        missingProject.status === 1 &&
        missingProject.stderr.includes("scaffolded project") &&
        missingVerify.status === 1 &&
        missingVerify.stderr.includes("scaffolded project") &&
        invalidVerify.status === 1 &&
        invalidVerify.stderr.includes("takes no arguments") &&
        missingTsx.status === 1 &&
        missingTsx.stderr.includes("scaffolded project"),
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
    TestValidator.predicate(
      "render CLI delegates exact argv and propagates child status",
      delegated.status === 0 &&
        path.resolve(call[0]!) === script &&
        call.slice(1).join(",") === "run,--deliverable,feature,--workers,3" &&
        planned.status === 0 &&
        status.status === 0 &&
        all.status === 0 &&
        gc.status === 0 &&
        propagated.status === 7 &&
        signaled.status === 1 &&
        verified.status === 0 &&
        path.resolve(verifyCall[0]!) === verifyScript &&
        verifyCall.length === 1,
    );
  } finally {
    process.chdir(nativeCwd);
    fs.rmSync(outside, { force: true, recursive: true });
    fs.rmSync(project, { force: true, recursive: true });
  }
};
