---
name: scaffold
description: Defines how an automovie production is authored inside the scaffold, including the prose ladder from principles and settings through storylines and scenarios to the script, subjects as classes under src, the research ledger beside the ladder, why an example teaches a technique instead of shipping content, and the production evidence graph that makes each rung answer for the one above it and stays correct for a production with no film in it at all. Use before authoring or reviewing production content, whether in packages/cli/scaffold itself or in a project generated from it.
---

# Authoring a production

`packages/cli/scaffold/` is both the template `@automovie/cli` stamps out and a working production in its own right. A change to it lands in every project generated afterwards, so edit it with the care of a public API rather than an example.

Read the generated project's own `AGENTS.md` first. It is shipped inside the scaffold and is the contract an authoring agent works under. This skill covers what that file assumes rather than states: why the folders are shaped the way they are, and what the production evidence graph permits.

Read the [evidence graph skill](../evidence-graph/SKILL.md) for `@ttsc/evidence` citation integrity, exclusions, lint inspection, and validation. The scaffold graph is an independent production-authoring topology, not the repository's requirement-specification-source triangle. This skill alone owns which production rung answers for which other rung.

## The ladder

A production converges when each rung of definition answers for the one above it, and `lint.config.ts` makes that mechanical rather than cultural. Every claim population owes a citation to its reference population, each pair is its own 100% obligation, and an unpaid one is a compile error.

| Rung | Lives in | Answers for |
| --- | --- | --- |
| Principles | `docs/principles/*.md`, one anchored `##` per rule | nothing; it is the root |
| Settings | `docs/settings/*.md` | the common and settings principles |
| Storylines | `docs/storylines/*.md` | its principles, and every setting it uses |
| Scenarios | `docs/scenarios/*.md` | its principles, **exactly one** storyline, the settings it rechecks |
| Script | `docs/script/*.md` | its principles, **exactly one** scenario, that scenario's storyline, the settings it rechecks |
| Implementation | `src/units/*.ts`, `src/objects/*.ts`, `src/world/*.ts`, `src/formations/*.ts` | a settings document |
| Shots | `src/shots/*.ts` | the script scenes they realize |

Keep one file per unit at every prose rung, and one host per document: every citation a document makes lives in the single HTML comment before its H1, so the document answers as a whole and a heading inside it is never asked to carry a parent of its own.

Three properties are worth stating outright, because each of them was a decision.

- **Settings is canon, not a stage.** It holds everything that exists and how large it is — a figure's silhouette and scale, a prop's dimensions, a place's extent and named points, the palette and the review distance, and the governing aim the whole work is sized against. It is the one prose rung a production without a film still has.
- **Refinement is a bijection until the last rung.** A scenario stages one storyline and a scene realizes one scenario; `singleEvidencePerSymbol` refuses a host citing two as it refuses a host citing none. The script-to-shot join is where that stops, because one scene is legitimately many shots, so there the obligation is coverage of the scenes.
- **The script cites two parents.** It names its scenario and, separately, that scenario's storyline. A refinement can be wrong, and citing the storyline directly is what catches a miswired scenario instead of inheriting its mistake.

A rung cannot be skipped. Deleting `docs/scenarios` while `docs/script` still holds scenes does not go quiet: the population `matched no markdown files` and every scene still citing a scenario is a second error. It can only be not-yet-reached, with everything below it absent too.

There is no population for actions. An action belongs to the subject that performs it, as a method on the class its settings document describes. A choreography that spans subjects and belongs to none of them is a shot and cites its scene.

## Two kinds of production, one configuration

A production may be a **film**, or a **subject library**: a building, a vehicle, a set of props, authored on its own with no narrative above it. Both are first class, and neither needs a switch or a second config file.

The plugin decides activation from the claim side. A claim whose own host population selects no file is dropped before its references are read; a claim that is live and whose reference population matches no file is a hard refusal. So the configuration is written around one rule: **no claim's host population may span both kinds.** Every story obligation is hosted on `docs/storylines`, `docs/scenarios` or `docs/script`, none of which a subject library has, so they fall silent together. Everything a subject library owes is hosted on `docs/settings` and on `src`.

That is also why a storyline cites the settings it uses rather than a setting citing the scenes that need it. Hosting that obligation on canon would make it live in a subject library too, and refuse a production for lacking scenes it was never going to have.

Measured on `internals/scaffold-evidence-gate.mjs`: delete `docs/storylines`, `docs/scenarios`, `docs/script` and `src/shots` together and the graph is clean, with `docs/settings` and the `src` populations bound exactly as before.

Do not edit the graph configuration to reach either shape. Author the folders the production actually has.

## Research sits beside the ladder

