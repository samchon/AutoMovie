/// <reference types="node" />
import {
  type ITtscEvidenceGraphConfig,
  type ITtscEvidenceGraphReference,
  evidence,
} from "@ttsc/evidence";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * The production's obligation graph, expressed as its folder layout.
 *
 * `EVIDENCE_GRAPH` teaches the ladder and `.agents/skills/scaffold/SKILL.md`
 * teaches editing it; this comment carries only what is true of *this* file and
 * would otherwise be re-derived by whoever changes it.
 *
 * Read each entry as one sentence: files under `files` must each cite a unit
 * under `reference`, and a citation toward one reference never counts toward
 * another.
 *
 * ```
 * settings → storylines → scenarios → script → src/shots
 *    ↑___________|____________|__________|
 * settings ← src/units, src/objects, src/world, src/formations
 * ```
 *
 * `docs/research` sits beside both diagrams and answers principles alone.
 *
 * ## The principles are a tree
 *
 * `docs/principles` is organised by who answers each rule, and two families
 * carry an exception a reader has to know.
 *
 * - `common.md` binds every authored document.
 * - `authoring/` binds one prose rung each.
 * - `source/` binds `subjects` and `shots`.
 * - `craft/` binds the modelled work: `form`, `scale`, `light`, `motion`.
 * - `craft/space.md` is a **domain** family, wired through `domainPrinciples`
 *   so one population-wide `@evidenceExclude` can state that this production
 *   has no built environment. Every other principle refuses exclusion, because
 *   a rule binds wherever its condition applies; a domain rule's condition may
 *   honestly not be met.
 * - `review/observation.md` binds what a shot declares will be looked at.
 * - `review/judgment.md` is referenced by nothing, deliberately. Its rules
 *   govern how a verdict is reached, and no source file could cite them
 *   truthfully — the citation would assert something about a module that the
 *   rule does not say. An unreferenced principles document is inert, which is
 *   the correct state for this one and a hazard for any other.
 *
 * ## Activation decides the two kinds of production
 *
 * A claim whose host population selects no file is dropped before its
 * references are read. A live claim whose reference population matches no file
 * is a hard refusal. So a film fills the ladder, a subject library leaves the
 * three story folders empty and their claims fall silent together, and neither
 * needs a switch — provided **no claim's host population spans both kinds**,
 * which is why every story obligation is hosted on a story folder and never on
 * canon.
 *
 * Measured on `internals/scaffold-evidence-gate.mjs`:
 *
 * - Delete `docs/storylines`, `docs/scenarios`, `docs/script` and `src/shots`
 *   together: 0 errors. That is a subject library.
 * - Delete `docs/scenarios` alone: `Claim 4 reference 3 (markdown, symbols:
 *   file) matched no markdown files for ['scenarios/*.md'] under root 'docs'`,
 *   plus one error per script scene still citing a scenario. A rung can be
 *   not-yet-reached, never skipped.
 *
 * ## Three options carry the weight
 *
 * - `singleEvidencePerSymbol` on parents and on the class claim: exactly one,
 *   counted over the whole host population, so citing none fails as citing two
 *   does.
 * - `noEvidenceExclude` on principles and parents: a rule binds wherever it
 *   applies, and a refinement with no parent is not one.
 * - `requireReview` on parents and on script → shots: the citation must carry
 *   `@evidenceReview <target> #<digest> <what you checked>`, and it expires
 *   when that content moves.
 *
 * Expiry is the point of the third. Measured: editing
 * `docs/scenarios/001-cue.md`
 * gives `Stale @evidenceReview ... the review names '#a43f23e' and that scope
 * now digests to '#9315ff8'`, so the scene that reviewed it is re-opened. It
 * proves a current statement exists, not that anyone looked.
 *
 * The obligation toward principles is coverage of the items, not an answer from
 * every host to every item; item-by-item needs a `checklist` reference, which
 * this pinned `@ttsc/evidence` 0.26.1 rejects outright as an unknown property.
 *
 * ## Deliberately outside
 *
 * `.automovie/design/**` (JSON cannot host a citation, which is why `src` owns
 * the subjects and `npm run design` emits the records), `src/examples` (an
 * example exists to be copied out and deleted, so admitting it would make a
 * deleted file's documents uncited), `src/film.ts` and `src/production.ts`
 * (they declare the compile, not a subject), and `scripts`, `test`,
 * `viewer/src`
 * and the root configs (how the production is built and looked at, not what it
 * depicts).
 *
 * A module under any other path leaves the graph rather than failing it, and
 * nothing reports the omission.
 *
 * ## Why the class claim is written twice, and stops there
 *
 * `evidence/graph` runs reference → claim, so on its own a document nobody
 * implements is an error while a class nobody's document describes is silent.
 * The second copy fixes that with `singleEvidencePerSymbol`: an uncited class
 * fails with `cites 0 distinct selected evidence unit(s);
 * singleEvidencePerSymbol
 * requires exactly 1`.
 *
 * It stops at `type` on purpose. Widening to `property` and `function` reports
 * 54 further hosts citing nothing — 44 fields and 10 methods — and that list
 * has
 * two halves the option cannot separate. `Soloist.prototype.height` implements
 * a
 * stated figure; `Soloist.prototype.id` and `WorldPiece.prototype.render`
 * implement nothing a settings document should contain. Exactly-one is true of
 * a
 * class and false of a field, so setting it would buy 44 true citations at the
 * price of untrue tags for the rest. Coverage is what those hosts owe, and the
 * first claim asks for it. This is a boundary, not a debt.
 *
 * ## Why `evidence/documented` is off
 *
 * Enabling it reports 237 undocumented exports — 164 under `scripts`, 63 under
 * `src`, 10 under `viewer/src` — of which 17 are inside the graphed populations
 * and 46 are in `src/examples`. It cannot be aimed at the 17: its options carry
 * no `files` selector, a per-entry selector would take project-scoped
 * `evidence/graph` with it, an array of config entries is rejected with `config
 * file must export an ITtscLintConfig object`, and a top-level `ignores` would
 * strip every correctness rule from `src/examples`. Inside the graphed
 * populations it is subsumed anyway: a declaration with no block cites nothing,
 * and citing nothing is already refused.
 */
/** Canon. Both kinds of production have it; nothing above it is required. */
const SETTINGS = ["settings/*.md"];

/** Beside the ladder: what the world outside this production contains. */
const RESEARCH = ["research/*.md"];

/** The three narrative layers, which only a film has. */
const STORYLINES = ["storylines/*.md"];
const SCENARIOS = ["scenarios/*.md"];
const SCRIPT = ["script/*.md"];

/**
 * One principle file, as a reference every selected host population must cover.
 *
 * `symbol: "h2"` makes each rule its own citable unit, so a rule nothing in the
 * production acknowledges is one error naming that rule rather than a whole
 * document discharged by a single citation.
 *
 * `noEvidenceExclude` because a principle binds wherever its condition applies.
 * A document that cannot honestly satisfy one is defective rather than
 * excusable, and an exclusion here would read green forever.
 */
const principles = (file: string): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: "docs",
  files: [`principles/${file}`],
  symbol: "h2",
  noEvidenceExclude: true,
});

