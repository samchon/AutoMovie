import { TestValidator } from "@nestia/e2e";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * The coordination root can be pointed somewhere both processes can reach.
 *
 * The root-lock path is `os.homedir()/.automovie-root-locks`, and the home does
 * not satisfy the one invariant that path has: **two processes reaching one
 * project must compute the same path.** It fails that in two measured ways. On
 * one machine `os.homedir()` resolved to `CodexSandboxOffline` for an authoring
 * agent and to `samch` for the process driving it, so both computed the same
 * coordinate under different roots — same name, two directories, no exclusion,
 * and neither able to list the other. On another the account owned the home and
 * the sandbox denied the write regardless, because its writable roots are the
 * workdir and the temporary directories while the home sits outside both. That
 * is every sandboxed authoring agent, which is the arrangement this product is
 * built around.
 *
 * `AUTOMOVIE_COORDINATION_ROOT` moves the root. It is a path and never a
 * switch: it relocates the fence and cannot disable it, so an operator pointing
 * both processes at one directory satisfies the invariant by configuration.
 * That is the only thing available while no path is both machine-global and
 * writable by every account that runs this product, and it does not settle
 * `#2012`, which is that larger question.
 *
 * Run in child processes because the module caches its answer on first use and
 * this suite has already imported it, so the environment has to be in place
 * before the module evaluates.
 *
 * Scenarios:
 *
 * 1. An absolute override is used instead of the home: the lease's lock file
 *    appears under the configured directory. Asserted by finding the file
 *    rather than by the call succeeding, because a lease taken under the home
 *    also succeeds and would pass a weaker check.
 * 2. A relative override is refused, naming the variable and saying why: it
 *    would resolve against each process's own working directory and reproduce
 *    exactly the divergence it was set to remove.
 * 3. A root this process cannot write refuses during preparation, naming the
 *    variable as the remedy. Before this, the denial surfaced later at the lock
 *    file's own `open()` — an errno about a path the reader never chose, with
 *    nothing to do about it.
 */
export const test_production_coordination_root_override = async (): Promise<void> => {
  const [honoured, relative, denied] = await Promise.all([
    probe("absolute"),
    probe("relative"),
    probe("denied"),
  ]);

  TestValidator.equals(
    "an absolute override moves the coordination root off the home",
    namedFacts([
      ["the lease is taken", () => honoured.leased === true],
      // The lock file, not the return value. A lease under the home succeeds
      // too, so only the file's location proves the override was read.
      [
        "and its lock file lands in the configured directory",
        () => honoured.locksInRoot >= 1,
      ],
      ["with no refusal", () => honoured.refusal === ""],
    ]),
    {
      "the lease is taken": true,
      "and its lock file lands in the configured directory": true,
      "with no refusal": true,
    },
  );

  TestValidator.equals(
    "a relative override is refused rather than resolved",
    namedFacts([
      ["it refuses", () => relative.leased === false],
      [
        "naming the variable",
        () => relative.refusal.includes("AUTOMOVIE_COORDINATION_ROOT"),
      ],
      // The reason, not just the rule. A reader who does not know why relative
      // is wrong will set it relative again from a different directory.
      [
        "and saying why a relative root cannot work",
        () =>
          relative.refusal.includes("working directory") &&
          relative.refusal.includes("exclude nothing"),
      ],
    ]),
    {
      "it refuses": true,
      "naming the variable": true,
      "and saying why a relative root cannot work": true,
    },
  );

  TestValidator.equals(
    "an unwritable coordination root refuses with the remedy rather than an errno",
    namedFacts([
      ["it refuses", () => denied.leased === false],
      [
        "the refusal names the directory it cannot write",
        () => denied.refusal.includes("root-lock coordination directory"),
      ],
      [
        "and names the variable that moves it",
        () => denied.refusal.includes("AUTOMOVIE_COORDINATION_ROOT"),
      ],
      // The half an operator gets wrong: moving one process's root and not the
      // other's is worse than not moving either, because both then proceed.
      [
        "and says both processes must be set to the same value",
        () => denied.refusal.includes("exclude nothing"),
      ],
      // It refused during preparation. The old failure arrived at the lock
      // file's own open(), after the caller had already been admitted.
      ["and it never reached a lock file", () => denied.locksInRoot === 0],
    ]),
    {
      "it refuses": true,
      "the refusal names the directory it cannot write": true,
      "and names the variable that moves it": true,
      "and says both processes must be set to the same value": true,
      "and it never reached a lock file": true,
    },
  );
};

