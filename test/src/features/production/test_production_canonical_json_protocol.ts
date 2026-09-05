import {
  AUTOMOVIE_CANONICAL_JSON_DOMAIN,
  AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
  AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL,
  AutoMovieCanonicalJsonError,
  canonicalizeAutoMovieJson,
  canonicalizeAutoMovieJsonForProtocol,
  digestAutoMovieBytes,
  identifyAutoMovieCanonicalJson,
  verifyAutoMovieCanonicalJsonIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const throws = (task: () => unknown): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

const category = (task: () => unknown): string => {
  try {
    task();
    return "accepted";
  } catch (error) {
    return error instanceof AutoMovieCanonicalJsonError
      ? error.category
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  }
};

/**
 * Canonical JSON is valid, versioned and migrates only from recoverable input.
 *
 * Scenarios:
 *
 * 1. Array length and every slot survive, identities expose their protocol,
 *    and the explicit protocol entry agrees with the implicit one.
 * 2. Every value outside the acyclic plain scalar domain is refused under its
 *    typed category: accessor slots in arrays as well as objects, lone
 *    surrogates at the end of or inside a string, non-finite numbers, and
 *    bigint.
 * 3. Current, stale, migrated and unverifiable verification states are
 *    disjoint for both protocols; the legacy encoder used only to verify a
 *    declared v1 digest keeps its exact lossy treatment of omitted members and
 *    nulled items, and a value the current protocol refuses never reaches it.
 */
export const test_production_canonical_json_protocol = (): void => {
  const sparse = new Array(2);
  sparse[1] = undefined;
  TestValidator.equals(
    "array length and every slot survive canonicalization",
    [
      canonicalizeAutoMovieJson([]),
      canonicalizeAutoMovieJson(new Array(1)),
      canonicalizeAutoMovieJson(sparse),
      JSON.parse(canonicalizeAutoMovieJson(sparse)),
    ],
    ["[]", "[null]", "[null,null]", [null, null]],
  );
  const identity = identifyAutoMovieCanonicalJson({ b: 2, a: "😀" });
  TestValidator.equals(
    "identity exposes its protocol, valid bytes and digest",
    [
      identity.protocol,
      AUTOMOVIE_CANONICAL_JSON_DOMAIN.unicode,
      Buffer.from(identity.bytes).toString("utf8"),
      identity.digest === digestAutoMovieBytes(identity.bytes),
      canonicalizeAutoMovieJson(
        JSON.parse(Buffer.from(identity.bytes).toString("utf8")),
      ),
    ],
    [
      AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
      "exact-scalar-sequence",
      '{"a":"😀","b":2}',
      true,
      '{"a":"😀","b":2}',
    ],
  );
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get: () => 1,
  });
  TestValidator.equals(
    "values outside the explicit acyclic plain scalar domain are refused",
    [
      throws(() => canonicalizeAutoMovieJson(new Date(0))),
      throws(() => canonicalizeAutoMovieJson(new Map())),
      throws(() => canonicalizeAutoMovieJson(cycle)),
      throws(() => canonicalizeAutoMovieJson("\ud800")),
      throws(() => canonicalizeAutoMovieJson({ "\udc00": true })),
      throws(() => canonicalizeAutoMovieJson(accessor)),
    ],
    [true, true, true, true, true, true],
  );
  const accessorSlot = Object.defineProperty([0], 0, {
    enumerable: true,
    get: () => 1,
  }) as unknown[];
  TestValidator.equals(
    "every refusal carries the category that names its domain violation",
    {
      accessorSlot: category(() => canonicalizeAutoMovieJson(accessorSlot)),
      trailingHighSurrogate: category(() =>
        canonicalizeAutoMovieJson("a\ud800"),
      ),
      unpairedHighSurrogate: category(() =>
        canonicalizeAutoMovieJson("a\ud800b"),
      ),
      loneLowSurrogate: category(() => canonicalizeAutoMovieJson("\udc00")),
      nonFinite: category(() => canonicalizeAutoMovieJson([Infinity])),
      bigint: category(() => canonicalizeAutoMovieJson({ value: 1n })),
      undefinedRoot: category(() => canonicalizeAutoMovieJson(undefined)),
    },
    {
      accessorSlot: "accessor-property",
      trailingHighSurrogate: "invalid-unicode",
      unpairedHighSurrogate: "invalid-unicode",
      loneLowSurrogate: "invalid-unicode",
      nonFinite: "unsupported-value",
      bigint: "unsupported-value",
      undefinedRoot: "unsupported-value",
    },
  );
  TestValidator.predicate(
    "the explicit protocol entry returns the same versioned identity",
    canonicalizeAutoMovieJsonForProtocol({
      protocol: AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
      value: { b: 2, a: "😀" },
    }).digest === identity.digest,
  );
  TestValidator.predicate(
    "the runtime guard refuses a falsely typed historical protocol",
    throws(() =>
      canonicalizeAutoMovieJsonForProtocol({
        protocol:
          "automovie.canonical-json.v1" as typeof AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
        value: {},
      }),
    ),
  );
  try {
    canonicalizeAutoMovieJson("\ud800");
  } catch (error) {
    TestValidator.equals(
      "invalid Unicode exposes a typed stable category",
      error instanceof AutoMovieCanonicalJsonError
        ? [error.code, error.category]
        : error,
      ["automovie-canonical-json-invalid", "invalid-unicode"],
    );
  }
  const shared = { value: 1 };
  const nullPrototype = Object.assign(
    Object.create(null) as Record<string, unknown>,
    { b: shared, a: shared },
  );
  TestValidator.equals(
    "plain null-prototype values and repeated non-cyclic references are admitted",
    canonicalizeAutoMovieJson(nullPrototype),
    '{"a":{"value":1},"b":{"value":1}}',
  );
  const legacyValue = { b: 2, a: 1 };
  const legacyDigest = digestAutoMovieBytes(Buffer.from('{"a":1,"b":2}'));
  const migratedSparse = verifyAutoMovieCanonicalJsonIdentity({
    value: new Array(1),
    protocol: AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL,
    digest: digestAutoMovieBytes(Buffer.from("[]")),
  });
  TestValidator.equals(
    "a recoverable sparse v1 identity preserves old identity and derives v2",
    migratedSparse.status === "migrated"
      ? [
          migratedSparse.legacyDigest,
          Buffer.from(migratedSparse.current.bytes).toString("utf8"),
          migratedSparse.current.protocol,
        ]
      : migratedSparse,
    [
      digestAutoMovieBytes(Buffer.from("[]")),
      "[null]",
      AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
    ],
  );
  TestValidator.equals(
    "current, stale, migrated and unverifiable states are disjoint",
    [
      verifyAutoMovieCanonicalJsonIdentity({
        value: legacyValue,
        protocol: AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
        digest: identifyAutoMovieCanonicalJson(legacyValue).digest,
      }).status,
      verifyAutoMovieCanonicalJsonIdentity({
        value: legacyValue,
        protocol: AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
        digest: digestAutoMovieBytes(Buffer.from("stale")),
      }).status,
      verifyAutoMovieCanonicalJsonIdentity({
        value: legacyValue,
        protocol: AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL,
        digest: legacyDigest,
      }).status,
      verifyAutoMovieCanonicalJsonIdentity({
        protocol: AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL,
        digest: legacyDigest,
      }).status,
      verifyAutoMovieCanonicalJsonIdentity({
        value: legacyValue,
        protocol: "unknown",
        digest: legacyDigest,
      }).status,
      verifyAutoMovieCanonicalJsonIdentity({
        value: new Date(0),
        protocol: AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
        digest: legacyDigest,
      }).status,
      verifyAutoMovieCanonicalJsonIdentity({
        value: new Date(0),
        protocol: AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL,
        digest: digestAutoMovieBytes(Buffer.from("{}")),
      }).status,
    ],
    [
      "current",
      "stale",
      "migrated",
      "unverifiable",
      "unverifiable",
      "unverifiable",
      "unverifiable",
    ],
  );
  const legacy = (value: unknown, digest = legacyDigest): string => {
    const verification = verifyAutoMovieCanonicalJsonIdentity({
      value,
      protocol: AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL,
      digest,
    });
    return verification.status === "unverifiable"
      ? `unverifiable: ${verification.reason}`
      : verification.status;
  };
  TestValidator.equals(
    "the legacy verifier reports stale digests and keeps its own exact refusals",
    {
      stale: legacy({ a: 1, b: 3 }),
      omittedMembers: legacy(
        { b: 2, a: 1, skipped: undefined, method: () => 1 },
        legacyDigest,
      ),
      nulledItems: legacy(
        [undefined, "text", true],
        digestAutoMovieBytes(Buffer.from('[null,"text",true]')),
      ),
      symbolMember: legacy({ b: 2, a: 1, tag: Symbol("tag") }),
      nestedScalars: legacy(
        { list: [null, false, 1.5, "s"] },
        digestAutoMovieBytes(Buffer.from('{"list":[null,false,1.5,"s"]}')),
      ),
      refusedBeforeLegacy: legacy({ value: 1n }).startsWith(
        "unverifiable: AutoMovieCanonicalJsonError",
      ),
    },
    {
      stale: "stale",
      omittedMembers: "migrated",
      nulledItems: "migrated",
      symbolMember: "migrated",
      nestedScalars: "migrated",
      refusedBeforeLegacy: true,
    },
  );
};
