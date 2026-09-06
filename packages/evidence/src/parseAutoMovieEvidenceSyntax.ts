import ts from "typescript-compiler";

/**
 * One source document whose native evidence carriers are parsed.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the carrier path and exact source explicit parser input.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the complete lexical input identity.
 */
export interface IAutoMovieEvidenceSyntaxDocument {
  /** Project-relative path used to choose Markdown or TypeScript syntax. */
  path: string;
  /** Complete source text. */
  source: string;
}

/**
 * One evidence declaration read only from a native carrier.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Exposes each native declaration with its stable host and line address.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Carries one syntax-aware declaration projection.
 */
export interface IAutoMovieEvidenceSyntaxAnnotation {
  /** Markdown heading or TypeScript documentation block that owns the row. */
  host: string;
  /** One-based source line where the declaration begins. */
  line: number;
  /** One-based source line containing the end of a wrapped declaration. */
  endLine: number;
  /** Joined declaration text beginning with its `@evidence` tag. */
  text: string;
}

/**
 * Line-preserving Markdown views used by graph and reader validation.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Separates native declarations from visible target prose.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines aligned annotation and visible-line projections.
 */
export interface IAutoMovieMarkdownSyntaxProjection {
  /** Evidence declarations carried by live HTML comments. */
  annotations: readonly IAutoMovieEvidenceSyntaxAnnotation[];
  /** Reader-visible lines with comments, fenced examples, and indented code blanked. */
  visibleLines: readonly string[];
}

interface ICommentRegion {
  closed: boolean;
  end: number;
  line: number;
  start: number;
  text: string;
}

const ANNOTATION = /^@evidence[A-Za-z]*\b/u;
const HEADING = /^(#{1,6})(?!#)\s+(\S.*)$/u;
const ANCHOR = /[ \t]+\{#([^{}\s]+)\}[ \t]*$/u;

/**
 * Parses evidence declarations from Markdown comments or TypeScript JSDoc.
 *
 * Markdown fences retain their marker character and opening length, indented
 * code never changes outer comment or fence state, and TypeScript strings and
 * ordinary comments never become carriers. The result therefore supplies one
 * lexical owner to review auditing, target validation, and authored-body
 * measurement without reimplementing graph selection.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Restricts deterministic evidence preflight to the native carrier syntax the production contract declares.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Preserves exact source lines while excluding code examples and non-carrier text from preflight.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Provides one canonical lexical projection for Markdown comments and TypeScript JSDoc.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Returns stable host and line identities for every parsed declaration.
 */
export function parseAutoMovieEvidenceSyntax(
  document: IAutoMovieEvidenceSyntaxDocument,
): readonly IAutoMovieEvidenceSyntaxAnnotation[] {
  return /\.md$/iu.test(document.path)
    ? projectAutoMovieMarkdownSyntax(document).annotations
    : typescriptAnnotations(document);
}

/**
 * Projects reader-visible Markdown and its live evidence-comment carriers.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Keeps target prose and evidence carriers as separate, syntax-aware views.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Makes target-form validation independent of Markdown code notation.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Excludes comments, matched fences, and indented code from visible target prose.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Preserves line count so diagnostics retain their original addresses.
 */
export function projectAutoMovieMarkdownSyntax(
  document: IAutoMovieEvidenceSyntaxDocument,
): IAutoMovieMarkdownSyntaxProjection {
  const visibleLines = visibleMarkdownLines(document.source);
  const headings = visibleLines
    .map((line, index) => {
      const match = HEADING.exec(line);
      return match === null ? null : { line: index + 1, heading: match[2]! };
    })
    .filter(
      (entry): entry is { line: number; heading: string } => entry !== null,
    );
  const annotations = markdownCommentRegions(document.source)
    .filter((region) => region.closed)
    .flatMap((region) => {
      const heading = [...headings]
        .reverse()
        .find((entry) => entry.line < region.line);
      const host =
        heading === undefined
          ? `${document.path}::file`
          : markdownHost(document.path, heading.heading);
      return annotationLines(region.text, region.line).map((annotation) => ({
        ...annotation,
        host,
      }));
    });
  return { annotations, visibleLines };
}

/**
 * Removes only structural evidence comments from authored Markdown.
 *
 * General HTML comments, headings, prose, punctuation, and source line
 * endings remain protected. This is the canonical denominator for a
 * metadata-only rewrite check and for authored-body revision measurement.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Makes metadata-only operations distinguish evidence rows from authored work.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Produces a byte-comparable projection by removing only comments made entirely of evidence declarations.
 */
export function projectAutoMovieAuthoredMarkdown(source: string): string {
  const regions = markdownCommentRegions(source).filter(
    (region) => region.closed && isEvidenceComment(region.text),
  );
  let output = source;
  for (const region of [...regions].reverse())
    output = output.slice(0, region.start) + output.slice(region.end);
  return output;
}

/** Extract TypeScript annotations from documentation comments only. */
function typescriptAnnotations(
  document: IAutoMovieEvidenceSyntaxDocument,
): IAutoMovieEvidenceSyntaxAnnotation[] {
  const publicStarts = publicTypeScriptJSDocStarts(document);
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    document.source,
  );
  const output: IAutoMovieEvidenceSyntaxAnnotation[] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; ) {
    if (token === ts.SyntaxKind.MultiLineCommentTrivia) {
      const text = scanner.getTokenText();
      if (text.startsWith("/**") && publicStarts.has(scanner.getTokenPos())) {
        const line = lineOf(document.source, scanner.getTokenPos());
        const host = `${document.path}::docblock@${line}`;
        output.push(
          ...annotationLines(text.slice(3, -2), line).map((annotation) => ({
            ...annotation,
            host,
          })),
        );
      }
    }
    token = scanner.scan();
  }
  return output;
}

