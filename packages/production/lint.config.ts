import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Every authored production declaration joins the repository contract graph.
 *
 * The barrel is the only source exclusion because it re-exports declarations
 * whose defining symbols already carry their own contract evidence.
 *
 * Joining is selection, not obligation: a source that implements no listed
 * target owes nothing and stays silent, while every H3 unit of an admitted
 * document must be answered by a truthful citation or, when no production
 * export implements it, by an exclusion in the package ledger that names the
 * boundary. The document population below is curated by the contracts the
 * production library actually implements rather than by the whole corpus, so
 * admitting a document is a decision to answer for all of its units.
 */
const publicSurface = ["src/**/*.ts", "!src/**/index.ts"];

const productionRequirementContracts = [
  "requirements/agent-authoring/deterministic-precomputation.md",
  "requirements/agent-authoring/partial-work.md",
  "requirements/agent-authoring/source-owned-loop.md",
  "requirements/delivery-and-accessibility/audio-streams-and-channels.md",
  "requirements/delivery-and-accessibility/captions-subtitles-and-cues.md",
  "requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md",
  "requirements/delivery-and-accessibility/picture-color-and-image-sequences.md",
  "requirements/effects-and-simulation/clock-seek-and-determinism.md",
  "requirements/effects-and-simulation/scope-and-simulation-tiers.md",
  "requirements/evidence-and-provenance/completeness-freshness-and-refusal.md",
  "requirements/evidence-and-provenance/generation-transformation-and-derivation.md",
  "requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md",
  "requirements/external-inputs/credentials-rights-and-provenance.md",
  "requirements/external-inputs/media-families-and-declared-facts.md",
  "requirements/external-inputs/validation-and-quarantine.md",
  "requirements/operations-and-recovery/concurrent-runs-and-locking.md",
  "requirements/operations-and-recovery/retention-and-cleanup.md",
  "requirements/production-design/continuity-change-and-deliverables.md",
  "requirements/production-evidence/graph.md",
  "requirements/rendering/chunks-resume-and-recovery.md",
  "requirements/rendering/frame-schedules-and-sampling.md",
  "requirements/rendering/headless-and-platform-determinism.md",
  "requirements/rendering/scope-and-artifact-identity.md",
  "requirements/repaint/identity-and-provenance.md",
  "requirements/repaint/providers-models-and-credentials.md",
  "requirements/repaint/retries-seeds-and-variation.md",
  "requirements/repaint/sequence-continuity-and-publication.md",
  "requirements/review/subject-inspection.md",
  "requirements/sound/sources-and-external-assets.md",
  "requirements/sound/validation-and-delivery.md",
];

const productionSpecificationContracts = [
  "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
  "specifications/authoring-and-authority/partial-targets-and-atomic-results.md",
  "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
  "specifications/authoring-and-authority/source-authority-and-derivation.md",
  "specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md",
  "specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md",
  "specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md",
  "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
  "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
  "specifications/evidence-and-provenance/completeness-freshness-and-refusal.md",
  "specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md",
  "specifications/execution-and-recovery/artifacts-and-atomic-publication.md",
  "specifications/execution-and-recovery/concurrent-ownership-and-locking.md",
  "specifications/execution-and-recovery/retention-cleanup-and-quarantine.md",
  "specifications/interchange-and-adoption/media-inspection-boundaries.md",
  "specifications/interchange-and-adoption/provenance-rights-and-secrets.md",
  "specifications/narrative-and-intent/budgets-continuity-and-deliverables.md",
  "specifications/production-evidence/graph.md",
  "specifications/review-and-acceptance/subject-surface-and-inspection.md",
  "specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md",
  "specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md",
  "specifications/simulation-effects-and-sound/scope-tiers-and-identities.md",
  "specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md",
  "specifications/simulation-effects-and-sound/validation-evidence-and-compatibility.md",
  "specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md",
];

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "public production exports implement requirements",
      type: "typescript",
      files: publicSurface,
      evidenceExcludeCarriers: ["src/AutoMovieProductionEvidenceExclusions.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: productionRequirementContracts,
          symbol: "h3",
        },
      ],
    },
    {
      name: "public production exports implement specifications",
      type: "typescript",
      files: publicSurface,
      evidenceExcludeCarriers: ["src/AutoMovieProductionEvidenceExclusions.ts"],
      symbol: ["type", "function", "property"],
      reference: [
        {
          type: "markdown",
          root: "../../docs",
          files: productionSpecificationContracts,
          symbol: "h3",
        },
        {
          type: "markdown",
          root: "../../docs",
          files: ["specifications/review-and-acceptance/README.md"],
          symbol: "h2",
        },
      ],
    },
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
