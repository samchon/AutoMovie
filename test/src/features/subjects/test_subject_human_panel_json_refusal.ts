import { assertHumanPanelRefusal } from "../internal/assertHumanPanelRefusal";

/**
 * Malformed region JSON cannot leave an older edit authorized to publish.
 *
 * Scenarios:
 * 1. Apply an incomplete JSON object while decoding a width edit; release the
 *    old result, retain the committed pair and error, and retry independently.
 */
export const test_subject_human_panel_json_refusal = async (): Promise<void> =>
  assertHumanPanelRefusal(async (f) => {
    f.element<HTMLTextAreaElement>("region-json").value = "{";
    await f.click("region-apply");
  });
