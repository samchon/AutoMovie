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
 * Repeated reads preserve the generation admitted before their own open.
 *
 * Scenarios:
 * 1. Own-read ctime drift permits repeated reads and retains the latest token.
 * 2. Identity, size or mtime changes during that read still refuse.
 * 3. A ctime-only change before a later operation fails full pre-admission.
 */
export const test_workspace_experimental_sandbox_read_generation = (): void => {
  const root = path.resolve("virtual", "experimental");
  const target = path.join(root, "sample");
  const manifest = path.join(target, "package.json");
  for (const mutation of [
    "none",
    "identity",
    "size",
    "mtime",
    "before",
  ] as const) {
    const memory = createExperimentalSandboxIO(target);
    memory.putFile(manifest, "original");
    const file = memory.files.get(manifest)!;
    file.snapshot.version = "1:2:8:4:5";
    const session = openExperimentalSandbox(
      { create: false, root, target },
      memory.io,
    );
    let reads = 0;
    memory.hooks.before = (event) => {
      if (event !== `read:${manifest}`) return;
      ++reads;
      if (mutation === "identity") file.snapshot.identity = "competitor";
      file.snapshot.version = `1:2:${mutation === "size" ? 9 : 8}:${mutation === "mtime" ? 6 : 4}:${5 + reads}`;
    };
    if (mutation === "before") file.snapshot.version = "1:2:8:4:99";
    if (mutation === "none") {
      TestValidator.equals(
        "first own-open drift",
        session.read("package.json"),
        "original",
      );
      TestValidator.equals(
        "second own-open drift",
        session.read("package.json"),
        "original",
      );
      session.assertCurrent();
      file.snapshot.version = "1:2:8:4:99";
      TestValidator.equals(
        "new full token retained",
        throwsError(session.assertCurrent),
        true,
      );
    } else {
      TestValidator.equals(
        `changed ${mutation} refuses`,
        throwsError(() => session.read("package.json")),
        true,
      );
      if (mutation === "before")
        TestValidator.equals("pre-admission precedes read", reads, 0);
    }
  }
};
