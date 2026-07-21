import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * The source trees `ttsx` compiles from `.ts` at run time. Every one of them is
 * a place a stray emit can shadow its own source; `lib/`, `dist/`, `build/` and
 * `node_modules/` are outputs or vendored, so they are not walked.
 */
const SOURCE_ROOTS = [
  path.resolve(ROOT, "packages"),
  path.resolve(ROOT, "test", "src"),
];

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "lib",
  "dist",
  "build",
  ".next",
  "out",
]);

/** Every file under `directory`, recursively, as forward-slashed absolutes. */
const walk = (directory: string): string[] => {
  if (!fs.existsSync(directory)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      out.push(...walk(child));
    } else if (entry.isFile()) out.push(child.replaceAll("\\", "/"));
  }
  return out;
};

/**
 * Every `.js` file sitting beside a same-named `.ts`, in code-unit order.
 *
 * A same stem in a DIFFERENT directory is not a shadow, which is why the
 * comparison is on the whole path rather than on the basename.
 */
export const shadowingJavaScriptFiles = (
  roots: readonly string[],
): string[] => {
  const files = roots.flatMap((root) => walk(root));
  const present = new Set(files);
  return files
    .filter(
      (file) => file.endsWith(".js") && present.has(`${file.slice(0, -3)}.ts`),
    )
    .sort(compareCodeUnits);
};

/**
 * No compiled `.js` may sit beside the `.ts` it was compiled from.
 *
 * This is a **guard, not a defect fix**, and it is directed rather than
 * discovered: no repository command produces this state, since every package's
 * build declares `outDir: lib` and `lib/` is gitignored. A misconfigured probe
 * tsconfig did produce it once, putting 280 build artifacts next to
 * `packages/engine/src`.
 *
 * The hazard is what a controlled experiment established during the `mcp-pilot`
 * cycle-2 benchmark: given `mod.ts` and `mod.js` in one directory and an
 * extensionless import of `mod`, **`ttsx` resolves the `.js`**. The suite and
 * the c8 coverage gate both run through `ttsx`, so a stale sibling silently
 * shadows every later edit to its source, and the green it produces is a lie
 * about code that never ran. The risk is asymmetric: that time the emitted
 * bytes happened to match the source and no measurement was corrupted, but the
 * same accident in the other direction leaves no trace at all.
 *
 * `.gitignore`-ing the pattern is the wrong answer and was rejected: hiding the
 * file leaves the shadowing in place and removes the only signal there is.
 *
 * Scenarios:
 *
 * 1. The workspace's compiled source trees carry no `.js` beside a same-named
 *    `.ts`. The failure lists every offending path, because the remedy is to
 *    delete the artifact and fix whatever emitted it.
 * 2. Fault injection: the detector is run over a scratch tree carrying one
 *    shadowing pair, a `.js` with no `.ts` twin, a `.ts` with no `.js` twin,
 *    and a same-stem pair in DIFFERENT directories. Only the shadowing pair is
 *    reported. A guard that cannot fail is not a guard.
 */
export const test_workspace_no_shadowing_js = (): void => {
  TestValidator.equals(
    "no compiled .js shadows its own .ts source",
    shadowingJavaScriptFiles(SOURCE_ROOTS),
    [],
  );

  // 2. fault injection, outside the repository so the tree stays clean
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-shadow-"));
  try {
    fs.mkdirSync(path.join(scratch, "nested"));
    fs.writeFileSync(
      path.join(scratch, "shadowed.ts"),
      "export const a = 1;\n",
    );
    fs.writeFileSync(path.join(scratch, "shadowed.js"), "exports.a = 1;\n");
    fs.writeFileSync(path.join(scratch, "lonely.js"), "exports.b = 2;\n");
    fs.writeFileSync(path.join(scratch, "plain.ts"), "export const c = 3;\n");
    // same stem, different directory: not a shadow
    fs.writeFileSync(
      path.join(scratch, "nested", "plain.js"),
      "exports.c = 3;\n",
    );
    TestValidator.equals(
      "an injected shadowing pair is reported, and only it",
      shadowingJavaScriptFiles([scratch]).map((file) => path.basename(file)),
      ["shadowed.js"],
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
};
