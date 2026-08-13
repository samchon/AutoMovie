---
name: scaffold
description: Defines how an automovie production is authored inside the scaffold, including the docs ladder from logline to scene, the spec library, subjects as classes under src, why an example teaches a technique instead of shipping content, and the production-specific evidence graph that makes each stage answer for the one above it. Use before authoring or reviewing production content, whether in packages/cli/scaffold itself or in a project generated from it.
---

# Authoring a production

`packages/cli/scaffold/` is both the template `@automovie/cli` stamps out and a working production in its own right. A change to it lands in every project generated afterwards, so edit it with the care of a public API rather than an example.

Read the generated project's own `AGENTS.md` first. It is shipped inside the scaffold and is the contract an authoring agent works under. This skill covers what that file assumes rather than states: why the folders are shaped the way they are, and what the production evidence graph permits.

Read the [evidence graph skill](../evidence-graph/SKILL.md) for `@ttsc/evidence` citation integrity, exclusions, lint inspection, and validation. The scaffold graph is an independent film-authoring topology, not the repository's requirement-specification-source triangle. This skill alone owns which production stage answers for which other stage.

## The ladder

A film converges when each stage of definition answers for the one above it, and `lint.config.ts` makes that mechanical rather than cultural. Every claim population owes a citation to its reference population, each pair is its own 100% obligation, and an unpaid one is a compile error.

| Stage | Lives in | Answers for |
| --- | --- | --- |
| Logline | `docs/<film>/01-logline.md` | nothing; it is the root |
| Treatment | `docs/<film>/02-treatment/*.md` | the logline |
| Beats | `docs/<film>/03-beats/*.md` | a treatment file |
| Scenes | `docs/<film>/04-scenes/*.md` | a beat |
| Spec library | `docs/characters/*.md`, `docs/objects/*.md`, `docs/world/*.md` | a scene |
| Implementation | `src/units/*.ts`, `src/objects/*.ts`, `src/world/*.ts`, `src/formations/*.ts` | a spec |
| Shots | `src/shots/*.ts` | a scene |

Keep one file per unit at every prose stage. A sequence, a beat, and a scene are each a citable member, not a heading inside a document that holds the whole film.

Two consequences follow. A subject exists because a scene calls for it, so a character nobody stages is a character the film does not need. A shot cites a scene, which is the join that stops a production from accumulating footage nothing asked for.

There is no population for actions. An action belongs to the subject that performs it, as a method on the class its specification describes. A choreography that spans subjects and belongs to none of them is a shot and cites its scene.

## Subjects are classes

`packages/engine/src/subject.ts` carries the layer: a subject contributes an `IAutoMovieSubjectContribution`, and `mergeAutoMovieSubjectContributions` folds a group's leaves into one contribution. The scaffold follows that structure. `Soloist`, `ChorusMember`, and `ChorusTier` extend `AutoMovieSubject`; `Chorus` and `Plaza` extend `AutoMovieSubjectGroup`; `WorldPiece` is the abstract world leaf that `PlazaGround`, `PlazaCenterMark`, and `PlazaHaze` specialize.

The evidence graph selects `["type", "property", "function"]` over those files, which is one obligation per grain: the class answers for the subject, a field for the measured value, and a method for the behavior. A measurement its specification does not state is refused at authorship by the class, naming the document it contradicts, rather than discovered in a frame nobody looks at.

Nest the same way for scale. A regiment of squadrons of men, or a village of buildings, is a group of groups. Each class owns its constraints, motion, utilities, and render rather than leaving them scattered across whichever shot happens to stage it.

## Write code, not records

The generated `AGENTS.md` puts it plainly: write the work in `docs`, `src`, `test`, and declared assets, and do not translate normal code into giant MCP JSON calls. Scale is where that earns its keep. Two thousand men are a count and a layout, not two thousand records; a line advancing in echelon is a loop over a rank index, not a hand-typed cue per unit; a fog thinning across a beat is one envelope, not a value per frame.

