import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import {
  type IExperimentalSandboxTestIO,
  type IExperimentalSandboxTestSession,
  createExperimentalSandboxIO,
} from "../internal/createExperimentalSandboxIO";
import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

const { openExperimentalSandbox } = loadSourceModule<{
  openExperimentalSandbox: (
    props: { create: boolean; root: string; target: string },
    io: IExperimentalSandboxTestIO,
  ) => IExperimentalSandboxTestSession;
}>(path.resolve(__dirname, "../../../../build/experimentalSandbox.ts"));

/**
 * Races at injected protocol boundaries never advance sandbox authority.
 *
 * Scenarios:
 * 1. Non-ENOENT values remain errors, including non-Error thrown values and
 *    ENOTDIR; a newly unsafe absent manifest remains refused.
 * 2. A manifest replacement or appearance between the currentness check and
 *    descriptor read cannot replace the earlier present/absent approval.
 * 3. Failure after a nested publication retains the actual parent identity,
 *    full written extent, original cause and completed prefix.
 * 4. A descriptor refusal at write entry leaves the predecessor bytes intact,
 *    and empty preparation/publication produces no filesystem effects.
 */
export const test_workspace_experimental_sandbox_transitions = (): void => {
  const root = path.resolve("virtual", "experimental");
  const target = path.join(root, "sample");
  const manifest = path.join(target, "package.json");
  for (const reason of [
    null,
    "directory refused",
    {},
    { code: "ENOTDIR" },
    { code: "EACCES" },
  ]) {
    const memory = createExperimentalSandboxIO(target);
    memory.failures.set(target, reason);
    let caught: unknown = "not-thrown";
    try {
      openExperimentalSandbox({ create: true, root, target }, memory.io);
    } catch (error) {
      caught = error;
    }
    TestValidator.predicate("only ENOENT permits creation", caught === reason);
    TestValidator.equals(
      "unclassified failure creates nothing",
      memory.events.some((event) => event.startsWith("create-directory:")),
      false,
    );
  }
  const unsafe = createExperimentalSandboxIO(target);
  const absent = openExperimentalSandbox(
    { create: true, root, target },
    unsafe.io,
  );
  unsafe.failures.set(manifest, new Error("single-link file required"));
  TestValidator.predicate(
    "unsafe newly appeared manifest is refused",
    throwsError(absent.assertCurrent, ["single-link"]),
  );

  for (const present of [false, true]) {
    const memory = createExperimentalSandboxIO(target);
    if (present) memory.putFile(manifest, "original");
    const session = openExperimentalSandbox(
      { create: true, root, target },
      memory.io,
    );
    memory.hooks.before = (event) => {
      if (event === `read:${manifest}`) memory.putFile(manifest, "competitor");
    };
    TestValidator.predicate(
      "read cannot replace an earlier approval",
      throwsError(() => session.read("package.json"), ["changed while read"]),
    );
    TestValidator.equals(
      "read refuses without mutation",
      memory.events.some((event) => event.startsWith("write:")),
      false,
    );
  }

  const partial = createExperimentalSandboxIO(target);
  const session = openExperimentalSandbox(
    { create: true, root, target },
    partial.io,
  );
  session.prepare(["package.json", "src/main.ts"]);
  const nested = path.join(target, "src", "main.ts");
  const write = partial.io.writeFile;
  partial.io.writeFile = (request) => {
    const outcome = write(request);
    if (request.target === nested)
      partial.failures.set(nested, "postwrite read failed");
    return outcome;
  };
  let receipt:
    | {
        completed: readonly { entry: { relative: string } }[];
        failure: {
          outcome: {
            bytesWritten: number;
            error: unknown;
            parentIdentity: string;
            status: string;
          };
        };
        status: string;
      }
    | undefined;
  let cause: unknown;
  try {
    session.publish({ "package.json": "manifest", "src/main.ts": "source" });
  } catch (error) {
    cause = (error as Error).cause;
    receipt = (error as { receipt: typeof receipt }).receipt;
  }
  TestValidator.equals(
    "postwrite failure preserves completed prefix",
    receipt?.completed.map(({ entry }) => entry.relative),
    ["package.json"],
  );
  TestValidator.equals(
    "postwrite failure reports actual parent and extent",
    receipt?.failure.outcome,
    {
      bytesWritten: Buffer.byteLength("source"),
      error: "postwrite read failed",
      parentIdentity: partial.directories.get(path.dirname(nested))!.identity,
      status: "partial",
    },
  );
  TestValidator.equals(
    "non-Error postwrite cause is preserved",
    cause,
    "postwrite read failed",
  );

  const refused = createExperimentalSandboxIO(target);
  refused.putFile(manifest, "original");
  const approved = openExperimentalSandbox(
    { create: false, root, target },
    refused.io,
  );
  approved.prepare(["package.json"]);
  refused.hooks.before = (event) => {
    if (event === `write:${manifest}`) refused.putFile(manifest, "competitor");
  };
  TestValidator.predicate(
    "write-entry replacement is refused",
    throwsError(
      () => approved.publish({ "package.json": "replacement" }),
      ["file changed"],
    ),
  );
  TestValidator.equals(
    "write-entry refusal preserves resident bytes",
    refused.files.get(manifest)!.bytes.toString(),
    "competitor",
  );
  const empty = createExperimentalSandboxIO(target);
  const emptySession = openExperimentalSandbox(
    { create: true, root, target },
    empty.io,
  );
  emptySession.prepare([]);
  emptySession.publish({});
  TestValidator.equals(
    "empty publication writes nothing",
    empty.events.some((event) => event.startsWith("write:")),
    false,
  );
  const unforced = createExperimentalSandboxIO(target);
  const unforcedSession = openExperimentalSandbox(
    { create: true, root, target },
    unforced.io,
  );
  unforced.putFile(path.join(target, "authored.ts"), "competitor");
  TestValidator.predicate(
    "unforced creation cannot capture overwrite authority",
    throwsError(
      () => unforcedSession.prepare(["authored.ts"]),
      ["without overwrite authority"],
    ),
  );
  TestValidator.equals(
    "unforced refusal preserves competing bytes",
    unforced.files.get(path.join(target, "authored.ts"))!.bytes.toString(),
    "competitor",
  );
};
