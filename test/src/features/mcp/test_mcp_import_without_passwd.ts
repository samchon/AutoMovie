import { TestValidator } from "@nestia/e2e";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * Importing the package asks for no capability the caller has not used.
 *
 * `rootNamespaceLock` needs a home directory to name the path every process on
 * one machine fences against, and it used to read that at module scope. The
 * barrel re-exports the module, so `import("@automovie/mcp")` evaluated the
 * syscall, and where the syscall is denied the package could not be imported at
 * all: not degraded, not partly working — the import threw before any of the
 * surface existed, taking every scaffold script that reaches the package with
 * it.
 *
 * That environment is the one an authoring agent works in. Two drivers of the
 * `#1954` benchmark measured it in separate sandboxes: inside the Codex sandbox
 * the call fails as `uv_os_get_passwd returned ENOMEM` while gigabytes are
 * free, naming a resource that is not the problem, and the same call succeeds
 * for the same user outside.
 *
 * The denial is reproduced here by replacing both readers in a child process
 * rather than by a sandbox, because what has to hold is a property of this
 * module and not of anyone's environment: whatever the reason a home directory
 * cannot be read, the import must survive it and the refusal must arrive only
 * when a lease is actually taken.
 *
 * Scenarios:
 *
 * 1. With both `os.homedir()` and `os.userInfo()` throwing, importing the
 *    package succeeds and its surface is present, so nothing is paid for by a
 *    caller that never fences.
 * 2. Taking a lease in that state refuses, and the refusal names the capability
 *    and says why a fallback path is not offered — two processes fencing
 *    against different roots is the state these locks exist to prevent.
 * 3. The negative twin: with the readers intact the same import and the same
 *    call behave normally, so scenario 1 is not passing because the module was
 *    inert.
 * 4. `os.homedir()` alone is enough. With only `os.userInfo()` throwing the
 *    lease still resolves, which is what makes the passwd entry a fallback
 *    rather than the source.
 */
export const test_mcp_import_without_passwd = async (): Promise<void> => {
  // Concurrent, because each probe pays a full package import and none of them
  // is ordered against another: the comment on `probe` explains that each one
  // already fences its own directory, which is what makes this safe.
  const [denied, partial, intact] = await Promise.all([
    probe("both"),
    probe("passwd-only"),
    probe("none"),
  ]);

  TestValidator.equals(
    "the package imports where the home directory cannot be read",
    namedFacts([
      ["it imports", () => denied.imported === true],
      ["its surface is there", () => denied.surface === true],
      ["taking a lease is what refuses", () => denied.leased === false],
      [
        "and the refusal names the capability rather than a memory fault",
        () => denied.refusal.includes("home directory"),
      ],
      [
        "and says why no fallback path is offered",
        () => denied.refusal.includes("fence against different roots"),
      ],
    ]),
    {
      "it imports": true,
      "its surface is there": true,
      "taking a lease is what refuses": true,
      "and the refusal names the capability rather than a memory fault": true,
      "and says why no fallback path is offered": true,
    },
  );

  TestValidator.equals(
    "the readers are what the case removed, so the clean run still leases",
    namedFacts([
      ["intact imports", () => intact.imported === true],
      ["intact leases", () => intact.leased === true],
      // The passwd entry is the fallback, not the source: losing it alone
      // changes nothing.
      [
        "losing only the passwd entry changes nothing",
        () => partial.leased === true,
      ],
    ]),
    {
      "intact imports": true,
      "intact leases": true,
      "losing only the passwd entry changes nothing": true,
    },
  );
};

interface IProbe {
  imported: boolean;
  surface: boolean;
  leased: boolean;
  refusal: string;
}

/**
 * Import the package in a child whose home-directory readers are removed.
 *
 * A child process, because the replacement has to be in place before the module
 * evaluates and this suite has already imported it. `deny` selects which
 * readers throw, so the same script covers the denial, the passwd-only case and
 * the untouched control without three copies of the harness.
 */
const probe = async (
  deny: "both" | "passwd-only" | "none",
): Promise<IProbe> => {
  // The readers to remove, chosen here rather than compared inside the probe:
  // a literal comparison against an interpolated constant is a type error the
  // launcher refuses, and a list says the same thing without one.
  const removed: ReadonlyArray<"userInfo" | "homedir"> =
    deny === "both"
      ? ["userInfo", "homedir"]
      : deny === "passwd-only"
        ? ["userInfo"]
        : [];
  // Each probe fences its own directory. A lease is a file in the coordination
  // root and it outlives the process that took it, so probes sharing one root
  // would leave the later ones refused by the earlier ones' leftovers -- which
  // is how this case first failed, and is the separate defect `#1994` names.
  const cache = path.resolve(__dirname, "../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, "automovie-passwd-"));
  const root = path.join(directory, "root");
  fs.mkdirSync(root);
  const script = `
    const os = require("node:os");
    const fail = (name: "userInfo" | "homedir"): void => {
      (os as unknown as Record<string, () => never>)[name] = (): never => {
        throw Object.assign(new Error("uv_os_get_passwd returned ENOMEM"), {
          code: "ENOMEM",
        });
      };
    };
    for (const name of ${JSON.stringify(removed)} as ReadonlyArray<"userInfo" | "homedir">)
      fail(name);
    const out = { imported: false, surface: false, leased: false, refusal: "" };
    import("@automovie/mcp")
      .then((mcp) => {
        out.imported = true;
        out.surface = typeof mcp.AutoMovieProductionProject === "function";
        try {
          const lease = mcp.acquireProductionRootNamespace(${JSON.stringify(root)});
          out.leased = true;
          // Released rather than dropped, so a passing run leaves the
          // coordination root as it found it.
          mcp.releaseProductionRootNamespace(lease);
        } catch (error) {
          out.refusal = error instanceof Error ? error.message : String(error);
        }
      })
      .catch((error: unknown) => {
        out.refusal = error instanceof Error ? error.message : String(error);
      })
      .finally(() => console.log("PROBE" + JSON.stringify(out)));
  `;
  // Written to a file and run through the launcher this suite itself uses,
  // rather than through `-e`: the module under test is TypeScript and an
  // inline script needs a loader that resolves it. Same runner as the parent
  // means the child resolves the same way.
  // Under the test package rather than the system temporary directory: the
  // launcher looks for a tsconfig starting from the script it is given, and a
  // system path has none above it. This is the same reason
  // `test_mcp_guide_snippet_compilation` writes its scratch modules here.
  const file = path.join(directory, "probe.ts");
  fs.writeFileSync(file, script, "utf8");
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
      `The import probe printed no result, so this case measured nothing. stderr: ${run.stderr.slice(0, 400)}`,
    );
  return JSON.parse(line.slice("PROBE".length)) as IProbe;
};