/**
 * A principle whose condition a production may honestly not meet.
 *
 * `principles` refuses `@evidenceExclude` because a rule binds wherever it
 * applies. Some rules apply only where the production has the element they
 * govern — a built environment, a water feature, a crowd — and for those "this
 * production owes this nothing" is a true sentence rather than an excuse. Those
 * live here, where one population-wide exclusion states the boundary.
 */
const domainPrinciples = (file: string): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: "docs",
  files: [`principles/${file}`],
  symbol: "h2",
});

/**
 * A cross-layer parent: exactly one, and no exclusions.
 *
 * Refinement is a bijection between layers. A scenario refines one storyline
 * unit and a script scene realizes one scenario unit, so a host citing two has
 * hidden which of them the film actually made, and a host citing none has
 * refined nothing. `singleEvidencePerSymbol` says both at once, because it
 * counts from the claim's whole selected host population.
 */
const parent = (files: string[]): ITtscEvidenceGraphReference => ({
  type: "markdown",
  root: "docs",
  files,
  symbol: "file",
  noEvidenceExclude: true,
  singleEvidencePerSymbol: true,
  requireReview: true,
});

/** The settings catalog, as a reference a narrative layer accounts for. */
const settingsUsed: ITtscEvidenceGraphReference = {
  type: "markdown",
  root: "docs",
  files: SETTINGS,
  symbol: "file",
};

