import { AUTO_MOVIE_PRODUCTION_LANGUAGES } from "@automovie/evidence";
import { renderAutoMovieLanguageContracts } from "@automovie/template";
import assert from "node:assert/strict";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { validateAutoMovieLanguageContractInventory } = loadSourceModule<{
  validateAutoMovieLanguageContractInventory: (props: {
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
  }) => Record<string, string>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/src/validateAutoMovieLanguageContractInventory.ts",
  ),
);

const PATHS = [
  "docs/language/discovery/signals.md",
  "docs/language/obligations/common.md",
  "docs/language/principles/common.md",
];

const TERMINALS = {
  chinese: {
    question: "\u5ba1\u8bfb\u95ee\u9898\uff1a",
    sources: "\u6765\u6e90\uff1a",
  },
  english: { question: "Review question:", sources: "Sources:" },
  japanese: {
    question: "\u30ec\u30d3\u30e5\u30fc\u8cea\u554f:",
    sources: "\u51fa\u5178:",
  },
  korean: {
    question: "\uac80\ud1a0 \uc9c8\ubb38:",
    sources: "\ucd9c\ucc98:",
  },
} as const;

type Language = keyof typeof TERMINALS;

const routes = (language: Language) => ({
  discovery: [
    [`${language}-work-specific-conditions`, "observation-only"],
  ] as const,
  obligations: [
    [
      `${language}-population-${language === "english" ? "register-frame" : "interference"}-account`,
      "population-distribution",
    ],
    [`${language}-audience-language-access`, "population-distribution"],
  ] as const,
  principles: [
    [
      language === "english"
        ? "english-idiomatic-relation"
        : `${language}-contextual-relation`,
      "composition-safe",
    ],
    [`${language}-register-ownership`, "composition-safe"],
  ] as const,
});

const document = (
  language: Language,
  rules: readonly (readonly [string, string])[],
): string => {
  const terminal = TERMINALS[language];
  return [
    `# ${language} contract`,
    "",
    ...rules.flatMap(([anchor, application]) => [
      `## Title ${anchor} {#${anchor}}`,
      "",
      "```contract-rule",
      JSON.stringify(
        {
          id: anchor,
          status: "active",
          safeApplication: application,
          timing: "during the exact authored boundary",
          sourceIdentity: "fixture@1",
        },
        null,
        2,
      ),
      "```",
      "",
      `Body for ${anchor}.`,
      "",
      `${terminal.question} What falsifies ${anchor}?`,
      "",
      `${terminal.sources} Source for ${anchor}.`,
      "",
    ]),
  ].join("\n");
};

const inventory = (language: Language) => {
  const expected = routes(language);
  return [
    { kind: "directory" as const, path: "discovery" },
    {
      content: document(language, expected.discovery),
      kind: "file" as const,
      path: "discovery/signals.md",
    },
    { kind: "directory" as const, path: "obligations" },
    {
      content: document(language, expected.obligations),
      kind: "file" as const,
      path: "obligations/common.md",
    },
    { kind: "directory" as const, path: "principles" },
    {
      content: document(language, expected.principles),
      kind: "file" as const,
      path: "principles/common.md",
    },
  ];
};

const replace = (
  entries: ReturnType<typeof inventory>,
  path: string,
  from: string,
  to: string,
): ReturnType<typeof inventory> =>
  entries.map((entry) =>
    entry.kind !== "file" || entry.path !== path
      ? entry
      : { ...entry, content: entry.content.replace(from, to) },
  );

export const test_template_language_contract_inventory = (): void => {
  for (const language of AUTO_MOVIE_PRODUCTION_LANGUAGES) {
    assert.deepEqual(
      Object.keys(
        validateAutoMovieLanguageContractInventory({
          entries: inventory(language),
          language,
        }),
      ),
      PATHS,
    );
    assert.deepEqual(
      Object.keys(renderAutoMovieLanguageContracts({ language })),
      PATHS,
      `${language} renders the canonical package-private module`,
    );

    const firstAnchor = routes(language).discovery[0][0];
    assert.throws(
      () =>
        validateAutoMovieLanguageContractInventory({
          entries: replace(
            inventory(language),
            "discovery/signals.md",
            TERMINALS[language].question,
            "Wrong question:",
          ),
          language,
        }),
      /localized/u,
    );
    assert.throws(
      () =>
        validateAutoMovieLanguageContractInventory({
          entries: replace(
            inventory(language),
            "discovery/signals.md",
            TERMINALS[language].sources,
            "Wrong sources:",
          ),
          language,
        }),
      /localized/u,
    );
    assert.throws(
      () =>
        validateAutoMovieLanguageContractInventory({
          entries: inventory(language),
          language,
          reservedTargets: [
            {
              anchor: firstAnchor,
              owner: "principles/core/common.md#reserved",
              title: "Reserved title",
            },
          ],
        }),
      /duplicates target anchor/u,
    );
    assert.throws(
      () =>
        validateAutoMovieLanguageContractInventory({
          entries: inventory(language),
          language,
          reservedTargets: [
            {
              anchor: "reserved-anchor",
              owner: "principles/core/common.md#reserved-anchor",
              title: `Title ${firstAnchor}`,
            },
          ],
        }),
      /duplicates target title/u,
    );
  }

  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: inventory("english"),
        language: "",
      }),
    /expected one bundled production language/u,
  );
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: inventory("english"),
        language: "french",
      }),
    /expected one bundled production language/u,
  );

  const missing = inventory("english").filter(
    (entry) => entry.path !== "discovery/signals.md",
  );
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: missing,
        language: "english",
      }),
    /inventory must contain exactly/u,
  );
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: [
          ...inventory("english"),
          { content: "residue", kind: "file", path: "residue.txt" },
        ],
        language: "english",
      }),
    /inventory must contain exactly/u,
  );

  const englishAnchor = routes("english").discovery[0][0];
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: replace(
          inventory("english"),
          "discovery/signals.md",
          ` {#${englishAnchor}}`,
          "",
        ),
        language: "english",
      }),
    /requires an explicit anchor/u,
  );
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: replace(
          inventory("english"),
          "discovery/signals.md",
          `"id": "${englishAnchor}"`,
          '"id": "different-id"',
        ),
        language: "english",
      }),
    /id must equal its canonical H2 anchor/u,
  );
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: replace(
          inventory("english"),
          "discovery/signals.md",
          '"status": "active"',
          '"status": "rejected"',
        ),
        language: "english",
      }),
    /must remain active/u,
  );
  assert.throws(
    () =>
      validateAutoMovieLanguageContractInventory({
        entries: replace(
          inventory("english"),
          "discovery/signals.md",
          '"safeApplication": "observation-only"',
          '"safeApplication": "composition-safe"',
        ),
        language: "english",
      }),
    /expected safe application observation-only/u,
  );
};
