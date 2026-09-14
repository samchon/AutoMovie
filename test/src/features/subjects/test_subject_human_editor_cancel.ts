import { createHumanFaceEditor } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Cancellation withdraws publication authority without changing the committed
 * face or its history, even when the builder cannot stop its underlying work.
 *
 * Scenarios:
 * 1. Cancel at rest, then commit and undo an edit to establish redo history.
 * 2. Cancel a pending edit and resolve its builder; the pair and history survive.
 * 3. Cancel a pending failure; its late rejection cannot publish an error.
 * 4. Clear a current failure and redo the previously committed face normally.
 */
export const test_subject_human_editor_cancel = async (): Promise<void> => {
  const pending: {
    resolve: (value: string) => void;
    reject: (reason: unknown) => void;
  }[] = [];
  const editor = createHumanFaceEditor({
    document: humanFaceFixture("initial"),
    model: "initial",
    build: () =>
      new Promise<string>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  });
  const initial = editor.snapshot();
  editor.cancel();
  TestValidator.equals(
    "idle cancellation is identity",
    editor.snapshot(),
    initial,
  );
  const edit = editor.edit(humanFaceFixture("second"));
  pending[0].resolve("second");
  await edit;
  const undo = editor.undo();
  pending[1].resolve("initial");
  await undo;
  const committed = editor.snapshot();
  TestValidator.equals("redo arranged", committed.canRedo, true);
  const abandoned = editor.edit(humanFaceFixture("abandoned"));
  editor.cancel();
  TestValidator.equals(
    "cancellation restores committed state",
    editor.snapshot(),
    committed,
  );
  pending[2].resolve("obsolete");
  TestValidator.equals("late success refused", await abandoned, false);
  TestValidator.equals(
    "late success cannot consume history",
    editor.snapshot(),
    committed,
  );
  const abandonedFailure = editor.edit(humanFaceFixture("abandoned-failure"));
  editor.cancel();
  pending[3].reject(new Error("obsolete failure"));
  TestValidator.equals("late failure refused", await abandonedFailure, false);
  TestValidator.equals(
    "late failure cannot change state",
    editor.snapshot(),
    committed,
  );
  const failure = editor.edit(humanFaceFixture("current-failure"));
  pending[4].reject(new Error("current failure"));
  await failure;
  TestValidator.equals(
    "current failure arranged",
    editor.snapshot().error,
    "current failure",
  );
  editor.cancel();
  TestValidator.equals(
    "failure cleared without editing",
    editor.snapshot(),
    committed,
  );
  const redo = editor.redo();
  pending[5].resolve("second");
  TestValidator.equals("history remains traversable", await redo, true);
  TestValidator.equals(
    "prior committed face restored",
    editor.snapshot().model,
    "second",
  );
};
