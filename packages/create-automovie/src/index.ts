import { runCreateAutoMovie as execute } from "./bin";

/**
 * Creates the canonical AutoMovie project through the package-manager creator
 * convention.
 *
 * The public binding is the exact function used by the executable. It keeps the
 * complete target checks, scaffold bytes, arguments, exit status, and function
 * identity of the canonical implementation without another template or hidden
 * authoring state.
 *
 * @author Samchon
 * @param argv Package-manager process arguments, including the executable and
 *   creator command positions.
 * @returns The canonical CLI exit status for the delegated scaffold operation.
 * @evidence requirements/agent-authoring/project-ownership.md Publishes the canonical scaffold into a user-owned target as editable, portable source, preserves explicit overwrite authority, and retains no creator session state.
 * @evidence requirements/product/capability-and-content.md Publishes reusable authoring techniques and project-owned examples instead of a creator-owned finished-content catalogue.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md Maps the explicit target and options to a versioned available-capability scaffold, separates reusable techniques from project facts, refuses invalid creation, and never rewrites an older project when the published template evolves.
 * @evidenceExclude requirements/agent-authoring/capability-discovery.md The creator makes one scaffold available but does not answer topic, choice, diagnostic, or capability-gap discovery requests.
 * @evidenceExclude requirements/agent-authoring/mcp-boundary.md Project creation may publish MCP configuration, but the generated host owns knowledge requests, execution evidence, content refusal, and external-effect authorization.
 * @evidenceExclude requirements/agent-authoring/partial-work.md This one-shot project publication has no film target, omission, partial compile, verification scope, or checkpoint state.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md Forwarding creator arguments neither records creative delegation nor decides runtime validity, evidence, or acceptance authority.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md The creator emits the initial source tree but does not execute later source edits, compiles, captures, reviews, result lineage, or impact analysis.
 * @evidenceExclude requirements/product/authorability.md The creator exposes no film geometry, state, timing, quality, or comparison control and produces no evidence of those controls' effects.
 * @evidenceExclude requirements/product/charter.md Project publication returns source and an exit status, not a rendered prototype, structural film output, or reproducibility judgment.
 * @evidenceExclude requirements/product/choice-and-external-services.md No provider, external input, quality lane, cost limit, execution, adoption, or substitution decision occurs during local scaffold creation.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md The creator materializes the current versioned scaffold but does not extend, reinterpret, or migrate an existing production contract.
 * @evidenceExclude requirements/product/prototype-quality.md The creator produces no geometry, motion, audiovisual prototype, or downstream fidelity rendition whose quality could be judged.
 * @evidenceExclude requirements/product/scope-and-exclusions.md This adapter creates a project boundary but implements no object or motion representation, likeness, probabilistic completion, editor, export, or exclusion-reopening decision.
 * @evidenceExclude specifications/authoring-and-authority/README.md This map spans every authoring and authority system boundary; the creator implements only capability-oriented project publication.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md Creator argv carries no reserved, delegated, decided, or deferred creative choice and grants no runtime or evidence authority.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md Local scaffold publication sends no external request, incurs no provider side effect, and adopts no returned bytes or provenance.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md The creator can publish host configuration but does not serve knowledge, choice discovery, evidence, diagnostic, or tool-session requests.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md A target directory is not a film target; this function creates no omission, compile attempt, partial artifact, validation scope, or checkpoint.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md No prototype input identity, structural output, rendition, fidelity failure, or downstream compatibility result is produced during creation.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md The creator writes initial source, but generated compilers and hosts own later snapshot state, artifact lineage, invalidation, adopted-input identity, and resume ledgers.
 */
export const runCreateAutoMovie = execute;
