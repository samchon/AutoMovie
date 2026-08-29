import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import {
  type IZeroJavaScriptDependencies,
  ZeroJavaScriptError,
  assertZeroJavaScript,
  findAuthoredJavaScript,
  runZeroJavaScript,
} from "../../integrity/zeroJavaScript";
import { namedFacts } from "../internal/predicates";

const ROOT = path.resolve(__dirname, "../../../..");

const listing = (
  files: readonly string[],
  present: readonly string[] = files,
): IZeroJavaScriptDependencies => ({
  list: () => files,
  isFile: (_root, relative) => present.includes(relative),
});

const captureRun = (
  dependencies: IZeroJavaScriptDependencies,
): { code: number; error: string; output: string } => {
  let output = "";
  let error = "";
  const code = runZeroJavaScript(
    ROOT,
    dependencies,
    { write: (message) => (output += message) },
    { write: (message) => (error += message) },
  );
  return { code, error, output };
};

/** The repository rejects every authored JavaScript extension without exceptions. */
export const test_workspace_zero_javascript = (): void => {
  assertZeroJavaScript(ROOT);

  const clean = captureRun(
    listing(["build/tool.ts", "config/policy.json", "docs/history.mjs.md"]),
  );
  const deleted = captureRun(listing(["removed/dead.js"], []));
  const forbiddenDependencies = listing([
    "z/wrapper.cjs",
    "a/config.js",
    "m/loader.mjs",
  ]);
  const forbidden = captureRun(forbiddenDependencies);
  const nonError = captureRun({
    list: () => {
      throw new Error("listing failed");
    },
    isFile: () => true,
  });
  let caught: unknown;
  try {
    assertZeroJavaScript(ROOT, forbiddenDependencies);
  } catch (error) {
    caught = error;
  }

  TestValidator.equals(
    "zero-JavaScript invariant has positive, deleted, negative, and error behavior",
    namedFacts([
      ["clean accepted", () => clean.code === 0 && clean.error === ""],
      [
        "success explains invariant",
        () => clean.output.includes("No directly authored JavaScript"),
      ],
      ["deleted index entry ignored", () => deleted.code === 0],
      ["all three extensions rejected", () => forbidden.code === 1],
      [
        "violations sorted",
        () =>
          findAuthoredJavaScript(ROOT, forbiddenDependencies).join(",") ===
          "a/config.js,m/loader.mjs,z/wrapper.cjs",
      ],
      [
        "error owns exact paths",
        () =>
          caught instanceof ZeroJavaScriptError &&
          caught.files.join(",") === "a/config.js,m/loader.mjs,z/wrapper.cjs",
      ],
      [
        "negative output names every path",
        () =>
          ["a/config.js", "m/loader.mjs", "z/wrapper.cjs"].every((file) =>
            forbidden.error.includes(file),
          ),
      ],
      [
        "listing failure preserved",
        () =>
          nonError.code === 1 && nonError.error === "Error: listing failed\n",
      ],
    ]),
    {
      "clean accepted": true,
      "success explains invariant": true,
      "deleted index entry ignored": true,
      "all three extensions rejected": true,
      "violations sorted": true,
      "error owns exact paths": true,
      "negative output names every path": true,
      "listing failure preserved": true,
    },
  );
};