`docs/research/*.md` is a ledger of what the world outside this production contains, and it is bound by `principles/common.md` and `principles/research.md` — source identity, stated confidence, the settings fact each entry grounds, a disagreement recorded rather than silently resolved, and the standing rule that a ledger is never a settings document.

The obligation is hosted on the ledger rather than referenced from canon, and that is what keeps it honest in both directions. A reference would make every settings document owe a source, which is false of a chosen figure, and would refuse outright in the ordinary case where the folder is empty. Hosted this way it behaves like the narrative rungs: the shipped production sources nothing so the claim is silent, and the first file an author writes into `docs/research` brings all ten rules with it at once.

## Subjects are classes

`packages/engine/src/subject.ts` carries the layer: a subject contributes an `IAutoMovieSubjectContribution`, and `mergeAutoMovieSubjectContributions` folds a group's leaves into one contribution. The scaffold follows that structure. `Soloist`, `ChorusMember`, and `ChorusTier` extend `AutoMovieSubject`; `Chorus` and `Plaza` extend `AutoMovieSubjectGroup`; `WorldPiece` is the abstract world leaf that `PlazaGround`, `PlazaCenterMark`, and `PlazaHaze` specialize.

The evidence graph selects `["type", "property", "function"]` over those files toward canon, which is one obligation per grain: the class answers for the subject, a field for the measured value, and a method for the behavior. A measurement its settings document does not state is refused at authorship by the class, naming the document it contradicts, rather than discovered in a frame nobody looks at. At the class grain the obligation runs both ways: a second claim over the same files requires every exported class to cite exactly one settings document, so a subject that exists before its document does not compile.

Nest the same way for scale. A regiment of squadrons of men, or a village of buildings, is a group of groups. Each class owns its constraints, motion, utilities, and render rather than leaving them scattered across whichever shot happens to stage it.

## Write code, not records

The generated `AGENTS.md` puts it plainly: write the work in `docs`, `src`, `test`, and declared assets, and do not translate normal code into giant MCP JSON calls. Scale is where that earns its keep. Two thousand men are a count and a layout, not two thousand records; a line advancing in echelon is a loop over a rank index, not a hand-typed cue per unit; a fog thinning across a beat is one envelope, not a value per frame.

The design records under `.automovie/design` are deliberately outside the production evidence graph. `@ttsc/evidence` graphs Markdown, Prisma, TypeScript, and Swagger, while JSON cannot host a citation. Typed sources under `src` therefore own the subjects and `npm run design` emits records from them. Hand-editing a design record writes something no document answers for.

The screenplay index is the exception that proves the rule. It is hand-authored, it addresses the storyline and script documents by path, and the compiler resolves those paths on disk: each indexed beat must appear verbatim in the storyline it names and each indexed scene must head the script document it names. That is a second joint holding prose and ledger together, and it is not the evidence graph — moving a prose document without moving the index dangles it.

## What the scaffold does not yet give you

State these limits to whoever is authoring rather than letting them discover them.

- **`src/objects/` ships one inhabitant, and only one.** `docs/settings/030-gate.md` and `src/objects/gate.ts` are the rung's worked example: a settings document the answering scenario stages, a class that forges as an `IAutoMoviePropSpec`, one hinge under a declared travel the engine clamps against, and a placement read from staged ground rather than authored beside it. Two boxes deliberately stand in for the geometry. A production that wants artillery, colours, or a drum copies the shape and not the gate.

  **No shipped shot stages it, and that is a coupling rather than an oversight.** `test_mcp_production_compiler` builds its architecture fixture by rewriting `src/shots/opening.ts` at string anchors, and one anchor inserts a `set:` key into the staged object. A `set:` the scaffold already carries becomes a duplicate key, and whichever literal writes last silently removes the other. Staging the gate therefore requires the fixture to merge with the shot's own set instead of adding a second key.

- **`src/examples/` is outside the ladder and outside the production, by decision.** Nothing imports it and no claim cites it, so an example owes no settings document and cannot be caught drifting from one. That exclusion is mechanical rather than stylistic: an example exists to be copied out and deleted, and a file inside the implementation claim would owe a settings document that owes a storyline that owes a scenario, so deleting it as instructed would leave those documents uncited and break the build of a project that followed the instructions. `lint.config.ts` states this beside the `.automovie/design` exclusion. Each file teaches one authoring technique against placeholder geometry, and the shipped `AGENTS.md` tells the reader to copy the technique out and delete the rest. A finished part added here is a content library shipped to every generated project, so add the technique and never the part. `slopedFacadeWindows` is the standard: its JSDoc says why a raked facade needs a full three-dimensional placement rather than a ground grid with a shared heading. Its spacings, anchors, palettes, and seeds are sample values the author edits, and nothing may depend on them.

