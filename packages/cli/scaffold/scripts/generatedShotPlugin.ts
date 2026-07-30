import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Serve bounded compiler-owned viewer JSON through explicit local routes.
 *
 * This middleware gives compiler-owned output an explicit no-cache route and
 * exposes only shots, models, and the film timeline without opening arbitrary
 * project files.
 */
export const generatedShotPlugin = (
  projectRoot: string,
  productionId: string,
): Plugin => ({
  name: "automovie-generated-shot",
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
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
