import { createBlankAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AUTO_MOVIE_PRODUCTION_LANGUAGES,
  autoMovieLanguageContractsDirectory,
  renderAutoMovieLanguageContracts,
  renderScaffold,
  writeAutoMovieProductionInstructions,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * The scaffold publishes exactly one complete, supported language pack.
 *
 * Scenarios:
 *
 * 1. Each supported selection emits only its three language-contract documents.
 * 2. The complete scaffold contains the selected language and no sibling pack.
 * 3. Missing, unknown, empty, and linked pack inputs fail closed.
 * 4. Source-root discovery accepts one physical directory and refuses absence.
 */
export const test_cli_scaffold_language_contract = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-language-"));
  try {
    for (const language of AUTO_MOVIE_PRODUCTION_LANGUAGES) {
      const rendered = renderAutoMovieLanguageContracts({ language });
      TestValidator.equals(`${language} paths`, Object.keys(rendered), [
        "docs/language/discovery/signals.md",
        "docs/language/obligations/common.md",
        "docs/language/principles/common.md",
      ]);
      TestValidator.predicate(
        `${language} identity`,
        Object.values(rendered).some((content) =>
          content.toLowerCase().includes(language),
        ),
      );
      const scaffold = renderScaffold({ name: `${language}-film`, language });
      TestValidator.equals(
        `${language} scaffold contract paths`,
        Object.keys(scaffold).filter((file) =>
          file.startsWith("docs/language/"),
        ),
        Object.keys(rendered),
      );
      TestValidator.predicate(
        `${language} declaration`,
        scaffold["lint.config.ts"]!.includes(`language: "${language}"`),
      );
      if (language === "english") {
        const project = path.join(root, "first-sync");
        for (const [relative, content] of Object.entries(scaffold)) {
          const target = path.join(project, relative);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, content);
        }
        const first = fs.readFileSync(path.join(project, "AGENTS.md"), "utf8");
        writeAutoMovieProductionInstructions({
          root: project,
          productionEvidence: createBlankAutoMovieProductionEvidence(
            project,
            language,
          ),
        });
        TestValidator.equals(
          "first instruction render equals first synchronization",
          fs.readFileSync(path.join(project, "AGENTS.md"), "utf8"),
          first,
        );
      }
    }

    TestValidator.error("unknown language", () =>
      renderAutoMovieLanguageContracts({ language: "french" }),
    );
    TestValidator.error("missing language", () =>
      renderAutoMovieLanguageContracts({ language: "" }),
    );

    const synthetic = path.join(root, "contracts");
    fs.mkdirSync(path.join(synthetic, "english"), { recursive: true });
    TestValidator.error("empty pack", () =>
      renderAutoMovieLanguageContracts({
        language: "english",
        contractsRoot: synthetic,
      }),
    );
    fs.writeFileSync(path.join(synthetic, "english", "root.md"), "root\r\n");
    fs.mkdirSync(path.join(synthetic, "english", "nested"));
    fs.writeFileSync(
      path.join(synthetic, "english", "nested", "leaf.md"),
      "leaf\r\n",
    );
    TestValidator.equals(
      "recursive normalized pack",
      renderAutoMovieLanguageContracts({
        language: "english",
        contractsRoot: synthetic,
      }),
      {
        "docs/language/nested/leaf.md": "leaf\n",
        "docs/language/root.md": "root\n",
      },
    );
    fs.mkdirSync(path.join(synthetic, "korean"));
    fs.symlinkSync(
      path.join(synthetic, "english", "root.md"),
      path.join(synthetic, "korean", "linked.md"),
    );
    TestValidator.error("linked pack member", () =>
      renderAutoMovieLanguageContracts({
        language: "korean",
        contractsRoot: synthetic,
      }),
    );
    TestValidator.error("missing supported pack", () =>
      renderAutoMovieLanguageContracts({
        language: "japanese",
        contractsRoot: synthetic,
      }),
    );

    const source = path.join(root, "module", "src");
    const assets = path.join(root, "module", "language-contracts");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(assets);
    TestValidator.equals(
      "physical language root",
      autoMovieLanguageContractsDirectory(source),
      assets,
    );
    TestValidator.error("missing language root", () =>
      autoMovieLanguageContractsDirectory(path.join(root, "missing", "src")),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
