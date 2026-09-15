# Screenplay naturalness

Naturalness is the film-only audience-language pass from the reviewed construction screenplay in `docs/screenplays` to the final screenplay in `docs/final/screenplays`. Use this phase after construction review; [Evidence staging](../evidence-graph/staging.md#transitions) owns its entry and downstream gates.

## Expression-only boundary

Freeze the complete construction screenplay before revision. The [common naturalness contract](../../../docs/naturalness/core/common.md) owns eligible language and protected content; [Mechanical audiovisual description](../../../docs/principles/story/screenplays.md#mechanical-audiovisual-description) owns the clauses copied unchanged. [Evidence staging](../evidence-graph/staging.md#relationship-types) owns exact final lineage and annotation populations.

A request for a more natural or better-written final grants no authority to change content. Record a substantive defect against its earliest settings, treatment, script, or screenplay-construction owner; repair and review that lineage within the user's authorized scope; freeze the new construction population; then restart final revision. Never conceal a content repair in final wording.

Keep construction independently auditable and unchanged by an expression-only edit.

## Qualified complete reading

Read the complete annotation-free construction screenplay in its declared audience language before editing. Read by delivery group and scene continuity, perform dialogue and narration aloud when present, and judge eligible language beside the unchanged action, sound, silence, transition, scene-entry, and closure context that gives it meaning. Do not score mechanical action-line cadence as prose naturalness, and do not begin from a phrase blacklist, an AI-authorship detector, a count, or isolated sentences.

Use counts or diagnostics only to locate passages after a literal reading has established a possible defect. A number never proves awkwardness, authorship, or compliance. Preserve deliberate form, dialect, period language, ritual, refrain, procedural repetition, documentary flatness, and production-specific audiovisual grammar when the work owns them.

## Revision procedure

1. Confirm `screenplays: "review"`, settle the exact selected population, and set `naturalness.screenplays: "draft"` while creating the matching `docs/final/screenplays` tree.
2. Mirror the construction tree under the exact topology in [Evidence staging](../evidence-graph/staging.md#states). Run `npm run toc` to refresh its managed indexes.
3. Read the complete construction population without annotations and write the final body in context. Copy mechanical description exactly; revise only eligible audience language. An unchanged eligible passage is valid when the qualified reading finds no expression defect.
4. After the complete final population exists, apply every selected shared, language, and work-specific naturalness target to all instances it governs in context. This is the time to judge the finished expression, not a prohibition on reading the contracts before authoring.
5. Compare construction and final lineages. Verify every protected content decision, mechanical clause, and numeric selector, then reread eligible language as an audience and the complete final population as an independent shot author.
6. After final bodies and fidelity checks are complete, move to `evidence` and write the final lineage and naturalness batch under [Evidence staging](../evidence-graph/staging.md#tags).
7. Follow [Evidence staging](../evidence-graph/staging.md), then [Author process Self-Review](../review-verification/self-review.md) through a complete clean round before `review`.

## Work-specific naturalness

When production-specific discovery retains an expression condition beyond the shared or language modules, follow [Production-specific claims](../evidence-graph/staging.md#production-specific-claims) to bind it to the final pass. That owner distinguishes a final per-unit checklist from a construction population obligation.

## Fidelity and unavailable evidence

If language qualification, speech performance, or another required observation is unavailable, state the missing capability and stop the affected review. Do not report an unperformed check as passed or weaken the target to fit available tools.

Naturalness does not require a larger body. Eligible language size may rise or fall within the frozen content boundary.

## Handoff

Before opening shot source work, update the machine screenplay index's screenplay-level and per-scene document paths to their exact final counterparts. Preserve its scene identifiers, authority fields, treatment pointers, and locks. Shot source lineage and the compiler's index-derived owner must name the same final unit; retaining a construction path in that index cannot answer a final owner edge.

Run `npm run toc -- --check`, `npm run lint`, and `npm run book -- --layer screenplays --pass final --title <title>`. Read the bound final edition without contracts or evidence annotations. Only a reviewed naturalness stage is eligible for shot and film-source realization.
