import { AutoMovieContentDigest } from "@automovie/interface";
import { createHash } from "node:crypto";

import { decodeAutoMovieUtf8 } from "./strictUtf8";

/**
 * Why an external locator cannot cross the credential boundary.
 *
 * Non-URL identifiers remain valid inputs. A caller that requires a URL owns
 * its protocol and syntax policy separately from this credential boundary.
 *
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Detects credentials and malformed absolute URLs before source and license locators reach provenance.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-secret-reference-boundary Implements the shared external-locator boundary without rejecting non-URL license identifiers.
 */
export const autoMovieExternalLocatorRefusal = (
  value: string,
): "credential-bearing" | "malformed-absolute-url" | null => {
  try {
    const parsed = new URL(value);
    return parsed.username.length !== 0 || parsed.password.length !== 0
      ? "credential-bearing"
      : null;
  } catch {
    return /^[a-z][a-z0-9+.-]*:\/\//iu.test(value)
      ? "malformed-absolute-url"
      : null;
  }
};

/**
 * Versioned production-compiler input protocol.
 */
export const AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL =
  "automovie.compile.input.v2";

/** Current source-text normalization algorithm. */
export const AUTOMOVIE_SOURCE_NORMALIZATION_PROTOCOL =
  "automovie.source-normalization.v2";

/** Historical lossy source normalization accepted only for migration. */
export const AUTOMOVIE_LEGACY_SOURCE_NORMALIZATION_PROTOCOL =
  "automovie.source-normalization.v1";

/** Current structured-value canonicalization algorithm. */
export const AUTOMOVIE_CANONICAL_JSON_PROTOCOL = "automovie.canonical-json.v2";

/** Historical canonicalization protocol accepted only for explicit migration. */
export const AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL =
  "automovie.canonical-json.v1";

/** Inspectable accepted-domain and encoding rules of the current protocol. */
export const AUTOMOVIE_CANONICAL_JSON_DOMAIN = Object.freeze({
  protocol: AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
  containers: "plain-acyclic",
  arrayHoles: "null",
  arrayUnsupportedValues: "null",
  objectUnsupportedValues: "omit",
  numbers: "finite-json",
  unicode: "exact-scalar-sequence",
  keyOrder: "utf16-code-unit",
  encoding: "utf-8",
} as const);

/** Stable reasons a value cannot enter canonical JSON identity. */
export type AutoMovieCanonicalJsonErrorCategory =
  | "unsupported-value"
  | "invalid-unicode"
  | "cyclic-value"
  | "non-plain-container"
  | "accessor-property";

/** A typed refusal that never emits partial canonical text or identity. */
export class AutoMovieCanonicalJsonError extends TypeError {
  /** Stable machine-readable diagnostic code. */
  public readonly code = "automovie-canonical-json-invalid" as const;

  public constructor(
    /** Stable refusal category independent of engine error wording. */
    public readonly category: AutoMovieCanonicalJsonErrorCategory,
    detail: string,
  ) {
    super(`AutoMovie canonical JSON refused ${category}: ${detail}`);
    this.name = "AutoMovieCanonicalJsonError";
  }
}

/** Versioned source identity keeps exact bytes apart from permitted equivalence. */
export interface IAutoMovieSourceIdentity {
  /** Algorithm that produced the semantic representation. */
  protocol: typeof AUTOMOVIE_SOURCE_NORMALIZATION_PROTOCOL;
  /** SHA-256 of the exact input bytes, including BOM and EOL spelling. */
  rawDigest: AutoMovieContentDigest;
  /** Strictly decoded bytes after the declared BOM/EOL normalization. */
  normalized: Uint8Array;
  /** SHA-256 of {@link normalized}. */
  semanticDigest: AutoMovieContentDigest;
}

/** Outcome of verifying and, when possible, migrating a source identity. */
export type IAutoMovieSourceIdentityVerification =
  | { status: "current"; current: IAutoMovieSourceIdentity }
  | {
      status: "migrated";
      legacyDigest: AutoMovieContentDigest;
      current: IAutoMovieSourceIdentity;
    }
  | { status: "stale" }
  | { status: "unverifiable"; reason: string };

