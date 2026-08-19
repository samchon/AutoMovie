# Evidence Graph Handbook

A production's folder layout is its obligation graph. Where a file sits declares
what it owes and to whom, and an unpaid obligation is a compile error rather
than something a reader has to notice.

This is what makes a long production converge. Writing already works by
progressive definition — what exists, what happens, how it is staged, what is
shot — each stage removing ambiguity the previous one left. Here that ladder is
mechanical: each stage cites the stage above it and must be answered for by the
stage below it, so no branch reaches a green build while another was never
staged at all.

Read `SOURCE_COMPOSITION` for how source is arranged once shots repeat. This
document is about which folder a thing belongs in and what it must cite.

## The two axes

A file's place is decided by two questions, and confusing them is what produces
a folder nobody can name.

**What kind of thing is it.** A rule the production is written against, a fact
about what exists, prose that moves the story, or source that builds something.
These do not mix: a character's dimensions do not belong inside the scene that
first needed the character, and a shot module does not belong inside the scene
prose it realizes.

**How settled is it.** The ladder is ordered by definition, not by chronology. A
storyline is more settled than the canon it draws on and less settled than the
scenario that stages it. A stage never cites downward.

## The ladder

Each stage is one file per unit. That is what makes a folder a population: a
setting, a storyline, a scenario, and a scene are each a citable member, rather
than a heading inside one document that holds the whole film.

| Folder | Holds | Cites |
| --- | --- | --- |
| `docs/principles/` | one anchored `##` per rule the production is written against | nothing; it is the root |
| `docs/settings/` | one file per fact, figure, place, subject, or constraint | the common and settings principles |
| `docs/research/` | one file per source ledger, beside the ladder | the common and research principles |
| `docs/storylines/` | one file per sequence: what happens and why | its principles, and every setting it uses |
| `docs/scenarios/` | one file per staged action, with entry and exit state | its principles, **exactly one** storyline, and the settings it rechecks |
| `docs/script/` | one file per scene, as it will be shot | its principles, **exactly one** scenario, that scenario's storyline, and the settings it rechecks |
| `src/shots/` | shot factories and the table | the script scenes they realize |

`docs/research/` sits beside the ladder rather than on it: ledgers of what the
world outside this production contains. Nothing above it commissions one,
because a production may invent every figure it uses and owe the world nothing,
and nothing below it is required to use one. What binds is the other direction —
a ledger that exists answers `principles/common.md` and `principles/research.md`,
which ask for an identifiable source, a stated confidence, the settings fact each
entry grounds, and a disagreement recorded rather than silently resolved.

The obligation is hosted on the ledger rather than referenced from canon, and
that is what keeps it honest. A reference would make every settings document owe
a source, which is false of a chosen figure, and would refuse outright in the
ordinary case where the folder is empty. Hosted this way the rung behaves like
the story rungs: empty and it is silent, one file and all ten rules arrive at
once.

Three properties of that table are worth reading twice.

**Canon is not a stage.** `docs/settings` holds everything that exists — a
character's silhouette and scale, a prop's dimensions, a place's extent, the
palette and the review distance, and the governing aim the whole work is sized
against. A subject exists because the work needs it, and the settings document
is where what it is and what it can do are written down. A capability the
document does not state is one the source must not assume.

**Refinement is a bijection, until the last rung.** A scenario stages exactly
one storyline and a scene realizes exactly one scenario; citing two hides which
one the film actually made, and citing none refines nothing. The script-to-shot
join is the one place that stops being true, because one scene is legitimately
many shots. There the obligation is coverage of the scenes instead.

**The script cites two parents.** It names its scenario and, separately, the
storyline that scenario came from. A refinement can be wrong, and citing the
storyline directly is what catches a miswired scenario instead of inheriting its
mistake.

## What the graph refuses

Write the citation upward and read the refusal downward. Each obligation runs
from the cited unit toward whatever must answer for it: every unit in a cited
population must be acknowledged by some host in the population that cites it,
and nothing obliges a host to cite anything. That asymmetry decides what the
ladder is good for.

