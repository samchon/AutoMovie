import type {
  AutoMovieDiagnosticCode,
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
} from "@automovie/interface";

/**
 * One `SCN` heading found in an authored screenplay document.
 *
 * The title is the text following the id and its separator; the body is every
 * line until the next heading, which is what says whether a scene has prose at
 * all or only a promise of one.
 */
interface IMarkdownScene {
  id: string;
  title: string;
  body: string;
}

const HEADING =
  /^#{1,6}[ \t]+(SCN-[A-Za-z0-9-]+)[ \t]+(?:—|-|:)[ \t]+(.+?)[ \t]*$/u;

/**
 * Whitespace that only exists because Markdown soft-wraps.
 *
 * The index quotes a sentence verbatim; a document may wrap that same sentence
 * across lines without changing a word of it. Collapsing runs of whitespace is
 * what lets verbatim mean "the same sentence" rather than "the same bytes".
 */
const comparableProse = (value: string): string =>
  value.split(/\s+/u).filter(Boolean).join(" ");

/**
 * Collect the `SCN` headings a document declares, ignoring fenced code.
 *
 * A fenced block is illustration, not authored scene prose. Counting a heading
 * inside one would let a guide that shows the heading format be mistaken for a
 * screenplay that declares the scene.
 */
export const parseScreenplayProse = (content: string): IMarkdownScene[] => {
  const scenes: IMarkdownScene[] = [];
  let current: IMarkdownScene | undefined;
  let fence: string | undefined;
  let fenceLength = 0;
  for (const line of content.replace(/\r\n/gu, "\n").split("\n")) {
    const trimmed = line.replace(/^[ \t]+/u, "");
    const indent = line.length - trimmed.length;
    const marker = trimmed[0];
    if (
      indent <= 3 &&
      trimmed.length >= 3 &&
      (marker === "`" || marker === "~")
    ) {
      let length = 0;
      while (length < trimmed.length && trimmed[length] === marker) ++length;
      if (fence === undefined && length >= 3) {
        fence = marker;
        fenceLength = length;
      } else if (
        marker === fence &&
        length >= fenceLength &&
        trimmed.slice(length).trim() === ""
      ) {
        fence = undefined;
        fenceLength = 0;
      }
    }
    if (fence === undefined) {
      const match = HEADING.exec(line);
      if (match !== null) {
        if (current !== undefined) scenes.push(current);
        current = { id: match[1]!, title: match[2]!.trim(), body: "" };
        continue;
      }
    }
    if (current !== undefined) current.body += `${line}\n`;
  }
  if (current !== undefined) scenes.push(current);
  return scenes;
};

/**
 * The join between the machine ledger and the prose a human actually wrote.
 *
 * Every other screenplay check reads the index alone, and an index that agrees
 * with itself can still promise a scene nobody wrote. This is the only place
 * the compiler opens authored prose, so it is the only place that can tell a
 * ledger entry from a scene.
 *
 * Documents are addressed per unit when the layout is split and by the
 * index-level path when it is not, and a layout may be mixed. The index-level
 * document therefore yields exactly the units that do not address their own:
 * once prose is split, the index path names one of those very files, so
 * counting an owned unit from it would find its heading twice and refuse a
 * correct project.
 */
