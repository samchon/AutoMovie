# Screenplays

Screenplays belong only to a film. Mirror the reviewed script delivery partition in `docs/screenplays`: preserve every delivery-group directory, index H1, unit filename and H1, and exact H2/H3/H4 identity, nesting, and order.

Run `npm run toc` after the mirrored inventory changes and `npm run toc -- --check` before advancing evidence. The generated managed block links units in canonical filename order; prose remains in the unit files and never moves into the index.

Write the final human-readable audiovisual contract. Preserve the script's decisive action, physical progression, exchange, timing boundary, and exit, then choose the visible action, audience-facing text, dialogue, sound, silence, perceptual access, rhythm, implication, and production-recognizable audiovisual voice that make the beat ready for independent shot and edit realization. Do not transcribe staging notes or hide missing narrative mechanics beneath camera language.

Keep a master-scene contract distinct from a shooting implementation. A valid heading and block hierarchy establishes formal validity only; each scene must also close its entry, action, exchange, audience effect, and exit semantically. Preserve the reviewed screenplay revision and every heading's scene, place, interior/exterior, time, and continuity axes, and invalidate downstream mappings after a substantive revision instead of letting renumbering or formatting disguise changed content.

Immediately below each active `SCN` heading, open a bounded authority carrier: a line reading `@automovie-scene`, one `location: <location catalog id>` line, one `story-time: <exact story-time identity or unknown>` line, one `participant: <stable story id> <mode>` line per participant with the mode `on-screen`, `off-screen`, `crowd`, `object`, `environmental`, or `referenced`, one `beat: <treatment beat id>` line per carried beat, and a closing `@end-automovie-scene` line. The screenplay index (version 2) records the same location, `storyTime`, `participants`, and `covers` beat ids for that scene beside the verbatim beat prose. The compiler refuses an active scene whose carrier is absent, repeats a field, or disagrees with the index, and it refuses an OMITTED tombstone that still carries one.

Every duration a scene states in prose names the shot field it quotes with an inline selector immediately after the figure: `6.0 seconds {@timing shot:<shot id>/duration}`, `3.0 seconds {@timing shot:<shot id>/event:<event id>/from}` or `/to`, or `2.0 seconds {@timing shot:<shot id>/review:<frame id>}`. The named shot cites the scene, the field exists, and its contract value equals the stated figure; an unowned figure is a warning while authoring and a refusal at review, and a sequence heading or preamble owns no timing at all.

An H4 is the smallest lineage and authoring boundary. It need not become a visible card or cut. Preserve identity even when the final edit presents adjacent beats continuously.

Before final expression, rerun the [production-specific contract](../evidence-graph/work-specific.md) pass with the `discovery/core/common.md`, `discovery/story/films.md`, and `discovery/story/screenplays.md` targets, and implement each retained expressive result in its target and claim. No example in the shared documents is a style inventory.

Apply the narrative unit-addressability obligation across the population after drafting. If final expression reveals a missing or overloaded treatment event, repair the earliest treatment owner and repartition every affected script unit. If it reveals only a hidden delivery scene or beat or an artificial delivery split, repair the script partition without manufacturing a treatment boundary. Propagate the resulting script identity exactly through screenplay, screenplay index, shots, and film source. Begin each H4 with audience-facing screenplay blocks rather than a treatment summary.

## Gate

Start at `screenplays: "draft"` only after scripts are in `review`. Before `evidence`, read the screenplay as a viewer and reject units that merely expand script instructions, contain unfilmable intent, lose inherited pressure or effect, leave dialogue, captions, sound, silence, access, or render-critical time for source code to invent, compress the declared film, or fail a selected principle.

Run [Author process Self-Review](../review-verification/self-review.md) to its clean round before every stage transition and again after any repair.

In its pre-H1 file comment, every screenplay file cites exactly one script file and every treatment H2 realized anywhere among its descendants. Every H2, H3, and H4 answers the complete common, narrative, and screenplay principle checklists, cites exactly one same-depth script parent, cites every treatment H2 that script unit realizes, and cites only settings it uses. The file-host union and the host union at each governed screenplay depth each cover the complete treatment H2 population directly, so an event lost in scripts cannot remain hidden behind otherwise exact script-to-screenplay lineage. The H2 population supplies every common, narrative, and screenplay-obligation owner and covers its applicable discovery targets. Follow [Evidence staging](../evidence-graph/staging.md). After the final evidence review, continue with [Review](../review-verification/review.md).
