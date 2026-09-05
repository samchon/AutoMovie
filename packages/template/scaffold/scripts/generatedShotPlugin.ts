import type { IAutoMovieDeliveryCrop } from "@automovie/interface";
import {
  AutoMovieProductionProject,
  parseAutoMovieStructuredJson,
  productionFilmEffectEditFingerprint,
  readAutoMovieFilmEffects,
  readAutoMovieFilmTimeline,
  sampleProductionFilmEffects,
} from "@automovie/production";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

import { readProductionLiveWearableSoftBodies } from "./productionConfiguration";
import {
  type IAutoMovieProductionDialogueRuntime,
  cloneProductionDeliveryCrop,
  cloneProductionDialogueRuntime,
} from "./productionRuntimeState";

/** Invocation-owned state exposed to the viewer middleware. */
export interface IGeneratedShotRuntimeProvider {
  dialogue: () => IAutoMovieProductionDialogueRuntime | null;
  deliveryCrop: () => IAutoMovieDeliveryCrop | null;
  prepare?: () => Promise<unknown>;
}

const NO_DIALOGUE_RUNTIME: IGeneratedShotRuntimeProvider = {
  dialogue: () => null,
  deliveryCrop: () => null,
};

/**
 * The compiler-owned output root and the asset provenance ledger this project
 * carries.
 *
 * Both are the harness ownership layout every AutoMovie project shares rather
 * than anything this project declares, so the viewer route names them directly.
 * They were read out of a per-project manifest until that file became one copy
 * of a constant no project may vary, and reading a retired layout record here
 * would keep the old shape alive for exactly one consumer.
 */
const COMPILER_OWNED_ROOT = "generated";
const ASSET_MANIFEST_PATH = "automovie/assets.json";

/**
 * Serve bounded compiler-owned viewer JSON and registered model bytes.
 *
 * This middleware gives compiler-owned output an explicit no-cache route and
 * exposes only shots, models, the film timeline, and digest-matching physical
 * assets present in a current compiled model closure without opening arbitrary
 * project files.
 */