/** Versioned identity of one admitted structured value. */
export interface IAutoMovieCanonicalJsonIdentity {
  /** Algorithm that produced the canonical bytes. */
  protocol: typeof AUTOMOVIE_CANONICAL_JSON_PROTOCOL;
  /** Canonical valid JSON bytes. */
  bytes: Uint8Array;
  /** SHA-256 of {@link bytes}. */
  digest: AutoMovieContentDigest;
}

/** Outcome of verifying and, when possible, migrating an older JSON identity. */
export type IAutoMovieCanonicalJsonVerification =
  | {
      status: "current";
      current: IAutoMovieCanonicalJsonIdentity;
    }
  | {
      status: "migrated";
      legacyDigest: AutoMovieContentDigest;
      current: IAutoMovieCanonicalJsonIdentity;
    }
  | { status: "stale" }
  | { status: "unverifiable"; reason: string };

/**
 * One domain-separated field in a content fingerprint.
 */
export interface IAutoMovieFingerprintField {
  /**
   * Semantic role, such as protocol, design or source.
   */
  role: string;
  /**
   * Payload encoding or domain subtype.
   */
  kind: string;
  /**
   * Exact payload bytes.
   */
  payload: Uint8Array;
}

/**
 * Normalize source without erasing meaningful whitespace.
 */
export const normalizeAutoMovieSource = (source: Uint8Array): Uint8Array => {
  const text = decodeAutoMovieUtf8({
    record: "source",
    bytes: source,
    leadingBom: "strip",
  });
  return Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
};

/**
 * Normalize source and expose both exact-byte and semantic identities.
 *
 */
export const normalizeAutoMovieSourceIdentity = (props: {
  /** Source-relative pathname named by any decoding refusal. */
  path: string;
  /** Exact authored source bytes. */
  bytes: Uint8Array;
}): IAutoMovieSourceIdentity => {
  const text = decodeAutoMovieUtf8({
    record: props.path,
    bytes: props.bytes,
    leadingBom: "strip",
  });
  const normalized = Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
  return {
    protocol: AUTOMOVIE_SOURCE_NORMALIZATION_PROTOCOL,
    rawDigest: digestAutoMovieBytes(props.bytes),
    normalized,
    semanticDigest: digestAutoMovieBytes(normalized),
  };
};

/**
 * Verify an explicitly versioned source identity from its recoverable bytes.
 *
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reproduction-verification-boundary Reverifies a deterministic source identity by exact digest comparison and reports match, mismatch or unverifiable.
 */
export const verifyAutoMovieSourceIdentity = (props: {
  /** Source-relative pathname named by strict-decoding refusals. */
  path: string;
  /** Original source bytes; a bare semantic digest cannot be migrated safely. */
  bytes?: Uint8Array;
  /** Protocol declared by the persisted semantic identity. */
  protocol: string;
  /** Semantic digest produced under that protocol. */
  digest: AutoMovieContentDigest;
}): IAutoMovieSourceIdentityVerification => {
  if (props.bytes === undefined)
    return {
      status: "unverifiable",
      reason: "Original source bytes are required to verify source identity.",
    };
  let current: IAutoMovieSourceIdentity;
  try {
    current = normalizeAutoMovieSourceIdentity({
      path: props.path,
      bytes: props.bytes,
    });
  } catch (error) {
    return { status: "unverifiable", reason: String(error) };
  }
  if (props.protocol === AUTOMOVIE_SOURCE_NORMALIZATION_PROTOCOL)
    return current.semanticDigest === props.digest
      ? { status: "current", current }
      : { status: "stale" };
  if (props.protocol === AUTOMOVIE_LEGACY_SOURCE_NORMALIZATION_PROTOCOL) {
    const legacyDigest = digestAutoMovieBytes(
      legacyNormalizeAutoMovieSource(props.bytes),
    );
    if (legacyDigest !== props.digest) return { status: "stale" };
    return { status: "migrated", legacyDigest, current };
  }
  return {
    status: "unverifiable",
    reason: `Unknown source normalization protocol ${JSON.stringify(props.protocol)}.`,
  };
};

/**
 * Return a stable SHA-256 content digest.
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
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-cross-platform-paths Encodes a logical identity into one portable path segment so reserved names, separators and case cannot differ between Windows and POSIX.
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
 */
export const decodeAutoMoviePathSegment = (value: string): string =>
  value.startsWith("~sha256-")
    ? (() => {
        throw new Error("Hashed path segments are decoded from file content.");
      })()
    : decodeURIComponent(value);

