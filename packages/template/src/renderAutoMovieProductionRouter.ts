import type { IAutoMovieProductionEvidence } from "@automovie/evidence";

/**
 * Render one generated project's root instruction router from tracked facts.
 *
 * The production kind, active branches, common-contract routes, exact design
 * owners, and local contracts all come from the evidence reader. The renderer
 * carries no second design-branch or contract inventory, so a film, direct
 * brief, object library, and building library each describe only the work they
 * actually selected.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Reconstructs the generated instruction entry point from portable tracked project facts.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Routes an author to the exact active production branches and contract topics.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Separates film, brief, and selected library procedures instead of presenting every shape as one choice list.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Uses only the project manifest, evidence declaration, and governed documents as derivation input.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits reusable routing guidance while leaving every production decision in project-owned source.
 */
export const renderAutoMovieProductionRouter = (
  evidence: IAutoMovieProductionEvidence,
): string => {
  const description =
    evidence.description === "" ? "" : `\n${evidence.description}\n`;
  const activeBranches = evidence.manifest.branches.map(
    (branch) => `\`${branch.name}\` (\`${branch.stage}\`)`,
  );
  const branchLine =
    activeBranches.length === 0
      ? "No authored branch is active yet."
      : `Active branches: ${activeBranches.join(", ")}.`;
  const sharedContracts = [
    ...new Set(
      evidence.manifest.bindings.flatMap((binding) =>
        binding.target.type === "contract" ? [binding.target.path] : [],
      ),
    ),
  ].sort((left, right) => Number(left > right) - Number(left < right));
  const commonContractLines =
    sharedContracts.length === 0
      ? [
          "- No shared contract route is active before a production kind is selected.",
        ]
      : sharedContracts.map((contract) => `- \`${contract}\``);
  const localContractLines =
    evidence.contracts.length === 0
      ? ["- This production owns no local contract document yet."]
      : evidence.contracts.map((contract) => {
          const items = contract.items
            .map((item) => markdownLink(item.title, contract.path, item.anchor))
            .join("; ");
          return items === ""
            ? `- ${markdownLink(contract.title, contract.path)} has no H2 contract item.`
            : `- ${markdownLink(contract.title, contract.path)}: ${items}.`;
        });
  const designOwnerLines =
    evidence.designOwners.length === 0
      ? ["- No active design owner is present."]
      : evidence.designOwners.map((owner) => {
          const units = owner.units
            .map((unit) => markdownLink(unit.title, owner.path, unit.anchor))
            .join("; ");
          const source =
            owner.sourceBinding === null
              ? "source authorship has not started"
              : `source branch \`${owner.sourceBinding.branch}\` selects ${owner.sourceBinding.paths.length} current source file(s)`;
          return `- \`${owner.branch}\` ${markdownLink(owner.title, owner.path)}: ${units === "" ? "no H2 owner unit" : units}; ${source}.`;
        });

  return `# ${evidence.packageName}
${description}
This file governs authoring this production. Read it before acting, then read the documents it routes to.

It is generated from the installed scaffold by \`npm run sync\` and is not tracked. Do not edit it: change \`package.json\`, \`productionEvidence.ts\`, \`docs\`, or the installed AutoMovie version, then run the command again. Sync deliberately overwrites this router and the shipped production skill so one generated project cannot silently fork the shared doctrine.

## This production

- Package \`${evidence.packageName}\`.
- \`productionEvidence.ts\` is the single tracked production-kind, population-scope, branch, and lifecycle declaration. \`lint.config.ts\`, sync, and final review consume that same typed value; the generated branch-and-stage view below reports it but never overrides it.
- ${shapeProcedure(evidence.manifest.kind)}
- ${branchLine}

## Procedure

- [Production](.agents/skills/production/SKILL.md) owns research, settings, the selected shape, design branches, source authorship, evidence staging, Self-Review, and final review. Read the phase document it routes to before drafting.
${shapeProcedureLine(evidence.manifest.kind)}

## Active design owners

These are derived from the evidence factory's live binding manifest. They are the exact H1/H2 denominator, not a catalogue of branches AutoMovie happens to support.

${designOwnerLines.join("\n")}

## Contracts this production answers

Shared contracts arrive through \`@automovie/template\` and are selected by \`productionEvidence.ts\`. Cite them by their evidence roots, never by the installed filesystem path.

${commonContractLines.join("\n")}

Project-local contracts are flat files under \`docs/contracts\`; every item below is read from that tracked directory.

${localContractLines.join("\n")}

Add a local contract only after [Production-specific contract](.agents/skills/production/work-specific.md) establishes its owner and authority, activate its host relationship through the typed helper used by \`productionEvidence.ts\`, and run \`npm run sync\` so this router lists it.

## Instruction loading

Start the coding-agent session from this project root. Codex reads this \`AGENTS.md\`; Claude Code follows \`CLAUDE.md -> @AGENTS.md\`. A session started above or below this root is not proof that this production's instructions entered context, so the scaffold verification procedure checks both agents from a freshly generated project.

## Commands

- \`npm run sync\` overwrites this router and the shipped production skill from the installed template while preserving every tracked production fact.
- \`npm run lint:source\` checks TypeScript; \`npm run lint\` checks the evidence graph and production review gate.
- \`npm run book -- --layer <layer> --title <title>\` binds any authored layer into one deterministic reader-facing Markdown file under the ignored \`artifacts\` directory. It removes evidence comments and citation anchors but preserves the visible heading hierarchy and prose.
- \`npm run compile\` is the only command that may update compiler-owned output.
`;
};

/** Render a safe project-relative Markdown link from project-owned text. */
const markdownLink = (title: string, file: string, anchor?: string): string => {
  const label = title.replace(/[\\[\]]/gu, "\\$&");
  const encode = (value: string): string =>
    encodeURIComponent(value).replaceAll("(", "%28").replaceAll(")", "%29");
  const destination = file.split("/").map(encode).join("/");
  return `[${label}](${destination}${
    anchor === undefined ? "" : `#${encode(anchor)}`
  })`;
};

/** Explain only the selected production shape, never the other two shapes. */
const shapeProcedure = (
  kind: IAutoMovieProductionEvidence["manifest"]["kind"],
): string => {
  switch (kind) {
    case "film":
      return "This is a film: author the narrative ladder, then shots and the final film source; selected design branches remain independent inputs.";
    case "brief":
      return "This is a direct brief: author one bounded delivery and observation hierarchy through its shot and final film source.";
    case "library":
      return "This is a library: author settings plus only the selected design and matching source branches.";
    case null:
      return "No production kind is selected. Choose film, brief, or library in `productionEvidence.ts` before authoring a downstream branch.";
  }
};

/** Render the selected shape's procedure without naming an inactive shape. */
const shapeProcedureLine = (
  kind: IAutoMovieProductionEvidence["manifest"]["kind"],
): string => {
  switch (kind) {
    case "film":
      return "- Follow `settings -> treatments -> scripts -> screenplays -> shots -> filmSources`; reviewed `productionSources` remains its parallel serialized input.";
    case "brief":
      return "- Follow `settings -> briefs -> shots -> filmSources`; reviewed `productionSources` remains its parallel serialized input.";
    case "library":
      return "- Follow settings plus each active design owner into its matching source branch; review closes on the exact delivered owner population.";
    case null:
      return "- Select a production kind before beginning a downstream procedure.";
  }
};
