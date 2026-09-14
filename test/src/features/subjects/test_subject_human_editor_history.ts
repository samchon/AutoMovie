import { createHumanFaceEditor } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * History belongs to committed face documents and traverses the same builder.
 *
 * Scenarios:
 * 1. Empty undo/redo are no-ops and caller/snapshot mutation cannot change state.
 * 2. Successful edits, undo, redo and reset preserve document/model agreement.
 * 3. A new edit after undo clears redo, while reset itself remains undoable.
 * 4. Builder mutation cannot change the committed candidate document.
 */
export const test_subject_human_editor_history = async (): Promise<void> => {
  const initial = humanFaceFixture("initial");
  const editor = createHumanFaceEditor({
    document: initial,
    model: "initial",
    build: async (input) => {
      const id = input.id;
      input.id = "builder-mutation";
      return id;
    },
  });
  initial.id = "caller-mutation";
  editor.snapshot().document.id = "snapshot-mutation";
  TestValidator.equals(
    "initial document owned",
    editor.snapshot().document.id,
    "initial",
  );
  TestValidator.equals("empty undo", await editor.undo(), false);
  TestValidator.equals("empty redo", await editor.redo(), false);
  TestValidator.equals(
    "first edit",
    await editor.edit(humanFaceFixture("second")),
    true,
  );
  TestValidator.equals(
    "committed candidate is isolated",
    editor.snapshot().document.id,
    "second",
  );
  TestValidator.equals("undo", await editor.undo(), true);
  TestValidator.equals(
    "undo restores model",
    editor.snapshot().model,
    "initial",
  );
  TestValidator.equals("redo available", editor.snapshot().canRedo, true);
  TestValidator.equals("redo", await editor.redo(), true);
  TestValidator.equals(
    "redo restores document",
    editor.snapshot().document.id,
    "second",
  );
  await editor.undo();
  await editor.edit(humanFaceFixture("third"));
  TestValidator.equals("new edit clears redo", await editor.redo(), false);
  TestValidator.equals("reset", await editor.reset(), true);
  TestValidator.equals(
    "reset returns initial model",
    editor.snapshot().model,
    "initial",
  );
  await editor.undo();
  TestValidator.equals("reset was undoable", editor.snapshot().model, "third");
};
