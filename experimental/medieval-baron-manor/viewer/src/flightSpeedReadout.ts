/**
 * Describe the inspection eye's requested speed and the speed its recent
 * frames actually carried.
 *
 * Each frame contributes no more than the integration budget, so a slow scene
 * can move the eye less far than the requested metres per second imply. The
 * largest interval is omitted as a returning-tab gap; a consistently slow
 * scene still leaves the rest of its frame population to measure.
 */
export const flightSpeedReadout = (
  speed: number,
  frames: readonly number[],
  budgetSeconds: number,
): string => {
  const asked = speed.toFixed(2);
  const largest = Math.max(...frames, 0);
  let dropped = false;
  let real = 0;
  let carried = 0;
  let counted = 0;
  for (const interval of frames) {
    if (dropped === false && interval === largest) {
      dropped = true;
      continue;
    }
    real += interval;
    carried += Math.min(interval, budgetSeconds);
    counted += 1;
  }
  if (real <= 0) return `${asked}m/s`;
  const flown = (speed * (carried / real)).toFixed(2);
  return flown === asked
    ? `${asked}m/s`
    : `${asked}m/s (flying ${flown}m/s at ${(counted / real).toFixed(1)}fps)`;
};
