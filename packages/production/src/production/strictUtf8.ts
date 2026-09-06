/** Stable categories for malformed UTF-8 refusals. */
export type AutoMovieUtf8ErrorCategory =
  | "isolated-continuation"
  | "invalid-leader"
  | "invalid-continuation"
  | "truncated-sequence"
  | "overlong-sequence"
  | "surrogate-scalar"
  | "out-of-range-scalar"
  | "unexpected-bom";

/** A deterministic refusal of malformed text bytes. */
export class AutoMovieUtf8Error extends Error {
  /** Stable machine-readable diagnostic code. */
  public readonly code = "automovie-invalid-utf8" as const;

  public constructor(
    /** Logical record or asset being decoded. */
    public readonly record: string,
    /** First byte that proves the sequence invalid. */
    public readonly offset: number,
    /** Stable reason independent of the host decoder's wording. */
    public readonly category: AutoMovieUtf8ErrorCategory,
  ) {
    super(
      `AutoMovie text record "${record}" has invalid UTF-8 at byte ${offset} (${category}).`,
    );
    this.name = "AutoMovieUtf8Error";
  }
}

/** Policy for an initial UTF-8 BOM after strict validation. */
export type AutoMovieLeadingBomPolicy = "preserve" | "strip" | "reject";

/**
 * Strictly decode one UTF-8 record without replacement characters.
 *
 */
export const decodeAutoMovieUtf8 = (props: {
  /** Logical record or asset named by any refusal. */
  record: string;
  /** Exact bytes to decode. */
  bytes: Uint8Array;
  /** Domain-specific treatment of one initial BOM. */
  leadingBom: AutoMovieLeadingBomPolicy;
}): string => {
  validateUtf8(props.record, props.bytes);
  const hasBom =
    props.bytes.length >= 3 &&
    props.bytes[0] === 0xef &&
    props.bytes[1] === 0xbb &&
    props.bytes[2] === 0xbf;
  if (hasBom && props.leadingBom === "reject")
    throw new AutoMovieUtf8Error(props.record, 0, "unexpected-bom");
  const start = hasBom && props.leadingBom === "strip" ? 3 : 0;
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
    props.bytes.subarray(start),
  );
};

/** Validate scalar UTF-8 and report the first proving byte. */
const validateUtf8 = (record: string, bytes: Uint8Array): void => {
  let cursor = 0;
  while (cursor < bytes.length) {
    const leader = bytes[cursor]!;
    if (leader <= 0x7f) {
      cursor += 1;
      continue;
    }
    if (leader >= 0x80 && leader <= 0xbf)
      throw new AutoMovieUtf8Error(record, cursor, "isolated-continuation");
    if (leader === 0xc0 || leader === 0xc1)
      throw new AutoMovieUtf8Error(record, cursor, "overlong-sequence");
    if (leader >= 0xc2 && leader <= 0xdf) {
      requireContinuation(record, bytes, cursor, 1);
      cursor += 2;
      continue;
    }
    if (leader >= 0xe0 && leader <= 0xef) {
      requireContinuation(record, bytes, cursor, 1);
      const second = bytes[cursor + 1]!;
      if (leader === 0xe0 && second < 0xa0)
        throw new AutoMovieUtf8Error(record, cursor, "overlong-sequence");
      if (leader === 0xed && second >= 0xa0)
        throw new AutoMovieUtf8Error(record, cursor, "surrogate-scalar");
      requireContinuation(record, bytes, cursor, 2);
      cursor += 3;
      continue;
    }
    if (leader >= 0xf0 && leader <= 0xf4) {
      requireContinuation(record, bytes, cursor, 1);
      const second = bytes[cursor + 1]!;
      if (leader === 0xf0 && second < 0x90)
        throw new AutoMovieUtf8Error(record, cursor, "overlong-sequence");
      if (leader === 0xf4 && second > 0x8f)
        throw new AutoMovieUtf8Error(record, cursor, "out-of-range-scalar");
      requireContinuation(record, bytes, cursor, 3);
      cursor += 4;
      continue;
    }
    throw new AutoMovieUtf8Error(record, cursor, "invalid-leader");
  }
};

/** Check the continuation tail of one already classified leader. */
const requireContinuation = (
  record: string,
  bytes: Uint8Array,
  leaderOffset: number,
  count: number,
): void => {
  for (let index = 1; index <= count; ++index) {
    const offset = leaderOffset + index;
    if (offset >= bytes.length)
      throw new AutoMovieUtf8Error(record, leaderOffset, "truncated-sequence");
    const byte = bytes[offset]!;
    if (byte < 0x80 || byte > 0xbf)
      throw new AutoMovieUtf8Error(record, offset, "invalid-continuation");
  }
};
