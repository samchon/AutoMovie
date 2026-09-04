import type { AutoMovieContentDigest } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

const unit = loadSourceModule<{
  assertProductionRenderDialogueRuntimeIdentity: (props: {
    boundary: string;
    expected: unknown;
    observed: unknown;
  }) => AutoMovieContentDigest | null;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/productionRenderDialogueRuntimeIdentity.ts",
  ),
);

/**
 * Planned dialogue identity and the final-byte capture observation are one
 * render invariant at preflight, every layer/pass, and publication preview.
 *
 * Scenarios:
 *
 * 1. Matching canonical identities and an explicitly silent null/null pair
 *    preserve the observed typed value.
 * 2. Different, null, missing, non-string, and malformed observations each
 *    fail closed without printing an untrusted value.
 * 3. A missing or malformed planned identity is stale rather than silently
 *    interpreted as a dialogue-free plan.
 * 4. Empty boundary context is refused so every failure can identify where it
 *    prevented bytes from entering a frame, chunk, or publication.
 */
export const test_production_render_dialogue_runtime_identity = (): void => {
  const { assertProductionRenderDialogueRuntimeIdentity } = unit;
  const expected = digest("a");
  TestValidator.equals(
    "matching voiced and silent captures preserve their exact planned identity",
    [
      assertProductionRenderDialogueRuntimeIdentity({
        boundary: "render preflight",
        expected,
        observed: expected,
      }),
      assertProductionRenderDialogueRuntimeIdentity({
        boundary: "final preview",
        expected: null,
        observed: null,
      }),
    ],
    [expected, null],
  );

  const secret = "credential-bearing-observed-value";
  const captureRefusals = [
    {
      name: "different",
      observed: digest("b"),
      message: "differs from the render plan",
    },
    { name: "null", observed: null, message: "differs from the render plan" },
    { name: "missing", observed: undefined, message: "omitted" },
    { name: "non-string", observed: 7, message: "invalid" },
    { name: "malformed", observed: secret, message: "invalid" },
  ].map(({ name, observed, message }) => {
    let caught: unknown;
    try {
      assertProductionRenderDialogueRuntimeIdentity({
        boundary: "chunk feature:0 frame 12 layer 1 beauty",
        expected,
        observed,
      });
    } catch (error) {
      caught = error;
    }
    return {
      name,
      refused:
        caught instanceof Error &&
        caught.message.includes(message) &&
        caught.message.includes("chunk feature:0 frame 12 layer 1 beauty"),
      secretAbsent:
        caught instanceof Error && caught.message.includes(secret) === false,
      exactCanonicalMismatch:
        name !== "different" ||
        (caught instanceof Error &&
          caught.message.includes(`expected ${expected}`) &&
          caught.message.includes(`observed ${digest("b")}`)),
    };
  });
  TestValidator.equals(
    "every untrusted observed identity fails closed at its named capture boundary",
    captureRefusals,
    ["different", "null", "missing", "non-string", "malformed"].map((name) => ({
      name,
      refused: true,
      secretAbsent: true,
      exactCanonicalMismatch: true,
    })),
  );

  TestValidator.equals(
    "stored legacy or malformed planned identities require replanning",
    namedFacts([
      [
        "missing",
        () =>
          throwsError(
            () =>
              assertProductionRenderDialogueRuntimeIdentity({
                boundary: "stored render plan",
                expected: undefined,
                observed: null,
              }),
            ["missing or invalid", "Replan"],
          ),
      ],
      [
        "malformed",
        () =>
          throwsError(
            () =>
              assertProductionRenderDialogueRuntimeIdentity({
                boundary: "stored render plan",
                expected: "sha256:short",
                observed: null,
              }),
            ["missing or invalid", "Replan"],
          ),
      ],
      [
        "hiddenDialogue",
        () =>
          throwsError(
            () =>
              assertProductionRenderDialogueRuntimeIdentity({
                boundary: "silent guide pass",
                expected: null,
                observed: expected,
              }),
            "differs from the render plan",
          ),
      ],
      [
        "emptyBoundary",
        () =>
          throwsError(
            () =>
              assertProductionRenderDialogueRuntimeIdentity({
                boundary: " ",
                expected,
                observed: expected,
              }),
            "comparison boundary is invalid",
          ),
      ],
    ]),
    {
      missing: true,
      malformed: true,
      hiddenDialogue: true,
      emptyBoundary: true,
    },
  );
};
