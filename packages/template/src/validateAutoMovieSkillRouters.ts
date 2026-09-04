import fs from "node:fs";
import path from "node:path";

/**
 * One synthetic project-root-relative Markdown source.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Represents one addressable instruction source for deterministic route validation.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Keeps validation independent of the host filesystem when callers already own the candidate publication.
 * @author Samchon
 */
export interface IAutoMovieInstructionMarkdownSource {
  /** Project-root-relative POSIX path. */
  path: string;
  /** Exact Markdown bytes. */
  content: string;
}

/**
 * Resolve one instruction link against a complete synthetic publication.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Refuses links whose advertised instruction target or heading cannot be discovered.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Enforces one project-root boundary over both installed routers and runtime diagnostic references.
 */
export const validateAutoMovieInstructionLink = (
  sources: readonly IAutoMovieInstructionMarkdownSource[],
  sourcePath: string,
  destination: string,
): void => {
  const files = new Map(
    sources.map((source) => [normalizeSourcePath(source.path), source.content]),
  );
  const source = normalizeSourcePath(sourcePath);
  if (!files.has(source))
    throw new Error(`${source}: instruction route source is not published.`);
  if (/^[A-Za-z]:[\\/]/u.test(destination))
    throw new Error(
      `${source}: instruction route escapes its project root: ${destination}.`,
    );
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(destination)) return;
  const [encodedRoute, encodedAnchor] = destination.split("#", 2);
  const route = decodeURIComponent(encodedRoute ?? "");
  const anchor =
    encodedAnchor === undefined ? undefined : decodeURIComponent(encodedAnchor);
  const resolved =
    route === ""
      ? source
      : path.posix.normalize(
          path.posix.join(path.posix.dirname(source), route),
        );
  if (
    resolved === ".." ||
    resolved.startsWith("../") ||
    path.posix.isAbsolute(route)
  )
    throw new Error(
      `${source}: instruction route escapes its project root: ${destination}.`,
    );
  const target = files.get(resolved);
  const directory = [...files.keys()].some((candidate) =>
    candidate.startsWith(`${resolved.replace(/\/$/u, "")}/`),
  );
  if (target === undefined && !directory)
    throw new Error(
      `${source}: instruction route targets missing target ${destination}.`,
    );
  if (anchor !== undefined && anchor !== "") {
    if (target === undefined)
      throw new Error(
        `${source}: instruction anchor targets a directory: ${destination}.`,
      );
    if (!markdownAnchors(target).has(anchor))
      throw new Error(
        `${source}: instruction route targets missing anchor ${destination}.`,
      );
  }
};

/**
 * Validate every installed `SKILL.md` as an H1-only root-bound router.
 *
 * Link resolution is performed over an explicit source population so missing
 * files, missing anchors, and root escapes are ordinary deterministic cases.
 * A directory route is accepted only when at least one source is resident
 * below that directory.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Refuses an instruction entry point that cannot reach the procedure it advertises.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Keeps every shipped authoring route inside the generated project's complete instruction and contract source population.
 */
export const validateAutoMovieSkillRouterLinks = (
  sources: readonly IAutoMovieInstructionMarkdownSource[],
): void => {
  const files = new Map(
    sources.map((source) => [normalizeSourcePath(source.path), source.content]),
  );
  const routers = [...files].filter(([file]) => file.endsWith("/SKILL.md"));
  if (routers.length === 0) throw new Error("no SKILL.md router is installed.");
  for (const [file, markdown] of routers) {
    const headings = visibleLines(markdown).filter((line) =>
      /^#{1,6}\s+\S/u.test(line),
    );
    if (headings.length !== 1 || !headings[0]!.startsWith("# "))
      throw new Error(
        `${file}: every SKILL.md is an H1-only index and router.`,
      );
    for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu))
      validateAutoMovieInstructionLink(sources, file, match[1]!);
  }
};

/**
 * Validate the physical scaffold source before publishing any instruction.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Refuses a physical shipped router that cannot discover its promised procedure.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Applies the synthetic publication boundary to the exact scaffold bytes before they are copied.
 */
export const validateAutoMovieSkillRouters = (root: string): void => {
  const boundary = path.resolve(root);
  const sources: IAutoMovieInstructionMarkdownSource[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(
          `${target}: instruction sources may not contain links.`,
        );
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith(".md"))
        sources.push({
          path: path.relative(boundary, target).replaceAll("\\", "/"),
          content: fs.readFileSync(target, "utf8"),
        });
    }
  };
  visit(boundary);
  validateAutoMovieSkillRouterLinks(sources);
};

const markdownAnchors = (markdown: string): ReadonlySet<string> => {
  const anchors = new Set(
    [...markdown.matchAll(/\{#([^{}\s]+)\}/gu)].map((entry) => entry[1]!),
  );
  const occurrences = new Map<string, number>();
  for (const line of visibleLines(markdown)) {
    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line);
    if (match === null) continue;
    const base = match[1]!
      .replace(/\s+\{#[^{}\s]+\}\s*$/u, "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, (character) =>
        character === "_" ? "_" : "",
      )
      .replace(/\s+/gu, "-");
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    anchors.add(occurrence === 0 ? base : `${base}-${occurrence}`);
  }
  return anchors;
};

const normalizeSourcePath = (value: string): string => {
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  )
    throw new Error(
      `${value}: instruction source path must stay inside the project root.`,
    );
  return normalized;
};

const visibleLines = (markdown: string): readonly string[] => {
  let fenced = false;
  let comment = false;
  return markdown.split(/\r?\n/u).map((line) => {
    if (/^\s*(```|~~~)/u.test(line)) {
      fenced = !fenced;
      return "";
    }
    if (fenced) return "";
    const projected = line.replace(/<!--[\s\S]*?-->/gu, "");
    if (comment) {
      if (line.includes("-->")) comment = false;
      return "";
    }
    if (line.includes("<!--") && !line.includes("-->")) comment = true;
    return projected;
  });
};
