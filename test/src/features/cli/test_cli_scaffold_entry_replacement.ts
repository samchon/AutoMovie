import {
  type IScaffoldParentPublicationCapability,
  type ScaffoldFilePublicationOutcome,
  captureScaffoldFile,
  captureScaffoldPhysicalDirectory,
  writeScaffoldFile,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { createScaffoldSnapshotFileSystem } from "../internal/createScaffoldSnapshotFileSystem";
import { throwsError } from "../internal/predicates";

/**
 * Replacing an existing scaffold file chooses its method from the directory
 * entries the target actually has, and the choice is what keeps a peer pathname
 * unchanged.
 *
 * Rewriting the resident inode is admissible only while one entry names it,
 * because that write is exactly what another pathname naming the same inode
 * would observe. When a second entry exists and the caller holds the
 * aliased-entry authority, the target's own entry is detached and the successor
 * is created exclusively at the same name, so the peer keeps the bytes and the
 * identity it already had. Without that authority the second entry is refused
 * as before, which is what keeps an in-place caller's stricter contract.
 *
 * Detaching the name is an effect. Once it happens, a publication that then
 * refuses cannot be reported as absence, because the predecessor is already
 * gone; it is a partial result whose recovery is an explicit decision.
 *
 * Scenarios:
 *
 * 1. One entry, authority granted: the in-place branch is chosen anyway and the
 *    resident inode is truncated, so the authority alone does not change method.
 * 2. Two entries, authority granted: the entry is replaced, no truncation is
 *    attempted, the peer still reads the original bytes under the original
 *    identity, and the name resolves to the successor. This is the case the
 *    single-entry requirement refused.
 * 3. Two entries whose change time moves when this operation opens the pathname,
 *    as a Windows host does for any handle: the replacement still completes and
 *    the peer keeps its bytes, so the operation's own open cannot refuse it.
 * 4. Two entries, authority withheld: refused with the ordinary single-link
 *    diagnostic, nothing is unlinked or truncated, and the bytes are untouched.
 * 5. A predecessor whose generation moved after capture is refused before the
 *    name is detached, so an unverified authority never removes an entry.
 * 6. A publication that refuses after the entry is detached is reported as
 *    partial rather than refused, for both a competitor and a create failure,
 *    and the absence is not hidden.
 */
export const test_cli_scaffold_entry_replacement = (): void => {
  const completing = (
    memory: ReturnType<typeof createScaffoldSnapshotFileSystem>,
    parentIdentity: string,
  ): IScaffoldParentPublicationCapability => ({
    publish: (request) => {
      memory.createEntry(Buffer.from(request.bytes));
      return Object.freeze({
        fileIdentity: `1:${memory.state.identity}`,
        parentIdentity,
        status: "completed" as const,
      });
    },
  });

  const single = createScaffoldSnapshotFileSystem();
  single.run(() => {
    const base = captureScaffoldPhysicalDirectory(single.root);
    const written = writeScaffoldFile({
      base,
      bytes: Buffer.from("new"),
      capability: completing(single, base.identity),
      expected: captureScaffoldFile(single.file),
      force: true,
      parent: base,
      replaceAliasedEntries: true,
      target: single.file,
    });
    TestValidator.equals(
      "one entry keeps the in-place method",
      written.status,
      "completed",
    );
    TestValidator.equals(
      "the resident inode was truncated",
      single.events.includes("truncate"),
      true,
    );
    TestValidator.equals(
      "the entry was never detached",
      single.events.includes("unlink"),
      false,
    );
  });

  const aliased = createScaffoldSnapshotFileSystem();
  aliased.state.links = 2n;
  aliased.run(() => {
    const base = captureScaffoldPhysicalDirectory(aliased.root);
    const written = writeScaffoldFile({
      base,
      bytes: Buffer.from("new"),
      capability: completing(aliased, base.identity),
      expected: captureScaffoldFile(aliased.file),
      force: true,
      parent: base,
      replaceAliasedEntries: true,
      target: aliased.file,
    });
    TestValidator.equals(
      "a second entry takes the replacement method",
      written.status,
      "completed",
    );
    TestValidator.equals(
      "no truncation was attempted",
      aliased.events.includes("truncate"),
      false,
    );
    TestValidator.equals(
      "the entry was detached before the successor was created",
      aliased.events.filter(
        (event) => event === "unlink" || event === "create",
      ),
      ["unlink", "create"],
    );
    TestValidator.equals(
      "the peer still reads the original bytes",
      aliased.state.peerBytes?.toString(),
      "old",
    );
    TestValidator.equals(
      "the name resolves to the successor bytes",
      aliased.state.bytes.toString(),
      "new",
    );
    TestValidator.predicate(
      "the successor is a different inode from the peer",
      aliased.state.peerIdentity !== aliased.state.identity,
    );
  });

  const ownOpen = createScaffoldSnapshotFileSystem();
  ownOpen.state.links = 2n;
  ownOpen.state.advanceChangeTimeOnOpen = true;
  ownOpen.run(() => {
    const base = captureScaffoldPhysicalDirectory(ownOpen.root);
    const written = writeScaffoldFile({
      base,
      bytes: Buffer.from("new"),
      capability: completing(ownOpen, base.identity),
      expected: captureScaffoldFile(ownOpen.file),
      force: true,
      parent: base,
      replaceAliasedEntries: true,
      target: ownOpen.file,
    });
    TestValidator.equals(
      "this operation's own open does not refuse the replacement",
      written.status,
      "completed",
    );
    TestValidator.equals(
      "the peer bytes survive that replacement too",
      ownOpen.state.peerBytes?.toString(),
      "old",
    );
  });

  const withheld = createScaffoldSnapshotFileSystem();
  withheld.state.links = 2n;
  withheld.run(() => {
    const base = captureScaffoldPhysicalDirectory(withheld.root);
    const refused = writeScaffoldFile({
      base,
      bytes: Buffer.from("new"),
      capability: completing(withheld, base.identity),
      expected: captureScaffoldFile(withheld.file),
      force: true,
      parent: base,
      target: withheld.file,
    });
    TestValidator.equals(
      "a second entry without the authority is refused",
      refused.status,
      "refused",
    );
    TestValidator.predicate(
      "the refusal names the single-link requirement",
      refused.status === "refused" &&
        refused.error instanceof Error &&
        refused.error.message.includes("one ordinary single-link file"),
    );
    TestValidator.equals(
      "nothing was detached or truncated",
      withheld.events.some(
        (event) => event === "unlink" || event === "truncate",
      ),
      false,
    );
    TestValidator.equals(
      "the resident bytes are untouched",
      withheld.state.bytes.toString(),
      "old",
    );
  });

  const moved = createScaffoldSnapshotFileSystem();
  moved.state.links = 2n;
  moved.run(() => {
    const base = captureScaffoldPhysicalDirectory(moved.root);
    const expected = captureScaffoldFile(moved.file);
    moved.state.identity++;
    TestValidator.predicate(
      "a moved predecessor generation is refused",
      throwsError(
        () =>
          writeScaffoldFile({
            base,
            bytes: Buffer.from("new"),
            capability: completing(moved, base.identity),
            expected,
            force: true,
            parent: base,
            replaceAliasedEntries: true,
            target: moved.file,
          }),
        ["scaffold file changed after descriptor close"],
      ),
    );
    TestValidator.equals(
      "the entry survives an unverified authority",
      moved.events.includes("unlink"),
      false,
    );
    TestValidator.equals(
      "the competitor bytes remain",
      moved.state.bytes.toString(),
      "old",
    );
  });

  for (const reason of ["target-competitor", "create-failed"] as const) {
    const failing = createScaffoldSnapshotFileSystem();
    failing.state.links = 2n;
    failing.run(() => {
      const base = captureScaffoldPhysicalDirectory(failing.root);
      const outcome: ScaffoldFilePublicationOutcome = writeScaffoldFile({
        base,
        bytes: Buffer.from("new"),
        capability: {
          publish: () =>
            Object.freeze({
              error: new Error(reason),
              reason,
              status: "refused" as const,
            }),
        },
        expected: captureScaffoldFile(failing.file),
        force: true,
        parent: base,
        replaceAliasedEntries: true,
        target: failing.file,
      });
      TestValidator.equals(
        "a refusal after detachment is a partial result",
        outcome.status,
        "partial",
      );
      TestValidator.equals(
        "the detachment is not hidden",
        failing.state.present,
        false,
      );
      TestValidator.equals(
        "the peer keeps the bytes the name no longer has",
        failing.state.peerBytes?.toString(),
        "old",
      );
    });
  }
};
