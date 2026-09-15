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
    | "bindings"
    | "branches"
    | "kind"
    | "language"
    | "populationScope"
    | "localBindings"
    | "localAudits"
  >;
};

const SKILL_PREFIX = ".agents/skills/";

/**
 * Preserve the authored instruction router and append tracked production facts.
 *
 * The production kind, active branches, common-contract routes, exact design
 * owners, and local contracts all come from the evidence reader. The renderer
 * carries no second design-branch or contract inventory, so a film, direct
 * brief, object library, and building library each describe only the work they
 * actually selected. Behavior, skill routing, and maintenance rules remain
 * exclusively in the supplied scaffold instruction source.
 *
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Reconstructs the generated instruction entry point from portable tracked project facts.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Routes an author to the exact active production branches and contract topics.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery Separates film, brief, and selected library procedures instead of presenting every shape as one choice list.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Uses only the project manifest, evidence declaration, and governed documents as derivation input.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits reusable routing guidance while leaving every production decision in project-owned source.
 */
export const renderAutoMovieProductionRouter = (
  evidence: AutoMovieProductionRouterEvidence,
  instructionSource: string,
): string => {
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
  const localBindingLines = [
    ...evidence.manifest.localBindings.map((binding) =>
      renderLocalBinding(binding, "binding"),
    ),
    ...evidence.manifest.localAudits.map((binding) =>
      renderLocalBinding(binding, "inapplicable audit"),
    ),
  ];
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

  return `${instructionSource}\n\n### Production facts\n\n- Package ${inlineCode(evidence.packageName)}.\n- Description ${inlineCode(evidence.description)}.\n- Production kind ${evidence.manifest.kind === null ? "(unselected)" : inlineCode(evidence.manifest.kind)}.\n- Authoring language ${inlineCode(evidence.manifest.language)}.\n- Population scope ${inlineCode(evidence.manifest.populationScope.mode)}.\n- ${branchLine}\n\n#### Active design owners\n\n${designOwnerLines.join("\n")}\n\n#### Shared contract bindings\n\n${bindingLines.join("\n")}\n\n#### Local contracts and relationships\n\n${localContractLines.join("\n")}\n${localBindingLines.join("\n")}
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
  /** Project-owned facts appended without redefining instruction doctrine. */
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
  const agents = available.get("AGENTS.md");
  const claude = available.get("CLAUDE.md");
  if (agents === undefined || claude === undefined)
    throw new Error("Authored AGENTS.md and CLAUDE.md sources are required.");
  candidate["AGENTS.md"] = renderAutoMovieProductionRouter(
    props.evidence,
    agents,
  );
  candidate["CLAUDE.md"] = claude;

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

/** Render the local obligation's contract and eligible authored population. */
const renderLocalBinding = (
  binding: IAutoMovieProductionEvidence["manifest"]["localBindings"][number],
  disposition: "binding" | "inapplicable audit",
): string => {
  const targets = binding.targets
    .map(
      (target) =>
        `root ${inlineCode(target.root)}, files ${codeList(target.files)}, symbols ${codeList(target.symbols)}`,
    )
    .join("; ");
  const population =
    binding.population === undefined
      ? ""
      : `; authored population root ${inlineCode(binding.population.root)}, files ${codeList(binding.population.files)}, symbols ${codeList(binding.population.symbols)}`;
  return `- Local ${disposition} ${inlineCode(binding.claim)}: branch ${inlineCode(binding.layer)} pass ${inlineCode(binding.pass)} (${inlineCode(binding.stage)}, ${binding.enforced ? "enforced" : "not enforced"}), ${inlineCode(binding.relationship)}; host root ${inlineCode(binding.host.root)}, files ${codeList(binding.host.files)}, symbols ${codeList(binding.host.symbols)}; contract targets ${targets}${population}.`;
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
  )} -> ${target}; claim ${inlineCode(binding.claim)}; severity ${inlineCode(String(binding.severity ?? "inherited error"))}, review ${binding.requireReview === undefined ? "inherited" : binding.requireReview ? "required" : "not required"}.`;
};

/** Render one safe Markdown inline-code value from manifest-owned text. */
const inlineCode = (value: string): string =>
  `\`${value.replaceAll("`", "%60").replaceAll("\r", " ").replaceAll("\n", " ")}\``;

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
