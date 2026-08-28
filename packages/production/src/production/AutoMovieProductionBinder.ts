import * as fs from "node:fs/promises";
import * as path from "node:path";

const AUTHORED_DOCUMENT_LAYERS = [
  "briefs",
  "instances",
  "maps",
  "materials",
  "models",
  "motions",
  "research",
  "screenplays",
  "scripts",
  "settings",
  "spaces",
  "systems",
  "treatments",
] as const;

/**
 * Authored Markdown layers that may be bound for a human reader.
 *
 * The set spans all production shapes. Film narrative, direct brief, model,
 * motion, and built-environment work are different authored branches, but the
 * reader-facing transformation is the same for each one.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-inventory Makes every authored document family eligible for an explicit human-readable view.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-output Represents the authored document family selected for one deterministic deliverable item.
 */
export type AutoMovieAuthoredDocumentLayer =
  (typeof AUTHORED_DOCUMENT_LAYERS)[number];

/**
 * Input to one authored-layer reader edition.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-inventory Declares the deliverable's source, title, format-owning output directory, and selected authored family.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-output Supplies the explicit identity and source revision surface from which the Markdown view is derived.
 */
export interface IAutoMovieProductionBindRequest {
  /** Generated-project root the binder reads. */
  root: string;

  /** Human-facing title written as the edition's sole H1. */
  title: string;

  /** Authored Markdown layer to bind. */
  layer: AutoMovieAuthoredDocumentLayer;

  /**
   * Directory the edition is written beneath.
   *
   * @default `<root>/artifacts`
   */
  output?: string;
}

interface IAuthoredDocument {
  body: string;
  title: string;
}

const LAYERS: ReadonlySet<string> = new Set(AUTHORED_DOCUMENT_LAYERS);

/**
 * Binds one authored production layer into one reader-facing Markdown file.
 *
 * The binder reads the selected `docs/<layer>` tree and never writes into
 * `docs`: only one file below the explicit output directory is produced,
 * defaulting to the scaffold's ignored `artifacts` directory. It removes HTML
 * authoring comments and trailing citation anchors, rebases every document
 * beneath one edition title, preserves reader-facing Markdown, and orders files
 * by their POSIX relative path in code-unit order. Repeating a run over the same
 * source therefore writes byte-identical output.
 *
 * Markdown is the complete deliverable here. PDF, Fountain, Final Draft, font
 * shaping, and typography belong to converters that already own those formats.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-inventory Emits the selected authored inventory as its declared human-readable Markdown view without changing its source.
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-final-handoff Produces a stable handoff artifact from the selected authored revision while leaving source authority in the production.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-output Derives one deterministic document view with an explicit source family, format, and output identity.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-provenance-handoff Keeps the reader edition derivative of the authored files rather than promoting it to a second prose authority.
 */
export class AutoMovieProductionBinder {
  /** Absolute generated-project root this binder reads. */
  public readonly root: string;

  /** Reader-facing title written as the edition's sole H1. */
  public readonly title: string;

  /** Authored layer this binder reads. */
  public readonly layer: AutoMovieAuthoredDocumentLayer;

  /** Absolute directory the derived Markdown file is written beneath. */
  public readonly output: string;

  /** Creates a binder for one project-owned authored layer. */
  public constructor(request: IAutoMovieProductionBindRequest) {
    this.root = path.resolve(request.root);
    this.title = request.title.trim();
    this.layer = request.layer;
    this.output = path.resolve(
      request.output ?? path.join(this.root, "artifacts"),
    );

    if (this.title.length === 0)
      throw new Error("A reader-facing production title is required.");
    if (/\r|\n/u.test(this.title))
      throw new Error("A reader-facing production title must be one line.");
    if (!LAYERS.has(this.layer))
      throw new Error(`Unknown authored document layer: ${String(this.layer)}`);

    const docs = path.join(this.root, "docs");
    if (contains(this.output, docs) || contains(docs, this.output))
      throw new Error(
        `${this.output}: the output directory must remain separate from the authored docs tree.`,
      );
  }

  /** Renders the integrated reader edition without writing it. */
  public async markdown(): Promise<string> {
    const documents: IAuthoredDocument[] = await readLayer(
      this.root,
      this.layer,
    );
    const parts: string[] = [`# ${this.title}`];
    for (const document of documents) {
      parts.push(`## ${document.title}`);
      const body: string = rebaseHeadings(document.body, 1).trim();
      if (body !== "") parts.push(body);
    }
    return `${parts.join("\n\n")}\n`;
  }

