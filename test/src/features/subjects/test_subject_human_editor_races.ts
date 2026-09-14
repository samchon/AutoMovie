import { createHumanFaceEditor } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Late success and failure have no publication authority over the latest edit.
 *
 * Scenarios:
 * 1. A later request resolves first; the earlier success cannot replace its document or model.
 * 2. A stale rejection leaves a newer pending request and its status untouched.
 * 3. Current Error and non-Error rejections preserve the last valid model and history.
 * 4. A failed history traversal does not consume its undo entry and can be retried.
 */
export const test_subject_human_editor_races = async (): Promise<void> => {
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
  const first = editor.edit(humanFaceFixture("old"));
  const latest = editor.edit(humanFaceFixture("new"));
  TestValidator.equals(
    "old face retained while building",
    editor.snapshot().model,
    "initial",
  );
  pending[1].resolve("new-model");
  TestValidator.equals("latest commits", await latest, true);
  pending[0].resolve("old-model");
  TestValidator.equals("stale success refused", await first, false);
  TestValidator.equals(
    "latest model retained",
    editor.snapshot().model,
    "new-model",
  );
  const staleFailure = editor.edit(humanFaceFixture("failure"));
  const next = editor.edit(humanFaceFixture("next"));
  pending[2].reject(new Error("obsolete"));
  TestValidator.equals("stale failure ignored", await staleFailure, false);
  TestValidator.equals(
    "new request remains pending",
    editor.snapshot().status,
    "building",
  );
  pending[3].reject(new Error("invalid section"));
  TestValidator.equals("current failure", await next, false);
  TestValidator.equals(
    "current error visible",
    editor.snapshot().error,
    "invalid section",
  );
  TestValidator.equals(
    "last valid document intact",
    editor.snapshot().document.id,
    "new",
  );
  const failedUndo = editor.undo();
  pending[4].reject("unavailable");
  await failedUndo;
  TestValidator.equals(
    "non-Error failure",
    editor.snapshot().error,
    "unavailable",
  );
  TestValidator.equals(
    "failed undo not consumed",
    editor.snapshot().canUndo,
    true,
  );
  const retry = editor.undo();
  pending[5].resolve("initial-restored");
  await retry;
  TestValidator.equals(
    "retry restores original",
    editor.snapshot().document.id,
    "initial",
  );
  TestValidator.equals("recovery clears error", editor.snapshot().error, null);
};
