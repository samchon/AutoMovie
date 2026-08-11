import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const corpusRoots = ["requirements", "specifications"].map((name) =>
  path.join(docsRoot, name),
);
const anchorPattern = /^[a-z0-9][a-z0-9._:-]*$/;

const diagnostics = [];
const documents = new Map();
const anchorDeclarations = new Map();

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const displayPath = (file) =>
  path.relative(docsRoot, file).split(path.sep).join("/") || ".";

const addDiagnostic = (file, line, message) => {
  diagnostics.push({ file: displayPath(file), line, message });
};

const filesystemReason = (error) =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  typeof error.code === "string"
    ? error.code
    : "unknown filesystem error";

const walkMarkdown = async (directory) => {
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => compareText(a.name, b.name),
  );
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMarkdown(target)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(target);
  }
  return files;
};

const maskHtmlComments = (line, state) => {
  let cursor = 0;
  let output = "";
  while (cursor < line.length) {
    if (state.inComment) {
      const end = line.indexOf("-->", cursor);
      if (end === -1) return `${output}${" ".repeat(line.length - cursor)}`;
      output += " ".repeat(end + 3 - cursor);
      cursor = end + 3;
      state.inComment = false;
      continue;
    }

    const start = line.indexOf("<!--", cursor);
    if (start === -1) return `${output}${line.slice(cursor)}`;
    output += line.slice(cursor, start);
    cursor = start + 4;
    state.inComment = true;
  }
  return output;
};

const maskInlineCode = (line) => {
  let cursor = 0;
  let output = "";
  while (cursor < line.length) {
    if (line[cursor] !== "`") {
      output += line[cursor];
      cursor += 1;
      continue;
    }

    let runLength = 1;
    while (line[cursor + runLength] === "`") runLength += 1;
    const delimiter = "`".repeat(runLength);
    const end = line.indexOf(delimiter, cursor + runLength);
    if (end === -1) {
      output += line.slice(cursor);
      break;
    }
    output += " ".repeat(end + runLength - cursor);
    cursor = end + runLength;
  }
  return output;
};

const readFence = (line) => {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (match === null || (match[1][0] === "`" && match[2].includes("`")))
    return undefined;
  return {
    character: match[1][0],
    length: match[1].length,
    remainder: match[2],
  };
};

const normalizeReferenceLabel = (label) =>
  label.trim().replace(/\s+/g, " ").toLowerCase();

const readDestination = (line, start) => {
  let cursor = start;
  while (/\s/.test(line[cursor] ?? "")) cursor += 1;
  let destination;
  if (line[cursor] === "<") {
    const end = line.indexOf(">", cursor + 1);
    if (end === -1) return undefined;
    destination = line.slice(cursor + 1, end);
    cursor = end + 1;
  } else {
    let depth = 0;
    destination = "";
    for (; cursor < line.length; cursor += 1) {
      const character = line[cursor];
      if (character === "\\" && cursor + 1 < line.length) {
        destination += line[cursor + 1];
        cursor += 1;
        continue;
      }
      if (character === "(") {
        depth += 1;
        destination += character;
        continue;
      }
      if (character === ")") {
        if (depth === 0) return { destination, end: cursor };
        depth -= 1;
        destination += character;
        continue;
      }
      if (/\s/.test(character) && depth === 0) break;
      destination += character;
    }
  }

  let quote;
  for (; cursor < line.length; cursor += 1) {
    const character = line[cursor];
    if (character === "\\") {
      cursor += 1;
      continue;
    }
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ")") return { destination, end: cursor };
  }
  return undefined;
};

const findClosingBracket = (line, start) => {
  let depth = 0;
  for (let cursor = start; cursor < line.length; cursor += 1) {
    if (line[cursor] === "\\") {
      cursor += 1;
      continue;
    }
    if (line[cursor] === "[") depth += 1;
    else if (line[cursor] === "]") {
      if (depth === 0) return cursor;
      depth -= 1;
    }
  }
  return -1;
};

const extractLinks = (line, references) => {
  const links = [];
  for (let cursor = 0; cursor < line.length; cursor += 1) {
    if (line[cursor] !== "[" || line[cursor - 1] === "\\") continue;
    const labelEnd = findClosingBracket(line, cursor + 1);
    if (labelEnd === -1) continue;

    const label = line.slice(cursor + 1, labelEnd);
    let next = labelEnd + 1;
    while (/\s/.test(line[next] ?? "")) next += 1;
    if (line[next] === "(") {
      const parsed = readDestination(line, next + 1);
      if (parsed !== undefined) {
        links.push(parsed.destination);
        cursor = parsed.end;
      } else cursor = next;
      continue;
    }

    let referenceLabel = label;
    if (line[next] === "[") {
      const referenceEnd = findClosingBracket(line, next + 1);
      if (referenceEnd === -1) continue;
      referenceLabel = line.slice(next + 1, referenceEnd) || label;
      cursor = referenceEnd;
    } else cursor = labelEnd;

    const reference = references.get(normalizeReferenceLabel(referenceLabel));
    if (reference !== undefined) links.push(reference);
  }
  return links;
};

