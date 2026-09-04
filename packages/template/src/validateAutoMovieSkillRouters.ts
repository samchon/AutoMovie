import { projectAutoMovieMarkdownSyntax } from "@automovie/evidence";
import path from "node:path";
import { isMap, parseDocument } from "yaml";

const AUTO_MOVIE_SKILL_NAMES = [
  "contract",
  "evidence-graph",
  "production-lifecycle",
  "review-verification",
  "source-authoring",
] as const;
const AUTO_MOVIE_SKILL_NAME_SET: ReadonlySet<string> = new Set(
  AUTO_MOVIE_SKILL_NAMES,
);

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
  const separator = destination.indexOf("#");
  const encodedRoute =
    separator === -1 ? destination : destination.slice(0, separator);
  const encodedAnchor =
    separator === -1 ? undefined : destination.slice(separator + 1);
  let route: string;
  let anchor: string | undefined;
  try {
    route = decodeURIComponent(encodedRoute);
    anchor =
      encodedAnchor === undefined
        ? undefined
        : decodeURIComponent(encodedAnchor);
  } catch {
    throw new Error(
      `${source}: instruction route is not valid percent-encoded text: ${destination}.`,
    );
  }
  if (path.win32.isAbsolute(route) || path.posix.isAbsolute(route))
    throw new Error(
      `${source}: instruction route escapes its project root: ${destination}.`,
    );
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/u.exec(route)?.[1];
  if (scheme !== undefined) {
    if (scheme.toLowerCase() === "http" || scheme.toLowerCase() === "https")
      return;
    throw new Error(
      `${source}: instruction route uses unsupported scheme ${scheme}: ${destination}.`,
    );
  }
  const portableRoute = route.replaceAll("\\", "/");
  const resolved =
    portableRoute === ""
      ? source
      : path.posix.normalize(
          path.posix.join(path.posix.dirname(source), portableRoute),
        );
  if (
    resolved === ".." ||
    resolved.startsWith("../") ||
    path.posix.isAbsolute(portableRoute)
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

/** Validate every Markdown link carried by one instruction document. */
export const validateAutoMovieInstructionDocumentLinks = (
  sources: readonly IAutoMovieInstructionMarkdownSource[],
  sourcePath: string,
): void => {
  const source = normalizeSourcePath(sourcePath);
  const markdown = sources.find(
    (candidate) => normalizeSourcePath(candidate.path) === source,
  )?.content;
  if (markdown === undefined)
    throw new Error(`${source}: instruction route source is not published.`);
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu))
    validateAutoMovieInstructionLink(sources, source, match[1]!);
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
  const files = new Map<string, string>();
  for (const source of sources) {
    const normalized = normalizeSourcePath(source.path);
    if (files.has(normalized))
      throw new Error(`${normalized}: instruction source is duplicated.`);
    files.set(normalized, source.content);
  }
  const skillFiles = [...files].filter(([file]) =>
    file.startsWith(".agents/skills/"),
  );
  const expected = new Set(
    AUTO_MOVIE_SKILL_NAMES.map((name) => `.agents/skills/${name}/SKILL.md`),
  );
  for (const [file] of skillFiles) {
    const name = file.split("/")[2];
    if (
      name === undefined ||
      !AUTO_MOVIE_SKILL_NAME_SET.has(name) ||
      (file.endsWith("/SKILL.md") && !expected.has(file))
    )
      throw new Error(`${file}: unexpected production skill path.`);
  }
  for (const file of expected) {
    const markdown = files.get(file);
    if (markdown === undefined)
      throw new Error(`${file}: required production skill router is missing.`);
    const name = file.split("/")[2]!;
    const body = validateSkillFrontmatter(file, markdown, name);
    const headings = visibleLines(body).filter((line) =>
      /^#{1,6}\s+\S/u.test(line),
    );
    if (headings.length !== 1 || !headings[0]!.startsWith("# "))
      throw new Error(
        `${file}: every SKILL.md is an H1-only index and router.`,
      );
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu))
      validateAutoMovieInstructionLink(sources, file, match[1]!);
  }
};

const markdownAnchors = (markdown: string): ReadonlySet<string> => {
  const anchors = new Set<string>();
  const occurrences = new Map<string, number>();
  for (const line of visibleLines(markdown)) {
    const match = /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line);
    if (match === null) continue;
    const explicit = /\s+\{#([^{}\s]+)\}\s*$/u.exec(match[1]!)?.[1];
    if (explicit !== undefined) anchors.add(explicit);
    const heading = match[1]!
      .replace(/\s+\{#[^{}\s]+\}\s*$/u, "")
      .trim()
      .toLowerCase();
    const base = [...heading]
      .filter(
        (character) =>
          character === "_" ||
          character === "-" ||
          /\p{L}|\p{N}|\s/u.test(character),
      )
      .join("")
      .replace(/\s+/gu, "-");
    const occurrence = occurrences.get(base) ?? 0;
    occurrences.set(base, occurrence + 1);
    anchors.add(occurrence === 0 ? base : `${base}-${occurrence}`);
  }
  return anchors;
};

const validateSkillFrontmatter = (
  file: string,
  markdown: string,
  expectedName: string,
): string => {
  const lines = markdown.split(/\r?\n/u);
  if (lines[0] !== "---")
    throw new Error(`${file}: production skill frontmatter is missing.`);
  const end = lines.indexOf("---", 1);
  if (end === -1)
    throw new Error(`${file}: production skill frontmatter is unterminated.`);
  const frontmatter = parseDocument(lines.slice(1, end).join("\n"), {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
  });
  const diagnostic = frontmatter.errors[0] ?? frontmatter.warnings[0];
  if (diagnostic !== undefined)
    throw new Error(
      `${file}: production skill frontmatter is invalid: ${diagnostic.message}`,
    );
  if (!isMap(frontmatter.contents))
    throw new Error(`${file}: production skill frontmatter must be a mapping.`);
  const name: unknown = frontmatter.contents.get("name");
  if (name !== expectedName)
    throw new Error(`${file}: production skill name must be ${expectedName}.`);
  const description: unknown = frontmatter.contents.get("description");
  if (typeof description !== "string" || description.trim() === "")
    throw new Error(`${file}: production skill description is missing.`);
  return lines.slice(end + 1).join("\n");
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
  return projectAutoMovieMarkdownSyntax({
    path: "instruction.md",
    source: markdown,
  }).visibleLines;
};
