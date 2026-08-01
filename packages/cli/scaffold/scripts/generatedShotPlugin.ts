import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

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
): Plugin => ({
  name: "automovie-generated-shot",
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
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
        const manifest = JSON.parse(
          readPhysicalFile(
            project,
            path.join(project.real, ".automovie"),
            "manifest.json",
          ).toString("utf8"),
        ) as { generatedRoot?: unknown };
        if (
          typeof manifest.generatedRoot !== "string" ||
          manifest.generatedRoot.trim().length === 0
        )
          throw new Error("invalid generated root");
        if (
          productionId.trim().length === 0 ||
          productionId.trim() !== productionId
        )
          throw new Error("invalid production id");
        const generatedRoot = path.resolve(
          project.real,
          manifest.generatedRoot,
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
  const ownership = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, ".automovie", "manifest.json"),
      "utf8",
    ),
  ) as { assetManifest?: unknown; generatedRoot?: unknown };
  if (
    typeof ownership.assetManifest !== "string" ||
    ownership.assetManifest.trim() === "" ||
    ownership.assetManifest !== ownership.assetManifest.trim()
  )
    throw new Error("project has no registered asset manifest");
  const ledgerPath = path.resolve(projectRoot, ownership.assetManifest);
  const projectReal = fs.realpathSync(projectRoot);
  const ledgerReal = fs.realpathSync(ledgerPath);
  if (isInside(projectReal, ledgerReal) === false)
    throw new Error("asset manifest escapes project");
  const ledger = JSON.parse(fs.readFileSync(ledgerReal, "utf8")) as {
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
  const compiledDigest = readCompiledAssetClosure(
    projectRoot,
    productionId,
    ownership.generatedRoot,
  ).get(assetPath);
  if (compiledDigest === undefined || compiledDigest !== record.digest)
    throw new Error(
      "asset is not in the current compiler-sealed viewer closure",
    );
  const file = path.resolve(projectRoot, ...assetPath.split("/"));
  const relative = path.relative(path.resolve(projectRoot), file);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error("asset escapes project");
  assertPhysicalPath(projectRoot, assetPath.split("/"));
  const fileReal = fs.realpathSync(file);
  if (isInside(projectReal, fileReal) === false)
    throw new Error("asset physical path escapes project");
  const bytes = fs.readFileSync(fileReal);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (record.digest !== digest)
    throw new Error("asset bytes do not match registered digest");
  return bytes;
};

const readCompiledAssetClosure = (
  projectRoot: string,
  productionId: string,
  generatedRootValue: unknown,
): Map<string, string> => {
  if (
    typeof generatedRootValue !== "string" ||
    generatedRootValue.trim().length === 0 ||
    productionId.trim().length === 0 ||
    productionId !== productionId.trim()
  )
    throw new Error("invalid compiled asset closure owner");
  const projectReal = fs.realpathSync(projectRoot);
  const modelsRoot = path.resolve(
    projectRoot,
    generatedRootValue,
    encodePathSegment(productionId),
    "models",
  );
  const modelsStatus = fs.lstatSync(modelsRoot);
  const modelsReal = fs.realpathSync(modelsRoot);
  if (
    modelsStatus.isSymbolicLink() ||
    modelsStatus.isDirectory() === false ||
    isInside(projectReal, modelsReal) === false
  )
    throw new Error("compiled model root is not a physical project directory");
  const closure = new Map<string, string>();
  for (const entry of fs.readdirSync(modelsReal, { withFileTypes: true })) {
    if (
      entry.isFile() === false ||
      entry.isSymbolicLink() ||
      path.extname(entry.name).toLowerCase() !== ".json"
    )
      continue;
    const file = path.join(modelsReal, entry.name);
    const fileReal = fs.realpathSync(file);
    if (isInside(modelsReal, fileReal) === false)
      throw new Error("compiled model artifact escapes its owned directory");
    const model = JSON.parse(fs.readFileSync(fileReal, "utf8")) as {
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
  return closure;
};

const assertPhysicalPath = (
  root: string,
  segments: readonly string[],
): void => {
  let cursor = path.resolve(root);
  for (const [index, segment] of segments.entries()) {
    cursor = path.join(cursor, segment);
    const status = fs.lstatSync(cursor);
    if (
      status.isSymbolicLink() ||
      (index === segments.length - 1
        ? status.isFile() === false
        : status.isDirectory() === false)
    )
      throw new Error("registered asset is not one physical project file");
  }
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
  real: string;
}

const physicalDirectory = (
  directory: string,
  label: string,
): IPhysicalDirectory => {
  const linked = fs.lstatSync(directory, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`${label} is not a physical directory`);
  const real = fs.realpathSync(directory);
  const status = fs.statSync(real, { bigint: true });
  if (status.isDirectory() === false)
    throw new Error(`${label} is not a physical directory`);
  return {
    device: status.dev.toString(),
    inode: status.ino.toString(),
    real,
  };
};

const assertPhysicalDirectory = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.real, label);
  if (
    current.device !== expected.device ||
    current.inode !== expected.inode ||
    current.real !== expected.real
  )
    throw new Error(`${label} changed physical identity`);
};

const readPhysicalFile = (
  root: IPhysicalDirectory,
  directory: string,
  name: string,
): Buffer => {
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
    directories.push(physicalDirectory(cursor, "viewer file ancestry"));
  }
  const file = path.join(owner, name);
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error("viewer file is not one physical owned file");
  const descriptor = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.isFile() === false ||
      opened.dev !== linked.dev ||
      opened.ino !== linked.ino
    )
      throw new Error("viewer file changed physical identity before open");
    const bytes = fs.readFileSync(descriptor);
    const resident = fs.lstatSync(file, { bigint: true });
    if (
      resident.isSymbolicLink() ||
      resident.isFile() === false ||
      resident.dev !== opened.dev ||
      resident.ino !== opened.ino
    )
      throw new Error("viewer file changed physical identity while read");
    for (const identity of directories)
      assertPhysicalDirectory(identity, "viewer file ancestry");
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
};
