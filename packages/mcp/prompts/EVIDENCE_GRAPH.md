# Evidence Graph Handbook

A production's folder layout is its obligation graph. Where a file sits declares what it owes and to whom, and an unpaid obligation is a compile error rather than something a reader has to notice.

This is what makes a long production converge. Screenwriting already works by progressive definition, logline to treatment to beat to scene, each stage removing ambiguity the previous one left. Here that ladder is mechanical: each stage cites the stage above it, so a branch cannot elaborate to completion while another never leaves the logline.

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

A sequence that serves no part of the logline does not belong in the film. A beat that belongs to no sequence is a beat nobody asked for. A scene that dramatizes nothing is footage.

## The spec library

A subject exists because a scene calls for it. Specifications are prose because they are decisions, not data: silhouette, scale, capability, and the reason each was chosen.

| Folder | Holds | Cites |
| --- | --- | --- |
| `docs/characters/` | one file per character | the scenes that need it |
| `docs/objects/` | one file per prop, weapon, vehicle | the scenes that need it |
| `docs/world/` | one file per place | the scenes set there |
| `docs/research/` | source ledgers, with URLs and confidence | nothing; it grounds claims |
| `docs/art-direction.md` | palette, scale grammar, readability | nothing |

State what the subject is and what it can do, and nothing else. A capability the specification does not state is one the source must not assume.

## Source

Source implements a specification and says which one. The vocabulary layers are `SOURCE_COMPOSITION`'s: members, groups, actions, then the shots that call them.

| Folder | Holds | Cites |
| --- | --- | --- |
| `src/units/` | one member's measured facts | its character or object spec |
| `src/objects/` | one prop's recipe | its object spec |
| `src/world/` | terrain, routes, landmarks | its world spec |
| `src/formations/` | one group of a member | the character spec it groups |
| `src/drills/` | one action a group performs | the units and formations it moves |
| `src/shots/` | shot factories and the table | the scenes they realize |

`src/drills/` citing `src/units/` is source grounding source, and it is the join that stops a drill from outliving the vocabulary it was written for.

## Why the design records are not in the graph

The graph covers Markdown, TypeScript, Prisma, and Swagger. JSON cannot host a citation, so `.automovie/design/**` sits outside it.

That is the reason the typed sources under `src` own the subjects and the design records are emitted from them rather than typed twice. A record and its source are two representations of one fact; deriving the record puts the authored surface where a citation can live, and removes the transcription that made them drift.

## Writing a citation

A citation names one unit and why this file answers for it. Markdown cites in an HTML comment so rendered prose stays clean; TypeScript cites in JSDoc.

```md
<!-- @evidence docs/austerlitz/03-beats/BEAT-SUN-1.md Dramatizes the fog burning back as one staged scene. -->

# SCN-014 — The sun on the Pratzen
```

The reason is the load-bearing half. `@evidence <target>` with no reason satisfies the compiler and teaches nothing; the sentence is where you say what this file does about that unit, in terms a reader of the target would recognize.

Cite the nearest unit, not the most impressive one. A scene cites its beat, not the logline. Skipping a stage hides the gap the ladder exists to expose.

## Starting a production

Every stage directory exists from the first commit, empty, with a `.gitkeep`. A claim population with no members is vacuously satisfied, so a stage that does not exist yet must still be visible as a stage, or the graph reports a pass over an absence.

Fill the ladder downward. The logline first, then every sequence, then every beat, then every scene, before any one branch goes deeper. A production that elaborates one sequence to completion first has learned nothing about whether the other nine hold together.