  /** Writes the integrated edition and returns its absolute stable path. */
  public async bind(): Promise<string> {
    const markdown: string = await this.markdown();
    const target: string = path.join(
      this.output,
      `${stem(this.title)}-${this.layer}.md`,
    );
    await fs.mkdir(this.output, { recursive: true });
    await fs.writeFile(target, markdown, "utf8");
    return target;
  }
}

/** Reads one layer's Markdown documents in deterministic relative-path order. */
async function readLayer(
  root: string,
  layer: AutoMovieAuthoredDocumentLayer,
): Promise<IAuthoredDocument[]> {
  const layerRoot: string = path.join(root, "docs", layer);
  const files: string[] = await listMarkdownFiles(layerRoot).catch(
    (error: unknown) => {
      if (error instanceof Error && error.message.startsWith(layerRoot))
        throw error;
      throw new Error(`${layerRoot}: the production has no authored ${layer}.`);
    },
  );
  if (files.length === 0)
    throw new Error(`${layerRoot}: the production has no authored ${layer}.`);

  const documents: IAuthoredDocument[] = [];
  for (const file of files) {
    const target: string = path.join(layerRoot, ...file.split("/"));
    const markdown: string = stripAuthoringMarkers(
      await fs.readFile(target, "utf8"),
    );
    const heading: RegExpExecArray | null = /^# (.+)(?:\n|$)/u.exec(markdown);
    if (heading === null)
      throw new Error(
        `${target}: an authored document must open with one H1 title.`,
      );
    documents.push({
      title: stripHeadingAnchor(heading[1]),
      body: markdown.slice(heading[0].length).trim(),
    });
  }
  return documents;
}

/** Walks regular Markdown files without following a symbolic directory entry. */
async function listMarkdownFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    const entries = (await fs.readdir(directory, { withFileTypes: true })).sort(
      (left, right) => compareCodeUnits(left.name, right.name),
    );
    for (const entry of entries) {
      const target: string = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`${target}: authored layers may not contain links.`);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile() && entry.name.endsWith(".md"))
        result.push(toPosix(path.relative(root, target)));
    }
  };
  await walk(root);
  return result.sort(compareCodeUnits);
}

/** Removes evidence comments while preserving reader-facing Markdown. */
function stripAuthoringMarkers(markdown: string): string {
  return markdown
    .replaceAll("\r\n", "\n")
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

/** Rebases ATX headings outside fenced code and hides citation anchors. */
function rebaseHeadings(body: string, shift: number): string {
  let fence: { character: string; length: number } | undefined;
  return body
    .split("\n")
    .map((line) => {
      if (fence !== undefined) {
        if (
          new RegExp(
            `^ {0,3}${fence.character}{${fence.length},}[ \t]*$`,
            "u",
          ).test(line)
        )
          fence = undefined;
        return line;
      }
      const opening: RegExpExecArray | null = /^ {0,3}(`{3,}|~{3,})/u.exec(
        line,
      );
      if (opening !== null) {
        fence = { character: opening[1][0], length: opening[1].length };
        return line;
      }
      const heading: RegExpExecArray | null = /^(#{1,6}) (.+)$/u.exec(line);
      if (heading === null) return line;
      if (heading[1].length + shift > 6)
        throw new Error(`A bound heading may not exceed H6: ${line.trim()}`);
      return `${"#".repeat(shift)}${heading[1]} ${stripHeadingAnchor(heading[2])}`;
    })
    .join("\n");
}

/** Removes one trailing evidence-graph anchor from a heading title. */
function stripHeadingAnchor(title: string): string {
  return title.replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/u, "").trim();
}

/** Creates one portable filename stem from the reader-facing title. */
function stem(title: string): string {
  return (
    title
      .toLowerCase()
      .match(/\p{L}+|\p{N}+/gu)
      ?.join("-") ?? "automovie"
  );
}

/** True when `candidate` is `parent` or lies below it. */
function contains(parent: string, candidate: string): boolean {
  const relative: string = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

/** Stable code-unit ordering independent of host locale and ICU data. */
function compareCodeUnits(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

/** POSIX-slashes one relative path for host-independent ordering. */
function toPosix(value: string): string {
  return value.replaceAll("\\", "/");
}