export const generatedShotPlugin = (
  projectRoot: string,
  productionId: string,
  runtimeProvider: IGeneratedShotRuntimeProvider = NO_DIALOGUE_RUNTIME,
): Plugin => ({
  name: "automovie-generated-shot",
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      if (
        request.url?.split("?", 1)[0] === "/__automovie/production-runtime.json"
      ) {
        void Promise.resolve()
          .then(() => runtimeProvider.prepare?.())
          .then(() => {
            const project = AutoMovieProductionProject.openReadOnly(
              projectRoot,
              productionId,
            );
            const manifest = project.generatedManifest();
            if (manifest === null)
              throw new Error(
                "Production runtime requires current compiler-owned artifacts.",
              );
            const production = project.graph().production;
            if (production === null)
              throw new Error(
                "Production runtime requires a current production design.",
              );
            const timeline = readAutoMovieFilmTimeline(
              project,
              manifest.inputFingerprint,
            );
            const filmEffectIdentity = {
              production: production.id,
              film: timeline.id,
              compileFingerprint: manifest.inputFingerprint,
              editFingerprint: productionFilmEffectEditFingerprint(timeline),
            };
            const filmEffects = readAutoMovieFilmEffects(
              project,
              manifest.inputFingerprint,
            );
            sampleProductionFilmEffects({
              identity: filmEffectIdentity,
              effects: filmEffects,
              timelineFrame: 0,
            });
            const runtime = {
              dialogue: cloneProductionDialogueRuntime(
                runtimeProvider.dialogue(),
              ),
              deliveryCrop: cloneProductionDeliveryCrop(
                runtimeProvider.deliveryCrop(),
              ),
              liveWearableSoftBodies: readProductionLiveWearableSoftBodies(
                production.simulation?.liveWearableSoftBodies ?? [],
              ),
              filmEffects,
              filmEffectIdentity,
            };
            response.statusCode = 200;
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.setHeader("Cache-Control", "no-store");
            response.end(Buffer.from(`${JSON.stringify(runtime)}\n`, "utf8"));
          })
          .catch((error: unknown) => {
            response.statusCode = 503;
            response.setHeader("Content-Type", "text/plain; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(
              `Production viewer runtime preparation failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          });
        return;
      }
      let asset: string | null;
      try {
        asset = viewerAssetRoute(request.url);
      } catch {
        response.statusCode = 400;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("invalid registered asset request");
        return;
      }
      if (asset !== null) {
        try {
          const bytes = readRegisteredAsset(projectRoot, productionId, asset);
          response.statusCode = 200;
          response.setHeader("Content-Type", assetMediaType(asset));
          response.setHeader("Cache-Control", "no-store");
          response.end(bytes);
        } catch (error) {
          const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
          response.statusCode = missing ? 404 : 400;
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          response.end(
            missing
              ? "registered asset not found"
              : "invalid registered asset request",
          );
        }
        return;
      }
      let route: string[] | null;
      try {
        route = viewerArtifactRoute(request.url);
      } catch {
        response.statusCode = 400;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end("invalid compiled viewer artifact request");
        return;
      }
      if (route === null) {
        next();
        return;
      }
      try {
        const project = physicalDirectory(projectRoot, "viewer project root");
        if (
          productionId.trim().length === 0 ||
          productionId.trim() !== productionId
        )
          throw new Error("invalid production id");
        const generatedRoot = path.resolve(
          project.real,
          COMPILER_OWNED_ROOT,
          encodePathSegment(productionId),
        );
        const relativeRoot = path.relative(project.real, generatedRoot);
        if (
          relativeRoot === "" ||
          relativeRoot === ".." ||
          relativeRoot.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeRoot)
        )
          throw new Error("generated root escapes project");
        const generated = physicalDirectory(
          generatedRoot,
          "generated viewer root",
        );
        if (isInside(project.real, generated.real) === false)
          throw new Error("generated root is not a physical project directory");
        const file = path.join(generated.real, ...route);
        const bytes = readPhysicalFile(
          project,
          path.dirname(file),
          path.basename(file),
        );
        assertPhysicalDirectory(generated, "generated viewer root");
        assertPhysicalDirectory(project, "viewer project root");
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(bytes);
      } catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
        response.statusCode = missing ? 404 : 400;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(
          missing
            ? "compiled viewer artifact not found"
            : "invalid compiled viewer artifact request",
        );
      }
    });
  },
});

const viewerArtifactRoute = (url: string | undefined): string[] | null => {
  const pathname = url?.split("?", 1)[0];
  if (pathname === "/__automovie/film.json") return ["film-timeline.json"];
  const match = pathname?.match(
    /^\/__automovie\/(shots|models)\/([^/]+)\.json$/u,
  );
  if (match === null || match === undefined) return null;
  const id = decodeURIComponent(match[2]!);
  if (id.trim().length === 0 || id !== id.trim())
    throw new Error("invalid viewer artifact id");
  return [match[1]!, `${encodePathSegment(id)}.json`];
};

const viewerAssetRoute = (url: string | undefined): string | null => {
  const pathname = url?.split("?", 1)[0];
  const prefix = "/__automovie/assets/";
  if (pathname?.startsWith(prefix) !== true) return null;
  const raw = pathname.slice(prefix.length);
  const segments = raw.split("/").map((segment) => decodeURIComponent(segment));
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("/"),
    )
  )
    throw new Error("invalid registered asset path");
  return segments.join("/");
};

const readRegisteredAsset = (
  projectRoot: string,
  productionId: string,
  assetPath: string,
): Buffer => {
  const project = physicalDirectory(projectRoot, "viewer project root");
  const authorization = readAssetAuthorization(
    project,
    productionId,
    assetPath,
  );
  const file = path.resolve(project.real, ...assetPath.split("/"));
  const relative = path.relative(project.real, file);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("asset escapes project");
  const asset = readPhysicalFileSnapshot(
    project,
    path.dirname(file),
    path.basename(file),
  );
  const digest = `sha256:${createHash("sha256")
    .update(asset.bytes)
    .digest("hex")}`;
  if (authorization.registeredDigest !== digest)
    throw new Error("asset bytes do not match registered digest");
  assertAssetAuthorization(authorization);
  const confirmed = readAssetAuthorization(project, productionId, assetPath);
  if (
    confirmed.fingerprint !== authorization.fingerprint ||
    confirmed.registeredDigest !== authorization.registeredDigest
  )
    throw new Error("registered asset authorization changed while read");
  assertAssetAuthorization(confirmed);
  assertPhysicalFile(asset);
  assertPhysicalDirectory(project, "viewer project root");
  return asset.bytes;
};

const readAssetAuthorization = (
  project: IPhysicalDirectory,
  productionId: string,
  assetPath: string,
): IAssetAuthorization => {
  const ledgerPath = path.resolve(project.real, ASSET_MANIFEST_PATH);
  if (isInside(project.real, ledgerPath) === false)
    throw new Error("asset manifest escapes project");
  const ledgerFile = readPhysicalFileSnapshot(
    project,
    path.dirname(ledgerPath),
    path.basename(ledgerPath),
  );
  const ledger = parseAutoMovieStructuredJson({
    record: "asset-ledger",
    bytes: ledgerFile.bytes,
  }) as {
    version?: unknown;
    assets?: unknown;
  };
  if (ledger.version !== 1 || Array.isArray(ledger.assets) === false)
    throw new Error("invalid asset manifest");
  const record = ledger.assets.find(
    (candidate): candidate is { path: string; digest: string } =>
      candidate !== null &&
      typeof candidate === "object" &&
      "path" in candidate &&
      "digest" in candidate &&
      (candidate as { path?: unknown }).path === assetPath &&
      typeof (candidate as { digest?: unknown }).digest === "string",
  );
  if (record === undefined)
    throw new Error("asset is not registered in the byte ledger");
  const compiled = readCompiledAssetClosure(
    project,
    productionId,
    COMPILER_OWNED_ROOT,
  );
  const compiledDigest = compiled.closure.get(assetPath);
  if (compiledDigest === undefined || compiledDigest !== record.digest)
    throw new Error(
      "asset is not in the current compiler-sealed viewer closure",
    );
  const files = [ledgerFile, ...compiled.files];
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        files: files.map((file) => ({
          digest: createHash("sha256").update(file.bytes).digest("hex"),
          identity: file.identity,
          path: path.relative(project.real, file.path),
        })),
        inventory: compiled.inventory,
        models: {
          path: path.relative(project.real, compiled.models.real),
          version: compiled.models.version,
        },
        registeredDigest: record.digest,
      }),
    )
    .digest("hex");
  const authorization: IAssetAuthorization = {
    files,
    fingerprint,
    inventory: compiled.inventory,
    models: compiled.models,
    project,
    registeredDigest: record.digest,
  };
  assertAssetAuthorization(authorization);
  return authorization;
};

const readCompiledAssetClosure = (
  project: IPhysicalDirectory,
  productionId: string,
  generatedRoot: string,
): ICompiledAssetClosure => {
  if (productionId.trim().length === 0 || productionId !== productionId.trim())
    throw new Error("invalid compiled asset closure owner");
  const modelsRoot = path.resolve(
    project.real,
    generatedRoot,
    encodePathSegment(productionId),
    "models",
  );
  if (isInside(project.real, modelsRoot) === false)
    throw new Error("compiled model root escapes project");
  const models = physicalDirectory(modelsRoot, "compiled model root");
  if (isInside(project.real, models.real) === false)
    throw new Error("compiled model root is not a physical project directory");
  const closure = new Map<string, string>();
  const inventory = compiledModelInventory(models);
  const files: IPhysicalFileSnapshot[] = [];
  for (const name of inventory) {
    const file = readPhysicalFileSnapshot(project, models.real, name);
    files.push(file);
    const model = parseAutoMovieStructuredJson({
      record: "compiled-model",
      bytes: file.bytes,
    }) as {
      imported?: { assets?: unknown };
    };
    if (model.imported === undefined) continue;
    if (Array.isArray(model.imported.assets) === false)
      throw new Error("imported model has no sealed asset closure");
    for (const value of model.imported.assets) {
      if (
        value === null ||
        typeof value !== "object" ||
        typeof (value as { path?: unknown }).path !== "string" ||
        typeof (value as { digest?: unknown }).digest !== "string"
      )
        throw new Error("imported model has an invalid asset closure entry");
      const item = value as { path: string; digest: string };
      const prior = closure.get(item.path);
      if (prior !== undefined && prior !== item.digest)
        throw new Error("compiled asset closure has conflicting digests");
      closure.set(item.path, item.digest);
    }
  }
  if (
    JSON.stringify(compiledModelInventory(models)) !== JSON.stringify(inventory)
  )
    throw new Error("compiled model inventory changed while read");
  assertPhysicalDirectory(models, "compiled model root");
  assertPhysicalDirectory(project, "viewer project root");
  return { closure, files, inventory, models };
};

const compiledModelInventory = (models: IPhysicalDirectory): string[] =>
  fs
    .readdirSync(models.real, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.isSymbolicLink() === false &&
        path.extname(entry.name).toLowerCase() === ".json",
    )
    .map((entry) => entry.name)
    .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

const assertAssetAuthorization = (authorization: IAssetAuthorization): void => {
  for (const file of authorization.files) assertPhysicalFile(file);
  if (
    JSON.stringify(compiledModelInventory(authorization.models)) !==
    JSON.stringify(authorization.inventory)
  )
    throw new Error("compiled model inventory changed while authorized");
  assertPhysicalDirectory(authorization.models, "compiled model root");
  assertPhysicalDirectory(authorization.project, "viewer project root");
};

const assetMediaType = (assetPath: string): string => {
  switch (path.posix.extname(assetPath).toLowerCase()) {
    case ".gltf":
      return "model/gltf+json";
    case ".json":
      return "application/json; charset=utf-8";
    case ".glb":
    case ".vrm":
      return "model/gltf-binary";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
};

const encodePathSegment = (value: string): string => {
  let encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
  if (
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|conin\$|conout\$)(?:\.|$)/i.test(
      encoded,
    )
  )
    encoded = `%${encoded
      .charCodeAt(0)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0")}${encoded.slice(1)}`;
  if (Buffer.byteLength(encoded, "utf8") > 180)
    encoded = `~sha256-${createHash("sha256")
      .update(Buffer.from(value, "utf8"))
      .digest("hex")}`;
  return encoded;
};

const isInside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};

interface IPhysicalDirectory {
  device: string;
  inode: string;
  path: string;
  real: string;
  version: string;
}

interface IViewerFileDescriptorFailure {
  error: unknown;
}

class ViewerFileDescriptorCleanupError extends AggregateError {}

/** Close one viewer-file descriptor without hiding either failure. */
const closeViewerFileDescriptor = (
  descriptor: number,
  failure: IViewerFileDescriptorFailure | undefined,
): void => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new ViewerFileDescriptorCleanupError(
      [failure.error, closeFailure],
      "Viewer file descriptor cleanup failed after the read failed.",
    );
  }
};

interface IPhysicalFileSnapshot {
  bytes: Buffer;
  directories: readonly IPhysicalDirectory[];
  identity: string;
  path: string;
}

interface ICompiledAssetClosure {
  closure: Map<string, string>;
  files: IPhysicalFileSnapshot[];
  inventory: string[];
  models: IPhysicalDirectory;
}

interface IAssetAuthorization {
  files: readonly IPhysicalFileSnapshot[];
  fingerprint: string;
  inventory: readonly string[];
  models: IPhysicalDirectory;
  project: IPhysicalDirectory;
  registeredDigest: string;
}

const physicalDirectory = (
  directory: string,
  label: string,
): IPhysicalDirectory => {
  const namespacePath = path.resolve(directory);
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`${label} is not a physical directory`);
  const real = fs.realpathSync(namespacePath);
  const status = fs.statSync(real, { bigint: true });
  const linkedVersion = physicalVersion(linked);
  const statusVersion = physicalVersion(status);
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino ||
    statusVersion !== linkedVersion
  )
    throw new Error(`${label} is not a physical directory`);
  return {
    device: status.dev.toString(),
    inode: status.ino.toString(),
    path: namespacePath,
    real,
    version: statusVersion,
  };
};

const assertPhysicalDirectory = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (
    current.device !== expected.device ||
    current.inode !== expected.inode ||
    current.real !== expected.real ||
    current.version !== expected.version
  )
    throw new Error(`${label} changed physical identity`);
};

