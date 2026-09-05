import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
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

/** Narrative layers that carry the release partition a reader receives. */
const GROUPED_DOCUMENT_LAYERS: ReadonlySet<AutoMovieAuthoredDocumentLayer> =
  new Set(["screenplays", "scripts"]);

/**
 * Authored Markdown layers that may be bound for a human reader.
 *
 * The set spans all production shapes. Film narrative, direct brief, model,
 * motion, and built-environment work are different authored branches, but the
 * reader-facing transformation is the same for each one.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-breakdown-deliverables Makes every authored document family eligible for an explicit human-readable view.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Represents the authored document family selected for one deterministic deliverable item.
 */
export type AutoMovieAuthoredDocumentLayer =
  (typeof AUTHORED_DOCUMENT_LAYERS)[number];

/**
 * Input to one authored-layer reader edition.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-breakdown-deliverables Declares the deliverable's source, title, format-owning output directory, and selected authored family.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Supplies the explicit identity and source revision surface from which the Markdown view is derived.
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

interface IAuthoredDocumentGroup {
  documents: IAuthoredDocument[];
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
 * beneath one edition title, and preserves reader-facing Markdown. Scripts and
 * screenplays retain their numbered group partition as H2 and inline each unit
 * as H3; every other authored layer remains a flat ordered document collection.
 * Repeating a run over the same source therefore writes byte-identical output.
 *
 * Markdown is the complete deliverable here. PDF, Fountain, Final Draft, font
 * shaping, and typography belong to converters that already own those formats.
 *
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-breakdown-deliverables Emits the selected authored inventory as its declared human-readable Markdown view without changing its source.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Derives one deterministic document view with an explicit source family, format, and output identity.
 * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-design-deliverable-inventory Produces the complete source-authoritative deliverable inventory, including a deterministic final handoff view.
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

    assertOutputSeparatedFromDocs(this.output, path.join(this.root, "docs"));
  }

  /** Renders the integrated reader edition without writing it. */
  public async markdown(): Promise<string> {
    const parts: string[] = [`# ${this.title}`];
    if (GROUPED_DOCUMENT_LAYERS.has(this.layer)) {
      const groups: IAuthoredDocumentGroup[] = await readGroupedLayer(
        this.root,
        this.layer,
      );
      for (const group of groups) {
        parts.push(`## ${group.title}`);
        for (const document of group.documents) {
          parts.push(`### ${document.title}`);
          const body: string = rebaseHeadings(document.body, 2).trim();
          if (body !== "") parts.push(body);
        }
      }
    } else {
      const documents: IAuthoredDocument[] = await readFlatLayer(
        this.root,
        this.layer,
      );
      for (const document of documents) {
        parts.push(`## ${document.title}`);
        const body: string = rebaseHeadings(document.body, 1).trim();
        if (body !== "") parts.push(body);
      }
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
    const physicalDocs = await fs.realpath(path.join(this.root, "docs"));
    assertOutputSeparatedFromDocs(
      await prospectiveRealpath(this.output),
      physicalDocs,
    );
    await fs.mkdir(this.output, { recursive: true });
    const physicalOutput = await fs.realpath(this.output);
    assertOutputSeparatedFromDocs(physicalOutput, physicalDocs);
    await publishEdition(
      physicalOutput,
      path.join(physicalOutput, path.basename(target)),
      markdown,
    );
    return target;
  }
}

/**
 * Publishes complete bytes into an unused final slot without following a
 * resident symlink or hardlink. An existing ordinary one-link file converges
 * only when it already contains the exact deterministic edition.
 */
