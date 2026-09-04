import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

interface IWorkspacePackage {
  readonly key: string;
  readonly directory: string;
  readonly name: string;
}

interface IPackWorkspaceDependencies {
  readonly remove: (directory: string) => void;
  readonly makeDirectory: (directory: string) => void;
  readonly makeTemporaryDirectory: (prefix: string) => string;
  readonly pack: (
    directory: string,
    destination: string,
  ) => { readonly status: number | null; readonly stdout: string };
  readonly exists: (file: string) => boolean;
  readonly read: (file: string) => Buffer;
  readonly rename: (source: string, target: string) => void;
  readonly write: (message: string) => unknown;
}

interface IPackWorkspaceResult {
  readonly directory: string;
  readonly generation: string;
  readonly specifiers: Readonly<Record<string, string>>;
}

const { buildTgz, packWorkspace } = loadSourceModule<{
  buildTgz: (
    root: string,
    pack: (target: string) => IPackWorkspaceResult,
    write: (message: string) => unknown,
  ) => string;
  packWorkspace: (
    target: string,
    dependencies: IPackWorkspaceDependencies,
    packages: readonly IWorkspacePackage[],
  ) => IPackWorkspaceResult;
}>(path.resolve(__dirname, "../../../../build/tgz.ts"));

const {
  experimentalInstallFailureMessage,
  experimentalScaffoldRequest,
  sandboxManifest,
} = loadSourceModule<{
  experimentalInstallFailureMessage: (name: string, refresh: boolean) => string;
  experimentalScaffoldRequest: (
    name: string,
    refresh: boolean,
  ) => { readonly language: "english"; readonly name: string } | undefined;
  sandboxManifest: (
    rendered: string,
    specifiers: Readonly<Record<string, string>>,
    packages: readonly IWorkspacePackage[],
  ) => string;
}>(path.resolve(__dirname, "../../../../build/experimental.ts"));

const PACKAGES: readonly IWorkspacePackage[] = [
  {
    key: "runtime",
    directory: "runtime",
    name: "@example/runtime",
  },
  {
    key: "consumer",
    directory: "consumer",
    name: "@example/consumer",
  },
];

interface IVirtualPackWorkspace {
  readonly dependencies: IPackWorkspaceDependencies;
  readonly directories: Set<string>;
  readonly events: string[];
  readonly files: Map<string, Buffer>;
  readonly removed: string[];
}

const virtualPackWorkspace = (failPackage?: string): IVirtualPackWorkspace => {
  const directories = new Set<string>();
  const events: string[] = [];
  const files = new Map<string, Buffer>();
  const removed: string[] = [];
  let stagingIndex = 0;

  const remove = (directory: string): void => {
    events.push(`remove:${directory}`);
    removed.push(directory);
    directories.delete(directory);
    for (const file of [...files.keys()])
      if (file.startsWith(`${directory}${path.sep}`)) files.delete(file);
  };
  return {
    dependencies: {
      exists: (file) => directories.has(file) || files.has(file),
      makeDirectory: (directory) => {
        events.push(`mkdir:${directory}`);
        directories.add(directory);
      },
      makeTemporaryDirectory: (prefix) => {
        const directory = `${prefix}${++stagingIndex}`;
        events.push(`stage:${directory}`);
        directories.add(directory);
        return directory;
      },
      pack: (directory, destination) => {
        const name = path.basename(directory);
        events.push(`pack:${name}`);
        if (name === failPackage) return { status: 1, stdout: "" };
        const produced = path.join(destination, `${name}-1.0.0.tgz`);
        files.set(produced, Buffer.from(`${name}-bytes`, "utf8"));
        return { status: 0, stdout: `${produced}\n` };
      },
      read: (file) => {
        const value = files.get(file);
        if (value === undefined)
          throw new Error(`missing virtual file ${file}`);
        return value;
      },
      remove,
      rename: (source, destination) => {
        if (directories.has(source)) {
          events.push(`activate:${source}->${destination}`);
          directories.delete(source);
          directories.add(destination);
          for (const [file, value] of [...files])
            if (file.startsWith(`${source}${path.sep}`)) {
              files.delete(file);
              files.set(`${destination}${file.slice(source.length)}`, value);
            }
          return;
        }
        const value = files.get(source);
        if (value === undefined)
          throw new Error(`missing virtual file ${source}`);
        events.push(`rename:${path.basename(source)}`);
        files.delete(source);
        files.set(destination, value);
      },
      write: (message) => events.push(`write:${message.trim()}`),
    },
    directories,
    events,
    files,
    removed,
  };
};

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);

/**
 * Experimental packages activate only after one complete immutable generation.
 *
 * Scenarios:
 *
 * 1. Two packages are packed in a sibling staging directory, content-named,
 *    and activated only after both succeed; a byte-identical retry reuses that
 *    immutable generation.
 * 2. An existing generation whose bytes no longer match its name is refused
 *    rather than silently reused.
 * 3. A later package failure removes only its staging directory and preserves
 *    the predecessor generation and every byte it carried.
 * 4. The standalone TGZ command reports the generation it actually produced,
 *    rather than a legacy mutable directory name.
 * 5. Creation selects the English scaffold explicitly, refresh selects no
 *    scaffold at all, and the two install failures prescribe non-destructive
 *    recovery for their respective states.
 * 6. Rewriting refresh pins preserves authored manifest fields outside the
 *    workspace package dependency it intentionally changes.
 */
