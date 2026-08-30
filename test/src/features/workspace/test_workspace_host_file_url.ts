import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  authoredSources,
  findHostFileUrls,
  inspectHostFileUrls,
  reportHostFileUrls,
  runHostFileUrlGate,
} from "../../integrity/hostFileUrl";

const ROOT = path.resolve(__dirname, "../../../..");

/**
 * `file://` is not string arithmetic, and now something says so on every run.
 *
 * Three times this repository spelled a host path after the scheme or took the
 * scheme apart by hand, and each time only one platform noticed. The first cost
 * the most: `coverageScriptShapes` stripped three characters off every URL and
 * therefore reported zero measured scripts on Linux for its whole life. The
 * second failed one Ubuntu lane. The third was written into the commit that
 * fixed the second, in the same file, which is what settled that discipline was
 * not going to be enough.
 *
 * The distinction the gate turns on is position, not presence. An interpolation
 * immediately after `file:///` is a path being spelled in; one further along is
 * a path segment, and `file:///repo/packages/engine/src/${name}.ts` is a fixed
 * synthetic address that reaches no host. That is why this is a rule rather
 * than a list of file names: the repository's one legitimate constant passes
 * because of what it is, not because it was named.
 *
 * Scenarios:
 *
 * 1. All three historical shapes are caught, each named for the mistake it
 *    makes, and the fixed synthetic constant beside them is not.
 * 2. A sentence about the mistake is not the mistake. Without that this module
 *    and the gate's own reasons could not be written down.
 * 3. The walk skips `node_modules` and dotted directories and returns a stable
 *    order, and a root that does not exist is passed over rather than thrown on.
 * 4. The report names the file, the line, and what to write instead, and counts
 *    in the singular when there is one.
 * 5. The gate returns 0 over this repository as it stands, and 1 over a tree
 *    carrying a planted shape. A gate nobody has watched go red is a gate
 *    nobody has watched.
 */
export const test_workspace_host_file_url = (): void => {
  // Assembled rather than spelled, because this repository refuses a template
  // placeholder inside a plain string and these fixtures are made of them.
  const open = `${"$"}{`;
  const built = "  const url = `file:///" + open + "ROOT}/a.ts`;";
  // Assembled for the same reason the placeholder is: a fixture that spelled
  // the shape outright would be the shape, and the gate reads this file too.
  const scheme = "/^" + "file:[/]{3}/u";
  const parsed = "  const bare = url.replace(" + scheme + ', "");';
  const legitimate =
    "  const measured = (name) => `file:///repo/src/" + open + "name}.ts`;";
  const explained =
    "  // `file:///" + open + "root}` is wrong on POSIX; use pathToFileURL.";
  const documented = " * A regex like " + scheme + " strips three characters.";

  TestValidator.equals(
    "both mistakes are caught by position and neither reason is",
    findHostFileUrls(
      "sample.ts",
      [built, parsed, legitimate, explained, documented].join("\n"),
    ).map((finding) => [finding.kind, finding.line]),
    [
      ["built", 1],
      ["parsed", 2],
    ],
  );

  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-host-url-"));
  try {
    // Planted under a root the gate actually walks, so the run below is the
    // gate's own answer and not a second walk written beside it.
    const source = path.join(tree, "test", "src");
    fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(source, ".cache"), { recursive: true });
    fs.writeFileSync(path.join(source, "b.ts"), `${legitimate}\n`, "utf8");
    fs.writeFileSync(path.join(source, "a.ts"), `${built}\n`, "utf8");
    fs.writeFileSync(path.join(source, "c.ts"), `${parsed}\n`, "utf8");
    fs.writeFileSync(path.join(source, "notes.md"), built, "utf8");
    fs.writeFileSync(
      path.join(source, "node_modules", "vendor.ts"),
      `${built}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(source, ".cache", "old.ts"),
      `${built}\n`,
      "utf8",
    );

    TestValidator.equals(
      "the walk takes authored TypeScript in order and nothing else",
      authoredSources(source).map((file) => path.basename(file)),
      ["a.ts", "b.ts", "c.ts"],
    );

    const findings = inspectHostFileUrls(tree, ["test/src", "absent"]);
    const lines: string[] = [];
    reportHostFileUrls(findings, (line) => lines.push(line));
    TestValidator.equals(
      "a missing root is passed over and the report says what to write instead",
      {
        found: findings.map((finding) => [finding.file, finding.kind]),
        diagnostic: lines[0]?.includes("pathToFileURL") === true,
        otherDiagnostic: lines[1]?.includes("new URL") === true,
        counted: lines[2],
      },
      {
        found: [
          ["test/src/a.ts", "built"],
          ["test/src/c.ts", "parsed"],
        ],
        diagnostic: true,
        otherDiagnostic: true,
        counted:
          "host file URLs: 2 authored expressions treat file:// as string arithmetic",
      },
    );

    const single: string[] = [];
    reportHostFileUrls(findings.slice(0, 1), (line) => single.push(line));
    TestValidator.equals(
      "one finding is counted in the singular",
      single[1],
      "host file URLs: 1 authored expression treats file:// as string arithmetic",
    );

    TestValidator.equals(
      "the gate is red over a planted shape and green over this repository",
      {
        planted: runHostFileUrlGate(tree, () => undefined),
        repository: runHostFileUrlGate(ROOT, () => undefined),
      },
      { planted: 1, repository: 0 },
    );
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
  }
};