const recordHeadingAnchor = (file, line, heading) => {
  const trimmed = heading.trim();
  const closingHashes = trimmed.match(/[ \t]+#+[ \t]*$/);
  const title =
    closingHashes === null
      ? trimmed
      : trimmed.slice(0, closingHashes.index).trimEnd();
  const explicitAnchor = title.match(/\s*\{#([^}]*)\}\s*$/);
  if (explicitAnchor === null) {
    addDiagnostic(file, line, "H2/H3 heading requires an explicit anchor");
    return;
  }
  if (!anchorPattern.test(explicitAnchor[1])) {
    addDiagnostic(
      file,
      line,
      `anchor "${explicitAnchor[1]}" must contain only lowercase ASCII letters, digits, and . _ : - separators`,
    );
    return;
  }

  const anchor = explicitAnchor[1];
  const declarations = anchorDeclarations.get(anchor) ?? [];
  declarations.push({ file, line });
  anchorDeclarations.set(anchor, declarations);
  return anchor;
};

const parseDocument = async (file) => {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const visibleLines = [];
  const comments = { inComment: false };
  let fence;

  for (const line of lines) {
    if (fence !== undefined) {
      const closing = readFence(line);
      if (
        closing !== undefined &&
        closing.character === fence.character &&
        closing.length >= fence.length &&
        closing.remainder.trim() === ""
      )
        fence = undefined;
      visibleLines.push("");
      continue;
    }

    const visible = maskHtmlComments(line, comments);
    const opening = readFence(visible);
    if (opening !== undefined) {
      fence = opening;
      visibleLines.push("");
      continue;
    }
    visibleLines.push(maskInlineCode(visible));
  }

  const nativeVisibleLines = [];
  const nativeFencedLines = [];
  let nativeFence;
  let nativeInComment = false;
  for (const line of lines) {
    const marker = readFence(line);
    if (marker !== undefined) {
      nativeFencedLines.push(true);
      nativeVisibleLines.push("");
      if (nativeFence === undefined) nativeFence = marker;
      else if (
        marker.character === nativeFence.character &&
        marker.length >= nativeFence.length &&
        marker.remainder.trim() === ""
      )
        nativeFence = undefined;
      continue;
    }
    if (nativeFence !== undefined) {
      nativeFencedLines.push(true);
      nativeVisibleLines.push("");
      continue;
    }

    nativeFencedLines.push(false);
    const trimmed = line.trimStart();
    if (nativeInComment) {
      if (trimmed.includes("-->")) nativeInComment = false;
      nativeVisibleLines.push("");
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      if (!trimmed.slice(4).includes("-->")) nativeInComment = true;
      nativeVisibleLines.push("");
      continue;
    }
    nativeVisibleLines.push(line);
  }

  const references = new Map();
  const referenceDefinitionLines = new Set();
  visibleLines.forEach((line, index) => {
    const match = line.match(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/);
    if (match !== null) {
      references.set(normalizeReferenceLabel(match[1]), match[2] ?? match[3]);
      referenceDefinitionLines.add(index);
    }
  });

  const anchors = new Map();
  const links = [];
  const claimHosts = [];
  const nativeHostAtLine = [];
  let nativeHost;
  visibleLines.forEach((line, index) => {
    const lineNumber = index + 1;
    const heading = line.match(/^ {0,3}(#{2,3})(?:[ \t]+|$)(.*)$/);
    if (heading !== null) {
      const anchor = recordHeadingAnchor(file, lineNumber, heading[2]);
      if (anchor !== undefined) anchors.set(anchor, lineNumber);
    } else if (
      /^ {0,3}-+[ \t]*$/.test(line) &&
      index > 0 &&
      visibleLines[index - 1].trim() !== "" &&
      !/^ {0,3}(?:#{1,6}(?:[ \t]+|$)|>|[-+*][ \t]+|\d+[.)][ \t]+)/.test(
        visibleLines[index - 1],
      )
    )
      addDiagnostic(
        file,
        lineNumber - 1,
        "Setext H2 is not supported by @ttsc/evidence; use an explicitly anchored ATX H2",
      );

    if (!referenceDefinitionLines.has(index))
      for (const destination of extractLinks(line, references))
        links.push({ destination, line: lineNumber });

    const nativeHeading = nativeVisibleLines[index].match(
      /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/,
    );
    if (nativeHeading !== null) {
      nativeHost = {
        hasRequirementEvidence: false,
        level: nativeHeading[1].length,
        line: lineNumber,
      };
      if (nativeHost.level === 2 || nativeHost.level === 3)
        claimHosts.push(nativeHost);
    }
    nativeHostAtLine.push(nativeHost);
  });

  const commentPattern = /<!--([\s\S]*?)-->/g;
  let comment;
  let lineIndex = 0;
  let nextLineBreak = content.indexOf("\n");
  while ((comment = commentPattern.exec(content)) !== null) {
    while (nextLineBreak !== -1 && nextLineBreak < comment.index) {
      lineIndex += 1;
      nextLineBreak = content.indexOf("\n", nextLineBreak + 1);
    }
    if (nativeFencedLines[lineIndex]) continue;
    const host = nativeHostAtLine[lineIndex];
    if (host === undefined || (host.level !== 2 && host.level !== 3)) continue;

    for (const rawLine of comment[1].split(/\r?\n/)) {
      const declaration = rawLine.trim().replace(/^\*\s*/, "");
      const match = declaration.match(/^@evidence(?:[ \t]+)(\S+)/);
      if (match === null) continue;
      let target = match[1].replaceAll("\\", "/");
      while (target.startsWith("./")) target = target.slice(2);
      target = path.posix.normalize(target);
      if (target.startsWith("requirements/"))
        host.hasRequirementEvidence = true;
    }
  }

  const document = { file, anchors, claimHosts, links };
  documents.set(path.resolve(file), document);
  return document;
};

const isExternalDestination = (destination) =>
  destination.startsWith("//") ||
  destination.startsWith("/") ||
  /^[a-z][a-z0-9+.-]*:/i.test(destination);

const resolveLink = async (document, link) => {
  if (link.destination === undefined || isExternalDestination(link.destination))
    return undefined;

  const hashIndex = link.destination.indexOf("#");
  const rawFile =
    hashIndex === -1 ? link.destination : link.destination.slice(0, hashIndex);
  const rawAnchor =
    hashIndex === -1 ? undefined : link.destination.slice(hashIndex + 1);
  let filePart;
  let anchor;
  try {
    filePart = decodeURIComponent(rawFile.split("?", 1)[0]);
    anchor =
      rawAnchor === undefined ? undefined : decodeURIComponent(rawAnchor);
  } catch {
    addDiagnostic(
      document.file,
      link.line,
      `link has invalid percent encoding: ${link.destination}`,
    );
    return undefined;
  }

  let target = filePart
    ? path.resolve(path.dirname(document.file), filePart)
    : path.resolve(document.file);
  let targetStat;
  try {
    targetStat = await stat(target);
  } catch {
    addDiagnostic(
      document.file,
      link.line,
      `link target does not exist: ${link.destination}`,
    );
    return undefined;
  }
  if (targetStat.isDirectory()) target = path.join(target, "README.md");
  try {
    if (!(await stat(target)).isFile()) {
      addDiagnostic(
        document.file,
        link.line,
        `link target is not a file: ${link.destination}`,
      );
      return undefined;
    }
  } catch {
    addDiagnostic(
      document.file,
      link.line,
      `link target does not exist: ${link.destination}`,
    );
    return undefined;
  }

  target = path.resolve(target);
  if (anchor === "")
    addDiagnostic(
      document.file,
      link.line,
      `link anchor is empty: ${link.destination}`,
    );
  else if (anchor !== undefined) {
    const targetDocument = documents.get(target);
    if (targetDocument !== undefined && !targetDocument.anchors.has(anchor))
      addDiagnostic(
        document.file,
        link.line,
        `link anchor does not exist: ${displayPath(target)}#${anchor}`,
      );
  }
  return { file: target, anchor };
};

const validateIndex = (readme, expectedFiles, resolvedLinks, subject) => {
  if (readme === undefined) return;
  const occurrences = new Map();
  for (const link of resolvedLinks.get(readme.file) ?? []) {
    if (!expectedFiles.has(link.file)) continue;
    const entries = occurrences.get(link.file) ?? [];
    entries.push(link.line);
    occurrences.set(link.file, entries);
  }

  for (const expected of [...expectedFiles].sort(compareText)) {
    const lines = occurrences.get(expected) ?? [];
    if (lines.length === 0)
      addDiagnostic(
        readme.file,
        1,
        `${subject} does not index ${displayPath(expected)}`,
      );
    else if (lines.length > 1)
      for (const line of lines)
        addDiagnostic(
          readme.file,
          line,
          `${subject} indexes ${displayPath(expected)} more than once`,
        );
  }
};

const validateCorpusIndex = async (corpusRoot, files, resolvedLinks) => {
  const rootReadmePath = path.join(corpusRoot, "README.md");
  const rootReadme = documents.get(path.resolve(rootReadmePath));
  if (rootReadme === undefined)
    addDiagnostic(rootReadmePath, 1, "corpus root requires README.md");

  const topicDirectories = new Set(
    files
      .map((file) => path.relative(corpusRoot, file).split(path.sep))
      .filter((segments) => segments.length > 1)
      .map(([topic]) => path.join(corpusRoot, topic)),
  );
  const topicReadmes = new Set();
  for (const topicDirectory of [...topicDirectories].sort(compareText)) {
    const topicReadme = path.join(topicDirectory, "README.md");
    if (!documents.has(path.resolve(topicReadme)))
      addDiagnostic(topicReadme, 1, "topic directory requires README.md");
    else topicReadmes.add(path.resolve(topicReadme));
  }
  validateIndex(rootReadme, topicReadmes, resolvedLinks, "corpus README");

  for (const topicReadmePath of [...topicReadmes].sort(compareText)) {
    const topicReadme = documents.get(topicReadmePath);
    const expectedFiles = new Set(
      files
        .filter(
          (file) =>
            path.dirname(file) === path.dirname(topicReadmePath) &&
            path.basename(file) !== "README.md",
        )
        .map((file) => path.resolve(file)),
    );
    validateIndex(topicReadme, expectedFiles, resolvedLinks, "topic README");
  }
};

const main = async () => {
  const corpusFiles = new Map();
  for (const corpusRoot of corpusRoots) {
    let files;
    try {
      files = await walkMarkdown(corpusRoot);
    } catch (error) {
      addDiagnostic(
        path.join(corpusRoot, "README.md"),
        1,
        `cannot read contract corpus: ${filesystemReason(error)}`,
      );
      files = [];
    }
    corpusFiles.set(corpusRoot, files);
    for (const file of files)
      try {
        await parseDocument(file);
      } catch (error) {
        addDiagnostic(
          file,
          1,
          `cannot read contract document: ${filesystemReason(error)}`,
        );
      }
  }

  const specificationRoot = corpusRoots.find(
    (corpusRoot) => path.basename(corpusRoot) === "specifications",
  );
  const specificationFiles = corpusFiles.get(specificationRoot) ?? [];
  const specificationHosts = specificationFiles.flatMap(
    (file) => documents.get(path.resolve(file))?.claimHosts ?? [],
  );
  if (specificationHosts.length === 0)
    addDiagnostic(
      path.join(specificationRoot, "README.md"),
      1,
      "specification claim population contains no H2/H3 hosts",
    );
  for (const file of specificationFiles) {
    const document = documents.get(path.resolve(file));
    for (const host of document?.claimHosts ?? [])
      if (!host.hasRequirementEvidence)
        addDiagnostic(
          document.file,
          host.line,
          "specification H2/H3 requires a direct positive requirement citation",
        );
  }

  for (const [anchor, declarations] of anchorDeclarations) {
    if (declarations.length < 2) continue;
    const locations = declarations
      .map(({ file, line }) => `${displayPath(file)}:${line}`)
      .sort(compareText)
      .join(", ");
    for (const declaration of declarations)
      addDiagnostic(
        declaration.file,
        declaration.line,
        `duplicate anchor identity "${anchor}" is declared at ${locations}`,
      );
  }

  const resolvedLinks = new Map();
  for (const document of documents.values()) {
    const resolved = [];
    for (const link of document.links) {
      const target = await resolveLink(document, link);
      if (target !== undefined) resolved.push({ ...target, line: link.line });
    }
    resolvedLinks.set(document.file, resolved);
  }

  for (const [corpusRoot, files] of corpusFiles)
    await validateCorpusIndex(corpusRoot, files, resolvedLinks);

  diagnostics.sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      left.line - right.line ||
      compareText(left.message, right.message),
  );
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics)
      console.error(
        `${diagnostic.file}:${diagnostic.line}: ${diagnostic.message}`,
      );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${documents.size} contract Markdown files and ${anchorDeclarations.size} explicit anchors.`,
  );
};

await main();
