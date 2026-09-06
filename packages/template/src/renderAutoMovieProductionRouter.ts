import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import path from "node:path";

import {
  type IAutoMovieInstructionMarkdownSource,
  validateAutoMovieInstructionDocumentLinks,
  validateAutoMovieSkillRouterLinks,
} from "./validateAutoMovieSkillRouters";

type AutoMovieProductionRouterEvidence = Pick<
  IAutoMovieProductionEvidence,
  "contracts" | "description" | "designOwners" | "packageName"
> & {
  manifest: Pick<
    IAutoMovieProductionEvidence["manifest"],
    "bindings" | "branches" | "kind" | "language" | "populationScope"
  >;
};

const SKILL_PREFIX = ".agents/skills/";

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
  evidence: AutoMovieProductionRouterEvidence,
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
  const bindingLines =
    evidence.manifest.bindings.length === 0
      ? [
          "- No shared contract route is active before a production kind is selected.",
        ]
      : evidence.manifest.bindings.map(renderManifestBinding);
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

It is generated from the installed scaffold by \`npm run sync\` and is not tracked. Do not edit it: change \`package.json\`, \`lint.config.ts\`, \`docs\`, or the installed AutoMovie version, then run the command again. Sync deliberately overwrites this router and the shipped skill inventory so one generated project cannot silently fork the shared doctrine.

## This production

- Package \`${evidence.packageName}\`.
- Production authoring language \`${evidence.manifest.language}\`; its exact contract is materialized under \`docs/language\`.
- \`lint.config.ts\` is the single typed production-kind, population-scope, branch, custom-claim, and graph declaration. Lint, sync, and final review consume the same exported value; the generated branch-and-stage view below reports it but never overrides it.
- ${shapeProcedure(evidence.manifest.kind)}
- ${branchLine}

## Procedure

- [Contract index](.agents/skills/contract/SKILL.md) locates the project-local shared, language, and production-owned contract questions selected below.
- [Production lifecycle](.agents/skills/production-lifecycle/SKILL.md) owns shape selection and the authored lifecycle selected below.
- [Evidence graph](.agents/skills/evidence-graph/SKILL.md) owns the local contract inventory, claims, stages, citations, exclusions, and fingerprints.
- [Source authoring](.agents/skills/source-authoring/SKILL.md) owns design branches, TypeScript, geometry, rigs, motion, spatial design, and compilation.
- [Review verification](.agents/skills/review-verification/SKILL.md) owns Self-Review, viewer inspection, capture, measurements, and final acceptance.

## Active design owners

These are derived from the evidence factory's live binding manifest. They are the exact H1/H2 denominator, not a catalogue of branches AutoMovie happens to support.

${designOwnerLines.join("\n")}

## Contracts this production answers

Reusable contracts live in this project's own \`docs/{discovery,upstream,principles,obligations}\` inventory and are selected by \`lint.config.ts\`. Each line below is one factory-derived binding, including the answering host population and relationship; repeated contract addresses are distinct obligations, not duplicates to collapse. Cite contracts by their project-local evidence roots.

${bindingLines.join("\n")}

Project-local contracts are flat files under \`docs/contracts\`; every item below is read from that tracked directory.

${localContractLines.join("\n")}

Add a local contract only after [Production-specific contract](.agents/skills/evidence-graph/work-specific.md) establishes its owner and authority, activate its host relationship through the typed helper used by \`lint.config.ts\`, and run \`npm run sync\` so this router lists it.

## Instruction loading

Start the coding-agent session from this project root. Codex reads this \`AGENTS.md\`; Claude Code follows \`CLAUDE.md -> @AGENTS.md\`. A session started above or below this root is not proof that this production's instructions entered context. Run \`npm run sync\`, then start or restart each coding-agent session from this root; no provider-specific hook substitutes for instruction loading.

## Commands

- \`npm run sync\` overwrites this router and the five shipped skills from the installed template while preserving every tracked production fact.
- \`npm run lint:source\` checks TypeScript; \`npm run lint\` checks the evidence graph and production review gate.
- \`npm run book -- --layer <layer> --title <title>\` binds any supported authored layer into one deterministic reader-facing Markdown file under the ignored \`artifacts\` directory. It preserves numbered script/screenplay groups, keeps other layers flat, removes evidence comments and citation anchors, and preserves visible prose and headings.
- \`npm run compile\` is the only command that may update compiler-owned output.
`;
};

