# Screenplay naturalness

Naturalness is the film-only audience-language pass from the reviewed construction screenplay in `docs/screenplays` to the final screenplay in `docs/final/screenplays`. It revises dialogue, narration, and audience-read language against AI-slop and translated or assembled phrasing. It does not literary-naturalize external appearance, geometry, material, placement, physical action, state, or timing. It begins only after `screenplays` reaches `review`, and shots remain closed until `naturalness.screenplays` reaches `review`.

## Expression-only boundary

Freeze the complete construction screenplay before revision. Final may change only dialogue, narration, audience-read wording, and the local rhythm and register of those eligible language passages. Copy mechanically exact action lines and descriptions of appearance, geometry, material, spatial relation, placement, physical state, contact, movement, sound event, transition event, and timing unchanged. Final must preserve every event, fact, participant, motive, knowledge state, action, reaction, speech act and meaning, audiovisual requirement, numeric timing decision, authority carrier, file identity, H1, anchored H2/H3/H4 identity, nesting, and order.

A request for a more natural or better-written final grants no authority to change content. Record a substantive defect against its earliest settings, treatment, script, or screenplay-construction owner; repair and review that lineage within the user's authorized scope; freeze the new construction population; then restart final revision. Never conceal a content repair in final wording.

Copy no construction evidence annotation into final. Final file and unit comments carry only their exact construction lineage, selected naturalness answers, and reviews. Construction remains independently auditable and unchanged by an expression-only edit.

## Qualified complete reading

Read the complete annotation-free construction screenplay in its declared audience language before editing. Read by delivery group and scene continuity, perform dialogue and narration aloud when present, and judge eligible language beside the unchanged action, sound, silence, transition, scene-entry, and closure context that gives it meaning. Do not score mechanical action-line cadence as prose naturalness, and do not begin from a phrase blacklist, an AI-authorship detector, a count, or isolated sentences.

Use counts or diagnostics only to locate passages after a literal reading has established a possible defect. A number never proves awkwardness, authorship, or compliance. Preserve deliberate form, dialect, period language, ritual, refrain, procedural repetition, documentary flatness, and production-specific audiovisual grammar when the work owns them.

## Revision procedure

1. Confirm `screenplays: "review"`, settle the exact selected population, and set `naturalness.screenplays: "draft"` while creating the matching `docs/final/screenplays` tree.
2. Mirror every construction delivery-group directory, index H1, unit filename and H1, and exact anchored H2/H3/H4 identity, nesting, and order. Run `npm run toc`; the final managed indexes remain structural and contain no authored scene body.
3. Read the complete construction population without annotations and write the final body in context. Copy mechanical description exactly; revise only eligible audience language. An unchanged eligible passage is valid when the qualified reading finds no expression defect.
4. Open every selected `naturalness/core/common.md`, `naturalness/story/screenplays.md`, `language/naturalness/screenplays.md`, and configured work-specific naturalness target only after the complete final population exists. Answer each H2 target for every final H2/H3/H4 by judging all instances it governs in context.
5. Compare construction and final lineages. Verify every protected content decision, mechanical clause, and numeric selector, then reread eligible language as an audience and the complete final population as an independent shot author.
6. Move to `evidence` only after final bodies and fidelity checks are complete. Add one exact construction file citation before each H1 and one same-depth construction-unit citation plus every naturalness answer beneath each governed H2/H3/H4.
7. Follow [Evidence staging](../evidence-graph/staging.md), then [Author process Self-Review](../review-verification/self-review.md) through a complete clean round before `review`.

## Work-specific naturalness

The production-specific discovery pass may retain an expression condition not covered by the shared or language modules. Put that condition in one flat `docs/contracts/*.md` H2 and bind it with `createAutoMovieProductionPrincipleClaim` using `pass: "naturalness"`, `layer: "screenplays"`, final screenplay file selectors, and the visible `naturalness.screenplays` stage. A population comparison remains an obligation on construction; naturalness accepts only per-unit final checklists.

## Fidelity and unavailable evidence

Compare every final unit with its exact construction counterpart rather than relying on memory. If language qualification, speech performance, or another required observation is unavailable, state the missing capability and stop the affected review. Do not report an unperformed check as passed or weaken the target to fit available tools.

Naturalness does not require a larger body. Eligible language size may rise or fall as expression is clarified, but a changed mechanical clause or a material change in scene content, timing, or audience information is a failed fidelity check and returns upstream.

## Handoff

Before opening shot source work, update the machine screenplay index's screenplay-level and per-scene document paths to their exact final counterparts. Preserve its scene identifiers, authority fields, treatment pointers, and locks. Shot source lineage and the compiler's index-derived owner must name the same final unit; retaining a construction path in that index cannot answer a final owner edge.

Run `npm run toc -- --check`, `npm run lint`, and `npm run book -- --layer screenplays --pass final --title <title>`. Read the bound final edition without contracts or evidence annotations. Only a reviewed naturalness stage is eligible for shot and film-source realization.
