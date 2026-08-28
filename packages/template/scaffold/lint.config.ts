/// <reference types="node" />
import { createAutoMovieEvidenceConfig, evidence } from "@automovie/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * Select the production shape, then advance one layer at a time through
 * `draft -> evidence -> review`. The generated project starts deliberately
 * unselected and contains no production evidence inherited from its template.
 *
 * - film: settings -> treatments -> scripts -> screenplays -> shots -> filmSources
 * - brief: settings -> briefs -> shots -> filmSources
 * - library: settings plus any reviewed design/source branches, without shots
 *
 * Film and brief also require reviewed productionSources as a parallel input
 * before filmSources; it does not interrupt the prose-to-shot identity ladder.
 *
 * Research and the map, model, space, material, instance, motion, and system
 * branches are optional only when the delivery genuinely does not use them.
 * Audit discovery into flat docs/contracts files as soon as a Markdown layer
 * enters draft. Retained rules carry discovery evidence in their comment
 * preamble before H1, expose H2 targets, and are enforced through additive
 * `claims`; truthful negatives live only in docs/contracts/index.md. Never
 * delete a shared claim, weaken its cardinality, or hide a resident host.
 */
const graph = createAutoMovieEvidenceConfig({
  location: import.meta.dirname,
  kind: null,
  settings: "disabled",
  research: "disabled",
  maps: "disabled",
  models: "disabled",
  spaces: "disabled",
  materials: "disabled",
  instances: "disabled",
  motions: "disabled",
  systems: "disabled",
  treatments: "disabled",
  scripts: "disabled",
  screenplays: "disabled",
  briefs: "disabled",
  mapSources: "disabled",
  modelSources: "disabled",
  spaceSources: "disabled",
  materialSources: "disabled",
  instanceSources: "disabled",
  motionSources: "disabled",
  systemSources: "disabled",
  shots: "disabled",
  productionSources: "disabled",
  filmSources: "disabled",
  claims: [],
});

export default {
  format: {
    severity: "off",
    semi: true,
    singleQuote: false,
    arrowParens: "always",
    bracketSpacing: true,
    quoteProps: "as-needed",
    trailingComma: "all",
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    sortImports: { order: ["<THIRD_PARTY_MODULES>", "^[./]"] },
    jsDoc: true,
  },
  plugins: { evidence },
  rules: {
    "evidence/graph": ["error", graph],
    "evidence/todo": "error",
    eqeqeq: "error",
    "no-debugger": "error",
    "no-duplicate-imports": "error",
    "no-fallthrough": "error",
    "no-self-compare": "error",
    "no-var": "error",
    "prefer-const": "error",
    "typescript/await-thenable": "error",
    "typescript/ban-ts-comment": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/prefer-as-const": "error",
    "typescript/require-array-sort-compare": "error",
    "typescript/switch-exhaustiveness-check": "error",
  },
} satisfies ITtscLintConfig;
