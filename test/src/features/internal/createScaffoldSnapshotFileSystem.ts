import { scaffoldFileSnapshotForTesting } from "@automovie/template";
import type * as fs from "node:fs";
import path from "node:path";

/** Descriptor-backed in-memory filesystem for the scaffold boundary's own I/O. */
export const createScaffoldSnapshotFileSystem = () => {
  const root = path.resolve("/snapshot-project");
  const file = path.join(root, "config.json");
  const state = {
    bytes: Buffer.from("old"),
    identity: 31n,
    clock: 2n,
    changeClock: 0n,
    advanceChangeTimeOnOpen: false,
    pathDevice: 1n,
    links: 1n,
    symbolic: false,
    readFailure: undefined as unknown,
    closeFailure: undefined as unknown,
    beforeRead: undefined as (() => void) | undefined,
    afterRead: undefined as (() => void) | undefined,
    afterFinalClose: undefined as (() => void) | undefined,
  };
  const descriptors = new Map<
    number,
    { directory: boolean; identity: bigint }
  >();
  let nextDescriptor = 10;
  const events: string[] = [];
  const status = (
    directory: boolean,
    identity: bigint,
    device: bigint,
  ): fs.BigIntStats =>
    ({
      dev: device,
      ino: identity,
      size: BigInt(directory ? 0 : state.bytes.length),
      mtimeNs: state.clock,
      ctimeNs: state.clock + state.changeClock,
      nlink: directory ? 2n : state.links,
      isDirectory: () => directory,
      isFile: () => !directory,
      isSymbolicLink: () => !directory && state.symbolic,
    }) as fs.BigIntStats;
  const nativeRealPath = Object.assign((target: string) => target, {
    native: (target: string) => target,
  });
  const io = {
    constants: { O_RDONLY: 0 },
    lstatSync: (target: string) => {
      if (target !== root && target !== file)
        throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return status(
        target === root,
        target === root ? 20n : state.identity,
        state.pathDevice,
      );
    },
    realpathSync: nativeRealPath,
    openSync: (target: string) => {
      if (target !== root && target !== file)
        throw Object.assign(new Error("absent"), { code: "ENOENT" });
      const descriptor = nextDescriptor++;
      if (target === file && state.advanceChangeTimeOnOpen) state.changeClock++;
      descriptors.set(descriptor, {
        directory: target === root,
        identity: target === root ? 20n : state.identity,
      });
      events.push(`open:${descriptor}`);
      return descriptor;
    },
    fstatSync: (descriptor: number) => {
      const opened = descriptors.get(descriptor)!;
      return status(opened.directory, opened.identity, 1n);
    },
    closeSync: (descriptor: number) => {
      events.push(`close:${descriptor}`);
      const opened = descriptors.get(descriptor)!;
      descriptors.delete(descriptor);
      if (!opened.directory && descriptors.size === 0)
        state.afterFinalClose?.();
      if (!opened.directory && state.closeFailure !== undefined)
        // eslint-disable-next-line typescript/only-throw-error -- exercise non-Error close failures without rewriting their identity
        throw state.closeFailure;
    },
    readFileSync: (_descriptor: number) => {
      state.beforeRead?.();
      if (state.readFailure !== undefined)
        // eslint-disable-next-line typescript/only-throw-error -- exercise non-Error read failures and aggregate preservation
        throw state.readFailure;
      const result = Buffer.from(state.bytes);
      state.afterRead?.();
      return result;
    },
    ftruncateSync: (_descriptor: number, length: number) => {
      events.push("truncate");
      state.bytes = Buffer.alloc(length);
      state.clock++;
    },
    writeSync: (
      _descriptor: number,
      bytes: Buffer,
      offset: number,
      length: number,
      position: number,
    ) => {
      const next = Buffer.alloc(
        Math.max(state.bytes.length, position + length),
      );
      state.bytes.copy(next);
      bytes.copy(next, position, offset, offset + length);
      state.bytes = next;
      state.clock++;
      return length;
    },
    readSync: (
      _descriptor: number,
      target: Buffer,
      offset: number,
      length: number,
      position: number,
    ) => state.bytes.copy(target, offset, position, position + length),
    fsyncSync: () => {},
  };
  return {
    root,
    file,
    state,
    events,
    openCount: () => descriptors.size,
    run: <T>(task: () => T): T =>
      scaffoldFileSnapshotForTesting.withFileSystem(
        io as unknown as typeof fs,
        task,
      ),
  };
};
