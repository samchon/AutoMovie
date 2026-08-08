/**
 * Count assertions that fold several facts into one boolean.
 *
 * `TestValidator.predicate(title, a && b && c)` reports only "expected
 * condition is not satisfied" when it fails, so learning which fact was false
 * costs a full run per assertion. This walk is the reproducible measure of how
 * many are left, so the count can be driven to zero rather than estimated.
 *
 * A conjunction of two is counted too: naming both is what turns a failure into
 * a diagnosis, and two is where the ambiguity starts.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const ts = createRequire(new URL("../test/package.json", import.meta.url))(
  "typescript-compiler",
);

const ROOT = "test/src";

const files = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".ts") ? [path] : [];
  });

/** How many operands one `&&` chain carries. */
const conjuncts = (node) =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ? conjuncts(node.left) + conjuncts(node.right)
    : 1;

const found = [];
for (const file of files(ROOT)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === "TestValidator" &&
      node.expression.name.text === "predicate" &&
      node.arguments.length >= 2
    ) {
      const facts = conjuncts(node.arguments[1]);
      if (facts >= 2)
        found.push({
          file,
          line:
            source.getLineAndCharacterOfPosition(node.getStart(source)).line +
            1,
          facts,
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const byFile = new Map();
for (const entry of found)
  byFile.set(entry.file, (byFile.get(entry.file) ?? 0) + 1);
// Code-unit order, not localeCompare: this walk is the reproducible measure of
// how many folded assertions are left, and a tie broken by the host's locale
// and ICU build would report a different order on a different machine.
const byCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
for (const [file, count] of [...byFile].sort((left, right) =>
  right[1] === left[1] ? byCodeUnits(left[0], right[0]) : right[1] - left[1],
))
  process.stdout.write(`${String(count).padStart(4)}  ${file}\n`);
process.stdout.write(
  `\n${found.length} folded assertions across ${byFile.size} files\n`,
);