So a file added to a cited stage is an obligation on the stage below it. A
principle nothing honors, a setting no storyline uses, a storyline no scenario
stages, a scenario no scene realizes, and a scene no shot shoots are each one
error naming that exact file or rule. A scenario that cites nothing is refused
for a different reason — it has no parent — but a *setting* that cites nothing
downward is silent, because nothing obliges canon to know who used it.

The ladder therefore catches abandonment rather than orphanhood, which is the
property a long production needs. Write the citation anyway. It is what makes
the abandonment report readable, because an error tells you a storyline was
dropped and only the reason sentence tells you what it was for.

**A rung cannot be skipped.** Deleting `docs/scenarios` while `docs/script`
still holds scenes does not go quiet; it refuses, once because the scenario
population `matched no markdown files` and once for every scene still citing a
scenario nothing materializes. The same holds one rung further down: shots
cannot reach past the script to the scenario they liked better.

## Two kinds of production, one configuration

A production may be a **film**, or a **subject library**: a building, a vehicle,
a set of props, authored on its own with no narrative above it. Both are first
class, and neither needs a switch or a different config file.

The plugin decides activation from the claim side. A claim whose own host
population selects no file is dropped before its references are read, so it
costs nothing and says nothing. A claim that is live and whose reference
population matches no file is a hard refusal rather than silence.

The layout is written around one rule that follows from this: **no obligation is
hosted on a population both kinds have, if only one kind can pay it.** Every
story obligation is hosted on `docs/storylines`, `docs/scenarios` or
`docs/script`, none of which a subject library has, so they fall silent
together. Everything a subject library owes is hosted on `docs/settings` and on
`src`, which both kinds always have.

That is also why a storyline cites the settings it uses, rather than a setting
citing the scenes that need it. Hosting that obligation on canon would make it
live in a subject library too, and refuse a production for lacking scenes it was
never going to have.

To author a subject library, leave the three story folders empty and write
`docs/settings` and `src`. To author a film, fill the ladder downward. Do not
edit the graph configuration to reach either state.

## Source

Source implements a settings document and says which one. The vocabulary layers
are `SOURCE_COMPOSITION`'s: members, the groups they form, then the shots that
call them.

| Folder | Holds | Cites |
| --- | --- | --- |
| `src/units/` | one member's measured facts | its settings document |
| `src/objects/` | one prop's recipe | its settings document |
| `src/world/` | terrain, routes, landmarks, and the built environment | its settings document |
| `src/formations/` | one group of a member | the settings of what it groups |
| `src/shots/` | shot factories and the table | the script scenes they realize |

There is no folder for actions. An action belongs to the subject that performs
it, so a group's advance is a method on the class its settings document
describes. A choreography that spans subjects and belongs to none of them is a
shot, which cites its scene instead.

The first four rows are one population against one reference, the whole settings
library, which is why a formation may cite the object or place it groups as
readily as a character. What they owe runs both ways. Toward canon it is
coverage: every settings document must be answered for by at least one class,
field, or method under those four paths. Toward source it is exactly one: every
exported **class** must cite exactly one settings document, so a subject modelled
before anything specified it is a compile error at the moment the class is
written. Fields and methods are not yet held to that bound; cite anyway, at the
class for the subject, the field for the value that measures it, and the method
for the behavior it performs.

The shots row is its own population, and it selects both callable and data
exports. A shot written `export const opening = defineShot("opening", { ... })`
is a data export, not a function, so a citation on it counts — but put the
citation on the exported shot rather than on a table constant beside it, because
that is where the next reader looks.

These five folders are the whole source population. A module under any other
path is outside the graph: it owes nothing, nothing owes it, and no diagnostic
reports the omission. A building written under `src/buildings/` does not fail the
graph, it leaves it, so put a work under `src/world/` and let its settings live
in `docs/settings/`.

Two shipped modules are outside on purpose. `src/film.ts` and `src/production.ts`
declare the compile rather than a subject, so no rung of the ladder holds a
document they could answer for. `src/examples/` is outside for its own reason,
which the file that configures the graph states beside it.

