/// <reference types="node" />
import { evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

import { createAutoMovieEvidenceConfig } from "./config/src/createAutoMovieEvidenceConfig";

/**
 * The starter is a reviewed film. Change `kind` only when the production's
 * authored result changes shape, and advance each stage only in the order the
 * generated `AGENTS.md` defines.
 *
 * - `film` owns `storylines -> scenarios -> script -> shots -> filmSources`;
 *   `briefs` stays disabled.
 * - `brief` owns one bounded audiovisual brief, its shots, and film source; all
 *   three narrative layers stay disabled.
 * - `library` owns settings, production source, model or motion design, and
 *   their source without shots or film source.
 *
 * `disabled` means the layer has no hosts because its kind forbids it or work
 * has not begun. An applicable layer advances through `draft`, `evidence`, and
 * `review`: draft owns the complete first version without graph pressure,
 * evidence enforces coverage, and review also requires current fingerprints.
 * A child cannot enter draft until its direct parents are reviewed.
 */
const graph = createAutoMovieEvidenceConfig({
  location: import.meta.dirname,
  kind: "film",
  settings: "review",
  research: "disabled",
  models: "review",
  motions: "review",
  storylines: "review",
  scenarios: "review",
  script: "review",
  briefs: "disabled",
  modelSources: "review",
  motionSources: "review",
  shots: "review",
  productionSources: "review",
  filmSources: "review",

  // The starter audit found no production-specific target beyond the shared
  // graph. Add typed claims here with the target documents they activate.
  claims: [],
});

/**
 * Generated-project lint policy.
 *
 * The evidence factory owns production-document and source traceability. The
 * remaining rules guard the async render path, discriminated unions, and the
 * ordinary TypeScript failures a generated project must reject on its first
 * `npm run lint:source`.
 */
const config = {
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
    sortImports: {
      order: ["<THIRD_PARTY_MODULES>", "^[./]"],
    },
    jsDoc: true,
  },
  plugins: {
    evidence,
  },
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

export default config;
