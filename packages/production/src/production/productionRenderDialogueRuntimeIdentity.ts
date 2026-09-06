import type { AutoMovieContentDigest } from "@automovie/interface";

const isContentDigest = (value: unknown): value is AutoMovieContentDigest =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);

/**
 * Bind one planned dialogue runtime to the final-byte state used by a capture.
 * Missing is never interpreted as silence because old plans did not carry this
 * identity and therefore require replanning.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-freshness Refuses a frame whose mouth state was drawn from dialogue bytes outside the current render derivation.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Keeps the captured visual artifact on the exact current derivation required by its source authority.
 */
export const assertProductionRenderDialogueRuntimeIdentity = (props: {
  /** Human-readable render boundary, slot, frame, layer, or preview identity. */
  boundary: string;
  /** Planned final-byte dialogue identity; null means a deliberately silent plan. */
  expected: unknown;
  /** Final-byte dialogue identity reported by the actual capture. */
  observed: unknown;
}): AutoMovieContentDigest | null => {
  if (props.boundary.trim().length === 0)
    throw new Error("Dialogue runtime comparison boundary is invalid.");
  if (props.expected !== null && isContentDigest(props.expected) === false)
    throw new Error(
      `Planned dialogue runtime identity is missing or invalid at ${props.boundary}. Replan before rendering.`,
    );
  if (props.observed === undefined)
    throw new Error(
      `Capture omitted its dialogue runtime identity at ${props.boundary}. Replan and capture again.`,
    );
  if (props.observed !== null && isContentDigest(props.observed) === false)
    throw new Error(
      `Capture returned an invalid dialogue runtime identity at ${props.boundary}. Rebuild the dialogue runtime and capture again.`,
    );
  if (props.observed !== props.expected)
    throw new Error(
      `Capture dialogue runtime identity differs from the render plan at ${props.boundary}: expected ${props.expected ?? "null"}, observed ${props.observed ?? "null"}. Replan before rendering.`,
    );
  return props.observed;
};
