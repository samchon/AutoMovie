import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

type ViolationKind = "emoji" | "em-dash" | "spaced-double-hyphen";
type PopulationCategory =
  | "package-readme"
  | "root-instruction"
  | "root-skill"
  | "scaffold";
type Rule = {
  emDash: "allow" | "forbid";
  emoji: "allow" | "forbid";
  spacedDoubleHyphen: "allow" | "forbid";
};
type InspectProps = { file: string; rule: Rule; source: string };
type Violation = {
  column: number;
  file: string;
  kind: ViolationKind;
  line: number;
  offset: number;
  text: string;
};

const {
  AUTOMOVIE_PROSE_VOICE_RULE,
  autoMovieProseVoicePopulationCategory,
  inspectAutoMovieProseVoice,
  isAutoMovieProseVoicePath,
} = loadSourceModule<{
  AUTOMOVIE_PROSE_VOICE_RULE: Rule;
  autoMovieProseVoicePopulationCategory: (
    relative: string,
  ) => PopulationCategory | null;
  inspectAutoMovieProseVoice: (props: InspectProps) => Violation[];
  isAutoMovieProseVoicePath: (relative: string) => boolean;
}>(path.resolve(__dirname, "../../../../build/proseVoice.ts"));

const locations = (violations: readonly Violation[]) =>
  violations.map(({ column, kind, line, text }) => ({
    column,
    kind,
    line,
    text,
  }));

/**
 * Exercise the repository prose rule at every lexical boundary it excludes.
 *
 * Scenarios:
 *
 * 1. Markdown prose reports each forbidden mark while en dashes, code spans,
 *    and fenced code remain inert.
 * 2. Multiline code spans and fences nested in block quotes or list items stay
 *    excluded, while malformed openers and closers remain visible prose.
 * 3. Escaped and unmatched backtick runs remain prose, and exact matched runs
 *    remain code.
 * 4. LF, CRLF, and CR inputs report the same lines and exact source offsets.
 * 5. TypeScript comments are visible while literals and JSX attributes remain
 *    inert across the supported TypeScript extensions.
 * 6. RGI emoji sequences are one violation each, while text-presentation
 *    symbols remain prose without becoming emoji.
 * 7. Rule inputs independently allow each mark, and semantic path categories
 *    include the governed population without admitting fixtures or baselines.
 */