/** Locate JSDoc attached to exported declarations and their public members. */
function publicTypeScriptJSDocStarts(
  document: IAutoMovieEvidenceSyntaxDocument,
): Set<number> {
  const sourceFile = ts.createSourceFile(
    document.path,
    document.source,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/iu.test(document.path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const localExports = new Set<string>();
  for (const statement of sourceFile.statements)
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier === undefined &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        localExports.add((element.propertyName ?? element.name).text);
  const output = new Set<number>();
  const visit = (node: ts.Node): void => {
    if (isPublicTypeScriptNode(node, localExports)) {
      const docs = (
        node as ts.Node & {
          jsDoc?: readonly { end: number; pos: number }[];
        }
      ).jsDoc;
      for (const doc of docs ?? []) {
        const start = document.source.indexOf("/**", doc.pos);
        if (start !== -1 && start < doc.end) output.add(start);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return output;
}

/** Decide whether a declaration belongs to one exported, non-private surface. */
function isPublicTypeScriptNode(
  node: ts.Node,
  localExports: ReadonlySet<string>,
): boolean {
  let current: ts.Node = node;
  while (
    current.parent !== undefined &&
    current.parent.kind !== ts.SyntaxKind.SourceFile
  ) {
    if (
      current.kind === ts.SyntaxKind.Block ||
      (current.parent.kind === ts.SyntaxKind.ModuleBlock &&
        !hasModifier(current, ts.SyntaxKind.ExportKeyword)) ||
      isPrivateNamedNode(current) ||
      hasModifier(current, ts.SyntaxKind.PrivateKeyword) ||
      hasModifier(current, ts.SyntaxKind.ProtectedKeyword)
    )
      return false;
    current = current.parent;
  }
  return (
    current.parent?.kind === ts.SyntaxKind.SourceFile &&
    (hasModifier(current, ts.SyntaxKind.ExportKeyword) ||
      hasModifier(current, ts.SyntaxKind.DefaultKeyword) ||
      topLevelDeclarationNames(current).some((name) => localExports.has(name)))
  );
}

/** Recognize ECMAScript `#private` declarations without a private modifier. */
function isPrivateNamedNode(node: ts.Node): boolean {
  const name = (node as ts.Node & { name?: ts.Node }).name;
  return name !== undefined && ts.isPrivateIdentifier(name);
}

/** Read names that a local named-export declaration can expose. */
function topLevelDeclarationNames(node: ts.Node): string[] {
  if (ts.isVariableStatement(node))
    return node.declarationList.declarations.flatMap((declaration) =>
      bindingNames(declaration.name),
    );
  if (
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isTypeAliasDeclaration(node)
  )
    return node.name === undefined ? [] : [node.name.getText()];
  return [];
}

/** Flatten a variable binding without consulting the type checker. */
function bindingNames(name: ts.BindingName): string[] {
  return ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((element) =>
        ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
      );
}

/** Read declaration modifiers without assigning synthetic parents or symbols. */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = (
    node as ts.Node & {
      modifiers?: readonly { kind: ts.SyntaxKind }[];
    }
  ).modifiers;
  return modifiers?.some((modifier) => modifier.kind === kind) === true;
}

/** Join formatter-wrapped annotation reasons within one native carrier. */
function annotationLines(
  comment: string,
  startingLine: number,
): Array<{ endLine: number; line: number; text: string }> {
  const lines = comment.split(/\r\n|\r|\n/u).map((line) =>
    line
      .trim()
      .replace(/^\*\s?/u, "")
      .trim(),
  );
  const output: Array<{ endLine: number; line: number; text: string }> = [];
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]!;
    if (!ANNOTATION.test(text)) continue;
    let joined = text;
    let cursor = index + 1;
    while (
      cursor < lines.length &&
      lines[cursor]!.length !== 0 &&
      !ANNOTATION.test(lines[cursor]!) &&
      !/^@\S/u.test(lines[cursor]!)
    ) {
      joined += ` ${lines[cursor]!}`;
      cursor++;
    }
    output.push({
      line: startingLine + index,
      endLine: startingLine + cursor - 1,
      text: joined,
    });
    index = cursor - 1;
  }
  return output;
}

/** Locate live Markdown HTML comments outside fenced and indented code. */
function markdownCommentRegions(source: string): ICommentRegion[] {
  const lines = source.match(/[^\r\n]*(?:\r\n|\r|\n|$)/gu) ?? [];
  if (lines.at(-1) === "") lines.pop();
  const output: ICommentRegion[] = [];
  let absolute = 0;
  let open: { start: number; line: number } | undefined;
  let fence: { character: "`" | "~"; length: number } | undefined;
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    const content = raw.replace(/(?:\r\n|\r|\n)$/u, "");
    let cursor = 0;
    if (open !== undefined) {
      const close = content.indexOf("-->");
      if (close !== -1) {
        const end = absolute + close + 3;
        output.push({
          ...open,
          closed: true,
          end,
          text: source.slice(open.start + 4, end - 3),
        });
        open = undefined;
        cursor = close + 3;
      } else {
        absolute += raw.length;
        continue;
      }
    }
    if (cursor === 0) {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(content);
      if (fence !== undefined) {
        if (
          marker !== null &&
          marker[1]![0] === fence.character &&
          marker[1]!.length >= fence.length &&
          marker[2]!.trim() === ""
        )
          fence = undefined;
        absolute += raw.length;
        continue;
      }
      if (/^(?: {4}|\t)/u.test(content)) {
        absolute += raw.length;
        continue;
      }
      if (marker !== null) {
        fence = {
          character: marker[1]![0] as "`" | "~",
          length: marker[1]!.length,
        };
        absolute += raw.length;
        continue;
      }
    }
    while (cursor < content.length) {
      const start = content.indexOf("<!--", cursor);
      if (start === -1) break;
      const close = content.indexOf("-->", start + 4);
      if (close === -1) {
        open = { start: absolute + start, line: index + 1 };
        break;
      }
      const end = absolute + close + 3;
      output.push({
        start: absolute + start,
        closed: true,
        end,
        line: index + 1,
        text: content.slice(start + 4, close),
      });
      cursor = close + 3;
    }
    absolute += raw.length;
  }
  if (open !== undefined)
    output.push({
      ...open,
      closed: false,
      end: source.length,
      text: source.slice(open.start + 4),
    });
  return output;
}

/** Blank non-prose Markdown syntax without changing source line addresses. */
function visibleMarkdownLines(source: string): string[] {
  let projected = source;
  for (const region of markdownCommentRegions(source).reverse()) {
    const blank = source
      .slice(region.start, region.end)
      .replace(/[^\r\n]/gu, " ");
    projected =
      projected.slice(0, region.start) + blank + projected.slice(region.end);
  }
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  const sourceLines = source.split(/\r\n|\r|\n/u);
  const projectedLines = projected.split(/\r\n|\r|\n/u);
  for (const [index, projectedLine] of projectedLines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(projectedLine);
    if (fence !== undefined) {
      if (
        marker !== null &&
        marker[1]![0] === fence.character &&
        marker[1]!.length >= fence.length &&
        marker[2]!.trim() === ""
      )
        fence = undefined;
      output.push("");
      continue;
    }
    if (/^(?: {4}|\t)/u.test(sourceLines[index]!)) {
      output.push("");
      continue;
    }
    if (marker !== null) {
      fence = {
        character: marker[1]![0] as "`" | "~",
        length: marker[1]!.length,
      };
      output.push("");
      continue;
    }
    output.push(projectedLine.trim().length === 0 ? "" : projectedLine);
  }
  return output;
}

/** Decide whether a Markdown comment consists only of structural evidence. */
function isEvidenceComment(comment: string): boolean {
  const lines = comment.split(/\r\n|\r|\n/u).map((line) =>
    line
      .trim()
      .replace(/^\*\s?/u, "")
      .trim(),
  );
  let continuation = false;
  let found = false;
  for (const line of lines) {
    if (line.length === 0) {
      continuation = false;
      continue;
    }
    if (ANNOTATION.test(line)) {
      continuation = true;
      found = true;
    } else if (!continuation) return false;
  }
  return found;
}

/** Render the Markdown host selected by the last visible heading. */
function markdownHost(path: string, heading: string): string {
  const anchor = ANCHOR.exec(heading)?.[1];
  return anchor === undefined
    ? `${path}::${heading.replace(ANCHOR, "").trim()}`
    : `${path}#${anchor}`;
}

/** Convert one UTF-16 offset to a one-based source line. */
function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r\n|\r|\n/u).length;
}
