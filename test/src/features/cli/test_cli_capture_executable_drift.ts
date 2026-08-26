import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import ts from "typescript-compiler";

import {
  moveDirectoryStamps,
  moveFileStamps,
} from "../internal/moveFileStamps";
import { namedFacts, throwsError } from "../internal/predicates";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

/** Repository root, four levels above `test/src/features/cli`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

interface ICaptureExecutableSnapshot {
  descriptor: number;
  descriptorVersion: string;
  digest: `sha256:${string}`;
  directory: { identity: string; path: string; real: string; version: string };
  identity: string;
  maximumBytes: number | null;
  path: string;
  physicalIdentity: string;
}

interface ICaptureExecutableSnapshotModule {
  assertCaptureExecutable: (expected: ICaptureExecutableSnapshot) => void;
  assertCaptureExecutableBytes: (expected: ICaptureExecutableSnapshot) => void;
  assertCaptureExecutableDescriptor: (
    expected: ICaptureExecutableSnapshot,
  ) => void;
  closeCaptureExecutable: (expected: ICaptureExecutableSnapshot) => void;
  openCaptureExecutable: (
    file: string,
    maximumBytes?: number | null,
  ) => ICaptureExecutableSnapshot;
}

const REINSTALL = "Run npm run capture:install, then npm run capture:doctor.";
const RERUN = "without npm run capture:install";
const INTACT = "byte-for-byte the file this project captured";
const CHANGED = "changed open descriptor bytes";

/**
 * The capture executable guards classify drift by rehashing, never by stamps.
 *
 * A freshly installed browser is what a Windows virus scanner or search indexer
 * touches, and such a touch moves `mtimeNs` or `ctimeNs` while leaving the bytes
 * identical; an in-place rewrite moves exactly the same fields, which is why the
 * stamps cannot decide and the digest must. Both outcomes still refuse, so
 * nothing is accepted silently. What this pins is which instruction each refusal
 * carries, because `capture:install` costs minutes and answers nothing when the
 * installed bytes are provably the captured ones.
 *
 * Every crafted case here is a copy of one real snapshot with one field moved,
 * so the guard under test still holds a live descriptor on a real file.
 *
 * Scenarios:
 *
 * 1. An untouched snapshot passes every guard.
 * 2. A pathname occupied by another file, and a pathname that is no longer a
 *    file at all, both refuse with the reinstall instruction.
 * 3. A descriptor whose captured inode no longer matches refuses as changed
 *    bytes without consulting the digest.
 * 4. A moved version whose rehash disagrees refuses as changed bytes, and so
 *    does a rehash that cannot complete because the file now overruns the
 *    captured maximum.
 * 5. A pathname whose stamps moved while it still names the captured inode is
 *    the same ambient touch, so it earns the rerun instruction.
 * 6. Creating a sibling file moves the containing directory's stamps without
 *    replacing the directory, which earns the rerun instruction too.
 * 7. Toggling the file's mode moves its stamps without moving its bytes; the
 *    descriptor guard and the byte guard both refuse by naming a rerun of
 *    `capture:doctor`, and neither names a reinstall.
 * 8. An in-place rewrite of the same length moves the same stamps and reaches
 *    the opposite instruction: these bytes changed, so reinstall.
 */
