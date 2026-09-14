import { assertHumanPanelRefusal } from "../internal/assertHumanPanelRefusal";

/**
 * An out-of-envelope detail input supersedes an earlier in-flight edit.
 *
 * Scenarios:
 * 1. Refuse a fold depth of 99 while decoding an eye-width edit; dispose its
 *    late result, retain the last pair and error, then retry without that draft.
 */
export const test_subject_human_panel_detail_refusal =
  async (): Promise<void> =>
    assertHumanPanelRefusal((f) => f.change("detail-eye-foldDepth", "99"));
