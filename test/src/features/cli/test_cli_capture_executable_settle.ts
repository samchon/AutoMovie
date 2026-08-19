import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import ts from "typescript-compiler";

import { moveFileStamps } from "../internal/moveFileStamps";
import { namedFactsAsync, rejectsError } from "../internal/predicates";

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

interface ISettledCaptureExecutable<T> {
  attempts: number;
  value: T;
  waitedMs: number;
}

interface ICaptureExecutableSettleModule {
  CaptureExecutableInstructedError: new (message: string) => Error;
  CaptureExecutableTouchedError: new (
    message: string,
    observation: string,
  ) => Error;
  assertCaptureExecutableDescriptor: (
    expected: ICaptureExecutableSnapshot,
  ) => void;
  closeCaptureExecutable: (expected: ICaptureExecutableSnapshot) => void;
  openCaptureExecutable: (
    file: string,
    maximumBytes?: number | null,
  ) => ICaptureExecutableSnapshot;
  settleCaptureExecutableTouch: <T>(props: {
    acquire: () => Promise<T>;
    attempts: number;
    waitMs: number;
    wait?: (milliseconds: number) => Promise<void>;
  }) => Promise<ISettledCaptureExecutable<T>>;
}

const RERUN = "without npm run capture:install";
const PERSISTENT = "Exclude this directory from your antivirus";
const CHANGED = "changed open descriptor bytes";

/**
 * `capture:doctor` finishes diagnosing instead of asking to be run again.
 *
 * The doctor is one command after `capture:install`, which is exactly when a
 * Windows virus scanner or search indexer is most likely to be reading a
 * browser that finished extracting seconds ago. That touch moves the file's
 * stamps without moving its bytes, and the capture guards refuse it — correctly,
 * because a launch boundary may not proceed on an unverified executable. A
 * campaign driver met that refusal on a fresh install, ran the same command a
 * few seconds later, and got `status: ready` from an untouched file.
 *
 * A diagnostic whose answer is "run me again" has not answered, so the doctor
 * now waits the activity out within a bound. What this pins is that waiting
 * never softens a verdict: only the class constructed *after* the captured
 * bytes were rehashed and matched is waited on, changed bytes are rethrown on
 * sight, and exhausting the bound produces a different finding with a different
 * remedy rather than the transient message repeated.
 *
 * Every touched refusal here is driven out of a real file whose stamps really
 * moved, so the guard under test still holds a live descriptor and the test
 * fails if the classification stops happening.
 *
 * Scenarios:
 *
 * 1. An acquisition that succeeds outright spends one attempt and no waiting,
 *    and the waiter is never called.
 * 2. A real touched-while-open refusal — a mode toggle, which moves `ctimeNs`
 *    and nothing else — is the touched class and still the instructed class, so
 *    a wrapper that tests either type sees what it expects.
 * 3. An acquisition that hits that refusal and then succeeds reports the
 *    attempts it spent and the milliseconds it waited, and the waiter is called
 *    once per gap rather than once per attempt.
 * 4. One case injects no waiter at all, so the shipped default runs: a
 *    zero-millisecond wait still goes through the real timer and resolves.
 * 5. A changed-bytes refusal is rethrown on its first appearance, unwaited, so
 *    real drift is never given time to look transient.
 * 6. Exhausting the bound refuses with the persistence stated and the antivirus
 *    remedy named, and drops the "run the doctor again" instruction that the
 *    caller has by then already followed.
 * 7. A non-positive attempt count and a negative wait are refused as invalid
 *    rather than silently becoming one attempt or no wait.
 */
