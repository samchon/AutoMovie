import {
  autoMovieRenderDigest,
  canonicalizeAutoMovieJson,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { namedFacts, throwsError } from "../internal/predicates";

/** Recompute the identity digest without the engine primitive under test. */
const oracle = (value: unknown): string =>
  `sha256:${createHash("sha256")
    .update(Buffer.from(canonicalizeAutoMovieJson(value), "utf8"))
    .digest("hex")}`;

/** One chunk identity shaped exactly as the planner builds it. */
const identity = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  protocol: "automovie.production-render-chunk.v4",
  production: "demo-production",
  tier: { kind: "final", resolutionScale: 1, frameStep: 1 },
  deliverable: "feature",
  kind: "feature",
  editFingerprint: `sha256:${"a".repeat(64)}`,
  effects: [`sha256:${"b".repeat(64)}`],
  sourceFrameFormat: {
    width: 1920,
    height: 1080,
    frameRate: { numerator: 24, denominator: 1 },
  },
  frameFormat: {
    width: 1920,
    height: 1080,
    frameRate: { numerator: 24, denominator: 1 },
  },
  frameStart: 0,
  frameEndExclusive: 48,
  pass: "beauty",
  runtimeIdentity: {
    protocolVersion: "automovie.production-render-runtime.v3",
    sourceDigest: `sha256:${"c".repeat(64)}`,
    dialogueRuntimeIdentity: null,
    capture: {
      browser: "chromium",
      version: "140.0.0",
      backend: "swiftshader",
    },
    encoder: {
      package: "h264-mp4-encoder",
      version: "1.0.12",
      closureDigest: `sha256:${"d".repeat(64)}`,
      codec: "h264",
      arguments: { quantizationParameter: 20, speed: 4, groupOfPictures: 24 },
    },
  },
  sources: [{ shot: "shot-1", digest: `sha256:${"e".repeat(64)}` }],
  ...overrides,
});

/**
 * The chunk id keeps its bytes after moving to the engine digest primitive.
 *
 * Production computed a chunk id as SHA-256 over
 * `Buffer.from(canonicalizeAutoMovieJson(identity), "utf8")`. The planner now
 * lives in render and computes it as `autoMovieRenderDigest` of the same
 * canonical text, which hashes that text's UTF-8 bytes through its own encoder
 * and its own SHA-256. Plans and receipts already on disk carry ids from the old
 * path, so the two must agree byte for byte or every stored plan reads as stale.
 *
 * The expected digest here is computed independently inside the test, from
 * `node:crypto` over the canonical text, rather than by calling the primitive
 * under test. The two encoders could only disagree on a lone surrogate, where
 * `Buffer.from` substitutes U+FFFD and the engine encoder does too — and the
 * shared canonicalizer refuses such a string before either encoder runs, which
 * this pins as a refusal rather than as an agreement.
 *
 * Scenarios:
 *
 * 1. A complete chunk identity digests identically through both paths.
 * 2. Identity is sensitive to the fields that decide a chunk: a different frame
 *    range, pass, tier or source digest each yields a different id, and none
 *    collides with another.
 * 3. Key insertion order does not change the id, because the canonicalizer
 *    orders properties before either encoder sees them.
 * 4. A lone surrogate anywhere in the identity is refused by the canonicalizer,
 *    so no digest is produced on either path.
 */
export const test_render_plan_chunk_digest_parity = (): void => {
  const engineDigest = (value: unknown): string =>
    autoMovieRenderDigest(canonicalizeAutoMovieJson(value));

  const complete = identity();
  TestValidator.equals(
    "a complete chunk identity agrees",
    engineDigest(complete),
    oracle(complete),
  );

  const variants = {
    range: identity({ frameStart: 48, frameEndExclusive: 96 }),
    pass: identity({ kind: "guide-pass", pass: "pose" }),
    tier: identity({
      tier: { kind: "proxy", resolutionScale: 0.5, frameStep: 1 },
    }),
    source: identity({
      sources: [{ shot: "shot-1", digest: `sha256:${"f".repeat(64)}` }],
    }),
  };
  for (const [name, value] of Object.entries(variants))
    TestValidator.equals(
      `the ${name} variant agrees`,
      engineDigest(value),
      oracle(value),
    );

  const ids = [complete, ...Object.values(variants)].map(engineDigest);
  TestValidator.predicate(
    "every deciding field changes the id",
    () => new Set(ids).size === ids.length,
  );

  // The canonicalizer orders properties, so the same identity written in another
  // order is the same bytes and therefore the same id.
  const reordered = {
    sources: [{ digest: `sha256:${"e".repeat(64)}`, shot: "shot-1" }],
    protocol: "automovie.production-render-chunk.v4",
    ...identity(),
  };
  TestValidator.equals(
    "property order does not change the id",
    engineDigest(reordered),
    engineDigest(complete),
  );

  const lone = identity({ deliverable: "feature\uD800" });
  TestValidator.equals(
    "a lone surrogate is refused, not digested",
    namedFacts([
      [
        "engineRefuses",
        () => throwsError(() => engineDigest(lone), "invalid-unicode"),
      ],
      [
        "oracleRefuses",
        () => throwsError(() => oracle(lone), "invalid-unicode"),
      ],
    ]),
    { engineRefuses: true, oracleRefuses: true },
  );
};