export const test_workspace_prose_voice = (): void => {
  const markdown = inspectAutoMovieProseVoice({
    file: "AGENTS.md",
    rule: AUTOMOVIE_PROSE_VOICE_RULE,
    source: [
      "Prose — mark.",
      "Prose 😀 mark.",
      "Prose -- mark.",
      "Allowed – en dash.",
      "`code — 😀 -- value`",
      "```ts",
      'const fenced = "— 😀 --";',
      "```",
    ].join("\n"),
  });
  TestValidator.equals(
    "Markdown selects only visible forbidden prose",
    locations(markdown),
    [
      { column: 7, kind: "em-dash", line: 1, text: "—" },
      { column: 7, kind: "emoji", line: 2, text: "😀" },
      { column: 7, kind: "spaced-double-hyphen", line: 3, text: "--" },
    ],
  );

  const markdownBoundaries = inspectAutoMovieProseVoice({
    file: "README.md",
    rule: AUTOMOVIE_PROSE_VOICE_RULE,
    source: [
      "Before `code",
      "still — 😀 -- code` after.",
      "> ```ts",
      '> const quoted = "— 😀 --";',
      "> ````",
      "- ~~~ts",
      '  const listed = "— 😀 --";',
      "  ~~~",
      "````md",
      "inside —",
      "```",
      "```` trailing",
      "still 😀",
      "````",
      "outside -- mark",
      "``` bad ` info",
      "visible —",
      "~~~ info ` is valid",
      "hidden 😀",
      "~~~",
    ].join("\n"),
  });
  TestValidator.equals(
    "Markdown respects container fences and valid fence grammar",
    markdownBoundaries.map(({ kind, line }) => ({ kind, line })),
    [
      { kind: "spaced-double-hyphen", line: 15 },
      { kind: "em-dash", line: 17 },
    ],
  );

  TestValidator.equals(
    "escaped backticks remain prose",
    inspectAutoMovieProseVoice({
      file: "README.md",
      rule: AUTOMOVIE_PROSE_VOICE_RULE,
      source: "Escaped \\`not code —\\` stays prose.",
    }).map(({ kind }) => kind),
    ["em-dash"],
  );
  TestValidator.equals(
    "unmatched backtick runs remain prose",
    [
      inspectAutoMovieProseVoice({
        file: "README.md",
        rule: AUTOMOVIE_PROSE_VOICE_RULE,
        source: "`unmatched — stays prose.",
      }).map(({ kind }) => kind),
      inspectAutoMovieProseVoice({
        file: "README.md",
        rule: AUTOMOVIE_PROSE_VOICE_RULE,
        source: "``unmatched 😀 stays prose.",
      }).map(({ kind }) => kind),
      inspectAutoMovieProseVoice({
        file: "README.md",
        rule: AUTOMOVIE_PROSE_VOICE_RULE,
        source: "Matched ``code —`` stays excluded.",
      }).map(({ kind }) => kind),
    ],
    [["em-dash"], ["emoji"], []],
  );

  for (const [name, ending] of [
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["CR", "\r"],
  ] as const) {
    const source = ["alpha —", "beta 😀", "gamma -- end"].join(ending);
    TestValidator.equals(
      `${name} locations preserve exact offsets`,
      inspectAutoMovieProseVoice({
        file: "README.md",
        rule: AUTOMOVIE_PROSE_VOICE_RULE,
        source,
      }),
      [
        {
          column: 7,
          file: "README.md",
          kind: "em-dash",
          line: 1,
          offset: source.indexOf("—"),
          text: "—",
        },
        {
          column: 6,
          file: "README.md",
          kind: "emoji",
          line: 2,
          offset: source.indexOf("😀"),
          text: "😀",
        },
        {
          column: 7,
          file: "README.md",
          kind: "spaced-double-hyphen",
          line: 3,
          offset: source.indexOf("--"),
          text: "--",
        },
      ],
    );
    const protectedSource = [
      "`code",
      "— 😀 --`",
      "```text",
      "— 😀 --",
      "```",
      "visible —",
    ].join(ending);
    TestValidator.equals(
      `${name} code exclusions preserve the visible source address`,
      inspectAutoMovieProseVoice({
        file: "README.md",
        rule: AUTOMOVIE_PROSE_VOICE_RULE,
        source: protectedSource,
      }),
      [
        {
          column: 9,
          file: "README.md",
          kind: "em-dash",
          line: 6,
          offset: protectedSource.lastIndexOf("—"),
          text: "—",
        },
      ],
    );
  }

  const typescript = inspectAutoMovieProseVoice({
    file: "packages/template/scaffold/scripts/example.ts",
    rule: AUTOMOVIE_PROSE_VOICE_RULE,
    source: [
      'const literal = "— 😀 --";',
      "// Comment — mark",
      "/** Comment 😀 mark. */",
      'const separator = ["--"] as const;',
      "// Comment -- mark",
    ].join("\n"),
  });
  TestValidator.equals(
    "TypeScript selects comments without selecting literals",
    typescript.map(({ kind, line }) => ({ kind, line })),
    [
      { kind: "em-dash", line: 2 },
      { kind: "emoji", line: 3 },
      { kind: "spaced-double-hyphen", line: 5 },
    ],
  );
  TestValidator.equals(
    "TypeScript variants preserve the literal boundary",
    ["cts", "mts", "tsx"].map((extension) =>
      inspectAutoMovieProseVoice({
        file: `packages/template/scaffold/example.${extension}`,
        rule: AUTOMOVIE_PROSE_VOICE_RULE,
        source:
          extension === "tsx"
            ? '<div title="—" />; // Comment 😀'
            : 'const literal = "—"; // Comment 😀',
      }).map(({ kind }) => kind),
    ),
    [["emoji"], ["emoji"], ["emoji"]],
  );

  const emojiSource = "😀 🇰🇷 1️⃣ 👍🏽 👨‍👩‍👧‍👦 © ™ ↔ ©️ ™️ ↔️";
  TestValidator.equals(
    "emoji matching follows complete RGI sequences",
    inspectAutoMovieProseVoice({
      file: "README.md",
      rule: AUTOMOVIE_PROSE_VOICE_RULE,
      source: emojiSource,
    }).map(({ kind, offset, text }) => ({ kind, offset, text })),
    ["😀", "🇰🇷", "1️⃣", "👍🏽", "👨‍👩‍👧‍👦", "©️", "™️", "↔️"].map((text) => ({
      kind: "emoji" as const,
      offset: emojiSource.indexOf(text),
      text,
    })),
  );

  const allowEmoji: Rule = {
    ...AUTOMOVIE_PROSE_VOICE_RULE,
    emoji: "allow",
  };
  const allowDash: Rule = {
    ...AUTOMOVIE_PROSE_VOICE_RULE,
    emDash: "allow",
  };
  const allowHyphen: Rule = {
    ...AUTOMOVIE_PROSE_VOICE_RULE,
    spacedDoubleHyphen: "allow",
  };
  TestValidator.equals(
    "rule inputs independently allow each mark",
    [allowEmoji, allowDash, allowHyphen].map((rule) =>
      inspectAutoMovieProseVoice({
        file: "README.md",
        rule,
        source: "Prose — 😀 -- mark.",
      }).map(({ kind }) => kind),
    ),
    [
      ["em-dash", "spaced-double-hyphen"],
      ["emoji", "spaced-double-hyphen"],
      ["em-dash", "emoji"],
    ],
  );

  const paths = [
    "AGENTS.md",
    "README.md",
    ".agents\\skills\\review\\SKILL.md",
    ".agents/skills/experiment/baselines/dated.md",
    "packages/engine/README.md",
    "packages/playground/scripts/README.md",
    "packages/template/scaffold/docs/README.md",
    "packages/template/scaffold/example.cts",
    "packages/template/scaffold/example.mts",
    "packages/template/scaffold/example.tsx",
    "test/fixtures/dated-benchmark/readme.md",
    "experimental/run/HANDOFF.md",
  ];
  TestValidator.equals(
    "population paths carry semantic categories",
    paths.map((entry) => ({
      category: autoMovieProseVoicePopulationCategory(entry),
      selected: isAutoMovieProseVoicePath(entry),
    })),
    [
      { category: "root-instruction", selected: true },
      { category: "root-instruction", selected: true },
      { category: "root-skill", selected: true },
      { category: null, selected: false },
      { category: "package-readme", selected: true },
      { category: null, selected: false },
      { category: "scaffold", selected: true },
      { category: "scaffold", selected: true },
      { category: "scaffold", selected: true },
      { category: "scaffold", selected: true },
      { category: null, selected: false },
      { category: null, selected: false },
    ],
  );
};
