import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const H2_ONLY_MARKDOWN = new Set([
  "specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md",
  "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
  "specifications/editorial-render-and-delivery/render-encoding-and-validation.md",
  "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
  "specifications/interior-space/scope-and-host.md",
]);

const markdownReferences = (files: string[]): ITtscEvidenceGraphReference[] => {
  const readmes = files.filter((file) => file.endsWith("/README.md"));
  const h2Only = files.filter((file) => H2_ONLY_MARKDOWN.has(file));
  const h3 = files.filter(
    (file) => !file.endsWith("/README.md") && !H2_ONLY_MARKDOWN.has(file),
  );
  return [
    ...(readmes.length === 0
      ? []
      : [
          {
            type: "markdown" as const,
            root: "../../docs",
            files: readmes,
            symbol: ["h1", "h2", "h3"] as Array<"h1" | "h2" | "h3">,
          },
        ]),
    ...(h3.length === 0
      ? []
      : [
          {
            type: "markdown" as const,
            root: "../../docs",
            files: h3,
            symbol: ["h3"] as Array<"h3">,
          },
        ]),
    ...(h2Only.length === 0
      ? []
      : [
          {
            type: "markdown" as const,
            root: "../../docs",
            files: h2Only,
            symbol: ["h2"] as Array<"h2">,
          },
        ]),
  ];
};

interface IResponsibilityClaim {
  name: string;
  files: string[];
  requirements: string[];
  specifications: string[];
}

const responsibilityClaims = (
  input: IResponsibilityClaim,
): ITtscEvidenceGraphConfig["claims"] => [
  {
    name: `${input.name} requirements`,
    type: "typescript",
    files: input.files,
    symbol: ["type", "function", "property"],
    reference: markdownReferences(input.requirements),
  },
  {
    name: `${input.name} specifications`,
    type: "typescript",
    files: input.files,
    symbol: ["type", "function", "property"],
    reference: markdownReferences(input.specifications),
  },
];

