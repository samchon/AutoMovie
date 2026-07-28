import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Serve only compiler-owned shot JSON through an explicit local route.
 *
 * This middleware gives compiler-owned output an explicit no-cache route and
 * exposes one bounded artifact family without opening arbitrary project files.
 */
export const generatedShotPlugin = (projectRoot: string): Plugin => ({
  name: "automovie-generated-shot",
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      const match = request.url?.match(
        /^\/__automovie\/shots\/([^/?]+)\.json(?:\?.*)?$/u,
      );
      if (match === null || match === undefined) {
        next();
        return;
      }
      try {
        const shotId = decodeURIComponent(match[1]!);
        if (shotId.trim().length === 0) throw new Error("invalid shot id");
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
        const generatedRoot = path.resolve(projectRoot, manifest.generatedRoot);
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
        const file = path.join(
          generatedReal,
          "shots",
          `${encodePathSegment(shotId)}.json`,
        );
        const fileStatus = fs.lstatSync(file);
        const fileReal = fs.realpathSync(file);
        if (
          fileStatus.isSymbolicLink() ||
          fileStatus.isFile() === false ||
          isInside(generatedReal, fileReal) === false
        )
          throw new Error("generated shot is not a physical owned file");
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
          missing ? "compiled shot not found" : "invalid compiled shot request",
        );
      }
    });
  },
});

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
