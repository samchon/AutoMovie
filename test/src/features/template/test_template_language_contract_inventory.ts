import { AUTO_MOVIE_PRODUCTION_LANGUAGES } from "@automovie/evidence";
import { renderAutoMovieLanguageContracts } from "@automovie/template";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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

type Entries = Parameters<
  typeof validateAutoMovieLanguageContractInventory
>[0]["entries"];

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

/**
 * The bundled language module is validated as one exact physical inventory
 * before any of it is rendered into a project.
 *
 * Scenarios:
 *
 * 1. Every bundled language validates from memory and renders the same three
 *    project-local paths from the installed package assets.
 * 2. A localized terminal that is misspelled, a reserved anchor or title that
 *    a shared contract already owns, an unknown language, and an inventory
 *    with a missing or extra member are refused.
 * 3. Every structural rule of one contract document is enforced by name: the
 *    anchor, id, status, safe application, rule-block count and position,
 *    closing fence, JSON shape, exact metadata keys, non-empty strings, single
 *    leading H1, H1-and-H2-only depth, exact anchor set, and the sources line
 *    ending the H2.
 * 4. Inventory paths must be unique relative POSIX paths whose kinds match the
 *    bundled shape, and reserved targets may not repeat an anchor or title.
 * 5. Rendering from an explicit asset root refuses a linked or non-UTF-8
 *    module entry, a linked or missing shared contract family, and a missing
 *    module or asset directory, each with the offending path.
 */
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

  const englishInventory = inventory("english");
  const signals = englishInventory.find(
    (entry) => entry.kind === "file" && entry.path === "discovery/signals.md",
  ) as { content: string; kind: "file"; path: string };
  const withSignals = (content: string): Entries =>
    englishInventory.map((entry) =>
      entry === signals ? { ...signals, content } : entry,
    );
  const refusal = (
    entries: Entries,
    reservedTargets?: readonly {
      anchor: string;
      owner: string;
      title: string;
    }[],
  ): string => {
    try {
      validateAutoMovieLanguageContractInventory({
        entries,
        language: "english",
        reservedTargets,
      });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  const fence = "```contract-rule";
  const structural: Record<string, string> = {
    twoBlocks: signals.content.replace(
      "Body for",
      `${fence}\n{}\n\`\`\`\n\nBody for`,
    ),
    proseBeforeBlock: signals.content.replace(
      `\n${fence}`,
      `\nIntro.\n\n${fence}`,
    ),
    unclosedBlock: signals.content.replace(
      /\n```\n\nBody for/u,
      "\n\nBody for",
    ),
    invalidJson: signals.content.replace('"id": "', '"id": '),
    arrayMetadata: signals.content.replace(
      /```contract-rule\n[\s\S]*?\n```/u,
      "```contract-rule\n[]\n```",
    ),
    extraKey: signals.content.replace(
      '"sourceIdentity": "fixture@1"',
      '"sourceIdentity": "fixture@1",\n  "extra": 1',
    ),
    blankTiming: signals.content.replace(
      '"timing": "during the exact authored boundary"',
      '"timing": " "',
    ),
    noH1: signals.content.replace("# english contract\n", ""),
    h3: signals.content.replace("Body for", "### Deeper\n\nBody for"),
    foreignAnchor: signals.content.replaceAll(
      "english-work-specific-conditions",
      "english-foreign-conditions",
    ),
    trailingProse: `${signals.content}\nTrailing prose.\n`,
  };
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(structural).map(([name, content]) => [
        name,
        refusal(withSignals(content)),
      ]),
    ),
    {
      twoBlocks:
        "discovery/signals.md#english-work-specific-conditions: expected exactly one contract-rule block; received 2.",
      proseBeforeBlock:
        "discovery/signals.md#english-work-specific-conditions: contract-rule metadata must immediately follow its H2.",
      unclosedBlock:
        "discovery/signals.md#english-work-specific-conditions: contract-rule block is not closed.",
      invalidJson:
        "discovery/signals.md#english-work-specific-conditions: contract-rule metadata must be valid JSON.",
      arrayMetadata:
        "discovery/signals.md#english-work-specific-conditions: contract-rule metadata must be an object.",
      extraKey:
        "discovery/signals.md#english-work-specific-conditions: contract-rule metadata fields must be exactly id, safeApplication, sourceIdentity, status, timing.",
      blankTiming:
        "discovery/signals.md#english-work-specific-conditions: timing must be a non-empty string.",
      noH1: "discovery/signals.md: selected language contract must begin with exactly one H1.",
      h3: "discovery/signals.md:15: selected language contracts use only H1 and anchored H2.",
      foreignAnchor:
        "discovery/signals.md: language rule anchors must be exactly english-work-specific-conditions.",
      trailingProse:
        "discovery/signals.md#english-work-specific-conditions: localized sources line must end the H2.",
    },
  );

  const relocate = (to: string): Entries =>
    englishInventory.map((entry) =>
      entry === signals ? { ...signals, path: to } : entry,
    );
  assert.deepEqual(
    {
      backslash: refusal(relocate("discovery\\signals.md")),
      absolute: refusal(relocate("/discovery/signals.md")),
      repeated: refusal([...englishInventory, englishInventory[0]!]),
      empty: refusal([]),
      kindMismatch: refusal(
        englishInventory.map((entry) =>
          entry.path === "discovery"
            ? { kind: "link" as const, path: "discovery" }
            : entry,
        ),
      ),
      reservedAnchor: refusal(englishInventory, [
        { anchor: "shared", owner: "a.md#shared", title: "Shared A" },
        { anchor: "shared", owner: "b.md#shared", title: "Shared B" },
      ]),
      reservedTitle: refusal(englishInventory, [
        { anchor: "one", owner: "a.md#one", title: "Same Title" },
        { anchor: "two", owner: "b.md#two", title: "same   title" },
      ]),
    },
    {
      backslash:
        "discovery\\signals.md: language inventory paths must be relative POSIX paths.",
      absolute:
        "/discovery/signals.md: language inventory paths must be relative POSIX paths.",
      repeated: "discovery: language inventory path is repeated.",
      empty:
        "english: bundled language contract inventory must contain exactly directory discovery, file discovery/signals.md, directory obligations, file obligations/common.md, directory principles, file principles/common.md; received (empty).",
      kindMismatch:
        "english: bundled language contract inventory must contain exactly directory discovery, file discovery/signals.md, directory obligations, file obligations/common.md, directory principles, file principles/common.md; received link discovery, file discovery/signals.md, directory obligations, file obligations/common.md, directory principles, file principles/common.md.",
      reservedAnchor:
        "b.md#shared: reserved target anchor duplicates a.md#shared.",
      reservedTitle: "b.md#two: reserved target title duplicates a.md#one.",
    },
  );

  const assetRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-language-assets-"),
  );
  try {
    const assets = path.join(assetRoot, "language-contracts");
    const module = path.join(assets, "english");
    for (const entry of englishInventory) {
      const target = path.join(module, ...entry.path.split("/"));
      if (entry.kind === "directory") fs.mkdirSync(target, { recursive: true });
      else fs.writeFileSync(target, (entry as { content: string }).content);
    }
    const docs = path.join(assetRoot, "scaffold", "docs");
    for (const family of ["discovery", "obligations", "principles", "upstream"])
      fs.mkdirSync(path.join(docs, family), { recursive: true });
    fs.writeFileSync(
      path.join(docs, "discovery", "shared.md"),
      "# Shared\n\n## Shared rule {#shared-rule}\n\nText.\n",
    );
    const render = (language: string = "english"): string => {
      try {
        return Object.keys(
          renderAutoMovieLanguageContracts({ language, assetRoot }),
        ).join(",");
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    const rendered = render();
    const moduleLink = path.join(module, "linked");
    fs.symlinkSync(path.join(docs, "upstream"), moduleLink, "junction");
    const linkedModule = render();
    fs.rmSync(moduleLink, { force: true });
    const signalsFile = path.join(module, "discovery", "signals.md");
    fs.writeFileSync(signalsFile, Buffer.from([0xff, 0xfe, 0x00]));
    const invalidEncoding = render();
    fs.writeFileSync(signalsFile, signals.content);
    const docsLink = path.join(docs, "discovery", "linked");
    fs.symlinkSync(path.join(docs, "upstream"), docsLink, "junction");
    const linkedDocs = render();
    fs.rmSync(docsLink, { force: true });
    fs.rmSync(path.join(docs, "upstream"), { recursive: true });
    const missingFamily = render();
    fs.rmSync(module, { recursive: true });
    const missingModule = render();
    fs.rmSync(assets, { recursive: true });
    const missingAssets = render();
    assert.deepEqual(
      {
        rendered,
        linkedModule,
        invalidEncoding,
        linkedDocs,
        missingFamily,
        missingModule,
        missingAssets,
        unknownLanguage: render("french"),
        missingLanguage: render(""),
      },
      {
        rendered: PATHS.join(","),
        linkedModule: `${moduleLink}: language contract assets must be physical files and directories.`,
        invalidEncoding: `${signalsFile}: language contract asset must be strict UTF-8.`,
        linkedDocs: `${docsLink}: scaffold contract assets may not be linked.`,
        missingFamily: `${path.join(docs, "upstream")}: scaffold contract asset root must be a physical directory.`,
        missingModule: `english: bundled language contract directory is missing: ${module}`,
        missingAssets: `language contract assets are missing: ${assets}`,
        unknownLanguage:
          "french: expected one bundled production language (chinese, english, japanese, korean).",
        missingLanguage:
          "(missing): expected one bundled production language (chinese, english, japanese, korean).",
      },
    );
  } finally {
    fs.rmSync(assetRoot, { force: true, recursive: true });
  }
};
