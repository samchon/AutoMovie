/**
 * The `shot:<beat>` id convention, one beat owns at most one shot, and the
 * shot's id is derived from the beat's, never free-form. The pairing threads
 * the whole resident store (a shot lives in `shots/<beat>.json`), the commit
 * preconditions, and the prerequisite ladder's prompts, so assembly and parsing
 * live here as the single implementation.
 */

/**
 * The shot id the `beat` owns: `shot:<beat>`.
 *
 * @evidence requirements/story/scope-and-source-of-truth.md#story-stable-unit-identity Derives a shot identity from its one stable owning beat rather than accepting another free-form id.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-story-unit-identity Implements the canonical beat-to-shot identity relation.
 */
export const shotIdOf = (beat: string): string => `shot:${beat}`;

/**
 * The beat that owns `shotId`, or `null` when the id does not follow the
 * `shot:<beat>` form (no prefix, or an empty beat), the validating parse a
 * commit precondition reports as a violation. Lenient callers (the store's
 * filename keying) fall back with `beatOf(id) ?? id`.
 *
 * @evidence requirements/story/scope-and-source-of-truth.md#story-stable-unit-identity Recovers only the stable beat identity carried by the canonical shot form.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-story-unit-identity Refuses malformed identities instead of inventing an owning story unit.
 */
export const beatOf = (shotId: string): string | null => {
  if (!shotId.startsWith("shot:")) return null;
  const beat = shotId.slice("shot:".length);
  return beat.length === 0 ? null : beat;
};