export const screenplayProseDiagnostics = (props: {
  screenplay: IAutoMovieScreenplayIndex | null;
  read: (relativePath: string) => string | null;
}): IAutoMovieDiagnostic[] => {
  const screenplay = props.screenplay;
  if (screenplay === null) return [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const refuse = (
    code: AutoMovieDiagnosticCode,
    message: string,
    path: string | null,
  ): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "compile",
      target: "screenplay",
      path,
      message,
    });
  };
  const documents = new Map<string, string | null>();
  const read = (relativePath: string): string | null => {
    if (documents.has(relativePath)) return documents.get(relativePath)!;
    const content = props.read(relativePath);
    documents.set(relativePath, content);
    if (content === null)
      refuse(
        "screenplay-document-absent",
        `The screenplay index addresses "${relativePath}", which is not a readable project file. The index dangles from prose nobody can open. Restore the document or correct the path, then compile again.`,
        relativePath,
      );
    return content;
  };

  // --- Treatment beats appear verbatim in the prose that promises them ------
  for (const sequence of screenplay.treatment.sequences) {
    const documentPath =
      sequence.path !== undefined && sequence.path.trim().length !== 0
        ? sequence.path
        : screenplay.treatment.path;
    const content = read(documentPath);
    if (content === null) continue;
    const comparable = comparableProse(content);
    for (const beat of sequence.beats)
      if (
        beat.text.trim().length !== 0 &&
        comparable.includes(comparableProse(beat.text)) === false
      )
        refuse(
          "screenplay-beat-unwritten",
          `Treatment beat "${beat.id}" is indexed, but its exact prose is absent from "${documentPath}". The machine index would promise text the human document does not contain. Restore the exact prose or update both records, then compile again.`,
          documentPath,
        );
  }

  // --- Scene headings ------------------------------------------------------
  const owned = new Map<string, string>();
  for (const scene of screenplay.screenplay.scenes)
    if (scene.path !== undefined && scene.path.trim().length !== 0)
      owned.set(scene.id, scene.path);
  const headings = new Map<string, IMarkdownScene[]>();
  const headingPath = new Map<string, string>();
  const collect = (documentPath: string, only?: string): void => {
    const content = read(documentPath);
    if (content === null) return;
    for (const parsed of parseScreenplayProse(content)) {
      if (only !== undefined && parsed.id !== only) continue;
      if (only === undefined && owned.has(parsed.id)) continue;
      headings.set(parsed.id, [...(headings.get(parsed.id) ?? []), parsed]);
      headingPath.set(parsed.id, documentPath);
    }
  };
  collect(screenplay.screenplay.path);
  for (const [id, documentPath] of owned) collect(documentPath, id);

  const declared = new Set(
    screenplay.screenplay.scenes.map((scene) => scene.id),
  );
  for (const [id, entries] of headings) {
    const documentPath = headingPath.get(id)!;
    if (entries.length !== 1) {
      refuse(
        "screenplay-heading-repeated",
        `Scene id "${id}" heads ${entries.length} sections of "${documentPath}". One stable id must occur on exactly one heading line, or a downstream citation cannot say which prose it cites. Keep one heading and compile again.`,
        documentPath,
      );
      continue;
    }
    if (declared.has(id) === false)
      refuse(
        "screenplay-heading-unindexed",
        `"${documentPath}" heads a scene "${id}" the index does not declare. Downstream records cannot cite an unindexed scene, so this prose is unreachable. Add it to the index or remove the heading, then compile again.`,
        documentPath,
      );
  }
  for (const scene of screenplay.screenplay.scenes) {
    const documentPath = owned.get(scene.id) ?? screenplay.screenplay.path;
    if (documents.get(documentPath) === null) continue;
    const entries = headings.get(scene.id) ?? [];
    if (entries.length === 0) {
      refuse(
        "screenplay-heading-absent",
        `Scene "${scene.id}" is indexed, but "${documentPath}" heads no such scene. Downstream citations dangle from the human screenplay. Restore the heading and compile again.`,
        documentPath,
      );
      continue;
    }
    if (entries.length !== 1) continue;
    const entry = entries[0]!;
    if (entry.title !== scene.title)
      refuse(
        "screenplay-heading-retitled",
        `Scene "${scene.id}" is titled "${scene.title}" in the index and "${entry.title}" in "${documentPath}". Human prose and machine identity have diverged, so neither can be trusted to name the other. Make the titles exact and compile again.`,
        documentPath,
      );
    if (scene.status === "active" && entry.body.trim().length === 0)
      refuse(
        "screenplay-scene-unwritten",
        `Active scene "${scene.id}" has a heading in "${documentPath}" and no prose beneath it. A heading-only ledger entry cannot satisfy authored dramatic work. Write the scene and compile again.`,
        documentPath,
      );
  }
  return diagnostics;
};
