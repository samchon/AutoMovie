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
 * Read each entry as one sentence. Files under `files` must each cite a unit
 * under `reference`, and a citation toward one reference never counts toward
 * another.
 *
 * The design records under `.automovie/design` are absent on purpose. Evidence
 * graphs Markdown, Prisma, TypeScript, and Swagger; JSON cannot host a
 * citation. That is why the typed sources under `src` own the subjects and `npm
 * run design` emits the records from them.
 *
 * `src/examples` is absent on purpose too, and the reason is mechanical rather
 * than stylistic. An example teaches one authoring technique against
 * placeholder geometry, and the shipped `AGENTS.md` tells the reader to copy
 * the technique out and delete the file. Admitting it to the implementation
 * claim would make it owe a `docs/objects` or `docs/world` specification, that
 * specification would owe a scene, and the scene would owe a beat: a file whose
 * whole purpose is to be deleted would drag a chain of invented story documents
 * into every generated project, and deleting it would then leave those
 * documents uncited and break the build of a project that did exactly what the
 * instructions said. `src/film.ts` and `src/production.ts` are outside for a
 * different reason: they declare the compile itself rather than a subject, so
 * the document they would answer for does not exist at any rung of the ladder.
 *
 * What this graph does not do is force the first citation. `evidence/graph`
 * runs its obligation from the reference toward the claim, so a document nobody
 * implements is an error while a source file nobody's document describes is
 * silent. Measured on this configuration: adding `src/world/xxx.ts` with an
 * exported class, field, and method and no `@evidence` at all compiles clean,
 * while adding `docs/world/yyy.md` that nothing implements fails with one
 * `evidence/graph` error. So the populations under `src` are the set whose
 * citations are checked, not the set that is made to cite, and an author who
 * models a room before writing down what the room is is not caught here.
 *
 * `singleEvidencePerSymbol` on a reference does close that gap, and it is
 * unpaid rather than unavailable. Setting it on the specification-library
 * reference turned the same uncited `src/world/xxx.ts` into three errors, one
 * per selected host. Adopting it means every exported class, field, and method
 * under `src/units`, `src/objects`, `src/world`, and `src/formations` must cite
 * exactly one specification, which the shipped production does not yet do.
 * `evidence/documented`, which every package in the automovie workspace enables
 * and this one does not, is unpaid in the same way and is measured: enabling it
 * here reports 63 exported declarations with no JSDoc block at all, 46 of them
 * in `src/examples` and 17 inside the graphed populations. A declaration with no
 * block can never cite anything, so those 17 are real debt rather than a
 * decided boundary; the rule is left off because turning it on without paying
 * them would hand every generated project a red build it did not author.
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
