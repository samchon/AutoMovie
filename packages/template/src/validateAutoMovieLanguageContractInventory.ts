import {
  AUTO_MOVIE_PRODUCTION_LANGUAGES,
  type AutoMovieProductionLanguage,
  isAutoMovieProductionLanguage,
  projectAutoMovieMarkdownSyntax,
} from "@automovie/evidence";

const CONTRACT_FILES = [
  "discovery/signals.md",
  "obligations/common.md",
  "principles/common.md",
] as const;

const CONTRACT_INVENTORY = [
  { kind: "directory", path: "discovery" },
  { kind: "file", path: "discovery/signals.md" },
  { kind: "directory", path: "obligations" },
  { kind: "file", path: "obligations/common.md" },
  { kind: "directory", path: "principles" },
  { kind: "file", path: "principles/common.md" },
] as const;

const TERMINALS: Readonly<
  Record<AutoMovieProductionLanguage, { question: string; sources: string }>
> = {
  chinese: { question: "审读问题：", sources: "来源：" },
  english: { question: "Review question:", sources: "Sources:" },
  japanese: { question: "レビュー質問:", sources: "出典:" },
  korean: { question: "검토 질문:", sources: "출처:" },
};

type RuleApplication =
  | "composition-safe"
  | "observation-only"
  | "population-distribution";

interface IExpectedRule {
  anchor: string;
  application: RuleApplication;
}

interface IHeading {
  anchor: string | undefined;
  depth: number;
  line: number;
  title: string;
}

const compare = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

const normalizedTitle = (title: string): string =>
  title.trim().toLowerCase().replace(/\s+/gu, " ");

const expectedRules = (
  language: AutoMovieProductionLanguage,
): Readonly<
  Record<(typeof CONTRACT_FILES)[number], readonly IExpectedRule[]>
> =>
  ({
    "discovery/signals.md": [
      {
        anchor: `${language}-work-specific-conditions`,
        application: "observation-only",
      },
    ],
    "obligations/common.md": [
      {
        anchor: `${language}-population-${language === "english" ? "register-frame" : "interference"}-account`,
        application: "population-distribution",
      },
      {
        anchor: `${language}-audience-language-access`,
        application: "population-distribution",
      },
    ],
    "principles/common.md": [
      {
        anchor:
          language === "english"
            ? "english-idiomatic-relation"
            : `${language}-contextual-relation`,
        application: "composition-safe",
      },
      {
        anchor: `${language}-register-ownership`,
        application: "composition-safe",
      },
    ],
  }) as const;

