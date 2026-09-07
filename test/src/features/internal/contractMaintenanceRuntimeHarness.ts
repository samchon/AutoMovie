import type {
  IScaffoldFileSnapshot,
  IScaffoldPhysicalDirectory,
} from "@automovie/template";
import {
  type IAutoMovieMaintenanceObservation,
  type IAutoMovieMaintenanceRuntimeIO,
  autoMovieMaintenanceFileFromSnapshot,
} from "automovie";
import * as path from "node:path";

/** Logical slots and parent generations for the injected runtime adapter. */
export const createContractMaintenanceRuntimeHarness = () => {
  const root = {
    path: path.resolve("maintenance-runtime"),
    real: path.resolve("maintenance-runtime"),
    identity: "volume:root",
  };
  const parents = new Map<string, IScaffoldPhysicalDirectory>([
    [root.path, root],
  ]);
  const files = new Map<
    string,
    { identity: string; version: string; source: string }
  >();
  let next = 0;
  const events: string[] = [];
  const state = { hook: (_event: string): void => {} };
  const event = (name: string): void => {
    events.push(name);
    state.hook(name);
  };
  const relative = (absolute: string): string =>
    path.relative(root.path, absolute).split(path.sep).join("/");
  const put = (name: string, source: string): void => {
    const identity = `volume:file-${++next}`;
    files.set(name, {
      identity,
      source,
      version: `${identity}:${Buffer.byteLength(source)}:100:200`,
    });
  };
  const observe = (
    names: readonly string[],
  ): IAutoMovieMaintenanceObservation => {
    const snapshots: Record<string, IScaffoldFileSnapshot | null> = {};
    const descriptors: Record<
      string,
      Pick<IScaffoldFileSnapshot, "identity" | "version"> | null
    > = {};
    const sources: Record<string, string> = {};
    for (const name of names) {
      const file = files.get(name);
      snapshots[name] =
        file === undefined
          ? null
          : {
              identity: `path:${file.identity}`,
              version: file.version,
              path: path.resolve(root.path, ...name.split("/")),
            };
      descriptors[name] =
        file === undefined
          ? null
          : { identity: file.identity, version: file.version };
      if (file !== undefined) sources[name] = file.source;
    }
    return {
      root,
      directories: [...parents.values()],
      files: snapshots,
      descriptors,
      sources,
    };
  };
  const physical: IAutoMovieMaintenanceRuntimeIO = {
    assertDirectory: (directory) => {
      event(`assert:${relative(directory.path)}`);
      if (parents.get(directory.path)?.identity !== directory.identity)
        throw new Error("replaced parent");
    },
    observe: (props) => {
      event(`observe:${props.paths.join(",")}`);
      return observe(props.paths);
    },
    ensureDirectory: (props) => {
      event(`parent:${relative(props.directory)}`);
      let parent = parents.get(props.directory);
      if (parent === undefined) {
        parent = {
          path: props.directory,
          real: props.directory,
          identity: `directory:${relative(props.directory)}`,
        };
        parents.set(props.directory, parent);
      }
      props.cache.set(parent.path, parent);
      return parent;
    },
    write: (props) => {
      const target = relative(props.target);
      event(`write:${target}`);
      if (files.has(target))
        return {
          status: "refused",
          reason: "target-competitor",
          error: new Error("occupied stage"),
        };
      put(
        target,
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          props.bytes,
        ),
      );
      return { status: "completed", parentIdentity: props.parent.identity };
    },
    rename: (request) => {
      const source = relative(
        path.join(request.source.parent.path, request.source.name),
      );
      const target = relative(
        path.join(request.target.parent.path, request.target.name),
      );
      event(`rename:${source}->${target}`);
      const file = files.get(source);
      const observed =
        file === undefined
          ? null
          : autoMovieMaintenanceFileFromSnapshot(file, file.source);
      if (
        observed === null ||
        observed.identity !== request.source.file.identity ||
        observed.source !== request.source.file.source ||
        observed.version !== request.source.file.version
      )
        throw new Error("changed source");
      if (files.has(target)) throw new Error("occupied target");
      files.set(target, file!);
      files.delete(source);
    },
    sync: (parent) => {
      event(`sync:${relative(parent.path)}`);
    },
    syncFile: (props) => {
      event(`sync-file:${relative(path.join(props.parent.path, props.name))}`);
    },
  };
  return { root, parents, files, events, state, put, observe, physical };
};