/**
 * Render and validate the complete generated instruction candidate.
 *
 * Initial scaffold creation and every later synchronization call this same
 * pure boundary. The supplied publication contains the installed skill bytes
 * and every dynamic project document linked by the rendered root router; the
 * returned candidate contains only the generated instruction surface.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Derives one provider-neutral instruction surface from explicit project-owned facts.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Refuses an instruction candidate whose root or shipped skill routes cannot reach their advertised targets.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Uses the same explicit instruction-source population for initial creation and synchronization.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Publishes only the routed capability instructions selected from that complete candidate.
 */
export const renderAutoMovieProductionInstructionCandidate = (props: {
  /** Project identity and live contract projection rendered into AGENTS.md. */
  evidence: AutoMovieProductionRouterEvidence;
  /** Complete project-root-relative source population available to links. */
  sources: Readonly<Record<string, string>>;
}): Record<string, string> => {
  const available = new Map<string, string>();
  for (const [path, content] of Object.entries(props.sources)) {
    const normalized = normalizeInstructionPath(path);
    if (available.has(normalized))
      throw new Error(`${normalized}: instruction source is duplicated.`);
    available.set(normalized, content);
  }

  const candidate = Object.create(null) as Record<string, string>;
  for (const [path, content] of available)
    if (path.startsWith(SKILL_PREFIX)) candidate[path] = content;
  candidate["AGENTS.md"] = renderAutoMovieProductionRouter(props.evidence);
  candidate["CLAUDE.md"] = "@AGENTS.md\n";

  const publication = new Map(available);
  for (const [path, content] of Object.entries(candidate))
    publication.set(path, content);
  const sources = [...publication].map(
    ([path, content]): IAutoMovieInstructionMarkdownSource => ({
      path,
      content,
    }),
  );
  validateAutoMovieSkillRouterLinks(sources);
  validateAutoMovieInstructionDocumentLinks(sources, "AGENTS.md");
  return candidate;
};

const normalizeInstructionPath = (value: string): string =>
  assertInstructionPath(path.posix.normalize(value.replaceAll("\\", "/")));

const assertInstructionPath = (value: string): string => {
  if (
    value === "." ||
    value === ".." ||
    value.startsWith("../") ||
    path.posix.isAbsolute(value)
  )
    throw new Error(
      `${value}: instruction source path escapes its project root.`,
    );
  return value;
};

/** Render one complete factory-derived host-to-target relationship. */
const renderManifestBinding = (
  binding: AutoMovieProductionRouterEvidence["manifest"]["bindings"][number],
): string => {
  const targetBinding = binding.target;
  const target =
    targetBinding.type === "contract"
      ? `contract ${codeList(
          targetBinding.anchors.length === 0
            ? [targetBinding.path]
            : targetBinding.anchors.map(
                (anchor) => `${targetBinding.path}#${anchor}`,
              ),
        )}`
      : `population root ${inlineCode(targetBinding.root)}, files ${codeList(
          targetBinding.files,
        )}, symbols ${codeList(targetBinding.symbols)}`;
  return `- Branch ${inlineCode(binding.branch)} (${inlineCode(
    binding.stage,
  )}, ${binding.enforced ? "enforced" : "not yet enforced"}) uses ${inlineCode(
    binding.relationship,
  )}: ${binding.host.type} host root ${inlineCode(
    binding.host.root,
  )}, files ${codeList(binding.host.files)}, symbols ${codeList(
    binding.host.symbols,
  )} -> ${target}; claim ${inlineCode(binding.claim)}.`;
};

/** Render one safe Markdown inline-code value from manifest-owned text. */
const inlineCode = (value: string): string =>
  `\`${value.replaceAll("`", "%60")}\``;

/** Render a nonempty or explicitly empty inline-code inventory. */
const codeList = (values: readonly string[]): string =>
  values.length === 0 ? "(none)" : values.map(inlineCode).join(", ");

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
  kind: AutoMovieProductionRouterEvidence["manifest"]["kind"],
): string => {
  switch (kind) {
    case "film":
      return "Production kind `film`; follow the [film procedure](.agents/skills/production-lifecycle/production-kinds.md#film).";
    case "brief":
      return "Production kind `brief`; follow the [brief procedure](.agents/skills/production-lifecycle/production-kinds.md#brief).";
    case "library":
      return "Production kind `library`; follow the [library procedure](.agents/skills/production-lifecycle/production-kinds.md#library).";
    case null:
      return "No production kind is selected. Choose it through [Production kinds](.agents/skills/production-lifecycle/production-kinds.md) and record it in `lint.config.ts` before authoring a downstream branch.";
  }
};
