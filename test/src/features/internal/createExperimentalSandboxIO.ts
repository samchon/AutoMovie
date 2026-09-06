import path from "node:path";

interface IDirectory {
  identity: string;
  path: string;
  real: string;
}

interface IFileSnapshot {
  identity: string;
  path: string;
  version: string;
}

type PublicationOutcome =
  | { fileIdentity?: string; parentIdentity: string; status: "completed" }
  | {
      error: unknown;
      reason: "create-failed" | "parent-changed" | "target-competitor";
      status: "refused";
    }
  | {
      bytesWritten: number;
      error: unknown;
      parentIdentity: string;
      status: "partial";
    };

/** Typed protocol substituted for the sandbox's existing physical IO adapter. */
export interface IExperimentalSandboxTestIO {
  assertDirectory(directory: IDirectory): void;
  assertFile(file: IFileSnapshot): void;
  captureDirectory(directory: string): IDirectory;
  captureFile(file: string): IFileSnapshot;
  ensureDirectory(props: {
    base: IDirectory;
    cache: Map<string, IDirectory>;
    directory: string;
  }): IDirectory;
  readDirectory(directory: string): readonly string[];
  readFile(file: string): {
    bytes: Buffer;
    identity: string;
    snapshot: IFileSnapshot;
  };
  writeFile(props: {
    base: IDirectory;
    bytes: Uint8Array;
    expected?: IFileSnapshot | null;
    force: boolean;
    parent: IDirectory;
    target: string;
  }): PublicationOutcome;
}

/** Observable session used by private build-module unit tests. */
export interface IExperimentalSandboxTestSession {
  entries: readonly string[];
  manifest: string | undefined;
  physicalDirectory: IDirectory;
  target: string;
  assertCurrent(): void;
  prepare(files: readonly string[]): void;
  publish(files: Record<string, string>): void;
  read(relative: string): string | undefined;
}

/**
 * In-memory directory/file generation responses and a strict writer double.
 * It models the adapter contract, without opening an OS path or process.
 */
export const createExperimentalSandboxIO = (target: string) => {
  const directories = new Map<string, IDirectory>();
  const files = new Map<string, { bytes: Buffer; snapshot: IFileSnapshot }>();
  const failures = new Map<string, unknown>();
  const events: string[] = [];
  let serial = 0;
  const hooks: {
    before: (event: string) => void;
    outcome?: PublicationOutcome;
  } = { before: () => undefined };
  const visit = (event: string): void => {
    events.push(event);
    hooks.before(event);
  };
  const missing = (location: string): never => {
    throw Object.assign(new Error(`missing ${location}`), { code: "ENOENT" });
  };
  const putDirectory = (directory: string): IDirectory => {
    const value = {
      identity: `directory-${++serial}`,
      path: directory,
      real: directory,
    };
    directories.set(directory, value);
    return { ...value };
  };
  for (let cursor = target; ; cursor = path.dirname(cursor)) {
    putDirectory(cursor);
    if (path.dirname(cursor) === cursor) break;
  }
  const putFile = (file: string, source: string, identity?: string): void => {
    const revision = ++serial;
    files.set(file, {
      bytes: Buffer.from(source),
      snapshot: {
        identity: identity ?? `file-${revision}`,
        path: file,
        version: `revision-${revision}`,
      },
    });
  };
  const captureDirectory = (directory: string): IDirectory => {
    visit(`capture-directory:${directory}`);
    if (failures.has(directory)) throw failures.get(directory);
    const value = directories.get(directory);
    if (value === undefined) return missing(directory);
    return { ...value };
  };
  const captureFile = (file: string): IFileSnapshot => {
    visit(`capture-file:${file}`);
    if (failures.has(file)) throw failures.get(file);
    const value = files.get(file);
    if (value === undefined) return missing(file);
    return { ...value.snapshot };
  };
  const assertDirectory = (directory: IDirectory): void => {
    visit(`assert-directory:${directory.path}`);
    const actual = directories.get(directory.path);
    if (failures.has(directory.path)) throw failures.get(directory.path);
    if (
      actual?.identity !== directory.identity ||
      actual.real !== directory.real
    )
      throw new Error(`directory changed: ${directory.path}`);
  };
  const assertFile = (file: IFileSnapshot): void => {
    visit(`assert-file:${file.path}`);
    const actual = captureFile(file.path);
    if (actual.identity !== file.identity || actual.version !== file.version)
      throw new Error(`file changed: ${file.path}`);
  };
  const io: IExperimentalSandboxTestIO = {
    assertDirectory,
    assertFile,
    captureDirectory,
    captureFile,
    ensureDirectory: ({ directory }) => {
      visit(`create-directory:${directory}`);
      return putDirectory(directory);
    },
    readDirectory: (directory) => {
      visit(`entries:${directory}`);
      return [...files.keys()]
        .filter((file) => path.dirname(file) === directory)
        .map((file) => path.basename(file));
    },
    readFile: (file) => {
      visit(`read:${file}`);
      const snapshot = captureFile(file);
      return {
        bytes: Buffer.from(files.get(file)!.bytes),
        identity: snapshot.identity,
        snapshot,
      };
    },
    writeFile: ({ bytes, expected, force, parent, target: file }) => {
      visit(`write:${file}`);
      if (hooks.outcome !== undefined) return hooks.outcome;
      if (expected === undefined)
        throw new Error("writer received no preapproved snapshot");
      if (!force && expected !== null)
        throw new Error("writer received no overwrite grant");
      assertDirectory(parent);
      if (expected === null && files.has(file))
        throw new Error("target competitor");
      if (expected !== null) assertFile(expected);
      putFile(file, Buffer.from(bytes).toString("utf8"), expected?.identity);
      return {
        fileIdentity: files.get(file)!.snapshot.identity,
        parentIdentity: parent.identity,
        status: "completed",
      };
    },
  };
  return {
    directories,
    events,
    failures,
    files,
    hooks,
    io,
    putDirectory,
    putFile,
  };
};