/**
 * Canonicalize a JSON-compatible value with lexicographically sorted keys.
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-locale-time-determinism Serializes identities without locale, timezone or clock participation so the same input yields the same bytes on every host.
 */
export const canonicalizeAutoMovieJson = (value: unknown): string => {
  const active = new Set<object>();
  const encode = (current: unknown, arrayItem: boolean): string | undefined => {
    if (
      current === undefined ||
      typeof current === "function" ||
      typeof current === "symbol"
    )
      return arrayItem ? "null" : undefined;
    if (current === null || typeof current === "boolean")
      return JSON.stringify(current);
    if (typeof current === "string") {
      assertScalarString(current, "value");
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (Number.isFinite(current) === false)
        throw new AutoMovieCanonicalJsonError(
          "unsupported-value",
          "numbers must be finite",
        );
      return JSON.stringify(current);
    }
    if (typeof current === "bigint")
      throw new AutoMovieCanonicalJsonError(
        "unsupported-value",
        "bigint has no JSON representation",
      );
    if (Array.isArray(current)) {
      enterCanonicalContainer(active, current);
      try {
        const items: string[] = [];
        for (let index = 0; index < current.length; ++index) {
          if (!Object.prototype.hasOwnProperty.call(current, index)) {
            items.push("null");
            continue;
          }
          const descriptor = Object.getOwnPropertyDescriptor(current, index)!;
          if ("value" in descriptor === false)
            throw new AutoMovieCanonicalJsonError(
              "accessor-property",
              "array slots must be data properties",
            );
          items.push(encode(descriptor.value, true)!);
        }
        return `[${items.join(",")}]`;
      } finally {
        active.delete(current);
      }
    }
    if (typeof current === "object") {
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null)
        throw new AutoMovieCanonicalJsonError(
          "non-plain-container",
          "only plain objects and arrays are admitted",
        );
      enterCanonicalContainer(active, current);
      const record = current as Record<string, unknown>;
      try {
        const entries = Object.keys(record)
          .sort(compareCodeUnits)
          .flatMap((key): string[] => {
            assertScalarString(key, "member name");
            const descriptor = Object.getOwnPropertyDescriptor(record, key)!;
            if ("value" in descriptor === false)
              throw new AutoMovieCanonicalJsonError(
                "accessor-property",
                "object members must be data properties",
              );
            const encoded = encode(descriptor.value, false);
            return encoded === undefined
              ? []
              : [`${JSON.stringify(key)}:${encoded}`];
          });
        return `{${entries.join(",")}}`;
      } finally {
        active.delete(current);
      }
    }
  };
  const encoded = encode(value, false);
  if (encoded === undefined)
    throw new AutoMovieCanonicalJsonError(
      "unsupported-value",
      "the root must have a JSON representation",
    );
  return encoded;
};

/**
 * Create the current versioned canonical JSON identity.
 *
 */
export const identifyAutoMovieCanonicalJson = (
  value: unknown,
): IAutoMovieCanonicalJsonIdentity => {
  const bytes = canonicalAutoMovieJsonBytes(value);
  return {
    protocol: AUTOMOVIE_CANONICAL_JSON_PROTOCOL,
    bytes,
    digest: digestAutoMovieBytes(bytes),
  };
};

/**
 * Canonicalize under an explicitly selected current protocol.
 *
 */
export const canonicalizeAutoMovieJsonForProtocol = (props: {
  /** Required current algorithm identity. */
  protocol: typeof AUTOMOVIE_CANONICAL_JSON_PROTOCOL;
  /** Structured value in the declared accepted domain. */
  value: unknown;
}): IAutoMovieCanonicalJsonIdentity => {
  if (props.protocol !== AUTOMOVIE_CANONICAL_JSON_PROTOCOL)
    throw new AutoMovieCanonicalJsonError(
      "unsupported-value",
      `protocol ${JSON.stringify(props.protocol)} is not current`,
    );
  return identifyAutoMovieCanonicalJson(props.value);
};

/**
 * Verify an explicitly versioned JSON identity and rederive the current one.
 *
 */
