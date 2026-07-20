import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Materialize a `{ relativePath: content }` map under `location`, creating
 * parent directories as needed, and return the absolute paths written
 * (sorted).
 *
 * Refuses any entry that resolves outside `location` (a `../` escape in a map
 * key), and, unless `force`, refuses to write into a non-empty directory, so
 * a scaffold never silently clobbers an existing project. Rendering the file
 * map is {@link renderScaffold}'s job; this is the write half of that split.
 *
 * @author Samchon
 */
export const writeFiles = (
  location: string,
  files: Record<string, string>,
  options?: { force?: boolean },
): string[] => {
  const base = path.resolve(process.cwd(), location);
  if (
    fs.existsSync(base) &&
    fs.statSync(base).isDirectory() &&
    fs.readdirSync(base).length > 0 &&
    options?.force !== true
  )
    throw new Error(
      `target directory is not empty: ${base}; pass --force to scaffold into it anyway`,
    );

  const written: string[] = [];
  for (const [relative, content] of Object.entries(files)) {
    const target = path.resolve(base, relative);
    if (target !== base && !target.startsWith(base + path.sep))
      throw new Error(`refusing to write outside "${base}": ${relative}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    written.push(target);
  }
  // Code-unit order, not localeCompare: a scaffold must lay files down in the
  // same order on every host (localeCompare varies with host locale/ICU).
  return written.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};
