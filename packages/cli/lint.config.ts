import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Public cli contracts answer directly for both product promises and
 * package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    {
      name: "cli project creation locates requirement topics",
      type: "typescript",
      files: [
        "src/bin.ts",
        "src/renderScaffold.ts",
        "src/renderTemplate.ts",
        "src/templateVersions.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/agent-authoring/README.md",
          "requirements/product/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli project creation implements requirements",
      type: "typescript",
      files: [
        "src/bin.ts",
        "src/renderScaffold.ts",
        "src/renderTemplate.ts",
        "src/templateVersions.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/agent-authoring/capability-discovery.md",
          "requirements/agent-authoring/project-ownership.md",
          "requirements/agent-authoring/source-owned-loop.md",
          "requirements/product/capability-and-content.md",
          "requirements/product/extensibility-and-compatibility.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli project creation locates specification topics",
      type: "typescript",
      files: [
        "src/bin.ts",
        "src/renderScaffold.ts",
        "src/renderTemplate.ts",
        "src/templateVersions.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["specifications/authoring-and-authority/README.md"],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli project creation implements specifications",
      type: "typescript",
      files: [
        "src/bin.ts",
        "src/renderScaffold.ts",
        "src/renderTemplate.ts",
        "src/templateVersions.ts",
      ],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/authoring-and-authority/capability-and-content-boundary.md",
          "specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md",
          "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
          "specifications/authoring-and-authority/source-authority-and-derivation.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli render lifecycle dispatch locates requirement topics",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/operations-and-recovery/README.md",
          "requirements/rendering/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli render lifecycle dispatch implements requirements",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/operations-and-recovery/checkpoints-resume-and-retry.md",
          "requirements/operations-and-recovery/retention-and-cleanup.md",
          "requirements/operations-and-recovery/scope-job-identity-and-state.md",
          "requirements/rendering/chunks-resume-and-recovery.md",
          "requirements/rendering/scope-and-artifact-identity.md",
          "requirements/rendering/validation.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli render lifecycle dispatch locates specification topics",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/editorial-render-and-delivery/README.md",
          "specifications/execution-and-recovery/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli render lifecycle dispatch implements specifications",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/editorial-render-and-delivery/render-encoding-and-validation.md",
          "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
          "specifications/execution-and-recovery/checkpoints-resume-cache-and-dependencies.md",
          "specifications/execution-and-recovery/retention-cleanup-and-quarantine.md",
          "specifications/execution-and-recovery/scope-and-execution-identities.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli migration dispatch locates requirement topics",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/external-inputs/README.md",
          "requirements/operations-and-recovery/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli migration dispatch implements requirements",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/external-inputs/source-selection-and-provider-neutrality.md",
          "requirements/operations-and-recovery/migration-and-compatibility.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli migration dispatch locates specification topics",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/execution-and-recovery/README.md",
          "specifications/interchange-and-adoption/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli migration dispatch implements specifications",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/execution-and-recovery/portability-migration-and-compatibility.md",
          "specifications/interchange-and-adoption/intake-authority-and-routing.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli scaffold publication locates requirement topics",
      type: "typescript",
      files: ["src/scaffoldFileSnapshot.ts", "src/writeFiles.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["requirements/operations-and-recovery/README.md"],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli scaffold publication implements requirements",
      type: "typescript",
      files: ["src/scaffoldFileSnapshot.ts", "src/writeFiles.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/operations-and-recovery/failure-modes-and-recovery.md",
          "requirements/operations-and-recovery/idempotency-and-side-effects.md",
          "requirements/operations-and-recovery/partial-artifacts-and-publication.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli scaffold publication locates specification topics",
      type: "typescript",
      files: ["src/scaffoldFileSnapshot.ts", "src/writeFiles.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: ["specifications/execution-and-recovery/README.md"],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli scaffold publication implements specifications",
      type: "typescript",
      files: ["src/scaffoldFileSnapshot.ts", "src/writeFiles.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/execution-and-recovery/artifacts-and-atomic-publication.md",
          "specifications/execution-and-recovery/failure-reconciliation-and-disaster-recovery.md",
          "specifications/execution-and-recovery/retry-backoff-and-idempotency.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli project state inspection locates requirement topics",
      type: "typescript",
      files: ["src/loadAutoMovieProjectState.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/diagnostics/README.md",
          "requirements/evidence-and-provenance/README.md",
          "requirements/operations-and-recovery/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli project state inspection implements requirements",
      type: "typescript",
      files: ["src/loadAutoMovieProjectState.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "requirements/diagnostics/input-and-result-classification.md",
          "requirements/diagnostics/partial-artifacts-and-recovery.md",
          "requirements/evidence-and-provenance/canonical-digests-and-content-identity.md",
          "requirements/evidence-and-provenance/completeness-freshness-and-refusal.md",
          "requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md",
        ],
        symbol: ["h3"],
      },
    },
    {
      name: "cli project state inspection locates specification topics",
      type: "typescript",
      files: ["src/loadAutoMovieProjectState.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/evidence-and-provenance/README.md",
          "specifications/execution-and-recovery/README.md",
          "specifications/validation-and-diagnostics/README.md",
        ],
        symbol: ["h2", "h3"],
      },
    },
    {
      name: "cli project state inspection implements specifications",
      type: "typescript",
      files: ["src/loadAutoMovieProjectState.ts"],
      symbol: ["type", "function", "property"],
      reference: {
        type: "markdown",
        root: "../../docs",
        files: [
          "specifications/evidence-and-provenance/canonical-digests-and-content-identity.md",
          "specifications/evidence-and-provenance/completeness-freshness-and-refusal.md",
          "specifications/execution-and-recovery/checkpoints-resume-cache-and-dependencies.md",
          "specifications/validation-and-diagnostics/classification-and-causality.md",
          "specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md",
        ],
        symbol: ["h3"],
      },
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
