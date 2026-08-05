import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

/** Repository root, four levels above `test/src/features/mcp`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const SUBJECT = path.join(
  ROOT,
  "packages",
  "mcp",
  "src",
  "validators",
  "primitives.ts",
);

const walk = (directory: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.name === "node_modules" || entry.name === "generated") continue;
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") && full !== SUBJECT) out.push(full);
  }
  return out;
};

/** Every value this module exports under its own declaration name. */
const declaredExports = (text: string): string[] => {
  const source = ts.createSourceFile(
    "primitives.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names: string[] = [];
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) === false ||
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) !== true
    )
      continue;
    for (const declaration of statement.declarationList.declarations)
      if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
  }
  return names.sort();
};

/**
 * Every validator this module exports is reached by product code.
 *
 * Four exports here outlived their callers when the five-tool MCP surface
 * landed (#1428); #1790 removed three and made the fourth module-private. Their
 * bodies were also most of what c8 reported uncovered, so the coverage gate was
 * pointing at dead code, and a test written to satisfy it would have pinned
 * behaviour no product path can reach.
 *
 * This contract closes that class: an export with no product caller fails here,
 * where the reason is stated, rather than surfacing as an unexplained coverage
 * gap. A re-export in a package barrel does not count as a caller, because a
 * barrel proves distribution rather than use.
 */
export const test_mcp_validator_export_reachability = (): void => {
  const exported = declaredExports(fs.readFileSync(SUBJECT, "utf8"));
  const sources = walk(path.join(ROOT, "packages")).map((file) =>
    fs.readFileSync(file, "utf8"),
  );
  const callers: Record<string, number> = {};
  for (const name of exported)
    callers[name] = sources.filter((text) =>
      new RegExp(`(?:^|[^\\w$.])${name}(?![\\w$])`, "u").test(text),
    ).length;
  TestValidator.equals(
    "every exported artifact validator has at least one product caller",
    {
      exported,
      orphans: exported.filter((name) => callers[name] === 0),
    },
    {
      exported: [
        "appendValidation",
        "validateBeatIdCaseCollisions",
        "validateColorArtifact",
        "validateNonEmptyText",
        "validateTransformArtifact",
      ],
      orphans: [],
    },
  );
};
