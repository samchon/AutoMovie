import {
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  decodeAutoMoviePathSegment,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

const throws = (closure: () => unknown): boolean => {
  try {
    closure();
    return false;
  } catch {
    return true;
  }
};

/** Content identity is canonical, domain-separated and source-EOL stable. */
export const test_mcp_production_content_identity = (): void => {
  TestValidator.equals(
    "canonical keys and JSON omission semantics",
    canonicalizeAutoMovieJson({
      z: undefined,
      b: 2,
      a: [undefined, true, null, "x"],
      omitted: () => undefined,
      symbol: Symbol("x"),
    }),
    '{"a":[null,true,null,"x"],"b":2}',
  );
  TestValidator.equals(
    "canonical bytes",
    Buffer.from(canonicalAutoMovieJsonBytes({ b: 2, a: 1 })).toString("utf8"),
    '{"a":1,"b":2}',
  );
  TestValidator.equals(
    "unsupported canonical values fail loudly",
    namedFacts([
      ["rejected", () => throws(() => canonicalizeAutoMovieJson(Number.NaN))],
      ["rejected2", () => throws(() => canonicalizeAutoMovieJson(1n))],
      ["rejected3", () => throws(() => canonicalizeAutoMovieJson(undefined))],
    ]),
    {
      rejected: true,
      rejected2: true,
      rejected3: true,
    },
  );
  TestValidator.equals(
    "source BOM and EOL normalization",
    Buffer.from(
      normalizeAutoMovieSource(Buffer.from("\ufeffa\r\nb\rc\n", "utf8")),
    ).toString("utf8"),
    "a\nb\nc\n",
  );
  TestValidator.equals(
    "known SHA-256",
    digestAutoMovieBytes(Buffer.from("abc")),
    "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  TestValidator.predicate(
    "field roles and kinds separate identical bytes",
    fingerprintAutoMovieFields([
      { role: "a", kind: "x", payload: Buffer.from("z") },
    ]) !==
      fingerprintAutoMovieFields([
        { role: "b", kind: "x", payload: Buffer.from("z") },
      ]) &&
      fingerprintAutoMovieFields([
        { role: "a", kind: "x", payload: Buffer.from("z") },
      ]) !==
        fingerprintAutoMovieFields([
          { role: "a", kind: "y", payload: Buffer.from("z") },
        ]),
  );
  TestValidator.equals(
    "code-unit comparator",
    [
      compareCodeUnits("a", "b"),
      compareCodeUnits("b", "a"),
      compareCodeUnits("a", "a"),
    ],
    [-1, 1, 0],
  );
  TestValidator.equals(
    "portable path segments escape RFC 3986 filename hazards",
    encodeAutoMoviePathSegment("a*!'()"),
    "a%2A%21%27%28%29",
  );
  TestValidator.equals(
    "portable path segments escape Windows devices",
    namedFacts([
      [
        "encodeAutoMoviePathSegmentCON",
        () => encodeAutoMoviePathSegment("CON") === "%43ON",
      ],
      [
        "encodeAutoMoviePathSegmentLpt9",
        () => encodeAutoMoviePathSegment("lpt9.json") === "%6Cpt9.json",
      ],
      [
        "decodeAutoMoviePathSegmentON",
        () => decodeAutoMoviePathSegment("%43ON") === "CON",
      ],
    ]),
    {
      encodeAutoMoviePathSegmentCON: true,
      encodeAutoMoviePathSegmentLpt9: true,
      decodeAutoMoviePathSegmentON: true,
    },
  );
  TestValidator.equals(
    "portable path segments escape dot aliases",
    namedFacts([
      [
        "encodeAutoMoviePathSegmentE",
        () => encodeAutoMoviePathSegment(".") === "%2E",
      ],
      [
        "encodeAutoMoviePathSegmentE2",
        () => encodeAutoMoviePathSegment("..") === ".%2E",
      ],
      [
        "encodeAutoMoviePathSegmentShared",
        () => encodeAutoMoviePathSegment("shared.") === "shared%2E",
      ],
    ]),
    {
      encodeAutoMoviePathSegmentE: true,
      encodeAutoMoviePathSegmentE2: true,
      encodeAutoMoviePathSegmentShared: true,
    },
  );
  const longId = "장편-전투-".repeat(64);
  const longSegment = encodeAutoMoviePathSegment(longId);
  TestValidator.equals(
    "long ids use stable content-addressed segments",
    namedFacts([
      ["sha256A", () => /^~sha256-[0-9a-f]{64}$/.test(longSegment)],
      [
        "longSegmentEncodeAutoMoviePathSegment",
        () => longSegment === encodeAutoMoviePathSegment(longId),
      ],
      ["rejected", () => throws(() => decodeAutoMoviePathSegment(longSegment))],
    ]),
    {
      sha256A: true,
      longSegmentEncodeAutoMoviePathSegment: true,
      rejected: true,
    },
  );
};
