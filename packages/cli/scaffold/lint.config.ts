/// <reference types="node" />
import type {} from "@automovie/lint";
import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig, ITtscLintPlugin } from "@ttsc/lint";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const automovie = {
  source: path.join(
    path.dirname(require.resolve("@automovie/lint/package.json")),
    "native",
  ),
} satisfies ITtscLintPlugin;

/**
 * The production's obligation graph, expressed as its folder layout.
 *
 * A film converges when each stage of definition answers for the one above it.
 * Screenwriting already works that way, logline to treatment to beat to scene,
 * each stage removing ambiguity the previous one left. Here that ladder is
 * mechanical: every claim population owes a citation to its reference
 * population, every pair is its own 100% obligation, and an unpaid one is a
 * compile error rather than something a reader has to notice.
 *
 * Read each entry as one sentence. Files under `files` must each cite a unit
 * under `reference`, and a citation toward one reference never counts toward
 * another.
 *
 * The design records under `.automovie/design` are absent on purpose. Evidence
 * graphs Markdown, Prisma, TypeScript, and Swagger; JSON cannot host a
 * citation. That is why the typed sources under `src` own the subjects and `npm
 * run design` emits the records from them.
 */
const graph: ITtscEvidenceGraphConfig = {
  claims: [
    // The staged prose ladder. Each stage is one file per unit, so a sequence,
    // a beat, and a scene are each a citable member rather than a heading
    // inside a document that holds the whole film.
    {
      type: "markdown",
      files: ["docs/*/02-treatment/*.md"],
      reference: {
        type: "markdown",
        files: ["docs/*/01-logline.md"],
        symbol: "file",
      },
    },
    {
      type: "markdown",
      files: ["docs/*/03-beats/*.md"],
      reference: {
        type: "markdown",
        files: ["docs/*/02-treatment/*.md"],
        symbol: "file",
      },
    },
    {
      type: "markdown",
      files: ["docs/*/04-scenes/*.md"],
      reference: {
        type: "markdown",
        files: ["docs/*/03-beats/*.md"],
        symbol: "file",
      },
    },
    // The spec library. A subject exists because a scene calls for it; one that
    // no scene calls for is a subject the film does not need.
    {
      type: "markdown",
      files: ["docs/characters/*.md", "docs/objects/*.md", "docs/world/*.md"],
      reference: {
        type: "markdown",
        files: ["docs/*/04-scenes/*.md"],
        symbol: "file",
      },
    },
    // Implementation answers for its specification. A unit, prop, or place in
    // source with no spec is a decision nobody wrote down.
    {
      type: "typescript",
      files: ["src/units/*.ts", "src/objects/*.ts", "src/world/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/characters/*.md", "docs/objects/*.md", "docs/world/*.md"],
        symbol: "file",
      },
    },
    // A formation groups a subject that must already be specified. The
    // reference is every character spec, not the one this formation happens to
    // group, so a character nothing ever forms up is still an unpaid
    // obligation somewhere in the graph rather than a silent orphan.
    // Source grounds source: an action cites the vocabulary it moves, so a
    // drill cannot outlive the unit it was written for.
    {
      type: "typescript",
      files: ["src/drills/*.ts"],
      symbol: "function",
      reference: {
        type: "typescript",
        files: ["src/units/*.ts", "src/formations/*.ts"],
        symbol: "function",
      },
    },
    // A shot realizes a scene. This is the join that stops a film from
    // accumulating footage nothing asked for.
    {
      type: "typescript",
      files: ["src/shots/*.ts"],
      symbol: "function",
      reference: {
        type: "markdown",
        files: ["docs/*/04-scenes/*.md"],
        symbol: "file",
      },
    },
  ],
};

