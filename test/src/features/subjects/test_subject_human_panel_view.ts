import { TestValidator } from "@nestia/e2e";

import { createHumanPanelFixture } from "../internal/createHumanPanelFixture";

/**
 * The panel routes view-only controls and committed file downloads without changing identity.
 *
 * Scenarios:
 * 1. An omitted appearance palette still exposes the version-default skin channels.
 * 2. Camera, fit and clay operations reach viewport ports but do not modify the face document.
 * 3. JSON, GLB and glTF/buffer downloads use the last committed identity and asset bytes.
 * 4. Selecting another subject rebuilds, publishes and fits it; an unknown selection does nothing.
 */
export const test_subject_human_panel_view = async (): Promise<void> => {
  const f = createHumanPanelFixture();
  await f.panel.ready;
  const before = f.panel.snapshot()!.document;
  TestValidator.predicate(
    "default skin control exists",
    f.element("material-skin-r") !== null,
  );
  TestValidator.predicate(
    "source omission is explicit",
    f.element("source-note").textContent!.includes("No source provenance"),
  );
  const view = f.app.querySelector<HTMLButtonElement>('[data-view="45"]')!;
  view.onclick!.call(view, f.clickEvent());
  await f.click("fit-view");
  const clay = f.element<HTMLInputElement>("clay");
  clay.checked = true;
  clay.onchange!.call(clay, new f.dom.window.Event("change"));
  clay.checked = false;
  clay.onchange!.call(clay, new f.dom.window.Event("change"));
  TestValidator.equals(
    "camera and clay routed",
    [f.views, f.clays, f.fits()],
    [[45], [true, false], 2],
  );
  TestValidator.equals(
    "view controls preserve document",
    f.panel.snapshot()!.document,
    before,
  );
  await f.click("face-save");
  await f.click("face-glb");
  await f.click("face-gltf");
  TestValidator.equals(
    "committed download filenames",
    f.downloads.map((file) => file.name),
    ["first.face.json", "first.glb", "mesh.bin", "first.gltf"],
  );
  TestValidator.equals(
    "saved document identity",
    JSON.parse(f.downloads[0].bytes as string).id,
    "first",
  );
  TestValidator.equals(
    "opaque GLB bytes",
    [...(f.downloads[1].bytes as Uint8Array)],
    [1, 2, 3],
  );
  TestValidator.equals(
    "external glTF buffer",
    [...(f.downloads[2].bytes as Uint8Array)],
    [4, 5],
  );
  await f.change("face-subject", "second");
  TestValidator.equals(
    "selected subject",
    f.panel.snapshot()!.document.id,
    "second",
  );
  TestValidator.equals("both models published", f.published, [
    "first",
    "second",
  ]);
  await f.change("face-subject", "missing");
  TestValidator.equals("unknown selection unchanged", f.published.length, 2);
  TestValidator.equals("one cancel per read", f.cancellations(), 2);
  f.dom.window.close();
};
