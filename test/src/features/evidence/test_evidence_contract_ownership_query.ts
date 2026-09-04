import { TestValidator } from "@nestia/e2e";

import {
  collectContractEvidenceCarrierBlocks,
  collectContractUnitsFromDocuments,
  isContractPackageOwner,
  matchesConfiguredFiles,
} from "../../integrity/contractOwnership";

/**
 * Manual ownership queries read the same visible documents and configured
 * public carrier population as the evidence graph.
 *
 * Scenarios:
 * 1. a visible anchored heading becomes a unit while headings inside an HTML
 *    comment or fenced example do not;
 * 2. ordered source globs admit a selected file, remove an excluded file, and
 *    permit a later positive pattern to add a file back;
 * 3. only a selected public declaration of the configured symbol kind carries
 *    a target, while private declarations, excluded files, hidden declarations,
 *    and declarations selected only by another reference do not; and
 * 4. unscoped workspace package names come from actual manifests, so
 *    `create-automovie` is known while an absent package is not.
 */
export const test_evidence_contract_ownership_query = (): void => {
  const target =
    "requirements/production-evidence/graph.md#visible-contract-unit";
  const units = collectContractUnitsFromDocuments([
    {
      file: "graph.md",
      relative: "requirements/production-evidence/graph.md",
      text: [
        "# Evidence",
        "",
        "<!--",
        "## Commented {#commented-unit}",
        "-->",
        "",
        "```md",
        "### Example {#example-unit}",
        "```",
        "",
        "## Visible {#visible-contract-unit}",
        "",
        "Owned prose.",
      ].join("\n"),
    },
  ]);
  TestValidator.equals(
    "only visible headings become contract units",
    [...units.keys()],
    [target],
  );

  const patterns = [
    "src/**/*.ts",
    "!src/private/**/*.ts",
    "src/private/reviewed.ts",
  ];
  TestValidator.equals(
    "configured file populations retain left-to-right graph semantics",
    {
      public: matchesConfiguredFiles("src/public.ts", patterns),
      private: matchesConfiguredFiles("src/private/hidden.ts", patterns),
      restored: matchesConfiguredFiles("src/private/reviewed.ts", patterns),
    },
    { public: true, private: false, restored: true },
  );

  const citation = `@evidence ${target} The exported value owns this unit.`;
  const blocks = collectContractEvidenceCarrierBlocks(
    [
      {
        path: "src/public.ts",
        source: [
          `/** ${citation} */`,
          "export const selected = 1;",
          `/** ${citation} */`,
          "const privateValue = 2;",
        ].join("\n"),
      },
      {
        path: "src/private.ts",
        source: `/** ${citation} */\nexport const excluded = 1;\n`,
      },
      {
        path: "src/hidden.ts",
        source: `/** ${citation}\n * @internal\n */\nexport const hidden = 1;\n`,
      },
      {
        path: "src/prose.ts",
        source: `/** ${citation} Mentioning @internal in prose does not hide. */\nexport const prose = 1;\n`,
      },
      {
        path: "src/namespace.ts",
        source: [
          "export namespace PublicSurface {",
          `  /** ${citation} */`,
          "  export const nested = 1;",
          "}",
        ].join("\n"),
      },
      {
        path: "src/hidden-owner.ts",
        source: [
          "/** @internal */",
          "export class HiddenOwner {",
          `  /** ${citation} */`,
          "  public visible = 1;",
          "}",
        ].join("\n"),
      },
      {
        path: "src/hidden-namespace.ts",
        source: [
          "/** @internal */",
          "export namespace HiddenSurface {",
          `  /** ${citation} */`,
          "  export const nested = 1;",
          "}",
        ].join("\n"),
      },
      {
        path: "src/hash-private.ts",
        source: [
          "export class PublicOwner {",
          `  /** ${citation} */`,
          "  #hidden = 1;",
          "}",
        ].join("\n"),
      },
      {
        path: "src/function.ts",
        source: `/** ${citation} */\nexport function wrongKind(): void {}\n`,
      },
      {
        path: "src/other.ts",
        source: `/** ${citation} */\nexport const wrongReference = 1;\n`,
      },
    ],
    [
      {
        files: ["src/**/*.ts", "!src/private.ts", "!src/other.ts"],
        symbols: ["property"],
        references: [
          {
            files: ["requirements/production-evidence/*.md"],
            symbols: ["h2"],
          },
        ],
      },
      {
        files: ["src/other.ts"],
        symbols: ["property"],
        references: [
          {
            files: ["requirements/another-domain/*.md"],
            symbols: ["h2"],
          },
        ],
      },
    ],
    target,
    2,
  );
  TestValidator.equals(
    "only the configured public carrier owns the requested target",
    blocks.map((block) => block.includes(citation)),
    [true, true, true],
  );

  const packages = new Map([
    ["@automovie/evidence", "packages/evidence"],
    ["create-automovie", "packages/create-automovie"],
  ]);
  TestValidator.equals(
    "workspace manifests decide package identity",
    {
      unscoped: isContractPackageOwner("create-automovie", packages),
      absent: isContractPackageOwner("unknown-package", packages),
    },
    { unscoped: true, absent: false },
  );
};
