const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Clamp preset scalars to `[0, 1]`; invalid numbers fall back to the zero end. */
export const clampUnitParameter = (value: number | undefined): number =>
  clamp(Number.isFinite(value) ? (value as number) : 0, 0, 1);

/** Clamp signed preset offsets to `[-1, 1]`; invalid numbers fall back neutral. */
export const clampSignedParameter = (value: number | undefined): number =>
  clamp(Number.isFinite(value) ? (value as number) : 0, -1, 1);