async function publishEdition(
  output: string,
  target: string,
  markdown: string,
): Promise<void> {
  const temporary: string = path.join(
    output,
    `.automovie-book-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const handle = await fs.open(temporary, "wx");
    try {
      await handle.writeFile(markdown, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.link(temporary, target).catch(async (error: unknown) => {
      if (!hasErrorCode(error, "EEXIST")) throw error;
      await assertExistingEdition(target, markdown);
    });
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

/** Accepts a prior deterministic publication without trusting its path alone. */
async function assertExistingEdition(
  target: string,
  markdown: string,
): Promise<void> {
  const linked = await fs.lstat(target, { bigint: true });
  if (linked.isSymbolicLink() || !linked.isFile() || linked.nlink !== 1n)
    throw new Error(
      `${target}: an existing reader edition must be one unlinked regular file.`,
    );
  const handle = await fs.open(target, "r");
  try {
    if ((await handle.readFile("utf8")) !== markdown)
      throw new Error(
        `${target}: an existing reader edition has different bytes.`,
      );
  } finally {
    await handle.close();
  }
}

/** Resolve where a not-yet-created path will live through its nearest ancestor. */
async function prospectiveRealpath(target: string): Promise<string> {
  const suffix: string[] = [];
  let existing = target;
  while (true) {
    try {
      return path.join(await fs.realpath(existing), ...suffix);
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          String(error.code) === "ENOENT"
        )
      )
        throw error;
      suffix.unshift(path.basename(existing));
      existing = path.dirname(existing);
    }
  }
}

/** Reads one flat layer's Markdown documents in relative-path order. */
async function readFlatLayer(
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
    const heading: RegExpExecArray | null = /^#[ \t]+(\S.*)(?:\n|$)/u.exec(
      markdown,
    );
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

/** Accepted narrative group directory, such as `001-opening`. */
const GROUP_PATTERN: RegExp = /^([0-9]{3})-[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Accepted narrative unit filename, such as `001-first-beat.md`. */
const UNIT_PATTERN: RegExp = /^([0-9]{3})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

/** Reads scripts or screenplays through their shared grouped delivery topology. */
async function readGroupedLayer(
  root: string,
  layer: AutoMovieAuthoredDocumentLayer,
): Promise<IAuthoredDocumentGroup[]> {
  const layerRoot: string = path.join(root, "docs", layer);
  const docsRoot: string = path.dirname(layerRoot);
  const docsStatus = await fs.lstat(docsRoot).catch(() => undefined);
  if (
    docsStatus === undefined ||
    docsStatus.isSymbolicLink() ||
    !docsStatus.isDirectory()
  )
    throw new Error(
      `${docsRoot}: authored docs must be one physical directory.`,
    );
  const entries = await physicalEntries(layerRoot).catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith(layerRoot))
      throw error;
    throw new Error(`${layerRoot}: the production has no authored ${layer}.`);
  });
  const names: string[] = entries
    .filter((entry) => entry.isDirectory() && GROUP_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(numberedOrder(GROUP_PATTERN));
  if (names.length === 0)
    throw new Error(`${layerRoot}: the production has no authored groups.`);

  const groups: IAuthoredDocumentGroup[] = [];
  for (const name of names)
    groups.push(await readAuthoredGroup(layerRoot, name));
  return groups;
}

/** Reads one group index title and its ordered authored units. */
async function readAuthoredGroup(
  layerRoot: string,
  name: string,
): Promise<IAuthoredDocumentGroup> {
  const groupRoot: string = path.join(layerRoot, name);
  const indexPath: string = path.join(groupRoot, "index.md");
  const index: string = await readPhysicalMarkdown(indexPath).catch(() => {
    throw new Error(`${indexPath}: a group must carry its index.md title.`);
  });
  const heading: RegExpExecArray | null = /^#[ \t]+(\S.*)(?:\n|$)/u.exec(index);
  if (heading === null)
    throw new Error(`${indexPath}: a group index must open with one H1 title.`);

  const entries = await physicalEntries(groupRoot);
  const names: string[] = entries
    .filter((entry) => entry.isFile() && UNIT_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(numberedOrder(UNIT_PATTERN));
  if (names.length === 0)
    throw new Error(
      `${groupRoot}: a group must contain at least one unit file.`,
    );

  const documents: IAuthoredDocument[] = [];
  for (const unit of names)
    documents.push(await readAuthoredDocument(path.join(groupRoot, unit)));
  return {
    title: stripHeadingAnchor(heading[1]),
    documents,
  };
}

/** Reads one authored H1 document and removes its authoring markers. */
async function readAuthoredDocument(
  target: string,
): Promise<IAuthoredDocument> {
  const markdown: string = await readPhysicalMarkdown(target);
  const heading: RegExpExecArray | null = /^#[ \t]+(\S.*)(?:\n|$)/u.exec(
    markdown,
  );
  if (heading === null)
    throw new Error(
      `${target}: an authored document must open with one H1 title.`,
    );
  return {
    title: stripHeadingAnchor(heading[1]),
    body: markdown.slice(heading[0].length).trim(),
  };
}

/** Lists one physical authored directory and refuses links at its boundary. */
async function physicalEntries(directory: string): Promise<Dirent[]> {
  const linked = await fs.lstat(directory);
  if (linked.isSymbolicLink() || !linked.isDirectory())
    throw new Error(`${directory}: authored layers may not be links.`);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const symbolic = entries.find((entry) => entry.isSymbolicLink());
  if (symbolic !== undefined)
    throw new Error(
      `${path.join(directory, symbolic.name)}: authored layers may not contain links.`,
    );
  return entries;
}

/** Reads one physical regular Markdown file without following a leaf link. */
async function readPhysicalMarkdown(target: string): Promise<string> {
  const linked = await fs.lstat(target);
  if (linked.isSymbolicLink() || !linked.isFile())
    throw new Error(`${target}: authored documents must be regular files.`);
  return stripAuthoringMarkers(await fs.readFile(target, "utf8"));
}

/** Orders zero-padded authored identities, then resolves duplicate numbers. */
function numberedOrder(
  pattern: RegExp,
): (left: string, right: string) => number {
  return (left, right) =>
    Number(pattern.exec(left)![1]) - Number(pattern.exec(right)![1]) ||
    compareCodeUnits(left, right);
}

/** Walks regular Markdown files without following a symbolic directory entry. */
async function listMarkdownFiles(root: string): Promise<string[]> {
  if (
    (await fs.lstat(path.dirname(root))).isSymbolicLink() ||
    (await fs.lstat(root)).isSymbolicLink()
  )
    throw new Error(`${root}: authored layers may not be links.`);
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
  const output: string[] = [];
  let fence: { character: string; length: number } | undefined;
  let htmlComment = false;
  for (const sourceLine of markdown.replaceAll("\r\n", "\n").split("\n")) {
    if (fence !== undefined) {
      output.push(sourceLine);
      if (
        new RegExp(
          `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`,
          "u",
        ).test(sourceLine)
      )
        fence = undefined;
      continue;
    }
    const opening: string | undefined =
      htmlComment === false
        ? /^ {0,3}(`{3,}|~{3,})/u.exec(sourceLine)?.[1]
        : undefined;
    if (opening !== undefined) {
      fence = { character: opening[0], length: opening.length };
      output.push(sourceLine);
      continue;
    }
    let line = "";
    for (let cursor = 0; cursor < sourceLine.length; ) {
      if (htmlComment) {
        const close = sourceLine.indexOf("-->", cursor);
        if (close === -1) break;
        cursor = close + 3;
        htmlComment = false;
      } else {
        const open = sourceLine.indexOf("<!--", cursor);
        if (open === -1) {
          line += sourceLine.slice(cursor);
          break;
        }
        line += sourceLine.slice(cursor, open);
        cursor = open + 4;
        htmlComment = true;
      }
    }
    if (line !== "" || output.at(-1) !== "") output.push(line);
  }
  return output.join("\n").trim();
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
      const heading: RegExpExecArray | null = /^(#{1,6})[ \t]+(\S.*)$/u.exec(
        line,
      );
      if (heading === null) return line;
      if (heading[1].length + shift > 6)
        throw new Error(`A bound heading may not exceed H6: ${line.trim()}`);
      return `${"#".repeat(shift)}${heading[1]} ${stripHeadingAnchor(heading[2])}`;
    })
    .join("\n");
}

/** Removes one trailing evidence-graph anchor from a heading title. */
function stripHeadingAnchor(title: string): string {
  return title.replace(/\s*\{#[^{}\s]+\}\s*$/u, "").trim();
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

/** Refuses both lexical and resolved overlap with the authored docs tree. */
function assertOutputSeparatedFromDocs(output: string, docs: string): void {
  if (contains(output, docs) || contains(docs, output))
    throw new Error(
      `${output}: the output directory must remain separate from the authored docs tree.`,
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

/** True when an unknown thrown value carries one filesystem error code. */
function hasErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error && "code" in error && String(error.code) === code
  );
}
