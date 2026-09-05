import { createBlankAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  ScaffoldPublicationError,
  renderScaffold,
  writeAutoMovieProductionInstructions,
  writeFiles,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Instruction synchronization rebuilds one generated project's ignored
 * instruction surface from the installed template and the project's own
 * tracked declaration, and removes nothing else.
 *
 * Scenarios:
 *
 * 1. A freshly rendered project synchronizes into a router that names the
 *    package, the shipped skills, and the `CLAUDE.md` import, replacing a
 *    stale router in place.
 * 2. Stale doctrine below `.agents/skills`, whether a whole legacy skill tree
 *    or one extra file inside a shipped skill, is removed only after the
 *    desired surface completed, and emptied directories do not survive.
 * 3. A second synchronization is byte-identical.
 * 4. A routed project document that is no longer a physical file refuses the
 *    synchronization before any generated file changes.
 * 5. A generated instruction slot occupied by something other than an
 *    ordinary file stops the publication, and the receipt-bearing error names
 *    that slot as the stopping entry.
 */
export const test_template_instruction_synchronization = (): void => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-instruction-sync-"),
  );
  try {
    writeFiles(
      root,
      renderScaffold({ name: "sync-fixture", language: "english" }),
    );
    const skills = path.join(root, ".agents", "skills");
    const agentsPath = path.join(root, "AGENTS.md");
    fs.mkdirSync(path.join(skills, "legacy", "nested"), { recursive: true });
    fs.writeFileSync(path.join(skills, "legacy", "nested", "old.md"), "stale");
    fs.writeFileSync(path.join(skills, "contract", "stale.md"), "stale");
    fs.writeFileSync(agentsPath, "stale router\n");
    const productionEvidence = createBlankAutoMovieProductionEvidence(
      root,
      "english",
    );

    const targets = writeAutoMovieProductionInstructions({
      root,
      productionEvidence,
    });
    const agents = fs.readFileSync(agentsPath, "utf8");
    TestValidator.equals(
      "synchronization publishes the routed surface and removes stale doctrine",
      {
        targets,
        claude: fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"),
        namesPackage: agents.includes("- Package `sync-fixture`."),
        replacedRouter: agents.startsWith("stale router") === false,
        legacyTree: fs.existsSync(path.join(skills, "legacy")),
        staleFile: fs.existsSync(path.join(skills, "contract", "stale.md")),
        shippedSkill: fs.existsSync(path.join(skills, "contract", "SKILL.md")),
      },
      {
        targets: [skills, agentsPath, path.join(root, "CLAUDE.md")],
        claude: "@AGENTS.md\n",
        namesPackage: true,
        replacedRouter: true,
        legacyTree: false,
        staleFile: false,
        shippedSkill: true,
      },
    );

    writeAutoMovieProductionInstructions({ root, productionEvidence });
    TestValidator.equals(
      "a repeated synchronization is byte-identical",
      fs.readFileSync(agentsPath, "utf8"),
      agents,
    );

    const occupied = path.join(skills, "contract", "SKILL.md");
    fs.rmSync(occupied);
    fs.mkdirSync(occupied);
    let publication: unknown;
    try {
      writeAutoMovieProductionInstructions({ root, productionEvidence });
    } catch (error) {
      publication = error;
    }
    fs.rmdirSync(occupied);
    TestValidator.equals(
      "an occupied instruction slot stops publication with its receipt",
      {
        name: publication instanceof Error ? publication.name : null,
        stoppingEntry:
          publication instanceof ScaffoldPublicationError
            ? publication.receipt.failure?.entry.relative
            : null,
        status:
          publication instanceof ScaffoldPublicationError
            ? publication.receipt.status
            : null,
      },
      {
        name: "ScaffoldPublicationError",
        stoppingEntry: ".agents/skills/contract/SKILL.md",
        status: "refused",
      },
    );

    fs.rmSync(path.join(root, "docs", "README.md"));
    let refusal: string | null = null;
    try {
      writeAutoMovieProductionInstructions({ root, productionEvidence });
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error);
    }
    TestValidator.equals(
      "a routed project document that is not a physical file refuses the sync",
      {
        refusal,
        routerUnchanged: fs.readFileSync(agentsPath, "utf8") === agents,
      },
      {
        refusal: "docs/README.md: instruction target is not a physical file.",
        routerUnchanged: true,
      },
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};