export const test_cli_capture_executable_settle = async (): Promise<void> => {
  // The guards refuse a symlinked ancestry outright, and a temporary directory
  // is symlinked on some platforms, so the fixture works from the real path.
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automovie-capture-settle-")),
  );
  // The shipped module is type-erased into the fixture and required from there,
  // exactly as the drift test does: requiring the `.ts` directly costs the suite
  // a minute of compiler startup and the module imports nothing but builtins.
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
          "cli",
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
  ) as ICaptureExecutableSettleModule;
  const file = path.join(root, "chrome.exe");
  fs.writeFileSync(file, Buffer.alloc(4096, 7));

  let opened: ICaptureExecutableSnapshot | null = null;
  try {
    const snapshot = module.openCaptureExecutable(file);
    opened = snapshot;

    /**
     * Move the file's stamps without moving one byte of it.
     *
     * `moveFileStamps` loops until the descriptor reports a different version,
     * because a single toggle lands inside the snapshot's own filesystem
     * timestamp tick about half the time and reads back identical. Assuming it
     * landed is what made this test intermittent.
     */
    const touch = (): void => moveFileStamps(file, snapshot.descriptor);

    const waits: number[] = [];
    const record = (milliseconds: number): Promise<void> => {
      waits.push(milliseconds);
      return Promise.resolve();
    };

    const settleFirst = await module.settleCaptureExecutableTouch({
      acquire: () => Promise.resolve("ready"),
      attempts: 4,
      waitMs: 2_000,
      wait: record,
    });
    const untouchedWaits = waits.length;

    // A mode toggle is what proves the classification is earned rather than
    // asserted: the bytes are the captured bytes and only `ctimeNs` moved, which
    // is the same shape a scanner leaves behind.
    touch();
    let touched: unknown;
    try {
      module.assertCaptureExecutableDescriptor(snapshot);
    } catch (error) {
      touched = error;
    }

    // Refuse twice, then let the acquisition through, which is the observed
    // shape: the scan ends and the same command succeeds untouched.
    let refusals = 0;
    const flaky = (): Promise<string> => {
      if (refusals++ < 2) {
        touch();
        module.assertCaptureExecutableDescriptor(snapshot);
      }
      return Promise.resolve("ready");
    };
    waits.length = 0;
    const settleFlaky = await module.settleCaptureExecutableTouch({
      acquire: () => Promise.resolve().then(flaky),
      attempts: 4,
      waitMs: 2_000,
      wait: record,
    });
    const flakyWaits = [...waits];

    // The waiter every other case injects is the one thing here that is not the
    // shipped code, so one case runs without it. A zero-millisecond wait still
    // goes through the real timer, which is what proves the default exists and
    // resolves rather than being a parameter nothing ever falls back from.
    let defaultRefused = false;
    const settleDefault = await module.settleCaptureExecutableTouch({
      acquire: () =>
        Promise.resolve().then(() => {
          if (defaultRefused) return "ready";
          defaultRefused = true;
          touch();
          module.assertCaptureExecutableDescriptor(snapshot);
          return "unreachable";
        }),
      attempts: 2,
      waitMs: 0,
    });

    waits.length = 0;
    const changed = await rejectsError(
      () =>
        module.settleCaptureExecutableTouch({
          acquire: () =>
            Promise.resolve().then(() =>
              module.assertCaptureExecutableDescriptor({
                ...snapshot,
                physicalIdentity: "0",
              }),
            ),
          attempts: 4,
          waitMs: 2_000,
          wait: record,
        }),
      [CHANGED],
    );
    const changedWaits = waits.length;

    waits.length = 0;
    const exhausted = await rejectsError(
      () =>
        module.settleCaptureExecutableTouch({
          acquire: () =>
            Promise.resolve().then(() => {
              touch();
              module.assertCaptureExecutableDescriptor(snapshot);
            }),
          attempts: 3,
          waitMs: 2_000,
          wait: record,
        }),
      ["Waiting did not help", "3 acquisitions over 4000 ms", PERSISTENT],
    );
    const exhaustedWaits = waits.length;
    let exhaustion: unknown;
    try {
      await module.settleCaptureExecutableTouch({
        acquire: () =>
          Promise.resolve().then(() => {
            touch();
            module.assertCaptureExecutableDescriptor(snapshot);
          }),
        attempts: 2,
        waitMs: 1,
        wait: record,
      });
    } catch (error) {
      exhaustion = error;
    }

    TestValidator.equals(
      "the capture doctor waits out an ambient touch, and waiting never softens a verdict",
      await namedFactsAsync([
        [
          "untouchedSpendsNothing",
          () =>
            Promise.resolve(
              settleFirst.value === "ready" &&
                settleFirst.attempts === 1 &&
                settleFirst.waitedMs === 0 &&
                untouchedWaits === 0,
            ),
        ],
        [
          "touchedIsItsOwnClass",
          () =>
            Promise.resolve(
              touched instanceof module.CaptureExecutableTouchedError &&
                touched instanceof module.CaptureExecutableInstructedError &&
                touched instanceof Error &&
                touched.message.includes(RERUN),
            ),
        ],
        [
          "flakyReportsWhatItSpent",
          () =>
            Promise.resolve(
              settleFlaky.value === "ready" &&
                settleFlaky.attempts === 3 &&
                settleFlaky.waitedMs === 4_000 &&
                flakyWaits.length === 2 &&
                flakyWaits.every((gap) => gap === 2_000),
            ),
        ],
        [
          "defaultWaiterIsARealTimer",
          () =>
            Promise.resolve(
              settleDefault.value === "ready" &&
                settleDefault.attempts === 2 &&
                settleDefault.waitedMs === 0 &&
                defaultRefused,
            ),
        ],
        ["changedBytesUnwaited", () => Promise.resolve(changed)],
        ["changedBytesNeverSlept", () => Promise.resolve(changedWaits === 0)],
        ["exhaustionIsItsOwnFinding", () => Promise.resolve(exhausted)],
        ["exhaustionSleptTwice", () => Promise.resolve(exhaustedWaits === 2)],
        [
          "exhaustionDropsTheTransientInstruction",
          () =>
            Promise.resolve(
              exhaustion instanceof module.CaptureExecutableTouchedError &&
                exhaustion.message.includes(PERSISTENT) &&
                exhaustion.message.includes(RERUN) === false &&
                (exhaustion as { cause?: unknown }).cause instanceof
                  module.CaptureExecutableTouchedError,
            ),
        ],
        [
          "invalidAttemptsRefused",
          () =>
            rejectsError(
              () =>
                module.settleCaptureExecutableTouch({
                  acquire: () => Promise.resolve(0),
                  attempts: 0,
                  waitMs: 1,
                }),
              ["attempt count is invalid"],
            ),
        ],
        [
          "invalidWaitRefused",
          () =>
            rejectsError(
              () =>
                module.settleCaptureExecutableTouch({
                  acquire: () => Promise.resolve(0),
                  attempts: 1,
                  waitMs: -1,
                }),
              ["settle wait is invalid"],
            ),
        ],
      ]),
      {
        untouchedSpendsNothing: true,
        touchedIsItsOwnClass: true,
        flakyReportsWhatItSpent: true,
        defaultWaiterIsARealTimer: true,
        changedBytesUnwaited: true,
        changedBytesNeverSlept: true,
        exhaustionIsItsOwnFinding: true,
        exhaustionSleptTwice: true,
        exhaustionDropsTheTransientInstruction: true,
        invalidAttemptsRefused: true,
        invalidWaitRefused: true,
      },
    );
  } finally {
    if (opened !== null) module.closeCaptureExecutable(opened);
    fs.rmSync(root, { recursive: true, force: true });
  }
};
