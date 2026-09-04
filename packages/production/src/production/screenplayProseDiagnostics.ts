import type {
  AutoMovieDiagnosticCode,
  AutoMovieScreenplayParticipantMode,
  IAutoMovieDiagnostic,
  IAutoMovieScreenplayIndex,
  IAutoMovieScreenplayParticipant,
} from "@automovie/interface";

/**
 * One `SCN` heading found in an authored screenplay document.
 *
 * The title is the text following the id and its separator; the body is every
 * line until the next heading, which is what says whether a scene has prose at
 * all or only a promise of one.
 */
export interface IAutoMovieParsedScreenplayAuthority {
  location: string;
  storyTime: string;
  participants: IAutoMovieScreenplayParticipant[];
  beats: string[];
}

export interface IAutoMovieParsedScreenplayTimingOccurrence {
  text: string;
  seconds: number;
  selector: string | null;
}

export interface IAutoMovieParsedScreenplayScene {
  id: string;
  title: string;
  body: string;
  authority: IAutoMovieParsedScreenplayAuthority | null;
  authorityErrors: string[];
  timing: IAutoMovieParsedScreenplayTimingOccurrence[];
}

const HEADING =
  /^#{1,6}[ \t]+(SCN-[A-Za-z0-9-]+)[ \t]+(?:—|-|:)[ \t]+(.+?)[ \t]*$/u;

const AUTHORITY_START = "@automovie-scene";
const AUTHORITY_END = "@end-automovie-scene";
const PARTICIPANT_MODES = new Set<AutoMovieScreenplayParticipantMode>([
  "on-screen",
  "off-screen",
  "crowd",
  "object",
  "environmental",
  "referenced",
]);

const TIMING_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  quarter: 0.25,
  "a quarter": 0.25,
  half: 0.5,
  "three quarters": 0.75,
};

const TIMING_OCCURRENCE =
  /(^|[^\w.-])((?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a[ \t]+quarter|quarter|half|three[ \t]+quarters))(?:[ \t]*-[ \t]*|[ \t]+)seconds?\b(?:[ \t]*\{@timing[ \t]+([^}\r\n]+)\})?/giu;

/**
 * Markdown lines that can make an audience-facing prose claim.
 *
 * HTML comments carry evidence metadata and fenced blocks carry examples or
 * implementation notes. Neither is screenplay prose: letting either through
 * would allow a citation review to satisfy an unwritten scene, or make a
 * number in an example look like a timing promise. Comment removal preserves
 * line breaks so the remaining heading and body boundaries stay unchanged.
 */
export const authoredScreenplayMarkdownLines = (content: string): string[] => {
  const lines: string[] = [];
  let fence: string | undefined;
  let fenceLength = 0;
  let htmlComment = false;
  for (const sourceLine of content.replace(/\r\n/gu, "\n").split("\n")) {
    if (fence !== undefined) {
      const trimmed = sourceLine.replace(/^[ \t]+/u, "");
      const indent = sourceLine.length - trimmed.length;
      if (indent <= 3 && trimmed[0] === fence) {
        let length = 0;
        while (length < trimmed.length && trimmed[length] === fence) ++length;
        if (
          length >= fenceLength &&
          trimmed.slice(length).trim().length === 0
        ) {
          fence = undefined;
          fenceLength = 0;
        }
      }
      continue;
    }
    let line = "";
    for (let cursor = 0; cursor < sourceLine.length; ) {
      if (htmlComment) {
        const close = sourceLine.indexOf("-->", cursor);
        if (close === -1) {
          line += " ".repeat(sourceLine.length - cursor);
          break;
        }
        line += " ".repeat(close + 3 - cursor);
        cursor = close + 3;
        htmlComment = false;
      } else {
        const open = sourceLine.indexOf("<!--", cursor);
        if (open === -1) {
          line += sourceLine.slice(cursor);
          break;
        }
        line += `${sourceLine.slice(cursor, open)}    `;
        cursor = open + 4;
        htmlComment = true;
      }
    }
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
      if (length >= 3) {
        fence = marker;
        fenceLength = length;
        continue;
      }
    }
    lines.push(line);
  }
  return lines;
};

