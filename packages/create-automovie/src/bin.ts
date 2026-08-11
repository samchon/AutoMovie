#!/usr/bin/env node
import { run } from "@automovie/cli";

/**
 * Creates a project-owned production through the package-manager creator
 * convention.
 *
 * The adapter preserves the launch executable and user arguments, inserts the
 * canonical `start` action, and returns the canonical CLI exit status. It owns
 * no parallel template or hidden authoring state, so `create-automovie` and the
 * main CLI always materialize the same reviewable project source.
 *
 * @author Samchon
 * @param argv Package-manager process arguments, including the executable and
 *   creator command positions.
 * @returns The canonical CLI exit status for the delegated scaffold operation.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Delegates to the shared scaffolder while leaving production-specific facts in the created project.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Exposes the documented project creator through the package-manager convention.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability Produces the canonical public project structure without binding continued authoring to this launcher.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Starts authoring from the same readable project source emitted by the canonical CLI.
 * @evidence requirements/product/charter.md#product-author-owned-film Starts a repository in which production choices remain owned by the user project.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Reuses the system scaffolder that separates shared capability from project-owned facts.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Feeds the explicit target and options into the canonical versioned template derivation.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-resume-compatibility Leaves no launcher-owned session state that another compliant authoring tool would need to resume the project.
 * @evidenceExclude requirements/agent-authoring/README.md#에이전트-저작-요구사항 This adapter creates the initial tree but does not implement the topic index's complete multi-role authoring contract.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-editable-source-authority The creator writes editable source but does not decide whether later caches, renders, or generated results are current authority.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-project-owned-bytes The creator writes the starter; adoption and provenance of later external media bytes belong to project authoring and validation.
 * @evidenceExclude requirements/agent-authoring/project-ownership.md#agent-ambiguous-ownership-refusal No external asset is adopted by this argv adapter, so it has no ownership ambiguity to adjudicate.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-reviewable-source-change This entry creates the initial source tree but does not author or review a subsequent source diff.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Selecting a shot, frame, analysis, or test is the generated project's validation responsibility, not project creation.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-source-result-link The creator produces no compile, render, drawing, diagnostic, or review result requiring source lineage.
 * @evidenceExclude requirements/agent-authoring/source-owned-loop.md#agent-change-impact-visibility This entry performs no source revision whose downstream targets or evidence must be invalidated.
 * @evidenceExclude requirements/product/README.md#제품-계약-요구사항 Project creation does not implement the topic index's complete product, fidelity, service, compatibility, and exclusion contract.
 * @evidenceExclude requirements/product/charter.md#product-structural-output Project creation emits source files, not the film prototype whose structure a director judges.
 * @evidenceExclude requirements/product/charter.md#product-reproducible-judgment Deterministic compile and render results belong to the generated runtime; this adapter only selects the canonical scaffolder.
 * @evidenceExclude specifications/authoring-and-authority/README.md#저작과-권한-시스템-명세 A documentation topic map and its complete authority boundary are not implemented by the package-manager argv adapter.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-state This adapter neither inventories capabilities nor classifies them as available, unsupported, or unverified.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-not-content-invariant The creator selects no subject-specific catalogue entry or completed production content.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Production identities, relationships, assets, and validation outputs are authored after the starter exists.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-failure-gap The argv adapter does not evaluate authored facts or report a product capability gap.
 * @evidenceExclude specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-extension-compatibility Project creation does not add, migrate, or reopen a product capability.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state This entry creates no derived result whose current, stale, missing, or refused state must be classified.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-derivation-output-lineage No compile, render, review, or delivery derivation is executed during project creation.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-change-impact-invariant The adapter materializes an initial tree and owns no later source-change invalidation.
 * @evidenceExclude specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-ownership-failure This entry receives no external source, license, digest, or consumer identity to validate.
 */
export const runCreateAutoMovie = (
  argv: readonly string[] = process.argv,
): number =>
  run([
    argv[0] ?? process.execPath,
    "create-automovie",
    "start",
    ...argv.slice(2),
  ]);

if (require.main === module) process.exitCode = runCreateAutoMovie();
