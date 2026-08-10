import { AutoMovieContentDigest } from "@automovie/interface";

/**
 * SHA-256 over a UTF-8 string, in pure TypeScript.
 *
 * The engine cannot reach `node:crypto`: the viewer bundles the engine into a
 * browser, so a Node built-in here would break the one consumer that has to
 * agree with the capture path byte for byte. It also cannot reach
 * `SubtleCrypto`, which is asynchronous and unavailable outside a secure
 * context, and a digest that is sometimes a promise is a digest no synchronous
 * evidence path can use.
 *
 * So the transform is written out. It is the FIPS 180-4 algorithm with no
 * variation, which means the same bytes hash to the same digest as
 * `createHash("sha256")` does on the capture side, and the test suite proves
 * exactly that against Node's implementation rather than against a stored
 * expectation of this code's own output.
 *
 * Everything is 32-bit integer arithmetic with `>>> 0` normalization, so
 * endianness, word size, and floating-point behavior cannot make one platform
 * disagree with another.
 *
 * @author Samchon
 */
export const autoMovieRenderDigest = (text: string): AutoMovieContentDigest =>
  `sha256:${sha256Hex(utf8Bytes(text))}`;

/**
 * Encode a string as UTF-8 bytes without `TextEncoder`.
 *
 * `TextEncoder` is present in Node 22 and in every browser, but not in every
 * embedder the viewer is dropped into, and a digest that silently changes when
 * a polyfill differs is worse than a loop. Lone surrogates encode as U+FFFD,
 * which is what `TextEncoder` does, so an id carrying broken UTF-16 still
 * digests identically on both sides.
 */
export const utf8Bytes = (text: string): number[] => {
  const bytes: number[] = [];
  for (let index = 0; index < text.length; ++index) {
    let point = text.charCodeAt(index);
    if (point >= 0xd800 && point <= 0xdbff) {
      const low = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
      if (low >= 0xdc00 && low <= 0xdfff) {
        point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
        ++index;
      } else point = 0xfffd;
    } else if (point >= 0xdc00 && point <= 0xdfff) point = 0xfffd;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800)
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
    else if (point < 0x10000)
      bytes.push(
        0xe0 | (point >> 12),
        0x80 | ((point >> 6) & 63),
        0x80 | (point & 63),
      );
    else
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 63),
        0x80 | ((point >> 6) & 63),
        0x80 | (point & 63),
      );
  }
  return bytes;
};

const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const rotateRight = (value: number, bits: number): number =>
  ((value >>> bits) | (value << (32 - bits))) >>> 0;

/** Hash a byte sequence and return the lowercase hexadecimal digest. */
const sha256Hex = (bytes: readonly number[]): string => {
  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  // Padding: the 0x80 terminator, zeroes, and a 64-bit big-endian bit length.
  // The block count is exactly what makes the 55/56-byte boundary the one this
  // routine has to get right, and the suite pins both sides of it.
  const blocks = Math.floor((bytes.length + 8) / 64) + 1;
  const padded = new Array<number>(blocks * 64).fill(0);
  for (let index = 0; index < bytes.length; ++index)
    padded[index] = bytes[index]!;
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  // A JavaScript number holds the exact bit length of any string this engine
  // digests; the high word is written from the same value so the encoding is
  // the full 64-bit field the standard requires.
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for (let byte = 0; byte < 4; ++byte) {
    padded[padded.length - 8 + byte] = (high >>> ((3 - byte) * 8)) & 0xff;
    padded[padded.length - 4 + byte] = (low >>> ((3 - byte) * 8)) & 0xff;
  }

  const schedule = new Array<number>(64).fill(0);
  for (let block = 0; block < blocks; ++block) {
    const base = block * 64;
    for (let word = 0; word < 16; ++word)
      schedule[word] =
        ((padded[base + word * 4]! << 24) |
          (padded[base + word * 4 + 1]! << 16) |
          (padded[base + word * 4 + 2]! << 8) |
          padded[base + word * 4 + 3]!) >>>
        0;
    for (let word = 16; word < 64; ++word) {
      const previous = schedule[word - 15]!;
      const ahead = schedule[word - 2]!;
      const s0 =
        (rotateRight(previous, 7) ^
          rotateRight(previous, 18) ^
          (previous >>> 3)) >>>
        0;
      const s1 =
        (rotateRight(ahead, 17) ^ rotateRight(ahead, 19) ^ (ahead >>> 10)) >>>
        0;
      schedule[word] =
        (schedule[word - 16]! + s0 + schedule[word - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let round = 0; round < 64; ++round) {
      const s1 =
        (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choose = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 =
        (h + s1 + choose + ROUND_CONSTANTS[round]! + schedule[round]!) >>> 0;
      const s0 =
        (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    const round = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 8; ++index)
      state[index] = (state[index]! + round[index]!) >>> 0;
  }

  return state.map((word) => word.toString(16).padStart(8, "0")).join("");
};

/**
 * A deterministic 32-bit FNV-1a hash of a string.
 *
 * Used to place a semantic id in the mask palette. FNV-1a rather than the
 * digest above because a palette slot needs a fast, well-distributed integer
 * and not a cryptographic guarantee; the mask's collision handling, not the
 * hash, is what makes the palette exact.
 */
export const autoMovieRenderHash32 = (text: string): number => {
  let hash = 0x811c9dc5;
  const bytes = utf8Bytes(text);
  for (const byte of bytes) {
    hash = (hash ^ byte) >>> 0;
    // hash * 16777619 without losing the high bits to float rounding.
    hash =
      (((hash << 1) >>> 0) +
        ((hash << 4) >>> 0) +
        ((hash << 7) >>> 0) +
        ((hash << 8) >>> 0) +
        ((hash << 24) >>> 0)) >>>
      0;
  }
  return hash >>> 0;
};

/**
 * Compare two strings by UTF-16 code unit.
 *
 * `Array.prototype.sort` without a comparator, and every locale-aware
 * comparison, order differently on different hosts. Evidence that reorders
 * itself by operating-system language is not evidence.
 */
export const compareAutoMovieRenderIds = (
  left: string,
  right: string,
): number => (left < right ? -1 : left > right ? 1 : 0);
