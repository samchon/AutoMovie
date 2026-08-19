import fs from "node:fs";

/** Sleep inside synchronous fixture code, without a timer or a busy loop. */
const sleep = (milliseconds: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
};

/** The stamps a capture executable guard folds into its version. */
const stampsOf = (descriptor: number): string => {
  const status = fs.fstatSync(descriptor, { bigint: true });
  return `${status.mtimeNs}|${status.ctimeNs}`;
};

/**
 * Move a file's metadata stamps for certain, without moving one byte of it.
 *
 * Toggling the mode is the platform's own metadata write and is what a capture
 * fixture uses to imitate a virus scanner touching a freshly installed browser.
 * Doing it once is not enough, and the reason is a clock rather than a
 * permission: a stamp written inside the same filesystem timestamp tick as the
 * snapshot that captured it reads back identical, so the guard sees nothing to
 * refuse. Measured on this repository's Windows NTFS target, a single toggle
 * issued immediately after the descriptor was opened failed to move the stamps
 * **29 times out of 60**.
 *
 * A fixture that assumes the touch landed is a test asserting on a state it
 * never established, which shows up as an intermittent failure in whichever
 * assertion needed the refusal. So this loops until the descriptor itself
 * reports a different version, and refuses loudly rather than returning a
 * promise it did not keep.
 */
export const moveFileStamps = (file: string, descriptor: number): void => {
  const before = stampsOf(descriptor);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mode = fs.statSync(file).mode;
    fs.chmodSync(file, mode ^ 0o200);
    fs.chmodSync(file, mode);
    if (stampsOf(descriptor) !== before) return;
    sleep(2);
  }
  throw new Error(
    `Toggling the mode of "${file}" never moved its stamps, so this fixture cannot imitate an ambient touch on this platform.`,
  );
};

/** The stamps `physicalDirectory` folds into a captured directory version. */
const directoryStampsOf = (directory: string): string => {
  const status = fs.statSync(fs.realpathSync(directory), { bigint: true });
  return `${status.mtimeNs}|${status.ctimeNs}`;
};

/**
 * Leave one new file in a directory, and make sure the directory says so.
 *
 * This is the same clock problem {@link moveFileStamps} solves, one level up. A
 * capture guard rejects a directory whose stamps moved while it held an
 * executable open, because a quarantine file or an extraction leftover appearing
 * beside the browser is exactly that; a fixture imitates it by creating a
 * sibling. Create the sibling inside the tick the directory version was captured
 * in and the directory reads back identical, and the guard has nothing to
 * refuse.
 *
 * Only adding and removing an entry moves a directory's stamps — rewriting a
 * file already inside it does not — so a retry removes the sibling before
 * trying again, and the directory holds exactly one new file when this returns.
 */
export const moveDirectoryStamps = (directory: string, file: string): void => {
  const before = directoryStampsOf(directory);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    fs.writeFileSync(file, `scanner leftover ${attempt}`);
    if (directoryStampsOf(directory) !== before) return;
    fs.rmSync(file, { force: true });
    sleep(2);
  }
  throw new Error(
    `Creating "${file}" never moved the stamps of "${directory}", so this fixture cannot imitate a scanner writing beside the executable.`,
  );
};
