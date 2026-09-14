import { TestValidator } from "@nestia/e2e";

import { createHumanPreviewFixture } from "../internal/createHumanPreviewFixture";
import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Admission, allocation, worker and decoder failures do not leave active work.
 *
 * Scenarios:
 * 1. Invalid documents refuse before worker allocation; factory and send errors reject.
 * 2. Worker error events and negative replies preserve their diagnostic and terminate.
 * 3. A decode rejection releases its completed worker; a later request can succeed.
 */
export const test_subject_human_preview_failures = async (): Promise<void> => {
  const face = humanFaceFixture("first");
  const f = createHumanPreviewFixture();
  const invalid = structuredClone(face);
  invalid.id = "";
  const rejected = await f.builder
    .build(invalid)
    .catch((error: unknown) => error);
  TestValidator.predicate(
    "invalid document rejects",
    rejected instanceof Error,
  );
  TestValidator.equals("admission before allocation", f.workers.length, 0);
  for (const option of ["workerError", "sendError"] as const) {
    const setup = createHumanPreviewFixture({ [option]: new Error(option) });
    const failure = await setup.builder
      .build(face)
      .catch((error: unknown) => error);
    TestValidator.predicate(
      `${option} diagnostic`,
      failure instanceof Error && failure.message === option,
    );
    TestValidator.equals(
      `${option} allocation`,
      setup.workers.length,
      option === "workerError" ? 0 : 1,
    );
    if (option === "sendError")
      TestValidator.equals(
        "send failure terminates",
        setup.workers[0].terminations,
        1,
      );
  }
  const eventFailure = f.builder.build(face).catch((error: unknown) => error);
  f.workers[0].onError("worker crashed");
  const eventResult = await eventFailure;
  TestValidator.predicate(
    "worker error diagnostic",
    eventResult instanceof Error && eventResult.message === "worker crashed",
  );
  TestValidator.equals("crashed worker released", f.workers[0].terminations, 1);
  const empty = createHumanPreviewFixture();
  const emptyFailure = empty.builder
    .build(face)
    .catch((error: unknown) => error);
  empty.workers[0].onError("");
  const emptyResult = await emptyFailure;
  TestValidator.predicate(
    "empty worker diagnostic remains visible",
    emptyResult instanceof Error &&
      emptyResult.message ===
        "The face worker failed before returning a result.",
  );
  const replyFailure = f.builder.build(face).catch((error: unknown) => error);
  f.workers[1].onReply({ success: false, error: "invalid geometry" });
  const replyResult = await replyFailure;
  TestValidator.predicate(
    "negative reply diagnostic",
    replyResult instanceof Error && replyResult.message === "invalid geometry",
  );
  TestValidator.equals("refused worker released", f.workers[1].terminations, 1);
  const decoder = createHumanPreviewFixture({
    decode: async () => {
      throw new Error("decode failed");
    },
  });
  const decodeFailure = decoder.builder
    .build(face)
    .catch((error: unknown) => error);
  decoder.workers[0].onReply(decoder.reply(1));
  const decodeResult = await decodeFailure;
  TestValidator.predicate(
    "decode diagnostic",
    decodeResult instanceof Error && decodeResult.message === "decode failed",
  );
  TestValidator.equals(
    "decode worker already released",
    decoder.workers[0].terminations,
    1,
  );
  const recovered = f.builder.build(face);
  f.workers[2].onReply(f.reply(9));
  TestValidator.equals("next request recovers", await recovered, "preview-9");
};
