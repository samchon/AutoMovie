import { AutoMovieContentDigest } from "@automovie/interface";
import { createHash } from "node:crypto";

/**
 * Versioned review-fingerprint protocol.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-algorithm-change-and-collision Versions the domain-separated protocol used to identify one review state.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-algorithm-migration-collision Carries the protocol revision alongside review fingerprint inputs.
 */
export const AUTOMOVIE_REVIEW_FINGERPRINT_PROTOCOL =
  "automovie.review.fingerprint.v4";

/**
 * Versioned production-compiler input protocol.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-algorithm-change-and-collision Versions the domain-separated protocol used to identify one compile state.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-algorithm-migration-collision Carries the protocol revision alongside compiler fingerprint inputs.
 */
export const AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL =
  "automovie.compile.input.v2";

/**
 * One domain-separated field in a content fingerprint.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-binary-dependency-closure Gives each exact payload its ordered role in the digest closure.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-binary-closure-digest Preserves role, encoding kind, and bytes as distinct closure inputs.
 */
export interface IAutoMovieFingerprintField {
  /**
   * Semantic role, such as protocol, design or source.
   *
   * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-binary-dependency-closure Names the payload's logical position instead of relying on traversal order.
   * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-binary-closure-digest Domain-separates one closure member by role.
   */
  role: string;
  /**
   * Payload encoding or domain subtype.
   *
   * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-byte-and-semantic-identity Keeps an interpretation label separate from the payload bytes.
   * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-byte-semantic-identity Names the interpretation used for one fingerprint payload.
   */
  kind: string;
  /**
   * Exact payload bytes.
   *
   * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-binary-dependency-closure Supplies the immutable bytes included in the digest closure.
   * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-binary-closure-digest Keeps the binary member exact instead of substituting a locator.
   */
  payload: Uint8Array;
}

/**
 * Normalize source without erasing meaningful whitespace.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-byte-and-semantic-identity Produces a named semantic source representation without conflating it with raw bytes.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-byte-semantic-identity Defines the normalization that relates raw source bytes to their compile interpretation.
 */
export const normalizeAutoMovieSource = (source: Uint8Array): Uint8Array => {
  let text = Buffer.from(source).toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
};

/**
 * Return a stable SHA-256 content digest.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-byte-and-semantic-identity Identifies the exact supplied bytes without treating provenance as content.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-byte-semantic-identity Emits the raw byte identity independently from later interpretation identity.
 */
export const digestAutoMovieBytes = (
  bytes: Uint8Array,
): AutoMovieContentDigest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/**
 * Encode one persisted id as a portable filename segment.
 *
 * `encodeURIComponent` deliberately leaves `*`, `!`, `'`, `(` and `)`
 * untouched, while `*` is illegal in a Windows filename. Windows device
 * basenames such as `CON` remain reserved even with an extension. Escape the
 * complete RFC 3986 reserved tail and the first character of a device name so
 * every accepted string has one reversible cross-platform representation.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Encodes one logical identity without using a platform path spelling as that identity.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-element-dependency-identity Gives a stable filesystem representation to one logical element key.
 */
export const encodeAutoMoviePathSegment = (value: string): string => {
  let encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
  // Windows strips trailing dots from path components, while "." and ".."
  // retain traversal meaning on every supported filesystem. Percent-escape
  // those spellings so two logical ids never resolve to one physical leaf.
  if (encoded === "." || encoded === ".." || encoded.endsWith("."))
    encoded = `${encoded.slice(0, -1)}%2E`;
  if (
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/i.test(
      encoded,
    )
  )
    encoded = `%${encoded
      .charCodeAt(0)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0")}${encoded.slice(1)}`;
  if (Buffer.byteLength(encoded, "utf8") > 180)
    encoded = `~sha256-${createHash("sha256")
      .update(Buffer.from(value, "utf8"))
      .digest("hex")}`;
  return encoded;
};

/**
 * Decode a segment produced by {@link encodeAutoMoviePathSegment}.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-elements-dependencies Recovers reversible keys and refuses hashed spellings rather than guessing their logical identity.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-element-dependency-identity Keeps the path spelling subordinate to the separately stored logical element identity.
 */
export const decodeAutoMoviePathSegment = (value: string): string =>
  value.startsWith("~sha256-")
    ? (() => {
        throw new Error("Hashed path segments are decoded from file content.");
      })()
    : decodeURIComponent(value);

/**
 * Canonicalize a JSON-compatible value with lexicographically sorted keys.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-structured-canonicalization Makes supported structured values independent of property insertion order.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-structured-canonicalization Refuses unsupported scalar roots and emits one deterministic JSON spelling.
 */
export const canonicalizeAutoMovieJson = (value: unknown): string => {
  const encode = (current: unknown, arrayItem: boolean): string | undefined => {
    if (
      current === undefined ||
      typeof current === "function" ||
      typeof current === "symbol"
    )
      return arrayItem ? "null" : undefined;
    if (current === null || typeof current === "boolean")
      return JSON.stringify(current);
    if (typeof current === "string") return JSON.stringify(current);
    if (typeof current === "number") {
      if (Number.isFinite(current) === false)
        throw new TypeError(
          "AutoMovie canonical JSON refuses non-finite numbers.",
        );
      return JSON.stringify(current);
    }
    if (typeof current === "bigint")
      throw new TypeError("AutoMovie canonical JSON refuses bigint values.");
    if (Array.isArray(current))
      return `[${current.map((item) => encode(item, true)!).join(",")}]`;
    if (typeof current === "object") {
      const record = current as Record<string, unknown>;
      const entries = Object.keys(record)
        .sort(compareCodeUnits)
        .flatMap((key): string[] => {
          const encoded = encode(record[key], false);
          return encoded === undefined
            ? []
            : [`${JSON.stringify(key)}:${encoded}`];
        });
      return `{${entries.join(",")}}`;
    }
  };
  const encoded = encode(value, false);
  if (encoded === undefined)
    throw new TypeError(
      "AutoMovie canonical JSON requires a serializable root value.",
    );
  return encoded;
};

/**
 * Canonical JSON bytes for a fingerprint field.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-structured-canonicalization Fixes the UTF-8 byte representation of a canonical structured value.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-structured-canonicalization Lowers the canonical structure to deterministic fingerprint bytes.
 */
export const canonicalAutoMovieJsonBytes = (value: unknown): Uint8Array =>
  Buffer.from(canonicalizeAutoMovieJson(value), "utf8");

/**
 * Hash an ordered role/kind/payload stream with u64be length prefixes.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-binary-dependency-closure Prevents ambiguous concatenation while preserving the declared field order.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-binary-closure-digest Hashes each role, interpretation kind, and payload as a bounded closure member.
 */
export const fingerprintAutoMovieFields = (
  fields: readonly IAutoMovieFingerprintField[],
): AutoMovieContentDigest => {
  const hash = createHash("sha256");
  for (const field of fields)
    for (const value of [
      Buffer.from(field.role, "utf8"),
      Buffer.from(field.kind, "utf8"),
      Buffer.from(field.payload),
    ]) {
      const size = Buffer.alloc(8);
      size.writeBigUInt64BE(BigInt(value.length));
      hash.update(size);
      hash.update(value);
    }
  return `sha256:${hash.digest("hex")}`;
};

/**
 * Compare UTF-16 code units for deterministic filesystem and JSON ordering.
 *
 * @evidence requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-structured-canonicalization Supplies one locale-independent key order to canonical records.
 * @evidence specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-structured-canonicalization Orders supported property names without a host locale.
 */
export const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
