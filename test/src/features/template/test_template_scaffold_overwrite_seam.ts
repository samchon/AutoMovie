import {
  type ScaffoldFilePublicationOutcome,
  captureScaffoldPhysicalDirectory,
  scaffoldFileSnapshotForTesting,
  writeScaffoldFile,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type FileSystem = typeof fs;

/** Real `node:fs` with a few calls replaced; `this` is never consulted. */
const fakeFileSystem = (overrides: Partial<FileSystem>): FileSystem =>
  new Proxy(fs, {
    get: (target, property) =>
      property in overrides
        ? (overrides as Record<PropertyKey, unknown>)[property]
        : Reflect.get(target, property),
  });

/** One BigIntStats whose named fields read differently; methods still work. */
const alteredStats = (
  status: fs.BigIntStats,
  fields: Record<string, bigint>,
): fs.BigIntStats =>
  new Proxy(status, {
    get: (target, property) =>
      typeof property === "string" && property in fields
        ? fields[property]
        : Reflect.get(target, property),
  });

interface IAttempt {
  outcome: string;
  resident: string;
  errors: readonly string[];
}

/**
 * Descriptor-level failures during an exact-file replacement are reported as
 * truthful outcomes instead of thrown, and only failures after the truncation
 * count as a bound partial effect.
 *
 * The injected filesystem is real `node:fs` with one call replaced per
 * scenario, so every other verification the overwrite performs still runs
 * against the actual temporary file.
 *
 * Scenarios:
 *
 * 1. A target that cannot be reopened for writing is a pre-mutation refusal;
 *    the resident bytes are untouched.
 * 2. A held descriptor that no longer describes one single-link file fails
 *    before truncation and is also a refusal, not a partial.
 * 3. A close failure after a complete write is a partial outcome carrying the
 *    whole written extent; a write failure followed by a close failure
 *    aggregates both errors in order and reports the truncated extent.
 * 4. A resident generation that moves after the descriptor closes is a partial
 *    outcome, because the bytes were written but their ownership is unproven.
 * 5. A directory whose opened descriptor names a different inode than its path
 *    is refused while its identity is captured.
 */
export const test_template_scaffold_overwrite_seam = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-overwrite-seam-"),
  );
  try {
    const base = captureScaffoldPhysicalDirectory(root);
    const target = path.join(root, "entry.txt");
    const heldDescriptor = { value: -1 };
    const attempt = (fileSystem: FileSystem): IAttempt => {
      heldDescriptor.value = -1;
      fs.writeFileSync(target, "before");
      const outcome: ScaffoldFilePublicationOutcome =
        scaffoldFileSnapshotForTesting.withFileSystem(fileSystem, () =>
          writeScaffoldFile({
            base,
            bytes: Buffer.from("after"),
            force: true,
            parent: base,
            target,
          }),
        );
      const error = outcome.status === "completed" ? undefined : outcome.error;
      return {
        outcome:
          outcome.status === "refused"
            ? `${outcome.status}:${outcome.reason}`
            : outcome.status === "partial"
              ? `${outcome.status}:${outcome.bytesWritten}`
              : outcome.status,
        resident: fs.readFileSync(target, "utf8"),
        errors:
          error instanceof AggregateError
            ? [
                error.message,
                ...error.errors.map((member) => (member as Error).message),
              ]
            : error instanceof Error
              ? [error.message]
              : [],
      };
    };
    const openHeld: FileSystem["openSync"] = ((
      file: fs.PathLike,
      flags?: fs.OpenMode,
      mode?: fs.Mode | null,
    ) => {
      const descriptor = fs.openSync(file, flags ?? "r", mode);
      if (flags === "r+") heldDescriptor.value = descriptor;
      return descriptor;
    }) as FileSystem["openSync"];

    const locked = attempt(
      fakeFileSystem({
        openSync: ((file: fs.PathLike, flags?: fs.OpenMode, mode?: fs.Mode) => {
          if (flags === "r+") throw new Error("target is locked");
          return fs.openSync(file, flags ?? "r", mode);
        }) as FileSystem["openSync"],
      }),
    );
    const multiLink = attempt(
      fakeFileSystem({
        openSync: openHeld,
        fstatSync: ((descriptor: number, options?: fs.StatOptions) => {
          const status = fs.fstatSync(descriptor, { bigint: true });
          return descriptor === heldDescriptor.value && options?.bigint === true
            ? alteredStats(status, { nlink: 2n })
            : fs.fstatSync(descriptor, options as fs.StatOptions);
        }) as FileSystem["fstatSync"],
      }),
    );
    const closeFails = attempt(
      fakeFileSystem({
        openSync: openHeld,
        closeSync: (descriptor: number) => {
          if (descriptor === heldDescriptor.value)
            throw new Error("close refused");
          fs.closeSync(descriptor);
        },
      }),
    );
    const writeThenCloseFail = attempt(
      fakeFileSystem({
        openSync: openHeld,
        writeSync: ((descriptor: number, ...rest: unknown[]) => {
          if (descriptor === heldDescriptor.value)
            throw new Error("write refused");
          return (fs.writeSync as (...arguments_: unknown[]) => number)(
            descriptor,
            ...rest,
          );
        }) as FileSystem["writeSync"],
        closeSync: (descriptor: number) => {
          if (descriptor === heldDescriptor.value)
            throw new Error("close refused");
          fs.closeSync(descriptor);
        },
      }),
    );
    const closed = { value: false };
    const movedAfterClose = attempt(
      fakeFileSystem({
        openSync: openHeld,
        closeSync: (descriptor: number) => {
          if (descriptor === heldDescriptor.value) closed.value = true;
          fs.closeSync(descriptor);
        },
        lstatSync: ((file: fs.PathLike, options?: fs.StatOptions) => {
          const status = fs.lstatSync(file, options as fs.StatOptions);
          return closed.value &&
            path.resolve(String(file)) === target &&
            options?.bigint === true
            ? alteredStats(status as fs.BigIntStats, {
                mtimeNs: (status as fs.BigIntStats).mtimeNs + 1n,
              })
            : status;
        }) as FileSystem["lstatSync"],
      }),
    );

    TestValidator.equals(
      "overwrite failures are classified by whether the truncation happened",
      { locked, multiLink, closeFails, writeThenCloseFail, movedAfterClose },
      {
        locked: {
          outcome: "refused:create-failed",
          resident: "before",
          errors: ["target is locked"],
        },
        multiLink: {
          outcome: "refused:create-failed",
          resident: "before",
          errors: [
            `scaffold file is not one ordinary single-link file: ${target}`,
          ],
        },
        closeFails: {
          outcome: "partial:5",
          resident: "after",
          errors: ["close refused"],
        },
        writeThenCloseFail: {
          outcome: "partial:0",
          resident: "",
          errors: [
            "overwritten scaffold file close failed after publication failure",
            "write refused",
            "close refused",
          ],
        },
        movedAfterClose: {
          outcome: "partial:5",
          resident: "after",
          errors: [`scaffold file changed after descriptor close: ${target}`],
        },
      },
    );

    const directoryDescriptor = { value: -1 };
    let identityRefusal: string | null = null;
    try {
      scaffoldFileSnapshotForTesting.withFileSystem(
        fakeFileSystem({
          openSync: ((
            file: fs.PathLike,
            flags?: fs.OpenMode,
            mode?: fs.Mode,
          ) => {
            const descriptor = fs.openSync(file, flags ?? "r", mode);
            if (path.resolve(String(file)) === root)
              directoryDescriptor.value = descriptor;
            return descriptor;
          }) as FileSystem["openSync"],
          fstatSync: ((descriptor: number, options?: fs.StatOptions) => {
            const status = fs.fstatSync(descriptor, { bigint: true });
            return descriptor === directoryDescriptor.value &&
              options?.bigint === true
              ? alteredStats(status, { ino: status.ino + 1n })
              : fs.fstatSync(descriptor, options as fs.StatOptions);
          }) as FileSystem["fstatSync"],
        }),
        () => captureScaffoldPhysicalDirectory(root),
      );
    } catch (error) {
      identityRefusal = error instanceof Error ? error.message : String(error);
    }
    TestValidator.equals(
      "a directory descriptor naming another inode refuses identity capture",
      identityRefusal,
      `scaffold directory changed while its identity was captured: ${root}`,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
