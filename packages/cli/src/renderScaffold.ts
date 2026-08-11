import * as fs from "node:fs";
import * as path from "node:path";

import { renderTemplate } from "./renderTemplate";
import { AUTOMOVIE_TEMPLATE_VERSIONS } from "./templateVersions";

/**
 * Files renamed as the scaffold is rendered. npm strips real `.gitignore` and
 * `.npmrc` files from a published package, so the assets ship without dots and
 * the rendered keys restore them.
 */
const RENAME: Record<string, string> = {
  gitignore: ".gitignore",
  npmrc: ".npmrc",
};

/**
 * Project-owned values interpolated into the starter's `{{...}}` tokens.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Keeps the generated project's portable identity in explicit source input.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Carries that portable identity into deterministic scaffold derivation.
 */
export interface IAutoMovieScaffoldProps {
  /**
   * The created project's package name (replaces `{{name}}`).
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Restricts the name to a portable project identity rather than a host-private path.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Makes the project identity an explicit source input to scaffold derivation.
   */
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

/**
 * The rendered key for one scaffold-relative path.
 *
 * Production-owned prose uses `docs/{{name}}`, so path tokens receive the same
 * strict substitution and unknown-token failure as file payloads.
 */
const renderKey = (
  relative: string,
  variables: Readonly<Record<string, string>>,
): string => {
  const dir = path.dirname(relative);
  const base = RENAME[path.basename(relative)] ?? path.basename(relative);
  return renderTemplate(
    toPosix(dir === "." ? base : path.join(dir, base)),
    variables,
  );
};

/** Every file under `root`, root-relative, in deterministic sorted order. */
const listFiles = (root: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    // Code-unit order, not localeCompare: the file listing must be identical
    // on every host (localeCompare varies with host locale/ICU build).
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
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
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Locates the starter whose examples teach reusable authoring techniques instead of supplying finished production content.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes the capability-oriented starter as the input to deterministic scaffold rendering.
 */
export const scaffoldAssetDirectory = (): string => {
  const directory = path.resolve(__dirname, "..", "scaffold");
  if (!fs.existsSync(directory))
    throw new Error(`scaffold assets are missing: ${directory}`);
  return directory;
};

/**
 * Render the bundled starter into an in-memory `{ posixPath: content }` map:
 * read every asset, normalize line endings, substitute `{{name}}` and the
 * catalog-synced `{{version:*}}` tokens, and rename shipped-safe filenames.
 *
 * The map is deliberately not written to disk here (that is {@link writeFiles}'s
 * job): separating the render from the write mirrors the reference scaffolder,
 * so the same output can be asserted in a test, written by the CLI, or handed
 * to another consumer without disk I/O in the middle.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Delivers the starter examples that explain one reusable technique, its controls, and its verification path.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits examples as reusable authoring guidance while leaving each production's content in project-owned source.
 * @author Samchon
 */
export const renderScaffold = (
  props: IAutoMovieScaffoldProps,
): Record<string, string> => {
  const name = props.name.trim();
  if (name.length === 0) throw new Error("scaffold requires a project name");
  if (
    name === "." ||
    name === ".." ||
    name.endsWith(".") ||
    name.endsWith(" ") ||
    /[<>:"/\\|?*\u0000-\u001f]/u.test(name) ||
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)
  )
    throw new Error(
      `scaffold project name "${name}" must be one portable directory segment`,
    );
  const variables: Record<string, string> = { name };
  for (const [key, value] of Object.entries(AUTOMOVIE_TEMPLATE_VERSIONS))
    variables[`version:${key}`] = value;

  const root = scaffoldAssetDirectory();
  const files: Record<string, string> = {};
  for (const relative of listFiles(root))
    files[renderKey(relative, variables)] = renderTemplate(
      normalizeLineEndings(fs.readFileSync(path.join(root, relative), "utf8")),
      variables,
    );
  return files;
};
