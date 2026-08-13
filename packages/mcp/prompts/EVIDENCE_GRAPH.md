# Evidence Graph Handbook

A production's folder layout is its obligation graph. Where a file sits declares what it owes and to whom, and an unpaid obligation is a compile error rather than something a reader has to notice.

This is what makes a long production converge. Screenwriting already works by progressive definition, logline to treatment to beat to scene, each stage removing ambiguity the previous one left. Here that ladder is mechanical: each stage cites the stage above it and must be answered for by the stage below it, so no branch reaches a green build while another never leaves the logline.

Read `SOURCE_COMPOSITION` for how source is arranged once shots repeat. This document is about which folder a thing belongs in and what it must cite.

## The two axes

A file's place is decided by two questions, and confusing them is what produces a folder nobody can name.

**What kind of thing is it.** Prose that defines the story, prose that specifies a subject, or source that implements one. These do not mix: a character's dimensions do not belong inside the scene that first needed the character, and a shot module does not belong inside the scene prose it realizes.

**How settled is it.** The story ladder is ordered by definition, not by chronology. A treatment sequence is more settled than the logline and less settled than the beat that breaks it down. A stage never cites downward.

## The ladder

Each stage is one file per unit. That is what makes a folder a population: a sequence, a beat, and a scene are each a citable member, rather than a heading inside one document that holds the whole film.

| Folder | Holds | Cites |
| --- | --- | --- |
| `docs/<production>/01-logline.md` | the one-sentence promise | nothing, it is the root |
| `docs/<production>/02-treatment/` | one file per sequence | the logline |
| `docs/<production>/03-beats/` | one file per beat | its sequence |
| `docs/<production>/04-scenes/` | one file per scene | its beat |

## What the graph refuses

Write the citation upward and read the refusal downward. Each obligation runs from the cited unit toward whatever must answer for it: every unit in a cited population must be acknowledged by some host in the population that cites it, and nothing obliges a host to cite anything. That asymmetry decides what the ladder is good for.

So a file added to a cited stage is an obligation on the stage below it. A logline no sequence breaks down, a sequence no beat breaks down, and a beat no scene dramatizes are each one error naming that exact file. A sequence that cites nothing is silent; a sequence nothing elaborates is not.

The ladder therefore catches abandonment rather than orphanhood, which is the property a long production needs. Write the citation anyway. It is what makes the abandonment report readable, because an error tells you a beat was dropped and only the reason sentence tells you what it was for.

## The spec library

A subject exists because a scene calls for it. Specifications are prose because they are decisions, not data: silhouette, scale, capability, and the reason each was chosen.

| Folder | Holds | Cites |
| --- | --- | --- |
| `docs/characters/` | one file per character | the scenes that need it |
| `docs/objects/` | one file per prop, weapon, vehicle | the scenes that need it |
| `docs/world/` | one file per place | the scenes set there |
| `docs/research/` | source ledgers, with URLs and confidence | nothing; it grounds claims |
| `docs/art-direction.md` | palette, scale grammar, readability | nothing |

Every scene must be answered for by at least one of the first three. A scene that no character, object, or place claims is refused, which is what stops a scene from being staged out of nouns nobody wrote down.

State what the subject is and what it can do, and nothing else. A capability the specification does not state is one the source must not assume.

## Source

Source implements a specification and says which one. The vocabulary layers are `SOURCE_COMPOSITION`'s: members, the groups they form, then the shots that call them.

| Folder | Holds | Cites |
| --- | --- | --- |
| `src/units/` | one member's measured facts | its character or object spec |
| `src/objects/` | one prop's recipe | its object spec |
| `src/world/` | terrain, routes, landmarks, and the built environment | its world spec |
| `src/formations/` | one group of a member | the spec of what it groups |
| `src/shots/` | shot factories and the table | the scenes they realize |

There is no folder for actions. An action belongs to the subject that performs it, so a group's advance is a method on the class its specification describes. A choreography that spans subjects and belongs to none of them is a shot, which cites its scene instead.

The first four rows are one population against one reference, the whole spec library, which is why a formation may cite the object or place it groups as readily as a character. What they owe is coverage of that library: every character, object, and world document must be answered for by at least one class, field, or method under those four paths. The twentieth module that cites nothing is not an error, because the document it quietly helps implement was discharged by the first module that cited it. Cite anyway, at the class for the subject, the field for the value that measures it, and the method for the behavior it performs. A place specified once and built by twenty modules is exactly where a reader needs to know which module answers for which decision, and one green citation does not answer that.

The shots row is its own population and selects functions, so a shot's citation belongs on the exported factory rather than on a table constant beside it.

These five folders are the whole source population. A module under any other path is outside the graph: it owes nothing, nothing owes it, and no diagnostic reports the omission. A building written under `src/buildings/` does not fail the graph, it leaves it, so put a work under `src/world/` and let its spec live in `docs/world/`.

## Why the design records are not in the graph

The graph covers Markdown, TypeScript, Prisma, and Swagger. JSON cannot host a citation, so `.automovie/design/**` sits outside it.

That is the reason the typed sources under `src` own the subjects and the design records are emitted from them rather than typed twice. A record and its source are two representations of one fact; deriving the record puts the authored surface where a citation can live, and removes the transcription that made them drift.

## Writing a citation

A citation names one unit and why this file answers for it. Markdown cites in an HTML comment so rendered prose stays clean; TypeScript cites in JSDoc.

```md
<!-- @evidence docs/<production>/03-beats/BEAT-014.md Dramatizes the beat as one staged scene. -->

# SCN-014
```

The reason is the load-bearing half. `@evidence <target>` with no reason satisfies the compiler and teaches nothing; the sentence is where you say what this file does about that unit, in terms a reader of the target would recognize.

Cite the nearest unit, not the most impressive one. A scene cites its beat, not the logline. Skipping a stage hides the gap the ladder exists to expose.

The refusal names `@evidenceExclude <target> <reason>` beside `@evidence`, and it means one thing: this population intentionally owes that unit nothing. A scene the soft lock preserved as `OMITTED` is the honest case. The number survives while the shot deliberately does not, and the exclusion states that where the next reader looks for the shot. Anything you have not built yet is the dishonest case. An exclusion over unfinished work reads green forever and cannot be told apart from a decided boundary, while the same gap left unpaid is one error carrying the file's own name.

A `@todo` left in a JSDoc block fails the same build with its own text. It is an obligation you wrote down and did not pay, so it is refused where you wrote it instead of being counted as done.

## Starting a production

Every stage directory exists from the first commit, empty, with a `.gitkeep`. That file is for git and for the reader. It is not Markdown, so it is neither a citable unit nor a host and it changes no obligation.

The graph does not go quiet while a stage is empty. It goes red at the last stage you filled, because that is the stage nothing below has answered for yet. A production holding only its logline is exactly one error, a missing acknowledgement for `docs/<production>/01-logline.md`, and it stays that error until a sequence breaks the logline down; then the sequences are the error, then the beats. Stages below the frontier are silent, because a population with no members has nothing to be acknowledged.

Fill the ladder downward and that frontier is your progress report. The logline first, then every sequence, then every beat, then every scene, before any one branch goes deeper. A production that elaborates one sequence to completion first has learned nothing about whether the others hold together, and the graph is still holding the same unpaid stage when it finds out.
