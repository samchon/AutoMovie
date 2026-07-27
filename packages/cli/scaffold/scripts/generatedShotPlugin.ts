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
        if (
          shotId.trim().length === 0 ||
          shotId.includes("/") ||
          shotId.includes("\\")
        )
          throw new Error("invalid shot id");
        const file = path.join(
          projectRoot,
          "generated",
          "shots",
          `${encodeURIComponent(shotId)}.json`,
        );
        const bytes = fs.readFileSync(file);
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
