import { assertHumanPanelRefusal } from "../internal/assertHumanPanelRefusal";

/**
 * A blank numeric entry withdraws the previous edit's publication authority.
 *
 * Scenarios:
 * 1. Clear eye height while an eye-width edit is decoding; dispose the late
 *    result, retain the last pair and error, and recover from committed values.
 */
export const test_subject_human_panel_blank_refusal = async (): Promise<void> =>
  assertHumanPanelRefusal((f) => f.change("trait-eyeHeight", ""));
