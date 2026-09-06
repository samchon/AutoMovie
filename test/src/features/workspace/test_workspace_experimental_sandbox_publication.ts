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
 * Publication retains prepack file approval and the writer's completed identity.
 *
 * Scenarios:
 * 1. Creation publishes manifest and nested source files through exact absent
 *    slots, then refresh replaces the captured manifest and keeps authored files.
 * 2. A changed prepack manifest or unexpected new publication path is refused
 *    before writes; a writer refusal retains original bytes and its cause.
 * 3. A partial descriptor outcome remains partial and does not trigger cleanup.
 * 4. Missing completion identity, replacement, and changed bytes after write
 *    cannot authorize installation against the successor.
 */
export const test_workspace_experimental_sandbox_publication = (): void => {
  const root = path.resolve("virtual", "experimental");
  const target = path.join(root, "sample");
  const manifest = path.join(target, "package.json");
  const nested = path.join(target, "src", "authored.ts");
  const creation = createExperimentalSandboxIO(target);
  const created = openExperimentalSandbox(
    { create: true, root, target },
    creation.io,
  );
  created.prepare(["package.json", "src/authored.ts"]);
  created.publish({ "package.json": "first", "src/authored.ts": "authored" });
  created.assertCurrent();
  TestValidator.equals(
    "creation writes selected bytes",
    [
      creation.files.get(manifest)!.bytes.toString(),
      creation.files.get(nested)!.bytes.toString(),
    ],
    ["first", "authored"],
  );
  const refreshed = openExperimentalSandbox(
    { create: false, root, target },
    creation.io,
  );
  refreshed.prepare(["package.json"]);
  const identity = creation.files.get(manifest)!.snapshot.identity;
  refreshed.publish({ "package.json": "second" });
  refreshed.assertCurrent();
  TestValidator.equals(
    "refresh retains manifest identity",
    creation.files.get(manifest)!.snapshot.identity,
    identity,
  );
  TestValidator.equals(
    "refresh preserves authored source",
    creation.files.get(nested)!.bytes.toString(),
    "authored",
  );
  TestValidator.predicate(
    "unapproved publication is refused",
    throwsError(
      () => refreshed.publish({ "unapproved.txt": "unexpected" }),
      ["not approved before packing"],
    ),
  );

  const changed = createExperimentalSandboxIO(target);
  changed.putFile(manifest, "original");
  const stale = openExperimentalSandbox(
    { create: false, root, target },
    changed.io,
  );
  stale.prepare(["package.json"]);
  changed.putFile(manifest, "competitor");
  TestValidator.predicate(
    "replacement before publish is refused",
    throwsError(
      () => stale.publish({ "package.json": "replacement" }),
      ["file changed"],
    ),
  );
  TestValidator.equals(
    "competing bytes remain intact",
    changed.files.get(manifest)!.bytes.toString(),
    "competitor",
  );

  for (const status of ["refused", "partial"] as const) {
    const failed = createExperimentalSandboxIO(target);
    failed.putFile(manifest, "original");
    const approved = openExperimentalSandbox(
      { create: false, root, target },
      failed.io,
    );
    approved.prepare(["package.json"]);
    const error = new Error("descriptor refused publication");
    failed.hooks.outcome =
      status === "refused"
        ? { error, reason: "target-competitor", status }
        : {
            bytesWritten: 2,
            error,
            parentIdentity: failed.directories.get(target)!.identity,
            status,
          };
    let caught: unknown;
    try {
      approved.publish({ "package.json": "replacement" });
    } catch (error) {
      caught = error;
    }
    TestValidator.predicate(
      `${status} is observable`,
      caught instanceof Error && caught.message.includes(status),
    );
    TestValidator.predicate(
      "original cause is retained",
      caught instanceof Error && caught.cause === error,
    );
    TestValidator.equals(
      "failure causes no blind cleanup or retry",
      failed.events.filter((event) => event.startsWith("write:")).length,
      1,
    );
    TestValidator.equals(
      "refusing adapter preserved original bytes",
      failed.files.get(manifest)!.bytes.toString(),
      "original",
    );
  }

  for (const transition of [
    "missing-identity",
    "same-byte-successor",
    "changed-bytes",
  ] as const) {
    const staleResult = createExperimentalSandboxIO(target);
    const approved = openExperimentalSandbox(
      { create: true, root, target },
      staleResult.io,
    );
    approved.prepare(["package.json"]);
    const write = staleResult.io.writeFile;
    staleResult.io.writeFile = (request) => {
      const outcome = write(request);
      if (outcome.status !== "completed")
        throw new Error("expected completion");
      if (transition === "missing-identity")
        return { parentIdentity: outcome.parentIdentity, status: "completed" };
      staleResult.putFile(
        manifest,
        transition === "same-byte-successor" ? "created" : "changed",
        transition === "changed-bytes" ? outcome.fileIdentity : undefined,
      );
      return outcome;
    };
    TestValidator.predicate(
      `${transition} cannot advance authority`,
      throwsError(
        () => approved.publish({ "package.json": "created" }),
        ["changed before its receipt"],
      ),
    );
  }
};
