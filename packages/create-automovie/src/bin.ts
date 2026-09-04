#!/usr/bin/env node
import { run } from "automovie";

/**
 * Creates a project-owned production through the package-manager creator
 * convention.
 *
 * The adapter preserves the launch executable and user arguments, inserts the
 * canonical `start` action, and returns the canonical CLI exit status. It owns
 * no parallel template or hidden authoring state, so `create-automovie` and the
 * main CLI always materialize the same reviewable project source. Preserving
 * the complete call also makes the canonical target checks and scaffold bytes
 * part of this creator's observable contract.
 *
 * @param argv Package-manager process arguments, including the executable and
 *   creator command positions.
 * @returns The canonical CLI exit status for the delegated scaffold operation.
 * @evidenceExclude requirements/agent-authoring/README.md#에이전트-저작-요구사항 This topic identity spans the complete multi-role authoring lifecycle; the creator owns only canonical project publication.
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-technique-example Publishes the canonical starter whose examples teach reusable techniques and their verification paths.
 * @evidenceExclude requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Topic routing is performed by the generated project's own documentation and shipped skill, not by this argv adapter.
 * @evidenceExclude requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery The creator selects one scaffold path and does not compare authoring techniques, providers, tiers, or partial-work choices.
 * @evidenceExclude requirements/agent-authoring/capability-discovery.md#agent-diagnostic-discovery Creation errors report argv or filesystem failure, not failed film invariants and their authoring corrections.
 * @evidenceExclude requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery The creator does not inventory film capabilities or classify unsupported and unverified authoring surfaces.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-closed-basis The one-shot creator publishes scaffold bytes and never runs a generator, seals a dependency basis, refuses a stale result, or separates derived output from external provenance; the generated project's own scripts and its compiler own that ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal The one-shot creator publishes scaffold bytes and never runs a generator, seals a dependency basis, refuses a stale result, or separates derived output from external provenance; the generated project's own scripts and its compiler own that ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-explicit-generation The one-shot creator publishes scaffold bytes and never runs a generator, seals a dependency basis, refuses a stale result, or separates derived output from external provenance; the generated project's own scripts and its compiler own that ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-portable-publication The one-shot creator publishes scaffold bytes and never runs a generator, seals a dependency basis, refuses a stale result, or separates derived output from external provenance; the generated project's own scripts and its compiler own that ledger.
 * @evidenceExclude requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-provenance-separation The one-shot creator publishes scaffold bytes and never runs a generator, seals a dependency basis, refuses a stale result, or separates derived output from external provenance; the generated project's own scripts and its compiler own that ledger.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance Project creation publishes host configuration but does not answer project-context contract or technique queries.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-provider-neutrality This local creator invokes no external provider and presents no external execution alternatives or provenance.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence The adapter produces no capture, analysis, diagnostic, or review receipt from an executed film target.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-authoring-api-refusal Source authoring state is owned by the generated project and host; this one-shot creator exposes no authoring API.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-no-surprise-external-effects No knowledge or evidence request reaches this creator, so it owns no external-execution authorization boundary.
 * @evidenceExclude requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal The creator publishes technique examples but does not serve completed assets on request.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-declared-omission Project publication declares no incomplete scene, shot, interval, subject, asset, sound, or environment range.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-atomic-compilation This function creates source files and performs no film compile attempt or atomic artifact publication.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-partial-verification-scope No frame, shot, view, platform, or other partial film target is verified during project creation.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-partial-result-control The creator returns an exit status rather than a film checkpoint that can be adopted, revised, or discarded.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-partial-work-gap-distinction This adapter has no authored-film state in which to distinguish an omission, deferral, and capability gap.
 * @evidenceExclude requirements/agent-authoring/partial-work.md#agent-resumable-authoring Project source remains portable, but partial-work checkpoints, omissions, and diagnostics are owned after creation.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-editable-source-authority Materializes the canonical starter as ordinary files the user can read, edit, review, and version.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Delegates reusable scaffolding to the shared CLI while leaving production-specific facts in the created project.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-project-owned-bytes The creator writes bundled starter bytes but adopts no external image, audio, model, or motion with provenance.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Exposes the documented package-manager creator and emits a project with public, versioned toolchain inputs.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Leaves no launcher session state required to continue editing the generated project with another compliant tool.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-ambiguous-ownership-refusal Target overwrite checks do not adjudicate an external asset's source, license, digest, or consumer identity.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-director-authority Project creation neither captures artistic intent nor accepts a film result for a user or human director.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-user-delegation-authority Creator arguments contain no reserved, delegated, decided, or deferred creative choice.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-author-authority This adapter changes no production fact on behalf of an authoring agent; it only publishes the initial source tree.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority No film structure, range, relationship, or execution result is validated during scaffold publication.
 * @evidenceExclude requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority The function produces no current capture, analysis, validation, review, or delivery evidence.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Starts authoring from the same readable project source emitted by the canonical CLI.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-reviewable-source-change The creator emits an initial tree but does not author or review a subsequent production source diff.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Selecting a shot, frame, drawing, analysis, or test belongs to generated-project validation after creation.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-source-result-link No compile, render, drawing, diagnostic, or review result is produced that needs source lineage.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility This entry performs no later production revision whose downstream assets, shots, intervals, or evidence must be invalidated.
 * @evidenceExclude requirements/product/README.md#제품-계약-요구사항 This topic identity spans film output, authorability, external services, fidelity, compatibility, and exclusions beyond project creation.
 * @evidenceExclude requirements/product/authorability.md#product-explicit-control The creator exposes target and force arguments, not film geometry, relation, state, timing, variation, or quality controls.
 * @evidenceExclude requirements/product/authorability.md#product-authoring-choice-space A single canonical starter is published; artistic techniques, precision, cost, and composition choices occur in project source.
 * @evidenceExclude requirements/product/authorability.md#product-discoverable-control The creator does not discover or validate a film control; generated documentation, contracts, examples, and diagnostics do.
 * @evidenceExclude requirements/product/authorability.md#product-hidden-inference-refusal Missing project-creation input is refused, but this adapter receives no authored film fact that could be inferred or defaulted.
 * @evidence requirements/product/capability-and-content.md#product-era-independent-composition Publishes reusable composition examples instead of binding the starter to one era-specific production.
 * @evidence requirements/product/capability-and-content.md#product-unplanted-subject-authoring Leaves subject definitions in editable project source so names absent from the starter remain authorable.
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Writes production examples and asset locations into the user project rather than creator-private state.
 * @evidence requirements/product/capability-and-content.md#product-catalogue-refusal Publishes general techniques without presenting the starter as a finished-content catalogue.
 * @evidence requirements/product/capability-and-content.md#product-example-role Creates examples whose project scripts and checks teach reusable authoring and verification paths.
 * @evidenceExclude requirements/product/charter.md#product-structural-output Project publication emits source files, not the staged, timed, audiovisual prototype a director judges.
 * @evidence requirements/product/charter.md#product-author-owned-film Starts a repository in which story, setting, subjects, assets, art, and direction remain project-owned choices.
 * @evidenceExclude requirements/product/charter.md#product-reproducible-judgment Deterministic compile, render, timeline, and review results belong to the generated runtime, not this creation call.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision No creative choice is delegated or inferred from credentials, defaults, or a first successful external result during creation.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-provider-neutral-capability Local scaffold publication invokes no generation, analysis, storage, conversion, or delivery provider.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-deterministic-external-adoption The creator adopts no external bytes, configuration, identity, or provenance as production input.
 * @evidenceExclude requirements/product/choice-and-external-services.md#product-external-substitution-choice No external service fails here, so the adapter offers no provider, local-tool, placeholder, or defer substitution.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-independent-extension-axes This entry publishes one current starter and does not extend a production's geometry, material, meaning, state, time, ownership, or quality axes.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-omission-compatibility The creator does not evaluate an existing film input with a newly omitted contract field or default.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-explicit-protocol-change Existing projects are not migrated or interpreted by this call, so it owns no protocol-version transition result.
 * @evidenceExclude requirements/product/extensibility-and-compatibility.md#product-capability-gap The adapter reports creation failures, not traceable gaps between product requirements and film capabilities.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-geometry No prototype geometry, placement, connection, collision, support, ownership, or temporal relation is produced during creation.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-motion-time No fixed-clock motion, contact, transition, repetition, or shot boundary is executed during creation.
 * @evidenceExclude requirements/product/prototype-quality.md#product-authored-variation-determinism The creator provides no authored seed or film variation whose replay could be evaluated.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-readability Source publication yields no audiovisual result in which subjects, actions, spaces, or event order can be inspected.
 * @evidenceExclude requirements/product/prototype-quality.md#product-prototype-handoff The function creates no deterministic prototype or optional downstream fidelity rendition.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion This argv adapter models no face, hair, anatomy, proxy identity, pose, gaze, contact, or direction.
 * @evidence requirements/product/scope-and-exclusions.md#product-content-catalogue-exclusion The canonical new-project structure supplies techniques and source examples rather than finished work-specific assets.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-nondeterministic-completion-exclusion Project creation performs no probabilistic completion or external generation whose bytes must be adopted.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-editor-export-exclusion This package-manager command is neither a 3D editor nor a scene exporter, but the product-wide exclusion is enforced by authoring and runtime boundaries.
 * @evidenceExclude requirements/product/scope-and-exclusions.md#product-exclusion-reopening The creator has no authorability, prototype validation, or source-authority evidence with which to reopen a product exclusion.
 * @evidenceExclude specifications/authoring-and-authority/README.md#저작과-권한-시스템-명세 This topic identity spans every authoring and authority boundary; the creator implements only canonical project publication.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Reuses the system scaffolder while placing story facts, examples, and continued authoring in the user project.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state Publishes the canonical starter as an available, documented creation capability with an executable path and explicit failure status.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-not-content-invariant Keeps scaffold examples reusable instead of substituting a finished production catalogue.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Turns explicit project identity and options into a capability-oriented source tree owned by that project.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-failure-gap Creation refusal identifies invalid argv or filesystem state, not a missing film expression or validation capability.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-extension-compatibility This call publishes the current template and does not add, migrate, or reopen a capability in an existing project.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-decision-authority-state Creator argv carries no creative target, allowed choices, acceptance conditions, decision owner, or source revision.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-user-director-input The function receives a directory and flags, not story, art, direction, cost, quality, or review intent.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output The adapter receives no authoring delegation and returns no production source diff, affected target, or unresolved choice ledger.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-runtime-evidence-authority-invariant No runtime validation or evidence assertion is made during scaffold publication.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-violation-failure Creator input errors are not refusals for exceeding a creative delegation or decision authority.
 * @evidenceExclude specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-authority-compatibility No decision state is stored here for another agent, client, session, or vendor to resume.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-basis The one-shot creator publishes scaffold bytes and owns no derived ledger, basis closure, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-budget-boundary The one-shot creator publishes scaffold bytes and owns no derived ledger, basis closure, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness The one-shot creator publishes scaffold bytes and owns no derived ledger, basis closure, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-generation The one-shot creator publishes scaffold bytes and owns no derived ledger, basis closure, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest The one-shot creator publishes scaffold bytes and owns no derived ledger, basis closure, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-portability The one-shot creator publishes scaffold bytes and owns no derived ledger, basis closure, generation attempt, compile-time freshness decision, publication path gate, or execution-budget boundary.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-selection-input Local scaffold publication receives no provider, model, cost, retention, quality, consumer, or external-execution choice.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-execution-state No external request transitions through authorization, running, returned, adopted, or superseded states.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-request-output The creator sends no production input and returns no provider attempt, execution identity, bytes, or refusal.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-adoption-output No external output digest, provenance, parameters, source inputs, or adoption authority is recorded.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-source-invariant This local adapter has no provider result that could outrank or rewrite project source.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-external-failure-substitution Provider refusal and user-selected substitute execution are outside project creation.
 * @evidenceExclude specifications/authoring-and-authority/external-execution-and-provider-neutrality.md#spec-authoring-provider-compatibility This call changes no provider metadata, execution identity, adopted bytes, or provenance chain.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output The creator may publish host configuration but does not answer topic, target, contract, guide, status, or validation-path queries.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-choice-discovery The adapter compares no technique, execution path, quality tier, or partial-work boundary.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output No exact film target is observed and no runtime fingerprint, digest, or evidence receipt is returned.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant This function is a source creator rather than a read-only knowledge or evidence request.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant No host query or evidence call reaches this adapter, so it owns neither content response nor external authorization.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-diagnostic-failure Creation failures identify argv or filesystem problems rather than stale evidence, unsupported film capability, or host refusal.
 * @evidenceExclude specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-boundary-compatibility The creator keeps no guide acknowledgment, evidence receipt, or host session that another tool must resume.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input A directory path is not a film target with scope, dependencies, source snapshot, output, and declared omissions.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-work-state Project creation has no undeclared, incomplete, ready, succeeded, failed, or stale film target state.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-atomic-invariant Source files are published, but no target closure is compiled into an atomic film artifact or structured film failure.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-result-checkpoint The exit status carries no source snapshot, artifact digest, covered scope, remaining omission, or adopted checkpoint.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant No target, input identity, view, platform, or condition is verified during creation.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure Missing project arguments are not missing authored film identities or provisional placeholders.
 * @evidenceExclude specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-resume-compatibility The creator owns no partial artifact, stale checkpoint, omission, diagnostic, or next-step record.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-deterministic-input-identity The creation inputs do not identify normalized film declarations, adopted assets, frame clock, seed, or runtime conditions.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-structural-output-invariant No geometry, relation, state, motion, camera, light, sound, proxy, or provisional film output is produced.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-choice-determinism-invariant The creator receives no authored technique, composition, quality tier, or seeded variation to compare.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-downstream-fidelity-output No downstream rendition identity, source digest, transformation provenance, output digest, or review state exists here.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-fidelity-failure-choice The adapter encounters no rendition preservation failure, fidelity provider failure, or downstream-path choice.
 * @evidenceExclude specifications/authoring-and-authority/prototype-determinism-and-fidelity.md#spec-authoring-prototype-exclusion-compatibility Project creation does not add a fidelity lane or change editor, export, likeness, or surface-quality exclusions.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Emits editable source and generated configuration as explicit initial project state rather than creator-private state.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Feeds explicit target identity and options into the canonical versioned template without editor cache or session memory.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage No compile, render, review, or delivery artifact with source snapshot and output digest is produced.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant The adapter materializes an initial tree and owns no later source-change invalidation or selective regeneration.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-change-impact-report Initial publication changes no existing production revision, so there are no invalidated or retained downstream targets or follow-up actions to report.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-ownership-failure Target-path refusal does not validate an adopted input's source, license, digest, consumer, or snapshot identity.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-resume-compatibility Leaves all continued authoring state in public generated-project files rather than launcher session state.
 * @author Samchon
 */
export const runCreateAutoMovie = (
  argv: readonly string[] = process.argv,
): number => {
  const arguments_ = argv.slice(2);
  const standalone =
    arguments_.length === 1 &&
    ["-h", "--help", "-v", "--version"].includes(arguments_[0]!);
  return run([
    argv[0] ?? process.execPath,
    "create-automovie",
    ...(standalone ? arguments_ : ["start", ...arguments_]),
  ]);
};

if (require.main === module) process.exitCode = runCreateAutoMovie();