export const test_cli_capture_executable_drift = (): void => {
  // The guards refuse a symlinked ancestry outright, and a temporary directory
  // is symlinked on some platforms, so the fixture works from the real path.
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automovie-capture-drift-")),
  );
  // The shipped module is type-erased into the fixture and required from there.
  // Requiring the `.ts` directly costs the suite a minute of compiler startup,
  // and the module imports nothing but node builtins, so nothing is lost.
  const runtime = path.join(root, "runtime");
  fs.mkdirSync(runtime);
  const compiled = path.join(runtime, "captureExecutableSnapshot.cjs");
  fs.writeFileSync(
    compiled,
    ts.transpileModule(
      fs.readFileSync(
        path.join(
          ROOT,
          "packages",
          "template",
          "scaffold",
          "scripts",
          "captureExecutableSnapshot.ts",
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
  );
  const module = createRequire(__filename)(
    compiled,
  ) as ICaptureExecutableSnapshotModule;
  const file = path.join(root, "chrome.exe");
  fs.writeFileSync(file, Buffer.alloc(4096, 7));
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested);
  const sibling = path.join(nested, "sibling.exe");
  fs.writeFileSync(sibling, Buffer.alloc(4096, 3));

  let opened: ICaptureExecutableSnapshot | null = null;
  let failure: { error: unknown } | undefined;
  try {
    const snapshot = module.openCaptureExecutable(file);
    opened = snapshot;

    const untouched = throwsError(() =>
      module.assertCaptureExecutable(snapshot),
    );
    const occupied = throwsError(
      () => module.assertCaptureExecutable({ ...snapshot, path: sibling }),
      ["Another file now occupies that path", REINSTALL],
    );
    const replaced = throwsError(
      () => module.assertCaptureExecutable({ ...snapshot, path: nested }),
      ["with a link or a non-file", REINSTALL],
    );
    const wrongInode = throwsError(
      () =>
        module.assertCaptureExecutableDescriptor({
          ...snapshot,
          physicalIdentity: "0",
        }),
      [CHANGED, REINSTALL],
    );
    const wrongDigest = throwsError(
      () =>
        module.assertCaptureExecutableDescriptor({
          ...snapshot,
          descriptorVersion: "moved",
          digest: `sha256:${"0".repeat(64)}`,
        }),
      [CHANGED, REINSTALL],
    );
    const unhashable = throwsError(
      () =>
        module.assertCaptureExecutableDescriptor({
          ...snapshot,
          descriptorVersion: "moved",
          maximumBytes: 8,
        }),
      [CHANGED, REINSTALL],
    );
    const movedPathname = throwsError(
      () => module.assertCaptureExecutable({ ...snapshot, identity: "moved" }),
      ["pathname", INTACT, RERUN],
    );

    // Creating the sibling through `moveDirectoryStamps` rather than with one
    // write, for the same reason the mode toggle below goes through a helper: a
    // directory entry added inside the captured tick leaves the directory
    // version unchanged, and the guard then has nothing to refuse.
    moveDirectoryStamps(root, path.join(root, "quarantine.tmp"));
    const directoryDrift = throwsError(
      () => module.assertCaptureExecutable(snapshot),
      ["capture executable directory", RERUN],
    );

    // Mode toggling is the platform's own metadata write: it moves stamps that
    // the guard folds into its version and never touches a byte. It is issued
    // through `moveFileStamps` rather than inline, because one toggle lands
    // inside the captured tick often enough to make any fixture that assumes it
    // landed intermittent; this one only happened to sit far enough from its
    // own snapshot to get away with it.
    const before = fs.fstatSync(snapshot.descriptor, { bigint: true });
    moveFileStamps(file, snapshot.descriptor);
    const after = fs.fstatSync(snapshot.descriptor, { bigint: true });
    const metadataDescriptor = throwsError(
      () => module.assertCaptureExecutableDescriptor(snapshot),
      ["descriptor", INTACT, RERUN],
    );
    const metadataReinstall = throwsError(
      () => module.assertCaptureExecutableDescriptor(snapshot),
      REINSTALL,
    );
    const metadataBytes = throwsError(
      () => module.assertCaptureExecutableBytes(snapshot),
      [INTACT, RERUN],
    );

    const rewritten = ((): number => {
      const writer = fs.openSync(file, "r+");
      try {
        return fs.writeSync(writer, Buffer.alloc(4096, 9), 0, 4096, 0);
      } finally {
        fs.closeSync(writer);
      }
    })();
    const rewrittenDescriptor = throwsError(
      () => module.assertCaptureExecutableDescriptor(snapshot),
      [CHANGED, REINSTALL],
    );
    const rewrittenBytes = throwsError(
      () => module.assertCaptureExecutableBytes(snapshot),
      [CHANGED, REINSTALL],
    );

    TestValidator.equals(
      "capture executable drift refuses with the instruction its own bytes justify",
      namedFacts([
        ["untouchedSnapshotPasses", () => untouched === false],
        ["occupiedPathnameReinstalls", () => occupied],
        ["replacedPathnameReinstalls", () => replaced],
        ["changedInodeReinstalls", () => wrongInode],
        ["changedDigestReinstalls", () => wrongDigest],
        ["unhashableBytesReinstall", () => unhashable],
        ["movedPathnameRerunsTheDoctor", () => movedPathname],
        ["directoryDriftRerunsTheDoctor", () => directoryDrift],
        [
          "metadataTouchMovedStampsOnly",
          () =>
            (after.mtimeNs !== before.mtimeNs ||
              after.ctimeNs !== before.ctimeNs) &&
            after.ino === before.ino &&
            after.size === before.size,
        ],
        ["metadataTouchRerunsTheDoctor", () => metadataDescriptor],
        ["metadataTouchWithholdsReinstall", () => metadataReinstall === false],
        ["metadataTouchByteGuardAgrees", () => metadataBytes],
        ["rewriteKeptTheSameLength", () => rewritten === 4096],
        ["rewrittenDescriptorReinstalls", () => rewrittenDescriptor],
        ["rewrittenByteGuardReinstalls", () => rewrittenBytes],
      ]),
      {
        untouchedSnapshotPasses: true,
        occupiedPathnameReinstalls: true,
        replacedPathnameReinstalls: true,
        changedInodeReinstalls: true,
        changedDigestReinstalls: true,
        unhashableBytesReinstall: true,
        movedPathnameRerunsTheDoctor: true,
        directoryDriftRerunsTheDoctor: true,
        metadataTouchMovedStampsOnly: true,
        metadataTouchRerunsTheDoctor: true,
        metadataTouchWithholdsReinstall: true,
        metadataTouchByteGuardAgrees: true,
        rewriteKeptTheSameLength: true,
        rewrittenDescriptorReinstalls: true,
        rewrittenByteGuardReinstalls: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    const snapshot = opened;
    preserveCliRootFixtureCleanup(
      failure,
      () => {
        if (snapshot !== null) module.closeCaptureExecutable(snapshot);
        fs.rmSync(root, { recursive: true, force: true });
      },
      "capture executable drift fixture",
    );
  }
};