- **The principles obligation is coverage, not a checklist.** Every rule must be answered by some document in the layer it governs, not by every document in it, so a rung can satisfy the population while one of its files quietly answers nothing. Answering item by item needs a `checklist` reference, which `@ttsc/evidence` gained after the version this scaffold pins; tightening it is a flag rather than a rewrite once that version is the pinned one.

- **`evidence/todo` is an error.** A `@todo` left in place fails the build with its own text. That is deliberate for a shipped production and hostile to a half-finished one, so a work-in-progress branch either pays its markers or does not compile.

## Editing the scaffold itself

Treat the scaffold as a public surface.

- **A new `docs` file and a new subject class both owe their citation on arrival.** `evidence/graph` runs its obligation from the reference toward the claim, so on its own it fails a reference unit nobody acknowledges and never a claim host that cites nothing. The shipped `lint.config.ts` therefore writes the implementation claim twice over the same files, and the second copy narrows `symbol` to `["type"]` and sets `singleEvidencePerSymbol` on its reference. That option counts from the claim's complete selected host population, so a class citing nothing fails exactly as a class citing two would. Measured: an `src/world/zzz.ts` exporting an uncited class fails with `cites 0 distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1`, and goes green when the class cites one settings document. An author who models a wall before writing down what the wall is is stopped at the moment the class is written.

- **The bound stops at the class because exactly-one stops being true below it.** Widening the second claim to `property` and `function` reports 54 further hosts citing nothing — 44 fields and 10 methods, against the 10 classes the current configuration pays. That list has two halves the option cannot separate. `Soloist.prototype.height`, `Chorus.prototype.ranks`, `ChorusMember.SPECIFIED_HEIGHT`, and `PlazaGate.prototype.openDeg` implement stated figures, and a citation on each is real. `Soloist.prototype.id`, `Plaza.prototype.members`, `WorldPiece.prototype.render`, and `WorldPiece.prototype.patches` implement nothing a settings document should ever contain: an identifier is the code's own choice and a render hook is the engine's interface. Setting the option anyway would collect the true citations and force untrue tags for the rest, which is the one thing the plugin's own refusal tells a reader never to do. What those hosts owe is coverage, and the first claim already asks for it. Do not report this as debt.

- **A shot is selected as a `property`, not a `function`.** `export const opening = defineShot("opening", { ... })` is a `const` initialized with a call, and to `@ttsc/evidence` that is a property; `function` selects a function declaration or a `const` holding an arrow or function expression. Narrowed to `symbol: "function"` alone, the shots claim selected no host at all and was silently dropped, so the last rung of the ladder went unenforced from the day it was written until it was measured: with every `@evidence script/...` deleted from `src/shots/opening.ts`, the gate reported PASS. It reads `["function", "property"]` now. Before trusting any claim on this graph, delete the citations it is supposed to require and confirm the gate turns red.

- **Whether an exclusion can be written differs by reference, and the config says which.** A principle and a parent both set `noEvidenceExclude`, so `@evidenceExclude` against either is refused with `noEvidenceExclude requires positive @evidence for this reference` — a rule binds wherever its condition applies, and a refinement with no parent is not a refinement. The other three references allow one, because for each the sentence can be true: a narrative rung may honestly owe nothing to a settings fact only source honours, the script may owe nothing to a storyline whose scene the soft lock preserved as `OMITTED`, and source may owe nothing to a settings document no class can implement — which is why `src/world/plaza.ts` carries the two population-wide exclusions for the governing aim and the art direction.

- **`evidence/documented` is off, and the measurement says why.** All eleven library packages under `packages/` enable it; enabling it here reports 237 exported declarations with no JSDoc block — 164 under `scripts`, 63 under `src`, 10 under `viewer/src` — of which only 17 are inside the graphed populations and 46 are in `src/examples`. It cannot be aimed at the 17: its options carry no `files` selector, a per-entry `files` selector would take project-scoped `evidence/graph` with it, `@ttsc/lint` rejects an array of config entries with `config file must export an ITtscLintConfig object`, and a top-level `ignores` would strip every correctness rule from `src/examples` rather than just this one. Inside the graphed populations it is also subsumed, since a declaration with no JSDoc block cites nothing and citing nothing is already refused. The `lint.config.ts` JSDoc carries every one of these numbers; keep them current when any of it moves.

- `automovie.config.ts`, `lint.config.ts`, and `package.json` are inherited verbatim by every generated project. A version pinned there must match the workspace catalog, and the suite refuses drift.

- `generated/`, `renders/`, and `.automovie/` are compiler-owned. Correct the source or design and compile; never edit the output.
