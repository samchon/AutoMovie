import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * File-input data is parsed before it can replace the committed face.
 *
 * Scenarios:
 * 1. A non-Error read rejection is displayed and retains the previous document.
 * 2. A valid text payload loads a new document and clears the file selection.
 */
export const test_subject_human_panel_load = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  const file = f.element<HTMLInputElement>("face-file");
  let rejectRead!: (cause: unknown) => void;
  const failed = {
    files: [
      {
        text: (): Promise<string> =>
          new Promise((_resolve, reject) => {
            rejectRead = reject;
          }),
      },
    ],
    value: "failed",
  };
  const pending = file.onchange!.call(file, {
    currentTarget: failed,
  } as unknown as Event);
  rejectRead("read-failure");
  await pending;
  TestValidator.equals(
    "read rejection visible",
    f.element("face-status").textContent,
    "read-failure",
  );
  TestValidator.equals(
    "previous identity retained",
    f.panel.snapshot()!.document.id,
    "first",
  );
  const loaded = {
    files: [{ text: async () => JSON.stringify(humanFaceFixture("loaded")) }],
    value: "chosen",
  };
  await file.onchange!.call(file, {
    currentTarget: loaded,
  } as unknown as Event);
  TestValidator.equals(
    "new input committed",
    f.panel.snapshot()!.document.id,
    "loaded",
  );
  TestValidator.equals("selection cleared", loaded.value, "");
  f.dom.window.close();
};