const headingsOf = (path: string, source: string): readonly IHeading[] =>
  projectAutoMovieMarkdownSyntax({ path, source }).visibleLines.flatMap(
    (line, index) => {
      const heading = /^(#{1,6})(?!#)\s+(\S.*)$/u.exec(line);
      if (heading === null) return [];
      const anchored = /[ \t]+\{#([^{}\s]+)\}[ \t]*$/u.exec(heading[2]!);
      return [
        {
          anchor: anchored?.[1],
          depth: heading[1]!.length,
          line: index + 1,
          title: heading[2]!.replace(/[ \t]+\{#[^{}\s]+\}[ \t]*$/u, "").trim(),
        },
      ];
    },
  );

const ruleMetadata = (
  path: string,
  source: string,
  heading: IHeading,
  next: IHeading | undefined,
): Readonly<Record<string, unknown>> => {
  const lines = source.split(/\r\n|\r|\n/u);
  const body = lines.slice(heading.line, (next?.line ?? lines.length + 1) - 1);
  const openings = body
    .map((line, index) => ({ index, line: line.trim() }))
    .filter(({ line }) => line === "```contract-rule");
  if (openings.length !== 1)
    throw new Error(
      `${path}#${heading.anchor}: expected exactly one contract-rule block; received ${openings.length}.`,
    );
  const first = body.findIndex((line) => line.trim().length !== 0);
  if (first !== openings[0]!.index)
    throw new Error(
      `${path}#${heading.anchor}: contract-rule metadata must immediately follow its H2.`,
    );
  const closing = body.findIndex(
    (line, index) => index > first && line.trim() === "```",
  );
  if (closing === -1)
    throw new Error(
      `${path}#${heading.anchor}: contract-rule block is not closed.`,
    );
  let decoded: unknown;
  try {
    decoded = JSON.parse(body.slice(first + 1, closing).join("\n"));
  } catch {
    throw new Error(
      `${path}#${heading.anchor}: contract-rule metadata must be valid JSON.`,
    );
  }
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded))
    throw new Error(
      `${path}#${heading.anchor}: contract-rule metadata must be an object.`,
    );
  const metadata = decoded as Record<string, unknown>;
  const keys = ["id", "safeApplication", "sourceIdentity", "status", "timing"];
  const received = Object.keys(metadata).sort(compare);
  const expected = [...keys].sort(compare);
  if (
    received.length !== expected.length ||
    received.some((key, index) => key !== expected[index])
  )
    throw new Error(
      `${path}#${heading.anchor}: contract-rule metadata fields must be exactly ${expected.join(", ")}.`,
    );
  for (const key of ["sourceIdentity", "timing"])
    if (typeof metadata[key] !== "string" || metadata[key].trim() === "")
      throw new Error(
        `${path}#${heading.anchor}: ${key} must be a non-empty string.`,
      );
  return metadata;
};

const validateDocument = (props: {
  anchors: Map<string, string>;
  expected: readonly IExpectedRule[];
  language: AutoMovieProductionLanguage;
  path: string;
  source: string;
  titles: Map<string, string>;
}): void => {
  const visible = projectAutoMovieMarkdownSyntax({
    path: props.path,
    source: props.source,
  }).visibleLines;
  const headings = headingsOf(props.path, props.source);
  const h1 = headings.filter((heading) => heading.depth === 1);
  const firstVisible =
    visible.findIndex((line) => line.trim().length !== 0) + 1;
  if (
    h1.length !== 1 ||
    headings[0]?.depth !== 1 ||
    h1[0]?.line !== firstVisible
  )
    throw new Error(
      `${props.path}: selected language contract must begin with exactly one H1.`,
    );
  const unsupported = headings.find(
    (heading) => heading.depth !== 1 && heading.depth !== 2,
  );
  if (unsupported !== undefined)
    throw new Error(
      `${props.path}:${unsupported.line}: selected language contracts use only H1 and anchored H2.`,
    );
  const units = headings.filter((heading) => heading.depth === 2);
  const unanchored = units.find((heading) => heading.anchor === undefined);
  if (unanchored !== undefined)
    throw new Error(
      `${props.path}:${unanchored.line}: language contract H2 requires an explicit anchor.`,
    );
  if (
    units.length !== props.expected.length ||
    units.some((unit, index) => unit.anchor !== props.expected[index]!.anchor)
  )
    throw new Error(
      `${props.path}: language rule anchors must be exactly ${props.expected.map((rule) => rule.anchor).join(", ")}.`,
    );
  const terminals = TERMINALS[props.language];
  for (const [index, unit] of units.entries()) {
    const owner = `${props.path}#${unit.anchor}`;
    const previousAnchor = props.anchors.get(unit.anchor!);
    if (previousAnchor !== undefined)
      throw new Error(
        `${owner}: duplicates target anchor already owned by ${previousAnchor}.`,
      );
    props.anchors.set(unit.anchor!, owner);
    const title = normalizedTitle(unit.title);
    const previousTitle = props.titles.get(title);
    if (previousTitle !== undefined)
      throw new Error(
        `${owner}: duplicates target title already owned by ${previousTitle}.`,
      );
    props.titles.set(title, owner);

    const next = units[index + 1];
    const metadata = ruleMetadata(props.path, props.source, unit, next);
    const expected = props.expected[index]!;
    if (metadata.id !== unit.anchor || metadata.id !== expected.anchor)
      throw new Error(
        `${owner}: contract-rule id must equal its canonical H2 anchor.`,
      );
    if (metadata.status !== "active")
      throw new Error(
        `${owner}: bundled language rules must remain active; received ${JSON.stringify(metadata.status)}.`,
      );
    if (metadata.safeApplication !== expected.application)
      throw new Error(
        `${owner}: expected safe application ${expected.application}; received ${JSON.stringify(metadata.safeApplication)}.`,
      );

    const body = visible.slice(
      unit.line,
      (next?.line ?? visible.length + 1) - 1,
    );
    const questions = body.filter(
      (line) =>
        line.startsWith(terminals.question) &&
        line.slice(terminals.question.length).trim().length !== 0,
    );
    const sources = body.filter(
      (line) =>
        line.startsWith(terminals.sources) &&
        line.slice(terminals.sources.length).trim().length !== 0,
    );
    if (questions.length !== 1 || sources.length !== 1)
      throw new Error(
        `${owner}: expected exactly one localized ${terminals.question} line and one localized ${terminals.sources} line.`,
      );
    const last = [...body].reverse().find((line) => line.trim().length !== 0);
    if (last !== sources[0])
      throw new Error(`${owner}: localized sources line must end the H2.`);
  }
};

/**
 * Validate one in-memory package-private language module before it is emitted.
 *
 * This is an internal product seam used by the physical package loader and its
 * semantic unit tests. It is deliberately absent from the package barrel.
 *
 * @internal
 */
export const validateAutoMovieLanguageContractInventory = (props: {
  entries: readonly (
    | { kind: "directory"; path: string }
    | { content: string; kind: "file"; path: string }
    | { kind: "link" | "other"; path: string }
  )[];
  language: string;
  reservedTargets?: readonly {
    anchor: string;
    owner: string;
    title: string;
  }[];
}): Record<string, string> => {
  if (!isAutoMovieProductionLanguage(props.language))
    throw new Error(
      `${props.language || "(missing)"}: expected one bundled production language (${AUTO_MOVIE_PRODUCTION_LANGUAGES.join(", ")}).`,
    );
  const entries = [...props.entries].sort((left, right) =>
    compare(left.path, right.path),
  );
  const paths = new Set<string>();
  for (const entry of entries) {
    if (entry.path.includes("\\") || entry.path.startsWith("/"))
      throw new Error(
        `${entry.path}: language inventory paths must be relative POSIX paths.`,
      );
    if (paths.has(entry.path))
      throw new Error(`${entry.path}: language inventory path is repeated.`);
    paths.add(entry.path);
  }
  if (
    entries.length !== CONTRACT_INVENTORY.length ||
    entries.some(
      (entry, index) =>
        entry.path !== CONTRACT_INVENTORY[index]!.path ||
        entry.kind !== CONTRACT_INVENTORY[index]!.kind,
    )
  )
    throw new Error(
      `${props.language}: bundled language contract inventory must contain exactly ${CONTRACT_INVENTORY.map((entry) => `${entry.kind} ${entry.path}`).join(", ")}; received ${entries.map((entry) => `${entry.kind} ${entry.path}`).join(", ") || "(empty)"}.`,
    );

  const anchors = new Map<string, string>();
  const titles = new Map<string, string>();
  for (const target of props.reservedTargets ?? []) {
    const previousAnchor = anchors.get(target.anchor);
    if (previousAnchor !== undefined)
      throw new Error(
        `${target.owner}: reserved target anchor duplicates ${previousAnchor}.`,
      );
    anchors.set(target.anchor, target.owner);
    const title = normalizedTitle(target.title);
    const previousTitle = titles.get(title);
    if (previousTitle !== undefined)
      throw new Error(
        `${target.owner}: reserved target title duplicates ${previousTitle}.`,
      );
    titles.set(title, target.owner);
  }

  const output: Record<string, string> = {};
  const rules = expectedRules(props.language);
  for (const path of CONTRACT_FILES) {
    const entry = entries.find(
      (
        candidate,
      ): candidate is { content: string; kind: "file"; path: string } =>
        candidate.kind === "file" && candidate.path === path,
    )!;
    validateDocument({
      anchors,
      expected: rules[path],
      language: props.language,
      path,
      source: entry.content,
      titles,
    });
    output[`docs/language/${path}`] = entry.content.replace(/\r\n|\r/gu, "\n");
  }
  return output;
};
