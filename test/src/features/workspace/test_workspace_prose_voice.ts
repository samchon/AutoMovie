import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

type Rule = {
  emDash: "allow" | "forbid";
  emoji: "allow" | "forbid";
  spacedDoubleHyphen: "allow" | "forbid";
};
type InspectProps = { file: string; rule: Rule; source: string };
const {
  AUTOMOVIE_PROSE_VOICE_RULE,
  inspectAutoMovieProseVoice,
  isAutoMovieProseVoicePath,
  repairAutoMovieProseVoice,
} = loadSourceModule<{
  AUTOMOVIE_PROSE_VOICE_RULE: Rule;
  inspectAutoMovieProseVoice: (
    props: InspectProps,
  ) => Array<{ kind: "emoji" | "em-dash" | "spaced-double-hyphen" }>;
  isAutoMovieProseVoicePath: (relative: string) => boolean;
  repairAutoMovieProseVoice: (props: InspectProps) => string;
}>(path.resolve(__dirname, "../../../../build/proseVoice.ts"));

/** Exercise the complete Markdown and TypeScript lexical boundary. */
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
  const repaired = repairAutoMovieProseVoice({
    file: "AGENTS.md",
    rule: AUTOMOVIE_PROSE_VOICE_RULE,
    source: "Keep `code — 😀 -- value`; repair prose — 😀 -- now.",
  });

  TestValidator.equals(
    "voice lint selects prose without mistaking code or literals for prose",
    namedFacts([
      [
        "markdown prose reports all three marks",
        () =>
          markdown
            .map((entry) => entry.kind)
            .sort((left, right) => Number(left > right) - Number(left < right))
            .join(",") === "em-dash,emoji,spaced-double-hyphen",
      ],
      ["Markdown code stays excluded", () => markdown.length === 3],
      ["TypeScript strings stay excluded", () => typescript.length === 3],
      [
        "TypeScript comments report all three marks",
        () =>
          typescript
            .map((entry) => entry.kind)
            .sort((left, right) => Number(left > right) - Number(left < right))
            .join(",") === "em-dash,emoji,spaced-double-hyphen",
      ],
      [
        "repair uses the same prose boundary",
        () => repaired === "Keep `code — 😀 -- value`; repair prose;  ; now.",
      ],
      [
        "the population is semantic",
        () =>
          isAutoMovieProseVoicePath(".agents/skills/review/SKILL.md") &&
          isAutoMovieProseVoicePath(
            "packages/template/scaffold/scripts/x.ts",
          ) &&
          isAutoMovieProseVoicePath("packages/engine/README.md") &&
          !isAutoMovieProseVoicePath("test/fixtures/dated-benchmark/readme.md"),
      ],
    ]),
    {
      "markdown prose reports all three marks": true,
      "Markdown code stays excluded": true,
      "TypeScript strings stay excluded": true,
      "TypeScript comments report all three marks": true,
      "repair uses the same prose boundary": true,
      "the population is semantic": true,
    },
  );
};