const readPhysicalFile = (
  root: IPhysicalDirectory,
  directory: string,
  name: string,
): Buffer => readPhysicalFileSnapshot(root, directory, name).bytes;

export const readPhysicalFileSnapshot = (
  root: IPhysicalDirectory,
  directory: string,
  name: string,
): IPhysicalFileSnapshot => {
  assertPhysicalDirectory(root, "viewer project root");
  const owner = path.resolve(directory);
  if (
    isInside(root.real, owner) === false ||
    name.length === 0 ||
    path.basename(name) !== name
  )
    throw new Error("viewer file escapes its physical owner");
  const relativeOwner = path.relative(root.real, owner);
  const directories = [root];
  let cursor = root.real;
  for (const segment of relativeOwner.length === 0
    ? []
    : relativeOwner.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const identity = physicalDirectory(cursor, "viewer file ancestry");
    if (isInside(root.real, identity.real) === false)
      throw new Error("viewer file ancestry escapes its physical owner");
    directories.push(identity);
  }
  const file = path.join(owner, name);
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error("viewer file is not one physical owned file");
  const identity = physicalVersion(linked);
  const descriptor = fs.openSync(file, "r");
  let failure: IViewerFileDescriptorFailure | undefined;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    // A pathname stat and a descriptor stat are two different sources and do
    // not agree on every field. On Windows the two read the volume serial
    // through different APIs, and a resident, unmodified artifact was
    // observed reporting different devices from the same file: the drift the
    // scaffold contract reports for this read is `dev`. The file id is what
    // both sources agree on, so bind them by it and compare a full version
    // only against another reading of the same source.
    if (opened.isFile() === false || opened.ino !== linked.ino)
      throw new Error("viewer file changed physical identity before open");
    const openedIdentity = physicalVersion(opened);
    const bytes = fs.readFileSync(descriptor);
    const completed = fs.fstatSync(descriptor, { bigint: true });
    const resident = fs.lstatSync(file, { bigint: true });
    if (
      completed.isFile() === false ||
      physicalVersion(completed) !== openedIdentity ||
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      resident.ino !== opened.ino ||
      physicalVersion(resident) !== identity
    )
      throw new Error("viewer file changed physical identity while read");
    for (const identity of directories)
      assertPhysicalDirectory(identity, "viewer file ancestry");
    return { bytes, directories, identity, path: file };
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeViewerFileDescriptor(descriptor, failure);
  }
};

const assertPhysicalFile = (expected: IPhysicalFileSnapshot): void => {
  const current = fs.lstatSync(expected.path, { bigint: true });
  if (
    current.isSymbolicLink() ||
    current.isFile() === false ||
    physicalVersion(current) !== expected.identity
  )
    throw new Error("viewer file changed physical identity after read");
  for (const directory of expected.directories)
    assertPhysicalDirectory(directory, "viewer file ancestry");
};

const physicalVersion = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;
