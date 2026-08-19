# Evidence Graph Handbook

A production's folder layout is its obligation graph. Where a file sits declares what it owes and to whom, and an unpaid obligation is a compile error rather than something a reader has to notice.

This is what makes a long production converge. Writing already works by progressive definition — what exists, what happens, how it is staged, what is shot — each rung removing ambiguity the one above it left. Here that ladder is mechanical: each rung cites the rung above it and must be answered for by the rung below it, so no branch reaches a green build while another was never staged at all.

Read `SOURCE_COMPOSITION` for how source is arranged once shots repeat. This document owns which folder a thing belongs in, what it must cite, and which citations expire.

## The two axes

A file's place is decided by two questions, and confusing them is what produces a folder nobody can name.

**What kind of thing is it.** A rule the production is written against, a fact about what exists, prose that moves the story, or source that builds something. These do not mix: a figure's dimensions do not belong inside the scene that first needed the figure, and a shot module does not belong inside the scene prose it realizes.

**How settled is it.** The ladder is ordered by definition, not by chronology. A storyline is more settled than the canon it draws on and less settled than the scenario that stages it. A rung never cites downward.

## The ladder

Each rung is one file per unit. That is what makes a folder a population: a setting, a storyline, a scenario, and a scene are each a citable member, rather than a heading inside one document that holds the whole film.

| Folder | Holds | Cites |
| --- | --- | --- |
| `docs/principles/` | the rules the production is written against, one anchored `##` per rule | nothing; it is the root |
| `docs/settings/` | one file per fact, figure, place, subject, or constraint | its principles |
| `docs/research/` | one file per source ledger, beside the ladder | its principles |
| `docs/storylines/` | one file per sequence: what happens and why | its principles, and every setting it uses |
| `docs/scenarios/` | one file per staged action, with entry and exit state | its principles, **exactly one** storyline, the settings it rechecks |
| `docs/script/` | one file per scene, as it will be shot | its principles, **exactly one** scenario, that scenario's storyline, the settings it rechecks |
| `src/units`, `src/objects`, `src/world`, `src/formations` | one class per subject | its principles, and a settings document |
| `src/shots/` | shot factories and the table | its principles, and the script scenes they realize |

Three properties of that table are worth reading twice.

**Canon is not a stage.** `docs/settings` holds everything that exists — a figure's silhouette and scale, a prop's dimensions, a place's extent, the palette and the review distance, and the governing aim the whole work is sized against. A subject exists because the work needs it, and its settings document is where what it is and what it can do are written down. A capability the document does not state is one the source must not assume.

**Refinement is a bijection, until the last rung.** A scenario stages exactly one storyline and a scene realizes exactly one scenario; citing two hides which one the film actually made, and citing none refines nothing. The script-to-shot join is the one place that stops being true, because one scene is legitimately many shots. There the obligation is coverage of the scenes instead.

**The script cites two parents.** It names its scenario and, separately, the storyline that scenario came from. A refinement can be wrong, and citing the storyline directly is what catches a miswired scenario instead of inheriting its mistake.

## The principles are a tree, not a preamble

`docs/principles` is where the production writes down what it holds itself to, and it is organised by who answers each rule.

| Family | Binds | Examples |
| --- | --- | --- |
| `principles/common.md` | every authored document | determinism, a stated basis, refuse rather than approximate |
| `principles/authoring/` | one prose rung each: `settings`, `storylines`, `scenarios`, `script`, `research` | one parent per refinement, timing stated in seconds, a ledger names what it grounds |
| `principles/source/` | `subjects` and `shots` | one class one specification, what is not in the contract is not checked |
| `principles/craft/` | the modelled work: `form`, `scale`, `space`, `light`, `motion` | the silhouette test, scale against a named reference, screen direction |
| `principles/review/` | `observation` binds what a shot declares; `judgment` binds the act of judging | declare the view set, measure before you conclude |

Two of those need their exception stated, because a reader who does not know it will write something untrue.

`principles/review/judgment.md` is bound by nothing, deliberately. Its rules govern how a person or an agent reaches a verdict, and no artifact could honestly cite them — a citation would assert that a source file behaves a certain way, which is not what they say. Read it before reviewing anything; do not wire it.

`principles/craft/space.md` is a **domain** family: its rules apply only where the production has the element they govern. A production with no built environment declares that once, as a population-wide `@evidenceExclude`, rather than inventing a room to answer them. Every other principle refuses exclusion outright.

## What the graph refuses

Write the citation upward and read the refusal downward. Each obligation runs from the cited unit toward whatever must answer for it: every unit in a cited population must be acknowledged by some host in the population that cites it, and nothing obliges a host to cite anything. That asymmetry decides what the ladder is good for.

So a file added to a cited rung is an obligation on the rung below it. A principle nothing honors, a setting no storyline uses, a storyline no scenario stages, a scenario no scene realizes, and a scene no shot shoots are each one error naming that exact file or rule. A scenario that cites nothing is refused for a different reason — it has no parent — but a *setting* that cites nothing downward is silent, because nothing obliges canon to know who used it.