export const test_workspace_experimental_package_generation = (): void => {
  const target = path.resolve("virtual", "experiment");
  const predecessor = path.join(target, ".tarballs-predecessor");
  const predecessorFile = path.join(predecessor, "runtime-old.tgz");
  const successful = virtualPackWorkspace();
  successful.directories.add(predecessor);
  successful.files.set(predecessorFile, Buffer.from("old-generation", "utf8"));
  const first = packWorkspace(target, successful.dependencies, PACKAGES);
  const firstEvents = [...successful.events];
  const second = packWorkspace(target, successful.dependencies, PACKAGES);
  const generation = path.basename(first.directory);
  const runtimeFile = `runtime-1.0.0-${digest("runtime-bytes")}.tgz`;
  const consumerFile = `consumer-1.0.0-${digest("consumer-bytes")}.tgz`;
  successful.files.set(
    path.join(first.directory, consumerFile),
    Buffer.from("corrupted", "utf8"),
  );
  const corruptedGenerationRefused = throwsError(
    () => packWorkspace(target, successful.dependencies, PACKAGES),
    ["cannot be reused", consumerFile, "different bytes"],
  );

  const failing = virtualPackWorkspace("consumer");
  failing.directories.add(predecessor);
  failing.files.set(predecessorFile, Buffer.from("old-generation", "utf8"));
  const failed = throwsError(
    () => packWorkspace(target, failing.dependencies, PACKAGES),
    ["pnpm pack failed", "@example/consumer"],
  );

  const buildOutput: string[] = [];
  const builtDirectory = buildTgz(
    path.resolve("virtual", "root"),
    () => first,
    (message) => buildOutput.push(message),
  );

  const renderedManifest = JSON.stringify({
    name: "authored-production",
    scripts: { authored: "tsx src/authored.ts" },
    dependencies: { "@example/runtime": "old-runtime", retained: "1.0.0" },
  });
  const refreshedManifest = JSON.parse(
    sandboxManifest(
      renderedManifest,
      {
        runtime: first.specifiers.runtime!,
      },
      PACKAGES,
    ),
  ) as {
    dependencies: Record<string, string>;
    name: string;
    scripts: Record<string, string>;
  };

  TestValidator.equals(
    "experimental package generations are failure-atomic and refresh-safe",
    namedFacts([
      [
        "both packages finish before generation activation",
        () =>
          firstEvents.filter((event) => event.startsWith("pack:")).join(",") ===
            "pack:runtime,pack:consumer" &&
          firstEvents.at(-1)?.startsWith("activate:") === true,
      ],
      [
        "specifier paths bind both packages to one content generation",
        () =>
          first.specifiers.runtime === `file:./${generation}/${runtimeFile}` &&
          first.specifiers.consumer === `file:./${generation}/${consumerFile}`,
      ],
      [
        "successful activation preserves the predecessor generation",
        () =>
          successful.directories.has(predecessor) &&
          successful.files.get(predecessorFile)?.toString("utf8") ===
            "old-generation",
      ],
      [
        "a byte-identical retry reuses the immutable generation",
        () =>
          second.directory === first.directory &&
          second.generation === first.generation &&
          successful.events.filter((event) => event.startsWith("activate:"))
            .length === 1,
      ],
      [
        "a corrupt existing generation is never reused",
        () => corruptedGenerationRefused,
      ],
      ["the later package failure is observable", () => failed],
      [
        "failure preserves the predecessor generation",
        () =>
          failing.directories.has(predecessor) &&
          failing.files.get(predecessorFile)?.toString("utf8") ===
            "old-generation",
      ],
      [
        "failure removes staging and no predecessor",
        () =>
          failing.removed.length === 1 &&
          path.basename(failing.removed[0]!).startsWith(".tarballs-stage-") &&
          failing.removed.includes(predecessor) === false,
      ],
      [
        "the TGZ command reports the produced generation",
        () =>
          builtDirectory === first.directory &&
          buildOutput.join("") ===
            `TGZ packages built under ${first.directory}\n`,
      ],
      [
        "creation selects English while refresh performs no render",
        () =>
          JSON.stringify(experimentalScaffoldRequest("sample", false)) ===
            JSON.stringify({ language: "english", name: "sample" }) &&
          experimentalScaffoldRequest("sample", true) === undefined,
      ],
      [
        "install recovery preserves an existing authored sandbox",
        () =>
          experimentalInstallFailureMessage("sample", true).endsWith(
            "re-run with --refresh.",
          ) &&
          experimentalInstallFailureMessage("sample", false).endsWith(
            "re-run with --force.",
          ),
      ],
      [
        "refresh changes only the selected package pin",
        () =>
          refreshedManifest.name === "authored-production" &&
          refreshedManifest.scripts.authored === "tsx src/authored.ts" &&
          refreshedManifest.dependencies.retained === "1.0.0" &&
          refreshedManifest.dependencies["@example/runtime"] ===
            first.specifiers.runtime,
      ],
    ]),
    {
      "both packages finish before generation activation": true,
      "specifier paths bind both packages to one content generation": true,
      "successful activation preserves the predecessor generation": true,
      "a byte-identical retry reuses the immutable generation": true,
      "a corrupt existing generation is never reused": true,
      "the later package failure is observable": true,
      "failure preserves the predecessor generation": true,
      "failure removes staging and no predecessor": true,
      "the TGZ command reports the produced generation": true,
      "creation selects English while refresh performs no render": true,
      "install recovery preserves an existing authored sandbox": true,
      "refresh changes only the selected package pin": true,
    },
  );
};