The design records under `.automovie/design` are deliberately outside the production evidence graph. `@ttsc/evidence` graphs Markdown, Prisma, TypeScript, and Swagger, while JSON cannot host a citation. Typed sources under `src` therefore own the subjects and `npm run design` emits records from them. Hand-editing a design record writes something no document answers for.

## What the scaffold does not yet give you

State these limits to whoever is authoring rather than letting them discover them.

- **`docs/objects/` and `src/objects/` ship one inhabitant, and only one.** `gate.md` and `gate.ts` are the rung's worked example: a specification the answering scene calls for, a class that forges as an `IAutoMoviePropSpec`, one hinge under a declared travel the engine clamps against, and a placement read from staged ground rather than authored beside it. Two boxes deliberately stand in for the geometry. A production that wants artillery, colours, or a drum copies the shape and not the gate.

  **No shipped shot stages it, and that is a coupling rather than an oversight.** `test_mcp_production_compiler` builds its architecture fixture by rewriting `src/shots/opening.ts` at string anchors, and one anchor inserts a `set:` key into the staged object. A `set:` the scaffold already carries becomes a duplicate key, and whichever literal writes last silently removes the other. Staging the gate therefore requires the fixture to merge with the shot's own set instead of adding a second key.

- **`src/examples/` is outside the ladder and outside the production, by decision.** Nothing imports it and no claim cites it, so an example owes no specification and cannot be caught drifting from one. That exclusion is mechanical rather than stylistic: an example exists to be copied out and deleted, and a file inside the implementation claim would owe a specification that owes a scene that owes a beat, so deleting it as instructed would leave those documents uncited and break the build of a project that followed the instructions. `lint.config.ts` states this beside the `.automovie/design` exclusion. Each file teaches one authoring technique against placeholder geometry, and the shipped `AGENTS.md` tells the reader to copy the technique out and delete the rest. A finished part added here is a content library shipped to every generated project, so add the technique and never the part. `slopedFacadeWindows` is the standard: its JSDoc says why a raked facade needs a full three-dimensional placement rather than a ground grid with a shared heading. Its spacings, anchors, palettes, and seeds are sample values the author edits, and nothing may depend on them.

- **`docs/research/` is outside the ladder**, as is `docs/art-direction.md`. They cite nothing and nothing cites them, so sourced research is currently unowned by the production obligation graph. A production whose value rests on sources must keep that ledger explicitly and must not assume the compiler is watching it.

- **`evidence/todo` is an error.** A `@todo` left in place fails the build with its own text. That is deliberate for a shipped production and hostile to a half-finished one, so a work-in-progress branch either pays its markers or does not compile.

## Editing the scaffold itself

Treat the scaffold as a public surface.

- **A new `docs` file owes its citation on arrival; a new `src` file does not.** `evidence/graph` runs its obligation from the reference toward the claim, so what fails is a reference unit nobody acknowledges, never a claim host that cites nothing. Measured against the shipped `lint.config.ts`: an `src/world/xxx.ts` exporting an uncited class, field, and method compiles clean, while a `docs/world/yyy.md` nothing implements fails with one `evidence/graph` error. Read the `src` populations as the set whose citations are checked rather than the set that is made to cite, and do not tell an author the compiler will stop them from modelling something no document describes.
- **The claim-side bound is unpaid, not unavailable.** `singleEvidencePerSymbol` on a reference turns the same uncited `src/world/xxx.ts` into three errors, one per selected host, so the enforcement exists and the shipped production has not earned it: adopting it requires every exported class, field, and method under `src/units`, `src/objects`, `src/world`, and `src/formations` to cite exactly one specification. `evidence/documented`, which all eleven library packages under `packages/` enable and this one does not, reports 63 undocumented exported declarations here, 46 in `src/examples` and 17 inside the graphed populations. The `lint.config.ts` JSDoc carries both numbers; keep them current when you pay either down.
- `automovie.config.ts`, `lint.config.ts`, and `package.json` are inherited verbatim by every generated project. A version pinned there must match the workspace catalog, and the suite refuses drift.
- `generated/`, `renders/`, and `.automovie/` are compiler-owned. Correct the source or design and compile; never edit the output.
