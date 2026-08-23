import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/**
 * The reusable production graph's structural and negative canaries belong to
 * the repository-wide regression and coverage run, not only to its package and
 * scaffold-specific gates. Running the canonical package test in a child keeps
 * its temporary filesystem cases isolated while inheriting c8's coverage
 * channel during `pnpm --filter @automovie/test coverage`.
 */
export const test_evidence_package_graph = (): void => {
  const root = path.resolve(__dirname, "../../../..");
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules", "ttsc", "lib", "launcher", "ttsx.js"),
      "--project",
      "packages/evidence/tsconfig.test.json",
      "--cwd",
      root,
      "--no-plugins",
      "packages/evidence/test/createAutoMovieEvidenceConfig.test.ts",
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 || result.signal !== null)
    throw new Error(
      [
        `Evidence package graph test exited ${result.status ?? `by ${result.signal}`}.`,
        result.stdout,
        result.stderr,
      ].join("\n"),
    );
  TestValidator.equals(
    "the reusable evidence graph runs inside the repository regression",
    namedFacts([
      ["exited", () => result.status === 0 && result.signal === null],
      [
        "ran canaries",
        () =>
          result.stdout.includes("production evidence graph canaries passed"),
      ],
    ]),
    {
      exited: true,
      "ran canaries": true,
    },
  );
};
