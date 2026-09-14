import { TestValidator } from "@nestia/e2e";

import { createHumanPreviewFixture } from "../internal/createHumanPreviewFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Worker cancellation and decoder completion share one publication generation.
 *
 * Scenarios:
 * 1. A newer request terminates the pending worker and rejects its promise.
 * 2. Late old replies cannot reach the decoder or clear the newer cancellation.
 * 3. Cancellation during decoding disposes that result instead of returning it.
 * 4. An uncancelled result remains caller-owned and later cancellation is safe.
 */
export const test_subject_human_preview_races = async (): Promise<void> => {
  let complete!: (model: string) => void;
  const f = createHumanPreviewFixture({
    decode: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  const face = humanFaceFixture("first");
  const first = f.builder.build(face).catch((error: unknown) => error);
  const second = f.builder.build(face).catch((error: unknown) => error);
  TestValidator.equals(
    "first worker terminated on supersession",
    f.workers[0].terminations,
    1,
  );
  TestValidator.predicate(
    "superseded promise rejects",
    (await first) instanceof Error,
  );
  f.workers[0].onReply(f.reply(1));
  TestValidator.equals("old reply is not decoded", f.decoded.length, 0);
  f.builder.cancel();
  TestValidator.predicate(
    "newer cancellation remains registered",
    (await second) instanceof Error,
  );
  const decoding = f.builder.build(face).catch((error: unknown) => error);
  f.workers[2].onReply(f.reply(3));
  await Promise.resolve();
  TestValidator.equals("actual decoder reached", f.decoded.length, 1);
  f.builder.cancel();
  complete("obsolete-preview");
  TestValidator.predicate(
    "obsolete decoder rejects",
    (await decoding) instanceof Error,
  );
  TestValidator.equals("obsolete model disposed", f.disposed, [
    "obsolete-preview",
  ]);
  const current = f.builder.build(face);
  f.workers[3].onReply(f.reply(4));
  await Promise.resolve();
  complete("current-preview");
  TestValidator.equals(
    "current model returned",
    await current,
    "current-preview",
  );
  TestValidator.equals(
    "current worker terminated",
    f.workers[3].terminations,
    1,
  );
  f.builder.cancel();
  TestValidator.equals("published model remains caller-owned", f.disposed, [
    "obsolete-preview",
  ]);
  TestValidator.equals(
    "admitted numerical request",
    JSON.parse(f.workers[3].sent[0]).id,
    "first",
  );
};
