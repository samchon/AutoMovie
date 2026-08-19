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
 * A production converges when each stage of definition answers for the one
 * above it. Here that ladder is mechanical: every claim population owes a
 * citation to its reference population, every pair is its own 100% obligation,
 * and an unpaid one is a compile error rather than something a reader has to
 * notice.
 *
 * Read each entry as one sentence. Files under `files` must each cite a unit
 * under `reference`, and a citation toward one reference never counts toward
 * another.
 *
 * ## The ladder
 *
 * ```
 * principles  →  settings  →  storylines  →  scenarios  →  script  →  shots
 *                    ↑____________|____________|____________|
 *                    every narrative layer accounts for the canon it uses
 * ```
 *
 * `settings` is canon: the facts, figures, places and constraints everything is
 * held to. `storylines` is the treatment — what happens and why. `scenarios`
 * refine one storyline unit each into something that can be staged. `script` is
 * the film as it will be shot. `src/shots` realizes it.
 *
 * The governing aim lives in the first settings file rather than in a layer of
 * its own, because it is a fact about the work rather than a stage of it, and
 * every layer is sized against it.
 *
 * ## Two kinds of production, one configuration
 *
 * A production may be a **film**, or a **subject library**: a building, a
 * vehicle, a set of props, authored on its own with no narrative above it. Both
 * are first class here and neither needs a switch, because the plugin decides
 * activation from the claim side.
 *
 * A claim whose own `files` population selects no unit is dropped before its
 * references are materialized at all, so it costs nothing and says nothing. A
 * claim that is live and whose reference population matches no files is a hard
 * refusal rather than silence. Both halves are measured at `@ttsc/evidence`
 * 0.26.1 on `internals/scaffold-evidence-gate.mjs`:
 *
 * - Delete `docs/storylines`, `docs/scenarios`, `docs/script` and `src/shots`
 *   together and the graph is clean. Every story claim loses its own hosts at
 *   once and goes quiet; `docs/settings` and the `src` subject populations stay
 *   bound exactly as they were. That is a subject library, and it needed no
 *   switch to become one.
 * - Delete only `docs/scenarios` and the graph refuses: `Claim 4 reference 3
 *   (markdown, symbols: file) matched no markdown files for ['scenarios/*.md']
 *   under root 'docs'`, followed by one error for each script scene still
 *   citing a scenario nothing materializes. A rung cannot be skipped; it can
 *   only be not-yet-reached, with everything below it absent too.
 *
 * So the rule this file is written around is: **no claim's host population may
 * span both kinds.** Every story obligation is hosted under `docs/storylines`,
 * `docs/scenarios` or `docs/script`, none of which a subject library has, so
 * they fall silent together. Everything a subject library owes is hosted on
 * `docs/settings` and on `src`, which both kinds always have.
 *
 * That is also why a narrative layer cites the settings it uses rather than the
 * settings citing the scenes that need them. Hosting that obligation on the
 * settings library would make it live in a subject library too, and refuse a
 * production for lacking scenes it was never going to have.
 *
 * ## Principles
 *
 * `docs/principles` holds the rules the production is written against, one
 * anchored H2 per rule, answered by the layer it governs. `common.md` binds
 * every authored document; `settings.md` binds canon under both kinds; the
 * other three bind one narrative layer each and vanish with it.
 *
 * The obligation is **coverage of the items**, not an answer from every host to
 * every item. Answering item by item on every file needs a `checklist`
 * reference, which `@ttsc/evidence` gained after the version this scaffold
 * pins; when that version is the pinned one, tightening this is a flag rather
 * than a rewrite.
 *
 * ## Where the bijection stops
 *
 * Refinement between narrative layers is one-to-one, so a scenario cites
 * exactly one storyline unit and a script scene exactly one scenario unit, and
 * `singleEvidencePerSymbol` says so. The script-to-shot boundary is the one
 * place that stops being true: a scene is legitimately many shots. There the
 * obligation is coverage of the scenes instead, and no one-parent rule is
 * imposed on a shot.
 *
 * ## What is deliberately outside
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
 * claim would make it owe a settings document, and a file whose whole purpose
 * is to be deleted would drag invented documents into every generated
 * project. `src/film.ts` and `src/production.ts` are outside for a different
 * reason: they declare the compile itself rather than a subject, so the
 * document they would answer for does not exist at any rung of the ladder.
 *
 * `scripts`, `test`, `viewer/src` and the root config files are compiled and
 * linted by `npm run lint:source` and are outside the graph as well, and that
 * is the same reason once more. They are how the production is built, measured
 * and looked at, not what it depicts, so no rung holds a document they could
 * answer for. The rule for a module under any other path is worth stating
 * plainly, because its failure mode is silence: a subject written outside the
 * five selected source folders does not fail the graph, it leaves it, and
 * nothing reports the omission.
 *
 * ## Why the implementation claim is written twice
 *
 * `evidence/graph` runs its obligation from the reference toward the claim, so
 * on its own it makes a document nobody implements an error while leaving a
 * source file nobody's document describes silent. That is why the claim below
 * is written twice over the same files. The second copy sets
 * `singleEvidencePerSymbol` on its reference, which counts from the claim's
 * complete selected host population and therefore fails a host citing nothing
 * exactly as it fails a host citing two. Measured on this configuration: adding
 * `src/world/zzz.ts` with an exported, uncited class now fails with
 * `cites 0 distinct selected evidence unit(s); singleEvidencePerSymbol requires
 * exactly 1`, and the same file compiles clean once the class cites one
 * settings document. So a wall modelled before anything specifies the wall is
 * refused at the moment it is written.
 *
 * Writing the claim twice is also why a settings document nothing implements
 * reports the same missing acknowledgement once per claim rather than once. Two
 * claims select that document, so two obligations go unpaid; both are
 * discharged by the same citation.
 *
 * ## Why the bound stops at the class
 *
 * The exactly-one bound is set for `type` and for nothing below it, and that is
 * a decided boundary rather than debt. Turning `singleEvidencePerSymbol` on for
 * `property` and `function` as well reports 54 further hosts in the shipped
 * production citing nothing, 44 fields and 10 methods, and reading that list is
 * what settles the question, because it has two halves that the option cannot
 * tell apart.
 *
 * One half is measured values a document really does own:
 * `Soloist.prototype.height`, `Soloist.prototype.cueAbduction`,
 * `Chorus.prototype.ranks`, `Chorus.prototype.spacing`,
 * `ChorusMember.SPECIFIED_HEIGHT`, `PlazaGate.prototype.openDeg`. A citation
 * there is real and worth writing.
 *
 * The other half is structure no document specifies and none should:
 * `Soloist.prototype.id`, `Plaza.prototype.members`,
 * `WorldPiece.prototype.render`, `WorldPiece.prototype.patches`,
 * `WorldPiece.prototype.design`. An identifier is the code's own choice and a
 * render hook is the engine's interface; a settings document that specified
 * either would be specifying the implementation.
 *
 * Exactly-one is true of a class, because a class is a subject and a subject
 * has one specification. It is false of a field, because a field may implement
 * none. Setting it anyway would not collect 54 citations; it would collect the
 * 44 that are true and force untrue tags for the rest, which is the one thing
 * the plugin's own refusal tells a reader never to do. What those hosts owe is
 * coverage, and the first claim above already asks them for it.
 *
 * ## Why `evidence/documented` is off
 *
 * Every library package under `packages/` enables it; this one does not, and
 * the reason is measured rather than assumed. Enabling it here reports 237
 * exported declarations with no JSDoc block at all: 164 under `scripts`, 63
 * under `src`, and 10 under `viewer/src`. Only 17 of those 237 are inside the
 * graphed populations; 46 are in `src/examples` and the remaining 174 are in
 * project plumbing the graph never selects.
 *
 * It cannot be aimed at the 17. Its own options carry no `files` selector; a
 * per-entry `files` selector would take `evidence/graph` with it, and
 * `@ttsc/lint` documents that a project-scoped contributor rule must come from
 * an entry without one; an array of config entries is rejected with the
 * measured message `config file must export an ITtscLintConfig object`; and a
 * top-level `ignores` would strip every correctness rule from `src/examples`
 * rather than just this one. Inside the graphed populations the rule is in any
 * case subsumed: a declaration with no block cites nothing, and citing nothing
 * is what the claim below already refuses.
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
    // library, which both kinds of production have, so these are the rules a
    // subject library still owes when it owes no story at all.
    {
      type: "markdown",
      root: "docs",
      files: SETTINGS,
      // One host per document. Every citation a layer makes lives in the single
      // HTML comment before its H1, so the document answers as a whole and a
      // heading inside it is never asked to carry a parent of its own.
      symbol: "file",
      reference: [principles("common.md"), principles("settings.md")],
    },
    // A storyline answers the common and storyline principles, and accounts for
    // the settings it uses. This is the layer that decides which facts the work
    // is made of: the catalog does not prove itself, and a setting no storyline
    // uses is a fact the film does not need.
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
        principles("storylines.md"),
        settingsUsed,
      ],
    },
    // A scenario refines exactly one storyline unit and rechecks settings
    // directly. The recheck is not redundancy: it is what stops a storyline's
    // misreading of canon from reaching the staging unchallenged.
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
        principles("scenarios.md"),
        parent(STORYLINES),
        settingsUsed,
      ],
    },
    // The script realizes exactly one scenario unit, cites the storyline above
    // it as well, and rechecks settings. Two parents at two depths is the
    // triangulation: a scenario is a refinement, refinements can be wrong, and
    // citing the storyline directly is what catches a miswired scenario instead
    // of inheriting its mistake.
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
        principles("script.md"),
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
    // A research ledger answers the rules a ledger is written to, and nothing
    // else. It sits beside the ladder rather than on it: nothing above it
    // commissions it, because a production may invent every figure it uses and
    // owe the world nothing, and nothing below it is required to use it.
    //
    // Hosting the obligation here rather than referencing `research/*.md` from
    // canon is what keeps that true in both directions. A reference would make
    // every settings document owe a source, which is false of a chosen figure,
    // and would refuse outright in the ordinary case where the folder is empty,
    // because a live claim whose reference population matches no file is a hard
    // error. Hosted this way the rung behaves like the narrative layers: a
    // ledger appears and the rules arrive with it, the folder is empty and the
    // claim is dropped before its references are read.
    //
    // The shipped production sources nothing, so this claim is silent in it. It
    // activates on the first file an author writes into `docs/research`.
    {
      type: "markdown",
      root: "docs",
      files: RESEARCH,
      // One host per document, as everywhere else on this graph.
      symbol: "file",
      reference: [principles("common.md"), principles("research.md")],
    },
    // Implementation answers for canon. A unit, prop, place, or formation in
    // source with no settings document is a decision nobody wrote down.
    //
    // Formations belong here rather than in a population of their own. A
    // claim's reference is a whole population, so `src/formations/*.ts`
    // referencing the settings library alone would require every settings
    // document to be formed up by something, including a lone figure the story
    // never puts in ranks. Grouped into this claim, a formation cites the
    // subject it groups and nothing is owed that the work does not ask for.
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
        root: "docs",
        files: SETTINGS,
        symbol: "file",
      },
    },
    // The same population again, narrowed to the class, and this time the
    // obligation runs the other way. `singleEvidencePerSymbol` counts from the
    // claim's complete selected host population, so a class carrying no
    // `@evidence` fails exactly as a class citing two would: a subject modelled
    // before anything specified it is a compile error at the moment it is
    // written, which is the one thing the reference-side claims above cannot
    // say.
    //
    // Narrowed to `type` on purpose, and the narrowing is a decision rather
    // than an unpaid balance. Exactly-one is right for a class, because a class
    // is a subject and a subject has one specification. It is wrong one grain
    // down: `Soloist.prototype.height` implements a stated figure, and
    // `Soloist.prototype.id` and `WorldPiece.prototype.render` implement
    // nothing a settings document should ever contain. Measured, widening to
    // `property` and `function` reports 54 further hosts citing nothing, and
    // only part of that list could be answered truthfully. The file JSDoc above
    // names both halves; what those hosts owe is coverage, and the claim above
    // already asks them for it.
    //
    // `src/examples` is outside the `files` list for the same reason it is
    // outside the claim above, so this obligation never reaches an example.
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
    // There is no population for actions. An action belongs to the subject that
    // performs it: `Army.advance` is a method on the class its settings
    // document describes. A choreography spanning subjects that belongs to none
    // of them is a shot, which cites its script scene instead.
    //
    // A shot realizes a script scene. This is the join that stops a film from
    // accumulating footage nothing asked for, and it is the last rung: every
    // scene the script writes must be shot by something.
    //
    // No `singleEvidencePerSymbol` here, and that is the one place this graph
    // stops being a bijection. One scene is legitimately many shots, so the
    // obligation is coverage of the scenes rather than one parent per shot.
    //
    // `symbol` names both kinds on purpose, and that is a fix rather than a
    // preference. A shot is written
    // `export const opening = defineShot("opening", { ... })`. A `const`
    // initialized with a call is a `property` to this plugin, never a
    // `function`: that word selects a function declaration or a `const` holding
    // an arrow or function expression. So `symbol: "function"` alone selected
    // no host here at all, and a claim whose host population is empty is
    // dropped before its references are read. The last rung of the ladder was
    // therefore silent for as long as it was written that way.
    //
    // Measured on `internals/scaffold-evidence-gate.mjs`, which is the only
    // instrument that settles this: with every `@evidence script/...` deleted
    // from `src/shots/opening.ts`, the narrow selector reports PASS and the
    // widened one reports `Missing acknowledgement for 'script/001-cue.md' ...
    // in Claim 7`, naming both scenes. With the citations restored and
    // `docs/script` removed, the widened claim refuses twice over: once because
    // the reference `matched no markdown files`, and once per citation left
    // pointing at a scene nothing materializes. That second shape is what stops
    // source from reaching past the script, so it is worth having.
    //
    // Widening costs nothing. Without `singleEvidencePerSymbol` an extra host
    // that cites nothing owes nothing, and the obligation stays coverage of the
    // scenes.
    {
      type: "typescript",
      files: ["src/shots/*.ts"],
      symbol: ["function", "property"],
      reference: {
        type: "markdown",
        root: "docs",
        files: SCRIPT,
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