The ladder therefore catches abandonment rather than orphanhood, which is the property a long production needs. Write the citation anyway. It is what makes the abandonment report readable, because an error tells you a storyline was dropped and only the reason sentence tells you what it was for.

**A rung cannot be skipped.** Deleting `docs/scenarios` while `docs/script` still holds scenes does not go quiet; it refuses, once because the scenario population `matched no markdown files` and once for every scene still citing a scenario nothing materializes. The same holds one rung further down: shots cannot reach past the script to the scenario they liked better.

## Two kinds of production, one configuration

A production may be a **film**, or a **subject library**: a building, a vehicle, a set of props, authored on its own with no narrative above it. Both are first class, and neither needs a switch or a different config file.

The plugin decides activation from the claim side. A claim whose own host population selects no file is dropped before its references are read, so it costs nothing and says nothing. A claim that is live and whose reference population matches no file is a hard refusal rather than silence.

The layout is written around one rule that follows from this: **no obligation is hosted on a population both kinds have, if only one kind can pay it.** Every story obligation is hosted on `docs/storylines`, `docs/scenarios` or `docs/script`, none of which a subject library has, so they fall silent together. Everything a subject library owes is hosted on `docs/settings` and on `src`, which both kinds always have.

That is also why a storyline cites the settings it uses, rather than a setting citing the scenes that need it. Hosting that obligation on canon would make it live in a subject library too, and refuse a production for lacking scenes it was never going to have.

To author a subject library, leave the three story folders empty and write `docs/settings` and `src`. To author a film, fill the ladder downward. Do not edit the graph configuration to reach either state.

## Source

Source implements a settings document and says which one. The vocabulary layers are `SOURCE_COMPOSITION`'s: members, the groups they form, then the shots that call them.

There is no folder for actions. An action belongs to the subject that performs it, so a group's advance is a method on the class its settings document describes. A choreography that spans subjects and belongs to none of them is a shot, which cites its scene instead.

The four subject folders are one population against one reference set, which is why a formation may cite the object or place it groups as readily as a figure. What they owe runs both ways. Toward canon it is coverage: every settings document must be answered for by at least one class, field, or method. Toward source it is exactly one: every exported **class** must cite exactly one settings document, so a subject modelled before anything specified it is a compile error at the moment the class is written.

Fields and methods are deliberately outside that bound rather than pending. A class is a subject and a subject has one specification; a field may implement none. `Soloist.prototype.height` carries a stated figure and `Soloist.prototype.id` carries an identifier the code chose for itself, and no option can tell those apart, so requiring exactly one of every field would buy true citations for the first kind at the price of untrue tags for the second. Cite anyway where it is true — the class for the subject, the field for the value that measures it, the method for the behavior it performs — because coverage is what those hosts owe, and a document answered by one module out of twenty tells a reader nothing about which module answers for which decision.

The shots population selects both callable and data exports. A shot written `export const opening = defineShot("opening", { ... })` is a data export, not a function, so a citation on it counts — but put the citation on the exported shot rather than on a table constant beside it, because that is where the next reader looks.

These five folders are the whole source population. A module under any other path is outside the graph: it owes nothing, nothing owes it, and no diagnostic reports the omission. A building written under `src/buildings/` does not fail the graph, it leaves it, so put a work under `src/world/` and let its settings live in `docs/settings/`.

Two shipped modules are outside on purpose. `src/film.ts` and `src/production.ts` declare the compile rather than a subject, so no rung of the ladder holds a document they could answer for. `src/examples/` is outside for its own reason, which the file that configures the graph states beside it.

## Why the design records are not in the graph

The graph covers Markdown, TypeScript, Prisma, and Swagger. JSON cannot host a citation, so `.automovie/design/**` sits outside it.

That is the reason the typed sources under `src` own the subjects and the design records are emitted from them rather than typed twice. A record and its source are two representations of one fact; deriving the record puts the authored surface where a citation can live, and removes the transcription that made them drift.

The screenplay index is the exception that proves it. It is hand-authored, it addresses the storyline and script documents by path, and the compiler resolves those paths on disk: each indexed beat must appear verbatim in the storyline it names and each indexed scene must head the script document it names. That check is not the evidence graph; it is a second joint holding prose and ledger together, and moving a prose document without moving the index dangles it.

The index keeps the older vocabulary for its two story fields: `treatment.sequences` addresses `docs/storylines` and `screenplay.scenes` addresses `docs/script`. The rung names are the folders, the field names are the ledger's, and the ids — `SEQ-*`, `SCN-*` — are what survive both.

## Writing a citation

A citation names one unit and why this file answers for it. Markdown cites in an HTML comment so rendered prose stays clean; TypeScript cites in JSDoc.

A Markdown document carries **one** comment, before its H1, holding every citation the document makes. Each document is a single host, so a heading inside it is never asked to carry a parent of its own.

```md
<!--
@evidence principles/authoring/scenarios.md#one-parent Stages exactly the cue sequence.
@evidence storylines/001-cue.md Stages the cue as the one action it turns on.
@evidence settings/040-plaza.md Stands the figure on the named centre point.
-->

# Cue — the hand goes up
```

