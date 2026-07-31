import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Serve bounded compiler-owned viewer JSON and registered model bytes.
 *
 * This middleware gives compiler-owned output an explicit no-cache route and
 * exposes only shots, models, the film timeline, and digest-matching physical
 * asset-ledger entries without opening arbitrary project files.
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
          const bytes = readRegisteredAsset(projectRoot, asset);
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
        const manifest = JSON.parse(
          fs.readFileSync(
            path.join(projectRoot, ".automovie", "manifest.json"),
            "utf8",
          ),
        ) as { generatedRoot?: unknown };
        if (
          typeof manifest.generatedRoot !== "string" ||
          manifest.generatedRoot.trim().length === 0
        )
          throw new Error("invalid generated root");
        const projectReal = fs.realpathSync(projectRoot);
        if (
          productionId.trim().length === 0 ||
          productionId.trim() !== productionId
        )
          throw new Error("invalid production id");
        const generatedRoot = path.resolve(
          projectRoot,
          manifest.generatedRoot,
          encodePathSegment(productionId),
        );
        const relativeRoot = path.relative(
          path.resolve(projectRoot),
          generatedRoot,
        );
        if (
          relativeRoot === "" ||
          relativeRoot === ".." ||
          relativeRoot.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeRoot)
        )
          throw new Error("generated root escapes project");
        const generatedStatus = fs.lstatSync(generatedRoot);
        const generatedReal = fs.realpathSync(generatedRoot);
        if (
          generatedStatus.isSymbolicLink() ||
          generatedStatus.isDirectory() === false ||
          isInside(projectReal, generatedReal) === false
        )
          throw new Error("generated root is not a physical project directory");
        const file = path.join(generatedReal, ...route);
        const fileStatus = fs.lstatSync(file);
        const fileReal = fs.realpathSync(file);
        if (
          fileStatus.isSymbolicLink() ||
          fileStatus.isFile() === false ||
          isInside(generatedReal, fileReal) === false
        )
          throw new Error("generated artifact is not a physical owned file");
        const bytes = fs.readFileSync(fileReal);
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
  assetPath: string,
): Buffer => {
  const ownership = JSON.parse(
    fs.readFileSync(
      path.join(projectRoot, ".automovie", "manifest.json"),
      "utf8",
    ),
  ) as { assetManifest?: unknown };
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
