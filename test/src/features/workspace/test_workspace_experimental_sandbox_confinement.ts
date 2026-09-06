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
 * Sandbox authority follows captured ordinary directories and file generations.
 *
 * Scenarios:
 * 1. Refresh captures an existing direct child and reads its ordinary manifest;
 *    missing creation roots are created only beneath the captured ancestor.
 * 2. A lexical sibling, each linked ancestor/root/target, and a physically
 *    redirected directory are refused before any publication.
 * 3. A missing refresh root, an unsafe manifest leaf, and non-ENOENT failures
 *    propagate without creating directories or writing bytes.
 * 4. Replacement of any approved directory or manifest, and appearance in an
 *    approved absent manifest slot, refuses subsequent mutation.
 * 5. Missing nested read parents return absence, while existing nested parents
 *    remain pinned and lexical read escapes are refused.
 */
export const test_workspace_experimental_sandbox_confinement = (): void => {
  const root = path.resolve("virtual", "checkout", "experimental");
  const target = path.join(root, "sample");
  const manifest = path.join(target, "package.json");
  const source = '{"dependencies":{}}\n';
  const normal = createExperimentalSandboxIO(target);
  normal.putFile(manifest, source);
  const session = openExperimentalSandbox(
    { create: false, root, target },
    normal.io,
  );
  TestValidator.equals(
    "manifest bytes read through approved snapshot",
    session.manifest,
    source,
  );
  TestValidator.equals("resident entries are retained", session.entries, [
    "package.json",
  ]);
  TestValidator.equals(
    "target stays the declared direct child",
    session.target,
    target,
  );
  session.assertCurrent();

  const creation = createExperimentalSandboxIO(target);
  creation.directories.delete(root);
  creation.directories.delete(target);
  const created = openExperimentalSandbox(
    { create: true, root, target },
    creation.io,
  );
  TestValidator.equals(
    "creation has no invented manifest",
    created.manifest,
    undefined,
  );
  TestValidator.equals(
    "creation only creates root and target",
    creation.events.filter((event) => event.startsWith("create-directory:")),
    [`create-directory:${root}`, `create-directory:${target}`],
  );

  TestValidator.predicate(
    "lexical sibling is refused",
    throwsError(
      () =>
        openExperimentalSandbox(
          {
            create: true,
            root,
            target: path.join(path.dirname(root), "outside"),
          },
          normal.io,
        ),
      ["direct child"],
    ),
  );
  for (const directory of [path.dirname(root), root, target]) {
    for (const kind of ["symlink", "junction"]) {
      const linked = createExperimentalSandboxIO(target);
      linked.failures.set(
        directory,
        new Error(`not one ordinary directory: ${kind}`),
      );
      TestValidator.predicate(
        `${kind} at ${directory} is refused`,
        throwsError(
          () =>
            openExperimentalSandbox({ create: true, root, target }, linked.io),
          ["ordinary directory", kind],
        ),
      );
      TestValidator.equals(
        "linked directories produce no write",
        linked.events.some((event) => event.startsWith("write:")),
        false,
      );
    }
  }
  const redirected = createExperimentalSandboxIO(target);
  redirected.directories.get(root)!.real = path.resolve("outside");
  TestValidator.predicate(
    "physical parent escape is refused",
    throwsError(
      () =>
        openExperimentalSandbox({ create: false, root, target }, redirected.io),
      ["outside its declared path"],
    ),
  );

  const absent = createExperimentalSandboxIO(target);
  absent.directories.delete(root);
  TestValidator.predicate(
    "refresh does not create a missing root",
    throwsError(
      () => openExperimentalSandbox({ create: false, root, target }, absent.io),
      ["missing"],
    ),
  );
  TestValidator.equals(
    "refresh has no directory mutation",
    absent.events.some((event) => event.startsWith("create-directory:")),
    false,
  );
  const volume = path.parse(root).root;
  const volumeChild = path.join(volume, "sample");
  const missingVolume = createExperimentalSandboxIO(volumeChild);
  missingVolume.directories.delete(volume);
  TestValidator.predicate(
    "creation cannot invent a missing filesystem root",
    throwsError(
      () =>
        openExperimentalSandbox(
          { create: true, root: volume, target: volumeChild },
          missingVolume.io,
        ),
      ["missing"],
    ),
  );

  for (const cause of [
    "symlink",
    "hardlink",
    "directory",
    "permission denied",
  ]) {
    const unsafe = createExperimentalSandboxIO(target);
    unsafe.failures.set(manifest, new Error(`manifest refused: ${cause}`));
    TestValidator.predicate(
      `${cause} manifest is refused`,
      throwsError(
        () =>
          openExperimentalSandbox({ create: true, root, target }, unsafe.io),
        [cause],
      ),
    );
    TestValidator.equals(
      "unsafe manifest is not written",
      unsafe.events.some((event) => event.startsWith("write:")),
      false,
    );
  }
  for (const directory of [path.dirname(root), root, target]) {
    const changed = createExperimentalSandboxIO(target);
    const approved = openExperimentalSandbox(
      { create: true, root, target },
      changed.io,
    );
    changed.putDirectory(directory);
    TestValidator.predicate(
      `directory replacement remains refused: ${directory}`,
      throwsError(approved.assertCurrent, ["directory changed"]),
    );
  }
  normal.putFile(manifest, source);
  TestValidator.predicate(
    "same-byte manifest successor is refused",
    throwsError(session.assertCurrent, ["file changed"]),
  );
  creation.putFile(manifest, source);
  TestValidator.predicate(
    "new competitor is not adopted",
    throwsError(created.assertCurrent, ["appeared after approval"]),
  );

  const nested = createExperimentalSandboxIO(target);
  const nestedSession = openExperimentalSandbox(
    { create: true, root, target },
    nested.io,
  );
  TestValidator.equals(
    "missing nested parent is absent",
    nestedSession.read("docs/baseline.json"),
    undefined,
  );
  nested.putDirectory(path.join(target, "docs"));
  nested.putFile(path.join(target, "docs", "baseline.json"), "baseline");
  TestValidator.equals(
    "existing nested file is read",
    nestedSession.read("docs/baseline.json"),
    "baseline",
  );
  TestValidator.equals(
    "same nested snapshot can be read again",
    nestedSession.read("docs/baseline.json"),
    "baseline",
  );
  TestValidator.predicate(
    "read escapes are refused",
    throwsError(() => nestedSession.read("../outside.json"), ["outside"]),
  );
  nested.putDirectory(path.join(target, "docs"));
  TestValidator.predicate(
    "nested parent replacement remains refused",
    throwsError(nestedSession.assertCurrent, ["directory changed"]),
  );
};
