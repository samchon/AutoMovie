import type { AutoMovieContentDigest } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { rejectsError, throwsError } from "../internal/predicates";

const runtime = loadSourceModule<{
  assertCurrentRenderSource: (props: {
    expected: AutoMovieContentDigest;
    current: () => AutoMovieContentDigest;
  }) => void;
  captureCurrentRenderSource: <Result>(props: {
    expected: AutoMovieContentDigest;
    current: () => AutoMovieContentDigest;
    capture: () => Promise<Result>;
  }) => Promise<Result>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/renderAuthoringCurrentness.ts",
  ),
);

/**
 * Render capture and publication compare the live compile with the stored plan.
 *
 * Scenarios:
 *
 * 1. An unchanged compile passes synchronous publication and awaited capture.
 * 2. A stale source or authoring fingerprint refuses before capture begins.
 * 3. A target edit while capture is awaiting refuses the returned old pixels.
 * 4. Compiler-reader and capture failures retain their exact original causes.
 */
export const test_cli_render_authoring_currentness =
  async (): Promise<void> => {
    const expected: AutoMovieContentDigest = `sha256:${"a".repeat(64)}`;
    const changed: AutoMovieContentDigest = `sha256:${"b".repeat(64)}`;
    let observed = expected;
    let reads = 0;
    let captures = 0;
    const current = (): AutoMovieContentDigest => {
      reads += 1;
      return observed;
    };
    runtime.assertCurrentRenderSource({ expected, current });
    const result = await runtime.captureCurrentRenderSource({
      expected,
      current,
      capture: async () => {
        captures += 1;
        return "current pixels";
      },
    });
    TestValidator.equals("unchanged capture result", result, "current pixels");
    TestValidator.equals(
      "publication plus capture check both endpoints",
      reads,
      3,
    );
    observed = changed;
    TestValidator.equals(
      "stale publication refuses",
      throwsError(
        () => runtime.assertCurrentRenderSource({ expected, current }),
        "source or authoring changed",
      ),
      true,
    );
    TestValidator.equals(
      "stale capture refuses before drawing",
      await rejectsError(
        () =>
          runtime.captureCurrentRenderSource({
            expected,
            current,
            capture: async () => {
              captures += 1;
              return "old pixels";
            },
          }),
        "source or authoring changed",
      ),
      true,
    );
    TestValidator.equals("stale capture never opens the host", captures, 1);
    observed = expected;
    TestValidator.equals(
      "target-only change while awaiting discards pixels",
      await rejectsError(
        () =>
          runtime.captureCurrentRenderSource({
            expected,
            current,
            capture: async () => {
              observed = changed;
              return "old pixels";
            },
          }),
        "source or authoring changed",
      ),
      true,
    );
    observed = expected;
    TestValidator.equals(
      "capture error remains the actual failure",
      await rejectsError(
        () =>
          runtime.captureCurrentRenderSource({
            expected,
            current,
            capture: async () => {
              throw new Error("capture refused by host");
            },
          }),
        "capture refused by host",
      ),
      true,
    );
    TestValidator.equals(
      "source diagnostic survives boundary",
      throwsError(
        () =>
          runtime.assertCurrentRenderSource({
            expected,
            current: () => {
              throw new Error("source-owner-mismatch at shot");
            },
          }),
        "source-owner-mismatch at shot",
      ),
      true,
    );
  };
