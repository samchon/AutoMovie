import { AutoMovieCanonicalJsonError } from "./AutoMovieCanonicalJsonError";
import { compareCodeUnits } from "./compareCodeUnits";

/**
 * Canonicalize a JSON-compatible value under `automovie.canonical-json.v2`.
 *
 * Members are ordered by UTF-16 code unit, array holes and unsupported array
 * items become `null`, unsupported object members are omitted, and numbers,
 * strings and member names must be finite JSON scalars and exact Unicode scalar
 * sequences. Cycles, accessors and non-plain containers are refused.
 *
 * This is the one implementation of the protocol. It lives in the engine
 * because a browser viewer has to reproduce the same identity as the Node
 * builder without reaching a Node built-in. The returned text never contains a
 * lone surrogate, so its UTF-8 encoding is identical whether a runtime encodes
 * it with `Buffer`, `TextEncoder` or the engine's own encoder, and one SHA-256
 * over those bytes is one identity on every runtime.
 *
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-canonical-fingerprint Fixes member order, finite scalars, strings and absent values so equal inputs yield one text on every runtime.
 * @evidence requirements/rendering/frame-identity-and-content-addressing.md#rendering-digest-refusal Refuses non-finite numbers, bigint, invalid Unicode, cycles and accessors instead of emitting a partial identity.
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-locale-time-determinism Serializes identities without locale, timezone or clock participation so the same input yields the same bytes on every host.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Implements the property ordering, finite scalar, string and absent value representation the canonical serialization fixes.
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
    // Every JavaScript value the branches above did not return for is an
    // object, so no further type test can fail here.
    const container = current as object;
    const prototype = Object.getPrototypeOf(container);
    if (prototype !== Object.prototype && prototype !== null)
      throw new AutoMovieCanonicalJsonError(
        "non-plain-container",
        "only plain objects and arrays are admitted",
      );
    enterCanonicalContainer(active, container);
    const record = container as Record<string, unknown>;
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
      active.delete(container);
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