/**
 * `@ttsc/lint` config for this automovie project, applied automatically by
 * `ttsc` (`npm run lint:source` runs `ttsc --noEmit`) and autofixed by `npm run
 * format` (`ttsc format`). The engine is the arbiter of physical truth at
 * runtime; this config is the arbiter of code health at build time.
 *
 * The `format` block mirrors automovie's own house style (80 columns, double
 * quotes, semicolons, `lf`, trailing commas, third-party-then-relative import
 * order); its `severity: "off"` means formatting is a `npm run format` opt-in,
 * not a build blocker. The `rules` are a deliberately small, high-value
 * CORRECTNESS set (the classes of bug this stack is most exposed to), not a
 * style dragnet:
 *
 * - `switch-exhaustiveness-check` is the load-bearing one: automovie's API is
 *   discriminated unions everywhere (action verbs, shapes, targets), and an
 *   unhandled variant is exactly the silent-skip the engine's own doctrine
 *   forbids. Here the compiler catches it in YOUR code too.
 * - `no-floating-promises` / `no-misused-promises` / `await-thenable` guard the
 *   async render and perform paths from dropped promises.
 * - `no-explicit-any` keeps you inside the typed contract the engine enforces
 *   against: an `any` is where a malformed pose slips past the type layer.
 * - The rest (`eqeqeq`, `no-var`, `prefer-const`, `no-self-compare`,
 *   `no-fallthrough`, `no-duplicate-imports`, `ban-ts-comment`, the small
 *   autofixable TypeScript rules) are cheap, unambiguous, and mechanically
 *   fixable.
 *
 * Add to it as your project grows; every rule here is `error` because each one
 * flags a real defect, not a preference.
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
    automovie,
    evidence,
  },
  rules: {
    // The obligation graph above. Project-scoped, so this entry declares no
    // `files` of its own.
    "evidence/graph": ["error", graph],
    // A remaining `@todo` is an obligation the author wrote down and did not
    // pay. It fails with its own text rather than being counted as done.
    "evidence/todo": "error",
    "automovie/asset-provenance": [
      "error",
      {
        manifests: [".automovie/assets.json"],
        assets: [
          "public/**/*.bin",
          "public/**/*.exr",
          "public/**/*.flac",
          "public/**/*.glb",
          "public/**/*.gltf",
          "public/**/*.hdr",
          "public/**/*.jpeg",
          "public/**/*.jpg",
          "public/**/*.json",
          "public/**/*.ktx",
          "public/**/*.ktx2",
          "public/**/*.mp3",
          "public/**/*.ogg",
          "public/**/*.otf",
          "public/**/*.png",
          "public/**/*.svg",
          "public/**/*.ttf",
          "public/**/*.vrm",
          "public/**/*.wav",
          "public/**/*.webp",
          "public/**/*.woff",
          "public/**/*.woff2",
        ],
      },
    ],
    "automovie/screenplay-contract": [
      "error",
      {
        indexes: [
          ".automovie/design/screenplay/index.json",
          ".automovie/design/*/screenplay/index.json",
        ],
        documents: ["docs/**/*.md"],
        shots: [
          ".automovie/design/shots/*.json",
          ".automovie/design/*/shots/*.json",
        ],
        acceptance: [
          ".automovie/design/acceptance/*.json",
          ".automovie/design/*/acceptance/*.json",
        ],
        models: [
          ".automovie/design/models/*.json",
          ".automovie/design/*/models/*.json",
          ".automovie/design/shared/models/*.json",
        ],
        formations: [
          ".automovie/design/formations/*.json",
          ".automovie/design/*/formations/*.json",
          ".automovie/design/shared/formations/*.json",
        ],
        worlds: [
          ".automovie/design/world.json",
          ".automovie/design/*/world.json",
          ".automovie/design/shared/world.json",
        ],
        realizations: [
          "generated/realizations/*.json",
          "generated/*/realizations/*.json",
        ],
        reviews: [
          ".automovie/reviews/shots/*.json",
          ".automovie/reviews/film/*.json",
          ".automovie/reviews/*/shots/*.json",
          ".automovie/reviews/*/film/*.json",
        ],
      },
    ],
    "automovie/state-presence": [
      "error",
      {
        slots: [
          {
            name: "screenplay-index",
            files: [
              ".automovie/design/screenplay/index.json",
              ".automovie/design/*/screenplay/index.json",
            ],
            requires: [],
          },
          {
            name: "shot-contracts",
            files: [
              ".automovie/design/shots/*.json",
              ".automovie/design/*/shots/*.json",
            ],
            requires: ["screenplay-index"],
          },
        ],
      },
    ],
    "automovie/template-sentinel": "error",
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
