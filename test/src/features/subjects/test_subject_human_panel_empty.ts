import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Controls cannot export or traverse history before the initial read is complete.
 *
 * Scenarios:
 * 1. Pending initial input leaves no committed snapshot or downloadable asset.
 * 2. Region and file-cancel events remain safe during that pending state.
 * 3. Completion installs the selected document and its optional-region omission.
 */
export const test_subject_human_panel_empty = async (): Promise<void> => {
  let finishRead!: (text: string) => void;
  const f = createHumanPanelFixture({
    read: () =>
      new Promise<string>((resolve) => {
        finishRead = resolve;
      }),
  });
  TestValidator.equals("no initial snapshot", f.panel.snapshot(), undefined);
  for (const id of [
    "face-save",
    "face-glb",
    "face-gltf",
    "face-undo",
    "face-redo",
    "face-reset",
  ])
    await f.click(id);
  TestValidator.equals("no premature download", f.downloads, []);
  await f.change("face-region", "cheek");
  const file = f.element<HTMLInputElement>("face-file");
  await file.onchange!.call(file, {
    currentTarget: { files: null, value: "" },
  } as unknown as Event);
  await f.click("face-load");
  finishRead(JSON.stringify(humanFaceFixture("ready")));
  await f.panel.ready;
  TestValidator.equals(
    "initial completion",
    f.panel.snapshot()!.document.id,
    "ready",
  );
  TestValidator.equals(
    "optional cheek absent",
    f.element<HTMLTextAreaElement>("region-json").value,
    "null",
  );
  TestValidator.equals(
    "no phantom optional scalars",
    f.element("detail-controls").childElementCount,
    0,
  );
  f.dom.window.close();
};
