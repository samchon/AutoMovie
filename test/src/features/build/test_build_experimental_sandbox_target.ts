import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts, throwsError } from "../internal/predicates";
import { type IExperimentalModule, loadBuildModule } from "./loadBuildModule";
import {
  runBuildScenarioChild,
  runWhenBuildScenarioChild,
} from "./runBuildScenarioChild";

const REFUSAL = "must be one directory segment inside experimental/";

/**
 * A sandbox name resolves inside `experimental/` or it is refused.
 *
 * The command used to compose its target with `path.join` and check nothing,
 * which left `--refresh` with no name rule at all because `renderScaffold`, the
 * only thing that validated a name, is never called on that path. Measured on
 * this repository, `pnpm run experimental .. --refresh --no-install` resolved to
 * the repository root, rewrote the repository's own `package.json`, and exited
 * 0; with the install enabled it would first have packed ten workspace tarballs
 * into whatever directory the traversal reached.
 *
 * The rule here is containment rather than portability. `renderScaffold` still
 * owns what a project name may be (reserved device names, trailing dots), and
 * restating that rule here would be a second, weaker spelling of it. What
 * `renderScaffold` cannot own is where this command writes, so that is the one
 * question this answers, for every shape a traversal can take.
 *
 * Scenarios:
 *
 * 1. An ordinary segment resolves to that directory directly under
 *    `experimental/`.
 * 2. `..` is refused. This is the exact input that reached the repository root.
 * 3. A nested `a/b` is refused, because its parent is not `experimental/`.
 * 4. A deeper `../../elsewhere` is refused, covering an escape that leaves the
 *    repository rather than landing on one of its own files.
 * 5. `.` is refused: it resolves to `experimental/` itself, whose parent is the
 *    repository root.
 * 6. The empty string is refused on the same branch. `--` style argument
 *    parsing accepts it as a name because it does not start with a hyphen.
 * 7. An absolute path is refused rather than silently escaping.
 * 8. A Windows backslash segment is refused on Windows, where `path` treats it
 *    as a separator; on POSIX the same string is one legal segment and is
 *    accepted, which is the platform difference this pins rather than hides.
 * 9. Every refusal names the offending input, so the operator sees which
 *    argument was rejected.
 */
const assertBuildExperimentalSandboxTarget = async (): Promise<void> => {
  const { EXPERIMENTAL_ROOT, sandboxTarget } =
    await loadBuildModule<IExperimentalModule>("experimental.ts");
  const backslash = "outer\\inner";
  const windows = path.sep === "\\";
  TestValidator.equals(
    "a sandbox name resolves inside experimental/ or is refused",
    namedFacts([
      [
        "an ordinary segment resolves under experimental/",
        () => sandboxTarget("probe") === path.join(EXPERIMENTAL_ROOT, "probe"),
      ],
      [
        "parent traversal refused",
        () => throwsError(() => sandboxTarget(".."), REFUSAL),
      ],
      [
        "nested segment refused",
        () => throwsError(() => sandboxTarget("a/b"), REFUSAL),
      ],
      [
        "escaping traversal refused",
        () => throwsError(() => sandboxTarget("../../elsewhere"), REFUSAL),
      ],
      [
        "the experimental root itself refused",
        () => throwsError(() => sandboxTarget("."), REFUSAL),
      ],
      [
        "the empty name refused",
        () => throwsError(() => sandboxTarget(""), REFUSAL),
      ],
      [
        "an absolute path refused",
        () =>
          throwsError(
            () => sandboxTarget(path.join(EXPERIMENTAL_ROOT, "..", "escape")),
            REFUSAL,
          ),
      ],
      [
        "a backslash segment follows the platform separator",
        () =>
          throwsError(() => sandboxTarget(backslash), REFUSAL) === windows &&
          (windows ||
            sandboxTarget(backslash) ===
              path.join(EXPERIMENTAL_ROOT, backslash)),
      ],
      [
        "the refusal names the input",
        () => throwsError(() => sandboxTarget(".."), `experimental name ".."`),
      ],
    ]),
    {
      "an ordinary segment resolves under experimental/": true,
      "parent traversal refused": true,
      "nested segment refused": true,
      "escaping traversal refused": true,
      "the experimental root itself refused": true,
      "the empty name refused": true,
      "an absolute path refused": true,
      "a backslash segment follows the platform separator": true,
      "the refusal names the input": true,
    },
  );
};

/** Exercise sandbox name containment through a runner that can load the build tools. */
export const test_build_experimental_sandbox_target = (): void => {
  runBuildScenarioChild(__filename, "test_build_experimental_sandbox_target");
};

runWhenBuildScenarioChild(
  "test_build_experimental_sandbox_target",
  assertBuildExperimentalSandboxTarget,
);
