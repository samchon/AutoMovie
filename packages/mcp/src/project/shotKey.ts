/**
 * The `shot:<beat>` id convention — one beat owns at most one shot, and the
 * shot's id is derived from the beat's, never free-form. The pairing threads
 * the whole resident store (a shot lives in `shots/<beat>.json`), the commit
 * preconditions, and the prerequisite ladder's prompts, so assembly and parsing
 * live here as the single implementation.
 */

/** The shot id the `beat` owns: `shot:<beat>`. */
export const shotIdOf = (beat: string): string => `shot:${beat}`;

/**
 * The beat that owns `shotId`, or `null` when the id does not follow the
 * `shot:<beat>` form (no prefix, or an empty beat) — the validating parse a
 * commit precondition reports as a violation. Lenient callers (the store's
 * filename keying) fall back with `beatOf(id) ?? id`.
 */
export const beatOf = (shotId: string): string | null => {
  if (!shotId.startsWith("shot:")) return null;
  const beat = shotId.slice("shot:".length);
  return beat.length === 0 ? null : beat;
};
