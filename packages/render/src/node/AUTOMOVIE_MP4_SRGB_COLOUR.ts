/**
 * The ITU-T H.273 code points that spell sRGB in an MP4 `colr` box.
 *
 * Primaries 1 is BT.709, transfer 13 is IEC 61966-2-1 sRGB, matrix 1 is BT.709,
 * and full range means the samples use the complete code range. These are
 * standard identities rather than a project preference, and three readings
 * depend on the same four numbers: the delivery profile requires them, the track
 * probe classifies a container as sRGB by them, and the normalizer writes them.
 * Spelling them three times is how one of those readings drifts from the others.
 */
export const AUTOMOVIE_MP4_SRGB_COLOUR = {
  primaries: 1,
  transfer: 13,
  matrix: 1,
  fullRange: true,
} as const;
