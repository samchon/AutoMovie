import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

const H1_ONLY_READMES = new Set([
  "requirements/agent-authoring/README.md",
  "requirements/evidence-and-provenance/README.md",
  "requirements/operations-and-recovery/README.md",
  "requirements/product/README.md",
  "requirements/rendering/README.md",
]);

const H2_CONTRACTS = new Set([
  "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
  "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
]);

/** Select each Markdown artifact at the heading level it actually contracts. */
const markdownReferences = (files: string[]): ITtscEvidenceGraphReference[] => {
  const readmes = files.filter((file) => file.endsWith("/README.md"));
  const contracts = files.filter((file) => !file.endsWith("/README.md"));
  const readmeTitles = readmes.filter((file) => H1_ONLY_READMES.has(file));
  const readmeSections = readmes.filter(
    (file) => H1_ONLY_READMES.has(file) === false,
  );
  const h2Contracts = contracts.filter((file) => H2_CONTRACTS.has(file));
  const h3Contracts = contracts.filter(
    (file) => H2_CONTRACTS.has(file) === false,
  );
  return [
    ...(readmeTitles.length === 0
      ? []
      : [
          {
            type: "markdown",
            root: "../../docs",
            files: readmeTitles,
            symbol: ["h1"],
          } satisfies ITtscEvidenceGraphReference,
        ]),
    ...(readmeSections.length === 0
      ? []
      : [
          {
            type: "markdown",
            root: "../../docs",
            files: readmeSections,
            symbol: ["h1", "h2", "h3"],
          } satisfies ITtscEvidenceGraphReference,
        ]),
    ...(h2Contracts.length === 0
      ? []
      : [
          {
            type: "markdown",
            root: "../../docs",
            files: h2Contracts,
            symbol: ["h2"],
          } satisfies ITtscEvidenceGraphReference,
        ]),
    ...(h3Contracts.length === 0
      ? []
      : [
          {
            type: "markdown",
            root: "../../docs",
            files: h3Contracts,
            symbol: ["h3"],
          } satisfies ITtscEvidenceGraphReference,
        ]),
  ];
};

/**
 * Public cli contracts answer directly for both product promises and
 * package-independent system contracts.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
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
      reference: markdownReferences([
        "requirements/agent-authoring/README.md",
        "requirements/agent-authoring/capability-discovery.md",
        "requirements/agent-authoring/project-ownership.md",
        "requirements/product/README.md",
        "requirements/product/capability-and-content.md",
      ]),
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
      reference: markdownReferences([
        "specifications/authoring-and-authority/README.md",
        "specifications/authoring-and-authority/capability-and-content-boundary.md",
        "specifications/authoring-and-authority/source-authority-and-derivation.md",
      ]),
    },
    {
      name: "cli render lifecycle dispatch implements requirements",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/checkpoints-resume-and-retry.md",
        "requirements/operations-and-recovery/retention-and-cleanup.md",
        "requirements/operations-and-recovery/scope-job-identity-and-state.md",
        "requirements/rendering/README.md",
        "requirements/rendering/chunks-resume-and-recovery.md",
        "requirements/rendering/scope-and-artifact-identity.md",
      ]),
    },
    {
      name: "cli render lifecycle dispatch implements specifications",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/editorial-render-and-delivery/README.md",
        "specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md",
        "specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md",
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/checkpoints-resume-cache-and-dependencies.md",
        "specifications/execution-and-recovery/retention-cleanup-and-quarantine.md",
        "specifications/execution-and-recovery/scope-and-execution-identities.md",
      ]),
    },
    {
      name: "cli migration dispatch implements requirements",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/external-inputs/README.md",
        "requirements/external-inputs/source-selection-and-provider-neutrality.md",
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/migration-and-compatibility.md",
      ]),
    },
    {
      name: "cli migration dispatch implements specifications",
      type: "typescript",
      files: ["src/bin.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/portability-migration-and-compatibility.md",
        "specifications/interchange-and-adoption/README.md",
        "specifications/interchange-and-adoption/intake-authority-and-routing.md",
      ]),
    },
    {
      name: "cli scaffold publication implements requirements",
      type: "typescript",
      files: ["src/scaffoldFileSnapshot.ts", "src/writeFiles.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/operations-and-recovery/README.md",
        "requirements/operations-and-recovery/idempotency-and-side-effects.md",
      ]),
    },
    {
      name: "cli scaffold publication implements specifications",
      type: "typescript",
      files: ["src/scaffoldFileSnapshot.ts", "src/writeFiles.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/execution-and-recovery/README.md",
        "specifications/execution-and-recovery/retry-backoff-and-idempotency.md",
      ]),
    },
    {
      name: "cli project state inspection implements requirements",
      type: "typescript",
      files: ["src/loadAutoMovieProjectState.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "requirements/diagnostics/README.md",
        "requirements/diagnostics/input-and-result-classification.md",
        "requirements/evidence-and-provenance/README.md",
        "requirements/evidence-and-provenance/completeness-freshness-and-refusal.md",
      ]),
    },
    {
      name: "cli project state inspection implements specifications",
      type: "typescript",
      files: ["src/loadAutoMovieProjectState.ts"],
      symbol: ["type", "function", "property"],
      reference: markdownReferences([
        "specifications/evidence-and-provenance/README.md",
        "specifications/evidence-and-provenance/completeness-freshness-and-refusal.md",
        "specifications/validation-and-diagnostics/README.md",
        "specifications/validation-and-diagnostics/classification-and-causality.md",
      ]),
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
