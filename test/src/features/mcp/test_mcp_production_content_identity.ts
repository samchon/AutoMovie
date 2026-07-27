import {
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

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
  TestValidator.predicate(
    "unsupported canonical values fail loudly",
    throws(() => canonicalizeAutoMovieJson(Number.NaN)) &&
      throws(() => canonicalizeAutoMovieJson(1n)) &&
      throws(() => canonicalizeAutoMovieJson(undefined)),
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
};