const graph: ITtscEvidenceGraphConfig = {
  claims: [
    // Canon answers the rules that govern canon. Hosted on the settings
    // library, so a subject library still owes these when it owes no story.
    {
      type: "markdown",
      root: "docs",
      files: SETTINGS,
      // One host per document. Every citation a layer makes lives in the single
      // HTML comment before its H1, so the document answers as a whole and a
      // heading inside it is never asked to carry a parent of its own.
      symbol: "file",
      reference: [principles("common.md"), principles("authoring/settings.md")],
    },
    // A storyline accounts for the settings it uses, which is what decides
    // which facts the work is made of: a setting no storyline uses is a fact
    // the film does not need.
    {
      type: "markdown",
      root: "docs",
      files: STORYLINES,
      // One host per document. Every citation a layer makes lives in the single
      // HTML comment before its H1, so the document answers as a whole and a
      // heading inside it is never asked to carry a parent of its own.
      symbol: "file",
      reference: [
        principles("common.md"),
        principles("authoring/storylines.md"),
        settingsUsed,
      ],
    },
    // A scenario refines exactly one storyline and rechecks canon directly,
    // which stops a storyline's misreading of it reaching the staging.
    {
      type: "markdown",
      root: "docs",
      files: SCENARIOS,
      // One host per document. Every citation a layer makes lives in the single
      // HTML comment before its H1, so the document answers as a whole and a
      // heading inside it is never asked to carry a parent of its own.
      symbol: "file",
      reference: [
        principles("common.md"),
        principles("authoring/scenarios.md"),
        parent(STORYLINES),
        settingsUsed,
      ],
    },
    // The script realizes exactly one scenario and cites the storyline above it
    // as well. Two parents at two depths is the triangulation: refinements can
    // be wrong, and the second citation catches a miswired one.
    {
      type: "markdown",
      root: "docs",
      files: SCRIPT,
      // One host per document. Every citation a layer makes lives in the single
      // HTML comment before its H1, so the document answers as a whole and a
      // heading inside it is never asked to carry a parent of its own.
      symbol: "file",
      reference: [
        principles("common.md"),
        principles("authoring/script.md"),
        parent(SCENARIOS),
        {
          type: "markdown",
          root: "docs",
          files: STORYLINES,
          symbol: "file",
        },
        settingsUsed,
      ],
    },
    // A ledger answers the rules a ledger is written to, and nothing else.
    // Hosting the obligation here rather than referencing `research/*.md` from
    // canon is what keeps it honest: a reference would make every settings
    // document owe a source, which is false of a chosen figure, and would
    // refuse outright while the folder is empty. Silent in the shipped
    // production; it activates on the first ledger.
    {
      type: "markdown",
      root: "docs",
      files: RESEARCH,
      // One host per document, as everywhere else on this graph.
      symbol: "file",
      reference: [principles("common.md"), principles("authoring/research.md")],
    },
    // Implementation answers for canon and for the subject principles. A unit,
    // prop, place, or formation with no settings document is a decision nobody
    // wrote down.
    //
    // Formations share this claim rather than getting their own, because a
    // reference is a whole population: `src/formations/*.ts` against the
    // settings library would require every document to be formed up by
    // something, including a figure the story never puts in ranks.
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
      reference: [
        principles("source/subjects.md"),
        principles("craft/form.md"),
        principles("craft/scale.md"),
        domainPrinciples("craft/space.md"),
        {
          type: "markdown",
          root: "docs",
          files: SETTINGS,
          symbol: "file",
        },
      ],
    },
    // The same population, narrowed to the class, with the obligation running
    // the other way: a class carrying no `@evidence` fails as one citing two
    // does, so a subject modelled before anything specified it is refused at
    // the moment it is written. Narrowed to `type` on purpose — the file JSDoc
    // above says why it stops there.
    {
      type: "typescript",
      files: [
        "src/units/*.ts",
        "src/objects/*.ts",
        "src/world/*.ts",
        "src/formations/*.ts",
      ],
      symbol: ["type"],
      reference: {
        type: "markdown",
        root: "docs",
        files: SETTINGS,
        symbol: "file",
        singleEvidencePerSymbol: true,
      },
    },
    // There is no population for actions: an action is a method on the subject
    // that performs it, and a choreography belonging to none of them is a shot.
    //
    // A shot realizes a script scene: the join that stops a film accumulating
    // footage nothing asked for, and the last rung of the ladder.
    //
    // No `singleEvidencePerSymbol`, and that is the one place this graph stops
    // being a bijection: one scene is legitimately many shots, so the
    // obligation is coverage of the scenes.
    //
    // `symbol` names both kinds because a shot is written
    // `export const opening = defineShot("opening", { ... })`, and a `const`
    // initialized with a call is a `property` here, never a `function`. Alone,
    // `symbol: "function"` selected no host, the claim was dropped before its
    // references were read, and this rung enforced nothing from the day it was
    // written: with every `@evidence script/...` deleted from
    // `src/shots/opening.ts` the gate reported PASS. Widened, the same state
    // names both scenes `in Claim 8 reference 2` — a positional index, so
    // re-measure that quote rather than counting it: it read `Claim 7` before
    // the research rung was inserted above, and `reference 1` before the shot
    // principles were added beside the script.
    //
    // `requireReview` on the script reference: a scene's prose moving re-opens
    // every shot that claimed to realize it.
    {
      type: "typescript",
      files: ["src/shots/*.ts"],
      symbol: ["function", "property"],
      reference: [
        principles("source/shots.md"),
        principles("craft/motion.md"),
        principles("craft/light.md"),
        principles("review/observation.md"),
        {
          type: "markdown",
          root: "docs",
          files: SCRIPT,
          symbol: "file",
          requireReview: true,
        },
      ],
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
