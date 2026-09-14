import { renderAutoMovieProductionInstructionCandidate } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

const skill = (name: string): string =>
  `---\nname: ${name}\ndescription: Probe router for ${name}.\n---\n\n# ${name}\n`;

/**
 * The generated instruction candidate is closed over the installed skill tree
 * and two fixed root names, so no name a production owns can become a
 * publication target.
 *
 * This is what makes the publication safe to reason about. Every target the
 * writer touches is either a shipped skill document or one of the two routers,
 * and the project's own documents reach the renderer only so its links can be
 * resolved. A change that widened the selection would hand the writer a
 * user-named file, which is why the boundary is pinned here rather than
 * described.
 *
 * Scenarios:
 *
 * 1. The candidate holds exactly the supplied `.agents/skills` population plus
 *    `AGENTS.md` and `CLAUDE.md`.
 * 2. A project-owned document supplied for link resolution does not enter the
 *    candidate, so publication never targets a name the production chose.
 * 3. A project document whose name imitates a generated router does not enter
 *    the candidate either, so imitation cannot reach the writer.
 * 4. The two root names carry the rendered router and the provider-neutral
 *    import rather than any supplied content.
 */
export const test_cli_scaffold_instruction_candidate_closure = (): void => {
  const sources: Record<string, string> = {
    ".agents/skills/contract/SKILL.md": skill("contract"),
    ".agents/skills/evidence-graph/SKILL.md": skill("evidence-graph"),
    ".agents/skills/evidence-graph/work-specific.md":
      "# Production-specific contract\n",
    ".agents/skills/production-lifecycle/SKILL.md": skill(
      "production-lifecycle",
    ),
    ".agents/skills/production-lifecycle/production-kinds.md":
      "# Production kinds\n",
    ".agents/skills/review-verification/SKILL.md": skill("review-verification"),
    ".agents/skills/source-authoring/SKILL.md": skill("source-authoring"),
    "docs/README.md": "# Documents\n",
    "docs/contracts/local.md": "# Local contract\n",
    "docs/AGENTS.md": "# Imitated router\n",
  };
  const candidate = renderAutoMovieProductionInstructionCandidate({
    evidence: {
      contracts: [],
      description: "",
      designOwners: [],
      packageName: "closure-probe",
      manifest: {
        bindings: [],
        branches: [],
        kind: null,
        language: "english",
        localAudits: [],
        localBindings: [],
        populationScope: { mode: "complete-production" },
      },
    },
    sources,
  });

  TestValidator.equals(
    "the candidate is the skill population plus the two routers",
    Object.keys(candidate).sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
    [
      ".agents/skills/contract/SKILL.md",
      ".agents/skills/evidence-graph/SKILL.md",
      ".agents/skills/evidence-graph/work-specific.md",
      ".agents/skills/production-lifecycle/SKILL.md",
      ".agents/skills/production-lifecycle/production-kinds.md",
      ".agents/skills/review-verification/SKILL.md",
      ".agents/skills/source-authoring/SKILL.md",
      "AGENTS.md",
      "CLAUDE.md",
    ],
  );
  for (const owned of ["docs/README.md", "docs/contracts/local.md"])
    TestValidator.equals(
      "a production-owned document is not a publication target",
      Object.hasOwn(candidate, owned),
      false,
    );
  TestValidator.equals(
    "a document imitating a generated router is not a target either",
    Object.hasOwn(candidate, "docs/AGENTS.md"),
    false,
  );
  TestValidator.predicate(
    "the root router is rendered rather than supplied",
    candidate["AGENTS.md"]!.startsWith("# closure-probe"),
  );
  TestValidator.equals(
    "the provider-neutral import is the only CLAUDE.md content",
    candidate["CLAUDE.md"],
    "@AGENTS.md\n",
  );
};