## Why the design records are not in the graph

The graph covers Markdown, TypeScript, Prisma, and Swagger. JSON cannot host a
citation, so `.automovie/design/**` sits outside it.

That is the reason the typed sources under `src` own the subjects and the design
records are emitted from them rather than typed twice. A record and its source
are two representations of one fact; deriving the record puts the authored
surface where a citation can live, and removes the transcription that made them
drift.

The screenplay index is the exception that proves it. It is hand-authored, it
addresses the storyline and script documents by path, and the compiler checks
that each indexed beat appears verbatim in the storyline it names and each
indexed scene heads the script document it names. That check is not the evidence
graph; it is the second joint holding prose and ledger together.

## Writing a citation

A citation names one unit and why this file answers for it. Markdown cites in an
HTML comment so rendered prose stays clean; TypeScript cites in JSDoc.

A Markdown document carries **one** comment, before its H1, holding every
citation the document makes. Each document is a single host, so a heading inside
it is never asked to carry a parent of its own.

```md
<!--
@evidence principles/scenarios.md#one-parent Stages exactly the cue sequence.
@evidence storylines/001-cue.md Stages the cue as the one action it turns on.
@evidence settings/040-plaza.md Stages the step against the named centre point.
-->

# Cue — the hand goes up
```

Markdown targets resolve against `docs`, so a document names `settings/040-plaza.md`
rather than `docs/settings/040-plaza.md`. A principle is targeted by its anchor,
`principles/common.md#determinism`, because each rule is its own citable unit: a
rule nothing acknowledges is one error naming that rule, not a whole document
discharged by a single citation.

The reason is the load-bearing half. `@evidence <target>` with no reason
satisfies the compiler and teaches nothing; the sentence is where you say what
this file does about that unit, in terms a reader of the target would recognize.

Cite the nearest unit, not the most impressive one. A scenario cites its
storyline, not the governing aim. Skipping a stage hides the gap the ladder
exists to expose — except where the ladder asks for two parents on purpose, at
the script.

## Refusing an obligation

`@evidenceExclude <target> <reason>` sits beside `@evidence`, and it means one
thing: this population intentionally owes that unit nothing.

The honest case is a decided boundary. A scene the soft lock preserved as
`OMITTED` is one: the number survives while the shot deliberately does not, and
the exclusion states that where the next reader looks for the shot. A settings
document no class can implement is another — a governing aim, or a palette every
subject is drawn against rather than a subject to build. Write that exclusion
once, on one carrier, for the whole population.

The dishonest case is anything you have not built yet. An exclusion over
unfinished work reads green forever and cannot be told apart from a decided
boundary, while the same gap left unpaid is one error carrying the file's own
name.

Two references refuse exclusion outright, and the refusal is deliberate. A
principle binds wherever its condition applies, so a document that cannot
honestly satisfy one is defective rather than excusable. A parent is the whole
content of a refinement, so a scenario excusing itself from having a storyline
is not a scenario.

A `@todo` left in a JSDoc block fails the same build with its own text. It is an
obligation you wrote down and did not pay, so it is refused where you wrote it
instead of being counted as done.

## Starting a production

The starter ships every rung filled, so you begin by replacing documents rather
than by creating folders. Keep the folder whenever you empty a rung — a subject
library keeps the three story folders with a `.gitkeep` in each. That file is
for git and for the reader; it is not Markdown, so it is neither a citable unit
nor a host and it changes no obligation.

Fill the ladder downward, and fill each rung across before going deeper.
Principles and settings first, then every storyline, then every scenario, then
every scene, before any one branch reaches source. A production that elaborates
one sequence to completion first has learned nothing about whether the others
hold together, and the graph is still holding the same unpaid stage when it
finds out.

The frontier is your progress report, and it reads as an empty folder rather
than as an error: the stage you have filled is answered for by nothing yet
because nothing below it exists to answer. Add the first file to the next stage
and that whole rung's obligations arrive at once — its principles, its parents,
and the canon it must account for. That is the moment to write the rung across
rather than one document deep.
