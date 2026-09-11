import path from "node:path";
import type { WatchOptions } from "vite";

/** Exclude output before Chokidar opens handles; event filters are too late. */
export const viewerWatchOptions = (root: string): WatchOptions => ({
  ignored: (file) => isViewerWatchOutput(root, file),
  // Delay source notifications until an image or source save settles. This
  // does not protect fs.watch itself from busy output files; ignored does.
  awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 50 },
});

/** Reserved output owners, leaving assets and imported scratch source watched. */
export const isViewerWatchOutput = (root: string, file: string): boolean => {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (
    relative === "" ||
    relative.startsWith("../") ||
    path.isAbsolute(relative)
  )
    return false;
  const parts = relative.split("/");
  if (
    /^(generated|renders|reports|artifacts|lib|dist|cache|logs|coverage|test-results)$/.test(
      parts[0]!,
    ) ||
    parts.some((part) =>
      /^(node_modules|\.git|\.cache|\.vite|\.ttsc)$/.test(part),
    )
  )
    return true;
  if (parts[0] === "automovie" && parts.length > 1)
    return (
      /^(design|derived|contract-migrations)$/.test(parts[1]!) === false &&
      !(
        parts.length === 2 &&
        /^(assets|derived-artifacts|contracts-baseline)\.json$/.test(parts[1]!)
      )
    );
  const name = parts[parts.length - 1]!;
  return (
    /\.log$/.test(name) ||
    /^(\.automovie-liveness-|\.automovie-chunk-|\.gc-preserved-|\.ttsx-entry\.)/.test(
      name,
    ) ||
    /\.timestamp-\d+-[\da-f]+\.mjs$/.test(name)
  );
};