/**
 * Whitespace that only exists because Markdown soft-wraps.
 *
 * The index quotes a sentence verbatim; a document may wrap that same sentence
 * across lines without changing a word of it. Collapsing runs of whitespace is
 * what lets verbatim mean "the same sentence" rather than "the same bytes".
 */
const comparableProse = (value: string): string =>
  value.split(/\s+/u).filter(Boolean).join(" ");

const timingSeconds = (value: string): number => {
  const normalized = value.toLowerCase().replace(/[ \t]+/gu, " ");
  return TIMING_WORDS[normalized] ?? Number(normalized);
};

export const parseScreenplayTimingOccurrences = (
  body: string,
): IAutoMovieParsedScreenplayTimingOccurrence[] =>
  [...body.replace(/[*_`]/gu, "").matchAll(TIMING_OCCURRENCE)].map((match) => ({
    text: match[2]!,
    seconds: timingSeconds(match[2]!),
    selector: match[3]?.trim() ?? null,
  }));

const parseAuthority = (
  lines: string[],
): {
  authority: IAutoMovieParsedScreenplayAuthority | null;
  errors: string[];
  body: string;
} => {
  const first = lines.findIndex((line) => line.trim().length !== 0);
  if (first === -1 || lines[first]!.trim() !== AUTHORITY_START)
    return { authority: null, errors: [], body: lines.join("\n") };
  const end = lines.findIndex(
    (line, index) => index > first && line.trim() === AUTHORITY_END,
  );
  if (end === -1)
    return {
      authority: null,
      errors: [`${AUTHORITY_START} has no ${AUTHORITY_END}`],
      body: lines.join("\n"),
    };
  const errors: string[] = [];
  let location: string | undefined;
  let storyTime: string | undefined;
  const participants: IAutoMovieScreenplayParticipant[] = [];
  const beats: string[] = [];
  for (const source of lines.slice(first + 1, end)) {
    const line = source.trim();
    if (line.length === 0) continue;
    const separator = line.indexOf(":");
    if (separator === -1) {
      errors.push(`authority line "${line}" has no field separator`);
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "location") {
      if (location !== undefined) errors.push("location is declared twice");
      else location = value;
    } else if (key === "story-time") {
      if (storyTime !== undefined) errors.push("story-time is declared twice");
      else storyTime = value;
    } else if (key === "participant") {
      const split = value.lastIndexOf(" ");
      const id = split === -1 ? "" : value.slice(0, split).trim();
      const mode = split === -1 ? "" : value.slice(split + 1).trim();
      if (
        id.length === 0 ||
        PARTICIPANT_MODES.has(mode as AutoMovieScreenplayParticipantMode) ===
          false
      )
        errors.push(`participant "${value}" has no valid identity and mode`);
      else
        participants.push({
          id,
          mode: mode as AutoMovieScreenplayParticipantMode,
        });
    } else if (key === "beat") {
      if (value.length === 0) errors.push("beat identity is blank");
      else beats.push(value);
    } else errors.push(`authority field "${key}" is not supported`);
  }
  if (location === undefined || location.length === 0)
    errors.push("location is absent or blank");
  if (storyTime === undefined || storyTime.length === 0)
    errors.push("story-time is absent or blank");
  const participantKeys = participants.map(
    (participant) => `${participant.id}\u0000${participant.mode}`,
  );
  if (new Set(participantKeys).size !== participantKeys.length)
    errors.push("a participant identity and mode pair is repeated");
  if (new Set(beats).size !== beats.length)
    errors.push("a beat identity is repeated");
  return {
    authority:
      location === undefined || storyTime === undefined
        ? null
        : { location, storyTime, participants, beats },
    errors,
    body: [...lines.slice(0, first), ...lines.slice(end + 1)].join("\n"),
  };
};

/**
 * Collect the `SCN` headings a document declares, ignoring fenced code.
 *
 * A fenced block is illustration, not authored scene prose. Counting a heading
 * inside one would let a guide that shows the heading format be mistaken for a
 * screenplay that declares the scene.
 */
export const parseScreenplayProse = (
  content: string,
): IAutoMovieParsedScreenplayScene[] => {
  const scenes: IAutoMovieParsedScreenplayScene[] = [];
  let current:
    | {
        id: string;
        title: string;
        lines: string[];
      }
    | undefined;
  const push = (): void => {
    if (current === undefined) return;
    const parsed = parseAuthority(current.lines);
    scenes.push({
      id: current.id,
      title: current.title,
      body: parsed.body,
      authority: parsed.authority,
      authorityErrors: parsed.errors,
      timing: parseScreenplayTimingOccurrences(parsed.body),
    });
  };
  for (const line of authoredScreenplayMarkdownLines(content)) {
    const match = HEADING.exec(line);
    if (match !== null) {
      push();
      current = {
        id: match[1]!,
        // An explicit Markdown id stabilizes evidence citations; it is
        // metadata on the heading, not part of the screenplay scene title.
        title: match[2]!.replace(/[ \t]+\{#[^{}\s]+\}[ \t]*$/u, "").trim(),
        lines: [],
      };
      continue;
    }
    if (current !== undefined) current.lines.push(line);
  }
  push();
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
    const comparable = comparableProse(
      authoredScreenplayMarkdownLines(content).join("\n"),
    );
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
    if (entry.authorityErrors.length !== 0)
      refuse(
        "screenplay-scene-authority-invalid",
        `Scene "${scene.id}" has an invalid ${AUTHORITY_START} carrier in "${documentPath}": ${entry.authorityErrors.join("; ")}. Correct the bounded carrier rather than asking the compiler to infer action prose, then compile again.`,
        documentPath,
      );
    if (scene.status === "OMITTED") {
      if (entry.authority !== null)
        refuse(
          "screenplay-scene-authority-unexpected",
          `OMITTED scene "${scene.id}" still declares an active authority carrier in "${documentPath}". A permanent tombstone has identity but no live place, time, participant or beat claim. Remove the carrier or reactivate the scene, then compile again.`,
          documentPath,
        );
      continue;
    }
    if (entry.authority === null) {
      refuse(
        "screenplay-scene-authority-absent",
        `Active scene "${scene.id}" has no complete ${AUTHORITY_START} carrier immediately below its heading in "${documentPath}". Declare location, story-time, participants and beat identities there so prose and index have one deterministic join, then compile again.`,
        documentPath,
      );
      continue;
    }
    if (entry.authority.location !== scene.location)
      refuse(
        "screenplay-scene-location-conflict",
        `Scene "${scene.id}" names location "${scene.location}" in the index and "${entry.authority.location}" in authoritative prose. Stable ids compare exactly; repair the record that is wrong, then compile again.`,
        documentPath,
      );
    if (entry.authority.storyTime !== scene.storyTime)
      refuse(
        "screenplay-scene-story-time-conflict",
        `Scene "${scene.id}" names story time "${scene.storyTime}" in the index and "${entry.authority.storyTime}" in authoritative prose. Explicit unknown matches only explicit unknown, so repair the record that is wrong, then compile again.`,
        documentPath,
      );
    const participantKey = (
      participant: IAutoMovieScreenplayParticipant,
    ): string => `${participant.id}:${participant.mode}`;
    const indexedParticipants = scene.participants
      .map(participantKey)
      .sort((left, right) => left.localeCompare(right));
    const proseParticipants = entry.authority.participants
      .map(participantKey)
      .sort((left, right) => left.localeCompare(right));
    if (
      indexedParticipants.length !== proseParticipants.length ||
      indexedParticipants.some(
        (participant, index) => participant !== proseParticipants[index],
      )
    )
      refuse(
        "screenplay-scene-participant-conflict",
        `Scene "${scene.id}" participants differ between index [${indexedParticipants.join(", ")}] and authoritative prose [${proseParticipants.join(", ")}]. Compare each stable identity and mode inside this scene, then compile again.`,
        documentPath,
      );
    const indexedBeats = scene.covers
      .map((coverage) => coverage.id)
      .sort((left, right) => left.localeCompare(right));
    const proseBeats = [...entry.authority.beats].sort((left, right) =>
      left.localeCompare(right),
    );
    if (
      indexedBeats.length !== proseBeats.length ||
      indexedBeats.some((beat, index) => beat !== proseBeats[index])
    )
      refuse(
        "screenplay-scene-beat-conflict",
        `Scene "${scene.id}" beat identities differ between index [${indexedBeats.join(", ")}] and authoritative prose [${proseBeats.join(", ")}]. A same sentence in another scene cannot discharge this join. Correct the exact scene carrier, then compile again.`,
        documentPath,
      );
  }
  return diagnostics;
};
