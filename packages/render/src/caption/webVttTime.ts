/**
 * Render one millisecond offset as a WebVTT timestamp.
 *
 * Fixed two-digit hours, minutes and seconds with three-digit milliseconds, so
 * one cue boundary has exactly one spelling on every host.
 */
export const webVttTime = (milliseconds: number): string => {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainder = Math.floor((milliseconds % 60_000) / 1_000);
  const fraction = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(remainder).padStart(2, "0")}.${String(fraction).padStart(
    3,
    "0",
  )}`;
};
