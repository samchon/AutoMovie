import {
  AutoMovieCanonicalJsonError,
  autoMovieRenderDigest,
  canonicalizeAutoMovieJson,
} from "@automovie/engine";
import {
  AutoMovieCanonicalJsonError as ProductionCanonicalJsonError,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  canonicalizeAutoMovieJson as productionCanonicalizeAutoMovieJson,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

/**
 * Canonical JSON v2 has one implementation and one identity on every runtime.
 *
 * The engine owns the canonicalizer and a pure SHA-256 so a browser viewer can
 * identify an edit without a Node built-in, while Node project services keep
 * digesting through `node:crypto`. The two paths are one identity only when
 * their bytes and their hash agree, so every expectation here comes from
 * outside both implementations: the FIPS 180-4 example digests, canonical text
 * written by hand from the protocol rules, and `node:crypto` over those
 * hand-written bytes.
 *
 * Scenarios:
 *
 * 1. The pure digest reproduces the FIPS 180-4 example digests for the empty
 *    message, `abc`, and the 56-byte two-block message.
 * 2. For canonical inputs whose UTF-8 text is exactly 2, 55, 56, 63, 64 and 65
 *    bytes, including two-, three- and four-byte scalars that straddle a block
 *    boundary, the engine text equals the hand-written text, and the pure
 *    digest, the Node production digest and `node:crypto` over the hand-written
 *    bytes are one digest. Two further cases fix non-ASCII member order and a
 *    nested value whose numbers include negative zero and an exponent. Each
 *    arranged byte length is checked first, so a case that missed its boundary
 *    fails instead of passing elsewhere.
 * 3. Members follow UTF-16 code-unit order rather than insertion order or
 *    collation, an absent member changes neither text nor digest, and a
 *    changed member value changes the digest (the negative twin).
 * 4. A refused value throws one error class whether it is reached through the
 *    engine or through the production name Node services import, while an
 *    unrelated `TypeError` is not that class.
 */
export const test_text_canonical_json_runtime_parity = (): void => {
  const nodeDigest = (text: string): `sha256:${string}` =>
    `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`;

  TestValidator.equals(
    "the pure digest reproduces the FIPS 180-4 example digests",
    [
      autoMovieRenderDigest(""),
      autoMovieRenderDigest("abc"),
      autoMovieRenderDigest(
        "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      ),
    ],
    [
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      "sha256:248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
  );

  const cases: Array<{ value: unknown; text: string; bytes: number }> = [
    { value: "", text: '""', bytes: 2 },
    { value: {}, text: "{}", bytes: 2 },
    { value: [], text: "[]", bytes: 2 },
    { value: "x".repeat(53), text: `"${"x".repeat(53)}"`, bytes: 55 },
    { value: "x".repeat(54), text: `"${"x".repeat(54)}"`, bytes: 56 },
    { value: "x".repeat(61), text: `"${"x".repeat(61)}"`, bytes: 63 },
    { value: "x".repeat(62), text: `"${"x".repeat(62)}"`, bytes: 64 },
    { value: "x".repeat(63), text: `"${"x".repeat(63)}"`, bytes: 65 },
    {
      value: `${"é".repeat(26)}x`,
      text: `"${"é".repeat(26)}x"`,
      bytes: 55,
    },
    { value: "가".repeat(18), text: `"${"가".repeat(18)}"`, bytes: 56 },
    {
      value: `${"😀".repeat(15)}ab`,
      text: `"${"😀".repeat(15)}ab"`,
      bytes: 64,
    },
    {
      value: { 키: "값", b: "😀", a: "é" },
      text: '{"a":"é","b":"😀","키":"값"}',
      bytes: 33,
    },
    {
      value: { z: [1, -0, 1.5e-7, null, true], m: { y: false } },
      text: '{"m":{"y":false},"z":[1,0,1.5e-7,null,true]}',
      bytes: 44,
    },
  ];
  TestValidator.equals(
    "every case is arranged at its intended UTF-8 byte length",
    cases.map((item) => Buffer.byteLength(item.text, "utf8")),
    cases.map((item) => item.bytes),
  );
  TestValidator.equals(
    "the engine text is the hand-written canonical text",
    cases.map((item) => canonicalizeAutoMovieJson(item.value)),
    cases.map((item) => item.text),
  );
  TestValidator.equals(
    "the pure engine digest equals node:crypto over the hand-written bytes",
    cases.map((item) =>
      autoMovieRenderDigest(canonicalizeAutoMovieJson(item.value)),
    ),
    cases.map((item) => nodeDigest(item.text)),
  );
  TestValidator.equals(
    "the Node production digest equals node:crypto over the hand-written bytes",
    cases.map((item) =>
      digestAutoMovieBytes(canonicalAutoMovieJsonBytes(item.value)),
    ),
    cases.map((item) => nodeDigest(item.text)),
  );

  TestValidator.equals(
    "members follow code units and absent members leave the identity unchanged",
    {
      text: canonicalizeAutoMovieJson({ a: 2, ä: 4, B: 1, Z: 3 }),
      omitted:
        autoMovieRenderDigest(
          canonicalizeAutoMovieJson({ skip: undefined, a: 1 }),
        ) === nodeDigest('{"a":1}'),
      changed:
        autoMovieRenderDigest(canonicalizeAutoMovieJson({ a: 2 })) ===
        nodeDigest('{"a":1}'),
    },
    { text: '{"B":1,"Z":3,"a":2,"ä":4}', omitted: true, changed: false },
  );

  const refusal = (task: () => unknown): unknown => {
    try {
      task();
      return null;
    } catch (error) {
      return error;
    }
  };
  const engineRefusal = refusal(() => canonicalizeAutoMovieJson(new Date(0)));
  const productionRefusal = refusal(() =>
    productionCanonicalizeAutoMovieJson(Number.NaN),
  );
  TestValidator.equals(
    "a refusal is one error class through both import paths",
    [
      engineRefusal instanceof ProductionCanonicalJsonError,
      productionRefusal instanceof AutoMovieCanonicalJsonError,
      engineRefusal instanceof AutoMovieCanonicalJsonError
        ? engineRefusal.category
        : null,
      productionRefusal instanceof AutoMovieCanonicalJsonError
        ? productionRefusal.category
        : null,
      new TypeError("unrelated") instanceof AutoMovieCanonicalJsonError,
    ],
    [true, true, "non-plain-container", "unsupported-value", false],
  );
};
