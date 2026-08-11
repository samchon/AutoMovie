import {
  renderScaffold,
  renderTemplate,
  scaffoldAssetDirectory,
  writeFiles,
} from "@automovie/cli";
import { compareCodeUnits } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";

import {
  productionH264Mp4,
  productionPng,
} from "../mcp/productionMediaFixtures";
import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

/** True when `fn` throws. */
const throws = (fn: () => unknown): boolean => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

/** True when `fn` throws an Error containing `message`. */
const throwsWith = (fn: () => unknown, message: string): boolean => {
  try {
    fn();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

/** The thrown value of `fn`, or `null` when it returned. */
const captureFailure = (fn: () => unknown): unknown => {
  try {
    fn();
    return null;
  } catch (error) {
    return error;
  }
};

/** Every leaf failure message, flattening aggregate cleanup wrappers. */
const messagesOf = (failure: unknown): string[] =>
  failure instanceof AggregateError
    ? failure.errors.flatMap((error) => messagesOf(error))
    : failure === null
      ? []
      : [failure instanceof Error ? failure.message : String(failure)];

interface GeneratedViewerResponse {
  body: string;
  statusCode: number;
  end: (body?: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface CaptureInstallCommandResult {
  error: { code: string; message: string } | null;
  signal: NodeJS.Signals | null;
  status: number | null;
  stderr: string;
  stdout: string;
}

type GeneratedViewerMiddleware = (
  request: { url?: string },
  response: GeneratedViewerResponse,
  next: () => void,
) => void;

/**
 * The CLI's shipped scaffold helpers enforce their filesystem and publication
 * contracts when a generated project executes them.
 *
 * The case renders and writes a real scaffold, loads its executable helper
 * modules, and drives their observable success, refusal, recovery, and cleanup
 * paths against disposable filesystem fixtures. It deliberately does not pin
 * the template's source text, syntax tree, file inventory, or documentation.
 *
 * Scenarios:
 *
 * 1. Template rendering accepts declared substitutions and refuses unknown tokens,
 *    blank names, and path-bearing project names.
 * 2. Scaffold writing materializes every rendered entry and refuses escapes,
 *    unsafe targets, identity changes, partial writes, and cleanup failures.
 * 3. Generated viewer routes serve only descriptor-bound compiled artifacts and
 *    assets whose ownership, closure, inventory, and bytes remain current.
 * 4. Proxy, runtime-package, capture-install, render-plan, dialogue-cache, and
 *    attempt publications accept their captured generation and refuse physical
 *    successors, root swaps, late inventory changes, and stale ownership.
 * 5. Render garbage collection and worker cleanup remove only the exact
 *    inventoried target, quarantine ambiguous generations, and honor the
 *    two-sided lease handshake.
 * 6. Chunk publication, resume, and final conform consume immutable declared bytes
 *    and preserve the predecessor or primary failure through recovery.
 * 7. All disposable roots and loaded helper resources are released without
 *    replacing a primary test failure.
 */
export const test_cli_scaffold = async (): Promise<void> => {
  const scaffoldDir = scaffoldAssetDirectory();
  const files = renderScaffold({ name: "demo-film" });
  TestValidator.predicate(
    "renderTemplate throws on an unknown token",
    throws(() => renderTemplate("{{nope}}", {})),
  );
  TestValidator.predicate(
    "renderTemplate substitutes a known token",
    renderTemplate("hi {{who}}", { who: "there" }) === "hi there",
  );
  TestValidator.predicate(
    "renderScaffold throws on a blank name",
    throws(() => renderScaffold({ name: "   " })),
  );
  TestValidator.equals(
    "renderScaffold refuses a path-bearing production name",
    namedFacts([
      ["climbing", () => throws(() => renderScaffold({ name: "../escape" }))],
      ["separated", () => throws(() => renderScaffold({ name: "film/name" }))],
    ]),
    { climbing: true, separated: true },
  );

  const base = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-scaffold-"));
  let scaffoldFailure: { error: unknown } | undefined;
  try {
    const target = path.join(base, "project");
    const written = writeFiles(target, files);
    TestValidator.equals(
      "every rendered file is written to disk",
      written.length,
      Object.keys(files).length,
    );
    TestValidator.predicate(
      "the written tree matches the rendered keys on disk",
      Object.keys(files).every((key) => fs.existsSync(path.join(target, key))),
    );
    const sharpWall = createRequire(__filename)(
      path.join(target, "vendor", "sharp-disabled", "index.cjs"),
    ) as () => never;
    TestValidator.predicate(
      "the local Sharp replacement fails explicitly outside the TTS surface",
      throwsWith(sharpWall, "text/audio path only"),
    );
    const generatedRoot = path.join(target, "generated", "demo-film");
    const artifact = path.join(generatedRoot, "shots", "race.json");
    fs.mkdirSync(path.dirname(artifact), { recursive: true });
    fs.writeFileSync(artifact, '{"resident":true}\n');
    const generatedModule = createRequire(__filename)(
      path.join(target, "scripts", "generatedShotPlugin.ts"),
    ) as {
      generatedShotPlugin: (
        root: string,
        productionId: string,
      ) => {
        configureServer?: (server: {
          middlewares: {
            use: (handler: GeneratedViewerMiddleware) => void;
          };
        }) => void;
      };
      readPhysicalFileSnapshot: (
        root: {
          device: string;
          inode: string;
          path: string;
          real: string;
          version: string;
        },
        directory: string,
        name: string,
      ) => { bytes: Buffer };
    };
    let middleware: GeneratedViewerMiddleware | undefined;
    generatedModule.generatedShotPlugin(target, "demo-film").configureServer?.({
      middlewares: {
        use: (handler) => {
          middleware = handler;
        },
      },
    });
    const positiveHeaders = new Map<string, string>();
    const positiveResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        positiveResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: (name, value) => {
        positiveHeaders.set(name, value);
      },
    };
    middleware?.(
      { url: "/__automovie/shots/race.json" },
      positiveResponse,
      () => undefined,
    );
    // The plugin answers 400 for every non-ENOENT read failure, so ask its own
    // exported reader directly for the message behind that status.
    const artifactSnapshotFailure = ((): string | null => {
      const real = fs.realpathSync(path.resolve(target));
      const status = fs.statSync(real, { bigint: true });
      try {
        generatedModule.readPhysicalFileSnapshot(
          {
            device: status.dev.toString(),
            inode: status.ino.toString(),
            path: path.resolve(target),
            real,
            version: [
              status.dev,
              status.ino,
              status.size,
              status.mtimeNs,
              status.ctimeNs,
            ].join(String.fromCharCode(0)),
          },
          path.dirname(artifact),
          path.basename(artifact),
        );
        return null;
      } catch (error) {
        // Name the stat fields that disagree between the pathname and the
        // descriptor, so a residual identity refusal says which one moved
        // instead of only that something did. An unreadable artifact must
        // still reach the comparison below rather than abort the test.
        const drift = ((): string[] => {
          try {
            const linked = fs.lstatSync(artifact, { bigint: true });
            const descriptor = fs.openSync(artifact, "r");
            try {
              const opened = fs.fstatSync(descriptor, { bigint: true });
              return (
                [
                  ["dev", linked.dev === opened.dev],
                  ["ino", linked.ino === opened.ino],
                  ["size", linked.size === opened.size],
                  ["mtimeNs", linked.mtimeNs === opened.mtimeNs],
                  ["ctimeNs", linked.ctimeNs === opened.ctimeNs],
                ] as const
              )
                .filter(([, agrees]) => agrees === false)
                .map(([field]) => field);
            } finally {
              fs.closeSync(descriptor);
            }
          } catch {
            return ["unreadable"];
          }
        })();
        const message = error instanceof Error ? error.message : String(error);
        return `${message} [drift: ${drift.length === 0 ? "none" : drift.join(",")}]`;
      }
    })();
    TestValidator.equals(
      "the generated viewer serves the exact resident artifact and headers",
      {
        artifactResident: fs.existsSync(artifact),
        artifactSnapshotFailure,
        body: positiveResponse.body,
        cacheControl: positiveHeaders.get("Cache-Control") ?? null,
        contentType: positiveHeaders.get("Content-Type") ?? null,
        generatedRootReal:
          fs.realpathSync(generatedRoot) === path.resolve(generatedRoot),
        installed: middleware !== undefined,
        projectRootReal: fs.realpathSync(target) === path.resolve(target),
        statusCode: positiveResponse.statusCode,
      },
      {
        artifactResident: true,
        artifactSnapshotFailure: null,
        body: JSON.stringify({ resident: true }) + String.fromCharCode(10),
        cacheControl: "no-store",
        contentType: "application/json; charset=utf-8",
        generatedRootReal: true,
        installed: true,
        projectRootReal: true,
        statusCode: 200,
      },
    );
    const mutableFs = createRequire(__filename)("node:fs") as {
      closeSync: typeof fs.closeSync;
      fstatSync: typeof fs.fstatSync;
      lstatSync: typeof fs.lstatSync;
      linkSync: typeof fs.linkSync;
      fsyncSync: typeof fs.fsyncSync;
      mkdirSync: typeof fs.mkdirSync;
      openSync: typeof fs.openSync;
      readSync: typeof fs.readSync;
      readFileSync: typeof fs.readFileSync;
      readdirSync: typeof fs.readdirSync;
      realpathSync: typeof fs.realpathSync;
      renameSync: typeof fs.renameSync;
      statSync: typeof fs.statSync;
      writeSync: typeof fs.writeSync;
      writeFileSync: typeof fs.writeFileSync;
    };
    const nativeClose = mutableFs.closeSync;
    const nativeFstat = mutableFs.fstatSync;
    const nativeFsync = mutableFs.fsyncSync;
    const nativeLstat = mutableFs.lstatSync;
    const nativeLink = mutableFs.linkSync;
    const nativeMkdir = mutableFs.mkdirSync;
    const nativeOpen = mutableFs.openSync;
    const nativeRead = mutableFs.readSync;
    const nativeReadFile = mutableFs.readFileSync;
    const nativeRename = mutableFs.renameSync;
    const nativeStat = mutableFs.statSync;
    const nativeWrite = mutableFs.writeSync;
    const nativeWriteFile = mutableFs.writeFileSync;
    const viewerRootPath = path.resolve(target);
    const viewerRootReal = fs.realpathSync(viewerRootPath);
    const viewerRootStatus = fs.statSync(viewerRootReal, { bigint: true });
    const viewerRoot = {
      device: viewerRootStatus.dev.toString(),
      inode: viewerRootStatus.ino.toString(),
      path: viewerRootPath,
      real: viewerRootReal,
      version: `${viewerRootStatus.dev}\0${viewerRootStatus.ino}\0${viewerRootStatus.size}\0${viewerRootStatus.mtimeNs}\0${viewerRootStatus.ctimeNs}`,
    };
    const standaloneViewerCloseFailure = new Error(
      "standalone viewer descriptor close failed",
    );
    let standaloneViewerDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (path.resolve(file.toString()) === artifact && flags === "r")
        standaloneViewerDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === standaloneViewerDescriptor)
        throw standaloneViewerCloseFailure;
    }) as typeof fs.closeSync;
    let standaloneViewerCloseError: unknown;
    let standaloneViewerHookFailure: { error: unknown } | undefined;
    try {
      generatedModule.readPhysicalFileSnapshot(
        viewerRoot,
        path.dirname(artifact),
        path.basename(artifact),
      );
    } catch (error) {
      standaloneViewerCloseError = error;
      standaloneViewerHookFailure = { error };
    } finally {
      preserveCliHarnessCleanup(standaloneViewerHookFailure, [
        {
          resource: "viewer standalone open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "viewer standalone close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    const primaryOnlyViewerFailure = new Error(
      "primary-only viewer read failed",
    );
    let primaryOnlyViewerDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (path.resolve(file.toString()) === artifact && flags === "r")
        primaryOnlyViewerDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (descriptor === primaryOnlyViewerDescriptor)
        throw primaryOnlyViewerFailure;
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    let preservedPrimaryOnlyViewerFailure: unknown;
    let primaryOnlyViewerHookFailure: { error: unknown } | undefined;
    try {
      generatedModule.readPhysicalFileSnapshot(
        viewerRoot,
        path.dirname(artifact),
        path.basename(artifact),
      );
    } catch (error) {
      preservedPrimaryOnlyViewerFailure = error;
      primaryOnlyViewerHookFailure = { error };
    } finally {
      preserveCliHarnessCleanup(primaryOnlyViewerHookFailure, [
        {
          resource: "viewer primary-only open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "viewer primary-only fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
      ]);
    }
    const combinedViewerPrimary = new Error("viewer descriptor read failed");
    const combinedViewerClose = new Error("viewer descriptor close failed");
    let combinedViewerDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (path.resolve(file.toString()) === artifact && flags === "r")
        combinedViewerDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (descriptor === combinedViewerDescriptor) throw combinedViewerPrimary;
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === combinedViewerDescriptor) throw combinedViewerClose;
    }) as typeof fs.closeSync;
    let combinedViewerFailure: unknown;
    let combinedViewerHookFailure: { error: unknown } | undefined;
    try {
      generatedModule.readPhysicalFileSnapshot(
        viewerRoot,
        path.dirname(artifact),
        path.basename(artifact),
      );
    } catch (error) {
      combinedViewerFailure = error;
      combinedViewerHookFailure = { error };
    } finally {
      preserveCliHarnessCleanup(combinedViewerHookFailure, [
        {
          resource: "viewer combined open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "viewer combined fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "viewer combined close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    // Name each preserved failure: six facts folded into one boolean report
    // only that something differed, and this chain first runs on a platform
    // whose descriptor behaviour is what the scenario is about.
    TestValidator.equals(
      "generated viewer preserves descriptor operation and cleanup failures",
      {
        combined:
          combinedViewerFailure instanceof AggregateError
            ? combinedViewerFailure.errors.map((error) =>
                error === combinedViewerPrimary
                  ? "primary"
                  : error === combinedViewerClose
                    ? "close"
                    : error instanceof Error
                      ? error.message
                      : String(error),
              )
            : [
                combinedViewerFailure instanceof Error
                  ? combinedViewerFailure.message
                  : String(combinedViewerFailure),
              ],
        primaryOnly:
          preservedPrimaryOnlyViewerFailure === primaryOnlyViewerFailure,
        standaloneClose:
          standaloneViewerCloseError === standaloneViewerCloseFailure,
      },
      {
        combined: ["primary", "close"],
        primaryOnly: true,
        standaloneClose: true,
      },
    );
    const shotsDirectory = path.dirname(artifact);
    const parkedShots = `${shotsDirectory}.parked`;
    const replacementShots = `${shotsDirectory}.replacement`;
    fs.mkdirSync(replacementShots);
    fs.writeFileSync(
      path.join(replacementShots, "race.json"),
      '{"ancestorReplacement":true}\n',
    );
    let ancestorSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        ancestorSwapped === false &&
        path.resolve(file.toString()) === shotsDirectory
      ) {
        fs.renameSync(shotsDirectory, parkedShots);
        fs.renameSync(replacementShots, shotsDirectory);
        ancestorSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    const ancestorResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        ancestorResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    let ancestorRaceCleanupFailure: { error: unknown } | undefined;
    try {
      middleware?.(
        { url: "/__automovie/shots/race.json" },
        ancestorResponse,
        () => undefined,
      );
    } catch (error) {
      ancestorRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(ancestorRaceCleanupFailure, [
        {
          resource: "viewer ancestor lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "viewer ancestor resident shots",
          cleanup: () => {
            if (fs.existsSync(parkedShots)) {
              fs.rmSync(shotsDirectory, { recursive: true, force: true });
              fs.renameSync(parkedShots, shotsDirectory);
            }
          },
        },
        {
          resource: "viewer ancestor replacement shots",
          cleanup: () => {
            fs.rmSync(replacementShots, { recursive: true, force: true });
          },
        },
      ]);
    }
    TestValidator.equals(
      "the generated viewer refuses an ancestry replacement during canonicalization",
      {
        body: ancestorResponse.body,
        statusCode: ancestorResponse.statusCode,
        swapped: ancestorSwapped,
      },
      {
        body: "invalid compiled viewer artifact request",
        statusCode: 400,
        swapped: true,
      },
    );
    const parkedArtifact = `${artifact}.parked`;
    let artifactSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        artifactSwapped === false &&
        path.resolve(file.toString()) === artifact
      ) {
        fs.renameSync(artifact, parkedArtifact);
        fs.writeFileSync(artifact, '{"replacement":true}\n');
        artifactSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    const viewerResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        viewerResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    let artifactRaceCleanupFailure: { error: unknown } | undefined;
    try {
      middleware?.(
        { url: "/__automovie/shots/race.json" },
        viewerResponse,
        () => undefined,
      );
    } catch (error) {
      artifactRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(artifactRaceCleanupFailure, [
        {
          resource: "viewer artifact lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "viewer resident artifact",
          cleanup: () => {
            if (fs.existsSync(parkedArtifact)) {
              fs.rmSync(artifact, { force: true });
              fs.renameSync(parkedArtifact, artifact);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "the generated viewer refuses an artifact replaced after linked identity",
      {
        body: viewerResponse.body,
        installed: middleware !== undefined,
        statusCode: viewerResponse.statusCode,
        swapped: artifactSwapped,
      },
      {
        body: "invalid compiled viewer artifact request",
        installed: true,
        statusCode: 400,
        swapped: true,
      },
    );
    const asset = path.join(target, "public", "audio", "starter-tone.json");
    const assetBytes = fs.readFileSync(asset);
    const assetDigest =
      "sha256:f7c7178b601f4b029ba3c56ab05f2bb5ab57f9d0da21fa35cd9292656c2c48aa";
    const model = path.join(generatedRoot, "models", "asset-closure.json");
    fs.mkdirSync(path.dirname(model), { recursive: true });
    fs.writeFileSync(
      model,
      `${JSON.stringify({
        imported: {
          assets: [
            {
              path: "public/audio/starter-tone.json",
              digest: assetDigest,
            },
          ],
        },
      })}\n`,
    );
    const positiveAssetResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        positiveAssetResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    middleware?.(
      { url: "/__automovie/assets/public/audio/starter-tone.json" },
      positiveAssetResponse,
      () => undefined,
    );
    TestValidator.equals(
      "the generated viewer serves one ledger-and-closure-bound asset",
      namedFacts([
        ["status", () => positiveAssetResponse.statusCode === 200],
        [
          "body",
          () => positiveAssetResponse.body === assetBytes.toString("utf8"),
        ],
      ]),
      { status: true, body: true },
    );
    const requestRegisteredAsset = (): GeneratedViewerResponse => {
      const response: GeneratedViewerResponse = {
        body: "",
        statusCode: 0,
        end: (body) => {
          response.body = Buffer.isBuffer(body)
            ? body.toString("utf8")
            : String(body ?? "");
        },
        setHeader: () => undefined,
      };
      middleware?.(
        { url: "/__automovie/assets/public/audio/starter-tone.json" },
        response,
        () => undefined,
      );
      return response;
    };
    const ledger = path.join(target, ".automovie", "assets.json");
    const ledgerBytes = fs.readFileSync(ledger);
    const parkedLedger = `${ledger}.parked`;
    let ledgerSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (ledgerSwapped === false && path.resolve(file.toString()) === ledger) {
        fs.renameSync(ledger, parkedLedger);
        fs.writeFileSync(ledger, ledgerBytes);
        ledgerSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let ledgerResponse: GeneratedViewerResponse;
    let ledgerRaceCleanupFailure: { error: unknown } | undefined;
    try {
      ledgerResponse = requestRegisteredAsset();
    } catch (error) {
      ledgerRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(ledgerRaceCleanupFailure, [
        {
          resource: "viewer ledger lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "viewer resident asset ledger",
          cleanup: () => {
            if (fs.existsSync(parkedLedger)) {
              fs.rmSync(ledger, { force: true });
              fs.renameSync(parkedLedger, ledger);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "the generated viewer refuses a byte-identical asset ledger successor",
      {
        body: ledgerResponse.body,
        statusCode: ledgerResponse.statusCode,
        swapped: ledgerSwapped,
      },
      {
        body: "invalid registered asset request",
        statusCode: 400,
        swapped: true,
      },
    );
    const modelBytes = fs.readFileSync(model);
    const parkedModel = `${model}.parked`;
    let modelSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (modelSwapped === false && path.resolve(file.toString()) === model) {
        fs.renameSync(model, parkedModel);
        fs.writeFileSync(model, modelBytes);
        modelSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let modelResponse: GeneratedViewerResponse;
    let modelRaceCleanupFailure: { error: unknown } | undefined;
    try {
      modelResponse = requestRegisteredAsset();
    } catch (error) {
      modelRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(modelRaceCleanupFailure, [
        {
          resource: "viewer model lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "viewer resident compiled model",
          cleanup: () => {
            if (fs.existsSync(parkedModel)) {
              fs.rmSync(model, { force: true });
              fs.renameSync(parkedModel, model);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "the generated viewer refuses a byte-identical compiled model successor",
      {
        body: modelResponse.body,
        statusCode: modelResponse.statusCode,
        swapped: modelSwapped,
      },
      {
        body: "invalid registered asset request",
        statusCode: 400,
        swapped: true,
      },
    );
    const modelsDirectory = path.dirname(model);
    const extraModel = path.join(modelsDirectory, "late-inventory.json");
    const nativeReaddir = mutableFs.readdirSync;
    let inventoryMutated = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        inventoryMutated === false &&
        path.resolve(directory.toString()) === modelsDirectory
      ) {
        fs.writeFileSync(extraModel, '{"imported":{"assets":[]}}\n');
        inventoryMutated = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    let inventoryResponse: GeneratedViewerResponse;
    let inventoryRaceCleanupFailure: { error: unknown } | undefined;
    try {
      inventoryResponse = requestRegisteredAsset();
    } catch (error) {
      inventoryRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(inventoryRaceCleanupFailure, [
        {
          resource: "viewer inventory readdir hook",
          cleanup: () => {
            mutableFs.readdirSync = nativeReaddir;
          },
        },
        {
          resource: "viewer extra compiled model",
          cleanup: () => {
            fs.rmSync(extraModel, { force: true });
          },
        },
      ]);
    }
    TestValidator.equals(
      "the generated viewer refuses compiled model inventory mutation",
      {
        body: inventoryResponse.body,
        mutated: inventoryMutated,
        statusCode: inventoryResponse.statusCode,
      },
      {
        body: "invalid registered asset request",
        mutated: true,
        statusCode: 400,
      },
    );
    const parkedAsset = `${asset}.parked`;
    let assetSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (assetSwapped === false && path.resolve(file.toString()) === asset) {
        fs.renameSync(asset, parkedAsset);
        fs.writeFileSync(asset, assetBytes);
        assetSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    const assetResponse: GeneratedViewerResponse = {
      body: "",
      statusCode: 0,
      end: (body) => {
        assetResponse.body = Buffer.isBuffer(body)
          ? body.toString("utf8")
          : String(body ?? "");
      },
      setHeader: () => undefined,
    };
    let assetRaceCleanupFailure: { error: unknown } | undefined;
    try {
      middleware?.(
        { url: "/__automovie/assets/public/audio/starter-tone.json" },
        assetResponse,
        () => undefined,
      );
    } catch (error) {
      assetRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(assetRaceCleanupFailure, [
        {
          resource: "viewer asset lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "viewer resident registered asset",
          cleanup: () => {
            if (fs.existsSync(parkedAsset)) {
              fs.rmSync(asset, { force: true });
              fs.renameSync(parkedAsset, asset);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "the generated viewer refuses a byte-identical registered asset successor",
      {
        body: assetResponse.body,
        statusCode: assetResponse.statusCode,
        swapped: assetSwapped,
      },
      {
        body: "invalid registered asset request",
        statusCode: 400,
        swapped: true,
      },
    );
    const proxy = path.join(base, "proxy-publication");
    const proxyFiles = new Map<string, Uint8Array>([
      ["manifest.json", Buffer.from('{"proxy":true}\n')],
      ["media/proxy.mp4", Buffer.from("proxy bytes")],
    ]);
    for (const [relative, bytes] of proxyFiles) {
      const file = path.join(proxy, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    const proxyModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "assertProxyBundle.ts"),
    ) as {
      assertPublishedProxyBundle: (
        directory: string,
        expected: ReadonlyMap<string, Uint8Array>,
      ) => void;
      inspectPublishedProxyBundle: (
        renderRoot: string,
        directory: string,
      ) => {
        compileFingerprint: string;
        editFingerprint: string;
        publicationFingerprint: string;
        tier: { kind: string };
      };
      inspectCapturedProxyBundle: (
        snapshot: unknown,
        evidence: unknown,
      ) => {
        compileFingerprint: string;
        editFingerprint: string;
        publicationFingerprint: string;
      };
    };
    const proxyPublisherModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "publishProxyBundle.ts"),
    ) as {
      captureProxyPublicationGcTarget: <Value>(props: {
        judge: (
          snapshot: {
            entries: Array<{ kind: string; path: string }>;
            kind: string;
            target: string;
            targetIdentity: string;
          },
          evidence: unknown,
        ) => Value;
        renderRoot: string;
        target: string;
      }) => {
        snapshot: {
          entries: Array<{ kind: string; path: string }>;
          kind: string;
          target: string;
          targetIdentity: string;
        };
        value: Value;
      };
      publishProxyBundle: (props: {
        expected: ReadonlyMap<string, Uint8Array>;
        parent: string;
        processAlive: (pid: number) => boolean;
        renderRoot: string;
        target: string;
      }) => { reused: boolean };
    };
    TestValidator.predicate(
      "an exact physical proxy bundle passes immutable verification",
      !throws(() => proxyModule.assertPublishedProxyBundle(proxy, proxyFiles)),
    );
    const proxyPublishRoot = path.join(base, "proxy-publisher");
    const proxyPublishParent = path.join(
      proxyPublishRoot,
      "deliverables",
      "proxy",
    );
    fs.mkdirSync(proxyPublishParent, { recursive: true });
    const proxyPublishFiles = new Map<string, Uint8Array>([
      ["publication.json", Buffer.from('{"publication":true}\n')],
      ["feature/feature.mp4", Buffer.from("published proxy bytes")],
    ]);
    const writeProxyPublishFixture = (target: string): void => {
      for (const [relative, bytes] of proxyPublishFiles) {
        const file = path.join(target, ...relative.split("/"));
        Reflect.apply(nativeMkdir, mutableFs, [
          path.dirname(file),
          {
            recursive: true,
          },
        ]);
        fs.writeFileSync(file, bytes);
      }
    };
    const proxyPublishTarget = path.join(proxyPublishParent, "normal");
    const firstProxyPublication = proxyPublisherModule.publishProxyBundle({
      expected: proxyPublishFiles,
      parent: proxyPublishParent,
      processAlive: () => false,
      renderRoot: proxyPublishRoot,
      target: proxyPublishTarget,
    });
    const reusedProxyPublication = proxyPublisherModule.publishProxyBundle({
      expected: proxyPublishFiles,
      parent: proxyPublishParent,
      processAlive: () => false,
      renderRoot: proxyPublishRoot,
      target: proxyPublishTarget,
    });
    TestValidator.equals(
      "proxy publisher reserves a new target and independently verifies reuse",
      namedFacts([
        [
          "firstProxyPublicationReused",
          () => firstProxyPublication.reused === false,
        ],
        ["reusedProxyPublicationReused", () => reusedProxyPublication.reused],
        [
          "proxyPublishParentName",
          () =>
            fs
              .readdirSync(proxyPublishParent)
              .every((name) => name.endsWith(".candidate") === false),
        ],
        [
          "rejected",
          () =>
            !throws(() =>
              proxyModule.assertPublishedProxyBundle(
                proxyPublishTarget,
                proxyPublishFiles,
              ),
            ),
        ],
      ]),
      {
        firstProxyPublicationReused: true,
        reusedProxyPublicationReused: true,
        proxyPublishParentName: true,
        rejected: true,
      },
    );

    const gcRaceTarget = path.join(proxyPublishParent, "gc-race");
    const gcRaceParked = `${gcRaceTarget}.parked`;
    const gcRaceSuccessor = `${gcRaceTarget}.successor`;
    fs.mkdirSync(gcRaceTarget);
    fs.writeFileSync(path.join(gcRaceTarget, "invalid.bin"), "invalid");
    writeProxyPublishFixture(gcRaceSuccessor);
    let gcRaceSwapped = false;
    const gcRaceRejected = throws(() =>
      proxyPublisherModule.captureProxyPublicationGcTarget({
        renderRoot: proxyPublishRoot,
        target: gcRaceTarget,
        judge: () => {
          nativeRename(gcRaceTarget, gcRaceParked);
          nativeRename(gcRaceSuccessor, gcRaceTarget);
          gcRaceSwapped = true;
          return false;
        },
      }),
    );
    const invalidGcRoot = proxyPublisherModule.captureProxyPublicationGcTarget({
      renderRoot: proxyPublishRoot,
      target: gcRaceParked,
      judge: () => false,
    });
    TestValidator.equals(
      "proxy GC never turns an invalid judgment into an exact-successor removal snapshot",
      namedFacts([
        ["gcRaceSwapped", () => gcRaceSwapped],
        ["gcRaceRejected", () => gcRaceRejected],
        [
          "rejected",
          () =>
            !throws(() =>
              proxyModule.assertPublishedProxyBundle(
                gcRaceTarget,
                proxyPublishFiles,
              ),
            ),
        ],
        ["invalidGcRoot", () => invalidGcRoot.value === false],
        [
          "invalidGcRootSnapshot",
          () => invalidGcRoot.snapshot.kind === "directory",
        ],
        [
          "invalidGcRootSnapshot2",
          () => invalidGcRoot.snapshot.target === gcRaceParked,
        ],
      ]),
      {
        gcRaceSwapped: true,
        gcRaceRejected: true,
        rejected: true,
        invalidGcRoot: true,
        invalidGcRootSnapshot: true,
        invalidGcRootSnapshot2: true,
      },
    );
    fs.rmSync(gcRaceTarget, { recursive: true, force: true });
    fs.rmSync(gcRaceParked, { recursive: true, force: true });

    const gcAbaTarget = path.join(proxyPublishParent, "gc-aba");
    const gcAbaParked = `${gcAbaTarget}.parked`;
    const gcAbaSuccessor = `${gcAbaTarget}.successor`;
    writeProxyPublishFixture(gcAbaTarget);
    fs.mkdirSync(gcAbaSuccessor);
    fs.writeFileSync(path.join(gcAbaSuccessor, "invalid.bin"), "invalid");
    const gcAbaStatus = fs.lstatSync(gcAbaTarget, { bigint: true });
    const gcAbaIdentity = `${gcAbaStatus.dev}\0${gcAbaStatus.ino}`;
    let gcAba:
      | {
          snapshot: { targetIdentity: string };
          value: boolean;
        }
      | undefined;
    let gcAbaRejected = false;
    try {
      gcAba = proxyPublisherModule.captureProxyPublicationGcTarget({
        renderRoot: proxyPublishRoot,
        target: gcAbaTarget,
        judge: (snapshot) => {
          nativeRename(gcAbaTarget, gcAbaParked);
          nativeRename(gcAbaSuccessor, gcAbaTarget);
          const value =
            snapshot.targetIdentity === gcAbaIdentity &&
            snapshot.entries.some(
              (entry) =>
                entry.kind === "file" && entry.path === "publication.json",
            );
          nativeRename(gcAbaTarget, gcAbaSuccessor);
          nativeRename(gcAbaParked, gcAbaTarget);
          return value;
        },
      });
    } catch {
      gcAbaRejected = true;
    }
    TestValidator.equals(
      "proxy GC derives an ABA judgment from the captured generation",
      namedFacts([
        [
          "gcAbaRejectedGcAba",
          () =>
            gcAbaRejected ||
            (gcAba?.value === true &&
              gcAba.snapshot.targetIdentity === gcAbaIdentity),
        ],
        [
          "constStatus",
          () =>
            (() => {
              const status = fs.lstatSync(gcAbaTarget, { bigint: true });
              return `${status.dev}\0${status.ino}` === gcAbaIdentity;
            })(),
        ],
        [
          "gcAbaSuccessorInvalid",
          () =>
            fs.readFileSync(
              path.join(gcAbaSuccessor, "invalid.bin"),
              "utf8",
            ) === "invalid",
        ],
      ]),
      {
        gcAbaRejectedGcAba: true,
        constStatus: true,
        gcAbaSuccessorInvalid: true,
      },
    );
    fs.rmSync(gcAbaTarget, { recursive: true, force: true });
    fs.rmSync(gcAbaSuccessor, { recursive: true, force: true });

    const emptySuccessorTarget = path.join(
      proxyPublishParent,
      "empty-successor",
    );
    let emptySuccessorInserted = false;
    let emptySuccessorIdentity = "";
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        emptySuccessorInserted === false &&
        path.resolve(directory.toString()) === emptySuccessorTarget
      ) {
        nativeMkdir(emptySuccessorTarget);
        emptySuccessorInserted = true;
        const status = fs.lstatSync(emptySuccessorTarget, { bigint: true });
        emptySuccessorIdentity = `${status.dev}\0${status.ino}`;
        const error = new Error(
          "fixture destination exists",
        ) as NodeJS.ErrnoException;
        error.code = "EEXIST";
        throw error;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let emptySuccessorCompleted = false;
    let emptySuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      proxyPublisherModule.publishProxyBundle({
        expected: proxyPublishFiles,
        parent: proxyPublishParent,
        processAlive: () => false,
        renderRoot: proxyPublishRoot,
        target: emptySuccessorTarget,
      });
      emptySuccessorCompleted = true;
    } catch (error) {
      emptySuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(emptySuccessorCleanupFailure, [
        {
          resource: "proxy empty successor mkdir hook",
          cleanup: () => {
            mutableFs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy publisher monotonically completes an empty destination competitor",
      namedFacts([
        ["emptySuccessorInserted", () => emptySuccessorInserted],
        ["emptySuccessorCompleted", () => emptySuccessorCompleted],
        [
          "constStatus",
          () =>
            (() => {
              const status = fs.lstatSync(emptySuccessorTarget, {
                bigint: true,
              });
              return `${status.dev}\0${status.ino}` === emptySuccessorIdentity;
            })(),
        ],
        [
          "rejected",
          () =>
            !throws(() =>
              proxyModule.assertPublishedProxyBundle(
                emptySuccessorTarget,
                proxyPublishFiles,
              ),
            ),
        ],
      ]),
      {
        emptySuccessorInserted: true,
        emptySuccessorCompleted: true,
        constStatus: true,
        rejected: true,
      },
    );

    const exactSuccessorTarget = path.join(
      proxyPublishParent,
      "exact-successor",
    );
    let exactSuccessorInserted = false;
    let exactSuccessorIdentity = "";
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        exactSuccessorInserted === false &&
        path.resolve(directory.toString()) === exactSuccessorTarget
      ) {
        writeProxyPublishFixture(exactSuccessorTarget);
        exactSuccessorInserted = true;
        const status = fs.lstatSync(exactSuccessorTarget, { bigint: true });
        exactSuccessorIdentity = `${status.dev}\0${status.ino}`;
        const error = new Error(
          "fixture destination exists",
        ) as NodeJS.ErrnoException;
        error.code = "EEXIST";
        throw error;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let exactSuccessorAccepted = false;
    let exactSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      proxyPublisherModule.publishProxyBundle({
        expected: proxyPublishFiles,
        parent: proxyPublishParent,
        processAlive: () => false,
        renderRoot: proxyPublishRoot,
        target: exactSuccessorTarget,
      });
      exactSuccessorAccepted = true;
    } catch (error) {
      exactSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(exactSuccessorCleanupFailure, [
        {
          resource: "proxy exact successor mkdir hook",
          cleanup: () => {
            mutableFs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy publisher verifies an exact directory competitor without replacing it",
      namedFacts([
        ["exactSuccessorInserted", () => exactSuccessorInserted],
        ["exactSuccessorAccepted", () => exactSuccessorAccepted],
        [
          "constStatus",
          () =>
            (() => {
              const status = fs.lstatSync(exactSuccessorTarget, {
                bigint: true,
              });
              return `${status.dev}\0${status.ino}` === exactSuccessorIdentity;
            })(),
        ],
        [
          "rejected",
          () =>
            !throws(() =>
              proxyModule.assertPublishedProxyBundle(
                exactSuccessorTarget,
                proxyPublishFiles,
              ),
            ),
        ],
      ]),
      {
        exactSuccessorInserted: true,
        exactSuccessorAccepted: true,
        constStatus: true,
        rejected: true,
      },
    );

    const parentSwapTarget = path.join(proxyPublishParent, "parent-swap");
    const parkedProxyPublishParent = `${proxyPublishParent}.parked`;
    // Replace the parent when the publisher closes the file it just created
    // inside the target, not while that descriptor is still open: Windows
    // refuses to rename a directory that holds an open handle, and the
    // scenario is about a successor parent appearing during publication. One
    // holder carries both states, because this test's static contracts pin the
    // top-level statement indices around it.
    let proxyParentSwap: number | "swapped" | null = null;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        proxyParentSwap === null &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path
          .resolve(file.toString())
          .startsWith(`${path.resolve(parentSwapTarget)}${path.sep}`)
      ) {
        proxyParentSwap = descriptor;
        mutableFs.closeSync = ((closing: number): void => {
          Reflect.apply(nativeClose, mutableFs, [closing]);
          if (proxyParentSwap === closing) {
            proxyParentSwap = "swapped";
            nativeRename(proxyPublishParent, parkedProxyPublishParent);
            nativeMkdir(proxyPublishParent, { recursive: true });
          }
        }) as typeof fs.closeSync;
      }
      return descriptor;
    }) as typeof fs.openSync;
    let proxyParentSwapRejected = false;
    let proxyParentSwapCleanupFailure: { error: unknown } | undefined;
    try {
      proxyParentSwapRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: parentSwapTarget,
        }),
      );
    } catch (error) {
      proxyParentSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(proxyParentSwapCleanupFailure, [
        {
          resource: "proxy parent swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "proxy parent swap close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy publisher rejects and preserves a physical parent successor",
      {
        parkedParentResident: fs.existsSync(parkedProxyPublishParent),
        rejected: proxyParentSwapRejected,
        successorParentResident: fs.existsSync(proxyPublishParent),
        swapped: proxyParentSwap === "swapped",
      },
      {
        parkedParentResident: true,
        rejected: true,
        successorParentResident: true,
        swapped: true,
      },
    );
    fs.rmSync(proxyPublishParent, { recursive: true, force: true });
    nativeRename(parkedProxyPublishParent, proxyPublishParent);

    const rootSwapTarget = path.join(proxyPublishParent, "root-swap");
    const parkedProxyPublishRoot = `${proxyPublishRoot}.parked`;
    // Same rename boundary as the parent successor above: replace the render
    // root when the publisher closes the file it created inside the target.
    let proxyRootSwap: number | "swapped" | null = null;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        proxyRootSwap === null &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path
          .resolve(file.toString())
          .startsWith(`${path.resolve(rootSwapTarget)}${path.sep}`)
      ) {
        proxyRootSwap = descriptor;
        mutableFs.closeSync = ((closing: number): void => {
          Reflect.apply(nativeClose, mutableFs, [closing]);
          if (proxyRootSwap === closing) {
            proxyRootSwap = "swapped";
            nativeRename(proxyPublishRoot, parkedProxyPublishRoot);
            nativeMkdir(proxyPublishParent, { recursive: true });
          }
        }) as typeof fs.closeSync;
      }
      return descriptor;
    }) as typeof fs.openSync;
    let proxyRootSwapRejected = false;
    let proxyRootSwapCleanupFailure: { error: unknown } | undefined;
    try {
      proxyRootSwapRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: rootSwapTarget,
        }),
      );
    } catch (error) {
      proxyRootSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(proxyRootSwapCleanupFailure, [
        {
          resource: "proxy root swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "proxy root swap close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy publisher rejects and preserves a physical render-root successor",
      {
        parkedRootResident: fs.existsSync(parkedProxyPublishRoot),
        rejected: proxyRootSwapRejected,
        successorRootResident: fs.existsSync(proxyPublishRoot),
        swapped: proxyRootSwap === "swapped",
      },
      {
        parkedRootResident: true,
        rejected: true,
        successorRootResident: true,
        swapped: true,
      },
    );
    fs.rmSync(proxyPublishRoot, { recursive: true, force: true });
    nativeRename(parkedProxyPublishRoot, proxyPublishRoot);

    const partialSuccessorTarget = path.join(
      proxyPublishParent,
      "partial-file-successor",
    );
    const partialSuccessorFile = path.join(
      partialSuccessorTarget,
      "feature",
      "feature.mp4",
    );
    const partialSuccessorBytes = Buffer.from("foreign partial file");
    let partialSuccessorInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        partialSuccessorInserted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === partialSuccessorFile &&
        flags === "wx+"
      ) {
        nativeWriteFile(partialSuccessorFile, partialSuccessorBytes);
        partialSuccessorInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let partialSuccessorRejected = false;
    let partialSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      partialSuccessorRejected = throws(() =>
        proxyPublisherModule.publishProxyBundle({
          expected: proxyPublishFiles,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target: partialSuccessorTarget,
        }),
      );
    } catch (error) {
      partialSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(partialSuccessorCleanupFailure, [
        {
          resource: "proxy partial successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy publisher preserves a partial file appearing at commit",
      {
        inserted: partialSuccessorInserted,
        rejected: partialSuccessorRejected,
        residentBytes: fs
          .readFileSync(partialSuccessorFile)
          .equals(partialSuccessorBytes),
      },
      {
        inserted: true,
        rejected: true,
        residentBytes: true,
      },
    );
    fs.rmSync(partialSuccessorTarget, { recursive: true, force: true });

    const proxyFixtureDigest = (bytes: Uint8Array): string =>
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const gcAbaPublication = `sha256:${"a".repeat(64)}`;
    const gcAbaCompile = `sha256:${"b".repeat(64)}`;
    const gcAbaEdit = `sha256:${"c".repeat(64)}`;
    const gcAbaPayload = Buffer.from("captured proxy payload");
    const gcAbaProductionTarget = path.join(
      proxyPublishParent,
      gcAbaPublication.slice(7),
    );
    const gcAbaProductionParked = `${gcAbaProductionTarget}.parked`;
    const gcAbaProductionSuccessor = `${gcAbaProductionTarget}.successor`;
    const gcAbaProductionFiles = new Map<string, Uint8Array>([
      [
        "publication.json",
        Buffer.from(
          `${JSON.stringify({
            version: 1,
            tier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
            publicationFingerprint: gcAbaPublication,
            compileFingerprint: gcAbaCompile,
            editFingerprint: gcAbaEdit,
            frameFormat: { width: 640, height: 360, fps: 24 },
            sourceFrameFormat: { width: 1280, height: 720, fps: 24 },
            totalFrames: 24,
            manifest: {
              version: 1,
              compileFingerprint: gcAbaCompile,
              deliverables: [
                {
                  id: "feature",
                  kind: "feature",
                  files: [
                    {
                      path: `deliverables/proxy/${gcAbaPublication.slice(7)}/feature/feature.mp4`,
                      digest: proxyFixtureDigest(gcAbaPayload),
                      bytes: gcAbaPayload.length,
                      mediaType: "video/mp4",
                    },
                  ],
                  runtimeSeconds: 1,
                  frameCount: 24,
                  codec: "fixture",
                },
              ],
            },
          })}\n`,
        ),
      ],
      ["feature/feature.mp4", gcAbaPayload],
    ]);
    for (const [relative, bytes] of gcAbaProductionFiles) {
      const file = path.join(gcAbaProductionTarget, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    fs.mkdirSync(gcAbaProductionSuccessor);
    fs.writeFileSync(
      path.join(gcAbaProductionSuccessor, "invalid.bin"),
      "invalid directory",
    );
    // The judge adjudicates from the captured snapshot while the live target is
    // swapped, so its verdict is recorded separately: restoring the resident
    // directory by rename moves its `ctime`, which the target version covers, so
    // the collector must refuse to act on evidence it can no longer prove.
    // Record the judge's own outcome: neither a folded verdict nor a thrown
    // failure alone can say which fingerprint the captured evidence carried.
    let gcAbaJudgment: unknown = null;
    // The judge never ran on the previous head, so the collector's own outcome
    // is what has to be named: a message when it refuses, or "collected" when
    // it returns without ever adjudicating.
    const gcAbaProductionRefused = ((): unknown => {
      try {
        return ((): "collected" => {
          proxyPublisherModule.captureProxyPublicationGcTarget({
            renderRoot: proxyPublishRoot,
            target: gcAbaProductionTarget,
            judge: (snapshot, evidence) => {
              nativeRename(gcAbaProductionTarget, gcAbaProductionParked);
              nativeRename(gcAbaProductionSuccessor, gcAbaProductionTarget);
              let gcAbaJudgeCleanupFailure: { error: unknown } | undefined;
              try {
                const receipt = proxyModule.inspectCapturedProxyBundle(
                  snapshot,
                  evidence,
                );
                gcAbaJudgment = {
                  compile: receipt.compileFingerprint,
                  edit: receipt.editFingerprint,
                  publication: receipt.publicationFingerprint,
                };
                return (
                  receipt.publicationFingerprint === gcAbaPublication &&
                  receipt.compileFingerprint === gcAbaCompile &&
                  receipt.editFingerprint === gcAbaEdit
                );
              } catch (error) {
                gcAbaJudgeCleanupFailure = { error };
                gcAbaJudgment =
                  error instanceof Error ? error.message : String(error);
                return false;
              } finally {
                preserveCliHarnessCleanup(gcAbaJudgeCleanupFailure, [
                  {
                    resource: "proxy GC ABA successor target",
                    cleanup: () => {
                      nativeRename(
                        gcAbaProductionTarget,
                        gcAbaProductionSuccessor,
                      );
                    },
                  },
                  {
                    resource: "proxy GC ABA resident target",
                    cleanup: () => {
                      nativeRename(
                        gcAbaProductionParked,
                        gcAbaProductionTarget,
                      );
                    },
                  },
                ]);
              }
            },
          });
          return "collected";
        })();
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    })();
    TestValidator.equals(
      "proxy GC production adjudication derives ABA status from captured evidence",
      {
        judgment: gcAbaJudgment,
        outcome:
          typeof gcAbaProductionRefused === "string" &&
          gcAbaProductionRefused.includes("changed after inventory")
            ? "changed after inventory"
            : gcAbaProductionRefused,
        residentPublished: !throws(() =>
          proxyModule.inspectPublishedProxyBundle(
            proxyPublishRoot,
            gcAbaProductionTarget,
          ),
        ),
        successorIntact:
          fs.readFileSync(
            path.join(gcAbaProductionSuccessor, "invalid.bin"),
            "utf8",
          ) === "invalid directory",
      },
      {
        judgment: {
          compile: gcAbaCompile,
          edit: gcAbaEdit,
          publication: gcAbaPublication,
        },
        outcome: "changed after inventory",
        residentPublished: true,
        successorIntact: true,
      },
    );
    fs.rmSync(gcAbaProductionTarget, { recursive: true, force: true });
    fs.rmSync(gcAbaProductionSuccessor, { recursive: true, force: true });

    const publishScaleFixture = (
      name: string,
      count: number,
    ): { observations: number; readBytes: number } => {
      const target = path.join(proxyPublishParent, name);
      const entries = new Map<string, Uint8Array>([
        ["publication.json", Buffer.from(`{"count":${count}}\n`)],
        ...Array.from(
          { length: count },
          (_, index) =>
            [
              `frames/${String(index).padStart(4, "0")}.png`,
              Buffer.alloc(1024, index),
            ] as const,
        ),
      ]);
      let observations = 0;
      let readBytes = 0;
      mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
        if (
          path
            .resolve(file.toString())
            .startsWith(`${path.resolve(proxyPublishParent)}${path.sep}`)
        )
          observations++;
        return Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      }) as typeof fs.lstatSync;
      mutableFs.readSync = ((...args: unknown[]): number => {
        const length = Reflect.apply(nativeRead, mutableFs, args) as number;
        readBytes += length;
        return length;
      }) as typeof fs.readSync;
      let scaleCleanupFailure: { error: unknown } | undefined;
      try {
        proxyPublisherModule.publishProxyBundle({
          expected: entries,
          parent: proxyPublishParent,
          processAlive: () => false,
          renderRoot: proxyPublishRoot,
          target,
        });
      } catch (error) {
        scaleCleanupFailure = { error };
        throw error;
      } finally {
        preserveCliHarnessCleanup(scaleCleanupFailure, [
          {
            resource: "proxy scale lstat hook",
            cleanup: () => {
              mutableFs.lstatSync = nativeLstat;
            },
          },
          {
            resource: "proxy scale read hook",
            cleanup: () => {
              mutableFs.readSync = nativeRead;
            },
          },
        ]);
      }
      return {
        observations,
        readBytes,
      };
    };
    const smallProxyPublicationWork = publishScaleFixture("scale-8", 8);
    const largeProxyPublicationWork = publishScaleFixture("scale-32", 32);
    TestValidator.equals(
      "proxy publication inventory work scales linearly with bundle entries",
      namedFacts([
        [
          "observations",
          () =>
            largeProxyPublicationWork.observations <=
            smallProxyPublicationWork.observations * 6,
        ],
        [
          "readBytes",
          () =>
            largeProxyPublicationWork.readBytes <=
            smallProxyPublicationWork.readBytes * 6,
        ],
      ]),
      { observations: true, readBytes: true },
    );
    const volumeProxyTarget = path.join(proxyPublishParent, "scale-volume");
    const volumeProxyBytes = Buffer.alloc(32 * 1024 * 1024, 0x5a);
    proxyPublisherModule.publishProxyBundle({
      expected: new Map<string, Uint8Array>([
        ["publication.json", Buffer.from('{"volume":true}\n')],
        ["feature/feature.mp4", volumeProxyBytes],
      ]),
      parent: proxyPublishParent,
      processAlive: () => false,
      renderRoot: proxyPublishRoot,
      target: volumeProxyTarget,
    });
    const volumeProxyFile = path.join(
      volumeProxyTarget,
      "feature",
      "feature.mp4",
    );
    TestValidator.equals(
      "proxy publication keeps large media materialized as a regular file",
      {
        bundleIsDirectory: fs.lstatSync(volumeProxyTarget).isDirectory(),
        mediaIsFile: fs.lstatSync(volumeProxyFile).isFile(),
        mediaSize: fs.statSync(volumeProxyFile).size,
      },
      {
        bundleIsDirectory: true,
        mediaIsFile: true,
        mediaSize: volumeProxyBytes.length,
      },
    );
    const proxyMedia = path.join(proxy, "media", "proxy.mp4");
    const parkedProxyMedia = `${proxyMedia}.parked`;
    let proxyMediaSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        proxyMediaSwapped === false &&
        path.resolve(file.toString()) === proxyMedia
      ) {
        fs.renameSync(proxyMedia, parkedProxyMedia);
        fs.writeFileSync(proxyMedia, proxyFiles.get("media/proxy.mp4")!);
        proxyMediaSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let proxyRaceRejected = false;
    let proxyMediaCleanupFailure: { error: unknown } | undefined;
    try {
      proxyRaceRejected = throws(() =>
        proxyModule.assertPublishedProxyBundle(proxy, proxyFiles),
      );
    } catch (error) {
      proxyMediaCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(proxyMediaCleanupFailure, [
        {
          resource: "proxy media lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "proxy resident media",
          cleanup: () => {
            if (fs.existsSync(parkedProxyMedia)) {
              fs.rmSync(proxyMedia, { force: true });
              fs.renameSync(parkedProxyMedia, proxyMedia);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy verification rejects a byte-identical successor after inventory",
      namedFacts([
        ["swapped", () => proxyMediaSwapped],
        ["rejected", () => proxyRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const proxyMediaDirectory = path.dirname(proxyMedia);
    const parkedProxyMediaDirectory = path.join(
      base,
      "proxy-media-directory-parked",
    );
    const successorProxyMediaDirectory = path.join(
      base,
      "proxy-media-directory-successor",
    );
    fs.mkdirSync(successorProxyMediaDirectory);
    fs.linkSync(
      proxyMedia,
      path.join(successorProxyMediaDirectory, path.basename(proxyMedia)),
    );
    let proxyMediaObservations = 0;
    let proxyDirectorySwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (path.resolve(file.toString()) === proxyMedia) {
        proxyMediaObservations++;
        if (proxyMediaObservations === 2) {
          fs.renameSync(proxyMediaDirectory, parkedProxyMediaDirectory);
          fs.renameSync(successorProxyMediaDirectory, proxyMediaDirectory);
          proxyDirectorySwapped = true;
        }
      }
      return status;
    }) as typeof fs.lstatSync;
    let proxyDirectoryRaceRejected = false;
    let proxyDirectoryCleanupFailure: { error: unknown } | undefined;
    try {
      proxyDirectoryRaceRejected = throws(() =>
        proxyModule.assertPublishedProxyBundle(proxy, proxyFiles),
      );
    } catch (error) {
      proxyDirectoryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(proxyDirectoryCleanupFailure, [
        {
          resource: "proxy directory lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "proxy resident media directory",
          cleanup: () => {
            if (fs.existsSync(parkedProxyMediaDirectory)) {
              fs.rmSync(proxyMediaDirectory, {
                recursive: true,
                force: true,
              });
              fs.renameSync(parkedProxyMediaDirectory, proxyMediaDirectory);
            }
          },
        },
        {
          resource: "proxy successor media directory",
          cleanup: () => {
            fs.rmSync(successorProxyMediaDirectory, {
              recursive: true,
              force: true,
            });
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy verification rejects a hard-linked directory successor",
      namedFacts([
        ["swapped", () => proxyDirectorySwapped],
        ["rejected", () => proxyDirectoryRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const lateProxyFile = path.join(proxyMediaDirectory, "late.bin");
    proxyMediaObservations = 0;
    let proxyInventoryMutated = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (path.resolve(file.toString()) === proxyMedia) {
        proxyMediaObservations++;
        if (proxyMediaObservations === 2) {
          fs.writeFileSync(lateProxyFile, "late inventory");
          proxyInventoryMutated = true;
        }
      }
      return status;
    }) as typeof fs.lstatSync;
    let proxyInventoryRaceRejected = false;
    let proxyInventoryCleanupFailure: { error: unknown } | undefined;
    try {
      proxyInventoryRaceRejected = throws(() =>
        proxyModule.assertPublishedProxyBundle(proxy, proxyFiles),
      );
    } catch (error) {
      proxyInventoryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(proxyInventoryCleanupFailure, [
        {
          resource: "proxy inventory lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "proxy late inventory file",
          cleanup: () => {
            fs.rmSync(lateProxyFile, { force: true });
          },
        },
      ]);
    }
    TestValidator.equals(
      "proxy verification rejects a late unexpected inventory entry",
      namedFacts([
        ["mutated", () => proxyInventoryMutated],
        ["rejected", () => proxyInventoryRaceRejected],
      ]),
      { mutated: true, rejected: true },
    );

    const fixtureDigest = (bytes: Uint8Array): string =>
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    const verifiedProxyRoot = path.join(base, "verified-proxy-root");
    const verifiedProxyPublication = fixtureDigest(
      Buffer.from("verified proxy publication"),
    );
    const verifiedProxyCompile = fixtureDigest(
      Buffer.from("verified proxy compile"),
    );
    const verifiedProxyEdit = fixtureDigest(Buffer.from("verified proxy edit"));
    const verifiedProxyBundleRelative = `deliverables/proxy/${verifiedProxyPublication.slice(7)}`;
    const verifiedProxyBundle = path.join(
      verifiedProxyRoot,
      ...verifiedProxyBundleRelative.split("/"),
    );
    const verifiedProxyPayload = path.join(
      verifiedProxyBundle,
      "feature",
      "feature.mp4",
    );
    const verifiedProxyPayloadBytes = Buffer.from("reviewed proxy payload");
    const proxyReceipt = (props: {
      fileBytes?: number;
      filePath?: string;
      malformedDeliverable?: boolean;
      publicationFingerprint: string;
      rendition?: "invalid" | "valid";
      withPayload?: boolean;
    }) => ({
      version: 1,
      tier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
      publicationFingerprint: props.publicationFingerprint,
      compileFingerprint: verifiedProxyCompile,
      editFingerprint: verifiedProxyEdit,
      frameFormat: { width: 640, height: 360, fps: 12 },
      sourceFrameFormat: { width: 1280, height: 720, fps: 24 },
      totalFrames: 12,
      manifest: {
        version: 1,
        compileFingerprint: verifiedProxyCompile,
        deliverables:
          props.withPayload === false
            ? []
            : [
                props.malformedDeliverable === true
                  ? {
                      files: [
                        {
                          path:
                            props.filePath ??
                            `${verifiedProxyBundleRelative}/feature/feature.mp4`,
                          digest: fixtureDigest(verifiedProxyPayloadBytes),
                          bytes:
                            props.fileBytes ?? verifiedProxyPayloadBytes.length,
                          mediaType: "video/mp4",
                        },
                      ],
                    }
                  : {
                      id: "feature",
                      kind: "feature",
                      files: [
                        {
                          path:
                            props.filePath ??
                            `${verifiedProxyBundleRelative}/feature/feature.mp4`,
                          digest: fixtureDigest(verifiedProxyPayloadBytes),
                          bytes:
                            props.fileBytes ?? verifiedProxyPayloadBytes.length,
                          mediaType: "video/mp4",
                        },
                      ],
                      runtimeSeconds: 1,
                      frameCount: 12,
                      codec: "h264",
                      ...(props.rendition === undefined
                        ? {}
                        : {
                            rendition: {
                              kind: "repainted",
                              shots: [
                                {
                                  shot: "opening",
                                  path: "renditions/opening.mp4",
                                  digest: verifiedProxyCompile,
                                  receiptDigest: verifiedProxyEdit,
                                  sourceReviewFingerprint: verifiedProxyCompile,
                                  renditionReviewFingerprint: verifiedProxyEdit,
                                },
                              ],
                              aggregateReviews: [
                                props.rendition === "valid"
                                  ? {
                                      kind: "film",
                                      id: "feature",
                                      fingerprint: verifiedProxyCompile,
                                    }
                                  : {
                                      kind: "scene",
                                      id: "feature",
                                    },
                              ],
                            },
                          }),
                    },
              ],
      },
    });
    fs.mkdirSync(path.dirname(verifiedProxyPayload), { recursive: true });
    fs.writeFileSync(verifiedProxyPayload, verifiedProxyPayloadBytes);
    fs.writeFileSync(
      path.join(verifiedProxyBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          publicationFingerprint: verifiedProxyPublication,
          rendition: "valid",
        }),
      )}\n`,
    );
    const inspectedProxy = proxyModule.inspectPublishedProxyBundle(
      verifiedProxyRoot,
      verifiedProxyBundle,
    );
    TestValidator.equals(
      "the final proxy consumer accepts one exact manifest-backed bundle",
      {
        compile: inspectedProxy.compileFingerprint,
        edit: inspectedProxy.editFingerprint,
        publication: inspectedProxy.publicationFingerprint,
        tier: inspectedProxy.tier.kind,
      },
      {
        compile: verifiedProxyCompile,
        edit: verifiedProxyEdit,
        publication: verifiedProxyPublication,
        tier: "proxy",
      },
    );

    const sameLengthProxyMutation = Buffer.from(verifiedProxyPayloadBytes);
    sameLengthProxyMutation[0] ^= 1;
    fs.writeFileSync(verifiedProxyPayload, sameLengthProxyMutation);
    const mutatedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        verifiedProxyBundle,
      ),
    );
    fs.writeFileSync(verifiedProxyPayload, verifiedProxyPayloadBytes);
    fs.rmSync(verifiedProxyPayload);
    const deletedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        verifiedProxyBundle,
      ),
    );
    fs.writeFileSync(verifiedProxyPayload, verifiedProxyPayloadBytes);
    TestValidator.equals(
      "the final proxy consumer rejects mutated and deleted payloads",
      namedFacts([
        ["mutated", () => mutatedProxyRejected],
        ["deleted", () => deletedProxyRejected],
      ]),
      { mutated: true, deleted: true },
    );

    const unmanifestedProxyFile = path.join(
      verifiedProxyBundle,
      "feature",
      "extra.bin",
    );
    fs.writeFileSync(unmanifestedProxyFile, "unmanifested bytes");
    const unmanifestedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        verifiedProxyBundle,
      ),
    );
    fs.rmSync(unmanifestedProxyFile);

    const receiptOnlyPublication = fixtureDigest(
      Buffer.from("receipt only proxy"),
    );
    const receiptOnlyBundle = path.join(
      verifiedProxyRoot,
      "deliverables",
      "proxy",
      receiptOnlyPublication.slice(7),
    );
    fs.mkdirSync(receiptOnlyBundle);
    fs.writeFileSync(
      path.join(receiptOnlyBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          publicationFingerprint: receiptOnlyPublication,
          withPayload: false,
        }),
      )}\n`,
    );
    const receiptOnlyProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        receiptOnlyBundle,
      ),
    );

    const escapingPublication = fixtureDigest(Buffer.from("escaping proxy"));
    const escapingBundleRelative = `deliverables/proxy/${escapingPublication.slice(7)}`;
    const escapingBundle = path.join(
      verifiedProxyRoot,
      ...escapingBundleRelative.split("/"),
    );
    fs.mkdirSync(escapingBundle);
    fs.writeFileSync(
      path.join(escapingBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          filePath: `${escapingBundleRelative}/../escape.mp4`,
          publicationFingerprint: escapingPublication,
        }),
      )}\n`,
    );
    const escapingProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        escapingBundle,
      ),
    );

    const malformedPublication = fixtureDigest(Buffer.from("malformed proxy"));
    const malformedBundleRelative = `deliverables/proxy/${malformedPublication.slice(7)}`;
    const malformedBundle = path.join(
      verifiedProxyRoot,
      ...malformedBundleRelative.split("/"),
    );
    fs.mkdirSync(malformedBundle);
    fs.writeFileSync(
      path.join(malformedBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          fileBytes: 0,
          filePath: `${malformedBundleRelative}/feature/feature.mp4`,
          publicationFingerprint: malformedPublication,
        }),
      )}\n`,
    );
    const malformedProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        malformedBundle,
      ),
    );

    const duplicatePublication = fixtureDigest(Buffer.from("duplicate proxy"));
    const duplicateBundleRelative = `deliverables/proxy/${duplicatePublication.slice(7)}`;
    const duplicateBundle = path.join(
      verifiedProxyRoot,
      ...duplicateBundleRelative.split("/"),
    );
    const duplicatePayload = path.join(
      duplicateBundle,
      "feature",
      "feature.mp4",
    );
    fs.mkdirSync(path.dirname(duplicatePayload), { recursive: true });
    fs.writeFileSync(duplicatePayload, verifiedProxyPayloadBytes);
    const duplicateReceipt = proxyReceipt({
      filePath: `${duplicateBundleRelative}/feature/feature.mp4`,
      publicationFingerprint: duplicatePublication,
    });
    duplicateReceipt.manifest.deliverables.push(
      duplicateReceipt.manifest.deliverables[0]!,
    );
    fs.writeFileSync(
      path.join(duplicateBundle, "publication.json"),
      `${JSON.stringify(duplicateReceipt)}\n`,
    );
    const duplicateProxyRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        duplicateBundle,
      ),
    );

    const malformedMetadataPublication = fixtureDigest(
      Buffer.from("malformed metadata proxy"),
    );
    const malformedMetadataBundleRelative = `deliverables/proxy/${malformedMetadataPublication.slice(7)}`;
    const malformedMetadataBundle = path.join(
      verifiedProxyRoot,
      ...malformedMetadataBundleRelative.split("/"),
    );
    const malformedMetadataPayload = path.join(
      malformedMetadataBundle,
      "feature",
      "feature.mp4",
    );
    fs.mkdirSync(path.dirname(malformedMetadataPayload), { recursive: true });
    fs.writeFileSync(malformedMetadataPayload, verifiedProxyPayloadBytes);
    fs.writeFileSync(
      path.join(malformedMetadataBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          filePath: `${malformedMetadataBundleRelative}/feature/feature.mp4`,
          malformedDeliverable: true,
          publicationFingerprint: malformedMetadataPublication,
        }),
      )}\n`,
    );
    const malformedMetadataRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        malformedMetadataBundle,
      ),
    );

    const invalidRenditionPublication = fixtureDigest(
      Buffer.from("invalid rendition proxy"),
    );
    const invalidRenditionBundleRelative = `deliverables/proxy/${invalidRenditionPublication.slice(7)}`;
    const invalidRenditionBundle = path.join(
      verifiedProxyRoot,
      ...invalidRenditionBundleRelative.split("/"),
    );
    const invalidRenditionPayload = path.join(
      invalidRenditionBundle,
      "feature",
      "feature.mp4",
    );
    fs.mkdirSync(path.dirname(invalidRenditionPayload), { recursive: true });
    fs.writeFileSync(invalidRenditionPayload, verifiedProxyPayloadBytes);
    fs.writeFileSync(
      path.join(invalidRenditionBundle, "publication.json"),
      `${JSON.stringify(
        proxyReceipt({
          filePath: `${invalidRenditionBundleRelative}/feature/feature.mp4`,
          publicationFingerprint: invalidRenditionPublication,
          rendition: "invalid",
        }),
      )}\n`,
    );
    const invalidRenditionRejected = throws(() =>
      proxyModule.inspectPublishedProxyBundle(
        verifiedProxyRoot,
        invalidRenditionBundle,
      ),
    );
    TestValidator.equals(
      "the final proxy consumer rejects unowned and malformed manifests",
      {
        duplicate: duplicateProxyRejected,
        escaping: escapingProxyRejected,
        invalidRendition: invalidRenditionRejected,
        malformed: malformedProxyRejected,
        malformedMetadata: malformedMetadataRejected,
        receiptOnly: receiptOnlyProxyRejected,
        unmanifested: unmanifestedProxyRejected,
      },
      {
        duplicate: true,
        escaping: true,
        invalidRendition: true,
        malformed: true,
        malformedMetadata: true,
        receiptOnly: true,
        unmanifested: true,
      },
    );

    const parkedVerifiedProxyBundle = `${verifiedProxyBundle}.parked`;
    const successorVerifiedProxyBundle = `${verifiedProxyBundle}.successor`;
    fs.cpSync(verifiedProxyBundle, successorVerifiedProxyBundle, {
      recursive: true,
    });
    let verifiedPayloadObservations = 0;
    let verifiedProxyTreeSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (path.resolve(file.toString()) === verifiedProxyPayload) {
        verifiedPayloadObservations++;
        if (verifiedPayloadObservations === 2) {
          fs.renameSync(verifiedProxyBundle, parkedVerifiedProxyBundle);
          fs.renameSync(successorVerifiedProxyBundle, verifiedProxyBundle);
          verifiedProxyTreeSwapped = true;
        }
      }
      return status;
    }) as typeof fs.lstatSync;
    let verifiedProxyTreeSuccessorRejected = false;
    let verifiedProxyTreeCleanupFailure: { error: unknown } | undefined;
    try {
      verifiedProxyTreeSuccessorRejected = throws(() =>
        proxyModule.inspectPublishedProxyBundle(
          verifiedProxyRoot,
          verifiedProxyBundle,
        ),
      );
    } catch (error) {
      verifiedProxyTreeCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(verifiedProxyTreeCleanupFailure, [
        {
          resource: "verified proxy tree lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "verified proxy resident bundle",
          cleanup: () => {
            if (fs.existsSync(parkedVerifiedProxyBundle)) {
              fs.rmSync(verifiedProxyBundle, {
                recursive: true,
                force: true,
              });
              fs.renameSync(parkedVerifiedProxyBundle, verifiedProxyBundle);
            }
          },
        },
        {
          resource: "verified proxy successor bundle",
          cleanup: () => {
            fs.rmSync(successorVerifiedProxyBundle, {
              recursive: true,
              force: true,
            });
          },
        },
      ]);
    }
    TestValidator.equals(
      "the final proxy consumer rejects a byte-identical tree successor",
      namedFacts([
        ["swapped", () => verifiedProxyTreeSwapped],
        ["rejected", () => verifiedProxyTreeSuccessorRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const lateVerifiedProxyFile = path.join(
      verifiedProxyBundle,
      "late-after-read.bin",
    );
    const verifiedPayloadDescriptors = new Set<number>();
    let verifiedPayloadReadComplete = false;
    let verifiedProxyLateMutation = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === verifiedProxyPayload
      )
        verifiedPayloadDescriptors.add(descriptor);
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.readFileSync = ((file, ...args: unknown[]): unknown => {
      const bytes = Reflect.apply(nativeReadFile, mutableFs, [file, ...args]);
      if (typeof file === "number" && verifiedPayloadDescriptors.has(file))
        verifiedPayloadReadComplete = true;
      return bytes;
    }) as typeof fs.readFileSync;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        verifiedProxyLateMutation === false &&
        verifiedPayloadReadComplete &&
        path.resolve(directory.toString()) === verifiedProxyBundle
      ) {
        fs.writeFileSync(lateVerifiedProxyFile, "late after all reads");
        verifiedProxyLateMutation = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    let verifiedProxyLateMutationRejected = false;
    let verifiedProxyInventoryCleanupFailure: { error: unknown } | undefined;
    try {
      verifiedProxyLateMutationRejected = throws(() =>
        proxyModule.inspectPublishedProxyBundle(
          verifiedProxyRoot,
          verifiedProxyBundle,
        ),
      );
    } catch (error) {
      verifiedProxyInventoryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(verifiedProxyInventoryCleanupFailure, [
        {
          resource: "verified proxy inventory open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "verified proxy inventory read-file hook",
          cleanup: () => {
            mutableFs.readFileSync = nativeReadFile;
          },
        },
        {
          resource: "verified proxy inventory readdir hook",
          cleanup: () => {
            mutableFs.readdirSync = nativeReaddir;
          },
        },
        {
          resource: "verified proxy late inventory file",
          cleanup: () => {
            fs.rmSync(lateVerifiedProxyFile, { force: true });
          },
        },
      ]);
    }
    TestValidator.equals(
      "the final proxy consumer revalidates exact inventory after all reads",
      namedFacts([
        ["mutated", () => verifiedProxyLateMutation],
        ["rejected", () => verifiedProxyLateMutationRejected],
      ]),
      { mutated: true, rejected: true },
    );
    const runtimePackage = path.join(base, "runtime-package");
    const runtimeManifest = path.join(runtimePackage, "package.json");
    const runtimeEntry = path.join(runtimePackage, "index.mjs");
    const runtimeAssets = path.join(runtimePackage, "native");
    const runtimeAsset = path.join(runtimeAssets, "runtime.node");
    const runtimeManifestBytes = Buffer.from(
      '{"name":"fixture-runtime","version":"1.2.3"}\n',
    );
    const runtimeEntryBytes = Buffer.from("export const fixture = true;\n");
    const runtimeAssetBytes = Buffer.from("native fixture bytes");
    fs.mkdirSync(runtimeAssets, { recursive: true });
    fs.writeFileSync(runtimeManifest, runtimeManifestBytes);
    fs.writeFileSync(runtimeEntry, runtimeEntryBytes);
    fs.writeFileSync(runtimeAsset, runtimeAssetBytes);
    const runtimePackageModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "runtimePackageSnapshot.ts"),
    ) as {
      snapshotRuntimePackage: (props: {
        assets?: ReadonlyArray<{
          kind: "file" | "tree";
          relative: string;
        }>;
        entry: string;
        packageName: string;
      }) => {
        assets: Array<{ digest: string; path: string }>;
        entryDigest: string;
        package: string;
        version: string;
      };
    };
    const snapshotRuntimeFixture = () =>
      runtimePackageModule.snapshotRuntimePackage({
        assets: [{ kind: "tree", relative: "native" }],
        entry: runtimeEntry,
        packageName: "fixture-runtime",
      });
    const runtimeSnapshot = snapshotRuntimeFixture();
    TestValidator.equals(
      "runtime package identity captures exact manifest-owned entry and assets",
      {
        assetDigest: runtimeSnapshot.assets[0]?.digest ?? null,
        assetPath: runtimeSnapshot.assets[0]?.path ?? null,
        assets: runtimeSnapshot.assets.length,
        entryDigest: runtimeSnapshot.entryDigest,
        package: runtimeSnapshot.package,
        version: runtimeSnapshot.version,
      },
      {
        assetDigest: fixtureDigest(runtimeAssetBytes),
        assetPath: "native/runtime.node",
        assets: 1,
        entryDigest: fixtureDigest(runtimeEntryBytes),
        package: "fixture-runtime",
        version: "1.2.3",
      },
    );
    const parkedRuntimeManifest = `${runtimeManifest}.parked`;
    let runtimeManifestSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        runtimeManifestSwapped === false &&
        path.resolve(file.toString()) === runtimeManifest
      ) {
        fs.renameSync(runtimeManifest, parkedRuntimeManifest);
        fs.writeFileSync(runtimeManifest, runtimeManifestBytes);
        runtimeManifestSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let runtimeManifestRaceRejected = false;
    let runtimeManifestCleanupFailure: { error: unknown } | undefined;
    try {
      runtimeManifestRaceRejected = throws(snapshotRuntimeFixture);
    } catch (error) {
      runtimeManifestCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(runtimeManifestCleanupFailure, [
        {
          resource: "runtime manifest lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "runtime resident manifest",
          cleanup: () => {
            if (fs.existsSync(parkedRuntimeManifest)) {
              fs.rmSync(runtimeManifest, { force: true });
              fs.renameSync(parkedRuntimeManifest, runtimeManifest);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "runtime package identity rejects a byte-identical manifest successor",
      namedFacts([
        ["swapped", () => runtimeManifestSwapped],
        ["rejected", () => runtimeManifestRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const parkedRuntimeEntry = `${runtimeEntry}.parked`;
    let runtimeEntrySwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        runtimeEntrySwapped === false &&
        path.resolve(file.toString()) === runtimeEntry
      ) {
        fs.renameSync(runtimeEntry, parkedRuntimeEntry);
        fs.writeFileSync(runtimeEntry, runtimeEntryBytes);
        runtimeEntrySwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let runtimeEntryRaceRejected = false;
    let runtimeEntryCleanupFailure: { error: unknown } | undefined;
    try {
      runtimeEntryRaceRejected = throws(snapshotRuntimeFixture);
    } catch (error) {
      runtimeEntryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(runtimeEntryCleanupFailure, [
        {
          resource: "runtime entry lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "runtime resident entry",
          cleanup: () => {
            if (fs.existsSync(parkedRuntimeEntry)) {
              fs.rmSync(runtimeEntry, { force: true });
              fs.renameSync(parkedRuntimeEntry, runtimeEntry);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "runtime package identity rejects a byte-identical entry successor",
      namedFacts([
        ["swapped", () => runtimeEntrySwapped],
        ["rejected", () => runtimeEntryRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const lateRuntimeAsset = path.join(runtimeAssets, "late.node");
    const runtimeNativeReaddir = mutableFs.readdirSync;
    let runtimeInventoryMutated = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(runtimeNativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        runtimeInventoryMutated === false &&
        path.resolve(directory.toString()) === runtimeAssets
      ) {
        fs.writeFileSync(lateRuntimeAsset, "late native asset");
        runtimeInventoryMutated = true;
      }
      return entries;
    }) as typeof fs.readdirSync;
    let runtimeInventoryRaceRejected = false;
    let runtimeInventoryCleanupFailure: { error: unknown } | undefined;
    try {
      runtimeInventoryRaceRejected = throws(snapshotRuntimeFixture);
    } catch (error) {
      runtimeInventoryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(runtimeInventoryCleanupFailure, [
        {
          resource: "runtime inventory readdir hook",
          cleanup: () => {
            mutableFs.readdirSync = runtimeNativeReaddir;
          },
        },
        {
          resource: "runtime late native asset",
          cleanup: () => {
            fs.rmSync(lateRuntimeAsset, { force: true });
          },
        },
      ]);
    }
    TestValidator.equals(
      "runtime package identity rejects native asset inventory mutation",
      namedFacts([
        ["mutated", () => runtimeInventoryMutated],
        ["rejected", () => runtimeInventoryRaceRejected],
      ]),
      { mutated: true, rejected: true },
    );
    const captureExecutableModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "captureExecutableSnapshot.ts"),
    ) as {
      assertCaptureExecutable: (snapshot: {
        descriptor: number;
        digest: string;
        path: string;
      }) => void;
      closeCaptureExecutable: (snapshot: { descriptor: number }) => void;
      createCaptureExecutableSnapshot: (
        file: string,
        bytes: Uint8Array,
      ) => {
        descriptor: number;
        digest: string;
        path: string;
      };
      openCaptureExecutable: (
        file: string,
        maximumBytes?: number | null,
      ) => {
        descriptor: number;
        digest: string;
        path: string;
      };
    };
    const captureExecutable = path.join(base, "capture-executable.bin");
    const captureExecutableBytes = Buffer.from("capture executable bytes");
    fs.writeFileSync(captureExecutable, captureExecutableBytes);
    const captureSnapshot =
      captureExecutableModule.openCaptureExecutable(captureExecutable);
    let captureSnapshotAccepted = false;
    let captureSnapshotCleanupFailure: { error: unknown } | undefined;
    try {
      captureExecutableModule.assertCaptureExecutable(captureSnapshot);
      captureSnapshotAccepted =
        captureSnapshot.path === captureExecutable &&
        captureSnapshot.digest === fixtureDigest(captureExecutableBytes);
    } catch (error) {
      captureSnapshotCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(captureSnapshotCleanupFailure, [
        {
          resource: "capture accepted snapshot descriptor",
          cleanup: () => {
            captureExecutableModule.closeCaptureExecutable(captureSnapshot);
          },
        },
      ]);
    }
    TestValidator.predicate(
      "capture executable snapshot preserves exact resident bytes and identity",
      captureSnapshotAccepted,
    );
    const parkedCaptureExecutable = `${captureExecutable}.parked`;
    let captureExecutableSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        captureExecutableSwapped === false &&
        path.resolve(file.toString()) === captureExecutable
      ) {
        fs.renameSync(captureExecutable, parkedCaptureExecutable);
        fs.writeFileSync(captureExecutable, captureExecutableBytes);
        captureExecutableSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let captureExecutableRaceRejected = false;
    let captureExecutableRaceCleanupFailure: { error: unknown } | undefined;
    try {
      captureExecutableRaceRejected = throws(() =>
        captureExecutableModule.openCaptureExecutable(captureExecutable),
      );
    } catch (error) {
      captureExecutableRaceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(captureExecutableRaceCleanupFailure, [
        {
          resource: "capture executable lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "capture resident executable",
          cleanup: () => {
            if (fs.existsSync(parkedCaptureExecutable)) {
              fs.rmSync(captureExecutable, { force: true });
              fs.renameSync(parkedCaptureExecutable, captureExecutable);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture executable snapshot rejects a byte-identical successor",
      namedFacts([
        ["swapped", () => captureExecutableSwapped],
        ["rejected", () => captureExecutableRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const failedCaptureExecutableCreation = path.join(
      base,
      "failed-capture-executable-creation.bin",
    );
    const createSnapshotFailure = new Error(
      "capture executable snapshot creation failed",
    );
    const createSnapshotCloseFailure = new Error(
      "capture executable creation close failed",
    );
    let createSnapshotDescriptor = -1;
    let createSnapshotCloseAttempts = 0;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === failedCaptureExecutableCreation &&
        flags === "wx+"
      )
        createSnapshotDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.writeSync = ((...args: unknown[]): number => {
      if (args[0] === createSnapshotDescriptor) throw createSnapshotFailure;
      return Reflect.apply(nativeWrite, mutableFs, args) as number;
    }) as typeof fs.writeSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === createSnapshotDescriptor) {
        ++createSnapshotCloseAttempts;
        throw createSnapshotCloseFailure;
      }
    }) as typeof fs.closeSync;
    let combinedCreateSnapshotFailure: unknown;
    let createSnapshotHookCleanupFailure: { error: unknown } | undefined;
    try {
      captureExecutableModule.createCaptureExecutableSnapshot(
        failedCaptureExecutableCreation,
        Buffer.from("creation bytes"),
      );
    } catch (error) {
      combinedCreateSnapshotFailure = error;
      createSnapshotHookCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(createSnapshotHookCleanupFailure, [
        {
          resource: "capture create open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "capture create write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
        {
          resource: "capture create close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    const failedCaptureExecutableOpen = path.join(
      base,
      "failed-capture-executable-open.bin",
    );
    fs.writeFileSync(failedCaptureExecutableOpen, "opening bytes");
    const openSnapshotFailure = new Error(
      "capture executable snapshot opening failed",
    );
    const openSnapshotCloseFailure = new Error(
      "capture executable opening close failed",
    );
    let openSnapshotDescriptor = -1;
    let openSnapshotCloseAttempts = 0;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === failedCaptureExecutableOpen &&
        flags === "r"
      )
        openSnapshotDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (descriptor === openSnapshotDescriptor) throw openSnapshotFailure;
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === openSnapshotDescriptor) {
        ++openSnapshotCloseAttempts;
        throw openSnapshotCloseFailure;
      }
    }) as typeof fs.closeSync;
    let combinedOpenSnapshotFailure: unknown;
    let openSnapshotHookCleanupFailure: { error: unknown } | undefined;
    try {
      captureExecutableModule.openCaptureExecutable(
        failedCaptureExecutableOpen,
      );
    } catch (error) {
      combinedOpenSnapshotFailure = error;
      openSnapshotHookCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(openSnapshotHookCleanupFailure, [
        {
          resource: "capture open open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "capture open fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "capture open close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture executable acquisition preserves primary and close failures",
      {
        createAttempts: createSnapshotCloseAttempts,
        createErrors:
          combinedCreateSnapshotFailure instanceof AggregateError
            ? combinedCreateSnapshotFailure.errors.map((error) =>
                error === createSnapshotFailure
                  ? "primary"
                  : error === createSnapshotCloseFailure
                    ? "close"
                    : error instanceof Error
                      ? error.message
                      : String(error),
              )
            : [
                combinedCreateSnapshotFailure instanceof Error
                  ? combinedCreateSnapshotFailure.message
                  : String(combinedCreateSnapshotFailure),
              ],
        openAttempts: openSnapshotCloseAttempts,
        openErrors:
          combinedOpenSnapshotFailure instanceof AggregateError
            ? combinedOpenSnapshotFailure.errors.map((error) =>
                error === openSnapshotFailure
                  ? "primary"
                  : error === openSnapshotCloseFailure
                    ? "close"
                    : error instanceof Error
                      ? error.message
                      : String(error),
              )
            : [
                combinedOpenSnapshotFailure instanceof Error
                  ? combinedOpenSnapshotFailure.message
                  : String(combinedOpenSnapshotFailure),
              ],
      },
      {
        createAttempts: 1,
        createErrors: ["primary", "close"],
        openAttempts: 1,
        openErrors: ["primary", "close"],
      },
    );
    const captureBrowserModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "capture-browser.ts"),
    ) as {
      capturePlaywrightMetadata: (props?: {
        corePackagePath: string;
        playwrightEntry: string;
      }) => {
        browser: { browserVersion: string; revision: string };
        cliDigest: string;
        packageVersion: string;
      };
      captureInstallCommandTermination: (
        result: CaptureInstallCommandResult,
      ) => string;
      handoffCaptureBrowserSession: <Session>(props: {
        closeBrowser: () => unknown;
        closeSnapshot: () => unknown;
        session: Session;
      }) => Promise<Session>;
      launchWithCaptureExecutableSnapshot: <Output>(props: {
        close: (output: Output) => Promise<void>;
        launch: (executablePath: string) => Promise<Output>;
        snapshot: unknown;
      }) => Promise<Output>;
      preserveCaptureBrowserCleanup: (
        failure: { error: unknown } | undefined,
        resources: ReadonlyArray<{
          cleanup: () => unknown;
          resource: string;
        }>,
      ) => Promise<void>;
      preserveCaptureDescriptorCleanup: (
        failure: { error: unknown } | undefined,
        resource: string,
        cleanup: () => void,
      ) => void;
      publishCaptureInstallReceipt: (
        projectRoot: string,
        receipt: unknown,
        assertCurrent: () => void,
      ) => void;
      readCaptureInstallReceipt: (projectRoot: string) => {
        browser: { revision: string };
        version: number;
      };
      runDescriptorBoundNodeCli: (props: {
        args: readonly string[];
        cliDigest: string;
        cliPath: string;
        cwd: string;
        env: NodeJS.ProcessEnv;
      }) => CaptureInstallCommandResult;
    };
    const exerciseCaptureDescriptorCleanup = <Output>(
      operation: () => Output,
      cleanup: () => void,
    ): Output => {
      let failure: { error: unknown } | undefined;
      try {
        return operation();
      } catch (error) {
        failure = { error };
        throw error;
      } finally {
        captureBrowserModule.preserveCaptureDescriptorCleanup(
          failure,
          "capture descriptor fixture",
          cleanup,
        );
      }
    };
    let successfulDescriptorCleanupAttempts = 0;
    const successfulDescriptorResult = exerciseCaptureDescriptorCleanup(
      () => "descriptor result",
      () => {
        ++successfulDescriptorCleanupAttempts;
      },
    );
    const descriptorPrimaryFailure = new Error("descriptor operation failed");
    let primaryDescriptorCleanupAttempts = 0;
    let primaryDescriptorFailureCaught: unknown;
    try {
      exerciseCaptureDescriptorCleanup(
        () => {
          throw descriptorPrimaryFailure;
        },
        () => {
          ++primaryDescriptorCleanupAttempts;
        },
      );
    } catch (error) {
      primaryDescriptorFailureCaught = error;
    }
    const standaloneDescriptorCleanupFailure = new Error(
      "standalone descriptor cleanup failed",
    );
    let standaloneDescriptorCleanupAttempts = 0;
    let standaloneDescriptorCleanupCaught: unknown;
    try {
      exerciseCaptureDescriptorCleanup(
        () => undefined,
        () => {
          ++standaloneDescriptorCleanupAttempts;
          throw standaloneDescriptorCleanupFailure;
        },
      );
    } catch (error) {
      standaloneDescriptorCleanupCaught = error;
    }
    const combinedDescriptorCleanupFailure = new Error(
      "combined descriptor cleanup failed",
    );
    let combinedDescriptorCleanupAttempts = 0;
    let combinedDescriptorCleanupCaught: unknown;
    try {
      exerciseCaptureDescriptorCleanup(
        () => {
          throw descriptorPrimaryFailure;
        },
        () => {
          ++combinedDescriptorCleanupAttempts;
          throw combinedDescriptorCleanupFailure;
        },
      );
    } catch (error) {
      combinedDescriptorCleanupCaught = error;
    }
    TestValidator.equals(
      "capture descriptor cleanup preserves exact failure precedence",
      namedFacts([
        [
          "successfulDescriptorResultDescriptor",
          () => successfulDescriptorResult === "descriptor result",
        ],
        [
          "successfulDescriptorCleanupAttempts",
          () => successfulDescriptorCleanupAttempts === 1,
        ],
        [
          "primaryDescriptorCleanupAttempts",
          () => primaryDescriptorCleanupAttempts === 1,
        ],
        [
          "primaryDescriptorFailureCaughtDescriptorPrimaryFailure",
          () => primaryDescriptorFailureCaught === descriptorPrimaryFailure,
        ],
        [
          "standaloneDescriptorCleanupAttempts",
          () => standaloneDescriptorCleanupAttempts === 1,
        ],
        [
          "standaloneDescriptorCleanupCaughtStandaloneDescriptorCleanupFailure",
          () =>
            standaloneDescriptorCleanupCaught ===
            standaloneDescriptorCleanupFailure,
        ],
        [
          "combinedDescriptorCleanupAttempts",
          () => combinedDescriptorCleanupAttempts === 1,
        ],
        [
          "combinedDescriptorCleanupCaughtInstanceof",
          () => combinedDescriptorCleanupCaught instanceof AggregateError,
        ],
        [
          "combinedDescriptorCleanupCaughtCount",
          () =>
            combinedDescriptorCleanupCaught instanceof AggregateError &&
            combinedDescriptorCleanupCaught.errors.length === 2,
        ],
        [
          "combinedDescriptorCleanupCaughtErrors",
          () =>
            combinedDescriptorCleanupCaught instanceof AggregateError &&
            combinedDescriptorCleanupCaught.errors.length === 2 &&
            combinedDescriptorCleanupCaught.errors[0] ===
              descriptorPrimaryFailure,
        ],
        [
          "combinedDescriptorCleanupCaughtErrors2",
          () =>
            combinedDescriptorCleanupCaught instanceof AggregateError &&
            combinedDescriptorCleanupCaught.errors.length === 2 &&
            combinedDescriptorCleanupCaught.errors[0] ===
              descriptorPrimaryFailure &&
            combinedDescriptorCleanupCaught.errors[1] ===
              combinedDescriptorCleanupFailure,
        ],
      ]),
      {
        successfulDescriptorResultDescriptor: true,
        successfulDescriptorCleanupAttempts: true,
        primaryDescriptorCleanupAttempts: true,
        primaryDescriptorFailureCaughtDescriptorPrimaryFailure: true,
        standaloneDescriptorCleanupAttempts: true,
        standaloneDescriptorCleanupCaughtStandaloneDescriptorCleanupFailure: true,
        combinedDescriptorCleanupAttempts: true,
        combinedDescriptorCleanupCaughtInstanceof: true,
        combinedDescriptorCleanupCaughtCount: true,
        combinedDescriptorCleanupCaughtErrors: true,
        combinedDescriptorCleanupCaughtErrors2: true,
      },
    );
    let successfulBrowserCleanup = 0;
    await captureBrowserModule.preserveCaptureBrowserCleanup(undefined, [
      {
        resource: "successful cleanup",
        cleanup: () => {
          ++successfulBrowserCleanup;
        },
      },
    ]);
    const standaloneBrowserCleanupFailure = new Error(
      "standalone browser cleanup",
    );
    let standaloneBrowserCleanupError: unknown;
    try {
      await captureBrowserModule.preserveCaptureBrowserCleanup(undefined, [
        {
          resource: "standalone cleanup",
          cleanup: () => {
            throw standaloneBrowserCleanupFailure;
          },
        },
      ]);
    } catch (error) {
      standaloneBrowserCleanupError = error;
    }
    const browserBootstrapFailure = new Error("browser bootstrap failed");
    const firstBrowserCleanupFailure = new Error("first browser cleanup");
    const secondBrowserCleanupFailure = new Error("second browser cleanup");
    let attemptedBrowserCleanups = 0;
    let combinedBrowserCleanupError: unknown;
    try {
      await captureBrowserModule.preserveCaptureBrowserCleanup(
        { error: browserBootstrapFailure },
        [
          {
            resource: "first cleanup",
            cleanup: () => {
              ++attemptedBrowserCleanups;
              throw firstBrowserCleanupFailure;
            },
          },
          {
            resource: "successful cleanup",
            cleanup: () => {
              ++attemptedBrowserCleanups;
            },
          },
          {
            resource: "second cleanup",
            cleanup: async () => {
              ++attemptedBrowserCleanups;
              throw secondBrowserCleanupFailure;
            },
          },
        ],
      );
    } catch (error) {
      combinedBrowserCleanupError = error;
    }
    const trailingBrowserCleanupFailure = new Error("trailing browser cleanup");
    let flattenedBrowserCleanupError: unknown;
    try {
      await captureBrowserModule.preserveCaptureBrowserCleanup(
        { error: combinedBrowserCleanupError },
        [
          {
            resource: "trailing cleanup",
            cleanup: () => {
              throw trailingBrowserCleanupFailure;
            },
          },
        ],
      );
    } catch (error) {
      flattenedBrowserCleanupError = error;
    }
    let multipleStandaloneBrowserCleanupError: unknown;
    try {
      await captureBrowserModule.preserveCaptureBrowserCleanup(undefined, [
        {
          resource: "first cleanup",
          cleanup: () => {
            throw firstBrowserCleanupFailure;
          },
        },
        {
          resource: "second cleanup",
          cleanup: () => {
            throw secondBrowserCleanupFailure;
          },
        },
      ]);
    } catch (error) {
      multipleStandaloneBrowserCleanupError = error;
    }
    TestValidator.equals(
      "capture browser cleanup preserves primary-first failure order",
      namedFacts([
        ["successfulBrowserCleanup", () => successfulBrowserCleanup === 1],
        [
          "standaloneBrowserCleanupErrorStandaloneBrowserCleanupFailure",
          () =>
            standaloneBrowserCleanupError === standaloneBrowserCleanupFailure,
        ],
        ["attemptedBrowserCleanups", () => attemptedBrowserCleanups === 3],
        [
          "combinedBrowserCleanupErrorInstanceof",
          () => combinedBrowserCleanupError instanceof AggregateError,
        ],
        [
          "combinedBrowserCleanupErrorCount",
          () =>
            combinedBrowserCleanupError instanceof AggregateError &&
            combinedBrowserCleanupError.errors.length === 3,
        ],
        [
          "combinedBrowserCleanupErrorErrors",
          () =>
            combinedBrowserCleanupError instanceof AggregateError &&
            combinedBrowserCleanupError.errors.length === 3 &&
            combinedBrowserCleanupError.errors[0] === browserBootstrapFailure,
        ],
        [
          "combinedBrowserCleanupErrorErrors2",
          () =>
            combinedBrowserCleanupError instanceof AggregateError &&
            combinedBrowserCleanupError.errors.length === 3 &&
            combinedBrowserCleanupError.errors[0] === browserBootstrapFailure &&
            combinedBrowserCleanupError.errors[1] ===
              firstBrowserCleanupFailure,
        ],
        [
          "combinedBrowserCleanupErrorErrors3",
          () =>
            combinedBrowserCleanupError instanceof AggregateError &&
            combinedBrowserCleanupError.errors.length === 3 &&
            combinedBrowserCleanupError.errors[0] === browserBootstrapFailure &&
            combinedBrowserCleanupError.errors[1] ===
              firstBrowserCleanupFailure &&
            combinedBrowserCleanupError.errors[2] ===
              secondBrowserCleanupFailure,
        ],
        [
          "combinedBrowserCleanupErrorMessage",
          () =>
            combinedBrowserCleanupError instanceof AggregateError &&
            combinedBrowserCleanupError.errors.length === 3 &&
            combinedBrowserCleanupError.errors[0] === browserBootstrapFailure &&
            combinedBrowserCleanupError.errors[1] ===
              firstBrowserCleanupFailure &&
            combinedBrowserCleanupError.errors[2] ===
              secondBrowserCleanupFailure &&
            combinedBrowserCleanupError.message.includes(
              "first cleanup, second cleanup",
            ),
        ],
        [
          "flattenedBrowserCleanupErrorInstanceof",
          () => flattenedBrowserCleanupError instanceof AggregateError,
        ],
        [
          "flattenedBrowserCleanupErrorCount",
          () =>
            flattenedBrowserCleanupError instanceof AggregateError &&
            flattenedBrowserCleanupError.errors.length === 4,
        ],
        [
          "flattenedBrowserCleanupErrorErrors",
          () =>
            flattenedBrowserCleanupError instanceof AggregateError &&
            flattenedBrowserCleanupError.errors.length === 4 &&
            flattenedBrowserCleanupError.errors[0] === browserBootstrapFailure,
        ],
        [
          "flattenedBrowserCleanupErrorErrors2",
          () =>
            flattenedBrowserCleanupError instanceof AggregateError &&
            flattenedBrowserCleanupError.errors.length === 4 &&
            flattenedBrowserCleanupError.errors[0] ===
              browserBootstrapFailure &&
            flattenedBrowserCleanupError.errors[1] ===
              firstBrowserCleanupFailure,
        ],
        [
          "flattenedBrowserCleanupErrorErrors3",
          () =>
            flattenedBrowserCleanupError instanceof AggregateError &&
            flattenedBrowserCleanupError.errors.length === 4 &&
            flattenedBrowserCleanupError.errors[0] ===
              browserBootstrapFailure &&
            flattenedBrowserCleanupError.errors[1] ===
              firstBrowserCleanupFailure &&
            flattenedBrowserCleanupError.errors[2] ===
              secondBrowserCleanupFailure,
        ],
        [
          "flattenedBrowserCleanupErrorErrors4",
          () =>
            flattenedBrowserCleanupError instanceof AggregateError &&
            flattenedBrowserCleanupError.errors.length === 4 &&
            flattenedBrowserCleanupError.errors[0] ===
              browserBootstrapFailure &&
            flattenedBrowserCleanupError.errors[1] ===
              firstBrowserCleanupFailure &&
            flattenedBrowserCleanupError.errors[2] ===
              secondBrowserCleanupFailure &&
            flattenedBrowserCleanupError.errors[3] ===
              trailingBrowserCleanupFailure,
        ],
        [
          "multipleStandaloneBrowserCleanupErrorInstanceof",
          () => multipleStandaloneBrowserCleanupError instanceof AggregateError,
        ],
        [
          "multipleStandaloneBrowserCleanupErrorCount",
          () =>
            multipleStandaloneBrowserCleanupError instanceof AggregateError &&
            multipleStandaloneBrowserCleanupError.errors.length === 2,
        ],
        [
          "multipleStandaloneBrowserCleanupErrorErrors",
          () =>
            multipleStandaloneBrowserCleanupError instanceof AggregateError &&
            multipleStandaloneBrowserCleanupError.errors.length === 2 &&
            multipleStandaloneBrowserCleanupError.errors[0] ===
              firstBrowserCleanupFailure,
        ],
        [
          "multipleStandaloneBrowserCleanupErrorErrors2",
          () =>
            multipleStandaloneBrowserCleanupError instanceof AggregateError &&
            multipleStandaloneBrowserCleanupError.errors.length === 2 &&
            multipleStandaloneBrowserCleanupError.errors[0] ===
              firstBrowserCleanupFailure &&
            multipleStandaloneBrowserCleanupError.errors[1] ===
              secondBrowserCleanupFailure,
        ],
      ]),
      {
        successfulBrowserCleanup: true,
        standaloneBrowserCleanupErrorStandaloneBrowserCleanupFailure: true,
        attemptedBrowserCleanups: true,
        combinedBrowserCleanupErrorInstanceof: true,
        combinedBrowserCleanupErrorCount: true,
        combinedBrowserCleanupErrorErrors: true,
        combinedBrowserCleanupErrorErrors2: true,
        combinedBrowserCleanupErrorErrors3: true,
        combinedBrowserCleanupErrorMessage: true,
        flattenedBrowserCleanupErrorInstanceof: true,
        flattenedBrowserCleanupErrorCount: true,
        flattenedBrowserCleanupErrorErrors: true,
        flattenedBrowserCleanupErrorErrors2: true,
        flattenedBrowserCleanupErrorErrors3: true,
        flattenedBrowserCleanupErrorErrors4: true,
        multipleStandaloneBrowserCleanupErrorInstanceof: true,
        multipleStandaloneBrowserCleanupErrorCount: true,
        multipleStandaloneBrowserCleanupErrorErrors: true,
        multipleStandaloneBrowserCleanupErrorErrors2: true,
      },
    );
    const successfulHandoffSession = { browser: "transferred" };
    let successfulHandoffSnapshotCloses = 0;
    let successfulHandoffBrowserCloses = 0;
    const transferredHandoffSession =
      await captureBrowserModule.handoffCaptureBrowserSession({
        session: successfulHandoffSession,
        closeSnapshot: () => {
          ++successfulHandoffSnapshotCloses;
        },
        closeBrowser: () => {
          ++successfulHandoffBrowserCloses;
        },
      });
    const handoffSnapshotFailure = new Error("handoff snapshot close failed");
    let recoveredHandoffBrowserCloses = 0;
    let recoveredHandoffFailure: unknown;
    try {
      await captureBrowserModule.handoffCaptureBrowserSession({
        session: successfulHandoffSession,
        closeSnapshot: () => {
          throw handoffSnapshotFailure;
        },
        closeBrowser: async () => {
          ++recoveredHandoffBrowserCloses;
        },
      });
    } catch (error) {
      recoveredHandoffFailure = error;
    }
    const handoffBrowserFailure = new Error("handoff browser close failed");
    let failedHandoffBrowserCloses = 0;
    let combinedHandoffFailure: unknown;
    try {
      await captureBrowserModule.handoffCaptureBrowserSession({
        session: successfulHandoffSession,
        closeSnapshot: () => {
          throw handoffSnapshotFailure;
        },
        closeBrowser: async () => {
          ++failedHandoffBrowserCloses;
          throw handoffBrowserFailure;
        },
      });
    } catch (error) {
      combinedHandoffFailure = error;
    }
    TestValidator.equals(
      "capture browser transfers ownership only after snapshot cleanup",
      namedFacts([
        [
          "transferredHandoffSessionSuccessfulHandoffSession",
          () => transferredHandoffSession === successfulHandoffSession,
        ],
        [
          "successfulHandoffSnapshotCloses",
          () => successfulHandoffSnapshotCloses === 1,
        ],
        [
          "successfulHandoffBrowserCloses",
          () => successfulHandoffBrowserCloses === 0,
        ],
        [
          "recoveredHandoffBrowserCloses",
          () => recoveredHandoffBrowserCloses === 1,
        ],
        [
          "recoveredHandoffFailureHandoffSnapshotFailure",
          () => recoveredHandoffFailure === handoffSnapshotFailure,
        ],
        ["failedHandoffBrowserCloses", () => failedHandoffBrowserCloses === 1],
        [
          "combinedHandoffFailureInstanceof",
          () => combinedHandoffFailure instanceof AggregateError,
        ],
        [
          "combinedHandoffFailureCount",
          () =>
            combinedHandoffFailure instanceof AggregateError &&
            combinedHandoffFailure.errors.length === 2,
        ],
        [
          "combinedHandoffFailureErrors",
          () =>
            combinedHandoffFailure instanceof AggregateError &&
            combinedHandoffFailure.errors.length === 2 &&
            combinedHandoffFailure.errors[0] === handoffSnapshotFailure,
        ],
        [
          "combinedHandoffFailureErrors2",
          () =>
            combinedHandoffFailure instanceof AggregateError &&
            combinedHandoffFailure.errors.length === 2 &&
            combinedHandoffFailure.errors[0] === handoffSnapshotFailure &&
            combinedHandoffFailure.errors[1] === handoffBrowserFailure,
        ],
      ]),
      {
        transferredHandoffSessionSuccessfulHandoffSession: true,
        successfulHandoffSnapshotCloses: true,
        successfulHandoffBrowserCloses: true,
        recoveredHandoffBrowserCloses: true,
        recoveredHandoffFailureHandoffSnapshotFailure: true,
        failedHandoffBrowserCloses: true,
        combinedHandoffFailureInstanceof: true,
        combinedHandoffFailureCount: true,
        combinedHandoffFailureErrors: true,
        combinedHandoffFailureErrors2: true,
      },
    );
    const metadataRoot = path.join(base, "capture-metadata");
    const playwrightRoot = path.join(metadataRoot, "playwright");
    const playwrightEntry = path.join(playwrightRoot, "index.js");
    const playwrightCli = path.join(playwrightRoot, "cli.js");
    const coreRoot = path.join(metadataRoot, "playwright-core");
    const coreManifest = path.join(coreRoot, "package.json");
    const coreBrowsers = path.join(coreRoot, "browsers.json");
    const playwrightCliBytes = Buffer.from("module.exports = 'cli';\n");
    fs.mkdirSync(playwrightRoot, { recursive: true });
    fs.mkdirSync(coreRoot, { recursive: true });
    fs.writeFileSync(
      path.join(playwrightRoot, "package.json"),
      `${JSON.stringify({ name: "playwright", version: "1.2.3" })}\n`,
    );
    fs.writeFileSync(playwrightEntry, "module.exports = {};\n");
    fs.writeFileSync(playwrightCli, playwrightCliBytes);
    fs.writeFileSync(
      coreManifest,
      `${JSON.stringify({ name: "playwright-core", version: "1.2.3" })}\n`,
    );
    fs.writeFileSync(
      coreBrowsers,
      `${JSON.stringify({
        browsers: [
          {
            name: "chromium",
            revision: "123",
            browserVersion: "123.0.0",
          },
        ],
      })}\n`,
    );
    const metadataFixture = () =>
      captureBrowserModule.capturePlaywrightMetadata({
        corePackagePath: coreManifest,
        playwrightEntry,
      });
    const metadataSnapshot = metadataFixture();
    TestValidator.equals(
      "capture metadata revalidates Playwright, core, browsers and CLI together",
      namedFacts([
        [
          "metadataSnapshotPackageVersion",
          () => metadataSnapshot.packageVersion === "1.2.3",
        ],
        [
          "metadataSnapshotBrowser",
          () => metadataSnapshot.browser.revision === "123",
        ],
        [
          "metadataSnapshotCliDigest",
          () =>
            metadataSnapshot.cliDigest === fixtureDigest(playwrightCliBytes),
        ],
      ]),
      {
        metadataSnapshotPackageVersion: true,
        metadataSnapshotBrowser: true,
        metadataSnapshotCliDigest: true,
      },
    );
    const parkedPlaywrightCli = `${playwrightCli}.parked`;
    let compositeMetadataSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        compositeMetadataSwapped === false &&
        path.resolve(file.toString()) === coreManifest
      ) {
        fs.renameSync(playwrightCli, parkedPlaywrightCli);
        fs.writeFileSync(playwrightCli, playwrightCliBytes);
        compositeMetadataSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let compositeMetadataRaceRejected = false;
    let compositeMetadataCleanupFailure: { error: unknown } | undefined;
    try {
      compositeMetadataRaceRejected = throws(metadataFixture);
    } catch (error) {
      compositeMetadataCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(compositeMetadataCleanupFailure, [
        {
          resource: "capture metadata lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "capture metadata resident CLI",
          cleanup: () => {
            if (fs.existsSync(parkedPlaywrightCli)) {
              fs.rmSync(playwrightCli, { force: true });
              fs.renameSync(parkedPlaywrightCli, playwrightCli);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture metadata rejects a CLI successor between package snapshots",
      namedFacts([
        ["swapped", () => compositeMetadataSwapped],
        ["rejected", () => compositeMetadataRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const coreBrowserBytes = fs.readFileSync(coreBrowsers);
    const parkedCoreBrowsers = `${coreBrowsers}.parked`;
    let coreBrowsersSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        coreBrowsersSwapped === false &&
        path.resolve(file.toString()) === coreBrowsers
      ) {
        fs.renameSync(coreBrowsers, parkedCoreBrowsers);
        fs.writeFileSync(coreBrowsers, coreBrowserBytes);
        coreBrowsersSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let coreBrowsersRaceRejected = false;
    let coreBrowsersCleanupFailure: { error: unknown } | undefined;
    try {
      coreBrowsersRaceRejected = throws(metadataFixture);
    } catch (error) {
      coreBrowsersCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(coreBrowsersCleanupFailure, [
        {
          resource: "capture core browsers lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "capture resident core browsers",
          cleanup: () => {
            if (fs.existsSync(parkedCoreBrowsers)) {
              fs.rmSync(coreBrowsers, { force: true });
              fs.renameSync(parkedCoreBrowsers, coreBrowsers);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture metadata rejects a core browsers successor while captured",
      namedFacts([
        ["swapped", () => coreBrowsersSwapped],
        ["rejected", () => coreBrowsersRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const descriptorCli = path.join(base, "descriptor-cli.cjs");
    // The runner asserts that the executable's own directory did not change
    // while the CLI ran, and that version covers the directory's mtime, so the
    // CLI writes its marker into a child directory created beforehand.
    const descriptorCliOutput = path.join(base, "descriptor-cli-output");
    fs.mkdirSync(descriptorCliOutput, { recursive: true });
    const descriptorCliMarker = path.join(
      descriptorCliOutput,
      "descriptor-cli.marker",
    );
    const descriptorCliBytes = Buffer.from(
      [
        'const fs = require("node:fs");',
        'if (process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") process.exit(17);',
        'fs.writeFileSync(process.argv[2], "captured-cli");',
      ].join("\n"),
    );
    fs.writeFileSync(descriptorCli, descriptorCliBytes);
    const descriptorCliResult = captureBrowserModule.runDescriptorBoundNodeCli({
      args: [descriptorCliMarker],
      cliDigest: fixtureDigest(descriptorCliBytes),
      cliPath: descriptorCli,
      cwd: base,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
    });
    TestValidator.equals(
      "capture install executes exact CLI bytes with package-local browser storage",
      {
        result: descriptorCliResult,
        marker: fs.readFileSync(descriptorCliMarker, "utf8"),
      },
      {
        result: {
          error: null,
          signal: null,
          status: 0,
          stderr: "",
          stdout: "",
        },
        marker: "captured-cli",
      },
    );
    const descriptorFailureBytes = Buffer.from(
      [
        'process.stdout.write("playwright-output\\n");',
        'process.stderr.write("download-failure\\n");',
        "process.exitCode = 23;",
      ].join("\n"),
    );
    fs.writeFileSync(descriptorCli, descriptorFailureBytes);
    TestValidator.equals(
      "capture install retains both output channels and ordinary exit status",
      captureBrowserModule.runDescriptorBoundNodeCli({
        args: [],
        cliDigest: fixtureDigest(descriptorFailureBytes),
        cliPath: descriptorCli,
        cwd: base,
        env: process.env,
      }),
      {
        error: null,
        signal: null,
        status: 23,
        stderr: "download-failure\n",
        stdout: "playwright-output\n",
      },
    );
    const terminationFixture = (
      patch: Partial<CaptureInstallCommandResult>,
    ): CaptureInstallCommandResult => ({
      error: null,
      signal: null,
      status: null,
      stderr: "",
      stdout: "",
      ...patch,
    });
    TestValidator.equals(
      "capture install distinguishes every abnormal child termination",
      [
        terminationFixture({
          error: { code: "ENOENT", message: "missing executable" },
        }),
        terminationFixture({ signal: "SIGTERM" }),
        terminationFixture({}),
        terminationFixture({ status: 23 }),
      ].map(captureBrowserModule.captureInstallCommandTermination),
      [
        'failed to spawn; status=none; signal=none; error=ENOENT; message="missing executable"',
        "terminated by signal; status=none; signal=SIGTERM; error=none; message=none",
        "terminated without status; status=none; signal=none; error=none; message=none",
        "exited with status 23; status=23; signal=none; error=none; message=none",
      ],
    );
    const descriptorCliParked = `${descriptorCli}.parked`;
    const descriptorBoundaryBytes = Buffer.from(
      [
        'const fs = require("node:fs");',
        'fs.renameSync(__filename, __filename + ".parked");',
        `fs.writeFileSync(__filename, ${JSON.stringify("process.exit(29);\n")});`,
        'fs.writeFileSync(process.argv[2], "captured-cli");',
      ].join("\n"),
    );
    fs.writeFileSync(descriptorCli, descriptorBoundaryBytes);
    fs.rmSync(descriptorCliMarker, { force: true });
    const descriptorBoundaryRejected = throws(() =>
      captureBrowserModule.runDescriptorBoundNodeCli({
        args: [descriptorCliMarker],
        cliDigest: fixtureDigest(descriptorBoundaryBytes),
        cliPath: descriptorCli,
        cwd: base,
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: "0" },
      }),
    );
    TestValidator.equals(
      "capture install runs captured CLI bytes and rejects its pathname successor",
      namedFacts([
        ["descriptorBoundaryRejected", () => descriptorBoundaryRejected],
        [
          "descriptorCliMarkerUtf8",
          () => fs.readFileSync(descriptorCliMarker, "utf8") === "captured-cli",
        ],
        [
          "descriptorCliParkedResident",
          () => fs.existsSync(descriptorCliParked),
        ],
      ]),
      {
        descriptorBoundaryRejected: true,
        descriptorCliMarkerUtf8: true,
        descriptorCliParkedResident: true,
      },
    );
    fs.rmSync(descriptorCli, { force: true });
    fs.renameSync(descriptorCliParked, descriptorCli);
    const launchExecutable = path.join(base, "launch-executable.bin");
    fs.writeFileSync(launchExecutable, captureExecutableBytes);
    const launchSnapshot =
      captureExecutableModule.openCaptureExecutable(launchExecutable);
    const launchedPath =
      await captureBrowserModule.launchWithCaptureExecutableSnapshot({
        snapshot: launchSnapshot,
        launch: async (executablePath) => executablePath,
        close: async () => undefined,
      });
    captureExecutableModule.closeCaptureExecutable(launchSnapshot);
    TestValidator.predicate(
      "capture launch accepts one unchanged executable snapshot",
      launchedPath === launchExecutable,
    );
    const launchBoundarySnapshot =
      captureExecutableModule.openCaptureExecutable(launchExecutable);
    const parkedLaunchExecutable = `${launchExecutable}.parked`;
    let rejectedLaunchClosed = false;
    let launchBoundaryRejected = false;
    let launchBoundaryCleanupFailure: { error: unknown } | undefined;
    try {
      await captureBrowserModule.launchWithCaptureExecutableSnapshot({
        snapshot: launchBoundarySnapshot,
        launch: async () => {
          fs.renameSync(launchExecutable, parkedLaunchExecutable);
          fs.writeFileSync(launchExecutable, captureExecutableBytes);
          return "opened";
        },
        close: async () => {
          rejectedLaunchClosed = true;
        },
      });
    } catch (error) {
      launchBoundaryRejected = true;
      launchBoundaryCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(launchBoundaryCleanupFailure, [
        {
          resource: "capture launch boundary snapshot",
          cleanup: () => {
            captureExecutableModule.closeCaptureExecutable(
              launchBoundarySnapshot,
            );
          },
        },
        {
          resource: "capture launch boundary successor",
          cleanup: () => {
            fs.rmSync(launchExecutable, { force: true });
          },
        },
        {
          resource: "capture launch boundary resident executable",
          cleanup: () => {
            fs.renameSync(parkedLaunchExecutable, launchExecutable);
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture launch closes and rejects an executable successor during launch",
      namedFacts([
        ["rejected", () => launchBoundaryRejected],
        ["closed", () => rejectedLaunchClosed],
      ]),
      { rejected: true, closed: true },
    );
    const failedLaunchCleanupSnapshot =
      captureExecutableModule.openCaptureExecutable(launchExecutable);
    const failedLaunchCleanupParked = `${launchExecutable}.cleanup-parked`;
    const launchCleanupFailure = new Error("launch cleanup failed");
    let failedLaunchCleanupError: unknown;
    let failedLaunchHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      await captureBrowserModule.launchWithCaptureExecutableSnapshot({
        snapshot: failedLaunchCleanupSnapshot,
        launch: async () => {
          fs.renameSync(launchExecutable, failedLaunchCleanupParked);
          fs.writeFileSync(launchExecutable, captureExecutableBytes);
          return "opened";
        },
        close: async () => {
          throw launchCleanupFailure;
        },
      });
    } catch (error) {
      failedLaunchCleanupError = error;
      failedLaunchHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(failedLaunchHarnessCleanupFailure, [
        {
          resource: "capture rejected launch snapshot",
          cleanup: () => {
            captureExecutableModule.closeCaptureExecutable(
              failedLaunchCleanupSnapshot,
            );
          },
        },
        {
          resource: "capture rejected launch successor",
          cleanup: () => {
            fs.rmSync(launchExecutable, { force: true });
          },
        },
        {
          resource: "capture rejected launch resident executable",
          cleanup: () => {
            fs.renameSync(failedLaunchCleanupParked, launchExecutable);
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture launch retains identity failure before rejected cleanup",
      failedLaunchCleanupError instanceof AggregateError
        ? {
            // A rename moves the inode's ctime, so the descriptor check can
            // notice the successor before the pathname check does. The scenario
            // owns the ordering and the retention, not which check spoke.
            errors: failedLaunchCleanupError.errors.map((error) =>
              error === launchCleanupFailure
                ? "launch-cleanup-failure"
                : error instanceof Error
                  ? error.message.includes("changed physical identity") ||
                    error.message.includes("changed open descriptor bytes")
                    ? "identity-refusal"
                    : error.message
                  : String(error),
            ),
            kind: "aggregate",
          }
        : {
            errors:
              failedLaunchCleanupError instanceof Error
                ? [failedLaunchCleanupError.message]
                : [String(failedLaunchCleanupError)],
            kind: failedLaunchCleanupError instanceof Error ? "error" : "other",
          },
      {
        errors: ["identity-refusal", "launch-cleanup-failure"],
        kind: "aggregate",
      },
    );
    const captureProject = path.join(base, "capture-project");
    const captureReceipt = path.join(
      captureProject,
      ".automovie",
      "capture",
      "install-receipt.json",
    );
    const captureReceiptValue = {
      version: 1,
      playwright: { package: "playwright", version: "1.2.3" },
      browser: {
        product: "chromium",
        revision: "123",
        version: "123.0.0",
        executablePath: captureExecutable,
        executableDigest: fixtureDigest(captureExecutableBytes),
      },
      installSource: "playwright-cdn",
    } as const;
    const captureReceiptBytes = Buffer.from(
      `${JSON.stringify(captureReceiptValue)}\n`,
    );
    fs.mkdirSync(path.dirname(captureReceipt), { recursive: true });
    fs.writeFileSync(captureReceipt, captureReceiptBytes);
    TestValidator.predicate(
      "capture install receipt is read through project-owned bytes",
      captureBrowserModule.readCaptureInstallReceipt(captureProject).version ===
        1,
    );
    const parkedCaptureReceipt = `${captureReceipt}.parked`;
    let captureReceiptSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        captureReceiptSwapped === false &&
        path.resolve(file.toString()) === captureReceipt
      ) {
        fs.renameSync(captureReceipt, parkedCaptureReceipt);
        fs.writeFileSync(captureReceipt, captureReceiptBytes);
        captureReceiptSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let captureReceiptRaceRejected = false;
    let captureReceiptCleanupFailure: { error: unknown } | undefined;
    try {
      captureReceiptRaceRejected = throws(() =>
        captureBrowserModule.readCaptureInstallReceipt(captureProject),
      );
    } catch (error) {
      captureReceiptCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(captureReceiptCleanupFailure, [
        {
          resource: "capture receipt lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "capture resident receipt",
          cleanup: () => {
            if (fs.existsSync(parkedCaptureReceipt)) {
              fs.rmSync(captureReceipt, { force: true });
              fs.renameSync(parkedCaptureReceipt, captureReceipt);
            }
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install receipt rejects a byte-identical successor",
      namedFacts([
        ["swapped", () => captureReceiptSwapped],
        ["rejected", () => captureReceiptRaceRejected],
      ]),
      { swapped: true, rejected: true },
    );
    const installedCaptureMetadata =
      captureBrowserModule.capturePlaywrightMetadata();
    const nextCaptureReceipt = {
      ...captureReceiptValue,
      playwright: {
        package: "playwright",
        version: installedCaptureMetadata.packageVersion,
      },
      browser: {
        ...captureReceiptValue.browser,
        revision: installedCaptureMetadata.browser.revision,
        version: installedCaptureMetadata.browser.browserVersion,
      },
    };
    const captureReceiptGenerationName = (receipt: {
      browser: { product: string; revision: string; version: string };
      playwright: { package: string; version: string };
    }): string =>
      `${createHash("sha256")
        .update(
          JSON.stringify({
            browser: {
              product: receipt.browser.product,
              revision: receipt.browser.revision,
              version: receipt.browser.version,
            },
            playwright: {
              package: receipt.playwright.package,
              version: receipt.playwright.version,
            },
          }),
        )
        .digest("hex")}.json`;
    const failedReceiptPublication = throws(() =>
      captureBrowserModule.publishCaptureInstallReceipt(
        captureProject,
        nextCaptureReceipt,
        () => {
          throw new Error("provenance changed");
        },
      ),
    );
    TestValidator.equals(
      "capture install preserves the prior receipt when final validation fails",
      namedFacts([
        ["failedReceiptPublication", () => failedReceiptPublication],
        [
          "captureReceiptCaptureReceiptBytes",
          () => fs.readFileSync(captureReceipt).equals(captureReceiptBytes),
        ],
        [
          "captureReceiptCount",
          () =>
            fs.readdirSync(
              path.join(path.dirname(captureReceipt), "install-receipts"),
            ).length === 0,
        ],
      ]),
      {
        failedReceiptPublication: true,
        captureReceiptCaptureReceiptBytes: true,
        captureReceiptCount: true,
      },
    );
    let receiptPublicationValidated = false;
    captureBrowserModule.publishCaptureInstallReceipt(
      captureProject,
      nextCaptureReceipt,
      () => {
        receiptPublicationValidated = true;
      },
    );
    TestValidator.equals(
      "capture install publishes only after its final provenance validation",
      namedFacts([
        ["receiptPublicationValidated", () => receiptPublicationValidated],
        [
          "captureBrowserModuleReadCaptureInstallReceipt",
          () =>
            captureBrowserModule.readCaptureInstallReceipt(captureProject)
              .browser.revision === installedCaptureMetadata.browser.revision,
        ],
        [
          "captureReceiptCaptureReceiptBytes",
          () => fs.readFileSync(captureReceipt).equals(captureReceiptBytes),
        ],
      ]),
      {
        receiptPublicationValidated: true,
        captureBrowserModuleReadCaptureInstallReceipt: true,
        captureReceiptCaptureReceiptBytes: true,
      },
    );
    const receiptGenerationDirectory = path.join(
      path.dirname(captureReceipt),
      "install-receipts",
    );
    const receiptGenerationFile = path.join(
      receiptGenerationDirectory,
      fs.readdirSync(receiptGenerationDirectory)[0]!,
    );
    const receiptGenerationStatus = fs.lstatSync(receiptGenerationFile, {
      bigint: true,
    });
    captureBrowserModule.publishCaptureInstallReceipt(
      captureProject,
      nextCaptureReceipt,
      () => undefined,
    );
    TestValidator.equals(
      "capture install converges on one exact immutable receipt generation",
      namedFacts([
        [
          "generationIdentityKept",
          () => {
            const status = fs.lstatSync(receiptGenerationFile, {
              bigint: true,
            });
            return (
              status.dev === receiptGenerationStatus.dev &&
              status.ino === receiptGenerationStatus.ino
            );
          },
        ],
        [
          "oneGeneration",
          () => fs.readdirSync(receiptGenerationDirectory).length === 1,
        ],
      ]),
      {
        generationIdentityKept: true,
        oneGeneration: true,
      },
    );

    const partialReceiptProject = path.join(base, "partial-receipt-project");
    fs.mkdirSync(partialReceiptProject);
    let partialReceiptDescriptor = -1;
    let partialReceiptWriteFailed = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(path.dirname(file.toString())) === "install-receipts"
      )
        partialReceiptDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.writeSync = ((
      descriptor: number,
      buffer: Uint8Array,
      offset: number,
      _length: number,
      position: number,
    ): number => {
      if (
        partialReceiptWriteFailed === false &&
        descriptor === partialReceiptDescriptor
      ) {
        Reflect.apply(nativeWrite, mutableFs, [
          descriptor,
          buffer,
          offset,
          1,
          position,
        ]);
        partialReceiptWriteFailed = true;
        throw new Error("fixture interrupted receipt write");
      }
      return Reflect.apply(nativeWrite, mutableFs, [
        descriptor,
        buffer,
        offset,
        _length,
        position,
      ]) as number;
    }) as typeof fs.writeSync;
    let partialReceiptRejected = false;
    let partialReceiptCleanupFailure: { error: unknown } | undefined;
    try {
      partialReceiptRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          partialReceiptProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } catch (error) {
      partialReceiptCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(partialReceiptCleanupFailure, [
        {
          resource: "capture receipt partial open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "capture receipt partial write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
      ]);
    }
    const partialReceiptDirectory = path.join(
      partialReceiptProject,
      ".automovie",
      "capture",
      "install-receipts",
    );
    const partialReceiptRetryRejected = throwsWith(
      () =>
        captureBrowserModule.publishCaptureInstallReceipt(
          partialReceiptProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      "Manually adjudicate",
    );
    TestValidator.equals(
      "capture install preserves a handled partial for explicit adjudication",
      namedFacts([
        ["partialReceiptWriteFailed", () => partialReceiptWriteFailed],
        ["partialReceiptRejected", () => partialReceiptRejected],
        ["partialReceiptRetryRejected", () => partialReceiptRetryRejected],
        [
          "partialReceiptDirectoryCount",
          () => fs.readdirSync(partialReceiptDirectory).length === 1,
        ],
        [
          "partialReceiptDirectoryCaptureReceiptGenerationName",
          () =>
            fs.statSync(
              path.join(
                partialReceiptDirectory,
                captureReceiptGenerationName(nextCaptureReceipt),
              ),
            ).size === 1,
        ],
      ]),
      {
        partialReceiptWriteFailed: true,
        partialReceiptRejected: true,
        partialReceiptRetryRejected: true,
        partialReceiptDirectoryCount: true,
        partialReceiptDirectoryCaptureReceiptGenerationName: true,
      },
    );

    const crashReceiptProject = path.join(base, "crash-receipt-project");
    const crashReceiptDirectory = path.join(
      crashReceiptProject,
      ".automovie",
      "capture",
      "install-receipts",
    );
    const crashReceiptPath = path.join(
      crashReceiptDirectory,
      captureReceiptGenerationName(nextCaptureReceipt),
    );
    const crashReceiptBytes = Buffer.from("interrupted receipt publication");
    fs.mkdirSync(crashReceiptDirectory, { recursive: true });
    fs.writeFileSync(crashReceiptPath, crashReceiptBytes);
    TestValidator.equals(
      "capture install preserves and identifies an unowned crash residue",
      namedFacts([
        [
          "adjudicate",
          () =>
            throwsWith(
              () =>
                captureBrowserModule.publishCaptureInstallReceipt(
                  crashReceiptProject,
                  nextCaptureReceipt,
                  () => undefined,
                ),
              "Manually adjudicate",
            ),
        ],
        [
          "preserved",
          () => fs.readFileSync(crashReceiptPath).equals(crashReceiptBytes),
        ],
      ]),
      { adjudicate: true, preserved: true },
    );

    const oversizedReceiptProject = path.join(
      base,
      "oversized-receipt-project",
    );
    const oversizedReceiptDirectory = path.join(
      oversizedReceiptProject,
      ".automovie",
      "capture",
      "install-receipts",
    );
    const oversizedReceiptPath = path.join(
      oversizedReceiptDirectory,
      captureReceiptGenerationName(nextCaptureReceipt),
    );
    const oversizedReceiptBytes = Buffer.alloc(64 * 1024 + 1, 0x20);
    fs.mkdirSync(oversizedReceiptDirectory, { recursive: true });
    fs.writeFileSync(oversizedReceiptPath, oversizedReceiptBytes);
    const oversizedReceiptDescriptors = new Set<number>();
    let oversizedReceiptRead = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "r" &&
        path.resolve(file.toString()) === oversizedReceiptPath
      )
        oversizedReceiptDescriptors.add(descriptor);
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.readSync = ((...args: unknown[]): number => {
      if (
        typeof args[0] === "number" &&
        oversizedReceiptDescriptors.has(args[0])
      )
        oversizedReceiptRead = true;
      return Reflect.apply(nativeRead, mutableFs, args) as number;
    }) as typeof fs.readSync;
    let oversizedReceiptReadRejected = false;
    let oversizedReceiptPublishRejected = false;
    let oversizedReceiptCleanupFailure: { error: unknown } | undefined;
    try {
      oversizedReceiptReadRejected = throwsWith(
        () =>
          captureBrowserModule.readCaptureInstallReceipt(
            oversizedReceiptProject,
          ),
        "exceeds its maximum byte length",
      );
      oversizedReceiptPublishRejected = throwsWith(
        () =>
          captureBrowserModule.publishCaptureInstallReceipt(
            oversizedReceiptProject,
            nextCaptureReceipt,
            () => undefined,
          ),
        "Manually adjudicate",
      );
    } catch (error) {
      oversizedReceiptCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(oversizedReceiptCleanupFailure, [
        {
          resource: "capture receipt oversized open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "capture receipt oversized read hook",
          cleanup: () => {
            mutableFs.readSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install bounds current and competing receipt descriptors before hashing",
      namedFacts([
        ["oversizedReceiptReadRejected", () => oversizedReceiptReadRejected],
        [
          "oversizedReceiptPublishRejected",
          () => oversizedReceiptPublishRejected,
        ],
        ["oversizedReceiptRead", () => oversizedReceiptRead === false],
        [
          "oversizedReceiptPathCount",
          () =>
            fs.statSync(oversizedReceiptPath).size ===
            oversizedReceiptBytes.length,
        ],
      ]),
      {
        oversizedReceiptReadRejected: true,
        oversizedReceiptPublishRejected: true,
        oversizedReceiptRead: true,
        oversizedReceiptPathCount: true,
      },
    );

    const receiptTargetSwapProject = path.join(
      base,
      "receipt-target-swap-project",
    );
    fs.mkdirSync(receiptTargetSwapProject);
    let receiptTargetSwapDescriptor = -1;
    let receiptTargetSwapPath = "";
    let receiptTargetSwapped = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(path.dirname(file.toString())) === "install-receipts"
      ) {
        receiptTargetSwapDescriptor = descriptor;
        receiptTargetSwapPath = path.resolve(file.toString());
      }
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fsyncSync = ((descriptor: number): void => {
      if (
        receiptTargetSwapped === false &&
        descriptor === receiptTargetSwapDescriptor
      ) {
        const parked = `${receiptTargetSwapPath}.parked`;
        nativeRename(receiptTargetSwapPath, parked);
        nativeWriteFile(receiptTargetSwapPath, fs.readFileSync(parked));
        receiptTargetSwapped = true;
      }
      nativeFsync(descriptor);
    }) as typeof fs.fsyncSync;
    let receiptTargetSwapRejected = false;
    let receiptTargetSwapCleanupFailure: { error: unknown } | undefined;
    try {
      receiptTargetSwapRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          receiptTargetSwapProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } catch (error) {
      receiptTargetSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptTargetSwapCleanupFailure, [
        {
          resource: "capture receipt target open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "capture receipt target fsync hook",
          cleanup: () => {
            mutableFs.fsyncSync = nativeFsync;
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install preserves a final-slot successor after descriptor open",
      namedFacts([
        ["receiptTargetSwapped", () => receiptTargetSwapped],
        ["receiptTargetSwapRejected", () => receiptTargetSwapRejected],
        [
          "receiptTargetSwapPathResident",
          () => fs.existsSync(receiptTargetSwapPath),
        ],
        ["$Resident", () => fs.existsSync(`${receiptTargetSwapPath}.parked`)],
      ]),
      {
        receiptTargetSwapped: true,
        receiptTargetSwapRejected: true,
        receiptTargetSwapPathResident: true,
        $Resident: true,
      },
    );

    const receiptParentSwapProject = path.join(
      base,
      "receipt-parent-swap-project",
    );
    fs.mkdirSync(receiptParentSwapProject);
    let receiptParentSwapPath = "";
    let parkedReceiptParent = "";
    // One holder carries the swap's outcome — pending, swapped, or the message
    // the swap itself failed with. This renames a directory that holds the
    // descriptor just opened inside it, and a refusal from the injection is
    // otherwise indistinguishable from the product's own.
    let receiptParentSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        receiptParentSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(path.dirname(file.toString())) === "install-receipts"
      ) {
        receiptParentSwapPath = path.resolve(file.toString());
        const parent = path.dirname(receiptParentSwapPath);
        parkedReceiptParent = `${parent}.parked`;
        receiptParentSwap = "swapped";
        try {
          nativeRename(parent, parkedReceiptParent);
          nativeMkdir(parent);
          nativeWriteFile(path.join(parent, "successor.marker"), "successor");
        } catch (error) {
          receiptParentSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let receiptParentSwapRejected = false;
    let receiptParentSwapCleanupFailure: { error: unknown } | undefined;
    try {
      receiptParentSwapRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          receiptParentSwapProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } catch (error) {
      receiptParentSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptParentSwapCleanupFailure, [
        {
          resource: "capture receipt parent swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    // Windows refuses to rename a directory that holds an open descriptor, and
    // the run proved it: `EPERM: operation not permitted, rename
    // 'install-receipts' -> 'install-receipts.parked'`. The publication holds
    // this descriptor for its whole run, so on that platform the successor
    // cannot be installed at all, and what the scenario can still assert is
    // that nothing was disturbed by the attempt.
    TestValidator.equals(
      "capture install preserves a generation-directory successor after descriptor open",
      {
        swap: /^(EPERM|EBUSY|EACCES)\b/u.test(receiptParentSwap)
          ? "rename refused"
          : receiptParentSwap,
        ...namedFacts([
          [
            "receiptParentSwapRejected",
            () =>
              receiptParentSwapRejected === (receiptParentSwap === "swapped"),
          ],
          [
            "receiptParentSwapPathSuccessor",
            () =>
              receiptParentSwap !== "swapped" ||
              fs.readFileSync(
                path.join(
                  path.dirname(receiptParentSwapPath),
                  "successor.marker",
                ),
                "utf8",
              ) === "successor",
          ],
          [
            "parkedReceiptParentResident",
            () =>
              receiptParentSwap !== "swapped" ||
              fs.existsSync(
                path.join(
                  parkedReceiptParent,
                  path.basename(receiptParentSwapPath),
                ),
              ),
          ],
        ]),
      },
      {
        swap: receiptParentSwap === "swapped" ? "swapped" : "rename refused",
        // With no successor installed there is nothing for the publication to
        // refuse, so the refusal is expected exactly when the swap happened.
        receiptParentSwapRejected: true,
        receiptParentSwapPathSuccessor: true,
        parkedReceiptParentResident: true,
      },
    );

    const foreignReceiptProject = path.join(base, "foreign-receipt-project");
    fs.mkdirSync(foreignReceiptProject);
    let foreignReceiptPath = "";
    const foreignReceiptBytes = Buffer.from("foreign receipt generation\n");
    let foreignReceiptInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        foreignReceiptInserted === false &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(path.dirname(file.toString())) === "install-receipts"
      ) {
        foreignReceiptPath = path.resolve(file.toString());
        nativeWriteFile(foreignReceiptPath, foreignReceiptBytes);
        foreignReceiptInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let foreignReceiptRejected = false;
    let foreignReceiptCleanupFailure: { error: unknown } | undefined;
    try {
      foreignReceiptRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          foreignReceiptProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } catch (error) {
      foreignReceiptCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(foreignReceiptCleanupFailure, [
        {
          resource: "capture foreign receipt open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install preserves a foreign generation-slot competitor",
      namedFacts([
        ["foreignReceiptInserted", () => foreignReceiptInserted],
        ["foreignReceiptRejected", () => foreignReceiptRejected],
        [
          "foreignReceiptPathForeignReceiptBytes",
          () => fs.readFileSync(foreignReceiptPath).equals(foreignReceiptBytes),
        ],
      ]),
      {
        foreignReceiptInserted: true,
        foreignReceiptRejected: true,
        foreignReceiptPathForeignReceiptBytes: true,
      },
    );

    const upgradedCaptureReceipt = {
      ...nextCaptureReceipt,
      browser: {
        ...nextCaptureReceipt.browser,
        revision: `${installedCaptureMetadata.browser.revision}-upgrade`,
      },
    };
    captureBrowserModule.publishCaptureInstallReceipt(
      captureProject,
      upgradedCaptureReceipt,
      () => undefined,
    );
    TestValidator.equals(
      "capture install retains immutable receipt generations across upgrades",
      namedFacts([
        [
          "receiptGenerationDirectoryCount",
          () => fs.readdirSync(receiptGenerationDirectory).length === 2,
        ],
        [
          "captureBrowserModuleReadCaptureInstallReceipt",
          () =>
            captureBrowserModule.readCaptureInstallReceipt(captureProject)
              .browser.revision === installedCaptureMetadata.browser.revision,
        ],
        [
          "captureReceiptCaptureReceiptBytes",
          () => fs.readFileSync(captureReceipt).equals(captureReceiptBytes),
        ],
      ]),
      {
        receiptGenerationDirectoryCount: true,
        captureBrowserModuleReadCaptureInstallReceipt: true,
        captureReceiptCaptureReceiptBytes: true,
      },
    );

    const legacyFallbackProject = path.join(
      base,
      "legacy-fallback-receipt-project",
    );
    const legacyFallbackReceipt = path.join(
      legacyFallbackProject,
      ".automovie",
      "capture",
      "install-receipt.json",
    );
    fs.mkdirSync(path.dirname(legacyFallbackReceipt), { recursive: true });
    fs.writeFileSync(legacyFallbackReceipt, captureReceiptBytes);
    captureBrowserModule.publishCaptureInstallReceipt(
      legacyFallbackProject,
      upgradedCaptureReceipt,
      () => undefined,
    );
    TestValidator.predicate(
      "capture install falls back to legacy when only a non-current generation exists",
      captureBrowserModule.readCaptureInstallReceipt(legacyFallbackProject)
        .browser.revision === captureReceiptValue.browser.revision,
    );

    const receiptReadSuccessor = {
      ...nextCaptureReceipt,
      installSource: "PLAYWRIGHT_DOWNLOAD_HOST",
    } as const;
    const receiptReadSuccessorBytes = Buffer.from(
      `${JSON.stringify(receiptReadSuccessor, null, 2)}\n`,
    );
    const parkedReceiptReadDirectory = `${receiptGenerationDirectory}.read-parked`;
    const successorReceiptReadDirectory = `${receiptGenerationDirectory}.read-successor`;
    fs.mkdirSync(successorReceiptReadDirectory);
    fs.writeFileSync(
      path.join(
        successorReceiptReadDirectory,
        path.basename(receiptGenerationFile),
      ),
      receiptReadSuccessorBytes,
    );
    let receiptReadDirectorySwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        receiptReadDirectorySwapped === false &&
        path.resolve(file.toString()) === receiptGenerationFile
      ) {
        nativeRename(receiptGenerationDirectory, parkedReceiptReadDirectory);
        nativeRename(successorReceiptReadDirectory, receiptGenerationDirectory);
        receiptReadDirectorySwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let receiptReadDirectoryRejected = false;
    let receiptReadDirectoryCleanupFailure: { error: unknown } | undefined;
    try {
      receiptReadDirectoryRejected = throws(() =>
        captureBrowserModule.readCaptureInstallReceipt(captureProject),
      );
    } catch (error) {
      receiptReadDirectoryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptReadDirectoryCleanupFailure, [
        {
          resource: "capture receipt directory lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "capture receipt successor directory",
          cleanup: () => {
            fs.rmSync(receiptGenerationDirectory, {
              recursive: true,
              force: true,
            });
          },
        },
        {
          resource: "capture receipt resident directory",
          cleanup: () => {
            nativeRename(
              parkedReceiptReadDirectory,
              receiptGenerationDirectory,
            );
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install binds current-generation selection through directory read",
      namedFacts([
        ["swapped", () => receiptReadDirectorySwapped],
        ["rejected", () => receiptReadDirectoryRejected],
      ]),
      { swapped: true, rejected: true },
    );

    const parkedReceiptReadRoot = `${captureProject}.read-parked`;
    const successorReceiptReadRoot = `${captureProject}.read-successor`;
    const successorReceiptReadFile = path.join(
      successorReceiptReadRoot,
      path.relative(captureProject, receiptGenerationFile),
    );
    fs.mkdirSync(path.dirname(successorReceiptReadFile), { recursive: true });
    fs.writeFileSync(successorReceiptReadFile, receiptReadSuccessorBytes);
    let receiptReadRootSwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        receiptReadRootSwapped === false &&
        path.resolve(file.toString()) === receiptGenerationFile
      ) {
        nativeRename(captureProject, parkedReceiptReadRoot);
        nativeRename(successorReceiptReadRoot, captureProject);
        receiptReadRootSwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let receiptReadRootRejected = false;
    let receiptReadRootCleanupFailure: { error: unknown } | undefined;
    try {
      receiptReadRootRejected = throws(() =>
        captureBrowserModule.readCaptureInstallReceipt(captureProject),
      );
    } catch (error) {
      receiptReadRootCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptReadRootCleanupFailure, [
        {
          resource: "capture receipt root lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "capture receipt successor root",
          cleanup: () => {
            fs.rmSync(captureProject, { recursive: true, force: true });
          },
        },
        {
          resource: "capture receipt resident root",
          cleanup: () => {
            nativeRename(parkedReceiptReadRoot, captureProject);
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install binds current-generation selection through project-root read",
      namedFacts([
        ["swapped", () => receiptReadRootSwapped],
        ["rejected", () => receiptReadRootRejected],
      ]),
      { swapped: true, rejected: true },
    );

    const mismatchedReceiptProject = path.join(
      base,
      "mismatched-generation-receipt-project",
    );
    const mismatchedReceiptDirectory = path.join(
      mismatchedReceiptProject,
      ".automovie",
      "capture",
      "install-receipts",
    );
    const mismatchedReceiptPath = path.join(
      mismatchedReceiptDirectory,
      captureReceiptGenerationName(nextCaptureReceipt),
    );
    fs.mkdirSync(mismatchedReceiptDirectory, { recursive: true });
    fs.writeFileSync(
      mismatchedReceiptPath,
      `${JSON.stringify(upgradedCaptureReceipt)}\n`,
    );
    TestValidator.predicate(
      "capture install rejects a receipt occupying another canonical filename",
      throwsWith(
        () =>
          captureBrowserModule.readCaptureInstallReceipt(
            mismatchedReceiptProject,
          ),
        "occupies another generation",
      ),
    );

    const malformedSchemaProject = path.join(
      base,
      "malformed-generation-schema-project",
    );
    const malformedSchemaDirectory = path.join(
      malformedSchemaProject,
      ".automovie",
      "capture",
      "install-receipts",
    );
    const malformedSchemaPath = path.join(
      malformedSchemaDirectory,
      captureReceiptGenerationName(nextCaptureReceipt),
    );
    fs.mkdirSync(malformedSchemaDirectory, { recursive: true });
    fs.writeFileSync(
      malformedSchemaPath,
      `${JSON.stringify({ ...nextCaptureReceipt, unexpected: true })}\n`,
    );
    TestValidator.predicate(
      "capture install strictly parses the selected immutable receipt",
      throwsWith(
        () =>
          captureBrowserModule.readCaptureInstallReceipt(
            malformedSchemaProject,
          ),
        "is malformed",
      ),
    );

    const malformedReceiptProject = path.join(
      base,
      "malformed-generation-inventory-project",
    );
    const malformedReceiptDirectory = path.join(
      malformedReceiptProject,
      ".automovie",
      "capture",
      "install-receipts",
    );
    fs.mkdirSync(malformedReceiptDirectory, { recursive: true });
    fs.writeFileSync(path.join(malformedReceiptDirectory, "foreign.txt"), "x");
    TestValidator.predicate(
      "capture install rejects a malformed immutable generation inventory",
      throwsWith(
        () =>
          captureBrowserModule.readCaptureInstallReceipt(
            malformedReceiptProject,
          ),
        "inventory is malformed",
      ),
    );
    const linkedReceiptProject = path.join(base, "linked-receipt-project");
    const linkedReceiptOutside = path.join(base, "linked-receipt-outside");
    const linkedReceiptMarker = path.join(linkedReceiptOutside, "marker.txt");
    fs.mkdirSync(linkedReceiptProject);
    fs.mkdirSync(linkedReceiptOutside);
    fs.writeFileSync(linkedReceiptMarker, "outside");
    fs.symlinkSync(
      linkedReceiptOutside,
      path.join(linkedReceiptProject, ".automovie"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedReceiptRejected = throws(() =>
      captureBrowserModule.publishCaptureInstallReceipt(
        linkedReceiptProject,
        nextCaptureReceipt,
        () => undefined,
      ),
    );
    TestValidator.equals(
      "capture install refuses a linked receipt ancestry before external writes",
      namedFacts([
        ["linkedReceiptRejected", () => linkedReceiptRejected],
        [
          "linkedReceiptMarkerUtf8",
          () => fs.readFileSync(linkedReceiptMarker, "utf8") === "outside",
        ],
        [
          "linkedReceiptOutsideResident",
          () =>
            fs.existsSync(
              path.join(linkedReceiptOutside, "capture", "install-receipts"),
            ) === false,
        ],
      ]),
      {
        linkedReceiptRejected: true,
        linkedReceiptMarkerUtf8: true,
        linkedReceiptOutsideResident: true,
      },
    );
    const segmentReceiptProject = path.join(base, "segment-receipt-project");
    const segmentReceiptOutside = path.join(base, "segment-receipt-outside");
    const segmentAutomovie = path.join(segmentReceiptProject, ".automovie");
    const parkedSegmentAutomovie = `${segmentAutomovie}.parked`;
    fs.mkdirSync(segmentReceiptProject);
    fs.mkdirSync(segmentReceiptOutside);
    let receiptSegmentSwapped = false;
    mutableFs.statSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeStat, mutableFs, [file, ...args]);
      if (
        receiptSegmentSwapped === false &&
        path.resolve(file.toString()) === segmentAutomovie
      ) {
        receiptSegmentSwapped = true;
        fs.renameSync(segmentAutomovie, parkedSegmentAutomovie);
        fs.symlinkSync(
          segmentReceiptOutside,
          segmentAutomovie,
          process.platform === "win32" ? "junction" : "dir",
        );
      }
      return status;
    }) as typeof fs.statSync;
    let receiptSegmentRaceRejected = false;
    let receiptSegmentCleanupFailure: { error: unknown } | undefined;
    try {
      receiptSegmentRaceRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          segmentReceiptProject,
          nextCaptureReceipt,
          () => undefined,
        ),
      );
    } catch (error) {
      receiptSegmentCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptSegmentCleanupFailure, [
        {
          resource: "capture receipt segment stat hook",
          cleanup: () => {
            mutableFs.statSync = nativeStat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install revalidates each created segment before the next write",
      namedFacts([
        ["receiptSegmentSwapped", () => receiptSegmentSwapped],
        ["receiptSegmentRaceRejected", () => receiptSegmentRaceRejected],
        [
          "segmentReceiptOutsideResident",
          () =>
            fs.existsSync(path.join(segmentReceiptOutside, "capture")) ===
            false,
        ],
      ]),
      {
        receiptSegmentSwapped: true,
        receiptSegmentRaceRejected: true,
        segmentReceiptOutsideResident: true,
      },
    );
    fs.rmSync(segmentAutomovie, { force: true });
    fs.renameSync(parkedSegmentAutomovie, segmentAutomovie);
    const publishedReceiptBytes = fs.readFileSync(captureReceipt);
    const parkedCaptureProject = `${captureProject}.parked`;
    // One holder carries the swap's outcome — pending, swapped, or the message
    // the swap itself failed with — because this test's static contracts pin the
    // top-level statement indices around it.
    let receiptRootSwap = "pending";
    let parkedReceiptGeneration = "";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        receiptRootSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(path.dirname(file.toString())) === "install-receipts"
      ) {
        receiptRootSwap = "swapped";
        parkedReceiptGeneration = path.join(
          parkedCaptureProject,
          path.relative(captureProject, path.resolve(file.toString())),
        );
        // The publication holds this descriptor for its whole run, so the swap
        // has to happen here, while it is open. Record what the swap itself did:
        // moving it to the descriptor's close put it after the ancestry checks
        // and the publication stopped refusing, and a refusal from this hook
        // would otherwise be indistinguishable from the product's own.
        try {
          fs.renameSync(captureProject, parkedCaptureProject);
          fs.mkdirSync(path.dirname(captureReceipt), { recursive: true });
          nativeWriteFile(captureReceipt, publishedReceiptBytes);
        } catch (error) {
          receiptRootSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let receiptRootRaceRejected = false;
    let receiptRootCleanupFailure: { error: unknown } | undefined;
    try {
      receiptRootRaceRejected = throws(() =>
        captureBrowserModule.publishCaptureInstallReceipt(
          captureProject,
          captureReceiptValue,
          () => undefined,
        ),
      );
    } catch (error) {
      receiptRootCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptRootCleanupFailure, [
        {
          resource: "capture receipt root swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "capture install rejects a project root successor without cleaning it",
      {
        // Windows refuses to rename a directory that holds an open descriptor,
        // and the publication holds this one for its whole run, so the successor
        // cannot be installed there. Where the rename is refused the scenario
        // asserts that nothing was disturbed instead.
        swap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(receiptRootSwap)
          ? "rename refused"
          : receiptRootSwap,
        ...namedFacts([
          [
            "receiptRootRaceRejected",
            () => receiptRootRaceRejected === (receiptRootSwap === "swapped"),
          ],
          [
            "captureReceiptPublishedReceiptBytes",
            () => fs.readFileSync(captureReceipt).equals(publishedReceiptBytes),
          ],
          [
            "parkedReceiptGenerationResident",
            () =>
              receiptRootSwap !== "swapped" ||
              fs.existsSync(parkedReceiptGeneration),
          ],
        ]),
      },
      {
        swap: receiptRootSwap === "swapped" ? "swapped" : "rename refused",
        receiptRootRaceRejected: true,
        captureReceiptPublishedReceiptBytes: true,
        parkedReceiptGenerationResident: true,
      },
    );
    // Restore only what the injection managed to park: Windows refuses to
    // rename a directory holding an open descriptor, so on that platform the
    // project root was never moved. Each step guards itself, because this
    // test's static contracts pin the top-level statement indices.
    if (fs.existsSync(parkedCaptureProject))
      fs.rmSync(captureProject, { recursive: true, force: true });
    if (fs.existsSync(parkedCaptureProject))
      fs.renameSync(parkedCaptureProject, captureProject);

    const dialogueCacheModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "dialogueCacheSnapshot.ts"),
    ) as {
      captureDialogueCache: (
        base: string,
        target: string,
      ) => { pcm: Uint8Array; receipt: Uint8Array };
      publishDialogueCache: (props: {
        base: string;
        pcm: Uint8Array;
        receipt: Uint8Array;
        target: string;
      }) => { pcm: Uint8Array; receipt: Uint8Array };
    };
    const dialogueRoot = path.join(base, "dialogue-cache");
    const dialogueTarget = path.join(dialogueRoot, "first");
    const dialoguePcm = Buffer.from("dialogue pcm generation");
    const dialogueReceipt = Buffer.from('{"generation":"first"}\n');
    const writeDialogueFixture = (
      target: string,
      pcm: Uint8Array,
      receipt: Uint8Array,
    ): void => {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "audio.f32"), pcm);
      fs.writeFileSync(path.join(target, "receipt.json"), receipt);
    };
    fs.mkdirSync(dialogueRoot);
    const firstDialogueCache = dialogueCacheModule.publishDialogueCache({
      base: dialogueRoot,
      pcm: dialoguePcm,
      receipt: dialogueReceipt,
      target: dialogueTarget,
    });
    const reusedDialogueCache = dialogueCacheModule.publishDialogueCache({
      base: dialogueRoot,
      pcm: dialoguePcm,
      receipt: dialogueReceipt,
      target: dialogueTarget,
    });
    TestValidator.equals(
      "dialogue cache publishes and reuses one exact PCM receipt generation",
      namedFacts([
        [
          "firstDialogueCachePcm",
          () => Buffer.from(firstDialogueCache.pcm).equals(dialoguePcm),
        ],
        [
          "reusedDialogueCacheReceipt",
          () =>
            Buffer.from(reusedDialogueCache.receipt).equals(dialogueReceipt),
        ],
        [
          "dialogueTargetIsDirectory",
          () => fs.lstatSync(dialogueTarget).isDirectory(),
        ],
        [
          "dialogueTargetCompareCodeUnits",
          () =>
            fs.readdirSync(dialogueTarget).sort(compareCodeUnits).join(",") ===
            "audio.f32,receipt.json",
        ],
      ]),
      {
        firstDialogueCachePcm: true,
        reusedDialogueCacheReceipt: true,
        dialogueTargetIsDirectory: true,
        dialogueTargetCompareCodeUnits: true,
      },
    );

    const reuseAbaDialogueTarget = path.join(dialogueRoot, "reuse-aba");
    const reuseAbaDialogueSuccessor = `${reuseAbaDialogueTarget}.successor`;
    const reuseAbaDialogueParked = `${reuseAbaDialogueTarget}.parked`;
    const reuseAbaDialoguePcm = Buffer.from("different dialogue generation");
    writeDialogueFixture(reuseAbaDialogueTarget, dialoguePcm, dialogueReceipt);
    writeDialogueFixture(
      reuseAbaDialogueSuccessor,
      reuseAbaDialoguePcm,
      Buffer.from('{"generation":"successor"}\n'),
    );
    const reuseAbaDialogueAudio = path.join(
      reuseAbaDialogueTarget,
      "audio.f32",
    );
    let reuseAbaDialogueOpens = 0;
    // One holder carries the swap's outcome — pending, swapped, or the message
    // the swap failed with. Windows refuses to rename a directory that holds an
    // open descriptor, and this injection fires while one is open.
    let reuseAbaDialogueSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === reuseAbaDialogueAudio &&
        ++reuseAbaDialogueOpens === 3
      ) {
        reuseAbaDialogueSwap = "swapped";
        try {
          nativeRename(reuseAbaDialogueTarget, reuseAbaDialogueParked);
          nativeRename(reuseAbaDialogueSuccessor, reuseAbaDialogueTarget);
        } catch (error) {
          reuseAbaDialogueSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let reuseAbaDialogueRejected = false;
    let reuseAbaDialogueCleanupFailure: { error: unknown } | undefined;
    try {
      reuseAbaDialogueRejected = throws(() =>
        dialogueCacheModule.publishDialogueCache({
          base: dialogueRoot,
          pcm: dialoguePcm,
          receipt: dialogueReceipt,
          target: reuseAbaDialogueTarget,
        }),
      );
    } catch (error) {
      reuseAbaDialogueCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(reuseAbaDialogueCleanupFailure, [
        {
          resource: "dialogue cache reuse ABA open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "dialogue cache publication reuse rejects a directory successor",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(reuseAbaDialogueSwap)
          ? "rename refused"
          : reuseAbaDialogueSwap,
        ...namedFacts([
          [
            "reuseAbaDialogueRejected",
            () =>
              reuseAbaDialogueRejected === (reuseAbaDialogueSwap === "swapped"),
          ],
          [
            // Without the swap the reuse publication completes and owns the
            // target, so the bytes this checks are only the scenario's when the
            // injection actually installed the successor.
            "reuseAbaDialogueTargetAudio",
            () =>
              reuseAbaDialogueSwap !== "swapped" ||
              fs
                .readFileSync(path.join(reuseAbaDialogueTarget, "audio.f32"))
                .equals(reuseAbaDialoguePcm),
          ],
          [
            "reuseAbaDialogueParkedResident",
            () =>
              reuseAbaDialogueSwap !== "swapped" ||
              fs.existsSync(reuseAbaDialogueParked),
          ],
        ]),
      },
      {
        swap: reuseAbaDialogueSwap === "swapped" ? "swapped" : "rename refused",
        reuseAbaDialogueRejected: true,
        reuseAbaDialogueTargetAudio: true,
        reuseAbaDialogueParkedResident: true,
      },
    );

    const partialDialogueTarget = path.join(dialogueRoot, "partial");
    fs.mkdirSync(partialDialogueTarget);
    fs.writeFileSync(
      path.join(partialDialogueTarget, "audio.f32"),
      dialoguePcm,
    );
    const partialDialogueStatus = fs.lstatSync(partialDialogueTarget, {
      bigint: true,
    });
    dialogueCacheModule.publishDialogueCache({
      base: dialogueRoot,
      pcm: dialoguePcm,
      receipt: dialogueReceipt,
      target: partialDialogueTarget,
    });
    TestValidator.equals(
      "dialogue cache monotonically completes an exact partial generation",
      namedFacts([
        [
          "targetIdentityKept",
          () => {
            const status = fs.lstatSync(partialDialogueTarget, {
              bigint: true,
            });
            return (
              status.dev === partialDialogueStatus.dev &&
              status.ino === partialDialogueStatus.ino
            );
          },
        ],
        [
          "captureAccepted",
          () =>
            !throws(() =>
              dialogueCacheModule.captureDialogueCache(
                dialogueRoot,
                partialDialogueTarget,
              ),
            ),
        ],
      ]),
      {
        targetIdentityKept: true,
        captureAccepted: true,
      },
    );

    const receiptOnlyDialogueTarget = path.join(dialogueRoot, "receipt-only");
    fs.mkdirSync(receiptOnlyDialogueTarget);
    fs.writeFileSync(
      path.join(receiptOnlyDialogueTarget, "receipt.json"),
      dialogueReceipt,
    );
    const receiptOnlyDialogueRejected = throws(() =>
      dialogueCacheModule.publishDialogueCache({
        base: dialogueRoot,
        pcm: dialoguePcm,
        receipt: dialogueReceipt,
        target: receiptOnlyDialogueTarget,
      }),
    );
    TestValidator.equals(
      "dialogue cache never completes PCM after a visible receipt",
      namedFacts([
        ["receiptOnlyDialogueRejected", () => receiptOnlyDialogueRejected],
        [
          "receiptOnlyDialogueTargetResident",
          () =>
            fs.existsSync(path.join(receiptOnlyDialogueTarget, "audio.f32")) ===
            false,
        ],
        [
          "receiptOnlyDialogueTargetReceipt",
          () =>
            fs
              .readFileSync(
                path.join(receiptOnlyDialogueTarget, "receipt.json"),
              )
              .equals(dialogueReceipt),
        ],
      ]),
      {
        receiptOnlyDialogueRejected: true,
        receiptOnlyDialogueTargetResident: true,
        receiptOnlyDialogueTargetReceipt: true,
      },
    );

    const foreignDialogueTarget = path.join(dialogueRoot, "foreign");
    const foreignDialoguePcm = Buffer.from("foreign dialogue pcm");
    fs.mkdirSync(foreignDialogueTarget);
    fs.writeFileSync(
      path.join(foreignDialogueTarget, "audio.f32"),
      foreignDialoguePcm,
    );
    const foreignDialogueRejected = throws(() =>
      dialogueCacheModule.publishDialogueCache({
        base: dialogueRoot,
        pcm: dialoguePcm,
        receipt: dialogueReceipt,
        target: foreignDialogueTarget,
      }),
    );
    TestValidator.equals(
      "dialogue cache preserves a byte-different concurrent PCM winner",
      namedFacts([
        ["foreignDialogueRejected", () => foreignDialogueRejected],
        [
          "foreignDialogueTargetAudio",
          () =>
            fs
              .readFileSync(path.join(foreignDialogueTarget, "audio.f32"))
              .equals(foreignDialoguePcm),
        ],
        [
          "foreignDialogueTargetResident",
          () =>
            fs.existsSync(path.join(foreignDialogueTarget, "receipt.json")) ===
            false,
        ],
      ]),
      {
        foreignDialogueRejected: true,
        foreignDialogueTargetAudio: true,
        foreignDialogueTargetResident: true,
      },
    );

    const pcmSuccessorTarget = path.join(dialogueRoot, "pcm-successor");
    const pcmSuccessorPath = path.join(pcmSuccessorTarget, "audio.f32");
    let pcmSuccessorInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        pcmSuccessorInserted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === pcmSuccessorPath &&
        flags === "wx+"
      ) {
        nativeWriteFile(pcmSuccessorPath, foreignDialoguePcm);
        pcmSuccessorInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let pcmSuccessorRejected = false;
    let pcmSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      pcmSuccessorRejected = throws(() =>
        dialogueCacheModule.publishDialogueCache({
          base: dialogueRoot,
          pcm: dialoguePcm,
          receipt: dialogueReceipt,
          target: pcmSuccessorTarget,
        }),
      );
    } catch (error) {
      pcmSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(pcmSuccessorCleanupFailure, [
        {
          resource: "dialogue cache PCM successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "dialogue cache preserves a PCM successor at commit",
      namedFacts([
        ["pcmSuccessorInserted", () => pcmSuccessorInserted],
        ["pcmSuccessorRejected", () => pcmSuccessorRejected],
        [
          "pcmSuccessorPathForeignDialoguePcm",
          () => fs.readFileSync(pcmSuccessorPath).equals(foreignDialoguePcm),
        ],
        [
          "pcmSuccessorTargetResident",
          () =>
            fs.existsSync(path.join(pcmSuccessorTarget, "receipt.json")) ===
            false,
        ],
      ]),
      {
        pcmSuccessorInserted: true,
        pcmSuccessorRejected: true,
        pcmSuccessorPathForeignDialoguePcm: true,
        pcmSuccessorTargetResident: true,
      },
    );

    const receiptSuccessorTarget = path.join(dialogueRoot, "receipt-successor");
    const receiptSuccessorPath = path.join(
      receiptSuccessorTarget,
      "receipt.json",
    );
    const foreignDialogueReceipt = Buffer.from('{"foreign":true}\n');
    let receiptSuccessorInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        receiptSuccessorInserted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === receiptSuccessorPath &&
        flags === "wx+"
      ) {
        nativeWriteFile(receiptSuccessorPath, foreignDialogueReceipt);
        receiptSuccessorInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let receiptSuccessorRejected = false;
    let receiptSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      receiptSuccessorRejected = throws(() =>
        dialogueCacheModule.publishDialogueCache({
          base: dialogueRoot,
          pcm: dialoguePcm,
          receipt: dialogueReceipt,
          target: receiptSuccessorTarget,
        }),
      );
    } catch (error) {
      receiptSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(receiptSuccessorCleanupFailure, [
        {
          resource: "dialogue cache receipt successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "dialogue cache preserves a receipt successor at commit",
      namedFacts([
        ["receiptSuccessorInserted", () => receiptSuccessorInserted],
        ["receiptSuccessorRejected", () => receiptSuccessorRejected],
        [
          "receiptSuccessorPathForeignDialogueReceipt",
          () =>
            fs
              .readFileSync(receiptSuccessorPath)
              .equals(foreignDialogueReceipt),
        ],
      ]),
      {
        receiptSuccessorInserted: true,
        receiptSuccessorRejected: true,
        receiptSuccessorPathForeignDialogueReceipt: true,
      },
    );

    const oversizedDialogueTarget = path.join(dialogueRoot, "oversized");
    fs.mkdirSync(oversizedDialogueTarget);
    fs.writeFileSync(
      path.join(oversizedDialogueTarget, "audio.f32"),
      dialoguePcm,
    );
    fs.writeFileSync(path.join(oversizedDialogueTarget, "receipt.json"), "{");
    fs.truncateSync(
      path.join(oversizedDialogueTarget, "receipt.json"),
      8 * 1024 * 1024 + 1,
    );
    TestValidator.predicate(
      "dialogue cache rejects a receipt beyond its bounded read",
      throws(() =>
        dialogueCacheModule.captureDialogueCache(
          dialogueRoot,
          oversizedDialogueTarget,
        ),
      ),
    );

    const abaDialogueTarget = path.join(dialogueRoot, "aba");
    const abaDialogueSuccessor = `${abaDialogueTarget}.successor`;
    const abaDialogueParked = `${abaDialogueTarget}.parked`;
    writeDialogueFixture(abaDialogueTarget, dialoguePcm, dialogueReceipt);
    writeDialogueFixture(abaDialogueSuccessor, dialoguePcm, dialogueReceipt);
    const abaDialogueAudio = path.join(abaDialogueTarget, "audio.f32");
    let abaDialogueAudioOpens = 0;
    // Windows refuses to rename a directory that holds an open descriptor, so
    // this holder carries the swap's outcome instead of a boolean.
    let abaDialogueSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === abaDialogueAudio &&
        ++abaDialogueAudioOpens === 3
      ) {
        abaDialogueSwap = "swapped";
        try {
          nativeRename(abaDialogueTarget, abaDialogueParked);
          nativeRename(abaDialogueSuccessor, abaDialogueTarget);
        } catch (error) {
          abaDialogueSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let abaDialogueRejected = false;
    let abaDialogueCleanupFailure: { error: unknown } | undefined;
    try {
      abaDialogueRejected = throws(() =>
        dialogueCacheModule.captureDialogueCache(
          dialogueRoot,
          abaDialogueTarget,
        ),
      );
    } catch (error) {
      abaDialogueCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(abaDialogueCleanupFailure, [
        {
          resource: "dialogue cache capture ABA open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "dialogue cache hit rejects a directory successor between pair reads",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(abaDialogueSwap)
          ? "rename refused"
          : abaDialogueSwap,
        ...namedFacts([
          [
            "abaDialogueRejected",
            () => abaDialogueRejected === (abaDialogueSwap === "swapped"),
          ],
          ["abaDialogueTargetResident", () => fs.existsSync(abaDialogueTarget)],
          [
            "abaDialogueParkedResident",
            () =>
              abaDialogueSwap !== "swapped" || fs.existsSync(abaDialogueParked),
          ],
        ]),
      },
      {
        swap: abaDialogueSwap === "swapped" ? "swapped" : "rename refused",
        abaDialogueRejected: true,
        abaDialogueTargetResident: true,
        abaDialogueParkedResident: true,
      },
    );

    const rootDialogueRoot = path.join(base, "dialogue-cache-root-swap");
    const rootDialogueTarget = path.join(rootDialogueRoot, "entry");
    const parkedDialogueRoot = `${rootDialogueRoot}.parked`;
    const rootDialogueMarker = path.join(rootDialogueRoot, "successor.marker");
    fs.mkdirSync(rootDialogueRoot);
    // Same held-directory rule as the pair-read scenario above.
    let dialogueRootSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        dialogueRootSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) ===
          path.join(rootDialogueTarget, "audio.f32")
      ) {
        dialogueRootSwap = "swapped";
        try {
          nativeRename(rootDialogueRoot, parkedDialogueRoot);
          nativeMkdir(rootDialogueRoot);
          nativeMkdir(rootDialogueTarget);
          nativeWriteFile(rootDialogueMarker, "successor");
        } catch (error) {
          dialogueRootSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let dialogueRootSwapRejected = false;
    let dialogueRootSwapCleanupFailure: { error: unknown } | undefined;
    try {
      dialogueRootSwapRejected = throws(() =>
        dialogueCacheModule.publishDialogueCache({
          base: rootDialogueRoot,
          pcm: dialoguePcm,
          receipt: dialogueReceipt,
          target: rootDialogueTarget,
        }),
      );
    } catch (error) {
      dialogueRootSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(dialogueRootSwapCleanupFailure, [
        {
          resource: "dialogue cache root swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "dialogue cache preserves a root and parent successor",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(dialogueRootSwap)
          ? "rename refused"
          : dialogueRootSwap,
        ...namedFacts([
          [
            "dialogueRootSwapRejected",
            () => dialogueRootSwapRejected === (dialogueRootSwap === "swapped"),
          ],
          [
            "rootDialogueMarkerUtf8",
            () =>
              dialogueRootSwap !== "swapped" ||
              fs.readFileSync(rootDialogueMarker, "utf8") === "successor",
          ],
          [
            "parkedDialogueRootResident",
            () =>
              dialogueRootSwap !== "swapped" ||
              fs.existsSync(
                path.join(parkedDialogueRoot, "entry", "audio.f32"),
              ),
          ],
        ]),
      },
      {
        swap: dialogueRootSwap === "swapped" ? "swapped" : "rename refused",
        dialogueRootSwapRejected: true,
        rootDialogueMarkerUtf8: true,
        parkedDialogueRootResident: true,
      },
    );
    const renderAttemptModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderAttemptSnapshot.ts"),
    ) as {
      beginRenderAttempt: (props: {
        base: string;
        chunk: string;
        lock: {
          chunk: string;
          pid: number;
          snapshot: { target: string };
          token: string;
        };
        pid: number;
        processAlive: (pid: number) => boolean;
        slot: string;
        target: string;
        token: string;
      }) => {
        record: {
          chunk: string;
          correction: string;
          pid: number;
          slot: string;
          state: "failed" | "running";
          token: string;
          version: 1;
        };
        snapshot: { target: string; targetIdentity: string };
      };
      completeRenderAttempt: (attempt: unknown) => void;
      failRenderAttempt: (props: { attempt: unknown; correction: string }) => {
        record: { correction: string; state: "failed" | "running" };
        snapshot: { target: string };
      };
      listRenderAttempts: (
        base: string,
        directory: string,
      ) => Array<{ record: { token: string } }>;
    };
    const attemptRoot = path.join(base, "render-attempts");
    const attemptDirectory = path.join(attemptRoot, "attempts");
    const attemptTarget = path.join(attemptDirectory, "slot-0001.json");
    const attemptChunk = `sha256:${"1".repeat(64)}`;
    const firstAttemptToken = "11111111-1111-4111-8111-111111111111";
    const secondAttemptToken = "22222222-2222-4222-8222-222222222222";
    const successorAttemptToken = "33333333-3333-4333-8333-333333333333";
    fs.mkdirSync(attemptRoot);
    const attemptLockDirectory = path.join(attemptRoot, "locks");
    fs.mkdirSync(attemptLockDirectory);
    const renderAttemptGcModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderGcSnapshot.ts"),
    ) as {
      createRenderGcFileSnapshot: (
        base: string,
        target: string,
        bytes: Uint8Array,
      ) => { target: string };
    };
    const directFileFailureRoot = path.join(base, "direct-file-failure");
    const directFileFailureParent = path.join(directFileFailureRoot, "files");
    const parkedDirectFileFailureParent = `${directFileFailureParent}.parked`;
    const directFileFailureTarget = path.join(
      directFileFailureParent,
      "final.json",
    );
    const directFileFailureBytes = Buffer.from('{"direct":"final"}\n');
    fs.mkdirSync(directFileFailureParent, { recursive: true });
    let directFileFailureDescriptor = -1;
    let directFileFailureCloseFailed = false;
    let directFileFailureRelink = "pending";
    mutableFs.fsyncSync = ((descriptor: number): void => {
      directFileFailureDescriptor = descriptor;
      nativeFsync(descriptor);
      if (directFileFailureRelink === "pending") {
        // The product still holds this descriptor, and Windows refuses to
        // rename a directory that contains an open one. Claim the flag before
        // mutating and record the refusal by value so the expectation can name
        // the platform's answer instead of crashing the fixture.
        directFileFailureRelink = "relinked";
        try {
          nativeRename(directFileFailureParent, parkedDirectFileFailureParent);
          nativeMkdir(directFileFailureParent);
          nativeLink(
            path.join(parkedDirectFileFailureParent, "final.json"),
            directFileFailureTarget,
          );
          nativeWriteFile(
            path.join(directFileFailureParent, "successor.marker"),
            "successor",
          );
        } catch (relinkFailure) {
          directFileFailureRelink =
            relinkFailure instanceof Error
              ? relinkFailure.message
              : String(relinkFailure);
        }
      }
    }) as typeof fs.fsyncSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      if (
        directFileFailureCloseFailed === false &&
        descriptor === directFileFailureDescriptor
      ) {
        directFileFailureCloseFailed = true;
        throw new Error("fixture direct file close failure");
      }
      nativeClose(descriptor);
    }) as typeof fs.closeSync;
    let directFileFailureMessages: string[] = [];
    let directFileFailureCleanupFailure: { error: unknown } | undefined;
    try {
      // The refusal travels inside the descriptor cleanup aggregate, whose own
      // message names the cleanup rather than the identity change, so read
      // every leaf failure instead of only the thrown error's message.
      directFileFailureMessages = messagesOf(
        captureFailure(() =>
          renderAttemptGcModule.createRenderGcFileSnapshot(
            directFileFailureRoot,
            directFileFailureTarget,
            directFileFailureBytes,
          ),
        ),
      );
    } catch (error) {
      directFileFailureCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(directFileFailureCleanupFailure, [
        {
          resource: "direct render file fsync hook",
          cleanup: () => {
            mutableFs.fsyncSync = nativeFsync;
          },
        },
        {
          resource: "direct render file close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
        {
          resource: "direct render file descriptor",
          cleanup: () => {
            if (directFileFailureCloseFailed)
              nativeClose(directFileFailureDescriptor);
          },
        },
      ]);
    }
    const directFileResident = fs.lstatSync(
      directFileFailureRelink === "relinked"
        ? directFileFailureTarget
        : directFileFailureRoot,
      { bigint: true },
    );
    const parkedDirectFileResident = fs.lstatSync(
      directFileFailureRelink === "relinked"
        ? path.join(parkedDirectFileFailureParent, "final.json")
        : directFileFailureRoot,
      { bigint: true },
    );
    TestValidator.equals(
      "direct render file creation preserves a same-inode parent successor on failure",
      {
        closeFailed: directFileFailureCloseFailed,
        closePreserved: directFileFailureMessages.some((message) =>
          message.includes("fixture direct file close failure"),
        ),
        relink: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(directFileFailureRelink)
          ? "rename refused"
          : directFileFailureRelink,
        ...namedFacts([
          [
            "parentDevice",
            () => directFileResident.dev === parkedDirectFileResident.dev,
          ],
          [
            "parentInode",
            () => directFileResident.ino === parkedDirectFileResident.ino,
          ],
          [
            "rejected",
            () =>
              directFileFailureMessages.some((message) =>
                message.includes("changed physical identity"),
              ) ===
              (directFileFailureRelink === "relinked"),
          ],
          [
            "residentBytes",
            () =>
              directFileFailureRelink !== "relinked" ||
              fs
                .readFileSync(directFileFailureTarget)
                .equals(directFileFailureBytes),
          ],
          [
            "successorMarker",
            () =>
              directFileFailureRelink !== "relinked" ||
              fs.readFileSync(
                path.join(directFileFailureParent, "successor.marker"),
                "utf8",
              ) === "successor",
          ],
        ]),
      },
      {
        closeFailed: true,
        closePreserved: true,
        parentDevice: true,
        parentInode: true,
        rejected: true,
        relink:
          directFileFailureRelink === "relinked" ||
          directFileFailureRelink === "pending"
            ? directFileFailureRelink
            : "rename refused",
        residentBytes: true,
        successorMarker: true,
      },
    );

    const directFileAbaRoot = path.join(base, "direct-file-root-aba");
    const directFileAbaParent = path.join(directFileAbaRoot, "files");
    const directFileAbaTarget = path.join(directFileAbaParent, "final.json");
    const parkedDirectFileAbaRoot = `${directFileAbaRoot}.original-parked`;
    const parkedDirectFileAbaReplacement = `${directFileAbaRoot}.replacement-parked`;
    fs.mkdirSync(directFileAbaParent, { recursive: true });
    let directFileAbaDescriptor = -1;
    let directFileAbaFstatCount = 0;
    let directFileAbaRestore = "pending";
    let directFileAbaSwap = "pending";
    mutableFs.fsyncSync = ((descriptor: number): void => {
      directFileAbaDescriptor = descriptor;
      nativeFsync(descriptor);
      if (directFileAbaSwap === "pending") {
        // Both halves of the ABA move a directory the product's open
        // descriptor lives under, which Windows refuses. Record each half's
        // own outcome so the expectation reads the platform rather than the
        // fixture crashing before the assertion.
        directFileAbaSwap = "swapped";
        try {
          nativeRename(directFileAbaRoot, parkedDirectFileAbaRoot);
          nativeMkdir(path.join(directFileAbaRoot, "files"), {
            recursive: true,
          });
          nativeLink(
            path.join(parkedDirectFileAbaRoot, "files", "final.json"),
            directFileAbaTarget,
          );
        } catch (swapFailure) {
          directFileAbaSwap =
            swapFailure instanceof Error
              ? swapFailure.message
              : String(swapFailure);
        }
      }
    }) as typeof fs.fsyncSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeFstat, mutableFs, [
        descriptor,
        ...args,
      ]);
      if (descriptor === directFileAbaDescriptor) {
        directFileAbaFstatCount++;
        if (directFileAbaFstatCount === 2) {
          directFileAbaRestore = "restored";
          try {
            nativeRename(directFileAbaRoot, parkedDirectFileAbaReplacement);
            nativeRename(parkedDirectFileAbaRoot, directFileAbaRoot);
          } catch (restoreFailure) {
            directFileAbaRestore =
              restoreFailure instanceof Error
                ? restoreFailure.message
                : String(restoreFailure);
          }
        }
      }
      return status;
    }) as typeof fs.fstatSync;
    let directFileAbaRejected = false;
    let directFileAbaCleanupFailure: { error: unknown } | undefined;
    try {
      directFileAbaRejected = throws(() =>
        renderAttemptGcModule.createRenderGcFileSnapshot(
          directFileAbaRoot,
          directFileAbaTarget,
          directFileFailureBytes,
        ),
      );
    } catch (error) {
      directFileAbaCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(directFileAbaCleanupFailure, [
        {
          resource: "direct render ABA fsync hook",
          cleanup: () => {
            mutableFs.fsyncSync = nativeFsync;
          },
        },
        {
          resource: "direct render ABA fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
      ]);
    }
    const directFileAbaOriginal = fs.lstatSync(
      directFileAbaRestore === "restored" ? directFileAbaTarget : base,
      { bigint: true },
    );
    const directFileAbaReplacement = fs.lstatSync(
      directFileAbaRestore === "restored"
        ? path.join(parkedDirectFileAbaReplacement, "files", "final.json")
        : base,
      { bigint: true },
    );
    TestValidator.equals(
      "direct render file creation rejects a restored-root snapshot generation",
      {
        directFileAbaSwap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(directFileAbaSwap)
          ? "rename refused"
          : directFileAbaSwap,
        directFileAbaRestore: /(EPERM|EBUSY|EACCES|EXDEV|ENOENT)/u.test(
          directFileAbaRestore,
        )
          ? "rename refused"
          : directFileAbaRestore,
        ...namedFacts([
          [
            "directFileAbaRejected",
            () =>
              directFileAbaRejected === (directFileAbaRestore === "restored"),
          ],
          [
            "directFileAbaOriginalDev",
            () => directFileAbaOriginal.dev === directFileAbaReplacement.dev,
          ],
          [
            "directFileAbaOriginalIno",
            () => directFileAbaOriginal.ino === directFileAbaReplacement.ino,
          ],
        ]),
      },
      {
        // Three outcomes are legitimate: the injection installed, the platform
        // refused the rename, or the product never reached the hook because an
        // earlier half was refused. Any other message still fails the compare.
        directFileAbaSwap:
          directFileAbaSwap === "swapped" || directFileAbaSwap === "pending"
            ? directFileAbaSwap
            : "rename refused",
        directFileAbaRestore:
          directFileAbaRestore === "restored" ||
          directFileAbaRestore === "pending"
            ? directFileAbaRestore
            : "rename refused",
        directFileAbaRejected: true,
        directFileAbaOriginalDev: true,
        directFileAbaOriginalIno: true,
      },
    );
    let attemptLockIndex = 0;
    const createAttemptLock = (pid: number, token: string) => {
      const target = path.join(
        attemptLockDirectory,
        `claim.${++attemptLockIndex}.${pid}.${token}.lock`,
      );
      return {
        chunk: attemptChunk,
        pid,
        snapshot: renderAttemptGcModule.createRenderGcFileSnapshot(
          attemptRoot,
          target,
          Buffer.from(
            `${JSON.stringify({ chunk: attemptChunk, pid, token })}\n`,
          ),
        ),
        token,
      };
    };
    const replacedAttemptLock = createAttemptLock(31999, firstAttemptToken);
    fs.rmSync(replacedAttemptLock.snapshot.target);
    const replacementLockBytes = Buffer.from(
      `${JSON.stringify({
        chunk: attemptChunk,
        pid: 31999,
        token: secondAttemptToken,
      })}\n`,
    );
    fs.writeFileSync(replacedAttemptLock.snapshot.target, replacementLockBytes);
    const replacedLockRejected = throws(() =>
      renderAttemptModule.beginRenderAttempt({
        base: attemptRoot,
        chunk: attemptChunk,
        lock: replacedAttemptLock,
        pid: 31999,
        processAlive: () => false,
        slot: "slot-0001",
        target: attemptTarget,
        token: firstAttemptToken,
      }),
    );
    TestValidator.equals(
      "render attempt refuses a replaced held-lock generation before publication",
      namedFacts([
        ["replacedLockRejected", () => replacedLockRejected],
        [
          "replacedAttemptLockSnapshot",
          () =>
            fs
              .readFileSync(replacedAttemptLock.snapshot.target)
              .equals(replacementLockBytes),
        ],
        ["attemptTargetResident", () => fs.existsSync(attemptTarget) === false],
      ]),
      {
        replacedLockRejected: true,
        replacedAttemptLockSnapshot: true,
        attemptTargetResident: true,
      },
    );
    fs.rmSync(replacedAttemptLock.snapshot.target);
    const runningAttemptLock = createAttemptLock(32001, firstAttemptToken);
    const runningAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: runningAttemptLock,
      pid: 32001,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: firstAttemptToken,
    });
    const failedAttempt = renderAttemptModule.failRenderAttempt({
      attempt: runningAttempt,
      correction: "fixture render failed",
    });
    TestValidator.equals(
      "render attempt publishes running then exact failed state under one lock token",
      namedFacts([
        [
          "runningAttemptRecord",
          () => runningAttempt.record.state === "running",
        ],
        [
          "runningAttemptRecord2",
          () => runningAttempt.record.token === firstAttemptToken,
        ],
        ["failedAttemptRecord", () => failedAttempt.record.state === "failed"],
        [
          "failedAttemptRecord2",
          () => failedAttempt.record.correction === "fixture render failed",
        ],
        [
          "renderAttemptModuleListRenderAttempts",
          () =>
            renderAttemptModule.listRenderAttempts(
              attemptRoot,
              attemptDirectory,
            )[0]?.record.token === firstAttemptToken,
        ],
      ]),
      {
        runningAttemptRecord: true,
        runningAttemptRecord2: true,
        failedAttemptRecord: true,
        failedAttemptRecord2: true,
        renderAttemptModuleListRenderAttempts: true,
      },
    );
    const retriedAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: createAttemptLock(32002, secondAttemptToken),
      pid: 32002,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: secondAttemptToken,
    });
    const pidReuseRejected = throws(() =>
      renderAttemptModule.beginRenderAttempt({
        base: attemptRoot,
        chunk: attemptChunk,
        lock: createAttemptLock(32002, successorAttemptToken),
        pid: 32002,
        processAlive: (pid) => pid === 32002,
        slot: "slot-0001",
        target: attemptTarget,
        token: successorAttemptToken,
      }),
    );
    TestValidator.equals(
      "render attempt recovers failed state but rejects a live PID-reuse owner with another token",
      namedFacts([
        [
          "retriedAttemptRecord",
          () => retriedAttempt.record.token === secondAttemptToken,
        ],
        ["pidReuseRejected", () => pidReuseRejected],
        [
          "attemptTargetUtf8",
          () =>
            JSON.parse(fs.readFileSync(attemptTarget, "utf8")).token ===
            secondAttemptToken,
        ],
      ]),
      {
        retriedAttemptRecord: true,
        pidReuseRejected: true,
        attemptTargetUtf8: true,
      },
    );
    renderAttemptModule.completeRenderAttempt(retriedAttempt);
    TestValidator.predicate(
      "render attempt completion removes its exact captured running record",
      fs.existsSync(attemptTarget) === false,
    );

    const staleRunningAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: createAttemptLock(32003, firstAttemptToken),
      pid: 32003,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: firstAttemptToken,
    });
    const recoveredStaleAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: createAttemptLock(32004, secondAttemptToken),
      pid: 32004,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: secondAttemptToken,
    });
    // Removing the dead owner and creating its successor at the same pathname
    // lets the filesystem hand back the same inode, so the physical identity
    // is not the evidence of replacement. The resident record and the refusal
    // the dead owner's handle now meets are. Property order is the evaluation
    // order here: the record is read before the refused transition.
    TestValidator.equals(
      "render attempt stale recovery replaces only a dead exact owner",
      {
        residentToken: JSON.parse(fs.readFileSync(attemptTarget, "utf8")).token,
        staleHandleRefused: throws(() =>
          renderAttemptModule.completeRenderAttempt(staleRunningAttempt),
        ),
        token: recoveredStaleAttempt.record.token,
      },
      {
        residentToken: secondAttemptToken,
        staleHandleRefused: true,
        token: secondAttemptToken,
      },
    );
    renderAttemptModule.completeRenderAttempt(recoveredStaleAttempt);

    const oversizedAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: createAttemptLock(32008, secondAttemptToken),
      pid: 32008,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: secondAttemptToken,
    });
    const oversizedFailureRejected = throws(() =>
      renderAttemptModule.failRenderAttempt({
        attempt: oversizedAttempt,
        correction: "x".repeat(64 * 1024),
      }),
    );
    TestValidator.equals(
      "render attempt validates a failed successor before removing running evidence",
      namedFacts([
        ["rejected", () => oversizedFailureRejected],
        [
          "evidenceKept",
          () =>
            JSON.parse(fs.readFileSync(attemptTarget, "utf8")).state ===
            "running",
        ],
      ]),
      { rejected: true, evidenceKept: true },
    );
    renderAttemptModule.completeRenderAttempt(oversizedAttempt);

    const transitionAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: createAttemptLock(32005, firstAttemptToken),
      pid: 32005,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: firstAttemptToken,
    });
    const successorAttemptBytes = Buffer.from(
      `${JSON.stringify(
        {
          version: 1,
          slot: "slot-0001",
          chunk: attemptChunk,
          state: "running",
          correction: "",
          pid: 32006,
          token: successorAttemptToken,
        },
        null,
        2,
      )}\n`,
    );
    let transitionSuccessorInserted = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        transitionSuccessorInserted === false &&
        path.resolve(oldPath.toString()) === attemptTarget
      ) {
        nativeRename(oldPath, newPath);
        nativeWriteFile(oldPath, successorAttemptBytes);
        transitionSuccessorInserted = true;
        return;
      }
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let transitionSuccessorRejected = false;
    let transitionSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      transitionSuccessorRejected = throws(() =>
        renderAttemptModule.failRenderAttempt({
          attempt: transitionAttempt,
          correction: "must not overwrite successor",
        }),
      );
    } catch (error) {
      transitionSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(transitionSuccessorCleanupFailure, [
        {
          resource: "render attempt transition rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render attempt failure transition preserves a pathname successor",
      namedFacts([
        ["transitionSuccessorInserted", () => transitionSuccessorInserted],
        ["transitionSuccessorRejected", () => transitionSuccessorRejected],
        [
          "attemptTargetSuccessorAttemptBytes",
          () => fs.readFileSync(attemptTarget).equals(successorAttemptBytes),
        ],
      ]),
      {
        transitionSuccessorInserted: true,
        transitionSuccessorRejected: true,
        attemptTargetSuccessorAttemptBytes: true,
      },
    );
    fs.rmSync(attemptTarget);

    const completionAttempt = renderAttemptModule.beginRenderAttempt({
      base: attemptRoot,
      chunk: attemptChunk,
      lock: createAttemptLock(32007, firstAttemptToken),
      pid: 32007,
      processAlive: () => false,
      slot: "slot-0001",
      target: attemptTarget,
      token: firstAttemptToken,
    });
    let completionSuccessorInserted = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        completionSuccessorInserted === false &&
        path.resolve(oldPath.toString()) === attemptTarget
      ) {
        nativeRename(oldPath, newPath);
        nativeWriteFile(oldPath, successorAttemptBytes);
        completionSuccessorInserted = true;
        return;
      }
      nativeRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let completionAccepted = false;
    let completionCleanupFailure: { error: unknown } | undefined;
    try {
      renderAttemptModule.completeRenderAttempt(completionAttempt);
      completionAccepted = true;
    } catch (error) {
      completionCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(completionCleanupFailure, [
        {
          resource: "render attempt completion rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render attempt completion deletes the captured owner and preserves its successor",
      namedFacts([
        ["completionAccepted", () => completionAccepted],
        ["completionSuccessorInserted", () => completionSuccessorInserted],
        [
          "attemptTargetSuccessorAttemptBytes",
          () => fs.readFileSync(attemptTarget).equals(successorAttemptBytes),
        ],
      ]),
      {
        completionAccepted: true,
        completionSuccessorInserted: true,
        attemptTargetSuccessorAttemptBytes: true,
      },
    );
    fs.rmSync(attemptTarget);

    const targetCompetitorLock = createAttemptLock(32011, firstAttemptToken);
    let targetCompetitorInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        targetCompetitorInserted === false &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === attemptTarget
      ) {
        nativeWriteFile(attemptTarget, successorAttemptBytes);
        targetCompetitorInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let targetCompetitorRejected = false;
    let targetCompetitorCleanupFailure: { error: unknown } | undefined;
    try {
      targetCompetitorRejected = throws(() =>
        renderAttemptModule.beginRenderAttempt({
          base: attemptRoot,
          chunk: attemptChunk,
          lock: targetCompetitorLock,
          pid: 32011,
          processAlive: () => false,
          slot: "slot-0001",
          target: attemptTarget,
          token: firstAttemptToken,
        }),
      );
    } catch (error) {
      targetCompetitorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(targetCompetitorCleanupFailure, [
        {
          resource: "render attempt competitor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render attempt preserves a direct final-slot competitor",
      namedFacts([
        ["targetCompetitorInserted", () => targetCompetitorInserted],
        ["targetCompetitorRejected", () => targetCompetitorRejected],
        [
          "attemptTargetSuccessorAttemptBytes",
          () => fs.readFileSync(attemptTarget).equals(successorAttemptBytes),
        ],
      ]),
      {
        targetCompetitorInserted: true,
        targetCompetitorRejected: true,
        attemptTargetSuccessorAttemptBytes: true,
      },
    );
    fs.rmSync(attemptTarget);
    fs.rmSync(targetCompetitorLock.snapshot.target);

    const postPublicationLock = createAttemptLock(32012, secondAttemptToken);
    const postPublicationLockSuccessor = Buffer.from(
      `${JSON.stringify({
        chunk: attemptChunk,
        pid: 32012,
        token: successorAttemptToken,
      })}\n`,
    );
    const postPublicationParked = `${attemptTarget}.post-publication-parked`;
    let postPublicationRelinked = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        postPublicationRelinked === false &&
        path.resolve(file.toString()) === postPublicationLock.snapshot.target &&
        fs.existsSync(attemptTarget)
      ) {
        // Claim the injection before mutating. `fs.rmSync` stats the path it
        // removes, which re-enters this very hook, and the flag was set last:
        // the run reported "Maximum call stack size exceeded" instead of the
        // relink this scenario is about.
        postPublicationRelinked = true;
        nativeLink(attemptTarget, postPublicationParked);
        fs.rmSync(attemptTarget);
        nativeLink(postPublicationParked, attemptTarget);
        fs.rmSync(postPublicationParked);
        fs.rmSync(postPublicationLock.snapshot.target);
        nativeWriteFile(
          postPublicationLock.snapshot.target,
          postPublicationLockSuccessor,
        );
      }
      return status;
    }) as typeof fs.lstatSync;
    // Name the refusal rather than counting it: the relink hook did not fire on
    // the previous head, so what this call actually refused is the fact needed.
    let postPublicationRejected: string | null = null;
    let postPublicationCleanupFailure: { error: unknown } | undefined;
    try {
      postPublicationRejected = messagesOf(
        captureFailure(() =>
          renderAttemptModule.beginRenderAttempt({
            base: attemptRoot,
            chunk: attemptChunk,
            lock: postPublicationLock,
            pid: 32012,
            processAlive: () => false,
            slot: "slot-0001",
            target: attemptTarget,
            token: secondAttemptToken,
          }),
        ),
      ).join(" | ");
    } catch (error) {
      postPublicationCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(postPublicationCleanupFailure, [
        {
          resource: "render attempt post-publication lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render attempt preserves a relinked final record after lock authority loss",
      {
        lockSuccessorResident: fs
          .readFileSync(postPublicationLock.snapshot.target)
          .equals(postPublicationLockSuccessor),
        recordResident: fs.existsSync(attemptTarget),
        // The injection fires on the lock's own `lstat`, which is the first of
        // the two stats the capture takes, so the replacement lands between
        // them. That is a mid-resolve race, not a path leaving its root, and
        // the capture now says so; the message recorded here is the one the
        // product actually produces.
        rejection:
          postPublicationRejected !== null &&
          postPublicationRejected.includes("changed while it was resolved")
            ? "changed while it was resolved"
            : postPublicationRejected,
        relinked: postPublicationRelinked,
      },
      {
        lockSuccessorResident: true,
        recordResident: true,
        rejection: "changed while it was resolved",
        relinked: true,
      },
    );
    fs.rmSync(attemptTarget);
    fs.rmSync(postPublicationLock.snapshot.target);

    const parentFenceLock = createAttemptLock(32009, firstAttemptToken);
    const parkedAttemptDirectory = `${attemptDirectory}.parked`;
    const attemptParentSuccessorMarker = path.join(
      attemptDirectory,
      "successor.marker",
    );
    let attemptParentSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        attemptParentSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === attemptTarget
      ) {
        // The descriptor this hook just returned lives inside the directory
        // being moved, and Windows refuses that rename. Claim the flag before
        // mutating and record the platform's answer by value.
        attemptParentSwap = "swapped";
        try {
          nativeRename(attemptDirectory, parkedAttemptDirectory);
          nativeMkdir(attemptDirectory);
          nativeWriteFile(attemptParentSuccessorMarker, "successor");
        } catch (swapFailure) {
          attemptParentSwap =
            swapFailure instanceof Error
              ? swapFailure.message
              : String(swapFailure);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let attemptParentRejected = false;
    let attemptParentCleanupFailure: { error: unknown } | undefined;
    try {
      attemptParentRejected = throws(() =>
        renderAttemptModule.beginRenderAttempt({
          base: attemptRoot,
          chunk: attemptChunk,
          lock: parentFenceLock,
          pid: 32009,
          processAlive: () => false,
          slot: "slot-0001",
          target: attemptTarget,
          token: firstAttemptToken,
        }),
      );
    } catch (error) {
      attemptParentCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(attemptParentCleanupFailure, [
        {
          resource: "render attempt parent open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render attempt preserves an attempts-directory successor at publication",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(attemptParentSwap)
          ? "rename refused"
          : attemptParentSwap,
        ...namedFacts([
          [
            "parkedRecordResident",
            () =>
              attemptParentSwap !== "swapped" ||
              fs.existsSync(
                path.join(parkedAttemptDirectory, "slot-0001.json"),
              ),
          ],
          [
            "rejected",
            () => attemptParentRejected === (attemptParentSwap === "swapped"),
          ],
          [
            "successorMarker",
            () =>
              attemptParentSwap !== "swapped" ||
              fs.readFileSync(attemptParentSuccessorMarker, "utf8") ===
                "successor",
          ],
          [
            "successorRecordResident",
            () =>
              fs.existsSync(attemptTarget) ===
              (attemptParentSwap !== "swapped"),
          ],
        ]),
      },
      {
        parkedRecordResident: true,
        rejected: true,
        successorMarker: true,
        successorRecordResident: true,
        swap:
          attemptParentSwap === "swapped" || attemptParentSwap === "pending"
            ? attemptParentSwap
            : "rename refused",
      },
    );
    // Both branches leave the same state behind: the swap removes the successor
    // directory and restores the parked original, and a refusal removes only
    // the record the product wrote into the original directory.
    fs.rmSync(
      attemptParentSwap === "swapped" ? attemptDirectory : attemptTarget,
      { recursive: true, force: true },
    );
    if (attemptParentSwap === "swapped")
      nativeRename(parkedAttemptDirectory, attemptDirectory);
    fs.rmSync(attemptTarget, { force: true });

    const rootFenceLock = createAttemptLock(32010, secondAttemptToken);
    const parkedAttemptRoot = `${attemptRoot}.parked`;
    const attemptRootSuccessorMarker = path.join(
      attemptRoot,
      "successor.marker",
    );
    let attemptRootSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        attemptRootSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === attemptTarget
      ) {
        attemptRootSwap = "swapped";
        try {
          nativeRename(attemptRoot, parkedAttemptRoot);
          nativeMkdir(path.join(attemptRoot, "attempts"), { recursive: true });
          nativeMkdir(path.join(attemptRoot, "locks"), { recursive: true });
          nativeWriteFile(attemptRootSuccessorMarker, "successor");
        } catch (swapFailure) {
          attemptRootSwap =
            swapFailure instanceof Error
              ? swapFailure.message
              : String(swapFailure);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let attemptRootRejected = false;
    let attemptRootCleanupFailure: { error: unknown } | undefined;
    try {
      attemptRootRejected = throws(() =>
        renderAttemptModule.beginRenderAttempt({
          base: attemptRoot,
          chunk: attemptChunk,
          lock: rootFenceLock,
          pid: 32010,
          processAlive: () => false,
          slot: "slot-0001",
          target: attemptTarget,
          token: secondAttemptToken,
        }),
      );
    } catch (error) {
      attemptRootCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(attemptRootCleanupFailure, [
        {
          resource: "render attempt root open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render attempt preserves a render-root successor at publication",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(attemptRootSwap)
          ? "rename refused"
          : attemptRootSwap,
        ...namedFacts([
          [
            "parkedRecordResident",
            () =>
              attemptRootSwap !== "swapped" ||
              fs.existsSync(
                path.join(parkedAttemptRoot, "attempts", "slot-0001.json"),
              ),
          ],
          [
            "rejected",
            () => attemptRootRejected === (attemptRootSwap === "swapped"),
          ],
          [
            "successorMarker",
            () =>
              attemptRootSwap !== "swapped" ||
              fs.readFileSync(attemptRootSuccessorMarker, "utf8") ===
                "successor",
          ],
          [
            "successorRecordResident",
            () =>
              fs.existsSync(attemptTarget) === (attemptRootSwap !== "swapped"),
          ],
        ]),
      },
      {
        parkedRecordResident: true,
        rejected: true,
        successorMarker: true,
        successorRecordResident: true,
        swap:
          attemptRootSwap === "swapped" || attemptRootSwap === "pending"
            ? attemptRootSwap
            : "rename refused",
      },
    );
    fs.rmSync(attemptRootSwap === "swapped" ? attemptRoot : attemptTarget, {
      recursive: true,
      force: true,
    });
    if (attemptRootSwap === "swapped")
      nativeRename(parkedAttemptRoot, attemptRoot);
    fs.rmSync(attemptTarget, { force: true });

    interface RenderPlanFixture {
      chunkFrames: number;
      name: string;
    }
    interface RenderPlanFixtureSnapshot {
      generation: string;
      plan: RenderPlanFixture;
      snapshot: {
        fileDigest: string | null;
        target: string;
        targetIdentity: string;
      };
    }
    const renderPlanModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderPlanSnapshot.ts"),
    ) as {
      captureRenderPlan: (
        base: string,
        target: string,
      ) => RenderPlanFixtureSnapshot;
      publishRenderPlan: (props: {
        base: string;
        inputCurrent: () => Promise<void>;
        plan: RenderPlanFixture;
        predecessor: RenderPlanFixtureSnapshot | null;
        target: string;
      }) => Promise<RenderPlanFixtureSnapshot>;
    };
    const planFixture = (
      name: string,
      chunkFrames: number,
    ): RenderPlanFixture => ({ chunkFrames, name });
    const planRoot = path.join(base, "render-plans");
    const planTarget = path.join(planRoot, "plan.json");
    fs.mkdirSync(planRoot);
    const firstPlan = await renderPlanModule.publishRenderPlan({
      base: planRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("first", 48),
      predecessor: null,
      target: planTarget,
    });
    const capturedFirstPlan = renderPlanModule.captureRenderPlan(
      planRoot,
      planTarget,
    );
    TestValidator.equals(
      "render plan publishes an immutable genesis generation",
      {
        capturedGeneration: capturedFirstPlan.generation,
        capturedName: capturedFirstPlan.plan.name,
        headResident: fs.existsSync(planTarget),
      },
      {
        capturedGeneration: firstPlan.generation,
        capturedName: "first",
        headResident: false,
      },
    );
    const reusedFirstPlan = await renderPlanModule.publishRenderPlan({
      base: planRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("first", 48),
      predecessor: firstPlan,
      target: planTarget,
    });
    TestValidator.equals(
      "render plan reuses an unchanged sequential predecessor",
      {
        generation: reusedFirstPlan.generation,
        generations: fs.readdirSync(`${planTarget}.generations`).length,
      },
      {
        generation: firstPlan.generation,
        generations: 1,
      },
    );
    const secondPlan = await renderPlanModule.publishRenderPlan({
      base: planRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("second", 36),
      predecessor: firstPlan,
      target: planTarget,
    });
    TestValidator.equals(
      "render plan replacement appends one predecessor-bound successor",
      {
        appended: secondPlan.generation !== firstPlan.generation,
        head: renderPlanModule.captureRenderPlan(planRoot, planTarget)
          .generation,
        predecessorResident: fs.existsSync(firstPlan.snapshot.target),
      },
      {
        appended: true,
        head: secondPlan.generation,
        predecessorResident: true,
      },
    );
    let staleInputChecked = false;
    let staleInputRejected = false;
    try {
      await renderPlanModule.publishRenderPlan({
        base: planRoot,
        inputCurrent: async () => {
          staleInputChecked = true;
          throw new Error("fixture stale render inputs");
        },
        plan: planFixture("stale-input", 30),
        predecessor: secondPlan,
        target: planTarget,
      });
    } catch {
      staleInputRejected = true;
    }
    TestValidator.equals(
      "render plan rejects stale inputs without changing its head",
      {
        checked: staleInputChecked,
        head: renderPlanModule.captureRenderPlan(planRoot, planTarget)
          .generation,
        rejected: staleInputRejected,
      },
      {
        checked: true,
        head: secondPlan.generation,
        rejected: true,
      },
    );
    let concurrentWinner: RenderPlanFixtureSnapshot | undefined;
    let slowPlannerRejected = false;
    try {
      await renderPlanModule.publishRenderPlan({
        base: planRoot,
        inputCurrent: async () => {
          concurrentWinner = await renderPlanModule.publishRenderPlan({
            base: planRoot,
            inputCurrent: async () => undefined,
            plan: planFixture("winner", 24),
            predecessor: secondPlan,
            target: planTarget,
          });
        },
        plan: planFixture("slow-loser", 12),
        predecessor: secondPlan,
        target: planTarget,
      });
    } catch {
      slowPlannerRejected = true;
    }
    if (concurrentWinner === undefined)
      throw new Error("fixture concurrent render-plan winner is missing");
    TestValidator.equals(
      "a stale slow planner cannot replace a different chunk-size winner",
      {
        head: renderPlanModule.captureRenderPlan(planRoot, planTarget)
          .generation,
        predecessorResident: fs.existsSync(secondPlan.snapshot.target),
        rejected: slowPlannerRejected,
        winnerChunkFrames: concurrentWinner.plan.chunkFrames,
      },
      {
        head: concurrentWinner.generation,
        predecessorResident: true,
        rejected: true,
        winnerChunkFrames: 24,
      },
    );
    const activeWorkerPlan = concurrentWinner.plan;
    const replacementPlan = await renderPlanModule.publishRenderPlan({
      base: planRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("replacement", 16),
      predecessor: concurrentWinner,
      target: planTarget,
    });
    TestValidator.equals(
      "an active worker keeps its session plan across later replacement",
      {
        head: renderPlanModule.captureRenderPlan(planRoot, planTarget)
          .generation,
        replacementName: replacementPlan.plan.name,
        sessionChunkFrames: activeWorkerPlan.chunkFrames,
        sessionName: activeWorkerPlan.name,
      },
      {
        head: replacementPlan.generation,
        replacementName: "replacement",
        sessionChunkFrames: 24,
        sessionName: "winner",
      },
    );

    const exactPlanRoot = path.join(base, "render-plan-exact-competitor");
    const exactPlanTarget = path.join(exactPlanRoot, "plan.json");
    const exactPlanSlot = path.join(
      `${exactPlanTarget}.generations`,
      "genesis.json",
    );
    fs.mkdirSync(exactPlanRoot);
    let exactPlanInserted = false;
    let exactPlanIdentity = "";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        exactPlanInserted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === exactPlanSlot &&
        flags === "wx+"
      ) {
        nativeWriteFile(
          exactPlanSlot,
          `${JSON.stringify({
            version: 1,
            generation: "22222222-2222-4222-8222-222222222222",
            predecessor: null,
            plan: planFixture("exact-competitor", 48),
          })}\n`,
        );
        const status = fs.lstatSync(exactPlanSlot, { bigint: true });
        exactPlanIdentity = `${status.dev}\0${status.ino}`;
        exactPlanInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let exactPlanAccepted: RenderPlanFixtureSnapshot | undefined;
    let exactPlanCleanupFailure: { error: unknown } | undefined;
    try {
      exactPlanAccepted = await renderPlanModule.publishRenderPlan({
        base: exactPlanRoot,
        inputCurrent: async () => undefined,
        plan: planFixture("exact-competitor", 48),
        predecessor: null,
        target: exactPlanTarget,
      });
    } catch (error) {
      exactPlanCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(exactPlanCleanupFailure, [
        {
          resource: "render plan exact competitor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render plan accepts an exact no-overwrite commit competitor",
      {
        acceptedName: exactPlanAccepted?.plan.name ?? null,
        inserted: exactPlanInserted,
        slotIdentityKept: ((): boolean => {
          const status = fs.lstatSync(exactPlanSlot, { bigint: true });
          return `${status.dev}\0${status.ino}` === exactPlanIdentity;
        })(),
      },
      {
        acceptedName: "exact-competitor",
        inserted: true,
        slotIdentityKept: true,
      },
    );

    const foreignPlanRoot = path.join(base, "render-plan-foreign-competitor");
    const foreignPlanTarget = path.join(foreignPlanRoot, "plan.json");
    const foreignPlanSlot = path.join(
      `${foreignPlanTarget}.generations`,
      "genesis.json",
    );
    const foreignPlanBytes = Buffer.from(
      `${JSON.stringify({
        version: 1,
        generation: "33333333-3333-4333-8333-333333333333",
        predecessor: null,
        plan: planFixture("foreign", 7),
      })}\n`,
    );
    fs.mkdirSync(foreignPlanRoot);
    let foreignPlanInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        foreignPlanInserted === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === foreignPlanSlot &&
        flags === "wx+"
      ) {
        nativeWriteFile(foreignPlanSlot, foreignPlanBytes);
        foreignPlanInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let foreignPlanRejected = false;
    let foreignPlanCleanupFailure: { error: unknown } | undefined;
    try {
      await renderPlanModule.publishRenderPlan({
        base: foreignPlanRoot,
        inputCurrent: async () => undefined,
        plan: planFixture("local", 48),
        predecessor: null,
        target: foreignPlanTarget,
      });
    } catch (error) {
      foreignPlanRejected = true;
      foreignPlanCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(foreignPlanCleanupFailure, [
        {
          resource: "render plan foreign competitor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render plan preserves a foreign destination generation competitor",
      namedFacts([
        ["foreignPlanInserted", () => foreignPlanInserted],
        ["foreignPlanRejected", () => foreignPlanRejected],
        [
          "foreignPlanSlotForeignPlanBytes",
          () => fs.readFileSync(foreignPlanSlot).equals(foreignPlanBytes),
        ],
        [
          "renderPlanModuleCaptureRenderPlan",
          () =>
            renderPlanModule.captureRenderPlan(
              foreignPlanRoot,
              foreignPlanTarget,
            ).plan.name === "foreign",
        ],
      ]),
      {
        foreignPlanInserted: true,
        foreignPlanRejected: true,
        foreignPlanSlotForeignPlanBytes: true,
        renderPlanModuleCaptureRenderPlan: true,
      },
    );

    const rootSwapPlanRoot = path.join(base, "render-plan-root-swap");
    const rootSwapPlanTarget = path.join(rootSwapPlanRoot, "plan.json");
    const parkedRootSwapPlan = `${rootSwapPlanRoot}.parked`;
    const rootSwapPlanMarker = path.join(rootSwapPlanRoot, "successor.marker");
    fs.mkdirSync(rootSwapPlanRoot);
    let planRootSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        planRootSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) ===
          path.join(rootSwapPlanRoot, "plan.json.generations", "genesis.json")
      ) {
        planRootSwap = "swapped";
        try {
          nativeRename(rootSwapPlanRoot, parkedRootSwapPlan);
          nativeMkdir(path.join(rootSwapPlanRoot, "plan.json.generations"), {
            recursive: true,
          });
          nativeWriteFile(rootSwapPlanMarker, "successor");
        } catch (swapFailure) {
          planRootSwap =
            swapFailure instanceof Error
              ? swapFailure.message
              : String(swapFailure);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let planRootSwapRejected = false;
    let planRootSwapCleanupFailure: { error: unknown } | undefined;
    try {
      await renderPlanModule.publishRenderPlan({
        base: rootSwapPlanRoot,
        inputCurrent: async () => undefined,
        plan: planFixture("root-swap", 48),
        predecessor: null,
        target: rootSwapPlanTarget,
      });
    } catch (error) {
      planRootSwapRejected = true;
      planRootSwapCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(planRootSwapCleanupFailure, [
        {
          resource: "render plan root swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render plan preserves a render-root and parent successor",
      {
        planRootSwap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(planRootSwap)
          ? "rename refused"
          : planRootSwap,
        ...namedFacts([
          [
            "planRootSwapRejected",
            () => planRootSwapRejected === (planRootSwap === "swapped"),
          ],
          [
            "rootSwapPlanMarkerUtf8",
            () =>
              planRootSwap !== "swapped" ||
              fs.readFileSync(rootSwapPlanMarker, "utf8") === "successor",
          ],
          [
            "parkedRootSwapPlanResident",
            () =>
              planRootSwap !== "swapped" ||
              fs.existsSync(
                path.join(
                  parkedRootSwapPlan,
                  "plan.json.generations",
                  "genesis.json",
                ),
              ),
          ],
        ]),
      },
      {
        planRootSwap:
          planRootSwap === "swapped" || planRootSwap === "pending"
            ? planRootSwap
            : "rename refused",
        planRootSwapRejected: true,
        rootSwapPlanMarkerUtf8: true,
        parkedRootSwapPlanResident: true,
      },
    );

    const legacyPlanRoot = path.join(base, "render-plan-legacy");
    const legacyPlanTarget = path.join(legacyPlanRoot, "plan.json");
    const legacyPlanBytes = Buffer.from(
      `${JSON.stringify(planFixture("legacy", 60), null, 2)}\n`,
    );
    fs.mkdirSync(legacyPlanRoot);
    fs.writeFileSync(legacyPlanTarget, legacyPlanBytes);
    const legacyPlan = renderPlanModule.captureRenderPlan(
      legacyPlanRoot,
      legacyPlanTarget,
    );
    const migratedPlan = await renderPlanModule.publishRenderPlan({
      base: legacyPlanRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("migrated", 48),
      predecessor: legacyPlan,
      target: legacyPlanTarget,
    });
    TestValidator.equals(
      "render plan appends after an exact legacy plan without replacing it",
      namedFacts([
        [
          "legacyPlanTargetLegacyPlanBytes",
          () => fs.readFileSync(legacyPlanTarget).equals(legacyPlanBytes),
        ],
        ["migratedPlanPlan", () => migratedPlan.plan.name === "migrated"],
        [
          "renderPlanModuleCaptureRenderPlan",
          () =>
            renderPlanModule.captureRenderPlan(legacyPlanRoot, legacyPlanTarget)
              .generation === migratedPlan.generation,
        ],
        [
          "renderPlanModuleCaptureRenderPlan2",
          () =>
            renderPlanModule.captureRenderPlan(base, legacyPlanTarget)
              .generation === migratedPlan.generation,
        ],
      ]),
      {
        legacyPlanTargetLegacyPlanBytes: true,
        migratedPlanPlan: true,
        renderPlanModuleCaptureRenderPlan: true,
        renderPlanModuleCaptureRenderPlan2: true,
      },
    );
    const parkedLegacyPlanTarget = `${legacyPlanTarget}.parked`;
    fs.renameSync(legacyPlanTarget, parkedLegacyPlanTarget);
    fs.writeFileSync(
      legacyPlanTarget,
      `${JSON.stringify(planFixture("foreign-legacy", 12), null, 2)}\n`,
    );
    let replacedLegacyPlanRejected = false;
    try {
      renderPlanModule.captureRenderPlan(legacyPlanRoot, legacyPlanTarget);
    } catch {
      replacedLegacyPlanRejected = true;
    }
    TestValidator.equals(
      "render plan rejects a replaced legacy root after migration",
      namedFacts([
        ["replacedLegacyPlanRejected", () => replacedLegacyPlanRejected],
        [
          "parkedLegacyPlanTargetResident",
          () => fs.existsSync(parkedLegacyPlanTarget),
        ],
        ["$Resident", () => fs.existsSync(`${legacyPlanTarget}.generations`)],
      ]),
      {
        replacedLegacyPlanRejected: true,
        parkedLegacyPlanTargetResident: true,
        $Resident: true,
      },
    );

    const unchangedLegacyPlanRoot = path.join(
      base,
      "render-plan-unchanged-legacy",
    );
    const unchangedLegacyPlanTarget = path.join(
      unchangedLegacyPlanRoot,
      "plan.json",
    );
    fs.mkdirSync(unchangedLegacyPlanRoot);
    fs.writeFileSync(unchangedLegacyPlanTarget, legacyPlanBytes);
    const unchangedLegacyPlan = renderPlanModule.captureRenderPlan(
      unchangedLegacyPlanRoot,
      unchangedLegacyPlanTarget,
    );
    const boundUnchangedLegacyPlan = await renderPlanModule.publishRenderPlan({
      base: unchangedLegacyPlanRoot,
      inputCurrent: async () => undefined,
      plan: unchangedLegacyPlan.plan,
      predecessor: unchangedLegacyPlan,
      target: unchangedLegacyPlanTarget,
    });
    fs.renameSync(
      unchangedLegacyPlanTarget,
      `${unchangedLegacyPlanTarget}.parked`,
    );
    fs.writeFileSync(
      unchangedLegacyPlanTarget,
      `${JSON.stringify(planFixture("replacement-legacy", 60), null, 2)}\n`,
    );
    TestValidator.equals(
      "render plan binds and protects an unchanged legacy root",
      namedFacts([
        [
          "rebound",
          () =>
            boundUnchangedLegacyPlan.generation !==
            unchangedLegacyPlan.generation,
        ],
        [
          "protected",
          () =>
            throws(() =>
              renderPlanModule.captureRenderPlan(
                unchangedLegacyPlanRoot,
                unchangedLegacyPlanTarget,
              ),
            ),
        ],
      ]),
      { rebound: true, protected: true },
    );

    const lateLegacyPlanRoot = path.join(base, "render-plan-late-legacy");
    const lateLegacyPlanTarget = path.join(lateLegacyPlanRoot, "plan.json");
    fs.mkdirSync(lateLegacyPlanRoot);
    await renderPlanModule.publishRenderPlan({
      base: lateLegacyPlanRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("genesis-before-legacy", 48),
      predecessor: null,
      target: lateLegacyPlanTarget,
    });
    fs.writeFileSync(lateLegacyPlanTarget, legacyPlanBytes);
    TestValidator.predicate(
      "render plan rejects a legacy root introduced after genesis",
      throws(() =>
        renderPlanModule.captureRenderPlan(
          lateLegacyPlanRoot,
          lateLegacyPlanTarget,
        ),
      ),
    );

    const traversalPlanRoot = path.join(base, "render-plan-traversal-swap");
    const traversalPlanTarget = path.join(traversalPlanRoot, "plan.json");
    fs.mkdirSync(traversalPlanRoot);
    const traversalFirst = await renderPlanModule.publishRenderPlan({
      base: traversalPlanRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("traversal-first", 48),
      predecessor: null,
      target: traversalPlanTarget,
    });
    await renderPlanModule.publishRenderPlan({
      base: traversalPlanRoot,
      inputCurrent: async () => undefined,
      plan: planFixture("traversal-second", 24),
      predecessor: traversalFirst,
      target: traversalPlanTarget,
    });
    const traversalDirectory = `${traversalPlanTarget}.generations`;
    const parkedTraversalDirectory = `${traversalDirectory}.parked`;
    const traversalSuccessorMarker = path.join(
      traversalDirectory,
      "successor.marker",
    );
    let traversalDirectorySwapped = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
      if (
        traversalDirectorySwapped === false &&
        path.resolve(file.toString()) === traversalFirst.snapshot.target
      ) {
        nativeRename(traversalDirectory, parkedTraversalDirectory);
        nativeMkdir(traversalDirectory);
        nativeWriteFile(traversalSuccessorMarker, "successor");
        traversalDirectorySwapped = true;
      }
      return status;
    }) as typeof fs.lstatSync;
    let traversalDirectoryRejected = false;
    let traversalDirectoryCleanupFailure: { error: unknown } | undefined;
    try {
      renderPlanModule.captureRenderPlan(
        traversalPlanRoot,
        traversalPlanTarget,
      );
    } catch (error) {
      traversalDirectoryRejected = true;
      traversalDirectoryCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(traversalDirectoryCleanupFailure, [
        {
          resource: "render plan traversal lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render plan traversal rejects a generation-directory successor",
      namedFacts([
        ["traversalDirectorySwapped", () => traversalDirectorySwapped],
        ["traversalDirectoryRejected", () => traversalDirectoryRejected],
        [
          "traversalSuccessorMarkerUtf8",
          () =>
            fs.readFileSync(traversalSuccessorMarker, "utf8") === "successor",
        ],
        [
          "parkedTraversalDirectoryResident",
          () => fs.existsSync(parkedTraversalDirectory),
        ],
      ]),
      {
        traversalDirectorySwapped: true,
        traversalDirectoryRejected: true,
        traversalSuccessorMarkerUtf8: true,
        parkedTraversalDirectoryResident: true,
      },
    );

    const malformedPlanRoot = path.join(base, "render-plan-malformed");
    const malformedPlanTarget = path.join(malformedPlanRoot, "plan.json");
    fs.mkdirSync(`${malformedPlanTarget}.generations`, { recursive: true });
    fs.writeFileSync(
      path.join(`${malformedPlanTarget}.generations`, "genesis.json"),
      "{}\n",
    );
    const malformedPlanRejected = throws(() =>
      renderPlanModule.captureRenderPlan(
        malformedPlanRoot,
        malformedPlanTarget,
      ),
    );
    const cyclePlanRoot = path.join(base, "render-plan-cycle");
    const cyclePlanTarget = path.join(cyclePlanRoot, "plan.json");
    const cyclePlanDirectory = `${cyclePlanTarget}.generations`;
    const cycleGeneration = "44444444-4444-4444-8444-444444444444";
    fs.mkdirSync(cyclePlanDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(cyclePlanDirectory, "genesis.json"),
      `${JSON.stringify({
        version: 1,
        generation: cycleGeneration,
        predecessor: null,
        plan: planFixture("cycle-first", 48),
      })}\n`,
    );
    fs.writeFileSync(
      path.join(cyclePlanDirectory, `${cycleGeneration}.json`),
      `${JSON.stringify({
        version: 1,
        generation: cycleGeneration,
        predecessor: cycleGeneration,
        plan: planFixture("cycle-second", 24),
      })}\n`,
    );
    TestValidator.equals(
      "render plan traversal rejects malformed and cyclic generations",
      namedFacts([
        ["malformed", () => malformedPlanRejected],
        [
          "cyclic",
          () =>
            throws(() =>
              renderPlanModule.captureRenderPlan(
                cyclePlanRoot,
                cyclePlanTarget,
              ),
            ),
        ],
      ]),
      { malformed: true, cyclic: true },
    );
    const renderLivenessModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderLiveness.ts"),
    ) as {
      acquireRenderGcLease: (props: {
        coordinationRoot: string;
        pid: number;
        processAlive: (pid: number) => boolean;
        scope: string;
      }) => unknown;
      acquireRenderSessionLease: (props: {
        coordinationRoot: string;
        pid: number;
        processAlive: (pid: number) => boolean;
        scope: string;
        tier: "final" | "proxy";
      }) => unknown;
      preserveRenderLivenessLease: (
        failure: { error: unknown } | undefined,
        lease: unknown,
      ) => void;
      releaseRenderLivenessLease: (lease: unknown) => boolean;
    };
    const livenessRoot = path.join(base, "render-liveness");
    const livenessScope = "a".repeat(64);
    fs.mkdirSync(livenessRoot);
    let partialLeaseDescriptor: number | null = null;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.dirname(path.resolve(file.toString())) === livenessRoot
      )
        partialLeaseDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fsyncSync = ((descriptor) => {
      if (descriptor === partialLeaseDescriptor)
        throw new Error("fixture lease fsync failure");
      nativeFsync(descriptor);
    }) as typeof fs.fsyncSync;
    let partialLeaseRejected = false;
    let partialLeaseCleanupFailure: { error: unknown } | undefined;
    try {
      partialLeaseRejected = throws(() =>
        renderLivenessModule.acquireRenderGcLease({
          coordinationRoot: livenessRoot,
          pid: 31000,
          processAlive: (pid) => pid === 31000,
          scope: livenessScope,
        }),
      );
    } catch (error) {
      partialLeaseCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(partialLeaseCleanupFailure, [
        {
          resource: "render liveness partial open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render liveness partial fsync hook",
          cleanup: () => {
            mutableFs.fsyncSync = nativeFsync;
          },
        },
      ]);
    }
    const partialLeaseFiles = fs.readdirSync(livenessRoot);
    const partialLeaseBlocksRetry = throws(() =>
      renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31000,
        processAlive: (pid) => pid === 31000,
        scope: livenessScope,
      }),
    );
    TestValidator.equals(
      "a failed descriptor-bound lease remains as fail-closed evidence",
      namedFacts([
        ["partialLeaseRejected", () => partialLeaseRejected],
        ["partialLeaseBlocksRetry", () => partialLeaseBlocksRetry],
        ["partialLeaseFilesCount", () => partialLeaseFiles.length === 1],
      ]),
      {
        partialLeaseRejected: true,
        partialLeaseBlocksRetry: true,
        partialLeaseFilesCount: true,
      },
    );
    fs.rmSync(path.join(livenessRoot, partialLeaseFiles[0]!));
    let interleavedGc: unknown;
    let workerOpenInterleaved = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        workerOpenInterleaved === false &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.basename(file.toString()).includes(".session.")
      ) {
        workerOpenInterleaved = true;
        interleavedGc = renderLivenessModule.acquireRenderGcLease({
          coordinationRoot: livenessRoot,
          pid: 31009,
          processAlive: (pid) => pid === 31009 || pid === 31010,
          scope: livenessScope,
        });
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let interleavedWorkerRejected = false;
    let interleavedWorkerCleanupFailure: { error: unknown } | undefined;
    try {
      interleavedWorkerRejected = throws(() =>
        renderLivenessModule.acquireRenderSessionLease({
          coordinationRoot: livenessRoot,
          pid: 31010,
          processAlive: (pid) => pid === 31009 || pid === 31010,
          scope: livenessScope,
          tier: "proxy",
        }),
      );
    } catch (error) {
      interleavedWorkerCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(interleavedWorkerCleanupFailure, [
        {
          resource: "render liveness interleaved open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render liveness interleaved GC lease",
          cleanup: () => {
            if (interleavedGc !== undefined)
              renderLivenessModule.releaseRenderLivenessLease(interleavedGc);
          },
        },
      ]);
    }
    TestValidator.equals(
      "a worker rechecks a GC guard published after its first check",
      {
        // The GC's own removal staging is a preserved path by design, so what
        // this asserts is that no lease survived beside it.
        livenessRootEntries: fs.readdirSync(livenessRoot),
        ...namedFacts([
          ["workerOpenInterleaved", () => workerOpenInterleaved],
          ["interleavedWorkerRejected", () => interleavedWorkerRejected],
        ]),
      },
      {
        livenessRootEntries: [".gc-preserved-removal-staging"],
        workerOpenInterleaved: true,
        interleavedWorkerRejected: true,
      },
    );
    let inventoryWorker: unknown;
    let inventoryWorkerRejected = false;
    let gcInventoryInterleaved = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      const entries = Reflect.apply(nativeReaddir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        gcInventoryInterleaved === false &&
        path.resolve(directory.toString()) === livenessRoot
      ) {
        gcInventoryInterleaved = true;
        try {
          inventoryWorker = renderLivenessModule.acquireRenderSessionLease({
            coordinationRoot: livenessRoot,
            pid: 31014,
            processAlive: (pid) => pid === 31013 || pid === 31014,
            scope: livenessScope,
            tier: "final",
          });
        } catch {
          inventoryWorkerRejected = true;
        }
      }
      return entries;
    }) as typeof fs.readdirSync;
    let inventoryGc: unknown;
    let inventoryGcCleanupFailure: { error: unknown } | undefined;
    try {
      inventoryGc = renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31013,
        processAlive: (pid) => pid === 31013 || pid === 31014,
        scope: livenessScope,
      });
    } catch (error) {
      inventoryGcCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(inventoryGcCleanupFailure, [
        {
          resource: "render liveness inventory readdir hook",
          cleanup: () => {
            mutableFs.readdirSync = nativeReaddir;
          },
        },
      ]);
    }
    if (inventoryGc !== undefined)
      renderLivenessModule.releaseRenderLivenessLease(inventoryGc);
    if (inventoryWorker !== undefined)
      renderLivenessModule.releaseRenderLivenessLease(inventoryWorker);
    TestValidator.equals(
      "GC publishes its guard before the session inventory boundary",
      namedFacts([
        ["gcInventoryInterleaved", () => gcInventoryInterleaved],
        ["inventoryWorkerRejected", () => inventoryWorkerRejected],
        [
          // The GC's own removal staging is a preserved path by design, so what
          // this asserts is that no lease survived beside it.
          "livenessRootEntries",
          () =>
            fs.readdirSync(livenessRoot).join() ===
            ".gc-preserved-removal-staging",
        ],
      ]),
      {
        gcInventoryInterleaved: true,
        inventoryWorkerRejected: true,
        livenessRootEntries: true,
      },
    );
    const gcFirstAlive = new Set([31001, 31002]);
    const gcFirst = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31001,
      processAlive: (pid) => gcFirstAlive.has(pid),
      scope: livenessScope,
    });
    const gcFirstWorkerRejected = throws(() =>
      renderLivenessModule.acquireRenderSessionLease({
        coordinationRoot: livenessRoot,
        pid: 31002,
        processAlive: (pid) => gcFirstAlive.has(pid),
        scope: livenessScope,
        tier: "proxy",
      }),
    );
    const gcFirstPeerRejected = throws(() =>
      renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31002,
        processAlive: (pid) => gcFirstAlive.has(pid),
        scope: livenessScope,
      }),
    );
    const gcFirstReleased =
      renderLivenessModule.releaseRenderLivenessLease(gcFirst);
    TestValidator.equals(
      "a GC-first lease blocks a later render session",
      namedFacts([
        ["gcFirstWorkerRejected", () => gcFirstWorkerRejected],
        ["gcFirstPeerRejected", () => gcFirstPeerRejected],
        ["gcFirstReleased", () => gcFirstReleased],
        [
          // The GC's own removal staging is a preserved path by design, so what
          // this asserts is that no lease survived beside it.
          "livenessRootEntries",
          () =>
            fs.readdirSync(livenessRoot).join() ===
            ".gc-preserved-removal-staging",
        ],
      ]),
      {
        gcFirstWorkerRejected: true,
        gcFirstPeerRejected: true,
        gcFirstReleased: true,
        livenessRootEntries: true,
      },
    );
    const workerFirstAlive = new Set([31003, 31004]);
    const workerFirst = renderLivenessModule.acquireRenderSessionLease({
      coordinationRoot: livenessRoot,
      pid: 31003,
      processAlive: (pid) => workerFirstAlive.has(pid),
      scope: livenessScope,
      tier: "final",
    });
    const workerFirstGcRejected = throws(() =>
      renderLivenessModule.acquireRenderGcLease({
        coordinationRoot: livenessRoot,
        pid: 31004,
        processAlive: (pid) => workerFirstAlive.has(pid),
        scope: livenessScope,
      }),
    );
    const workerFirstEntries = fs.readdirSync(livenessRoot);
    TestValidator.equals(
      "a worker-first session makes GC release its guard and refuse apply",
      namedFacts([
        ["workerFirstGcRejected", () => workerFirstGcRejected],
        [
          // The GC's removal staging is a preserved path, so the session lease
          // is what this counts.
          "workerFirstLeaseCount",
          () =>
            workerFirstEntries.filter(
              (entry) => entry.startsWith(".gc-preserved-") === false,
            ).length === 1,
        ],
        [
          "workerFirstEntriesSession",
          () =>
            workerFirstEntries
              .filter((entry) => entry.startsWith(".gc-preserved-") === false)
              .every((entry) => entry.includes(".session.")),
        ],
      ]),
      {
        workerFirstGcRejected: true,
        workerFirstLeaseCount: true,
        workerFirstEntriesSession: true,
      },
    );
    renderLivenessModule.releaseRenderLivenessLease(workerFirst);
    const staleGc = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31005,
      processAlive: (pid) => pid === 31005,
      scope: livenessScope,
    });
    const afterStaleGc = renderLivenessModule.acquireRenderSessionLease({
      coordinationRoot: livenessRoot,
      pid: 31006,
      processAlive: (pid) => pid === 31006,
      scope: livenessScope,
      tier: "proxy",
    });
    const staleGcAlreadyRemoved =
      renderLivenessModule.releaseRenderLivenessLease(staleGc) === false;
    renderLivenessModule.releaseRenderLivenessLease(afterStaleGc);
    const staleSession = renderLivenessModule.acquireRenderSessionLease({
      coordinationRoot: livenessRoot,
      pid: 31007,
      processAlive: (pid) => pid === 31007,
      scope: livenessScope,
      tier: "final",
    });
    const afterStaleSession = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31008,
      processAlive: (pid) => pid === 31008,
      scope: livenessScope,
    });
    const staleSessionAlreadyRemoved =
      renderLivenessModule.releaseRenderLivenessLease(staleSession) === false;
    renderLivenessModule.releaseRenderLivenessLease(afterStaleSession);
    TestValidator.equals(
      "dead GC and session owners are recovered through exact lease cleanup",
      namedFacts([
        ["staleGcAlreadyRemoved", () => staleGcAlreadyRemoved],
        ["staleSessionAlreadyRemoved", () => staleSessionAlreadyRemoved],
        [
          // The GC's own removal staging is a preserved path by design, so what
          // this asserts is that no lease survived beside it.
          "livenessRootEntries",
          () =>
            fs.readdirSync(livenessRoot).join() ===
            ".gc-preserved-removal-staging",
        ],
      ]),
      {
        staleGcAlreadyRemoved: true,
        staleSessionAlreadyRemoved: true,
        livenessRootEntries: true,
      },
    );
    const staleSuccessorLease = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31015,
      processAlive: (pid) => pid === 31015,
      scope: livenessScope,
    });
    const staleSuccessorGuard = path.join(
      livenessRoot,
      fs
        .readdirSync(livenessRoot)
        .find((name) => name.includes(".gc-apply.lock"))!,
    );
    const staleSuccessorBytes = fs.readFileSync(staleSuccessorGuard);
    const staleOriginal = path.join(livenessRoot, "stale-gc-original.lock");
    const nativeLivenessRename = mutableFs.renameSync;
    let isolatedStaleSuccessor: string | null = null;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        isolatedStaleSuccessor === null &&
        path.resolve(oldPath.toString()) === staleSuccessorGuard
      ) {
        nativeLivenessRename(oldPath, staleOriginal);
        fs.writeFileSync(staleSuccessorGuard, staleSuccessorBytes);
        isolatedStaleSuccessor = path.resolve(newPath.toString());
      }
      nativeLivenessRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let staleSuccessorRejected = false;
    let staleSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      staleSuccessorRejected = throws(() =>
        renderLivenessModule.acquireRenderSessionLease({
          coordinationRoot: livenessRoot,
          pid: 31016,
          processAlive: (pid) => pid === 31016,
          scope: livenessScope,
          tier: "proxy",
        }),
      );
    } catch (error) {
      staleSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(staleSuccessorCleanupFailure, [
        {
          resource: "render liveness stale successor rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeLivenessRename;
          },
        },
      ]);
    }
    const isolatedStaleSuccessorPath = isolatedStaleSuccessor as string | null;
    // Five facts in one holder said only that preservation failed. They keep
    // their single statement, because this test's static contracts pin the
    // top-level statement indices, and become named values in the comparison.
    const staleSuccessorPreserved = {
      successorBytesKept:
        isolatedStaleSuccessorPath !== null &&
        fs.readFileSync(isolatedStaleSuccessorPath).equals(staleSuccessorBytes),
      successorGuardRemoved: fs.existsSync(staleSuccessorGuard) === false,
      successorIsolated: isolatedStaleSuccessorPath !== null,
      successorOriginalResident: fs.existsSync(staleOriginal),
      // The release isolates into the GC's own removal staging, whose name is
      // `.gc-preserved-removal-staging`; the previous check looked for
      // ".preserved-" with a leading dot and could never match it.
      successorPreservedDirectory:
        isolatedStaleSuccessorPath !== null &&
        path
          .basename(path.dirname(isolatedStaleSuccessorPath))
          .startsWith(".gc-preserved-"),
    };
    const staleSuccessorOriginalReleaseRefused =
      renderLivenessModule.releaseRenderLivenessLease(staleSuccessorLease) ===
      false;
    TestValidator.equals(
      "stale guard cleanup preserves a pathname successor and refuses the worker",
      {
        ...staleSuccessorPreserved,
        ...namedFacts([
          ["staleSuccessorRejected", () => staleSuccessorRejected],
          [
            "staleSuccessorOriginalReleaseRefused",
            () => staleSuccessorOriginalReleaseRefused,
          ],
        ]),
      },
      {
        successorBytesKept: true,
        successorGuardRemoved: true,
        successorIsolated: true,
        successorOriginalResident: true,
        successorPreservedDirectory: true,
        staleSuccessorRejected: true,
        staleSuccessorOriginalReleaseRefused: true,
      },
    );
    fs.rmSync(staleOriginal);
    if (isolatedStaleSuccessorPath !== null) {
      fs.rmSync(isolatedStaleSuccessorPath);
      fs.rmdirSync(path.dirname(isolatedStaleSuccessorPath));
    }
    const malformedGuard = path.join(
      livenessRoot,
      `.automovie-liveness-${livenessScope}.gc-apply.lock`,
    );
    fs.writeFileSync(
      malformedGuard,
      `${JSON.stringify({ kind: "gc", pid: 31017, tier: null, token: 7 })}\n`,
    );
    const malformedGuardRejected = throws(() =>
      renderLivenessModule.acquireRenderSessionLease({
        coordinationRoot: livenessRoot,
        pid: 31018,
        processAlive: (pid) => pid === 31018,
        scope: livenessScope,
        tier: "final",
      }),
    );
    TestValidator.equals(
      "malformed GC owner tokens fail closed without deleting the guard",
      namedFacts([
        ["rejected", () => malformedGuardRejected],
        ["guardKept", () => fs.existsSync(malformedGuard)],
      ]),
      { rejected: true, guardKept: true },
    );
    fs.rmSync(malformedGuard);
    // The render command releases its lease at the end of the body that is the
    // whole command. A raw release in `finally` replaced the command's own
    // diagnostic whenever both failed, so the policy is asserted three ways:
    // a clean release rethrows the body failure untouched, a release failure
    // alone travels alone, and both together arrive primary-first.
    const policyLease = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31019,
      processAlive: (pid) => pid === 31019,
      scope: livenessScope,
    });
    const policyBodyFailure = new Error("fixture render body failure");
    const policyCleanRelease = messagesOf(
      captureFailure(() =>
        renderLivenessModule.preserveRenderLivenessLease(
          { error: policyBodyFailure },
          policyLease,
        ),
      ),
    );
    const policyHeldLease = renderLivenessModule.acquireRenderGcLease({
      coordinationRoot: livenessRoot,
      pid: 31020,
      processAlive: (pid) => pid === 31020,
      scope: livenessScope,
    });
    let policyReleaseRefused = 0;
    mutableFs.renameSync = ((): never => {
      policyReleaseRefused += 1;
      throw new Error("fixture lease release failure");
    }) as typeof fs.renameSync;
    let policyAlone: string[] = [];
    let policyBoth: string[] = [];
    let policyCleanupFailure: { error: unknown } | undefined;
    try {
      policyAlone = messagesOf(
        captureFailure(() =>
          renderLivenessModule.preserveRenderLivenessLease(
            undefined,
            policyHeldLease,
          ),
        ),
      );
      policyBoth = messagesOf(
        captureFailure(() =>
          renderLivenessModule.preserveRenderLivenessLease(
            { error: policyBodyFailure },
            policyHeldLease,
          ),
        ),
      );
    } catch (error) {
      policyCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(policyCleanupFailure, [
        {
          resource: "render liveness lease release hook",
          cleanup: () => {
            mutableFs.renameSync = nativeRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render liveness lease release preserves the guarded failure",
      namedFacts([
        [
          "policyCleanRelease",
          () =>
            policyCleanRelease.join(" | ") === "fixture render body failure",
        ],
        ["policyReleaseAttempted", () => policyReleaseRefused === 2],
        [
          "policyAlone",
          () =>
            policyAlone.length === 1 &&
            policyAlone[0]!.includes("fixture lease release failure"),
        ],
        [
          "policyBothPrimaryFirst",
          () =>
            policyBoth.length === 2 &&
            policyBoth[0] === "fixture render body failure" &&
            policyBoth[1]!.includes("fixture lease release failure"),
        ],
      ]),
      {
        policyCleanRelease: true,
        policyReleaseAttempted: true,
        policyAlone: true,
        policyBothPrimaryFirst: true,
      },
    );
    renderLivenessModule.releaseRenderLivenessLease(policyHeldLease);
    const renderGcModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderGcSnapshot.ts"),
    ) as {
      RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY: string;
      RENDER_GC_REMOVAL_STAGING_DIRECTORY: string;
      assertCapturedRenderGcFileEntry: (props: {
        directory: unknown;
        file: unknown;
        relative: string;
      }) => void;
      assertCapturedRenderTarget: (snapshot: unknown) => void;
      captureRenderGcTarget: (
        base: string,
        target: string,
      ) => {
        bytes: number;
        contentFingerprint: string;
        kind: "directory" | "file";
        target: string;
        targetIdentity: string;
      };
      createRenderGcFileSnapshot: (
        base: string,
        target: string,
        bytes: Uint8Array,
      ) => unknown;
      captureRenderPhysicalDirectory: (
        directory: string,
        label: string,
      ) => unknown;
      ensureRenderPhysicalDirectory: (base: string, relative: string) => string;
      inspectRenderQuarantineMarker: (snapshot: unknown) => {
        evidence: {
          bytes: number;
          contentFingerprint: string;
          kind: "directory" | "file";
          target: string;
          targetIdentity: string;
        };
        marker: {
          contentFingerprint: string;
          kind: "directory" | "file";
          original: string;
          preserved: string;
          targetIdentity: string;
          version: number;
        };
      };
      inventoryRenderQuarantineCandidates: (
        markers: readonly unknown[],
      ) => Array<{
        bytes: number;
        evidence: {
          bytes: number;
          target: string;
          targetIdentity: string;
        } | null;
        marker: { bytes: number; target: string };
      }>;
      isRenderGcPreservedPath: (relative: string) => boolean;
      quarantineCapturedRenderTarget: (props: {
        destination: string;
        isolated: string;
        quarantine: string;
        snapshot: unknown;
      }) => void;
      readCapturedRenderGcFile: (
        snapshot: unknown,
        maximumBytes: number,
      ) => Uint8Array;
      removeCapturedRenderGcTarget: (props: {
        isolated: string;
        quarantine: string;
        snapshot: unknown;
      }) => void;
      removeCapturedRenderQuarantine: (props: {
        evidence: unknown;
        marker: unknown;
        quarantine: string;
      }) => void;
    };
    const renderGcCleanupRoot = path.join(base, "render-gc-cleanup");
    const renderGcCleanupFile = path.join(renderGcCleanupRoot, "captured.bin");
    fs.mkdirSync(renderGcCleanupRoot);
    fs.writeFileSync(renderGcCleanupFile, "captured render bytes");
    const renderGcCleanupSnapshot = renderGcModule.captureRenderGcTarget(
      renderGcCleanupRoot,
      renderGcCleanupFile,
    );
    const shiftedChangeTime = (
      status: fs.BigIntStats,
      offset: bigint,
    ): fs.BigIntStats =>
      new Proxy(status, {
        get: (current, property, receiver): unknown =>
          property === "ctimeNs"
            ? current.ctimeNs + offset
            : Reflect.get(current, property, receiver),
      });
    const metadataSettlementRoot = path.join(
      base,
      "render-gc-metadata-settlement",
    );
    const metadataSettlementFile = path.join(
      metadataSettlementRoot,
      "captured.bin",
    );
    fs.mkdirSync(metadataSettlementRoot);
    fs.writeFileSync(metadataSettlementFile, "stable metadata bytes");
    let metadataSettlementCalls = 0;
    let metadataSettled = false;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [
        file,
        ...args,
      ]) as fs.BigIntStats;
      if (path.resolve(file.toString()) !== metadataSettlementFile)
        return status;
      metadataSettlementCalls += 1;
      if (metadataSettlementCalls >= 3) metadataSettled = true;
      return metadataSettled ? shiftedChangeTime(status, 1n) : status;
    }) as typeof fs.lstatSync;
    mutableFs.statSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeStat, mutableFs, [
        file,
        ...args,
      ]) as fs.BigIntStats;
      return path.resolve(file.toString()) === metadataSettlementFile &&
        metadataSettled
        ? shiftedChangeTime(status, 1n)
        : status;
    }) as typeof fs.statSync;
    let metadataSettlementSnapshot:
      | ReturnType<typeof renderGcModule.captureRenderGcTarget>
      | undefined;
    let metadataSettlementCleanupFailure: { error: unknown } | undefined;
    try {
      metadataSettlementSnapshot = renderGcModule.captureRenderGcTarget(
        metadataSettlementRoot,
        metadataSettlementFile,
      );
    } catch (error) {
      metadataSettlementCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(metadataSettlementCleanupFailure, [
        {
          resource: "render GC metadata settlement lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
        {
          resource: "render GC metadata settlement stat hook",
          cleanup: () => {
            mutableFs.statSync = nativeStat;
          },
        },
      ]);
    }
    let unstableMetadataCalls = 0;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [
        file,
        ...args,
      ]) as fs.BigIntStats;
      if (path.resolve(file.toString()) !== metadataSettlementFile)
        return status;
      unstableMetadataCalls += 1;
      return shiftedChangeTime(status, BigInt(unstableMetadataCalls));
    }) as typeof fs.lstatSync;
    let unstableMetadataRejected = false;
    let unstableMetadataCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.captureRenderGcTarget(
        metadataSettlementRoot,
        metadataSettlementFile,
      );
    } catch {
      unstableMetadataRejected = true;
    } finally {
      preserveCliHarnessCleanup(unstableMetadataCleanupFailure, [
        {
          resource: "render GC unstable metadata lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC tolerates one same-file metadata settlement only",
      namedFacts([
        [
          "stableBytes",
          () =>
            metadataSettlementSnapshot?.bytes ===
            Buffer.byteLength("stable metadata bytes"),
        ],
        ["retried", () => metadataSettlementCalls >= 10],
        ["unstableRejected", () => unstableMetadataRejected],
        ["bounded", () => unstableMetadataCalls === 5],
      ]),
      {
        stableBytes: true,
        retried: true,
        unstableRejected: true,
        bounded: true,
      },
    );
    const publishedMetadataFile = path.join(
      renderGcCleanupRoot,
      "published-metadata.bin",
    );
    let publishedMetadataDescriptor = -1;
    let publishedMetadataFstats = 0;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === publishedMetadataFile &&
        flags === "wx+"
      )
        publishedMetadataDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeFstat, mutableFs, [
        descriptor,
        ...args,
      ]) as fs.BigIntStats;
      if (descriptor !== publishedMetadataDescriptor) return status;
      publishedMetadataFstats += 1;
      return publishedMetadataFstats >= 2
        ? shiftedChangeTime(status, 1n)
        : status;
    }) as typeof fs.fstatSync;
    let publishedMetadataSnapshot:
      | ReturnType<typeof renderGcModule.captureRenderGcTarget>
      | undefined;
    let publishedMetadataCleanupFailure: { error: unknown } | undefined;
    try {
      publishedMetadataSnapshot = renderGcModule.createRenderGcFileSnapshot(
        renderGcCleanupRoot,
        publishedMetadataFile,
        Buffer.from("published metadata bytes"),
      ) as ReturnType<typeof renderGcModule.captureRenderGcTarget>;
    } catch (error) {
      publishedMetadataCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(publishedMetadataCleanupFailure, [
        {
          resource: "render GC published metadata open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC published metadata fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
      ]);
    }
    const changedPublicationFile = path.join(
      renderGcCleanupRoot,
      "changed-publication.bin",
    );
    let changedPublicationDescriptor = -1;
    let changedPublicationFstats = 0;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === changedPublicationFile &&
        flags === "wx+"
      )
        changedPublicationDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeFstat, mutableFs, [
        descriptor,
        ...args,
      ]) as fs.BigIntStats;
      if (descriptor !== changedPublicationDescriptor) return status;
      changedPublicationFstats += 1;
      return changedPublicationFstats >= 2
        ? new Proxy(status, {
            get: (current, property, receiver): unknown =>
              property === "mtimeNs"
                ? current.mtimeNs + 1n
                : Reflect.get(current, property, receiver),
          })
        : status;
    }) as typeof fs.fstatSync;
    let changedPublicationRejected = false;
    try {
      renderGcModule.createRenderGcFileSnapshot(
        renderGcCleanupRoot,
        changedPublicationFile,
        Buffer.from("changed publication bytes"),
      );
    } catch {
      changedPublicationRejected = true;
    } finally {
      preserveCliHarnessCleanup(undefined, [
        {
          resource: "render GC changed publication open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC changed publication fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render publication accepts metadata settlement but rejects content version drift",
      namedFacts([
        [
          "publishedBytes",
          () =>
            publishedMetadataSnapshot?.bytes ===
            Buffer.byteLength("published metadata bytes"),
        ],
        ["metadataObserved", () => publishedMetadataFstats >= 2],
        ["contentRejected", () => changedPublicationRejected],
      ]),
      {
        publishedBytes: true,
        metadataObserved: true,
        contentRejected: true,
      },
    );
    const standaloneRenderGcCloseFailure = new Error(
      "standalone render GC close failed",
    );
    let standaloneRenderGcDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === renderGcCleanupFile &&
        flags === "r"
      )
        standaloneRenderGcDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === standaloneRenderGcDescriptor)
        throw standaloneRenderGcCloseFailure;
    }) as typeof fs.closeSync;
    let standaloneRenderGcCloseError: unknown;
    let standaloneRenderGcHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.readCapturedRenderGcFile(renderGcCleanupSnapshot, 1024);
    } catch (error) {
      standaloneRenderGcCloseError = error;
      standaloneRenderGcHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(standaloneRenderGcHarnessCleanupFailure, [
        {
          resource: "render GC standalone open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC standalone close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    const primaryOnlyRenderGcFailure = new Error(
      "primary-only render GC read failed",
    );
    let primaryOnlyRenderGcDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === renderGcCleanupFile &&
        flags === "r"
      )
        primaryOnlyRenderGcDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (descriptor === primaryOnlyRenderGcDescriptor)
        throw primaryOnlyRenderGcFailure;
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    let preservedPrimaryOnlyRenderGcFailure: unknown;
    let primaryOnlyRenderGcHarnessCleanupFailure:
      | { error: unknown }
      | undefined;
    try {
      renderGcModule.readCapturedRenderGcFile(renderGcCleanupSnapshot, 1024);
    } catch (error) {
      preservedPrimaryOnlyRenderGcFailure = error;
      primaryOnlyRenderGcHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(primaryOnlyRenderGcHarnessCleanupFailure, [
        {
          resource: "render GC primary-only open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC primary-only fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
      ]);
    }
    const combinedRenderGcPrimary = new Error("render GC read failed");
    const combinedRenderGcClose = new Error("render GC read close failed");
    let combinedRenderGcDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === renderGcCleanupFile &&
        flags === "r"
      )
        combinedRenderGcDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (descriptor === combinedRenderGcDescriptor)
        throw combinedRenderGcPrimary;
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === combinedRenderGcDescriptor)
        throw combinedRenderGcClose;
    }) as typeof fs.closeSync;
    let combinedRenderGcFailure: unknown;
    let combinedRenderGcHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.readCapturedRenderGcFile(renderGcCleanupSnapshot, 1024);
    } catch (error) {
      combinedRenderGcFailure = error;
      combinedRenderGcHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(combinedRenderGcHarnessCleanupFailure, [
        {
          resource: "render GC combined open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC combined fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "render GC combined close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    const failedRenderGcCreate = path.join(
      renderGcCleanupRoot,
      "failed-create.bin",
    );
    const renderGcCreatePrimary = new Error("render GC creation failed");
    const renderGcCreateClose = new Error("render GC creation close failed");
    let failedRenderGcCreateDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === failedRenderGcCreate &&
        flags === "wx+"
      )
        failedRenderGcCreateDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.writeSync = ((...args: unknown[]): number => {
      if (args[0] === failedRenderGcCreateDescriptor)
        throw renderGcCreatePrimary;
      return Reflect.apply(nativeWrite, mutableFs, args) as number;
    }) as typeof fs.writeSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === failedRenderGcCreateDescriptor)
        throw renderGcCreateClose;
    }) as typeof fs.closeSync;
    let combinedRenderGcCreateFailure: unknown;
    let renderGcCreateHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.createRenderGcFileSnapshot(
        renderGcCleanupRoot,
        failedRenderGcCreate,
        Buffer.from("failed creation bytes"),
      );
    } catch (error) {
      combinedRenderGcCreateFailure = error;
      renderGcCreateHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(renderGcCreateHarnessCleanupFailure, [
        {
          resource: "render GC create open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC create write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
        {
          resource: "render GC create close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    const nestedRenderGcCreate = path.join(
      renderGcCleanupRoot,
      "nested-create.bin",
    );
    const nestedRenderGcPrimary = new Error("render GC inventory read failed");
    const nestedRenderGcReadClose = new Error(
      "render GC inventory descriptor close failed",
    );
    const nestedRenderGcCreateClose = new Error(
      "render GC create descriptor close failed",
    );
    let nestedRenderGcOwnerDescriptor = -1;
    let nestedRenderGcReadDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (path.resolve(file.toString()) === nestedRenderGcCreate) {
        if (flags === "wx+") nestedRenderGcOwnerDescriptor = descriptor;
        else if (flags === "r" && nestedRenderGcReadDescriptor === -1)
          nestedRenderGcReadDescriptor = descriptor;
      }
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (descriptor === nestedRenderGcReadDescriptor)
        throw nestedRenderGcPrimary;
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === nestedRenderGcReadDescriptor)
        throw nestedRenderGcReadClose;
      if (descriptor === nestedRenderGcOwnerDescriptor)
        throw nestedRenderGcCreateClose;
    }) as typeof fs.closeSync;
    let combinedNestedRenderGcFailure: unknown;
    let nestedRenderGcHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.createRenderGcFileSnapshot(
        renderGcCleanupRoot,
        nestedRenderGcCreate,
        Buffer.from("nested creation bytes"),
      );
    } catch (error) {
      combinedNestedRenderGcFailure = error;
      nestedRenderGcHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(nestedRenderGcHarnessCleanupFailure, [
        {
          resource: "render GC nested open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render GC nested fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "render GC nested close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC descriptor cleanup preserves operation and resource order",
      namedFacts([
        [
          "standaloneRenderGcCloseErrorStandaloneRenderGcCloseFailure",
          () => standaloneRenderGcCloseError === standaloneRenderGcCloseFailure,
        ],
        [
          "preservedPrimaryOnlyRenderGcFailurePrimaryOnlyRenderGcFailure",
          () =>
            preservedPrimaryOnlyRenderGcFailure === primaryOnlyRenderGcFailure,
        ],
        [
          "combinedRenderGcFailureInstanceof",
          () => combinedRenderGcFailure instanceof AggregateError,
        ],
        [
          "combinedRenderGcFailureCount",
          () =>
            combinedRenderGcFailure instanceof AggregateError &&
            combinedRenderGcFailure.errors.length === 2,
        ],
        [
          "combinedRenderGcFailureErrors",
          () =>
            combinedRenderGcFailure instanceof AggregateError &&
            combinedRenderGcFailure.errors.length === 2 &&
            combinedRenderGcFailure.errors[0] === combinedRenderGcPrimary,
        ],
        [
          "combinedRenderGcFailureErrors2",
          () =>
            combinedRenderGcFailure instanceof AggregateError &&
            combinedRenderGcFailure.errors.length === 2 &&
            combinedRenderGcFailure.errors[0] === combinedRenderGcPrimary &&
            combinedRenderGcFailure.errors[1] === combinedRenderGcClose,
        ],
        [
          "combinedRenderGcCreateFailureInstanceof",
          () => combinedRenderGcCreateFailure instanceof AggregateError,
        ],
        [
          "combinedRenderGcCreateFailureCount",
          () =>
            combinedRenderGcCreateFailure instanceof AggregateError &&
            combinedRenderGcCreateFailure.errors.length === 2,
        ],
        [
          "combinedRenderGcCreateFailureErrors",
          () =>
            combinedRenderGcCreateFailure instanceof AggregateError &&
            combinedRenderGcCreateFailure.errors.length === 2 &&
            combinedRenderGcCreateFailure.errors[0] === renderGcCreatePrimary,
        ],
        [
          "combinedRenderGcCreateFailureErrors2",
          () =>
            combinedRenderGcCreateFailure instanceof AggregateError &&
            combinedRenderGcCreateFailure.errors.length === 2 &&
            combinedRenderGcCreateFailure.errors[0] === renderGcCreatePrimary &&
            combinedRenderGcCreateFailure.errors[1] === renderGcCreateClose,
        ],
        [
          "combinedNestedRenderGcFailureInstanceof",
          () => combinedNestedRenderGcFailure instanceof AggregateError,
        ],
        [
          "combinedNestedRenderGcFailureCount",
          () =>
            combinedNestedRenderGcFailure instanceof AggregateError &&
            combinedNestedRenderGcFailure.errors.length === 3,
        ],
        [
          "combinedNestedRenderGcFailureErrors",
          () =>
            combinedNestedRenderGcFailure instanceof AggregateError &&
            combinedNestedRenderGcFailure.errors.length === 3 &&
            combinedNestedRenderGcFailure.errors[0] === nestedRenderGcPrimary,
        ],
        [
          "combinedNestedRenderGcFailureErrors2",
          () =>
            combinedNestedRenderGcFailure instanceof AggregateError &&
            combinedNestedRenderGcFailure.errors.length === 3 &&
            combinedNestedRenderGcFailure.errors[0] === nestedRenderGcPrimary &&
            combinedNestedRenderGcFailure.errors[1] === nestedRenderGcReadClose,
        ],
        [
          "combinedNestedRenderGcFailureErrors3",
          () =>
            combinedNestedRenderGcFailure instanceof AggregateError &&
            combinedNestedRenderGcFailure.errors.length === 3 &&
            combinedNestedRenderGcFailure.errors[0] === nestedRenderGcPrimary &&
            combinedNestedRenderGcFailure.errors[1] ===
              nestedRenderGcReadClose &&
            combinedNestedRenderGcFailure.errors[2] ===
              nestedRenderGcCreateClose,
        ],
      ]),
      {
        standaloneRenderGcCloseErrorStandaloneRenderGcCloseFailure: true,
        preservedPrimaryOnlyRenderGcFailurePrimaryOnlyRenderGcFailure: true,
        combinedRenderGcFailureInstanceof: true,
        combinedRenderGcFailureCount: true,
        combinedRenderGcFailureErrors: true,
        combinedRenderGcFailureErrors2: true,
        combinedRenderGcCreateFailureInstanceof: true,
        combinedRenderGcCreateFailureCount: true,
        combinedRenderGcCreateFailureErrors: true,
        combinedRenderGcCreateFailureErrors2: true,
        combinedNestedRenderGcFailureInstanceof: true,
        combinedNestedRenderGcFailureCount: true,
        combinedNestedRenderGcFailureErrors: true,
        combinedNestedRenderGcFailureErrors2: true,
        combinedNestedRenderGcFailureErrors3: true,
      },
    );
    const renderTemporarySnapshotModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderTemporarySnapshot.ts"),
    ) as {
      createRenderChunkTemporaryTree: (props: {
        name: string;
        state: unknown;
      }) => unknown;
    };
    const renderChunkSnapshotModule = createRequire(__filename)(
      path.join(scaffoldDir, "scripts", "renderChunkSnapshot.ts"),
    ) as {
      assertRenderChunkPublication: (publication: unknown) => void;
      captureRenderChunkPublication: (
        root: string,
        pointer: string,
      ) => {
        pointer: unknown;
        receipt: { chunk: string; slot: string };
        tree: { target: string };
      };
      captureRenderChunkPublicationFromPointer: (pointer: unknown) => {
        pointer: unknown;
        receipt: unknown;
        tree: { target: string };
      };
      consumeCurrentRenderChunkFrames: (
        current: {
          frames: Array<{
            bytes: Uint8Array;
            receipt: { globalFrame: number };
          }>;
        },
        consume: (frame: {
          bytes: Uint8Array;
          receipt: { globalFrame: number };
        }) => void,
      ) => void;
      currentRenderChunkPublicationProtectsTree: (props: {
        candidate: unknown;
        candidateName: string;
        capture: (chunk: { id: string; slot: string }) => {
          pointer: unknown;
          receipt: { chunk: string; slot: string };
          tree: { target: string };
        } | null;
        chunks: ReadonlyMap<string, { id: string; slot: string }>;
      }) => boolean;
      inventoryRenderChunkGarbage: (props: {
        assertReceipt: (
          chunk: { id: string; slot: string },
          receipt: { chunk: string; slot: string },
        ) => void;
        chunks: ReadonlyMap<string, { id: string; slot: string }>;
        processAlive: (pid: number) => boolean;
        renderJobRoot: string;
        root: string;
        scope: string;
        tier: "final" | "proxy";
      }) => {
        entries: Array<{
          candidate: { bytes: number; kind: string; path: string };
          snapshot: {
            base: { path: string };
            contentFingerprint: string;
            targetIdentity: string;
          };
        }>;
        retainedChunkPaths: string[];
      };
      loadCurrentRenderChunkPublication: (props: {
        assertReceipt: (receipt: { chunk: string }) => void;
        chunk: { frames: unknown[] };
        frameFormat: { fps: number; height: number; width: number };
        pointer: unknown;
      }) => {
        frames: Array<{
          bytes: Uint8Array;
          receipt: { globalFrame: number };
        }>;
        receipt: { chunk: string };
      } | null;
      loadRenderChunkPublication: (
        root: string,
        pointer: string,
      ) => {
        encoded: Uint8Array;
        frames: Array<{ bytes: Uint8Array; receipt: { globalFrame: number } }>;
        publication: unknown;
        receipt: unknown;
      };
      publishRenderChunkSnapshot: (props: {
        chunk: string;
        receipt: unknown;
        root: string;
        scope: string;
        tier: "final" | "proxy";
        tree: unknown;
      }) => {
        publication: { pointer: unknown; receipt: unknown };
        reused: boolean;
      };
      readRenderChunkPublicationFile: (
        publication: unknown,
        relative: string,
      ) => Uint8Array;
      removeRenderChunkPublication: (root: string, pointer: string) => boolean;
      removeCapturedRenderChunkPointer: (pointer: unknown) => void;
      renderChunkPublicationProtectsTree: (
        publication: unknown,
        candidate: unknown,
      ) => boolean;
      renderChunkContentFingerprint: (snapshot: unknown) => string;
      renderChunkPublicationPath: (props: {
        chunk: string;
        root: string;
        scope: string;
        tier: "final" | "proxy";
      }) => string;
    };
    const temporaryHandoffRoot = path.join(
      base,
      "render-temporary-handoff-root",
    );
    const parkedTemporaryHandoffRoot = `${temporaryHandoffRoot}.parked`;
    fs.mkdirSync(temporaryHandoffRoot);
    const temporaryHandoffOwnership =
      renderGcModule.captureRenderPhysicalDirectory(
        temporaryHandoffRoot,
        "render temporary handoff fixture",
      );
    fs.renameSync(temporaryHandoffRoot, parkedTemporaryHandoffRoot);
    fs.mkdirSync(temporaryHandoffRoot);
    const temporaryHandoffRejected = throws(() =>
      renderTemporarySnapshotModule.createRenderChunkTemporaryTree({
        name: "entry-race",
        state: temporaryHandoffOwnership,
      }),
    );
    TestValidator.equals(
      "render temporary creation rejects a state successor before helper entry",
      namedFacts([
        ["temporaryHandoffRejected", () => temporaryHandoffRejected],
        [
          "temporaryHandoffRootResident",
          () => fs.existsSync(path.join(temporaryHandoffRoot, "tmp")) === false,
        ],
        [
          "parkedTemporaryHandoffRootResident",
          () => fs.existsSync(parkedTemporaryHandoffRoot),
        ],
      ]),
      {
        temporaryHandoffRejected: true,
        temporaryHandoffRootResident: true,
        parkedTemporaryHandoffRootResident: true,
      },
    );
    fs.rmSync(temporaryHandoffRoot, { recursive: true, force: true });
    fs.rmSync(parkedTemporaryHandoffRoot, { recursive: true, force: true });

    const temporaryStateRoot = path.join(base, "render-temporary-state-root");
    const temporaryStateTree = path.join(
      temporaryStateRoot,
      "tmp",
      "state-race",
    );
    const parkedTemporaryStateRoot = `${temporaryStateRoot}.parked`;
    fs.mkdirSync(temporaryStateRoot);
    const temporaryStateOwnership =
      renderGcModule.captureRenderPhysicalDirectory(
        temporaryStateRoot,
        "render temporary fixture state",
      );
    let temporaryStateSwapped = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        temporaryStateSwapped === false &&
        path.resolve(directory.toString()) === temporaryStateTree
      ) {
        nativeLivenessRename(temporaryStateRoot, parkedTemporaryStateRoot);
        Reflect.apply(nativeMkdir, mutableFs, [
          path.join(temporaryStateRoot, "tmp"),
          { recursive: true },
        ]);
        temporaryStateSwapped = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let temporaryStateRejected = false;
    let temporaryStateCleanupFailure: { error: unknown } | undefined;
    try {
      temporaryStateRejected = throws(() =>
        renderTemporarySnapshotModule.createRenderChunkTemporaryTree({
          name: "state-race",
          state: temporaryStateOwnership,
        }),
      );
    } catch (error) {
      temporaryStateCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(temporaryStateCleanupFailure, [
        {
          resource: "render temporary state mkdir hook",
          cleanup: () => {
            mutableFs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render temporary creation rejects a render-state successor",
      namedFacts([
        ["temporaryStateSwapped", () => temporaryStateSwapped],
        ["temporaryStateRejected", () => temporaryStateRejected],
        ["temporaryStateTreeResident", () => fs.existsSync(temporaryStateTree)],
        [
          "parkedTemporaryStateRootResident",
          () => fs.existsSync(path.join(parkedTemporaryStateRoot, "tmp")),
        ],
      ]),
      {
        temporaryStateSwapped: true,
        temporaryStateRejected: true,
        temporaryStateTreeResident: true,
        parkedTemporaryStateRootResident: true,
      },
    );
    fs.rmSync(temporaryStateRoot, { recursive: true, force: true });
    fs.rmSync(parkedTemporaryStateRoot, { recursive: true, force: true });

    const temporaryParentState = path.join(base, "render-temporary-parent");
    const temporaryParentRoot = path.join(temporaryParentState, "tmp");
    const temporaryParentTree = path.join(temporaryParentRoot, "parent-race");
    const parkedTemporaryParent = `${temporaryParentRoot}.parked`;
    fs.mkdirSync(temporaryParentState);
    const temporaryParentOwnership =
      renderGcModule.captureRenderPhysicalDirectory(
        temporaryParentState,
        "render temporary fixture parent",
      );
    let temporaryParentSwapped = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        temporaryParentSwapped === false &&
        path.resolve(directory.toString()) === temporaryParentTree
      ) {
        nativeLivenessRename(temporaryParentRoot, parkedTemporaryParent);
        Reflect.apply(nativeMkdir, mutableFs, [temporaryParentRoot]);
        temporaryParentSwapped = true;
      }
      return Reflect.apply(nativeMkdir, mutableFs, [directory, ...args]);
    }) as typeof fs.mkdirSync;
    let temporaryParentRejected = false;
    let temporaryParentCleanupFailure: { error: unknown } | undefined;
    try {
      temporaryParentRejected = throws(() =>
        renderTemporarySnapshotModule.createRenderChunkTemporaryTree({
          name: "parent-race",
          state: temporaryParentOwnership,
        }),
      );
    } catch (error) {
      temporaryParentCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(temporaryParentCleanupFailure, [
        {
          resource: "render temporary parent mkdir hook",
          cleanup: () => {
            mutableFs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render temporary creation rejects a tmp-parent successor",
      namedFacts([
        ["temporaryParentSwapped", () => temporaryParentSwapped],
        ["temporaryParentRejected", () => temporaryParentRejected],
        [
          "temporaryParentTreeResident",
          () => fs.existsSync(temporaryParentTree),
        ],
        [
          "parkedTemporaryParentResident",
          () => fs.existsSync(parkedTemporaryParent),
        ],
      ]),
      {
        temporaryParentSwapped: true,
        temporaryParentRejected: true,
        temporaryParentTreeResident: true,
        parkedTemporaryParentResident: true,
      },
    );
    fs.rmSync(temporaryParentState, { recursive: true, force: true });

    const chunkPublicationRoot = path.join(base, "chunk-publication");
    const chunkPublicationScope = "b".repeat(64);
    const chunkPublicationId = fixtureDigest(
      Buffer.from("published chunk identity"),
    );
    const chunkFrameBytes = Buffer.from(productionPng(16, 16));
    const chunkVideoBytes = Buffer.from(
      await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 24,
        frameCount: 1,
      }),
    );
    const populateChunkSource = (
      directory: string,
      chunk: string,
    ): {
      encoded: { bytes: number; digest: string; path: string };
      frames: Array<{
        bytes: number;
        digest: string;
        globalFrame: number;
        height: number;
        path: string;
        width: number;
      }>;
      slot: string;
      chunk: string;
      version: 1;
    } => {
      fs.mkdirSync(path.join(directory, "frames"), { recursive: true });
      fs.writeFileSync(
        path.join(directory, "frames", "frame_00000000.png"),
        chunkFrameBytes,
      );
      fs.writeFileSync(path.join(directory, "chunk.mp4"), chunkVideoBytes);
      return {
        version: 1,
        slot: "feature:beauty:00000000",
        chunk,
        frames: [
          {
            globalFrame: 0,
            path: "frames/frame_00000000.png",
            digest: fixtureDigest(chunkFrameBytes),
            bytes: chunkFrameBytes.length,
            width: 16,
            height: 16,
          },
        ],
        encoded: {
          path: "chunk.mp4",
          digest: fixtureDigest(chunkVideoBytes),
          bytes: chunkVideoBytes.length,
        },
      };
    };
    const captureChunkTree = (root: string, tree: string) =>
      renderGcModule.captureRenderGcTarget(root, tree);
    fs.mkdirSync(chunkPublicationRoot);
    const normalChunkSource = path.join(chunkPublicationRoot, "normal-source");
    const normalChunkReceipt = populateChunkSource(
      normalChunkSource,
      chunkPublicationId,
    );
    const normalChunkPointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: chunkPublicationId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    let receiptPublishedLast = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === normalChunkPointer &&
        flags === "wx+"
      )
        receiptPublishedLast =
          fs.existsSync(path.join(normalChunkSource, "chunk.mp4")) &&
          fs.existsSync(
            path.join(normalChunkSource, "frames", "frame_00000000.png"),
          ) &&
          fs.existsSync(normalChunkPointer) === false;
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    const normalChunkPublished = (() => {
      let normalChunkCleanupFailure: { error: unknown } | undefined;
      try {
        return renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: chunkPublicationId,
          receipt: normalChunkReceipt,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: captureChunkTree(chunkPublicationRoot, normalChunkSource),
        });
      } catch (error) {
        normalChunkCleanupFailure = { error };
        throw error;
      } finally {
        preserveCliHarnessCleanup(normalChunkCleanupFailure, [
          {
            resource: "render chunk normal publication open hook",
            cleanup: () => {
              mutableFs.openSync = nativeOpen;
            },
          },
        ]);
      }
    })();
    const normalChunkPublication =
      renderChunkSnapshotModule.captureRenderChunkPublication(
        chunkPublicationRoot,
        normalChunkPointer,
      );
    const normalLoadedChunk =
      renderChunkSnapshotModule.loadRenderChunkPublication(
        chunkPublicationRoot,
        normalChunkPointer,
      );
    const normalCurrentChunk =
      renderChunkSnapshotModule.loadCurrentRenderChunkPublication({
        assertReceipt: (receipt) => {
          if (receipt.chunk !== chunkPublicationId)
            throw new Error("current chunk receipt changed identity");
        },
        chunk: { frames: [{}] },
        frameFormat: { fps: 24, height: 16, width: 16 },
        pointer: normalChunkPublication.pointer,
      });
    renderChunkSnapshotModule.assertRenderChunkPublication(
      normalChunkPublication,
    );
    const guideFrames = new Map<number, Uint8Array>();
    const encodedFrames: Uint8Array[] = [];
    if (normalCurrentChunk !== null) {
      renderChunkSnapshotModule.consumeCurrentRenderChunkFrames(
        normalCurrentChunk,
        (frame) => guideFrames.set(frame.receipt.globalFrame, frame.bytes),
      );
      renderChunkSnapshotModule.consumeCurrentRenderChunkFrames(
        normalCurrentChunk,
        (frame) => encodedFrames.push(frame.bytes),
      );
    }
    TestValidator.equals(
      "render chunk pointer loads complete resume and finalize bytes from one tree",
      namedFacts([
        [
          "normalChunkPublishedReused",
          () => normalChunkPublished.reused === false,
        ],
        ["receiptPublishedLast", () => receiptPublishedLast],
        ["normalCurrentChunk", () => normalCurrentChunk !== null],
        [
          "normalLoadedChunkEncoded",
          () => Buffer.from(normalLoadedChunk.encoded).equals(chunkVideoBytes),
        ],
        [
          "guideFramesGet",
          () => Buffer.from(guideFrames.get(0)!).equals(chunkFrameBytes),
        ],
        ["encodedFramesCount", () => encodedFrames.length === 1],
        [
          "encodedFramesChunkFrameBytes",
          () => Buffer.from(encodedFrames[0]!).equals(chunkFrameBytes),
        ],
      ]),
      {
        normalChunkPublishedReused: true,
        receiptPublishedLast: true,
        normalCurrentChunk: true,
        normalLoadedChunkEncoded: true,
        guideFramesGet: true,
        encodedFramesCount: true,
        encodedFramesChunkFrameBytes: true,
      },
    );
    const parkedPublishedTree = path.join(
      chunkPublicationRoot,
      "normal-tree-original",
    );
    fs.renameSync(normalChunkSource, parkedPublishedTree);
    fs.cpSync(parkedPublishedTree, normalChunkSource, {
      recursive: true,
    });
    const consumerSuccessorRejected = throws(() =>
      renderChunkSnapshotModule.loadRenderChunkPublication(
        chunkPublicationRoot,
        normalChunkPointer,
      ),
    );
    TestValidator.equals(
      "a consumer refuses a byte-identical successor installed after tree capture",
      namedFacts([
        ["consumerSuccessorRejected", () => consumerSuccessorRejected],
        ["normalChunkSourceResident", () => fs.existsSync(normalChunkSource)],
        [
          "parkedPublishedTreeResident",
          () => fs.existsSync(parkedPublishedTree),
        ],
      ]),
      {
        consumerSuccessorRejected: true,
        normalChunkSourceResident: true,
        parkedPublishedTreeResident: true,
      },
    );

    const tempRaceId = fixtureDigest(Buffer.from("temp successor chunk"));
    const tempRaceSource = path.join(chunkPublicationRoot, "temp-race-source");
    const tempRaceParked = path.join(
      chunkPublicationRoot,
      "temp-race-original",
    );
    const tempRaceReceipt = populateChunkSource(tempRaceSource, tempRaceId);
    const tempRacePointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: tempRaceId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    let tempSuccessorInstalled = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        tempSuccessorInstalled === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === tempRacePointer &&
        flags === "wx+"
      ) {
        nativeLivenessRename(tempRaceSource, tempRaceParked);
        fs.cpSync(tempRaceParked, tempRaceSource, { recursive: true });
        tempSuccessorInstalled = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let tempSuccessorRejected = false;
    let tempSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      tempSuccessorRejected = throws(() =>
        renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: tempRaceId,
          receipt: tempRaceReceipt,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: captureChunkTree(chunkPublicationRoot, tempRaceSource),
        }),
      );
    } catch (error) {
      tempSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(tempSuccessorCleanupFailure, [
        {
          resource: "render chunk temp successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "publication refuses a temp successor without modifying its tree bytes",
      namedFacts([
        ["tempSuccessorInstalled", () => tempSuccessorInstalled],
        ["tempSuccessorRejected", () => tempSuccessorRejected],
        ["tempRaceParkedResident", () => fs.existsSync(tempRaceParked)],
        [
          "tempRaceSourceChunk",
          () =>
            fs
              .readFileSync(path.join(tempRaceSource, "chunk.mp4"))
              .equals(chunkVideoBytes),
        ],
        [
          "tempRaceParkedChunk",
          () =>
            fs
              .readFileSync(path.join(tempRaceParked, "chunk.mp4"))
              .equals(chunkVideoBytes),
        ],
      ]),
      {
        tempSuccessorInstalled: true,
        tempSuccessorRejected: true,
        tempRaceParkedResident: true,
        tempRaceSourceChunk: true,
        tempRaceParkedChunk: true,
      },
    );

    for (const targetKind of ["frame", "chunk"] as const) {
      const handoffId = fixtureDigest(
        Buffer.from(`${targetKind} target handoff successor`),
      );
      const handoffSource = path.join(
        chunkPublicationRoot,
        `${targetKind}-handoff-source`,
      );
      const handoffReceipt = populateChunkSource(handoffSource, handoffId);
      const handoffTree = captureChunkTree(chunkPublicationRoot, handoffSource);
      const handoffTarget =
        targetKind === "frame"
          ? path.join(handoffSource, "frames", "frame_00000000.png")
          : path.join(handoffSource, "chunk.mp4");
      const parkedHandoffTarget = path.join(
        chunkPublicationRoot,
        `${targetKind}-handoff-original`,
      );
      const handoffBytes = fs.readFileSync(handoffTarget);
      fs.renameSync(handoffTarget, parkedHandoffTarget);
      fs.writeFileSync(handoffTarget, handoffBytes);
      const handoffPointer =
        renderChunkSnapshotModule.renderChunkPublicationPath({
          chunk: handoffId,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
        });
      const handoffRejected = throws(() =>
        renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: handoffId,
          receipt: handoffReceipt,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: handoffTree,
        }),
      );
      TestValidator.equals(
        `publication refuses a byte-identical ${targetKind} successor after tree capture`,
        namedFacts([
          ["handoffRejected", () => handoffRejected],
          ["parkedHandoffResident", () => fs.existsSync(parkedHandoffTarget)],
          [
            "handoffBytesKept",
            () => fs.readFileSync(handoffTarget).equals(handoffBytes),
          ],
          [
            "handoffPointerAbsent",
            () => fs.existsSync(handoffPointer) === false,
          ],
        ]),
        {
          handoffRejected: true,
          parkedHandoffResident: true,
          handoffBytesKept: true,
          handoffPointerAbsent: true,
        },
      );
    }

    const byteMismatchId = fixtureDigest(Buffer.from("byte mismatch chunk"));
    const byteMismatchSource = path.join(
      chunkPublicationRoot,
      "byte-mismatch-source",
    );
    const byteMismatchReceipt = populateChunkSource(
      byteMismatchSource,
      byteMismatchId,
    );
    const byteMismatchVideo = Buffer.from(chunkVideoBytes);
    byteMismatchVideo[byteMismatchVideo.length - 1] ^= 1;
    fs.writeFileSync(
      path.join(byteMismatchSource, "chunk.mp4"),
      byteMismatchVideo,
    );
    const byteMismatchPointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: byteMismatchId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    const byteMismatchRejected = throws(() =>
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: byteMismatchId,
        receipt: byteMismatchReceipt,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
        tree: captureChunkTree(chunkPublicationRoot, byteMismatchSource),
      }),
    );
    TestValidator.equals(
      "publication refuses receipt facts from a byte-different temp tree",
      namedFacts([
        ["rejected", () => byteMismatchRejected],
        ["noPointer", () => fs.existsSync(byteMismatchPointer) === false],
      ]),
      { rejected: true, noPointer: true },
    );

    const recoveryId = fixtureDigest(Buffer.from("late recovery pointer"));
    const recoverySource = path.join(chunkPublicationRoot, "recovery-source");
    const recoveryReceipt = populateChunkSource(recoverySource, recoveryId);
    const recoveryCandidate = renderGcModule.captureRenderGcTarget(
      chunkPublicationRoot,
      recoverySource,
    );
    renderChunkSnapshotModule.publishRenderChunkSnapshot({
      chunk: recoveryId,
      receipt: recoveryReceipt,
      root: chunkPublicationRoot,
      scope: chunkPublicationScope,
      tier: "final",
      tree: recoveryCandidate,
    });
    const recoveryDecoys = [0, 1].map((index) => {
      const id = fixtureDigest(Buffer.from(`recovery decoy ${index}`));
      const source = path.join(chunkPublicationRoot, `recovery-decoy-${index}`);
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: id,
        receipt: populateChunkSource(source, id),
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "final",
        tree: captureChunkTree(chunkPublicationRoot, source),
      });
      return {
        id,
        pointer: renderChunkSnapshotModule.renderChunkPublicationPath({
          chunk: id,
          root: chunkPublicationRoot,
          scope: chunkPublicationScope,
          tier: "final",
        }),
        source,
      };
    });
    let recoveryDecoyOpens = 0;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        typeof file !== "number" &&
        recoveryDecoys.some(
          (decoy) =>
            path.resolve(file.toString()) === path.resolve(decoy.pointer) ||
            path
              .resolve(file.toString())
              .startsWith(`${path.resolve(decoy.source)}${path.sep}`),
        )
      )
        recoveryDecoyOpens++;
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let recoveryProtected = false;
    let recoveryDecoyCleanupFailure: { error: unknown } | undefined;
    try {
      recoveryProtected =
        renderChunkSnapshotModule.currentRenderChunkPublicationProtectsTree({
          candidate: recoveryCandidate,
          candidateName: `${recoveryId.slice(7)}.candidate.999999`,
          capture: (chunk) =>
            renderChunkSnapshotModule.captureRenderChunkPublication(
              chunkPublicationRoot,
              renderChunkSnapshotModule.renderChunkPublicationPath({
                chunk: chunk.id,
                root: chunkPublicationRoot,
                scope: chunkPublicationScope,
                tier: "final",
              }),
            ),
          chunks: new Map([
            [recoveryId, { id: recoveryId, slot: recoveryReceipt.slot }],
            ...recoveryDecoys.map(
              (decoy, index) =>
                [decoy.id, { id: decoy.id, slot: `decoy-${index}` }] as const,
            ),
          ]),
        });
    } catch (error) {
      recoveryDecoyCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(recoveryDecoyCleanupFailure, [
        {
          resource: "render chunk recovery decoy open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "late recovery checks only the candidate's canonical pointer and tree",
      namedFacts([
        ["protected", () => recoveryProtected],
        ["decoyUnopened", () => recoveryDecoyOpens === 0],
      ]),
      { protected: true, decoyUnopened: true },
    );

    const chunkGcRoot = path.join(base, "chunk-gc-project");
    const chunkGcRenderJobRoot = path.join(
      chunkGcRoot,
      ".automovie",
      "productions",
      "feature",
      "render-job",
    );
    const chunkGcTemporaryRoot = path.join(
      chunkGcRenderJobRoot,
      "final",
      "tmp",
    );
    fs.mkdirSync(chunkGcTemporaryRoot, { recursive: true });
    const chunkGcCurrentId = fixtureDigest(Buffer.from("gc current chunk"));
    const chunkGcCurrentName = `${chunkGcCurrentId.slice(7)}.current.701`;
    const chunkGcCurrentTree = path.join(
      chunkGcTemporaryRoot,
      chunkGcCurrentName,
    );
    const chunkGcCurrentReceipt = populateChunkSource(
      chunkGcCurrentTree,
      chunkGcCurrentId,
    );
    renderChunkSnapshotModule.publishRenderChunkSnapshot({
      chunk: chunkGcCurrentId,
      receipt: chunkGcCurrentReceipt,
      root: chunkGcRoot,
      scope: chunkPublicationScope,
      tier: "final",
      tree: captureChunkTree(chunkGcRoot, chunkGcCurrentTree),
    });
    const chunkGcOrphanName = `${chunkGcCurrentId.slice(7)}.orphan.702`;
    populateChunkSource(
      path.join(chunkGcTemporaryRoot, chunkGcOrphanName),
      chunkGcCurrentId,
    );
    const chunkGcStaleId = fixtureDigest(Buffer.from("gc stale chunk"));
    const chunkGcStaleName = `${chunkGcStaleId.slice(7)}.stale.703`;
    const chunkGcStaleTree = path.join(chunkGcTemporaryRoot, chunkGcStaleName);
    renderChunkSnapshotModule.publishRenderChunkSnapshot({
      chunk: chunkGcStaleId,
      receipt: populateChunkSource(chunkGcStaleTree, chunkGcStaleId),
      root: chunkGcRoot,
      scope: chunkPublicationScope,
      tier: "final",
      tree: captureChunkTree(chunkGcRoot, chunkGcStaleTree),
    });
    const chunkGcLiveId = fixtureDigest(Buffer.from("gc live temp"));
    const chunkGcLiveName = `${chunkGcLiveId.slice(7)}.live.704`;
    populateChunkSource(
      path.join(chunkGcTemporaryRoot, chunkGcLiveName),
      chunkGcLiveId,
    );
    const inventoryChunkGarbage = () =>
      renderChunkSnapshotModule.inventoryRenderChunkGarbage({
        assertReceipt: (chunk, receipt) => {
          if (chunk.id !== receipt.chunk || chunk.slot !== receipt.slot)
            throw new Error("test chunk receipt mismatch");
        },
        chunks: new Map([
          [
            chunkGcCurrentId,
            {
              id: chunkGcCurrentId,
              slot: chunkGcCurrentReceipt.slot,
            },
          ],
        ]),
        processAlive: (pid) => pid === 704,
        renderJobRoot: chunkGcRenderJobRoot,
        root: chunkGcRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    const chunkGcInventory = inventoryChunkGarbage();
    const currentPointerCandidate = `final/pointers/${chunkGcCurrentId.slice(7)}`;
    const currentTreeCandidate = `final/tmp/${chunkGcCurrentName}`;
    const chunkGcPointerEntry = chunkGcInventory.entries.find(
      (entry) => entry.candidate.path === currentPointerCandidate,
    );
    const chunkGcTreeEntry = chunkGcInventory.entries.find(
      (entry) => entry.candidate.path === currentTreeCandidate,
    );
    TestValidator.equals(
      "chunk GC inventories exact current/stale/orphan publications and excludes live temp",
      namedFacts([
        [
          "chunkGcInventoryRetainedChunkPaths",
          () =>
            chunkGcInventory.retainedChunkPaths.join() ===
            [currentPointerCandidate, currentTreeCandidate]
              .sort(compareCodeUnits)
              .join(),
        ],
        [
          "chunkGcInventoryEntry",
          () =>
            chunkGcInventory.entries.some(
              (entry) =>
                entry.candidate.path === `final/tmp/${chunkGcOrphanName}`,
            ),
        ],
        [
          "chunkGcInventoryEntry2",
          () =>
            chunkGcInventory.entries.some(
              (entry) =>
                entry.candidate.path ===
                `final/pointers/${chunkGcStaleId.slice(7)}`,
            ),
        ],
        [
          "chunkGcInventoryEntry3",
          () =>
            chunkGcInventory.entries.some(
              (entry) =>
                entry.candidate.path === `final/tmp/${chunkGcStaleName}`,
            ),
        ],
        [
          "chunkGcInventoryEntry4",
          () =>
            chunkGcInventory.entries.some((entry) =>
              entry.candidate.path.endsWith(chunkGcLiveName),
            ) === false,
        ],
        [
          "chunkGcPointerEntrySnapshot",
          () => chunkGcPointerEntry?.snapshot.base.path === chunkGcRoot,
        ],
        [
          "chunkGcTreeEntrySnapshot",
          () => chunkGcTreeEntry?.snapshot.base.path === chunkGcRenderJobRoot,
        ],
      ]),
      {
        chunkGcInventoryRetainedChunkPaths: true,
        chunkGcInventoryEntry: true,
        chunkGcInventoryEntry2: true,
        chunkGcInventoryEntry3: true,
        chunkGcInventoryEntry4: true,
        chunkGcPointerEntrySnapshot: true,
        chunkGcTreeEntrySnapshot: true,
      },
    );
    const chunkGcCurrentPayload = path.join(chunkGcCurrentTree, "chunk.mp4");
    const changedChunkGcPayload = Buffer.from(chunkVideoBytes);
    changedChunkGcPayload[changedChunkGcPayload.length - 1] ^= 1;
    let chunkGcPayloadMutated = false;
    mutableFs.readdirSync = ((directory, ...args: unknown[]): unknown => {
      if (
        chunkGcPayloadMutated === false &&
        path.resolve(directory.toString()) === chunkGcTemporaryRoot
      ) {
        fs.writeFileSync(chunkGcCurrentPayload, changedChunkGcPayload);
        chunkGcPayloadMutated = true;
      }
      return Reflect.apply(nativeReaddir, mutableFs, [directory, ...args]);
    }) as typeof fs.readdirSync;
    let mutatedChunkGcInventory: ReturnType<
      typeof inventoryChunkGarbage
    > | null = null;
    let chunkGcInventoryCleanupFailure: { error: unknown } | undefined;
    try {
      mutatedChunkGcInventory = inventoryChunkGarbage();
    } catch (error) {
      chunkGcInventoryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(chunkGcInventoryCleanupFailure, [
        {
          resource: "chunk GC inventory readdir hook",
          cleanup: () => {
            mutableFs.readdirSync = nativeReaddir;
          },
        },
        {
          resource: "chunk GC current payload",
          cleanup: () => {
            fs.writeFileSync(chunkGcCurrentPayload, chunkVideoBytes);
          },
        },
      ]);
    }
    TestValidator.equals(
      "chunk GC refuses same-inode tree content changed after pointer authentication",
      namedFacts([
        ["chunkGcPayloadMutated", () => chunkGcPayloadMutated],
        ["mutatedChunkGcInventory", () => mutatedChunkGcInventory !== null],
        [
          "mutatedChunkGcInventoryCount",
          () =>
            mutatedChunkGcInventory !== null &&
            mutatedChunkGcInventory.retainedChunkPaths.length === 0,
        ],
      ]),
      {
        chunkGcPayloadMutated: true,
        mutatedChunkGcInventory: true,
        mutatedChunkGcInventoryCount: true,
      },
    );

    const pointerRaceId = fixtureDigest(Buffer.from("pointer successor chunk"));
    const pointerRaceSource = path.join(
      chunkPublicationRoot,
      "pointer-race-source",
    );
    const pointerRaceReceipt = populateChunkSource(
      pointerRaceSource,
      pointerRaceId,
    );
    const pointerRacePointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: pointerRaceId,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "proxy",
      });
    const pointerRacePublished =
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: pointerRaceId,
        receipt: pointerRaceReceipt,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "proxy",
        tree: captureChunkTree(chunkPublicationRoot, pointerRaceSource),
      });
    const pointerSuccessorBytes = fs.readFileSync(pointerRacePointer);
    const parkedPointer = `${pointerRacePointer}.parked`;
    fs.renameSync(pointerRacePointer, parkedPointer);
    fs.writeFileSync(pointerRacePointer, pointerSuccessorBytes);
    const capturedPointerRemovalRejected = throws(() =>
      renderChunkSnapshotModule.removeCapturedRenderChunkPointer(
        pointerRacePublished.publication.pointer,
      ),
    );
    const pointerSuccessorRejected = throws(() =>
      renderChunkSnapshotModule.publishRenderChunkSnapshot({
        chunk: pointerRaceId,
        receipt: pointerRaceReceipt,
        root: chunkPublicationRoot,
        scope: chunkPublicationScope,
        tier: "proxy",
        tree: captureChunkTree(chunkPublicationRoot, pointerRaceSource),
      }),
    );
    TestValidator.equals(
      "O_EXCL pointer publication preserves a reappearing successor",
      namedFacts([
        [
          "capturedPointerRemovalRejected",
          () => capturedPointerRemovalRejected,
        ],
        ["pointerSuccessorRejected", () => pointerSuccessorRejected],
        ["parkedPointerResident", () => fs.existsSync(parkedPointer)],
        [
          "pointerRacePointerPointerSuccessorBytes",
          () =>
            fs.readFileSync(pointerRacePointer).equals(pointerSuccessorBytes),
        ],
      ]),
      {
        capturedPointerRemovalRejected: true,
        pointerSuccessorRejected: true,
        parkedPointerResident: true,
        pointerRacePointerPointerSuccessorBytes: true,
      },
    );

    const rootSwapParent = path.join(base, "chunk-root-swap");
    const rootSwapRoot = path.join(rootSwapParent, "root");
    const rootSwapParked = path.join(rootSwapParent, "root-original");
    const rootSwapSource = path.join(rootSwapRoot, "source");
    const rootSwapId = fixtureDigest(Buffer.from("root swap chunk"));
    fs.mkdirSync(rootSwapRoot, { recursive: true });
    const rootSwapReceipt = populateChunkSource(rootSwapSource, rootSwapId);
    const rootSwapPointer =
      renderChunkSnapshotModule.renderChunkPublicationPath({
        chunk: rootSwapId,
        root: rootSwapRoot,
        scope: chunkPublicationScope,
        tier: "final",
      });
    let publicationRootSwapped = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        publicationRootSwapped === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === rootSwapPointer &&
        flags === "wx+"
      ) {
        nativeLivenessRename(rootSwapRoot, rootSwapParked);
        nativeMkdir(rootSwapRoot);
        publicationRootSwapped = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let publicationRootSwapRejected = false;
    let publicationRootSwapCleanupFailure: { error: unknown } | undefined;
    try {
      publicationRootSwapRejected = throws(() =>
        renderChunkSnapshotModule.publishRenderChunkSnapshot({
          chunk: rootSwapId,
          receipt: rootSwapReceipt,
          root: rootSwapRoot,
          scope: chunkPublicationScope,
          tier: "final",
          tree: captureChunkTree(rootSwapRoot, rootSwapSource),
        }),
      );
    } catch (error) {
      publicationRootSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(publicationRootSwapCleanupFailure, [
        {
          resource: "render chunk root swap open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "chunk pointer publication fails closed across a physical root swap",
      namedFacts([
        ["publicationRootSwapped", () => publicationRootSwapped],
        ["publicationRootSwapRejected", () => publicationRootSwapRejected],
        [
          "rootSwapParkedSource",
          () =>
            fs
              .readFileSync(path.join(rootSwapParked, "source", "chunk.mp4"))
              .equals(chunkVideoBytes),
        ],
        [
          "rootSwapParkedSource2",
          () =>
            fs
              .readFileSync(
                path.join(
                  rootSwapParked,
                  "source",
                  "frames",
                  "frame_00000000.png",
                ),
              )
              .equals(chunkFrameBytes),
        ],
      ]),
      {
        publicationRootSwapped: true,
        publicationRootSwapRejected: true,
        rootSwapParkedSource: true,
        rootSwapParkedSource2: true,
      },
    );
    fs.rmSync(rootSwapParent, { recursive: true });
    fs.rmSync(chunkPublicationRoot, { recursive: true });
    const gcBase = path.join(base, "render-gc");
    const gcTarget = path.join(gcBase, "stale-chunk");
    const gcFile = path.join(gcTarget, "chunk.bin");
    const gcQuarantine = path.join(gcBase, ".gc-preserved-fixture");
    const gcBytes = Buffer.from("stale chunk bytes");
    const writeGcCandidate = (): void => {
      fs.mkdirSync(gcTarget, { recursive: true });
      fs.writeFileSync(gcFile, gcBytes);
    };
    fs.mkdirSync(gcQuarantine, { recursive: true });
    writeGcCandidate();
    const gcSnapshot = renderGcModule.captureRenderGcTarget(gcBase, gcTarget);
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: path.join(gcQuarantine, "normal"),
      quarantine: gcQuarantine,
      snapshot: gcSnapshot,
    });
    TestValidator.equals(
      "render GC removes only one exact inventoried candidate",
      namedFacts([
        ["gcSnapshotCount", () => gcSnapshot.bytes === gcBytes.length],
        ["gcTargetResident", () => fs.existsSync(gcTarget) === false],
        [
          "gcQuarantineResident",
          () => fs.existsSync(path.join(gcQuarantine, "normal")) === false,
        ],
      ]),
      {
        gcSnapshotCount: true,
        gcTargetResident: true,
        gcQuarantineResident: true,
      },
    );
    // A resolved path that leaves the owned root and a target that moved
    // between the pathname stat and the stat of its resolved path are two
    // different conditions. They used to share the escape message, which sent a
    // reader of the second looking for a path that had left its root. Each
    // branch is pinned to the message it now produces.
    const gcResolveTarget = path.join(gcBase, "resolve-candidate.bin");
    const gcResolveOutside = path.join(base, "render-gc-outside");
    fs.mkdirSync(gcResolveOutside, { recursive: true });
    fs.writeFileSync(gcResolveTarget, gcBytes);
    const nativeRealpath = mutableFs.realpathSync;
    let gcResolveMode = "escape";
    mutableFs.realpathSync = Object.assign(
      (target: fs.PathLike, ...args: unknown[]): unknown => {
        const resolved = Reflect.apply(nativeRealpath, mutableFs, [
          target,
          ...args,
        ]) as unknown;
        if (path.resolve(target.toString()) !== gcResolveTarget)
          return resolved;
        // The hook runs between the reader's own lstat and the stat of the
        // resolved path, which is exactly the window each branch describes.
        if (gcResolveMode === "escape") return gcResolveOutside;
        fs.appendFileSync(gcResolveTarget, "raced");
        return resolved;
      },
      // The product reads `realpathSync.native` elsewhere, so the replacement
      // has to carry it rather than shadow the whole export.
      { native: nativeRealpath.native },
    ) as unknown as typeof fs.realpathSync;
    let gcResolveEscape = "pending";
    let gcResolveRace = "pending";
    let gcResolveCleanupFailure: { error: unknown } | undefined;
    try {
      gcResolveEscape = messagesOf(
        captureFailure(() =>
          renderGcModule.captureRenderGcTarget(gcBase, gcResolveTarget),
        ),
      ).join(" | ");
      gcResolveMode = "race";
      gcResolveRace = messagesOf(
        captureFailure(() =>
          renderGcModule.captureRenderGcTarget(gcBase, gcResolveTarget),
        ),
      ).join(" | ");
    } catch (error) {
      gcResolveCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(gcResolveCleanupFailure, [
        {
          resource: "render GC resolve hook",
          cleanup: () => {
            mutableFs.realpathSync = nativeRealpath;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC separates an ownership escape from a mid-resolve race",
      namedFacts([
        [
          "gcResolveEscape",
          () => gcResolveEscape.includes("escapes renderer ownership"),
        ],
        [
          "gcResolveRace",
          () => gcResolveRace.includes("changed while it was resolved"),
        ],
        [
          "gcResolveRaceIsNotEscape",
          () => gcResolveRace.includes("escapes renderer ownership") === false,
        ],
        ["gcResolveTargetResident", () => fs.existsSync(gcResolveTarget)],
      ]),
      {
        gcResolveEscape: true,
        gcResolveRace: true,
        gcResolveRaceIsNotEscape: true,
        gcResolveTargetResident: true,
      },
    );
    fs.rmSync(gcResolveTarget);
    const gcPhysicalRoot = path.join(base, "render-gc-physical-root");
    const gcAliasRoot = path.join(base, "render-gc-alias-root");
    const gcAliasedBase = path.join(gcAliasRoot, "nested");
    const gcAliasedTarget = path.join(gcAliasedBase, "candidate");
    const gcAliasedQuarantine = path.join(gcAliasedBase, ".gc-fixture");
    fs.mkdirSync(path.join(gcPhysicalRoot, "nested", "candidate"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(gcPhysicalRoot, "nested", ".gc-fixture"));
    fs.symlinkSync(
      gcPhysicalRoot,
      gcAliasRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.writeFileSync(path.join(gcAliasedTarget, "chunk.bin"), gcBytes);
    const gcAliasedSnapshot = renderGcModule.captureRenderGcTarget(
      gcAliasedBase,
      gcAliasedTarget,
    );
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: path.join(gcAliasedQuarantine, "candidate"),
      quarantine: gcAliasedQuarantine,
      snapshot: gcAliasedSnapshot,
    });
    TestValidator.predicate(
      "render GC accepts a physical base reached through an alias ancestor",
      fs.existsSync(gcAliasedTarget) === false,
    );
    writeGcCandidate();
    const preRenameSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcTarget,
    );
    const parkedPreRenameGc = path.join(gcBase, "pre-rename-original");
    fs.renameSync(gcTarget, parkedPreRenameGc);
    writeGcCandidate();
    const preRenameGcRejected = throws(() =>
      renderGcModule.removeCapturedRenderGcTarget({
        isolated: path.join(gcQuarantine, "pre-rename"),
        quarantine: gcQuarantine,
        snapshot: preRenameSnapshot,
      }),
    );
    TestValidator.equals(
      "render GC refuses a successor installed before quarantine",
      namedFacts([
        ["preRenameGcRejected", () => preRenameGcRejected],
        ["gcTargetResident", () => fs.existsSync(gcTarget)],
        ["parkedPreRenameGcResident", () => fs.existsSync(parkedPreRenameGc)],
      ]),
      {
        preRenameGcRejected: true,
        gcTargetResident: true,
        parkedPreRenameGcResident: true,
      },
    );
    fs.rmSync(gcTarget, { recursive: true, force: true });
    fs.rmSync(parkedPreRenameGc, { recursive: true, force: true });
    writeGcCandidate();
    const renameBoundarySnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcTarget,
    );
    const parkedRenameBoundaryGc = path.join(gcBase, "rename-original");
    const renameBoundaryIsolated = path.join(gcQuarantine, "rename-boundary");
    const nativeGcRename = mutableFs.renameSync;
    let gcRenameBoundarySwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        gcRenameBoundarySwapped === false &&
        path.resolve(oldPath.toString()) === gcTarget &&
        path.resolve(newPath.toString()) === renameBoundaryIsolated
      ) {
        nativeGcRename(gcTarget, parkedRenameBoundaryGc);
        writeGcCandidate();
        gcRenameBoundarySwapped = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let gcRenameBoundaryRejected = false;
    let gcRenameBoundaryCleanupFailure: { error: unknown } | undefined;
    try {
      gcRenameBoundaryRejected = throws(() =>
        renderGcModule.removeCapturedRenderGcTarget({
          isolated: renameBoundaryIsolated,
          quarantine: gcQuarantine,
          snapshot: renameBoundarySnapshot,
        }),
      );
    } catch (error) {
      gcRenameBoundaryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(gcRenameBoundaryCleanupFailure, [
        {
          resource: "render GC target rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeGcRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC preserves a successor crossing rename outside later plans",
      namedFacts([
        ["gcRenameBoundarySwapped", () => gcRenameBoundarySwapped],
        ["gcRenameBoundaryRejected", () => gcRenameBoundaryRejected],
        ["gcTargetResident", () => fs.existsSync(gcTarget) === false],
        [
          "parkedRenameBoundaryGcResident",
          () => fs.existsSync(parkedRenameBoundaryGc),
        ],
        [
          "renameBoundaryIsolatedChunk",
          () =>
            fs
              .readFileSync(path.join(renameBoundaryIsolated, "chunk.bin"))
              .equals(gcBytes),
        ],
        [
          "renderGcModuleIsRenderGcPreservedPath",
          () =>
            renderGcModule.isRenderGcPreservedPath(
              path.relative(gcBase, renameBoundaryIsolated),
            ),
        ],
        [
          "renderGcModuleIsRenderGcPreservedPath2",
          () =>
            renderGcModule.isRenderGcPreservedPath(
              "deliverables/.gc-preserved-fixture/file",
            ) === false,
        ],
        [
          "renderGcModuleIsRenderGcPreservedPath3",
          () =>
            renderGcModule.isRenderGcPreservedPath(".gc-preserved/file") ===
            false,
        ],
        [
          "renderGcModuleIsRenderGcPreservedPath4",
          () =>
            renderGcModule.isRenderGcPreservedPath("ordinary/file") === false,
        ],
      ]),
      {
        gcRenameBoundarySwapped: true,
        gcRenameBoundaryRejected: true,
        gcTargetResident: true,
        parkedRenameBoundaryGcResident: true,
        renameBoundaryIsolatedChunk: true,
        renderGcModuleIsRenderGcPreservedPath: true,
        renderGcModuleIsRenderGcPreservedPath2: true,
        renderGcModuleIsRenderGcPreservedPath3: true,
        renderGcModuleIsRenderGcPreservedPath4: true,
      },
    );
    fs.rmSync(renameBoundaryIsolated, { recursive: true, force: true });
    fs.rmSync(parkedRenameBoundaryGc, { recursive: true, force: true });
    const sharedRemovalStaging = renderGcModule.ensureRenderPhysicalDirectory(
      gcBase,
      renderGcModule.RENDER_GC_REMOVAL_STAGING_DIRECTORY,
    );
    const sharedRemovalFirst = path.join(gcBase, "shared-removal-first");
    const sharedRemovalSecond = path.join(gcBase, "shared-removal-second");
    const sharedRemovalSibling = path.join(
      sharedRemovalStaging,
      "foreign-sibling",
    );
    fs.writeFileSync(sharedRemovalFirst, "first removal");
    fs.writeFileSync(sharedRemovalSecond, "second removal");
    const sharedRemovalFirstSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      sharedRemovalFirst,
    );
    const sharedRemovalSecondSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      sharedRemovalSecond,
    );
    let sharedRemovalSiblingInserted = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        sharedRemovalSiblingInserted === false &&
        path.resolve(oldPath.toString()) === sharedRemovalFirst
      ) {
        nativeWriteFile(sharedRemovalSibling, "foreign sibling");
        sharedRemovalSiblingInserted = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let sharedRemovalCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.removeCapturedRenderGcTarget({
        isolated: path.join(sharedRemovalStaging, "first"),
        quarantine: sharedRemovalStaging,
        snapshot: sharedRemovalFirstSnapshot,
      });
      renderGcModule.removeCapturedRenderGcTarget({
        isolated: path.join(sharedRemovalStaging, "second"),
        quarantine: sharedRemovalStaging,
        snapshot: sharedRemovalSecondSnapshot,
      });
    } catch (error) {
      sharedRemovalCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(sharedRemovalCleanupFailure, [
        {
          resource: "render GC shared removal rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeGcRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render removals share one retained staging parent across sibling mutation",
      namedFacts([
        ["sharedRemovalSiblingInserted", () => sharedRemovalSiblingInserted],
        [
          "sharedRemovalFirstResident",
          () => fs.existsSync(sharedRemovalFirst) === false,
        ],
        [
          "sharedRemovalSecondResident",
          () => fs.existsSync(sharedRemovalSecond) === false,
        ],
        [
          "sharedRemovalStagingResident",
          () => fs.existsSync(sharedRemovalStaging),
        ],
        [
          "sharedRemovalStagingForeign",
          () =>
            fs.readdirSync(sharedRemovalStaging).join(",") ===
            "foreign-sibling",
        ],
      ]),
      {
        sharedRemovalSiblingInserted: true,
        sharedRemovalFirstResident: true,
        sharedRemovalSecondResident: true,
        sharedRemovalStagingResident: true,
        sharedRemovalStagingForeign: true,
      },
    );
    fs.rmSync(sharedRemovalSibling);
    const gcPublicationFile = path.join(gcBase, "stale-publication.mp4");
    const gcPublicationBytes = Buffer.from("stale publication bytes");
    fs.writeFileSync(gcPublicationFile, gcPublicationBytes);
    const gcPublicationSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcPublicationFile,
    );
    const gcPublicationNormalIsolated = path.join(
      gcQuarantine,
      "normal-publication",
    );
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: gcPublicationNormalIsolated,
      quarantine: gcQuarantine,
      snapshot: gcPublicationSnapshot,
    });
    TestValidator.equals(
      "render GC removes one exact inventoried publication file",
      namedFacts([
        [
          "gcPublicationSnapshotCount",
          () => gcPublicationSnapshot.bytes === gcPublicationBytes.length,
        ],
        [
          "gcPublicationFileResident",
          () => fs.existsSync(gcPublicationFile) === false,
        ],
        [
          "gcPublicationNormalIsolatedResident",
          () => fs.existsSync(gcPublicationNormalIsolated) === false,
        ],
      ]),
      {
        gcPublicationSnapshotCount: true,
        gcPublicationFileResident: true,
        gcPublicationNormalIsolatedResident: true,
      },
    );
    const gcSparsePublication = path.join(gcBase, "large-publication.mp4");
    const gcSparseBytes = 2 * 1024 * 1024 + 17;
    const gcSparseDescriptor = fs.openSync(gcSparsePublication, "wx");
    let gcSparseDescriptorFailure: { error: unknown } | undefined;
    try {
      fs.ftruncateSync(gcSparseDescriptor, gcSparseBytes);
    } catch (error) {
      gcSparseDescriptorFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(gcSparseDescriptorFailure, [
        {
          resource: "render GC sparse publication descriptor",
          cleanup: () => fs.closeSync(gcSparseDescriptor),
        },
      ]);
    }
    const gcSparseSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcSparsePublication,
    );
    renderGcModule.removeCapturedRenderGcTarget({
      isolated: path.join(gcQuarantine, "large-publication"),
      quarantine: gcQuarantine,
      snapshot: gcSparseSnapshot,
    });
    TestValidator.equals(
      "render GC streams a multi-chunk publication without resident bytes",
      namedFacts([
        ["bytes", () => gcSparseSnapshot.bytes === gcSparseBytes],
        ["notResident", () => fs.existsSync(gcSparsePublication) === false],
      ]),
      { bytes: true, notResident: true },
    );
    fs.writeFileSync(gcPublicationFile, gcPublicationBytes);
    const gcPublicationBoundarySnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      gcPublicationFile,
    );
    const parkedGcPublication = path.join(gcBase, "publication-original.mp4");
    const gcPublicationBoundaryIsolated = path.join(
      gcQuarantine,
      "publication-boundary",
    );
    let gcPublicationBoundarySwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        gcPublicationBoundarySwapped === false &&
        path.resolve(oldPath.toString()) === gcPublicationFile &&
        path.resolve(newPath.toString()) === gcPublicationBoundaryIsolated
      ) {
        nativeGcRename(gcPublicationFile, parkedGcPublication);
        fs.writeFileSync(gcPublicationFile, gcPublicationBytes);
        gcPublicationBoundarySwapped = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let gcPublicationBoundaryRejected = false;
    let gcPublicationBoundaryCleanupFailure: { error: unknown } | undefined;
    try {
      gcPublicationBoundaryRejected = throws(() =>
        renderGcModule.removeCapturedRenderGcTarget({
          isolated: gcPublicationBoundaryIsolated,
          quarantine: gcQuarantine,
          snapshot: gcPublicationBoundarySnapshot,
        }),
      );
    } catch (error) {
      gcPublicationBoundaryCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(gcPublicationBoundaryCleanupFailure, [
        {
          resource: "render GC publication rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeGcRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC preserves a publication file successor crossing rename",
      namedFacts([
        ["gcPublicationBoundarySwapped", () => gcPublicationBoundarySwapped],
        ["gcPublicationBoundaryRejected", () => gcPublicationBoundaryRejected],
        [
          "gcPublicationFileResident",
          () => fs.existsSync(gcPublicationFile) === false,
        ],
        [
          "parkedGcPublicationGcPublicationBytes",
          () => fs.readFileSync(parkedGcPublication).equals(gcPublicationBytes),
        ],
        [
          "gcPublicationBoundaryIsolatedGcPublicationBytes",
          () =>
            fs
              .readFileSync(gcPublicationBoundaryIsolated)
              .equals(gcPublicationBytes),
        ],
        [
          "renderGcModuleIsRenderGcPreservedPath",
          () =>
            renderGcModule.isRenderGcPreservedPath(
              path.relative(gcBase, gcPublicationBoundaryIsolated),
            ),
        ],
      ]),
      {
        gcPublicationBoundarySwapped: true,
        gcPublicationBoundaryRejected: true,
        gcPublicationFileResident: true,
        parkedGcPublicationGcPublicationBytes: true,
        gcPublicationBoundaryIsolatedGcPublicationBytes: true,
        renderGcModuleIsRenderGcPreservedPath: true,
      },
    );
    fs.rmSync(gcPublicationBoundaryIsolated, { force: true });
    fs.rmSync(parkedGcPublication, { force: true });
    const workerQuarantine = renderGcModule.ensureRenderPhysicalDirectory(
      gcBase,
      "quarantine",
    );
    const workerPreserved = renderGcModule.ensureRenderPhysicalDirectory(
      gcBase,
      ".gc-preserved-worker-fixture",
    );
    const workerClaim = path.join(gcBase, "worker-claim.lock");
    const workerClaimBytes = Buffer.from("exact worker claim");
    fs.writeFileSync(workerClaim, workerClaimBytes);
    const workerClaimSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerClaim,
    );
    const workerClaimIsolated = path.join(workerPreserved, "claim");
    const workerClaimDestination = path.join(
      workerQuarantine,
      "worker-claim.released",
    );
    renderGcModule.quarantineCapturedRenderTarget({
      destination: workerClaimDestination,
      isolated: workerClaimIsolated,
      quarantine: workerPreserved,
      snapshot: workerClaimSnapshot,
    });
    const workerClaimMarker = JSON.parse(
      fs.readFileSync(workerClaimDestination, "utf8"),
    ) as {
      contentFingerprint: string;
      kind: string;
      original: string;
      preserved: string;
      targetIdentity: string;
      version: number;
    };
    const workerClaimMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerClaimDestination,
    );
    const workerClaimEvidence = renderGcModule.inspectRenderQuarantineMarker(
      workerClaimMarkerSnapshot,
    );
    TestValidator.equals(
      "routine worker cleanup publishes one immutable evidence marker",
      namedFacts([
        ["workerClaimResident", () => fs.existsSync(workerClaim) === false],
        [
          "workerClaimIsolatedWorkerClaimBytes",
          () => fs.readFileSync(workerClaimIsolated).equals(workerClaimBytes),
        ],
        ["workerClaimMarkerVersion", () => workerClaimMarker.version === 1],
        ["workerClaimMarkerFile", () => workerClaimMarker.kind === "file"],
        [
          "workerClaimMarkerOriginal",
          () => workerClaimMarker.original === "worker-claim.lock",
        ],
        [
          "workerClaimMarkerPreserved",
          () =>
            workerClaimMarker.preserved ===
            ".gc-preserved-worker-fixture/claim",
        ],
        [
          "workerClaimMarkerTargetIdentity",
          () =>
            workerClaimMarker.targetIdentity ===
            workerClaimSnapshot.targetIdentity,
        ],
        [
          "workerClaimMarkerContentFingerprint",
          () =>
            workerClaimMarker.contentFingerprint ===
            workerClaimSnapshot.contentFingerprint,
        ],
        [
          "workerClaimEvidenceEvidence",
          () => workerClaimEvidence.evidence.target === workerClaimIsolated,
        ],
        [
          "workerClaimEvidenceEvidence2",
          () =>
            workerClaimEvidence.evidence.targetIdentity ===
            workerClaimSnapshot.targetIdentity,
        ],
        [
          "workerClaimEvidenceEvidence3",
          () =>
            workerClaimEvidence.evidence.contentFingerprint ===
            workerClaimSnapshot.contentFingerprint,
        ],
      ]),
      {
        workerClaimResident: true,
        workerClaimIsolatedWorkerClaimBytes: true,
        workerClaimMarkerVersion: true,
        workerClaimMarkerFile: true,
        workerClaimMarkerOriginal: true,
        workerClaimMarkerPreserved: true,
        workerClaimMarkerTargetIdentity: true,
        workerClaimMarkerContentFingerprint: true,
        workerClaimEvidenceEvidence: true,
        workerClaimEvidenceEvidence2: true,
        workerClaimEvidenceEvidence3: true,
      },
    );

    const tierGcRoot = path.join(gcBase, "tier-gc-root");
    const proxyTierGcRoot = path.join(tierGcRoot, "proxy");
    const finalTierGcRoot = path.join(tierGcRoot, "final");
    fs.mkdirSync(proxyTierGcRoot, { recursive: true });
    fs.mkdirSync(finalTierGcRoot);
    const proxyTierQuarantine = renderGcModule.ensureRenderPhysicalDirectory(
      proxyTierGcRoot,
      "quarantine",
    );
    const proxyTierPreserved = renderGcModule.ensureRenderPhysicalDirectory(
      proxyTierGcRoot,
      ".gc-preserved-tier-fixture",
    );
    const proxyTierClaim = path.join(proxyTierGcRoot, "tier-claim.lock");
    const proxyTierEvidence = path.join(proxyTierPreserved, "evidence");
    const proxyTierMarker = path.join(
      proxyTierQuarantine,
      "tier-claim.released",
    );
    fs.writeFileSync(proxyTierClaim, workerClaimBytes);
    renderGcModule.quarantineCapturedRenderTarget({
      destination: proxyTierMarker,
      isolated: proxyTierEvidence,
      quarantine: proxyTierPreserved,
      snapshot: renderGcModule.captureRenderGcTarget(
        proxyTierGcRoot,
        proxyTierClaim,
      ),
    });
    const proxyTierMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      proxyTierGcRoot,
      proxyTierMarker,
    );
    const proxyTierInspection = renderGcModule.inspectRenderQuarantineMarker(
      proxyTierMarkerSnapshot,
    );
    const wrongTierBaseRejected = throws(() =>
      renderGcModule.inspectRenderQuarantineMarker(
        renderGcModule.captureRenderGcTarget(tierGcRoot, proxyTierMarker),
      ),
    );
    const reorderedTierMarker = path.join(
      proxyTierQuarantine,
      "tier-claim.reordered",
    );
    fs.writeFileSync(
      reorderedTierMarker,
      `${JSON.stringify(
        {
          targetIdentity: proxyTierInspection.marker.targetIdentity,
          preserved: proxyTierInspection.marker.preserved,
          original: proxyTierInspection.marker.original,
          kind: proxyTierInspection.marker.kind,
          contentFingerprint: proxyTierInspection.marker.contentFingerprint,
          version: proxyTierInspection.marker.version,
        },
        null,
        2,
      )}\n`,
    );
    const reorderedTierMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      proxyTierGcRoot,
      reorderedTierMarker,
    );
    const reorderedTierMarkerRejected = throws(() =>
      renderGcModule.inspectRenderQuarantineMarker(reorderedTierMarkerSnapshot),
    );
    const finalTierQuarantine = renderGcModule.ensureRenderPhysicalDirectory(
      finalTierGcRoot,
      "quarantine",
    );
    const finalTierPreserved = renderGcModule.ensureRenderPhysicalDirectory(
      finalTierGcRoot,
      ".gc-preserved-tier-fixture",
    );
    const finalTierEvidence = path.join(finalTierPreserved, "evidence");
    const finalTierMarker = path.join(
      finalTierQuarantine,
      "tier-claim.released",
    );
    nativeLink(proxyTierEvidence, finalTierEvidence);
    fs.writeFileSync(
      finalTierMarker,
      `${JSON.stringify(
        {
          version: 1,
          contentFingerprint: proxyTierInspection.marker.contentFingerprint,
          kind: proxyTierInspection.marker.kind,
          original: "cross-tier-claim.lock",
          preserved: ".gc-preserved-tier-fixture/evidence",
          targetIdentity: proxyTierInspection.marker.targetIdentity,
        },
        null,
        2,
      )}\n`,
    );
    const finalTierMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      finalTierGcRoot,
      finalTierMarker,
    );
    const duplicateTierInventory =
      renderGcModule.inventoryRenderQuarantineCandidates([
        proxyTierMarkerSnapshot,
        finalTierMarkerSnapshot,
      ]);
    fs.rmSync(finalTierMarker);
    fs.rmSync(finalTierEvidence);
    fs.rmdirSync(finalTierPreserved);
    fs.rmdirSync(finalTierQuarantine);
    const legacyTierMarker = path.join(
      proxyTierQuarantine,
      "legacy-quarantine-entry",
    );
    fs.writeFileSync(legacyTierMarker, "legacy quarantine bytes");
    const legacyTierMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      proxyTierGcRoot,
      legacyTierMarker,
    );
    const tierInventory = renderGcModule.inventoryRenderQuarantineCandidates([
      renderGcModule.captureRenderGcTarget(proxyTierGcRoot, proxyTierMarker),
      legacyTierMarkerSnapshot,
    ]);
    const tierPair = tierInventory.find(
      (entry) => entry.marker.target === proxyTierMarker,
    );
    const tierLegacy = tierInventory.find(
      (entry) => entry.marker.target === legacyTierMarker,
    );
    const tierApplyQuarantine = renderGcModule.ensureRenderPhysicalDirectory(
      proxyTierGcRoot,
      ".gc-preserved-apply-fixture",
    );
    let tierEvidenceGoneBeforeMarker = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (path.resolve(oldPath.toString()) === proxyTierMarker)
        tierEvidenceGoneBeforeMarker =
          fs.existsSync(proxyTierEvidence) === false;
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let tierApplyCleanupFailure: { error: unknown } | undefined;
    try {
      if (tierPair?.evidence !== null && tierPair?.evidence !== undefined)
        renderGcModule.removeCapturedRenderQuarantine({
          evidence: tierPair.evidence,
          marker: tierPair.marker,
          quarantine: tierApplyQuarantine,
        });
    } catch (error) {
      tierApplyCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(tierApplyCleanupFailure, [
        {
          resource: "render GC tier apply rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeGcRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC binds tier-relative evidence, omits cross-tier duplicates, and reclaims the exact pair",
      namedFacts([
        ["wrongTierBaseRejected", () => wrongTierBaseRejected],
        ["reorderedTierMarkerRejected", () => reorderedTierMarkerRejected],
        [
          "duplicateTierInventoryCount",
          () => duplicateTierInventory.length === 0,
        ],
        ["tierInventoryCount", () => tierInventory.length === 2],
        ["tierPair", () => tierPair !== undefined],
        [
          "tierPairEvidence",
          () => tierPair !== undefined && tierPair.evidence !== null,
        ],
        [
          "tierPairBytes",
          () =>
            tierPair !== undefined &&
            tierPair.evidence !== null &&
            tierPair.bytes === tierPair.marker.bytes + tierPair.evidence.bytes,
        ],
        ["tierLegacyEvidence", () => tierLegacy?.evidence === null],
        [
          "tierLegacyBytes",
          () =>
            tierLegacy !== undefined &&
            tierLegacy.bytes === legacyTierMarkerSnapshot.bytes,
        ],
        ["tierEvidenceGoneBeforeMarker", () => tierEvidenceGoneBeforeMarker],
        [
          "proxyTierEvidenceResident",
          () => fs.existsSync(proxyTierEvidence) === false,
        ],
        [
          "proxyTierMarkerResident",
          () => fs.existsSync(proxyTierMarker) === false,
        ],
        [
          "proxyTierPreservedResident",
          () => fs.existsSync(proxyTierPreserved) === false,
        ],
        ["legacyTierMarkerResident", () => fs.existsSync(legacyTierMarker)],
      ]),
      {
        wrongTierBaseRejected: true,
        reorderedTierMarkerRejected: true,
        duplicateTierInventoryCount: true,
        tierInventoryCount: true,
        tierPair: true,
        tierPairEvidence: true,
        tierPairBytes: true,
        tierLegacyEvidence: true,
        tierLegacyBytes: true,
        tierEvidenceGoneBeforeMarker: true,
        proxyTierEvidenceResident: true,
        proxyTierMarkerResident: true,
        proxyTierPreservedResident: true,
        legacyTierMarkerResident: true,
      },
    );
    const stableEvidenceParent = renderGcModule.ensureRenderPhysicalDirectory(
      proxyTierGcRoot,
      renderGcModule.RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY,
    );
    const stableEvidenceSource = path.join(
      proxyTierGcRoot,
      "stable-evidence.lock",
    );
    const stableEvidenceTarget = path.join(stableEvidenceParent, "evidence");
    const stableEvidenceMarker = path.join(
      proxyTierQuarantine,
      "stable-evidence.released",
    );
    const stableEvidenceSiblingMarker = path.join(
      proxyTierQuarantine,
      "concurrent-sibling.released",
    );
    fs.writeFileSync(stableEvidenceSource, workerClaimBytes);
    let stableEvidenceSiblingInserted = false;
    mutableFs.statSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeStat, mutableFs, [
        file,
        ...args,
      ]) as unknown;
      if (
        stableEvidenceSiblingInserted === false &&
        path.resolve(file.toString()) === proxyTierQuarantine
      ) {
        nativeWriteFile(stableEvidenceSiblingMarker, "concurrent sibling");
        stableEvidenceSiblingInserted = true;
      }
      return status;
    }) as typeof fs.statSync;
    let stableEvidenceCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.quarantineCapturedRenderTarget({
        destination: stableEvidenceMarker,
        isolated: stableEvidenceTarget,
        quarantine: stableEvidenceParent,
        snapshot: renderGcModule.captureRenderGcTarget(
          proxyTierGcRoot,
          stableEvidenceSource,
        ),
      });
    } catch (error) {
      stableEvidenceCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(stableEvidenceCleanupFailure, [
        {
          resource: "render GC stable evidence stat hook",
          cleanup: () => {
            mutableFs.statSync = nativeStat;
          },
        },
      ]);
    }
    const stableEvidenceMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      proxyTierGcRoot,
      stableEvidenceMarker,
    );
    const stableEvidenceInspection =
      renderGcModule.inspectRenderQuarantineMarker(
        stableEvidenceMarkerSnapshot,
      );
    renderGcModule.removeCapturedRenderQuarantine({
      evidence: stableEvidenceInspection.evidence,
      marker: stableEvidenceMarkerSnapshot,
      quarantine: tierApplyQuarantine,
    });
    TestValidator.equals(
      "render GC retains one stable quarantine-evidence parent after pair removal",
      namedFacts([
        ["stableEvidenceSiblingInserted", () => stableEvidenceSiblingInserted],
        [
          "stableEvidenceTargetResident",
          () => fs.existsSync(stableEvidenceTarget) === false,
        ],
        [
          "stableEvidenceMarkerResident",
          () => fs.existsSync(stableEvidenceMarker) === false,
        ],
        [
          "stableEvidenceSiblingMarkerUtf8",
          () =>
            fs.readFileSync(stableEvidenceSiblingMarker, "utf8") ===
            "concurrent sibling",
        ],
        [
          "stableEvidenceParentResident",
          () => fs.existsSync(stableEvidenceParent),
        ],
        [
          "stableEvidenceParentCount",
          () => fs.readdirSync(stableEvidenceParent).length === 0,
        ],
      ]),
      {
        stableEvidenceSiblingInserted: true,
        stableEvidenceTargetResident: true,
        stableEvidenceMarkerResident: true,
        stableEvidenceSiblingMarkerUtf8: true,
        stableEvidenceParentResident: true,
        stableEvidenceParentCount: true,
      },
    );
    const parentSuccessorSource = path.join(
      proxyTierGcRoot,
      "parent-successor.lock",
    );
    const parentSuccessorPreserved =
      renderGcModule.ensureRenderPhysicalDirectory(
        proxyTierGcRoot,
        ".gc-preserved-parent-successor",
      );
    const parentSuccessorEvidence = path.join(
      parentSuccessorPreserved,
      "evidence",
    );
    const parentSuccessorMarker = path.join(
      proxyTierQuarantine,
      "parent-successor.released",
    );
    fs.writeFileSync(parentSuccessorSource, workerClaimBytes);
    renderGcModule.quarantineCapturedRenderTarget({
      destination: parentSuccessorMarker,
      isolated: parentSuccessorEvidence,
      quarantine: parentSuccessorPreserved,
      snapshot: renderGcModule.captureRenderGcTarget(
        proxyTierGcRoot,
        parentSuccessorSource,
      ),
    });
    const parentSuccessorMarkerSnapshot = renderGcModule.captureRenderGcTarget(
      proxyTierGcRoot,
      parentSuccessorMarker,
    );
    const parentSuccessorInspection =
      renderGcModule.inspectRenderQuarantineMarker(
        parentSuccessorMarkerSnapshot,
      );
    const parkedParentSuccessor = `${parentSuccessorPreserved}.parked`;
    let parentSuccessorSwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      nativeGcRename(oldPath, newPath);
      if (
        parentSuccessorSwapped === false &&
        path.resolve(oldPath.toString()) === parentSuccessorMarker
      ) {
        nativeRename(parentSuccessorPreserved, parkedParentSuccessor);
        nativeMkdir(parentSuccessorPreserved);
        parentSuccessorSwapped = true;
      }
    }) as typeof fs.renameSync;
    let parentSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      renderGcModule.removeCapturedRenderQuarantine({
        evidence: parentSuccessorInspection.evidence,
        marker: parentSuccessorMarkerSnapshot,
        quarantine: tierApplyQuarantine,
      });
    } catch (error) {
      parentSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(parentSuccessorCleanupFailure, [
        {
          resource: "render GC parent successor rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeGcRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "render GC preserves an empty private-container pathname successor",
      namedFacts([
        ["parentSuccessorSwapped", () => parentSuccessorSwapped],
        [
          "parentSuccessorEvidenceResident",
          () => fs.existsSync(parentSuccessorEvidence) === false,
        ],
        [
          "parentSuccessorMarkerResident",
          () => fs.existsSync(parentSuccessorMarker) === false,
        ],
        [
          "parentSuccessorPreservedResident",
          () => fs.existsSync(parentSuccessorPreserved),
        ],
        [
          "parkedParentSuccessorResident",
          () => fs.existsSync(parkedParentSuccessor),
        ],
      ]),
      {
        parentSuccessorSwapped: true,
        parentSuccessorEvidenceResident: true,
        parentSuccessorMarkerResident: true,
        parentSuccessorPreservedResident: true,
        parkedParentSuccessorResident: true,
      },
    );
    fs.rmdirSync(parentSuccessorPreserved);
    fs.rmdirSync(parkedParentSuccessor);
    fs.rmdirSync(stableEvidenceParent);
    fs.rmSync(stableEvidenceSiblingMarker);
    fs.rmSync(reorderedTierMarker);
    fs.rmSync(legacyTierMarker);
    fs.rmdirSync(tierApplyQuarantine);
    fs.rmdirSync(proxyTierQuarantine);
    fs.rmdirSync(proxyTierGcRoot);
    fs.rmdirSync(finalTierGcRoot);
    fs.rmdirSync(tierGcRoot);

    const workerDirectory = path.join(gcBase, "worker-directory");
    const workerDirectoryFile = path.join(workerDirectory, "frame.bin");
    const workerDirectoryIsolated = path.join(workerPreserved, "directory");
    const workerDirectoryDestination = path.join(
      workerQuarantine,
      "worker-directory.abandoned",
    );
    fs.mkdirSync(workerDirectory);
    fs.writeFileSync(workerDirectoryFile, gcBytes);
    renderGcModule.quarantineCapturedRenderTarget({
      destination: workerDirectoryDestination,
      isolated: workerDirectoryIsolated,
      quarantine: workerPreserved,
      snapshot: renderGcModule.captureRenderGcTarget(gcBase, workerDirectory),
    });
    const workerDirectoryMarker = JSON.parse(
      fs.readFileSync(workerDirectoryDestination, "utf8"),
    ) as { kind: string; preserved: string; version: number };
    TestValidator.equals(
      "routine worker cleanup preserves directory evidence behind its marker",
      namedFacts([
        [
          "workerDirectoryIsolatedFrame",
          () =>
            fs
              .readFileSync(path.join(workerDirectoryIsolated, "frame.bin"))
              .equals(gcBytes),
        ],
        [
          "workerDirectoryMarkerVersion",
          () => workerDirectoryMarker.version === 1,
        ],
        [
          "workerDirectoryMarkerDirectory",
          () => workerDirectoryMarker.kind === "directory",
        ],
        [
          "workerDirectoryMarkerPreserved",
          () =>
            workerDirectoryMarker.preserved ===
            ".gc-preserved-worker-fixture/directory",
        ],
      ]),
      {
        workerDirectoryIsolatedFrame: true,
        workerDirectoryMarkerVersion: true,
        workerDirectoryMarkerDirectory: true,
        workerDirectoryMarkerPreserved: true,
      },
    );

    const workerCompetitorClaim = path.join(gcBase, "worker-competitor.lock");
    const workerCompetitorIsolated = path.join(workerPreserved, "competitor");
    const workerCompetitorDestination = path.join(
      workerQuarantine,
      "worker-competitor.released",
    );
    const workerDestinationCompetitorBytes = Buffer.from(
      "foreign quarantine marker",
    );
    fs.writeFileSync(workerCompetitorClaim, workerClaimBytes);
    const workerCompetitorSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerCompetitorClaim,
    );
    let workerDestinationCompetitorInserted = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        workerDestinationCompetitorInserted === false &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === workerCompetitorDestination
      ) {
        nativeWriteFile(
          workerCompetitorDestination,
          workerDestinationCompetitorBytes,
        );
        workerDestinationCompetitorInserted = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let workerDestinationCompetitorRejected = false;
    let workerDestinationCompetitorCleanupFailure:
      | { error: unknown }
      | undefined;
    try {
      workerDestinationCompetitorRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerCompetitorDestination,
          isolated: workerCompetitorIsolated,
          quarantine: workerPreserved,
          snapshot: workerCompetitorSnapshot,
        }),
      );
    } catch (error) {
      workerDestinationCompetitorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(workerDestinationCompetitorCleanupFailure, [
        {
          resource: "render GC worker destination open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "routine worker cleanup preserves a direct destination competitor",
      namedFacts([
        [
          "workerDestinationCompetitorInserted",
          () => workerDestinationCompetitorInserted,
        ],
        [
          "workerDestinationCompetitorRejected",
          () => workerDestinationCompetitorRejected,
        ],
        [
          "workerCompetitorIsolatedWorkerClaimBytes",
          () =>
            fs.readFileSync(workerCompetitorIsolated).equals(workerClaimBytes),
        ],
        [
          "workerCompetitorDestinationWorkerDestinationCompetitorBytes",
          () =>
            fs
              .readFileSync(workerCompetitorDestination)
              .equals(workerDestinationCompetitorBytes),
        ],
      ]),
      {
        workerDestinationCompetitorInserted: true,
        workerDestinationCompetitorRejected: true,
        workerCompetitorIsolatedWorkerClaimBytes: true,
        workerCompetitorDestinationWorkerDestinationCompetitorBytes: true,
      },
    );

    const workerMarkerSwapClaim = path.join(gcBase, "worker-marker-swap.lock");
    const workerMarkerSwapIsolated = path.join(workerPreserved, "marker-swap");
    const workerMarkerSwapDestination = path.join(
      workerQuarantine,
      "worker-marker-swap.released",
    );
    const parkedWorkerMarker = `${workerMarkerSwapDestination}.parked`;
    const workerMarkerSuccessorBytes = Buffer.from(
      "foreign marker pathname successor",
    );
    fs.writeFileSync(workerMarkerSwapClaim, workerClaimBytes);
    const workerMarkerSwapSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerMarkerSwapClaim,
    );
    let workerMarkerDescriptor = -1;
    let workerMarkerSwapped = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === workerMarkerSwapDestination
      )
        workerMarkerDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fsyncSync = ((descriptor: number): void => {
      nativeFsync(descriptor);
      if (
        workerMarkerSwapped === false &&
        descriptor === workerMarkerDescriptor
      ) {
        nativeRename(workerMarkerSwapDestination, parkedWorkerMarker);
        nativeWriteFile(
          workerMarkerSwapDestination,
          workerMarkerSuccessorBytes,
        );
        workerMarkerSwapped = true;
      }
    }) as typeof fs.fsyncSync;
    let workerMarkerSwapRejected = false;
    let workerMarkerSwapCleanupFailure: { error: unknown } | undefined;
    try {
      workerMarkerSwapRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerMarkerSwapDestination,
          isolated: workerMarkerSwapIsolated,
          quarantine: workerPreserved,
          snapshot: workerMarkerSwapSnapshot,
        }),
      );
    } catch (error) {
      workerMarkerSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(workerMarkerSwapCleanupFailure, [
        {
          resource: "render quarantine marker open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render quarantine marker fsync hook",
          cleanup: () => {
            mutableFs.fsyncSync = nativeFsync;
          },
        },
      ]);
    }
    TestValidator.equals(
      "routine worker cleanup preserves a quarantine marker successor",
      namedFacts([
        ["workerMarkerSwapped", () => workerMarkerSwapped],
        ["workerMarkerSwapRejected", () => workerMarkerSwapRejected],
        [
          "workerMarkerSwapIsolatedWorkerClaimBytes",
          () =>
            fs.readFileSync(workerMarkerSwapIsolated).equals(workerClaimBytes),
        ],
        ["parkedWorkerMarkerResident", () => fs.existsSync(parkedWorkerMarker)],
        [
          "workerMarkerSwapDestinationWorkerMarkerSuccessorBytes",
          () =>
            fs
              .readFileSync(workerMarkerSwapDestination)
              .equals(workerMarkerSuccessorBytes),
        ],
      ]),
      {
        workerMarkerSwapped: true,
        workerMarkerSwapRejected: true,
        workerMarkerSwapIsolatedWorkerClaimBytes: true,
        parkedWorkerMarkerResident: true,
        workerMarkerSwapDestinationWorkerMarkerSuccessorBytes: true,
      },
    );

    const workerEvidenceSwapClaim = path.join(
      gcBase,
      "worker-evidence-swap.lock",
    );
    const workerEvidenceSwapIsolated = path.join(
      workerPreserved,
      "evidence-swap",
    );
    const parkedWorkerEvidence = `${workerEvidenceSwapIsolated}.parked`;
    const workerEvidenceSwapDestination = path.join(
      workerQuarantine,
      "worker-evidence-swap.released",
    );
    const workerEvidenceSuccessorBytes = Buffer.from(
      "foreign private evidence successor",
    );
    fs.writeFileSync(workerEvidenceSwapClaim, workerClaimBytes);
    const workerEvidenceSwapSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerEvidenceSwapClaim,
    );
    let workerEvidenceMarkerDescriptor = -1;
    // One holder carries the injection's progress: pending, the marker opened,
    // swapped, or the message the swap failed with. A boolean could not say
    // whether the trigger never matched or the mutation itself was refused.
    let workerEvidenceSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === workerEvidenceSwapDestination
      ) {
        workerEvidenceMarkerDescriptor = descriptor;
        workerEvidenceSwap = "marker opened";
      }
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      nativeClose(descriptor);
      if (
        workerEvidenceSwap === "marker opened" &&
        descriptor === workerEvidenceMarkerDescriptor
      ) {
        workerEvidenceSwap = "swapped";
        try {
          nativeRename(workerEvidenceSwapIsolated, parkedWorkerEvidence);
          nativeWriteFile(
            workerEvidenceSwapIsolated,
            workerEvidenceSuccessorBytes,
          );
        } catch (error) {
          workerEvidenceSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
    }) as typeof fs.closeSync;
    let workerEvidenceSwapRejected = false;
    let workerEvidenceSwapCleanupFailure: { error: unknown } | undefined;
    try {
      workerEvidenceSwapRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerEvidenceSwapDestination,
          isolated: workerEvidenceSwapIsolated,
          quarantine: workerPreserved,
          snapshot: workerEvidenceSwapSnapshot,
        }),
      );
    } catch (error) {
      workerEvidenceSwapCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(workerEvidenceSwapCleanupFailure, [
        {
          resource: "render quarantine evidence open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "render quarantine evidence close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "routine worker cleanup rejects private evidence changed after marker publication",
      {
        swap: workerEvidenceSwap,
        ...namedFacts([
          ["workerEvidenceSwapRejected", () => workerEvidenceSwapRejected],
          [
            "parkedWorkerEvidenceWorkerClaimBytes",
            () =>
              fs.readFileSync(parkedWorkerEvidence).equals(workerClaimBytes),
          ],
          [
            "workerEvidenceSwapIsolatedWorkerEvidenceSuccessorBytes",
            () =>
              fs
                .readFileSync(workerEvidenceSwapIsolated)
                .equals(workerEvidenceSuccessorBytes),
          ],
          [
            "workerEvidenceSwapDestinationResident",
            () => fs.existsSync(workerEvidenceSwapDestination),
          ],
          [
            "rejected",
            () =>
              throws(() =>
                renderGcModule.inspectRenderQuarantineMarker(
                  renderGcModule.captureRenderGcTarget(
                    gcBase,
                    workerEvidenceSwapDestination,
                  ),
                ),
              ),
          ],
        ]),
      },
      {
        swap: "swapped",
        workerEvidenceSwapRejected: true,
        parkedWorkerEvidenceWorkerClaimBytes: true,
        workerEvidenceSwapIsolatedWorkerEvidenceSuccessorBytes: true,
        workerEvidenceSwapDestinationResident: true,
        rejected: true,
      },
    );

    const workerParentAbaClaim = path.join(gcBase, "worker-parent-aba.lock");
    const workerParentAbaIsolated = path.join(workerPreserved, "parent-aba");
    const workerParentAbaDestination = path.join(
      workerQuarantine,
      "worker-parent-aba.released",
    );
    const parkedWorkerQuarantine = `${workerQuarantine}.parent-aba-parked`;
    fs.writeFileSync(workerParentAbaClaim, workerClaimBytes);
    const workerParentAbaSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerParentAbaClaim,
    );
    // The descriptor this hook returns lives inside the quarantine being moved,
    // and a platform may refuse that rename; the holder carries the outcome.
    let workerParentAbaSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        workerParentAbaSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === workerParentAbaDestination
      ) {
        workerParentAbaSwap = "swapped";
        try {
          nativeRename(workerQuarantine, parkedWorkerQuarantine);
          nativeMkdir(workerQuarantine);
          nativeLink(
            path.join(parkedWorkerQuarantine, path.basename(file.toString())),
            workerParentAbaDestination,
          );
        } catch (error) {
          workerParentAbaSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let workerParentAbaRejected = false;
    let workerParentAbaCleanupFailure: { error: unknown } | undefined;
    try {
      workerParentAbaRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerParentAbaDestination,
          isolated: workerParentAbaIsolated,
          quarantine: workerPreserved,
          snapshot: workerParentAbaSnapshot,
        }),
      );
    } catch (error) {
      workerParentAbaCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(workerParentAbaCleanupFailure, [
        {
          resource: "render GC worker parent ABA open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "routine worker cleanup rejects a same-inode quarantine-parent successor",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV|ENOTEMPTY)/u.test(workerParentAbaSwap)
          ? "rename refused"
          : workerParentAbaSwap,
        ...namedFacts([
          [
            "workerParentAbaRejected",
            () =>
              workerParentAbaRejected === (workerParentAbaSwap === "swapped"),
          ],
          [
            "workerParentAbaIsolatedWorkerClaimBytes",
            () =>
              fs.readFileSync(workerParentAbaIsolated).equals(workerClaimBytes),
          ],
          [
            "workerParentAbaDestinationResident",
            () => fs.existsSync(workerParentAbaDestination),
          ],
          [
            "parkedWorkerQuarantineResident",
            () =>
              workerParentAbaSwap !== "swapped" ||
              fs.existsSync(
                path.join(
                  parkedWorkerQuarantine,
                  path.basename(workerParentAbaDestination),
                ),
              ),
          ],
        ]),
      },
      {
        swap: workerParentAbaSwap === "swapped" ? "swapped" : "rename refused",
        workerParentAbaRejected: true,
        workerParentAbaIsolatedWorkerClaimBytes: true,
        workerParentAbaDestinationResident: true,
        parkedWorkerQuarantineResident: true,
      },
    );
    // Only a swap that happened leaves a parked quarantine to move back, and
    // each restore guards itself: this file's static contracts pin the
    // top-level statement indices around here, so the count may not change.
    if (workerParentAbaSwap === "swapped")
      fs.rmSync(workerQuarantine, { recursive: true });
    if (workerParentAbaSwap === "swapped")
      nativeRename(parkedWorkerQuarantine, workerQuarantine);
    fs.rmSync(workerParentAbaDestination, { force: true });
    fs.rmSync(workerParentAbaIsolated, { force: true });

    const workerRootAbaClaim = path.join(gcBase, "worker-root-aba.lock");
    const workerRootAbaIsolated = path.join(workerPreserved, "root-aba");
    const workerRootAbaDestination = path.join(
      workerQuarantine,
      "worker-root-aba.released",
    );
    const parkedWorkerRoot = `${gcBase}.root-aba-parked`;
    const workerRootCompetitorBytes = Buffer.from(
      "foreign replacement-root marker",
    );
    fs.writeFileSync(workerRootAbaClaim, workerClaimBytes);
    const workerRootAbaSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerRootAbaClaim,
    );
    // Same held-descriptor rule as the quarantine-parent swap above.
    let workerRootAbaSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        workerRootAbaSwap === "pending" &&
        typeof file !== "number" &&
        flags === "wx+" &&
        path.resolve(file.toString()) === workerRootAbaDestination
      ) {
        workerRootAbaSwap = "swapped";
        try {
          nativeRename(gcBase, parkedWorkerRoot);
          nativeMkdir(path.dirname(workerRootAbaDestination), {
            recursive: true,
          });
          nativeWriteFile(workerRootAbaDestination, workerRootCompetitorBytes);
        } catch (error) {
          workerRootAbaSwap =
            error instanceof Error ? error.message : String(error);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let workerRootAbaRejected = false;
    let workerRootAbaCleanupFailure: { error: unknown } | undefined;
    try {
      workerRootAbaRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerRootAbaDestination,
          isolated: workerRootAbaIsolated,
          quarantine: workerPreserved,
          snapshot: workerRootAbaSnapshot,
        }),
      );
    } catch (error) {
      workerRootAbaCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(workerRootAbaCleanupFailure, [
        {
          resource: "render GC worker root ABA open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "routine worker cleanup rejects a replacement render-root competitor",
      {
        swap: /(EPERM|EBUSY|EACCES|EXDEV|ENOTEMPTY)/u.test(workerRootAbaSwap)
          ? "rename refused"
          : workerRootAbaSwap,
        ...namedFacts([
          [
            "workerRootAbaRejected",
            () => workerRootAbaRejected === (workerRootAbaSwap === "swapped"),
          ],
          [
            "parkedWorkerRootRelative",
            () =>
              workerRootAbaSwap !== "swapped" ||
              fs
                .readFileSync(
                  path.join(
                    parkedWorkerRoot,
                    path.relative(gcBase, workerRootAbaIsolated),
                  ),
                )
                .equals(workerClaimBytes),
          ],
          [
            "parkedWorkerRootResident",
            () =>
              workerRootAbaSwap !== "swapped" ||
              fs.existsSync(
                path.join(
                  parkedWorkerRoot,
                  path.relative(gcBase, workerRootAbaDestination),
                ),
              ),
          ],
          [
            "workerRootAbaDestinationWorkerRootCompetitorBytes",
            () =>
              workerRootAbaSwap !== "swapped" ||
              fs
                .readFileSync(workerRootAbaDestination)
                .equals(workerRootCompetitorBytes),
          ],
        ]),
      },
      {
        swap: workerRootAbaSwap === "swapped" ? "swapped" : "rename refused",
        workerRootAbaRejected: true,
        parkedWorkerRootRelative: true,
        parkedWorkerRootResident: true,
        workerRootAbaDestinationWorkerRootCompetitorBytes: true,
      },
    );
    if (workerRootAbaSwap === "swapped") fs.rmSync(gcBase, { recursive: true });
    if (workerRootAbaSwap === "swapped") nativeRename(parkedWorkerRoot, gcBase);
    fs.rmSync(workerRootAbaDestination, { force: true });
    fs.rmSync(workerRootAbaIsolated, { force: true });

    const workerPartial = path.join(gcBase, "worker-partial");
    const workerPartialFile = path.join(workerPartial, "frame.bin");
    fs.mkdirSync(workerPartial);
    fs.writeFileSync(workerPartialFile, gcBytes);
    const workerPartialSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      workerPartial,
    );
    const parkedWorkerPartial = path.join(gcBase, "worker-partial-original");
    const workerPartialIsolated = path.join(workerPreserved, "partial");
    const workerPartialDestination = path.join(
      workerQuarantine,
      "worker-partial.abandoned",
    );
    let workerPartialSwapped = false;
    mutableFs.renameSync = ((oldPath, newPath) => {
      if (
        workerPartialSwapped === false &&
        path.resolve(oldPath.toString()) === workerPartial &&
        path.resolve(newPath.toString()) === workerPartialIsolated
      ) {
        nativeGcRename(workerPartial, parkedWorkerPartial);
        fs.mkdirSync(workerPartial);
        fs.writeFileSync(workerPartialFile, gcBytes);
        workerPartialSwapped = true;
      }
      nativeGcRename(oldPath, newPath);
    }) as typeof fs.renameSync;
    let workerPartialRejected = false;
    let workerPartialCleanupFailure: { error: unknown } | undefined;
    try {
      workerPartialRejected = throws(() =>
        renderGcModule.quarantineCapturedRenderTarget({
          destination: workerPartialDestination,
          isolated: workerPartialIsolated,
          quarantine: workerPreserved,
          snapshot: workerPartialSnapshot,
        }),
      );
    } catch (error) {
      workerPartialCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(workerPartialCleanupFailure, [
        {
          resource: "render GC worker partial rename hook",
          cleanup: () => {
            mutableFs.renameSync = nativeGcRename;
          },
        },
      ]);
    }
    TestValidator.equals(
      "routine worker cleanup preserves a directory successor at its private boundary",
      namedFacts([
        ["workerPartialSwapped", () => workerPartialSwapped],
        ["workerPartialRejected", () => workerPartialRejected],
        ["workerPartialResident", () => fs.existsSync(workerPartial) === false],
        [
          "parkedWorkerPartialResident",
          () => fs.existsSync(parkedWorkerPartial),
        ],
        [
          "workerPartialIsolatedFrame",
          () =>
            fs
              .readFileSync(path.join(workerPartialIsolated, "frame.bin"))
              .equals(gcBytes),
        ],
        [
          "workerPartialDestinationResident",
          () => fs.existsSync(workerPartialDestination) === false,
        ],
      ]),
      {
        workerPartialSwapped: true,
        workerPartialRejected: true,
        workerPartialResident: true,
        parkedWorkerPartialResident: true,
        workerPartialIsolatedFrame: true,
        workerPartialDestinationResident: true,
      },
    );
    const workerClaimReclaimableBytes =
      workerClaimMarkerSnapshot.bytes + workerClaimEvidence.evidence.bytes;
    renderGcModule.removeCapturedRenderQuarantine({
      evidence: workerClaimEvidence.evidence,
      marker: workerClaimMarkerSnapshot,
      quarantine: gcQuarantine,
    });
    TestValidator.equals(
      "render GC reclaims a bound evidence-marker pair evidence first",
      namedFacts([
        [
          "workerClaimReclaimableBytesCount",
          () =>
            workerClaimReclaimableBytes ===
            workerClaimBytes.length +
              Buffer.byteLength(
                `${JSON.stringify(workerClaimMarker, null, 2)}\n`,
              ),
        ],
        [
          "workerClaimIsolatedResident",
          () => fs.existsSync(workerClaimIsolated) === false,
        ],
        [
          "workerClaimDestinationResident",
          () => fs.existsSync(workerClaimDestination) === false,
        ],
      ]),
      {
        workerClaimReclaimableBytesCount: true,
        workerClaimIsolatedResident: true,
        workerClaimDestinationResident: true,
      },
    );
    fs.rmSync(workerDirectoryDestination, { force: true });
    fs.rmSync(workerDirectoryIsolated, { recursive: true, force: true });
    fs.rmSync(workerCompetitorDestination, { force: true });
    fs.rmSync(workerCompetitorIsolated, { force: true });
    fs.rmSync(workerMarkerSwapDestination, { force: true });
    fs.rmSync(parkedWorkerMarker, { force: true });
    fs.rmSync(workerMarkerSwapIsolated, { force: true });
    fs.rmSync(workerEvidenceSwapDestination, { force: true });
    fs.rmSync(workerEvidenceSwapIsolated, { force: true });
    fs.rmSync(parkedWorkerEvidence, { force: true });
    fs.rmSync(workerPartialIsolated, { recursive: true, force: true });
    fs.rmSync(parkedWorkerPartial, { recursive: true, force: true });
    const heldClaimDirectory = path.join(gcBase, "held-locks");
    const heldClaim = path.join(heldClaimDirectory, "held-claim.lock");
    const heldClaimSibling = path.join(
      heldClaimDirectory,
      "held-claim-sibling.lock",
    );
    fs.mkdirSync(heldClaimDirectory);
    fs.writeFileSync(heldClaim, workerClaimBytes);
    const heldClaimSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      heldClaim,
    );
    fs.writeFileSync(heldClaimSibling, "sibling namespace mutation");
    TestValidator.predicate(
      "an exact held claim survives unrelated sibling namespace mutation",
      !throws(() =>
        renderGcModule.assertCapturedRenderTarget(heldClaimSnapshot),
      ),
    );
    const decisionSuccessor = path.join(gcBase, "decision-successor.lock");
    fs.writeFileSync(decisionSuccessor, workerClaimBytes);
    TestValidator.predicate(
      "captured worker decisions read their exact descriptor bytes",
      Buffer.from(
        renderGcModule.readCapturedRenderGcFile(heldClaimSnapshot, 1024 * 1024),
      ).equals(workerClaimBytes),
    );
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === heldClaim
      )
        return Reflect.apply(nativeOpen, mutableFs, [
          decisionSuccessor,
          flags,
          ...args,
        ]) as number;
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let decisionSuccessorRejected = false;
    let decisionSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      decisionSuccessorRejected = throws(() =>
        renderGcModule.readCapturedRenderGcFile(heldClaimSnapshot, 1024 * 1024),
      );
    } catch (error) {
      decisionSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(decisionSuccessorCleanupFailure, [
        {
          resource: "render GC decision successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "captured worker decisions reject a pathname-opened successor descriptor",
      namedFacts([
        ["decisionSuccessorRejected", () => decisionSuccessorRejected],
        [
          "heldClaimWorkerClaimBytes",
          () => fs.readFileSync(heldClaim).equals(workerClaimBytes),
        ],
        [
          "decisionSuccessorWorkerClaimBytes",
          () => fs.readFileSync(decisionSuccessor).equals(workerClaimBytes),
        ],
      ]),
      {
        decisionSuccessorRejected: true,
        heldClaimWorkerClaimBytes: true,
        decisionSuccessorWorkerClaimBytes: true,
      },
    );
    fs.rmSync(heldClaimDirectory, { recursive: true, force: true });
    fs.rmSync(decisionSuccessor, { force: true });
    const largeDecision = path.join(gcBase, "large-decision.json");
    const largeDecisionBytes = Buffer.alloc(1024 * 1024 + 17, 0x61);
    fs.writeFileSync(largeDecision, largeDecisionBytes);
    const largeDecisionSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      largeDecision,
    );
    TestValidator.predicate(
      "captured receipt decisions have no arbitrary one-megabyte boundary",
      Buffer.from(
        renderGcModule.readCapturedRenderGcFile(
          largeDecisionSnapshot,
          largeDecisionSnapshot.bytes,
        ),
      ).equals(largeDecisionBytes),
    );
    fs.rmSync(largeDecision, { force: true });
    const decisionTree = path.join(gcBase, "decision-tree");
    const decisionReceipt = path.join(decisionTree, "receipt.json");
    const parkedDecisionTree = path.join(gcBase, "decision-tree-original");
    fs.mkdirSync(decisionTree);
    fs.writeFileSync(decisionReceipt, '{"slot":"fixture"}\n');
    const decisionReceiptSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      decisionReceipt,
    );
    const decisionTreeSnapshot = renderGcModule.captureRenderGcTarget(
      gcBase,
      decisionTree,
    );
    TestValidator.predicate(
      "stale receipt decisions bind to their exact directory inventory",
      !throws(() =>
        renderGcModule.assertCapturedRenderGcFileEntry({
          directory: decisionTreeSnapshot,
          file: decisionReceiptSnapshot,
          relative: "receipt.json",
        }),
      ),
    );
    fs.renameSync(decisionTree, parkedDecisionTree);
    fs.mkdirSync(decisionTree);
    fs.writeFileSync(decisionReceipt, '{"slot":"fixture"}\n');
    const decisionTreeSuccessor = renderGcModule.captureRenderGcTarget(
      gcBase,
      decisionTree,
    );
    TestValidator.predicate(
      "stale receipt decisions reject a byte-identical successor tree inventory",
      throws(() =>
        renderGcModule.assertCapturedRenderGcFileEntry({
          directory: decisionTreeSuccessor,
          file: decisionReceiptSnapshot,
          relative: "receipt.json",
        }),
      ),
    );
    fs.rmSync(decisionTree, { recursive: true, force: true });
    fs.rmSync(parkedDecisionTree, { recursive: true, force: true });
    TestValidator.predicate(
      "a non-empty target is refused without force",
      throws(() => writeFiles(target, files)),
    );
    TestValidator.predicate(
      "force scaffolds into a non-empty target",
      !throws(() => writeFiles(target, files, { force: true })),
    );
    const splitIdentityScaffold = path.join(base, "split-identity-scaffold");
    const splitIdentityTarget = path.join(splitIdentityScaffold, "owned.txt");
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeLstat, mutableFs, [
        file,
        ...args,
      ]) as fs.BigIntStats;
      if (path.resolve(file.toString()) !== splitIdentityTarget) return status;
      return new Proxy(status, {
        get: (current, property, receiver): unknown =>
          property === "ino"
            ? current.ino + 1n
            : Reflect.get(current, property, receiver),
      });
    }) as typeof fs.lstatSync;
    let splitIdentityWritten = false;
    let splitIdentityCleanupFailure: { error: unknown } | undefined;
    try {
      writeFiles(splitIdentityScaffold, { "owned.txt": "scaffold identity" });
      splitIdentityWritten = true;
    } catch (error) {
      splitIdentityCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(splitIdentityCleanupFailure, [
        {
          resource: "scaffold writer split identity lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold writes separate stable pathname and descriptor identity domains",
      namedFacts([
        ["written", () => splitIdentityWritten],
        [
          "content",
          () =>
            fs.readFileSync(splitIdentityTarget, "utf8") ===
            "scaffold identity",
        ],
      ]),
      { written: true, content: true },
    );
    TestValidator.predicate(
      "a traversal key is refused",
      throws(() =>
        writeFiles(path.join(base, "guard"), { "../escape.txt": "no" }),
      ),
    );
    const baseTargetScaffold = path.join(base, "base-target-scaffold");
    TestValidator.equals(
      "a scaffold key resolving to the base is refused before mutation",
      namedFacts([
        [
          "refused",
          () =>
            throws(() => writeFiles(baseTargetScaffold, { ".": "blocked" })),
        ],
        ["unmutated", () => fs.existsSync(baseTargetScaffold) === false],
      ]),
      { refused: true, unmutated: true },
    );
    const duplicateScaffold = path.join(base, "duplicate-scaffold");
    TestValidator.equals(
      "normalized duplicate scaffold targets are refused before mutation",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(duplicateScaffold, {
                "nested/../same.txt": "first",
                "same.txt": "second",
              }),
            ),
        ],
        ["unmutated", () => fs.existsSync(duplicateScaffold) === false],
      ]),
      { refused: true, unmutated: true },
    );
    const caseDuplicateScaffold = path.join(base, "case-duplicate-scaffold");
    TestValidator.equals(
      "portable case-only duplicate scaffold targets are refused before mutation",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(caseDuplicateScaffold, {
                "A.txt": "first",
                "a.txt": "second",
              }),
            ),
        ],
        ["unmutated", () => fs.existsSync(caseDuplicateScaffold) === false],
      ]),
      { refused: true, unmutated: true },
    );
    const collidingScaffold = path.join(base, "colliding-scaffold");
    TestValidator.equals(
      "scaffold file and directory target collisions are refused before mutation",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(collidingScaffold, {
                node: "file",
                "node/child.txt": "child",
              }),
            ),
        ],
        ["unmutated", () => fs.existsSync(collidingScaffold) === false],
      ]),
      { refused: true, unmutated: true },
    );

    const nonemptySuccessorBase = path.join(
      base,
      "nonempty-successor-scaffold",
    );
    const parkedEmptyScaffoldBase = `${nonemptySuccessorBase}.parked`;
    let nonemptyBaseSuccessorInstalled = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      const result = Reflect.apply(nativeMkdir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        nonemptyBaseSuccessorInstalled === false &&
        path.resolve(directory.toString()) === nonemptySuccessorBase
      ) {
        nativeRename(nonemptySuccessorBase, parkedEmptyScaffoldBase);
        nativeMkdir(nonemptySuccessorBase);
        nativeWriteFile(
          path.join(nonemptySuccessorBase, "foreign.txt"),
          "foreign base generation",
        );
        nonemptyBaseSuccessorInstalled = true;
      }
      return result;
    }) as typeof fs.mkdirSync;
    let nonemptyBaseSuccessorRejected = false;
    let nonemptyBaseSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      nonemptyBaseSuccessorRejected = throws(() =>
        writeFiles(
          nonemptySuccessorBase,
          { "owned.txt": "scaffold bytes" },
          { force: true },
        ),
      );
    } catch (error) {
      nonemptyBaseSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(nonemptyBaseSuccessorCleanupFailure, [
        {
          resource: "scaffold writer nonempty base mkdir hook",
          cleanup: () => {
            mutableFs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation rejects a non-empty base successor after mkdir",
      namedFacts([
        [
          "nonemptyBaseSuccessorInstalled",
          () => nonemptyBaseSuccessorInstalled,
        ],
        ["nonemptyBaseSuccessorRejected", () => nonemptyBaseSuccessorRejected],
        [
          "nonemptySuccessorBaseForeign",
          () =>
            fs.readFileSync(
              path.join(nonemptySuccessorBase, "foreign.txt"),
              "utf8",
            ) === "foreign base generation",
        ],
        [
          "parkedEmptyScaffoldBaseCount",
          () => fs.readdirSync(parkedEmptyScaffoldBase).length === 0,
        ],
        [
          "nonemptySuccessorBaseResident",
          () =>
            fs.existsSync(path.join(nonemptySuccessorBase, "owned.txt")) ===
            false,
        ],
      ]),
      {
        nonemptyBaseSuccessorInstalled: true,
        nonemptyBaseSuccessorRejected: true,
        nonemptySuccessorBaseForeign: true,
        parkedEmptyScaffoldBaseCount: true,
        nonemptySuccessorBaseResident: true,
      },
    );

    const nonemptyParentSuccessorBase = path.join(
      base,
      "nonempty-parent-successor-scaffold",
    );
    const nonemptyParentSuccessor = path.join(
      nonemptyParentSuccessorBase,
      "nested",
    );
    const parkedEmptyParent = `${nonemptyParentSuccessor}.parked`;
    fs.mkdirSync(nonemptyParentSuccessorBase);
    let nonemptyParentSuccessorInstalled = false;
    mutableFs.mkdirSync = ((directory, ...args: unknown[]): unknown => {
      const result = Reflect.apply(nativeMkdir, mutableFs, [
        directory,
        ...args,
      ]);
      if (
        nonemptyParentSuccessorInstalled === false &&
        path.resolve(directory.toString()) === nonemptyParentSuccessor
      ) {
        nativeRename(nonemptyParentSuccessor, parkedEmptyParent);
        nativeMkdir(nonemptyParentSuccessor);
        nativeWriteFile(
          path.join(nonemptyParentSuccessor, "foreign.txt"),
          "foreign parent generation",
        );
        nonemptyParentSuccessorInstalled = true;
      }
      return result;
    }) as typeof fs.mkdirSync;
    let nonemptyParentSuccessorRejected = false;
    let nonemptyParentSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      nonemptyParentSuccessorRejected = throws(() =>
        writeFiles(nonemptyParentSuccessorBase, {
          "nested/owned.txt": "scaffold bytes",
        }),
      );
    } catch (error) {
      nonemptyParentSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(nonemptyParentSuccessorCleanupFailure, [
        {
          resource: "scaffold writer nonempty parent mkdir hook",
          cleanup: () => {
            mutableFs.mkdirSync = nativeMkdir;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation rejects a non-empty descendant successor after mkdir",
      namedFacts([
        [
          "nonemptyParentSuccessorInstalled",
          () => nonemptyParentSuccessorInstalled,
        ],
        [
          "nonemptyParentSuccessorRejected",
          () => nonemptyParentSuccessorRejected,
        ],
        [
          "nonemptyParentSuccessorForeign",
          () =>
            fs.readFileSync(
              path.join(nonemptyParentSuccessor, "foreign.txt"),
              "utf8",
            ) === "foreign parent generation",
        ],
        [
          "parkedEmptyParentCount",
          () => fs.readdirSync(parkedEmptyParent).length === 0,
        ],
        [
          "nonemptyParentSuccessorResident",
          () =>
            fs.existsSync(path.join(nonemptyParentSuccessor, "owned.txt")) ===
            false,
        ],
      ]),
      {
        nonemptyParentSuccessorInstalled: true,
        nonemptyParentSuccessorRejected: true,
        nonemptyParentSuccessorForeign: true,
        parkedEmptyParentCount: true,
        nonemptyParentSuccessorResident: true,
      },
    );

    const linkedScaffoldOutside = path.join(base, "linked-scaffold-outside");
    const linkedScaffoldBase = path.join(base, "linked-scaffold-base");
    fs.mkdirSync(linkedScaffoldOutside);
    fs.symlinkSync(linkedScaffoldOutside, linkedScaffoldBase, "junction");
    TestValidator.equals(
      "a linked scaffold base cannot redirect materialization",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(
                linkedScaffoldBase,
                { "escaped.txt": "blocked" },
                { force: true },
              ),
            ),
        ],
        [
          "outsideUntouched",
          () =>
            fs.existsSync(path.join(linkedScaffoldOutside, "escaped.txt")) ===
            false,
        ],
      ]),
      { refused: true, outsideUntouched: true },
    );

    const linkedParentScaffold = path.join(base, "linked-parent-scaffold");
    const linkedParentOutside = path.join(base, "linked-parent-outside");
    const linkedParent = path.join(linkedParentScaffold, "linked");
    fs.mkdirSync(linkedParentScaffold);
    fs.mkdirSync(linkedParentOutside);
    fs.symlinkSync(linkedParentOutside, linkedParent, "junction");
    TestValidator.equals(
      "a linked descendant parent cannot redirect forced materialization",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(
                linkedParentScaffold,
                { "linked/escaped.txt": "blocked" },
                { force: true },
              ),
            ),
        ],
        [
          "outsideUntouched",
          () =>
            fs.existsSync(path.join(linkedParentOutside, "escaped.txt")) ===
            false,
        ],
      ]),
      { refused: true, outsideUntouched: true },
    );

    const linkedFileScaffold = path.join(base, "linked-file-scaffold");
    const linkedFileOutside = path.join(base, "linked-file-outside.txt");
    const linkedFileTarget = path.join(linkedFileScaffold, "owned.txt");
    fs.mkdirSync(linkedFileScaffold);
    fs.writeFileSync(linkedFileOutside, "outside file generation");
    fs.symlinkSync(linkedFileOutside, linkedFileTarget, "file");
    TestValidator.equals(
      "force refuses a linked final file without changing its referent",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(
                linkedFileScaffold,
                { "owned.txt": "replacement" },
                { force: true },
              ),
            ),
        ],
        [
          "referentUntouched",
          () =>
            fs.readFileSync(linkedFileOutside, "utf8") ===
            "outside file generation",
        ],
      ]),
      { refused: true, referentUntouched: true },
    );

    const hardLinkedScaffold = path.join(base, "hard-linked-scaffold");
    const hardLinkedOutside = path.join(base, "hard-linked-outside.txt");
    const hardLinkedTarget = path.join(hardLinkedScaffold, "owned.txt");
    fs.mkdirSync(hardLinkedScaffold);
    fs.writeFileSync(hardLinkedOutside, "outside generation");
    fs.linkSync(hardLinkedOutside, hardLinkedTarget);
    TestValidator.equals(
      "force refuses a multiply-linked target without changing its other name",
      namedFacts([
        [
          "refused",
          () =>
            throws(() =>
              writeFiles(
                hardLinkedScaffold,
                { "owned.txt": "replacement" },
                { force: true },
              ),
            ),
        ],
        [
          "otherNameUntouched",
          () =>
            fs.readFileSync(hardLinkedOutside, "utf8") === "outside generation",
        ],
      ]),
      { refused: true, otherNameUntouched: true },
    );

    const noForceRaceBase = path.join(base, "no-force-race-scaffold");
    const noForceRaceTarget = path.join(noForceRaceBase, "winner.txt");
    fs.mkdirSync(noForceRaceBase);
    let noForceCompetitorCreated = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      if (
        noForceCompetitorCreated === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === noForceRaceTarget &&
        flags === "wx+"
      ) {
        Reflect.apply(nativeWriteFile, mutableFs, [
          noForceRaceTarget,
          "successor generation",
          "utf8",
        ]);
        noForceCompetitorCreated = true;
      }
      return Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
    }) as typeof fs.openSync;
    let noForceCompetitorRejected = false;
    let noForceCompetitorCleanupFailure: { error: unknown } | undefined;
    try {
      noForceCompetitorRejected = throws(() =>
        writeFiles(noForceRaceBase, { "winner.txt": "scaffold bytes" }),
      );
    } catch (error) {
      noForceCompetitorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(noForceCompetitorCleanupFailure, [
        {
          resource: "scaffold writer no-force competitor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a no-force final competitor is preserved",
      namedFacts([
        ["noForceCompetitorCreated", () => noForceCompetitorCreated],
        ["noForceCompetitorRejected", () => noForceCompetitorRejected],
        [
          "noForceRaceTargetUtf8",
          () =>
            fs.readFileSync(noForceRaceTarget, "utf8") ===
            "successor generation",
        ],
      ]),
      {
        noForceCompetitorCreated: true,
        noForceCompetitorRejected: true,
        noForceRaceTargetUtf8: true,
      },
    );

    const forceRaceBase = path.join(base, "force-race-scaffold");
    const forceRaceTarget = path.join(forceRaceBase, "owned.txt");
    const parkedForceRaceTarget = path.join(base, "force-race-original.txt");
    fs.mkdirSync(forceRaceBase);
    fs.writeFileSync(forceRaceTarget, "original generation");
    let forceSuccessorInstalled = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        forceSuccessorInstalled === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === forceRaceTarget &&
        flags === "r+"
      ) {
        nativeRename(forceRaceTarget, parkedForceRaceTarget);
        Reflect.apply(nativeWriteFile, mutableFs, [
          forceRaceTarget,
          "successor generation",
          "utf8",
        ]);
        forceSuccessorInstalled = true;
      }
      return descriptor;
    }) as typeof fs.openSync;
    let forceSuccessorRejected = false;
    let forceSuccessorCleanupFailure: { error: unknown } | undefined;
    try {
      forceSuccessorRejected = throws(() =>
        writeFiles(
          forceRaceBase,
          { "owned.txt": "scaffold bytes" },
          { force: true },
        ),
      );
    } catch (error) {
      forceSuccessorCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(forceSuccessorCleanupFailure, [
        {
          resource: "scaffold writer force successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "force preserves a target successor installed after descriptor open",
      namedFacts([
        ["forceSuccessorInstalled", () => forceSuccessorInstalled],
        ["forceSuccessorRejected", () => forceSuccessorRejected],
        [
          "forceRaceTargetUtf8",
          () =>
            fs.readFileSync(forceRaceTarget, "utf8") === "successor generation",
        ],
        [
          "parkedForceRaceTargetUtf8",
          () =>
            fs.readFileSync(parkedForceRaceTarget, "utf8") ===
            "original generation",
        ],
      ]),
      {
        forceSuccessorInstalled: true,
        forceSuccessorRejected: true,
        forceRaceTargetUtf8: true,
        parkedForceRaceTargetUtf8: true,
      },
    );

    const rootRaceBase = path.join(base, "root-race-scaffold");
    const rootRaceTarget = path.join(rootRaceBase, "created.txt");
    const parkedRootRaceBase = `${rootRaceBase}.parked`;
    fs.mkdirSync(rootRaceBase);
    let scaffoldRootSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        scaffoldRootSwap === "pending" &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === rootRaceTarget &&
        flags === "wx+"
      ) {
        scaffoldRootSwap = "swapped";
        try {
          nativeRename(rootRaceBase, parkedRootRaceBase);
          Reflect.apply(nativeMkdir, mutableFs, [rootRaceBase]);
        } catch (swapFailure) {
          scaffoldRootSwap =
            swapFailure instanceof Error
              ? swapFailure.message
              : String(swapFailure);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let scaffoldRootRejected = false;
    let scaffoldRootCleanupFailure: { error: unknown } | undefined;
    try {
      scaffoldRootRejected = throws(() =>
        writeFiles(rootRaceBase, { "created.txt": "scaffold bytes" }),
      );
    } catch (error) {
      scaffoldRootCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(scaffoldRootCleanupFailure, [
        {
          resource: "scaffold writer root successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation rejects a base successor before writing bytes",
      {
        scaffoldRootSwap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(scaffoldRootSwap)
          ? "rename refused"
          : scaffoldRootSwap,
        ...namedFacts([
          [
            "scaffoldRootRejected",
            () => scaffoldRootRejected === (scaffoldRootSwap === "swapped"),
          ],
          [
            "rootRaceTargetResident",
            () =>
              fs.existsSync(rootRaceTarget) ===
              (scaffoldRootSwap !== "swapped"),
          ],
          [
            "parkedRootRaceBaseCount",
            () =>
              scaffoldRootSwap !== "swapped" ||
              fs.readFileSync(path.join(parkedRootRaceBase, "created.txt"))
                .length === 0,
          ],
        ]),
      },
      {
        scaffoldRootSwap:
          scaffoldRootSwap === "swapped" || scaffoldRootSwap === "pending"
            ? scaffoldRootSwap
            : "rename refused",
        scaffoldRootRejected: true,
        rootRaceTargetResident: true,
        parkedRootRaceBaseCount: true,
      },
    );

    const parentRaceBase = path.join(base, "parent-race-scaffold");
    const parentRaceParent = path.join(parentRaceBase, "nested");
    const parentRaceTarget = path.join(parentRaceParent, "created.txt");
    const parkedParentRace = `${parentRaceParent}.parked`;
    fs.mkdirSync(parentRaceParent, { recursive: true });
    let scaffoldParentSwap = "pending";
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        scaffoldParentSwap === "pending" &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === parentRaceTarget &&
        flags === "wx+"
      ) {
        scaffoldParentSwap = "swapped";
        try {
          nativeRename(parentRaceParent, parkedParentRace);
          Reflect.apply(nativeMkdir, mutableFs, [parentRaceParent]);
        } catch (swapFailure) {
          scaffoldParentSwap =
            swapFailure instanceof Error
              ? swapFailure.message
              : String(swapFailure);
        }
      }
      return descriptor;
    }) as typeof fs.openSync;
    let scaffoldParentRejected = false;
    let scaffoldParentCleanupFailure: { error: unknown } | undefined;
    try {
      scaffoldParentRejected = throws(() =>
        writeFiles(
          parentRaceBase,
          { "nested/created.txt": "scaffold bytes" },
          { force: true },
        ),
      );
    } catch (error) {
      scaffoldParentCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(scaffoldParentCleanupFailure, [
        {
          resource: "scaffold writer parent successor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation rejects a descendant-parent successor before writing bytes",
      {
        scaffoldParentSwap: /(EPERM|EBUSY|EACCES|EXDEV)/u.test(
          scaffoldParentSwap,
        )
          ? "rename refused"
          : scaffoldParentSwap,
        ...namedFacts([
          [
            "scaffoldParentRejected",
            () => scaffoldParentRejected === (scaffoldParentSwap === "swapped"),
          ],
          [
            "parentRaceTargetResident",
            () =>
              fs.existsSync(parentRaceTarget) ===
              (scaffoldParentSwap !== "swapped"),
          ],
          [
            "parkedParentRaceCount",
            () =>
              scaffoldParentSwap !== "swapped" ||
              fs.readFileSync(path.join(parkedParentRace, "created.txt"))
                .length === 0,
          ],
        ]),
      },
      {
        scaffoldParentSwap:
          scaffoldParentSwap === "swapped" || scaffoldParentSwap === "pending"
            ? scaffoldParentSwap
            : "rename refused",
        scaffoldParentRejected: true,
        parentRaceTargetResident: true,
        parkedParentRaceCount: true,
      },
    );

    const partialWriteBase = path.join(base, "partial-write-scaffold");
    const partialWriteTarget = path.join(partialWriteBase, "partial.txt");
    let scaffoldWriteCalls = 0;
    mutableFs.writeSync = ((...args: unknown[]): number => {
      const [descriptor, buffer, offset, length, position] = args as [
        number,
        Uint8Array,
        number,
        number,
        number,
      ];
      scaffoldWriteCalls++;
      return scaffoldWriteCalls === 1
        ? (Reflect.apply(nativeWrite, mutableFs, [
            descriptor,
            buffer,
            offset,
            Math.min(1, length),
            position,
          ]) as number)
        : 0;
    }) as typeof fs.writeSync;
    let partialWriteRejected = false;
    let partialWriteCleanupFailure: { error: unknown } | undefined;
    try {
      partialWriteRejected = throws(() =>
        writeFiles(partialWriteBase, { "partial.txt": "partial evidence" }),
      );
    } catch (error) {
      partialWriteCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(partialWriteCleanupFailure, [
        {
          resource: "scaffold writer partial write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a stalled scaffold write leaves its exact partial final evidence",
      namedFacts([
        ["rejected", () => partialWriteRejected],
        ["partial", () => fs.readFileSync(partialWriteTarget, "utf8") === "p"],
      ]),
      { rejected: true, partial: true },
    );

    const fsyncFailureBase = path.join(base, "fsync-failure-scaffold");
    const fsyncFailureTarget = path.join(fsyncFailureBase, "complete.txt");
    let scaffoldFsyncFailed = false;
    mutableFs.fsyncSync = ((descriptor: number): void => {
      Reflect.apply(nativeFsync, mutableFs, [descriptor]);
      scaffoldFsyncFailed = true;
      throw Object.assign(new Error("scaffold fsync failed"), { code: "EIO" });
    }) as typeof fs.fsyncSync;
    let fsyncFailureRejected = false;
    let fsyncFailureCleanupFailure: { error: unknown } | undefined;
    try {
      fsyncFailureRejected = throws(() =>
        writeFiles(fsyncFailureBase, { "complete.txt": "complete evidence" }),
      );
    } catch (error) {
      fsyncFailureCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(fsyncFailureCleanupFailure, [
        {
          resource: "scaffold writer fsync hook",
          cleanup: () => {
            mutableFs.fsyncSync = nativeFsync;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a scaffold fsync failure leaves its complete final evidence",
      namedFacts([
        ["scaffoldFsyncFailed", () => scaffoldFsyncFailed],
        ["fsyncFailureRejected", () => fsyncFailureRejected],
        [
          "fsyncFailureTargetUtf8",
          () =>
            fs.readFileSync(fsyncFailureTarget, "utf8") === "complete evidence",
        ],
      ]),
      {
        scaffoldFsyncFailed: true,
        fsyncFailureRejected: true,
        fsyncFailureTargetUtf8: true,
      },
    );

    const readFailureBase = path.join(base, "read-failure-scaffold");
    const readFailureTarget = path.join(readFailureBase, "complete.txt");
    let scaffoldReadStopped = false;
    mutableFs.readSync = ((..._args: unknown[]): number => {
      scaffoldReadStopped = true;
      return 0;
    }) as typeof fs.readSync;
    let readFailureRejected = false;
    let readFailureCleanupFailure: { error: unknown } | undefined;
    try {
      readFailureRejected = throws(() =>
        writeFiles(readFailureBase, { "complete.txt": "read evidence" }),
      );
    } catch (error) {
      readFailureCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(readFailureCleanupFailure, [
        {
          resource: "scaffold writer read stall hook",
          cleanup: () => {
            mutableFs.readSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a scaffold readback stall leaves its complete final evidence",
      namedFacts([
        ["scaffoldReadStopped", () => scaffoldReadStopped],
        ["readFailureRejected", () => readFailureRejected],
        [
          "readFailureTargetUtf8",
          () => fs.readFileSync(readFailureTarget, "utf8") === "read evidence",
        ],
      ]),
      {
        scaffoldReadStopped: true,
        readFailureRejected: true,
        readFailureTargetUtf8: true,
      },
    );

    const mismatchBase = path.join(base, "read-mismatch-scaffold");
    const mismatchTarget = path.join(mismatchBase, "complete.txt");
    let scaffoldReadMismatched = false;
    mutableFs.readSync = ((...args: unknown[]): number => {
      const length = Reflect.apply(nativeRead, mutableFs, args) as number;
      if (length > 0) {
        const buffer = args[1] as Uint8Array;
        const offset = args[2] as number;
        buffer[offset] = (buffer[offset] ?? 0) ^ 0xff;
        scaffoldReadMismatched = true;
      }
      return length;
    }) as typeof fs.readSync;
    let mismatchRejected = false;
    let mismatchCleanupFailure: { error: unknown } | undefined;
    try {
      mismatchRejected = throws(() =>
        writeFiles(mismatchBase, { "complete.txt": "mismatch evidence" }),
      );
    } catch (error) {
      mismatchCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(mismatchCleanupFailure, [
        {
          resource: "scaffold writer mismatch read hook",
          cleanup: () => {
            mutableFs.readSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a scaffold readback mismatch leaves its exact final file",
      namedFacts([
        ["scaffoldReadMismatched", () => scaffoldReadMismatched],
        ["mismatchRejected", () => mismatchRejected],
        [
          "mismatchTargetUtf8",
          () => fs.readFileSync(mismatchTarget, "utf8") === "mismatch evidence",
        ],
      ]),
      {
        scaffoldReadMismatched: true,
        mismatchRejected: true,
        mismatchTargetUtf8: true,
      },
    );

    const shortReadBase = path.join(base, "short-read-scaffold");
    const shortReadTarget = path.join(shortReadBase, "complete.txt");
    let scaffoldShortReads = 0;
    mutableFs.readSync = ((...args: unknown[]): number => {
      const [descriptor, buffer, offset, length, position] = args as [
        number,
        Uint8Array,
        number,
        number,
        number,
      ];
      scaffoldShortReads++;
      return Reflect.apply(nativeRead, mutableFs, [
        descriptor,
        buffer,
        offset,
        Math.min(1, length),
        position,
      ]) as number;
    }) as typeof fs.readSync;
    let shortReadAccepted = false;
    let shortReadCleanupFailure: { error: unknown } | undefined;
    try {
      shortReadAccepted = !throws(() =>
        writeFiles(shortReadBase, { "complete.txt": "short reads" }),
      );
    } catch (error) {
      shortReadCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(shortReadCleanupFailure, [
        {
          resource: "scaffold writer short read hook",
          cleanup: () => {
            mutableFs.readSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold readback completes across positive short reads",
      namedFacts([
        ["shortReadAccepted", () => shortReadAccepted],
        ["scaffoldShortReads", () => scaffoldShortReads > 2],
        [
          "shortReadTargetUtf8",
          () => fs.readFileSync(shortReadTarget, "utf8") === "short reads",
        ],
      ]),
      {
        shortReadAccepted: true,
        scaffoldShortReads: true,
        shortReadTargetUtf8: true,
      },
    );

    const lateCreateMutationBase = path.join(
      base,
      "late-create-mutation-scaffold",
    );
    const lateCreateMutationTarget = path.join(
      lateCreateMutationBase,
      "owned.txt",
    );
    let lateCreateDescriptor = -1;
    let lateCreateReadbacks = 0;
    let lateCreateMutated = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === lateCreateMutationTarget &&
        flags === "wx+"
      )
        lateCreateDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.readSync = ((...args: unknown[]): number => {
      const length = Reflect.apply(nativeRead, mutableFs, args) as number;
      if (
        args[0] === lateCreateDescriptor &&
        (args[4] as number) + length ===
          Buffer.byteLength("scaffold generation") &&
        ++lateCreateReadbacks === 2
      ) {
        nativeWriteFile(lateCreateMutationTarget, "foreign! generation");
        lateCreateMutated = true;
      }
      return length;
    }) as typeof fs.readSync;
    let lateCreateMutationRejected = false;
    let lateCreateMutationCleanupFailure: { error: unknown } | undefined;
    try {
      lateCreateMutationRejected = throws(() =>
        writeFiles(lateCreateMutationBase, {
          "owned.txt": "scaffold generation",
        }),
      );
    } catch (error) {
      lateCreateMutationCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(lateCreateMutationCleanupFailure, [
        {
          resource: "scaffold late create open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold late create read hook",
          cleanup: () => {
            mutableFs.readSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation rejects same-inode mutation after final readback",
      namedFacts([
        ["lateCreateMutated", () => lateCreateMutated],
        ["lateCreateMutationRejected", () => lateCreateMutationRejected],
        [
          "lateCreateMutationTargetUtf8",
          () =>
            fs.readFileSync(lateCreateMutationTarget, "utf8") ===
            "foreign! generation",
        ],
      ]),
      {
        lateCreateMutated: true,
        lateCreateMutationRejected: true,
        lateCreateMutationTargetUtf8: true,
      },
    );

    const lateForceMutationBase = path.join(
      base,
      "late-force-mutation-scaffold",
    );
    const lateForceMutationTarget = path.join(
      lateForceMutationBase,
      "owned.txt",
    );
    fs.mkdirSync(lateForceMutationBase);
    fs.writeFileSync(lateForceMutationTarget, "original generation");
    let lateForceDescriptor = -1;
    let lateForceReadbacks = 0;
    let lateForceMutated = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === lateForceMutationTarget &&
        flags === "r+"
      )
        lateForceDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.readSync = ((...args: unknown[]): number => {
      const length = Reflect.apply(nativeRead, mutableFs, args) as number;
      if (
        args[0] === lateForceDescriptor &&
        (args[4] as number) + length ===
          Buffer.byteLength("scaffold generation") &&
        ++lateForceReadbacks === 2
      ) {
        nativeWriteFile(lateForceMutationTarget, "foreign! generation");
        lateForceMutated = true;
      }
      return length;
    }) as typeof fs.readSync;
    let lateForceMutationRejected = false;
    let lateForceMutationCleanupFailure: { error: unknown } | undefined;
    try {
      lateForceMutationRejected = throws(() =>
        writeFiles(
          lateForceMutationBase,
          { "owned.txt": "scaffold generation" },
          { force: true },
        ),
      );
    } catch (error) {
      lateForceMutationCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(lateForceMutationCleanupFailure, [
        {
          resource: "scaffold late force open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold late force read hook",
          cleanup: () => {
            mutableFs.readSync = nativeRead;
          },
        },
      ]);
    }
    TestValidator.equals(
      "forced scaffold write rejects same-inode mutation after final readback",
      namedFacts([
        ["lateForceMutated", () => lateForceMutated],
        ["lateForceMutationRejected", () => lateForceMutationRejected],
        [
          "lateForceMutationTargetUtf8",
          () =>
            fs.readFileSync(lateForceMutationTarget, "utf8") ===
            "foreign! generation",
        ],
      ]),
      {
        lateForceMutated: true,
        lateForceMutationRejected: true,
        lateForceMutationTargetUtf8: true,
      },
    );

    const finalCreateMutationBase = path.join(
      base,
      "final-create-mutation-scaffold",
    );
    const finalCreateMutationTarget = path.join(
      finalCreateMutationBase,
      "owned.txt",
    );
    let finalCreateDescriptor = -1;
    let finalCreateDescriptorSnapshots = 0;
    let finalCreateMutationArmed = false;
    let finalCreateMutated = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === finalCreateMutationTarget &&
        flags === "wx+"
      )
        finalCreateDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeFstat, mutableFs, [
        descriptor,
        ...args,
      ]);
      if (
        descriptor === finalCreateDescriptor &&
        ++finalCreateDescriptorSnapshots === 5
      )
        finalCreateMutationArmed = true;
      return status;
    }) as typeof fs.fstatSync;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      if (
        finalCreateMutationArmed &&
        path.resolve(file.toString()) === finalCreateMutationTarget
      ) {
        nativeWriteFile(
          finalCreateMutationTarget,
          "foreign generation after final descriptor snapshot",
        );
        finalCreateMutationArmed = false;
        finalCreateMutated = true;
      }
      return Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
    }) as typeof fs.lstatSync;
    let finalCreateMutationRejected = false;
    let finalCreateMutationCleanupFailure: { error: unknown } | undefined;
    try {
      finalCreateMutationRejected = throws(() =>
        writeFiles(finalCreateMutationBase, {
          "owned.txt": "scaffold generation",
        }),
      );
    } catch (error) {
      finalCreateMutationCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(finalCreateMutationCleanupFailure, [
        {
          resource: "scaffold final create open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold final create fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "scaffold final create lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation rejects mutation after its final descriptor snapshot",
      namedFacts([
        ["finalCreateMutated", () => finalCreateMutated],
        ["finalCreateMutationRejected", () => finalCreateMutationRejected],
        [
          "finalCreateMutationTargetUtf8",
          () =>
            fs.readFileSync(finalCreateMutationTarget, "utf8") ===
            "foreign generation after final descriptor snapshot",
        ],
      ]),
      {
        finalCreateMutated: true,
        finalCreateMutationRejected: true,
        finalCreateMutationTargetUtf8: true,
      },
    );

    const finalForceMutationBase = path.join(
      base,
      "final-force-mutation-scaffold",
    );
    const finalForceMutationTarget = path.join(
      finalForceMutationBase,
      "owned.txt",
    );
    fs.mkdirSync(finalForceMutationBase);
    fs.writeFileSync(finalForceMutationTarget, "original generation");
    let finalForceDescriptor = -1;
    let finalForceDescriptorSnapshots = 0;
    let finalForceMutationArmed = false;
    let finalForceMutated = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === finalForceMutationTarget &&
        flags === "r+"
      )
        finalForceDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      const status = Reflect.apply(nativeFstat, mutableFs, [
        descriptor,
        ...args,
      ]);
      if (
        descriptor === finalForceDescriptor &&
        ++finalForceDescriptorSnapshots === 5
      )
        finalForceMutationArmed = true;
      return status;
    }) as typeof fs.fstatSync;
    mutableFs.lstatSync = ((file, ...args: unknown[]): unknown => {
      if (
        finalForceMutationArmed &&
        path.resolve(file.toString()) === finalForceMutationTarget
      ) {
        nativeWriteFile(
          finalForceMutationTarget,
          "foreign generation after final descriptor snapshot",
        );
        finalForceMutationArmed = false;
        finalForceMutated = true;
      }
      return Reflect.apply(nativeLstat, mutableFs, [file, ...args]);
    }) as typeof fs.lstatSync;
    let finalForceMutationRejected = false;
    let finalForceMutationCleanupFailure: { error: unknown } | undefined;
    try {
      finalForceMutationRejected = throws(() =>
        writeFiles(
          finalForceMutationBase,
          { "owned.txt": "scaffold generation" },
          { force: true },
        ),
      );
    } catch (error) {
      finalForceMutationCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(finalForceMutationCleanupFailure, [
        {
          resource: "scaffold final force open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold final force fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "scaffold final force lstat hook",
          cleanup: () => {
            mutableFs.lstatSync = nativeLstat;
          },
        },
      ]);
    }
    TestValidator.equals(
      "forced scaffold write rejects mutation after its final descriptor snapshot",
      namedFacts([
        ["finalForceMutated", () => finalForceMutated],
        ["finalForceMutationRejected", () => finalForceMutationRejected],
        [
          "finalForceMutationTargetUtf8",
          () =>
            fs.readFileSync(finalForceMutationTarget, "utf8") ===
            "foreign generation after final descriptor snapshot",
        ],
      ]),
      {
        finalForceMutated: true,
        finalForceMutationRejected: true,
        finalForceMutationTargetUtf8: true,
      },
    );

    const closeFailureBase = path.join(base, "close-failure-scaffold");
    const closeFailureTarget = path.join(closeFailureBase, "complete.txt");
    const standaloneScaffoldCloseFailure = Object.assign(
      new Error("scaffold close failed"),
      { code: "EIO" },
    );
    let scaffoldCloseFailed = false;
    let closeFailureDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === closeFailureTarget &&
        flags === "wx+"
      )
        closeFailureDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === closeFailureDescriptor) {
        scaffoldCloseFailed = true;
        throw standaloneScaffoldCloseFailure;
      }
    }) as typeof fs.closeSync;
    let standaloneScaffoldCloseError: unknown;
    let standaloneScaffoldHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      writeFiles(closeFailureBase, { "complete.txt": "close evidence" });
    } catch (error) {
      standaloneScaffoldCloseError = error;
      standaloneScaffoldHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(standaloneScaffoldHarnessCleanupFailure, [
        {
          resource: "scaffold standalone open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold standalone close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "a scaffold close failure leaves its exact complete final evidence",
      namedFacts([
        ["scaffoldCloseFailed", () => scaffoldCloseFailed],
        [
          "standaloneScaffoldCloseErrorStandaloneScaffoldCloseFailure",
          () => standaloneScaffoldCloseError === standaloneScaffoldCloseFailure,
        ],
        [
          "closeFailureTargetUtf8",
          () =>
            fs.readFileSync(closeFailureTarget, "utf8") === "close evidence",
        ],
      ]),
      {
        scaffoldCloseFailed: true,
        standaloneScaffoldCloseErrorStandaloneScaffoldCloseFailure: true,
        closeFailureTargetUtf8: true,
      },
    );

    const primaryOnlyFailureBase = path.join(
      base,
      "primary-only-failure-scaffold",
    );
    const primaryOnlyFailure = new Error("scaffold primary-only write failed");
    mutableFs.writeSync = (() => {
      throw primaryOnlyFailure;
    }) as typeof fs.writeSync;
    let preservedPrimaryOnlyFailure: unknown;
    let primaryOnlyCleanupFailure: { error: unknown } | undefined;
    try {
      writeFiles(primaryOnlyFailureBase, {
        "partial.txt": "primary-only evidence",
      });
    } catch (error) {
      preservedPrimaryOnlyFailure = error;
      primaryOnlyCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(primaryOnlyCleanupFailure, [
        {
          resource: "scaffold writer primary-only write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
      ]);
    }
    TestValidator.predicate(
      "scaffold failure remains unchanged after successful descriptor close",
      preservedPrimaryOnlyFailure === primaryOnlyFailure,
    );

    const doubleFailureBase = path.join(base, "double-failure-scaffold");
    const doubleFailureTarget = path.join(doubleFailureBase, "partial.txt");
    const doubleFailurePrimary = Object.assign(
      new Error("scaffold primary write failed"),
      { code: "EIO" },
    );
    const doubleFailureClose = Object.assign(
      new Error("scaffold secondary close failed"),
      { code: "EIO" },
    );
    let doubleFailureDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === doubleFailureTarget &&
        flags === "wx+"
      )
        doubleFailureDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.writeSync = ((...args: unknown[]): number => {
      const [descriptor, buffer, offset, _length, position] = args as [
        number,
        Uint8Array,
        number,
        number,
        number,
      ];
      Reflect.apply(nativeWrite, mutableFs, [
        descriptor,
        buffer,
        offset,
        1,
        position,
      ]);
      throw doubleFailurePrimary;
    }) as typeof fs.writeSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === doubleFailureDescriptor) throw doubleFailureClose;
    }) as typeof fs.closeSync;
    let combinedDoubleFailure: unknown;
    let doubleFailureHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      writeFiles(doubleFailureBase, { "partial.txt": "double evidence" });
    } catch (error) {
      combinedDoubleFailure = error;
      doubleFailureHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(doubleFailureHarnessCleanupFailure, [
        {
          resource: "scaffold create double open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold create double write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
        {
          resource: "scaffold create double close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold creation preserves primary and close failures",
      namedFacts([
        [
          "combinedDoubleFailureInstanceof",
          () => combinedDoubleFailure instanceof AggregateError,
        ],
        [
          "combinedDoubleFailureCount",
          () =>
            combinedDoubleFailure instanceof AggregateError &&
            combinedDoubleFailure.errors.length === 2,
        ],
        [
          "combinedDoubleFailureErrors",
          () =>
            combinedDoubleFailure instanceof AggregateError &&
            combinedDoubleFailure.errors.length === 2 &&
            combinedDoubleFailure.errors[0] === doubleFailurePrimary,
        ],
        [
          "combinedDoubleFailureErrors2",
          () =>
            combinedDoubleFailure instanceof AggregateError &&
            combinedDoubleFailure.errors.length === 2 &&
            combinedDoubleFailure.errors[0] === doubleFailurePrimary &&
            combinedDoubleFailure.errors[1] === doubleFailureClose,
        ],
        [
          "doubleFailureTargetUtf8",
          () => fs.readFileSync(doubleFailureTarget, "utf8") === "d",
        ],
      ]),
      {
        combinedDoubleFailureInstanceof: true,
        combinedDoubleFailureCount: true,
        combinedDoubleFailureErrors: true,
        combinedDoubleFailureErrors2: true,
        doubleFailureTargetUtf8: true,
      },
    );

    const overwriteDoubleFailureBase = path.join(
      base,
      "overwrite-double-failure-scaffold",
    );
    const overwriteDoubleFailureTarget = path.join(
      overwriteDoubleFailureBase,
      "partial.txt",
    );
    fs.mkdirSync(overwriteDoubleFailureBase);
    fs.writeFileSync(overwriteDoubleFailureTarget, "original evidence");
    const overwriteDoubleFailurePrimary = new Error(
      "scaffold overwrite failed",
    );
    const overwriteDoubleFailureClose = new Error(
      "scaffold overwrite close failed",
    );
    let overwriteDoubleFailureDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        path.resolve(file.toString()) === overwriteDoubleFailureTarget &&
        flags === "r+"
      )
        overwriteDoubleFailureDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.writeSync = ((...args: unknown[]): number => {
      if (args[0] === overwriteDoubleFailureDescriptor)
        throw overwriteDoubleFailurePrimary;
      return Reflect.apply(nativeWrite, mutableFs, args) as number;
    }) as typeof fs.writeSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === overwriteDoubleFailureDescriptor)
        throw overwriteDoubleFailureClose;
    }) as typeof fs.closeSync;
    let combinedOverwriteDoubleFailure: unknown;
    let overwriteDoubleFailureHarnessCleanupFailure:
      | { error: unknown }
      | undefined;
    try {
      writeFiles(
        overwriteDoubleFailureBase,
        { "partial.txt": "replacement evidence" },
        { force: true },
      );
    } catch (error) {
      combinedOverwriteDoubleFailure = error;
      overwriteDoubleFailureHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(overwriteDoubleFailureHarnessCleanupFailure, [
        {
          resource: "scaffold overwrite double open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold overwrite double write hook",
          cleanup: () => {
            mutableFs.writeSync = nativeWrite;
          },
        },
        {
          resource: "scaffold overwrite double close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold overwrite preserves primary and close failures",
      namedFacts([
        [
          "combinedOverwriteDoubleFailureInstanceof",
          () => combinedOverwriteDoubleFailure instanceof AggregateError,
        ],
        [
          "combinedOverwriteDoubleFailureCount",
          () =>
            combinedOverwriteDoubleFailure instanceof AggregateError &&
            combinedOverwriteDoubleFailure.errors.length === 2,
        ],
        [
          "combinedOverwriteDoubleFailureErrors",
          () =>
            combinedOverwriteDoubleFailure instanceof AggregateError &&
            combinedOverwriteDoubleFailure.errors.length === 2 &&
            combinedOverwriteDoubleFailure.errors[0] ===
              overwriteDoubleFailurePrimary,
        ],
        [
          "combinedOverwriteDoubleFailureErrors2",
          () =>
            combinedOverwriteDoubleFailure instanceof AggregateError &&
            combinedOverwriteDoubleFailure.errors.length === 2 &&
            combinedOverwriteDoubleFailure.errors[0] ===
              overwriteDoubleFailurePrimary &&
            combinedOverwriteDoubleFailure.errors[1] ===
              overwriteDoubleFailureClose,
        ],
      ]),
      {
        combinedOverwriteDoubleFailureInstanceof: true,
        combinedOverwriteDoubleFailureCount: true,
        combinedOverwriteDoubleFailureErrors: true,
        combinedOverwriteDoubleFailureErrors2: true,
      },
    );

    const nestedDescriptorFailureBase = path.join(
      base,
      "nested-descriptor-failure-scaffold",
    );
    const nestedDescriptorFailureTarget = path.join(
      nestedDescriptorFailureBase,
      "owned.txt",
    );
    const nestedDescriptorPrimary = new Error(
      "resident descriptor verification failed",
    );
    const nestedResidentCloseFailure = new Error(
      "resident descriptor close failed",
    );
    const nestedOwnerCloseFailure = new Error("owner descriptor close failed");
    let nestedOwnerDescriptor = -1;
    let nestedResidentDescriptor = -1;
    let nestedResidentFailureInjected = false;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (path.resolve(file.toString()) === nestedDescriptorFailureTarget) {
        if (flags === "wx+") nestedOwnerDescriptor = descriptor;
        else if (flags === "r" && nestedResidentDescriptor === -1)
          nestedResidentDescriptor = descriptor;
      }
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.fstatSync = ((descriptor, ...args: unknown[]): unknown => {
      if (
        descriptor === nestedResidentDescriptor &&
        nestedResidentFailureInjected === false
      ) {
        nestedResidentFailureInjected = true;
        throw nestedDescriptorPrimary;
      }
      return Reflect.apply(nativeFstat, mutableFs, [descriptor, ...args]);
    }) as typeof fs.fstatSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === nestedResidentDescriptor)
        throw nestedResidentCloseFailure;
      if (descriptor === nestedOwnerDescriptor) throw nestedOwnerCloseFailure;
    }) as typeof fs.closeSync;
    let combinedNestedDescriptorFailure: unknown;
    let nestedDescriptorHarnessCleanupFailure: { error: unknown } | undefined;
    try {
      writeFiles(nestedDescriptorFailureBase, {
        "owned.txt": "nested descriptor evidence",
      });
    } catch (error) {
      combinedNestedDescriptorFailure = error;
      nestedDescriptorHarnessCleanupFailure = { error };
    } finally {
      preserveCliHarnessCleanup(nestedDescriptorHarnessCleanupFailure, [
        {
          resource: "scaffold nested descriptor open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold nested descriptor fstat hook",
          cleanup: () => {
            mutableFs.fstatSync = nativeFstat;
          },
        },
        {
          resource: "scaffold nested descriptor close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "nested scaffold descriptor cleanup preserves resource order",
      namedFacts([
        ["nestedResidentFailureInjected", () => nestedResidentFailureInjected],
        [
          "combinedNestedDescriptorFailureInstanceof",
          () => combinedNestedDescriptorFailure instanceof AggregateError,
        ],
        [
          "combinedNestedDescriptorFailureCount",
          () =>
            combinedNestedDescriptorFailure instanceof AggregateError &&
            combinedNestedDescriptorFailure.errors.length === 3,
        ],
        [
          "combinedNestedDescriptorFailureErrors",
          () =>
            combinedNestedDescriptorFailure instanceof AggregateError &&
            combinedNestedDescriptorFailure.errors.length === 3 &&
            combinedNestedDescriptorFailure.errors[0] ===
              nestedDescriptorPrimary,
        ],
        [
          "combinedNestedDescriptorFailureErrors2",
          () =>
            combinedNestedDescriptorFailure instanceof AggregateError &&
            combinedNestedDescriptorFailure.errors.length === 3 &&
            combinedNestedDescriptorFailure.errors[0] ===
              nestedDescriptorPrimary &&
            combinedNestedDescriptorFailure.errors[1] ===
              nestedResidentCloseFailure,
        ],
        [
          "combinedNestedDescriptorFailureErrors3",
          () =>
            combinedNestedDescriptorFailure instanceof AggregateError &&
            combinedNestedDescriptorFailure.errors.length === 3 &&
            combinedNestedDescriptorFailure.errors[0] ===
              nestedDescriptorPrimary &&
            combinedNestedDescriptorFailure.errors[1] ===
              nestedResidentCloseFailure &&
            combinedNestedDescriptorFailure.errors[2] ===
              nestedOwnerCloseFailure,
        ],
      ]),
      {
        nestedResidentFailureInjected: true,
        combinedNestedDescriptorFailureInstanceof: true,
        combinedNestedDescriptorFailureCount: true,
        combinedNestedDescriptorFailureErrors: true,
        combinedNestedDescriptorFailureErrors2: true,
        combinedNestedDescriptorFailureErrors3: true,
      },
    );

    const closeTargetBase = path.join(base, "close-target-scaffold");
    const closeTarget = path.join(closeTargetBase, "owned.txt");
    const parkedCloseTarget = path.join(base, "close-target-original.txt");
    let closeTargetSwapped = false;
    let closeTargetDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === closeTarget &&
        flags === "wx+"
      )
        closeTargetDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === closeTargetDescriptor) {
        nativeRename(closeTarget, parkedCloseTarget);
        Reflect.apply(nativeWriteFile, mutableFs, [
          closeTarget,
          "successor generation",
          "utf8",
        ]);
        closeTargetSwapped = true;
      }
    }) as typeof fs.closeSync;
    let closeTargetRejected = false;
    let closeTargetCleanupFailure: { error: unknown } | undefined;
    try {
      closeTargetRejected = throws(() =>
        writeFiles(closeTargetBase, { "owned.txt": "scaffold generation" }),
      );
    } catch (error) {
      closeTargetCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(closeTargetCleanupFailure, [
        {
          resource: "scaffold close target open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold close target close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold materialization rejects a target successor installed at close",
      namedFacts([
        ["closeTargetSwapped", () => closeTargetSwapped],
        ["closeTargetRejected", () => closeTargetRejected],
        [
          "closeTargetUtf8",
          () => fs.readFileSync(closeTarget, "utf8") === "successor generation",
        ],
        [
          "parkedCloseTargetUtf8",
          () =>
            fs.readFileSync(parkedCloseTarget, "utf8") ===
            "scaffold generation",
        ],
      ]),
      {
        closeTargetSwapped: true,
        closeTargetRejected: true,
        closeTargetUtf8: true,
        parkedCloseTargetUtf8: true,
      },
    );

    const forceCloseTargetBase = path.join(base, "force-close-target-scaffold");
    const forceCloseTarget = path.join(forceCloseTargetBase, "owned.txt");
    const parkedForceCloseTarget = path.join(
      base,
      "force-close-target-original.txt",
    );
    fs.mkdirSync(forceCloseTargetBase);
    fs.writeFileSync(forceCloseTarget, "original generation");
    let forceCloseTargetSwapped = false;
    let forceCloseTargetDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === forceCloseTarget &&
        flags === "r+"
      )
        forceCloseTargetDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === forceCloseTargetDescriptor) {
        nativeRename(forceCloseTarget, parkedForceCloseTarget);
        nativeWriteFile(forceCloseTarget, "successor generation");
        forceCloseTargetSwapped = true;
      }
    }) as typeof fs.closeSync;
    let forceCloseTargetRejected = false;
    let forceCloseTargetCleanupFailure: { error: unknown } | undefined;
    try {
      forceCloseTargetRejected = throws(() =>
        writeFiles(
          forceCloseTargetBase,
          { "owned.txt": "forced scaffold generation" },
          { force: true },
        ),
      );
    } catch (error) {
      forceCloseTargetCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(forceCloseTargetCleanupFailure, [
        {
          resource: "scaffold force close target open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold force close target close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "forced scaffold materialization rejects a target successor installed at close",
      namedFacts([
        ["forceCloseTargetSwapped", () => forceCloseTargetSwapped],
        ["forceCloseTargetRejected", () => forceCloseTargetRejected],
        [
          "forceCloseTargetUtf8",
          () =>
            fs.readFileSync(forceCloseTarget, "utf8") ===
            "successor generation",
        ],
        [
          "parkedForceCloseTargetUtf8",
          () =>
            fs.readFileSync(parkedForceCloseTarget, "utf8") ===
            "forced scaffold generation",
        ],
      ]),
      {
        forceCloseTargetSwapped: true,
        forceCloseTargetRejected: true,
        forceCloseTargetUtf8: true,
        parkedForceCloseTargetUtf8: true,
      },
    );

    const closeParentBase = path.join(base, "close-parent-scaffold");
    const closeParent = path.join(closeParentBase, "nested");
    const closeParentTarget = path.join(closeParent, "owned.txt");
    const parkedCloseParent = `${closeParent}.parked`;
    let closeParentSwapped = false;
    let closeParentDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === closeParentTarget &&
        flags === "wx+"
      )
        closeParentDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === closeParentDescriptor) {
        nativeRename(closeParent, parkedCloseParent);
        fs.symlinkSync(parkedCloseParent, closeParent, "junction");
        closeParentSwapped = true;
      }
    }) as typeof fs.closeSync;
    let closeParentRejected = false;
    let closeParentCleanupFailure: { error: unknown } | undefined;
    try {
      closeParentRejected = throws(() =>
        writeFiles(closeParentBase, {
          "nested/owned.txt": "scaffold generation",
        }),
      );
    } catch (error) {
      closeParentCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(closeParentCleanupFailure, [
        {
          resource: "scaffold close parent open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold close parent close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold materialization rejects a parent successor installed at close",
      namedFacts([
        ["closeParentSwapped", () => closeParentSwapped],
        ["closeParentRejected", () => closeParentRejected],
        [
          "closeParentIsSymbolicLink",
          () => fs.lstatSync(closeParent).isSymbolicLink(),
        ],
        [
          "closeParentTargetUtf8",
          () =>
            fs.readFileSync(closeParentTarget, "utf8") ===
            "scaffold generation",
        ],
        [
          "parkedCloseParentOwned",
          () =>
            fs.readFileSync(
              path.join(parkedCloseParent, "owned.txt"),
              "utf8",
            ) === "scaffold generation",
        ],
      ]),
      {
        closeParentSwapped: true,
        closeParentRejected: true,
        closeParentIsSymbolicLink: true,
        closeParentTargetUtf8: true,
        parkedCloseParentOwned: true,
      },
    );

    const closeRootBase = path.join(base, "close-root-scaffold");
    const closeRootTarget = path.join(closeRootBase, "owned.txt");
    const parkedCloseRoot = `${closeRootBase}.parked`;
    let closeRootSwapped = false;
    let closeRootDescriptor = -1;
    mutableFs.openSync = ((file, flags, ...args: unknown[]): number => {
      const descriptor = Reflect.apply(nativeOpen, mutableFs, [
        file,
        flags,
        ...args,
      ]) as number;
      if (
        typeof file !== "number" &&
        path.resolve(file.toString()) === closeRootTarget &&
        flags === "wx+"
      )
        closeRootDescriptor = descriptor;
      return descriptor;
    }) as typeof fs.openSync;
    mutableFs.closeSync = ((descriptor: number): void => {
      Reflect.apply(nativeClose, mutableFs, [descriptor]);
      if (descriptor === closeRootDescriptor) {
        nativeRename(closeRootBase, parkedCloseRoot);
        fs.symlinkSync(parkedCloseRoot, closeRootBase, "junction");
        closeRootSwapped = true;
      }
    }) as typeof fs.closeSync;
    let closeRootRejected = false;
    let closeRootCleanupFailure: { error: unknown } | undefined;
    try {
      closeRootRejected = throws(() =>
        writeFiles(closeRootBase, { "owned.txt": "scaffold generation" }),
      );
    } catch (error) {
      closeRootCleanupFailure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(closeRootCleanupFailure, [
        {
          resource: "scaffold close root open hook",
          cleanup: () => {
            mutableFs.openSync = nativeOpen;
          },
        },
        {
          resource: "scaffold close root close hook",
          cleanup: () => {
            mutableFs.closeSync = nativeClose;
          },
        },
      ]);
    }
    TestValidator.equals(
      "scaffold materialization rejects a root successor installed at close",
      namedFacts([
        ["closeRootSwapped", () => closeRootSwapped],
        ["closeRootRejected", () => closeRootRejected],
        [
          "closeRootBaseIsSymbolicLink",
          () => fs.lstatSync(closeRootBase).isSymbolicLink(),
        ],
        [
          "closeRootTargetUtf8",
          () =>
            fs.readFileSync(closeRootTarget, "utf8") === "scaffold generation",
        ],
        [
          "parkedCloseRootOwned",
          () =>
            fs.readFileSync(path.join(parkedCloseRoot, "owned.txt"), "utf8") ===
            "scaffold generation",
        ],
      ]),
      {
        closeRootSwapped: true,
        closeRootRejected: true,
        closeRootBaseIsSymbolicLink: true,
        closeRootTargetUtf8: true,
        parkedCloseRootOwned: true,
      },
    );
  } catch (error) {
    scaffoldFailure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      scaffoldFailure,
      () => fs.rmSync(base, { recursive: true, force: true }),
      "scaffold fixture root",
    );
  }
};
