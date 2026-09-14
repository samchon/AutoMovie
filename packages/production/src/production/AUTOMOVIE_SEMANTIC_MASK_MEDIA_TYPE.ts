/**
 * Media type under which a guide deliverable publishes a semantic-mask sidecar.
 *
 * A mask picture is unreadable without the palette that names its colours, so
 * the sidecar travels beside the frames as its own declared medium rather than
 * as generic JSON, and the probe parses and self-verifies it like any other
 * delivered byte stream.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Names the delivered semantic dependency of a mask frame as an explicit medium a final reader can reopen.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Fixes the media identity under which the palette hand-off is carried in a delivery ledger.
 */
export const AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE =
  "application/vnd.automovie.semantic-mask+json";