Markdown targets resolve against `docs`, so a document names `settings/040-plaza.md` rather than `docs/settings/040-plaza.md`. That shortening belongs to targets and to nothing else. A path written in prose, in a JSDoc sentence, or inside a runtime message keeps its `docs/` prefix, because its job is not to resolve against a configured root but to be opened by whoever is reading it — a validator that refuses a count and names `settings/020-chorus.md` has sent its reader to a path that does not exist from where they are standing.

A principle is targeted by its anchor, `principles/common.md#determinism`, because each rule is its own citable unit: a rule nothing acknowledges is one error naming that rule, not a whole document discharged by a single citation.

The reason is the load-bearing half. `@evidence <target>` with no reason satisfies the compiler and teaches nothing; the sentence is where you say what this file does about that unit, in terms a reader of the target would recognize.

Cite the nearest unit, not the most impressive one. A scenario cites its storyline, not the governing aim. Skipping a rung hides the gap the ladder exists to expose — except where the ladder asks for two parents on purpose, at the script.

## A citation that expires

Some references ask for more than a citation. Where one sets `requireReview`, the same documentation block must also carry `@evidenceReview <target> #<digest> <what you checked>`, and the digest is of the cited content as it stands. Move that content and the review stops matching:

```
Stale @evidenceReview for 'scenarios/001-cue.md' at docs/script/001-cue.md:8:
the review names '#a43f23e' and that scope now digests to '#9315ff8'.
```

Expiry is the point. Without it a review is written once and stays green forever, and nobody can tell which reviews were written against content that has since moved. It sits on the ladder's parent references and on the script-to-shot join, so changing a storyline re-opens the scenario that refines it, and changing a scene re-opens every shot that claimed to realize it.

Write what you read or ran, not what you believe. The check proves a current statement exists; it does not prove anyone read the content, and it does not judge whether the sentence is sincere. That is why an untrue review is worse than a missing one.

## Refusing an obligation

`@evidenceExclude <target> <reason>` sits beside `@evidence`, and it means one thing: this population intentionally owes that unit nothing.

The honest case is a decided boundary. A scene the soft lock preserved as `OMITTED` is one: the number survives while the shot deliberately does not, and the exclusion states that where the next reader looks for the shot. A settings document no class can implement is another — a governing aim, or a palette every subject is drawn against rather than a subject to build. A production with no built environment excusing itself from the space principles is a third. Write that exclusion once, on one carrier, for the whole population.

The dishonest case is anything you have not built yet. An exclusion over unfinished work reads green forever and cannot be told apart from a decided boundary, while the same gap left unpaid is one error carrying the file's own name.

Most references refuse exclusion outright, and the refusal is deliberate. A principle binds wherever its condition applies, so a document that cannot honestly satisfy one is defective rather than excusable. A parent is the whole content of a refinement, so a scenario excusing itself from having a storyline is not a scenario. The exception is the domain family, whose condition a production may genuinely not meet.

A `@todo` left in a JSDoc block fails the same build with its own text. It is an obligation you wrote down and did not pay, so it is refused where you wrote it instead of being counted as done.

## What the compiler checks that the graph cannot

The graph knows which file cites which. It does not read a sentence, and it does not know what your shots do. Three checks close that gap, and knowing they exist keeps you from writing prose that quietly contradicts the film.

- **A duration stated in scene prose must be one the realizing shot carries.** `screenplay-scene-timing-unrealized` compares every figure the scene states in seconds against the shot's `durationSeconds` and its event windows. A warning while authoring, because prose may run ahead of the shot that will realize it; an error at review, because a film presented as deliverable is claiming its script describes it.
- **A shot build path reads nothing it was not given.** `source-shot-nondeterministic` refuses a wall clock, unseeded randomness, or process state in a shot module. An unsupported import is refused earlier and separately, by an AST walk, as `source-import-unsupported`.
- **Prose and ledger must agree.** Each indexed beat appears verbatim in the storyline it names, and each indexed scene heads the script document it names.

One joint is deliberately left to you. A shot names its scene twice — once as `@evidence script/00X.md` and once as `evidence[].scene` in its contract — and nothing checks that the two agree. `principles/source/shots.md#realizes-a-named-scene` states it as yours to keep rather than implying a check that is not there.

## Starting a production

The starter ships every rung filled, so you begin by replacing documents rather than by creating folders. Keep the folder whenever you empty a rung — a subject library keeps the three story folders with a `.gitkeep` in each. That file is for git and for the reader; it is not Markdown, so it is neither a citable unit nor a host and it changes no obligation.

Fill the ladder downward, and fill each rung across before going deeper. Principles and settings first, then every storyline, then every scenario, then every scene, before any one branch reaches source. A production that elaborates one sequence to completion first has learned nothing about whether the others hold together, and the graph is still holding the same unpaid rung when it finds out.

The frontier is your progress report, and it reads as an empty folder rather than as an error: the rung you have filled is answered for by nothing yet because nothing below it exists to answer. Add the first file to the next rung and that whole rung's obligations arrive at once — its principles, its parents, and the canon it must account for. That is the moment to write the rung across rather than one document deep.
