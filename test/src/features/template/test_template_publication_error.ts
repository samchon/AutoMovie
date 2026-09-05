import {
  type IScaffoldPublicationReceipt,
  ScaffoldPublicationError,
  writeFiles,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * The compatibility write API throws the same receipt the non-throwing API
 * returns, so a caller that only catches still learns the exact effect.
 *
 * Scenarios:
 *
 * 1. A completed write lists every published target in code-unit order.
 * 2. A populated root refuses the second write through a
 *    `ScaffoldPublicationError` whose receipt and message name the stopping
 *    entry and reason, carry no completed prefix, and leave no resident.
 * 3. A hand-built partial receipt renders its completed prefix, bound parent
 *    identity, and written extent with the stopping error as cause; a receipt
 *    without a stopping entry renders the fallback message.
 */
export const test_template_publication_error = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-publication-error-"),
  );
  try {
    const written = writeFiles(root, {
      "b/second.txt": "2",
      "a.txt": "1",
      "c.txt": "3",
    });
    TestValidator.equals("completed targets are sorted by code unit", written, [
      path.join(root, "a.txt"),
      path.join(root, "b", "second.txt"),
      path.join(root, "c.txt"),
    ]);

    let thrown: unknown;
    try {
      writeFiles(root, { "d.txt": "4" });
    } catch (error) {
      thrown = error;
    }
    const refusal = thrown instanceof ScaffoldPublicationError ? thrown : null;
    const failure = refusal?.receipt.failure ?? null;
    TestValidator.equals(
      "a populated root refuses through the receipt-bearing error",
      {
        name: refusal?.name,
        status: refusal?.receipt.status,
        completed: refusal?.receipt.completed.length,
        relative: failure?.entry.relative,
        reason:
          failure?.outcome.status === "refused" ? failure.outcome.reason : null,
        message:
          refusal !== null &&
          refusal.message.startsWith("scaffold publication refused: ") &&
          refusal.message.includes('"reason":"create-failed"') &&
          refusal.message.includes('"relative":"d.txt"') &&
          refusal.message.includes('"status":"refused"'),
        resident: fs.existsSync(path.join(root, "d.txt")),
      },
      {
        name: "ScaffoldPublicationError",
        status: "refused",
        completed: 0,
        relative: "d.txt",
        reason: "create-failed",
        message: true,
        resident: false,
      },
    );

    const entry = (relative: string) => ({
      bytes: [1],
      relative,
      target: path.join(root, relative),
    });
    const partial: IScaffoldPublicationReceipt = {
      completed: [{ entry: entry("done.txt"), parentIdentity: "1:2" }],
      failure: {
        entry: entry("half.txt"),
        outcome: {
          bytesWritten: 1,
          error: new Error("disk"),
          parentIdentity: "1:2",
          status: "partial",
        },
      },
      planned: [entry("done.txt"), entry("half.txt")],
      status: "partial",
    };
    const partialError = new ScaffoldPublicationError(partial);
    const empty = new ScaffoldPublicationError({
      completed: [],
      failure: null,
      planned: [],
      status: "refused",
    });
    TestValidator.equals(
      "partial and stopping-entry-free receipts render their exact effect",
      {
        partial: JSON.parse(
          partialError.message.slice("scaffold publication partial: ".length),
        ) as unknown,
        cause:
          partialError.cause instanceof Error
            ? partialError.cause.message
            : null,
        receipt: partialError.receipt === partial,
        empty: empty.message,
        emptyCause: empty.cause,
      },
      {
        partial: {
          completed: [{ parentIdentity: "1:2", relative: "done.txt" }],
          failure: {
            bytesWritten: 1,
            parentIdentity: "1:2",
            relative: "half.txt",
            status: "partial",
          },
        },
        cause: "disk",
        receipt: true,
        empty: "scaffold publication failed without a stopping entry",
        emptyCause: undefined,
      },
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