interface IProbe {
  leased: boolean;
  refusal: string;
  locksInRoot: number;
}

/**
 * Take one lease in a child process under a chosen coordination root.
 *
 * Each probe gets its own directory: a lease is a file that outlives the
 * process which took it, so probes sharing a root would leave later ones
 * refused by earlier ones' leftovers.
 */
const probe = async (
  mode: "absolute" | "relative" | "denied",
): Promise<IProbe> => {
  const cache = path.resolve(__dirname, "../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, "automovie-coord-"));
  const project = path.join(directory, "project");
  const coordination = path.join(directory, "coordination");
  fs.mkdirSync(project);
  fs.mkdirSync(coordination);
  const configured = mode === "relative" ? "./relative-locks" : coordination;
  const script = `
    process.env.AUTOMOVIE_COORDINATION_ROOT = ${JSON.stringify(configured)};
    const fs = require("node:fs");
    ${
      mode === "denied"
        ? `
    // The write denial a sandbox produces, reproduced here rather than by a
    // permission bit: Windows read-only directories still admit new files, so
    // a mode change would test nothing on half the hosts this runs on.
    const access = fs.accessSync;
    (fs as Record<string, unknown>).accessSync = (
      target: unknown,
      requested?: number,
    ): void => {
      if (String(target) === ${JSON.stringify(coordination)})
        throw Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        });
      access(target, requested);
    };`
        : ""
    }
    const out = { leased: false, refusal: "", locksInRoot: 0 };
    import("@automovie/production")
      .then((mcp) => {
        try {
          const lease = mcp.acquireProductionRootNamespace(${JSON.stringify(project)});
          out.leased = true;
          out.locksInRoot = fs
            .readdirSync(${JSON.stringify(coordination)})
            .filter((name: string) => name.endsWith(".lock")).length;
          mcp.releaseProductionRootNamespace(lease);
        } catch (error) {
          out.refusal = error instanceof Error ? error.message : String(error);
          out.locksInRoot = fs.existsSync(${JSON.stringify(coordination)})
            ? fs
                .readdirSync(${JSON.stringify(coordination)})
                .filter((name: string) => name.endsWith(".lock")).length
            : 0;
        }
      })
      .catch((error: unknown) => {
        out.refusal = error instanceof Error ? error.message : String(error);
      })
      .finally(() => console.log("PROBE" + JSON.stringify(out)));
  `;
  const file = path.join(directory, "probe.ts");
  fs.writeFileSync(file, script, "utf8");
  // Spawned rather than `spawnSync`, so the three probes run at once. Each
  // one pays a full package import, and run sequentially they were the
  // slowest case in the suite by a wide margin; nothing about them is
  // ordered, since each fences its own directory.
  let run: { stdout: string; stderr: string };
  try {
    run = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            path.resolve(
              __dirname,
              "../../../node_modules/ttsc/lib/launcher/ttsx.js",
            ),
            file,
          ],
          { cwd: path.resolve(__dirname, "../../..") },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString("utf8");
        });
        child.on("error", reject);
        child.on("close", () => resolve({ stdout, stderr }));
      },
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  const line = run.stdout
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.startsWith("PROBE"));
  if (line === undefined)
    throw new Error(
      `The coordination-root probe printed no result, so this case measured nothing. stderr: ${run.stderr.slice(0, 400)}`,
    );
  return JSON.parse(line.slice("PROBE".length)) as IProbe;
};
