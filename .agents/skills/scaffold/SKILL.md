---
name: scaffold
description: Defines how an automovie production is authored inside the scaffold - the docs ladder from logline to scene, the spec library, subjects as classes under src, and the evidence graph in lint.config.ts that makes each stage answer for the one above it. Use before authoring or reviewing production content, whether in packages/cli/scaffold itself or in a project generated from it.
---

# Authoring a production

`packages/cli/scaffold/` is both the template `@automovie/cli` stamps out and a
working production in its own right. A change to it lands in every project
generated afterwards, so it is edited with the care of a public API rather than
of an example.

Read the generated project's own `AGENTS.md` first; it is shipped inside the
scaffold and is the contract an authoring agent works under. This skill covers
what that file assumes rather than states: why the folders are shaped the way
they are, and what the evidence graph will and will not let you get away with.

## The ladder

A film converges when each stage of definition answers for the one above it,
and `lint.config.ts` makes that mechanical rather than cultural. Every claim
population owes a citation to its reference population, each pair is its own
100% obligation, and an unpaid one is a compile error.

| Stage | Lives in | Answers for |
| --- | --- | --- |
| Logline | `docs/<film>/01-logline.md` | nothing; it is the root |
| Treatment | `docs/<film>/02-treatment/*.md` | the logline |
| Beats | `docs/<film>/03-beats/*.md` | a treatment file |
| Scenes | `docs/<film>/04-scenes/*.md` | a beat |
| Spec library | `docs/characters/*.md`, `docs/objects/*.md`, `docs/world/*.md` | a scene |
| Implementation | `src/units/*.ts`, `src/objects/*.ts`, `src/world/*.ts`, `src/formations/*.ts` | a spec |
| Shots | `src/shots/*.ts` | a scene |

One file per unit at every prose stage. A sequence, a beat and a scene are each
a citable member, not a heading inside a document that holds the whole film.

Two consequences worth stating out loud. A subject exists because a scene calls
for it, so a character nobody stages is a character the film does not need.
And a shot cites a scene, which is the join that stops a production from
accumulating footage nothing asked for.

There is no population for actions. An action belongs to the subject that
performs it, as a method on the class its specification describes. A
choreography that spans subjects and belongs to none of them is a shot, and
cites its scene.

## Subjects are classes

`packages/engine/src/subject.ts` carries the layer: a subject contributes an
`IAutoMovieSubjectContribution`, and `mergeAutoMovieSubjectContributions` folds
a group's leaves into one contribution. A single subject extends
`AutoMovieSubject`; a subject that is made of others extends
`AutoMovieSubjectGroup`; a place extends the abstract world leaf.

The evidence graph selects `["type", "property", "function"]` over those files,
which is one obligation per grain: the class answers for the subject, a field
for the measured value, a method for the behavior. A measurement its
specification does not state is refused at authorship, by the class, naming the
document it contradicts -- not discovered in a frame nobody looks at.

Nest the same way for scale. A group whose members are themselves groups is
still one contribution, and each class owns its own constraints,
motion, utilities and render rather than leaving them scattered across whichever
shot happens to stage it.

## Write code, not records

The generated `AGENTS.md` puts it plainly: write the work in `docs`, `src`,
`test` and declared assets, and do not translate normal code into giant MCP JSON
calls. Scale is where that earns its keep. Two thousand men are a count and a
layout, not two thousand records; a line advancing in echelon is a loop over a
rank index, not a hand-typed cue per unit; a fog thinning across a beat is one
envelope, not a value per frame.

The design records under `.automovie/design` are deliberately outside the
evidence graph. Evidence graphs Markdown, Prisma, TypeScript and Swagger; JSON
cannot host a citation. That is why the typed sources under `src` own the
subjects and `npm run design` emits the records from them, and why hand-editing
a design record is a way of writing something no document answers for.

## What the scaffold does not yet give you

State these to whoever is authoring rather than letting them discover it.

- **`docs/objects/` and `src/objects/` ship empty.** The prop slot has never had
  an inhabitant, because the shipped screenplay calls for no prop. The first production
  that needs a prop at all is the one that walks that path first.
- **`docs/research/` is outside the ladder**, as are `docs/art-direction.md` and
  `docs/historical-notes.md`. They cite nothing and nothing cites them, so
  sourced research is currently unowned by the obligation graph. A production
  whose value rests on sources should expect to keep that ledger by hand, and
  should not assume the compiler is watching it.
- **`evidence/todo` is an error.** A `@todo` left in place fails the build with
  its own text. That is deliberate for a shipped production and hostile to a
  half-finished one, so a work-in-progress branch either pays its markers or
  does not compile.

## Editing the scaffold itself

Treat it as a public surface.

- Anything added under `src` or `docs` immediately owes its citation, so a new
  file lands with its specification or it does not land.
- `automovie.config.ts`, `lint.config.ts` and `package.json` are inherited
  verbatim by every generated project; a version pinned there must match the
  workspace catalog, and the suite refuses the drift.
- `generated/`, `renders/` and `.automovie/` are compiler-owned. Correct the
  source or the design and compile; never edit the output.
