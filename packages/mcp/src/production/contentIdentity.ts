import { AutoMovieContentDigest } from "@automovie/interface";
import { createHash } from "node:crypto";

/** Versioned review-fingerprint protocol. */
export const AUTOMOVIE_REVIEW_FINGERPRINT_PROTOCOL =
  "automovie.review.fingerprint.v1";

/** Versioned production-compiler input protocol. */
export const AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL =
  "automovie.compile.input.v1";

/** One domain-separated field in a content fingerprint. */
export interface IAutoMovieFingerprintField {
  /** Semantic role, such as protocol, design or source. */
  role: string;
  /** Payload encoding or domain subtype. */
  kind: string;
  /** Exact payload bytes. */
  payload: Uint8Array;
}

/** Normalize source without erasing meaningful whitespace. */
export const normalizeAutoMovieSource = (source: Uint8Array): Uint8Array => {
  let text = Buffer.from(source).toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
};

/** Return a stable SHA-256 content digest. */
export const digestAutoMovieBytes = (
  bytes: Uint8Array,
): AutoMovieContentDigest =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Canonicalize a JSON-compatible value with lexicographically sorted keys. */
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
    /* c8 ignore next 3 -- JavaScript typeof cases above are exhaustive. */
    throw new TypeError(
      "AutoMovie canonical JSON received an unsupported value.",
    );
  };
  const encoded = encode(value, false);
  if (encoded === undefined)
    throw new TypeError(
      "AutoMovie canonical JSON requires a serializable root value.",
    );
  return encoded;
};

/** Canonical JSON bytes for a fingerprint field. */
export const canonicalAutoMovieJsonBytes = (value: unknown): Uint8Array =>
  Buffer.from(canonicalizeAutoMovieJson(value), "utf8");

/** Hash an ordered role/kind/payload stream with u64be length prefixes. */
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

/** Compare UTF-16 code units for deterministic filesystem and JSON ordering. */
export const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
