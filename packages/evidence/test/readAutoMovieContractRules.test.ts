import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readAutoMovieContractRules,
  selectAutoMovieContractRules,
} from "../src/readAutoMovieContractRules";

const roots: string[] = [];

/**
 * Structured local rules preserve lifecycle, safety, timing, and source state.
 *
 * Scenarios:
 *
 * 1. A prose-only H2 remains valid while an adjacent structured H2 returns its
 *    exact active route.
 * 2. Selected files require metadata on every H2.
 * 3. Duplicate ids, invalid status/application, blank timing/source identity,
 *    and unknown fields fail before routing.
 */
try {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-rules-"));
  roots.push(root);
  write(
    root,
    "local.md",
    [
      "# Local contract",
      "",
      "## Prose only {#prose-only}",
      "",
      "A human-only rule.",
      "",
      "## Routed {#routed}",
      "",
      "```contract-rule",
      JSON.stringify(
        {
          id: "local-routed",
          status: "active",
          safeApplication: "composition-safe",
          timing: "before draft composition",
          sourceIdentity: "decision-42@sha256:abc",
        },
        null,
        2,
      ),
      "```",
      "",
      "Apply the routed rule.",
    ].join("\n"),
  );
  const rules = readAutoMovieContractRules(root);
  assert.deepEqual(rules, [
    {
      address: "local.md#routed",
      anchor: "routed",
      heading: "Routed",
      file: "local.md",
      metadata: {
        id: "local-routed",
        status: "active",
        safeApplication: "composition-safe",
        timing: "before draft composition",
        sourceIdentity: "decision-42@sha256:abc",
      },
    },
  ]);
  assert.deepEqual(
    selectAutoMovieContractRules(rules, "composition-safe").map(
      (rule) => rule.metadata.id,
    ),
    ["local-routed"],
  );
  assert.deepEqual(
    selectAutoMovieContractRules(
      [
        ...rules,
        {
          ...rules[0]!,
          metadata: { ...rules[0]!.metadata, status: "hold" },
        },
      ],
      "observation-only",
    ),
    [],
    "inactive and differently timed rules cannot enter a selected population",
  );
  assert.throws(
    () => selectAutoMovieContractRules(rules, "early" as never),
    /Unsupported contract rule application early/u,
  );
  assert.throws(
    () => readAutoMovieContractRules(root, { requireEveryH2In: ["local.md"] }),
    /prose-only.*requires an immediate contract-rule/u,
  );

  const invalid = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-rules-invalid-"),
  );
  roots.push(invalid);
  for (const [name, patch, expected] of [
    ["status", { status: "pending" }, "invalid contract rule status"],
    ["application", { safeApplication: "always" }, "invalid safe application"],
    ["timing", { timing: " " }, "timing must be a non-empty string"],
    [
      "source",
      { sourceIdentity: "" },
      "sourceIdentity must be a non-empty string",
    ],
    ["unknown", { extra: true }, "unsupported contract rule metadata fields"],
  ] as const) {
    writeRule(invalid, `${name}.md`, { ...patch, id: `invalid-${name}` });
    assert.throws(
      () => readAutoMovieContractRules(invalid),
      new RegExp(expected, "u"),
    );
    fs.rmSync(path.join(invalid, `${name}.md`));
  }
  writeRule(invalid, "a.md", { id: "duplicate-id" });
  writeRule(invalid, "b.md", { id: "duplicate-id" });
  assert.throws(
    () => readAutoMovieContractRules(invalid),
    /duplicate contract rule id/u,
  );
  fs.rmSync(path.join(invalid, "a.md"));
  fs.rmSync(path.join(invalid, "b.md"));
  write(
    invalid,
    "malformed.md",
    "# Contract\n\n## Rule {#rule}\n\n```contract-rule\n{bad}\n```\n",
  );
  assert.throws(
    () => readAutoMovieContractRules(invalid),
    /must be valid JSON/u,
  );
  fs.rmSync(path.join(invalid, "malformed.md"));
  write(
    invalid,
    "displaced.md",
    [
      "# Contract",
      "",
      "## Rule {#rule}",
      "",
      "Visible prose cannot precede routed metadata.",
      "",
      "```contract-rule",
      '{"id":"late"}',
      "```",
    ].join("\n"),
  );
  assert.throws(
    () => readAutoMovieContractRules(invalid),
    /must immediately follow its H2/u,
  );
  fs.rmSync(path.join(invalid, "displaced.md"));
  write(
    invalid,
    "duplicate.md",
    [
      "# Contract",
      "",
      "## Rule {#rule}",
      "",
      "```contract-rule",
      '{"id":"first"}',
      "```",
      "",
      "```contract-rule",
      '{"id":"second"}',
      "```",
    ].join("\n"),
  );
  assert.throws(
    () => readAutoMovieContractRules(invalid),
    /only one contract-rule JSON block/u,
  );
  fs.rmSync(path.join(invalid, "duplicate.md"));
  write(
    invalid,
    "array.md",
    "# Contract\n\n## Rule {#rule}\n\n```contract-rule\n[]\n```\n",
  );
  assert.throws(
    () => readAutoMovieContractRules(invalid),
    /must be a JSON object/u,
  );

  process.stdout.write("structured contract rules passed\n");
} finally {
  for (const root of roots) fs.rmSync(root, { force: true, recursive: true });
}

function writeRule(
  root: string,
  file: string,
  override: Record<string, unknown>,
): void {
  write(
    root,
    file,
    [
      "# Contract",
      "",
      "## Rule {#rule}",
      "",
      "```contract-rule",
      JSON.stringify(
        {
          id: "rule",
          status: "active",
          safeApplication: "observation-only",
          timing: "during review",
          sourceIdentity: "measurement-1",
          ...override,
        },
        null,
        2,
      ),
      "```",
      "",
      "Rule prose.",
    ].join("\n"),
  );
}

function write(root: string, file: string, source: string): void {
  fs.writeFileSync(path.join(root, file), source, "utf8");
}