export const verifyAutoMovieCanonicalJsonIdentity = (props: {
  /** Original structured value; a bare digest cannot be migrated safely. */
  value?: unknown;
  /** Protocol declared by the persisted identity. */
  protocol: string;
  /** Digest produced under that protocol. */
  digest: AutoMovieContentDigest;
}): IAutoMovieCanonicalJsonVerification => {
  if (props.value === undefined)
    return {
      status: "unverifiable",
      reason: "Original structured value is required to verify canonical JSON.",
    };
  if (props.protocol === AUTOMOVIE_CANONICAL_JSON_PROTOCOL) {
    let current: IAutoMovieCanonicalJsonIdentity;
    try {
      current = identifyAutoMovieCanonicalJson(props.value);
    } catch (error) {
      return { status: "unverifiable", reason: String(error) };
    }
    return current.digest === props.digest
      ? { status: "current", current }
      : { status: "stale" };
  }
  if (props.protocol === AUTOMOVIE_LEGACY_CANONICAL_JSON_PROTOCOL) {
    let current: IAutoMovieCanonicalJsonIdentity;
    let legacy: Uint8Array;
    try {
      current = identifyAutoMovieCanonicalJson(props.value);
      legacy = Buffer.from(legacyCanonicalizeJson(props.value), "utf8");
    } catch (error) {
      return { status: "unverifiable", reason: String(error) };
    }
    if (digestAutoMovieBytes(legacy) !== props.digest)
      return { status: "stale" };
    return {
      status: "migrated",
      legacyDigest: props.digest,
      current,
    };
  }
  return {
    status: "unverifiable",
    reason: `Unknown canonical JSON protocol ${JSON.stringify(props.protocol)}.`,
  };
};

/**
 * Canonical JSON bytes for a fingerprint field.
 */
export const canonicalAutoMovieJsonBytes = (value: unknown): Uint8Array =>
  Buffer.from(canonicalizeAutoMovieJson(value), "utf8");

/**
 * Hash an ordered role/kind/payload stream with u64be length prefixes.
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
 */
export const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Refuse cycles while permitting repeated, non-recursive references. */
const enterCanonicalContainer = (active: Set<object>, value: object): void => {
  if (active.has(value))
    throw new AutoMovieCanonicalJsonError(
      "cyclic-value",
      "a container refers to itself through its active ancestry",
    );
  active.add(value);
};

/** JSON escape syntax can encode lone surrogates, but this protocol cannot. */
const assertScalarString = (value: string, role: string): void => {
  for (let index = 0; index < value.length; ++index) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length)
        throw new AutoMovieCanonicalJsonError(
          "invalid-unicode",
          `${role} ends with a lone high surrogate`,
        );
      const trail = value.charCodeAt(index + 1);
      if (trail < 0xdc00 || trail > 0xdfff)
        throw new AutoMovieCanonicalJsonError(
          "invalid-unicode",
          `a lone surrogate occurs in ${role}`,
        );
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff)
      throw new AutoMovieCanonicalJsonError(
        "invalid-unicode",
        `a lone surrogate occurs in ${role}`,
      );
  }
};

/** Exact lossy predecessor used only to verify a declared v1 source digest. */
const legacyNormalizeAutoMovieSource = (source: Uint8Array): Uint8Array => {
  let text = Buffer.from(source).toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return Buffer.from(text.replace(/\r\n?/g, "\n"), "utf8");
};

/**
 * Exact predecessor algorithm, used only to verify a declared v1 digest.
 *
 * It runs only after {@link identifyAutoMovieCanonicalJson} admitted the same
 * value, so every number is finite, no bigint occurs, and the root has a JSON
 * representation. The predecessor's own refusals of those inputs can never be
 * reached from here and are therefore not repeated; what remains is the exact
 * v1 encoding of the admitted domain, including its lossy treatment of array
 * holes and unsupported members.
 */
const legacyCanonicalizeJson = (value: unknown): string => {
  const encode = (current: unknown, arrayItem: boolean): string | undefined => {
    if (
      current === undefined ||
      typeof current === "function" ||
      typeof current === "symbol"
    )
      return arrayItem ? "null" : undefined;
    if (Array.isArray(current))
      return `[${current.map((item) => encode(item, true)!).join(",")}]`;
    if (typeof current === "object" && current !== null) {
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
    return JSON.stringify(current);
  };
  return encode(value, false)!;
};
