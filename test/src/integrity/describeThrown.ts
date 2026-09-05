/**
 * Return the stable diagnostic text contributed by a thrown value.
 *
 * Coverage instruments use the message of an `Error` directly so their own
 * failure prefix remains the diagnostic owner. JavaScript permits any value to
 * be thrown, so non-errors retain their ordinary string representation.
 */
export const describeThrown = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
