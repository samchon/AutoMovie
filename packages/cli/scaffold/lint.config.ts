/// <reference types="node" />
import { type ITtscEvidenceGraphConfig, evidence } from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

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
 * Read each entry as one sentence. Every unit under `reference` must be cited
 * by a file under `files`, and a citation toward one reference never counts
 * toward another. The obligation runs that way round on purpose: it is the
 * evidence that has to be answered for, so a claim file with nothing to say
 * stays silent while a piece of evidence nobody answers for fails the build.
 * A population that matches no file at all is a configuration error rather
 * than a free pass, which is why every reference here keeps a member that is
 * always present.
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
    // A specification that states a measured fact answers for whatever fixed
    // it, and a fact the production did not decide for itself was fixed
    // somewhere outside it: a published standard, a recorded observation, an
    // attested account, a maker's figure. Each of those is one document in the
    // ledger, one source per file for the same reason a scene is one file, so
    // a specification names a source rather than a paragraph inside a document
    // holding every source. The obligation runs from the ledger outward, so a
    // source no specification uses is one the film is not really leaning on,
    // while a subject the story invents outright cites nothing and owes
    // nothing here. Filing a source is what opts a production into this, which
    // is why a spec library resting on no outside source is untouched by it.
    {
      type: "markdown",
      files: [
        "docs/characters/*.md",
        "docs/objects/*.md",
        "docs/world/*.md",
        // Art direction states measured facts too, and it is the document that
        // decides how far the look departs from what a source attests.
        "docs/art-direction.md",
      ],
      reference: {
        type: "markdown",
        // The notes document is the ledger's standing entry, present before a
        // production has filed its first separate source, which is what keeps
        // this population from matching nothing on a project that has not
        // needed one yet.
        files: ["docs/historical-notes.md", "docs/research/*.md"],
        symbol: "file",
      },
    },
    // Implementation answers for its specification. A unit, prop, place, or
    // formation in source with no spec is a decision nobody wrote down.
    //
    // Formations belong here rather than in a population of their own. A
    // claim's reference is a whole population, so `src/formations/*.ts`
    // referencing `docs/characters/*.md` would require every character to be
    // formed up by something, including a lone figure the story never puts in
    // ranks. Grouped into this claim, a formation cites the character it
    // groups and nothing is owed that the story does not ask for.
    {
      type: "typescript",
      files: [
        "src/units/*.ts",
        "src/objects/*.ts",
        "src/world/*.ts",
        "src/formations/*.ts",
      ],
      // A subject is a class, its measured facts are fields, and its
      // behaviors are methods. All three answer for the document that
      // specifies them: the class for the subject, a field for the value
      // measuring it, a method for the behavior it performs.
      symbol: ["type", "property", "function"],
      reference: {
        type: "markdown",
        files: ["docs/characters/*.md", "docs/objects/*.md", "docs/world/*.md"],
        symbol: "file",
      },
    },
    // There is no population for actions. An action belongs to the
    // subject that performs it: `Army.advance` is a method on the class the
    // specification describes. A choreography spanning subjects that
    // belongs to none of them is a shot, which cites its scene instead.
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
    evidence,
  },
  rules: {
    // The obligation graph above. Project-scoped, so this entry declares no
    // `files` of its own.
    "evidence/graph": ["error", graph],
    // A remaining `@todo` is an obligation the author wrote down and did not
    // pay. It fails with its own text rather than being counted as done.
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