/** Public MCP leaves answer only for the exact contracts they implement. */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    ...responsibilityClaims({
      name: "mcp coordination and knowledge boundary",
      files: [
        "src/AutoMovieApplication.ts",
        "src/createAutoMovieMcpServer.ts",
        "src/production/AutoMovieProductionContext.ts",
        "src/production/AutoMovieProductionGuideService.ts",
      ],
      requirements: [
        "requirements/agent-authoring/README.md",
        "requirements/agent-authoring/capability-discovery.md",
        "requirements/agent-authoring/mcp-boundary.md",
        "requirements/product/README.md",
        "requirements/product/capability-and-content.md",
        "requirements/product/charter.md",
        "requirements/product/choice-and-external-services.md",
        "requirements/product/scope-and-exclusions.md",
      ],
      specifications: [
        "specifications/authoring-and-authority/README.md",
        "specifications/authoring-and-authority/capability-and-content-boundary.md",
        "specifications/authoring-and-authority/delegation-and-decision-authority.md",
        "specifications/authoring-and-authority/external-execution-and-provider-neutrality.md",
        "specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md",
        "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
      ],
    }),
    ...responsibilityClaims({
      name: "optional repaint delivery",
      files: [
        "src/AutoMovieApplication.ts",
        "src/production/AutoMovieProductionRepaintService.ts",
      ],
      requirements: [
        "requirements/product/README.md",
        "requirements/product/choice-and-external-services.md",
        "requirements/repaint/README.md",
        "requirements/repaint/eligibility-and-prerequisites.md",
        "requirements/repaint/identity-and-provenance.md",
        "requirements/repaint/prompts-controls-and-constraints.md",
        "requirements/repaint/providers-models-and-credentials.md",
        "requirements/repaint/retries-seeds-and-variation.md",
        "requirements/repaint/scope-and-user-choice.md",
        "requirements/repaint/source-frames-and-reference-locking.md",
        "requirements/repaint/structural-comparison-and-review.md",
      ],
      specifications: [
        "specifications/asset-and-representation/README.md",
        "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
        "specifications/authoring-and-authority/README.md",
        "specifications/authoring-and-authority/delegation-and-decision-authority.md",
        "specifications/authoring-and-authority/external-execution-and-provider-neutrality.md",
      ],
    }),
    ...responsibilityClaims({
      name: "acceptance scope and observable evaluation",
      files: [
        "src/production/acceptanceScope.ts",
        "src/production/AutoMovieProductionOracleService.ts",
      ],
      requirements: [
        "requirements/acceptance/README.md",
        "requirements/acceptance/criteria-and-observables.md",
        "requirements/acceptance/evidence-and-freshness.md",
        "requirements/acceptance/profiles-and-aggregation.md",
        "requirements/acceptance/scope-targets-and-authority.md",
        "requirements/acceptance/uncertainty-and-partial-success.md",
      ],
      specifications: [
        "specifications/review-and-acceptance/README.md",
        "specifications/review-and-acceptance/criteria-tolerance-and-comparison.md",
        "specifications/review-and-acceptance/evidence-freshness-and-completeness.md",
        "specifications/review-and-acceptance/profiles-aggregation-and-partial-results.md",
        "specifications/review-and-acceptance/target-scope-and-context.md",
      ],
    }),
    ...responsibilityClaims({
      name: "review worksheet and evidence",
      files: ["src/production/AutoMovieProductionReviewService.ts"],
      requirements: [
        "requirements/review/README.md",
        "requirements/review/annotations-findings-and-verdicts.md",
        "requirements/review/criteria-and-comparison.md",
        "requirements/review/records-and-completeness.md",
        "requirements/review/reproducible-context.md",
        "requirements/review/scope-and-authority.md",
      ],
      specifications: [
        "specifications/review-and-acceptance/README.md",
        "specifications/review-and-acceptance/criteria-tolerance-and-comparison.md",
        "specifications/review-and-acceptance/evidence-freshness-and-completeness.md",
        "specifications/review-and-acceptance/observations-findings-and-defects.md",
        "specifications/review-and-acceptance/target-scope-and-context.md",
        "specifications/review-and-acceptance/verdict-authority-and-dissent.md",
      ],
    }),
    ...responsibilityClaims({
      name: "production design data and validation",
      files: [
        "src/convert.ts",
        "src/dto.ts",
        "src/production/productionArchetypes.ts",
        "src/production/validateProductionDesign.ts",
      ],
      requirements: [
        "requirements/production-design/README.md",
        "requirements/production-design/continuity-change-and-deliverables.md",
        "requirements/production-design/scope-and-source-of-truth.md",
      ],
      specifications: [
        "specifications/authoring-and-authority/README.md",
        "specifications/authoring-and-authority/source-authority-and-derivation.md",
      ],
    }),
    ...responsibilityClaims({
      name: "compiler and authored source execution",
      files: [
        "src/production/AutoMovieProductionCompiler.ts",
        "src/production/filmTimeline.ts",
        "src/production/linkProductionSource.ts",
        "src/production/materializeProduction.ts",
        "src/production/sandboxEngineBridge.ts",
        "src/production/sandboxEngineSurface.ts",
      ],
      requirements: [
        "requirements/agent-authoring/README.md",
        "requirements/agent-authoring/partial-work.md",
        "requirements/agent-authoring/project-ownership.md",
        "requirements/agent-authoring/source-owned-loop.md",
        "requirements/production-design/README.md",
        "requirements/production-design/continuity-change-and-deliverables.md",
        "requirements/production-design/scope-and-source-of-truth.md",
      ],
      specifications: [
        "specifications/authoring-and-authority/README.md",
        "specifications/authoring-and-authority/partial-targets-and-atomic-results.md",
        "specifications/authoring-and-authority/source-authority-and-derivation.md",
      ],
    }),
    ...responsibilityClaims({
      name: "building interior compiler boundary",
      files: [
        "src/production/AutoMovieProductionCompiler.ts",
        "src/production/AutoMovieProductionGuideService.ts",
      ],
      requirements: [
        "requirements/interior/README.md",
        "requirements/interior/scope-and-host-boundary.md",
      ],
      specifications: [
        "specifications/interior-space/README.md",
        "specifications/interior-space/scope-and-host.md",
      ],
    }),
    ...responsibilityClaims({
      name: "diagnostic catalog lookup",
      files: ["src/production/diagnosticCatalog.ts"],
      requirements: [
        "requirements/diagnostics/README.md",
        "requirements/diagnostics/identity-path-and-context.md",
      ],
      specifications: [
        "specifications/validation-and-diagnostics/README.md",
        "specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md",
      ],
    }),
    ...responsibilityClaims({
      name: "compiler diagnostic production",
      files: [
        "src/production/AutoMovieProductionCompiler.ts",
        "src/production/designReferenceDiagnostics.ts",
        "src/production/filmGrammarDiagnostics.ts",
        "src/production/screenplayLedgerDiagnostics.ts",
        "src/production/screenplayProseDiagnostics.ts",
        "src/production/storySyncDiagnostics.ts",
        "src/production/validateProductionDesign.ts",
        "src/validators/**/*.ts",
      ],
      requirements: [
        "requirements/diagnostics/README.md",
        "requirements/diagnostics/budgets-and-limits.md",
        "requirements/diagnostics/collection-fail-fast-and-determinism.md",
        "requirements/diagnostics/identity-path-and-context.md",
        "requirements/diagnostics/input-and-result-classification.md",
        "requirements/diagnostics/localization-and-machine-results.md",
        "requirements/diagnostics/partial-artifacts-and-recovery.md",
      ],
      specifications: [
        "specifications/validation-and-diagnostics/README.md",
        "specifications/validation-and-diagnostics/budget-and-truncation.md",
        "specifications/validation-and-diagnostics/classification-and-causality.md",
        "specifications/validation-and-diagnostics/collection-order-and-termination.md",
        "specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md",
        "specifications/validation-and-diagnostics/localization-and-machine-results.md",
        "specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md",
      ],
    }),
    ...responsibilityClaims({
      name: "external content identity",
      files: ["src/production/contentIdentity.ts"],
      requirements: [
        "requirements/evidence-and-provenance/README.md",
        "requirements/evidence-and-provenance/canonical-digests-and-content-identity.md",
        "requirements/external-inputs/README.md",
        "requirements/external-inputs/identity-coordinates-and-units.md",
      ],
      specifications: [
        "specifications/evidence-and-provenance/README.md",
        "specifications/evidence-and-provenance/canonical-digests-and-content-identity.md",
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/identity-coordinates-and-units.md",
      ],
    }),
    ...responsibilityClaims({
      name: "asset acquisition and generation",
      files: ["src/production/assetAcquisition.ts"],
      requirements: [
        "requirements/asset-authoring/README.md",
        "requirements/asset-authoring/generated-assets.md",
        "requirements/evidence-and-provenance/README.md",
        "requirements/evidence-and-provenance/generation-transformation-and-derivation.md",
        "requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md",
        "requirements/external-inputs/README.md",
        "requirements/external-inputs/credentials-rights-and-provenance.md",
        "requirements/external-inputs/source-selection-and-provider-neutrality.md",
      ],
      specifications: [
        "specifications/asset-and-representation/README.md",
        "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
        "specifications/evidence-and-provenance/README.md",
        "specifications/evidence-and-provenance/generation-transformation-and-derivation.md",
        "specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md",
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/provenance-rights-and-secrets.md",
      ],
    }),
    ...responsibilityClaims({
      name: "legacy external adoption and recovery",
      files: ["src/production/AutoMovieLegacyImporter.ts"],
      requirements: [
        "requirements/external-inputs/README.md",
        "requirements/external-inputs/adoption-modes-and-composition.md",
        "requirements/external-inputs/conversion-receipts-and-determinism.md",
        "requirements/external-inputs/credentials-rights-and-provenance.md",
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/failure-modes-and-recovery.md",
        "requirements/operations-and-recovery/idempotency-and-side-effects.md",
        "requirements/operations-and-recovery/migration-and-compatibility.md",
        "requirements/operations-and-recovery/partial-artifacts-and-publication.md",
      ],
      specifications: [
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/artifacts-and-atomic-publication.md",
        "specifications/execution-and-recovery/failure-reconciliation-and-disaster-recovery.md",
        "specifications/execution-and-recovery/portability-migration-and-compatibility.md",
        "specifications/execution-and-recovery/retry-backoff-and-idempotency.md",
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/adoption-decisions-and-composition.md",
        "specifications/interchange-and-adoption/conversion-receipts-and-determinism.md",
        "specifications/interchange-and-adoption/provenance-rights-and-secrets.md",
      ],
    }),
    ...responsibilityClaims({
      name: "external media inspection",
      files: ["src/production/inspectDesignReferenceAsset.ts"],
      requirements: [
        "requirements/external-inputs/README.md",
        "requirements/external-inputs/media-families-and-declared-facts.md",
        "requirements/external-inputs/unsupported-and-degradation.md",
        "requirements/external-inputs/validation-and-quarantine.md",
      ],
      specifications: [
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/media-inspection-boundaries.md",
        "specifications/interchange-and-adoption/support-degradation-and-refusal.md",
        "specifications/interchange-and-adoption/validation-and-quarantine.md",
      ],
    }),
    ...responsibilityClaims({
      name: "production audio decode",
      files: ["src/production/decodeProductionAudioAsset.ts"],
      requirements: [
        "requirements/external-inputs/README.md",
        "requirements/external-inputs/media-families-and-declared-facts.md",
        "requirements/external-inputs/unsupported-and-degradation.md",
        "requirements/sound/README.md",
        "requirements/sound/sources-and-external-assets.md",
        "requirements/sound/validation-and-delivery.md",
      ],
      specifications: [
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/media-inspection-boundaries.md",
        "specifications/interchange-and-adoption/support-degradation-and-refusal.md",
        "specifications/simulation-effects-and-sound/README.md",
        "specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md",
      ],
    }),
    ...responsibilityClaims({
      name: "production state and inspection",
      files: [
        "src/project/AutoMovieProject.ts",
        "src/production/AutoMovieProductionProject.ts",
        "src/production/openAutoMovieProduction.ts",
      ],
      requirements: [
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/failure-modes-and-recovery.md",
        "requirements/operations-and-recovery/idempotency-and-side-effects.md",
        "requirements/operations-and-recovery/migration-and-compatibility.md",
        "requirements/operations-and-recovery/partial-artifacts-and-publication.md",
        "requirements/operations-and-recovery/scope-job-identity-and-state.md",
      ],
      specifications: [
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/artifacts-and-atomic-publication.md",
        "specifications/execution-and-recovery/failure-reconciliation-and-disaster-recovery.md",
        "specifications/execution-and-recovery/portability-migration-and-compatibility.md",
        "specifications/execution-and-recovery/retry-backoff-and-idempotency.md",
        "specifications/execution-and-recovery/scope-and-execution-identities.md",
      ],
    }),
    ...responsibilityClaims({
      name: "caption readability inspection",
      files: ["src/production/openAutoMovieProduction.ts"],
      requirements: [
        "requirements/delivery-and-accessibility/README.md",
        "requirements/delivery-and-accessibility/captions-subtitles-and-cues.md",
      ],
      specifications: [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md",
      ],
    }),
    ...responsibilityClaims({
      name: "project namespace locking",
      files: [
        "src/project/commitLock.ts",
        "src/production/rootNamespaceLock.ts",
      ],
      requirements: [
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/concurrent-runs-and-locking.md",
      ],
      specifications: [
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/concurrent-ownership-and-locking.md",
      ],
    }),
    ...responsibilityClaims({
      name: "render and capture identity",
      files: [
        "src/production/captureRuntimeIdentity.ts",
        "src/production/renderIdentity.ts",
        "src/production/renditionIdentity.ts",
      ],
      requirements: [
        "requirements/rendering/README.md",
        "requirements/rendering/frame-identity-and-content-addressing.md",
        "requirements/rendering/headless-and-platform-determinism.md",
        "requirements/rendering/scope-and-artifact-identity.md",
        "requirements/repaint/README.md",
        "requirements/repaint/identity-and-provenance.md",
      ],
      specifications: [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
        "specifications/asset-and-representation/README.md",
        "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
      ],
    }),
    ...responsibilityClaims({
      name: "publication registry and snapshot",
      files: [
        "src/production/productionPublicationSnapshot.ts",
        "src/production/productionRegistry.ts",
      ],
      requirements: [
        "requirements/delivery-and-accessibility/README.md",
        "requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md",
        "requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md",
        "requirements/delivery-and-accessibility/publication-and-retention.md",
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/partial-artifacts-and-publication.md",
      ],
      specifications: [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md",
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/artifacts-and-atomic-publication.md",
      ],
    }),
    ...responsibilityClaims({
      name: "render jobs budgets and cleanup",
      files: [
        "src/production/productionRenderGc.ts",
        "src/production/productionRenderJob.ts",
      ],
      requirements: [
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/partial-artifacts-and-publication.md",
        "requirements/operations-and-recovery/resource-budgets-and-backpressure.md",
        "requirements/operations-and-recovery/retention-and-cleanup.md",
        "requirements/operations-and-recovery/scope-job-identity-and-state.md",
        "requirements/rendering/README.md",
        "requirements/rendering/budgets.md",
        "requirements/rendering/chunks-resume-and-recovery.md",
        "requirements/rendering/frame-schedules-and-sampling.md",
        "requirements/rendering/headless-and-platform-determinism.md",
        "requirements/rendering/scope-and-artifact-identity.md",
      ],
      specifications: [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/artifacts-and-atomic-publication.md",
        "specifications/execution-and-recovery/resource-budgets-and-backpressure.md",
        "specifications/execution-and-recovery/retention-cleanup-and-quarantine.md",
      ],
    }),
    ...responsibilityClaims({
      name: "render encoding and media validation",
      files: [
        "src/production/muxProductionFeatureMp4.ts",
        "src/production/probeProductionMedia.ts",
        "src/production/trimProductionAudioPresentation.ts",
      ],
      requirements: [
        "requirements/delivery-and-accessibility/README.md",
        "requirements/delivery-and-accessibility/integrity-provenance-and-authenticity.md",
        "requirements/delivery-and-accessibility/packages-manifests-and-dependencies.md",
        "requirements/rendering/README.md",
        "requirements/rendering/encoding-and-multiplexing.md",
        "requirements/rendering/validation.md",
      ],
      specifications: [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md",
        "specifications/editorial-render-and-delivery/render-encoding-and-validation.md",
      ],
    }),
    ...responsibilityClaims({
      name: "final audio picture join",
      files: [
        "src/production/muxProductionFeatureMp4.ts",
        "src/production/trimProductionAudioPresentation.ts",
      ],
      requirements: [
        "requirements/sound/README.md",
        "requirements/sound/validation-and-delivery.md",
      ],
      specifications: [
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md",
        "specifications/simulation-effects-and-sound/README.md",
        "specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md",
      ],
    }),
  ],
};

export default {
  extends: "../../config/lint.config.ts",
  plugins: { evidence },
  rules: {
    "evidence/documented": [
      "error",
      { symbol: ["type", "function", "property"] },
    ],
    "evidence/graph": ["error", graph],
    "evidence/todo": "error",
  },
} satisfies ITtscLintConfig;
