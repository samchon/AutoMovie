import * as fs from "node:fs";
import * as path from "node:path";

import { renderTemplate } from "./renderTemplate";
import { AUTOMOVIE_TEMPLATE_VERSIONS } from "./templateVersions";

/**
 * Files renamed as the scaffold is rendered. npm strips a real `.gitignore`
 * from a published package, so the asset ships as `gitignore` and the rendered
 * key restores the dot.
 */
const RENAME: Record<string, string> = { gitignore: ".gitignore" };

/** The values interpolated into the starter's `{{...}}` tokens. */
export interface IAutoMovieScaffoldProps {
  /** The created project's package name (replaces `{{name}}`). */
  name: string;
}

/**
 * Normalize `\r\n` → `\n` so the scaffold emits identical bytes on every host
 * (a Windows checkout with `core.autocrlf` would otherwise ship CRLF and drift
 * from the starter's own `lf` convention). The tree is text-only, so this is
 * unconditionally safe.
 */
const normalizeLineEndings = (content: string): string =>
  content.replaceAll("\r\n", "\n");

/** POSIX-slash a path so map keys are host-independent. */
const toPosix = (value: string): string => value.split(path.sep).join("/");

/** The rendered key for one scaffold-relative path (applies {@link RENAME}). */
const renderKey = (relative: string): string => {
  const dir = path.dirname(relative);
  const base = RENAME[path.basename(relative)] ?? path.basename(relative);
  return toPosix(dir === "." ? base : path.join(dir, base));
};

/** Every file under `root`, root-relative, in deterministic sorted order. */
const listFiles = (root: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full));
    }
  };
  walk(root);
  return out;
};

/**
 * Absolute path to the bundled starter assets, resolved relative to this module
 * so it works both from `src` (ttsx, in development) and the published `lib`
 * (the `scaffold/` folder ships alongside).
 */
export const scaffoldAssetDirectory = (): string => {
  const directory = path.resolve(__dirname, "..", "scaffold");
  if (!fs.existsSync(directory))
    throw new Error(`scaffold assets are missing: ${directory}`);
  return directory;
};

/**
 * Render the bundled starter into an in-memory `{ posixPath: content }` map —
 * read every asset, normalize line endings, substitute `{{name}}` and the
 * catalog-synced `{{version:*}}` tokens, and rename shipped-safe filenames.
 *
 * The map is deliberately not written to disk here (that is {@link writeFiles}'s
 * job): separating the render from the write mirrors the reference scaffolder,
 * so the same output can be asserted in a test, written by the CLI, or handed
 * to another consumer without disk I/O in the middle.
 *
 * @author Samchon
 */
export const renderScaffold = (
  props: IAutoMovieScaffoldProps,
): Record<string, string> => {
  const name = props.name.trim();
  if (name.length === 0) throw new Error("scaffold requires a project name");
  const variables: Record<string, string> = { name };
  for (const [key, value] of Object.entries(AUTOMOVIE_TEMPLATE_VERSIONS))
    variables[`version:${key}`] = value;

  const root = scaffoldAssetDirectory();
  const files: Record<string, string> = {};
  for (const relative of listFiles(root))
    files[renderKey(relative)] = renderTemplate(
      normalizeLineEndings(fs.readFileSync(path.join(root, relative), "utf8")),
      variables,
    );
  return files;
};
