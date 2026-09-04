# Scripts

Scripts belong only to a film. Write `docs/scripts` as `numbered delivery-group directory -> index.md H1 group title and generated unit links -> numbered script file -> H1 unit title -> anchored H2/H3/H4 delivery units`. Scripts design this delivery partition; they do not mirror treatment filenames or identities.

## Partition gate

Settle the complete delivery partition before writing any script body. Writing the partition while staging a scene lets the pressure of the open scene decide where the audience receives a boundary, which collapses the delivery axis back into the narrative-event axis this layer exists to separate.

Author a partition map that lists every delivery-group directory and H1 title, every script filename and H1 title beneath it, the ordered H2/H3/H4 identities inside each file, and every treatment H2 each script unit realizes. A treatment event may run across several script units and one script unit may braid several treatment events.

After adding, removing, renaming, or reordering a numbered unit, run `npm run toc` to regenerate the managed links in every script and screenplay index. Run `npm run toc -- --check` before advancing evidence; it compares the same canonical bytes without writing and refuses missing, extra, duplicate, mistargeted, or misordered links.

The map must satisfy four conditions before drafting begins:

- **Coverage.** Every treatment H2 in the active population is realized by the script population at every governed script depth. A treatment event nothing cites has been dropped, and the graph refuses it.
- **Attribution.** Every script unit realizes at least one treatment H2. A parentless unit is invention arriving in the wrong layer; author the event in treatments first instead of hiding it in the partition.
- **Weight.** No unit exists to reach a count, and no event is compressed merely to fit one. Allocate the declared film scale under `obligations/core/common.md#proportionate-development`.
- **Wholeness.** Each boundary leaves the audience with a complete part and a specific pressure, question, consequence, or formal state that the next part can answer. A cut that only interrupts is not a delivery boundary.

Review the map against the complete reviewed treatment sequence. When the exercise exposes a treatment defect, repair that event and propagate its consequences before returning to the partition. When it exposes only a better delivery grouping, revise the map without manufacturing a matching treatment group.

## Scope

A script is a **standalone, execution-ready initial script**. It is neither notes awaiting a real script nor the final shooting screenplay. It fixes the physical or formal progression, reaction, movement, transition, consequential exchange, and exit state deeply enough that the screenplay chooses expression rather than inventing mechanics.

When a script unit reads no more concretely than the treatment unit it refines, it has been restated rather than staged. Find the positions, objects, exchanges, and timings the treatment deliberately left to this layer.

For every H4, enact the exact temporal and spatial conditions at the precision this layer owns. Record entry state, participants or active forces, observation range, immediate objective or organizing process, obstruction where applicable, ordered action and reaction, spatial or informational movement, decisive exchange, knowledge change, and exit state. Where the film deliberately replaces ordinary time or place, state the rule that does so instead of leaving the substitution implicit.

Write every exchange whose wording, tactic, lie, refusal, interruption, or silence changes a choice, knowledge, power, or relationship as actual speaker-separated dialogue, together with the action and response around it. Summarize only incidental speech that changes none of them. A unit that says such an exchange occurs, buries its decisive line inside explanatory prose, or leaves a maker to invent the executable middle fails the common substantive-completion principle regardless of how well it reads.

Before refining the partition map, rerun the [production-specific contract](../evidence-graph/work-specific.md) pass with the `discovery/core/common.md`, `discovery/story/films.md`, and `discovery/story/scripts.md` targets. Staging is where an unowned execution rule first becomes visible, so implement each retained result in its target and claim rather than solving it once by hand.

Apply the narrative addressability obligation across the partition and the script staging-block principle to every H2/H3/H4. Reverse-outline the execution blocks after drafting. If executable detail reveals a missing narrative event, repair treatments first; if it reveals a defective delivery scene or beat boundary, repair the script partition and propagate that exact identity only to screenplays.

## Gate

Treat every script and caption boundary as an integer frame boundary on the one authored rational production clock. Destination audio samples, WebVTT milliseconds, and MP4 ticks use the shared nearest-half-up boundary mapping; do not calculate each carrier independently from decimal `fps`.

Start at `scripts: "draft"` only after treatments are in `review`. Before `evidence`, enact every H4 in order and test physical possibility, timing, resources, settings capabilities, entry and exit continuity, proportional expansion beyond its actual treatment parents, and every consequential action, exchange, knowledge change, or silence. A summary that merely says these occur is not a script.

For the execution-handoff check, hand only the script to a cold reader and require a followable account of every unit as a physical event. Repair every essential execution question that reader would have to invent.

Run [Author process Self-Review](../review-verification/self-review.md) to its clean round before every stage transition and again after any repair.

In its pre-H1 file comment, every script file cites every treatment H2 realized anywhere among its descendants. Every H2, H3, and H4 answers the complete common, narrative, and script principle checklists, cites every treatment H2 it actually realizes, and cites only settings it uses. The file-host union and the host union at each governed script depth each cover the complete treatment H2 population without exclusion. The H2 population supplies every common, narrative, and script-obligation owner and covers its applicable discovery targets. Follow [Evidence staging](../evidence-graph/staging.md). A discovered settings or treatment defect is repaired at that earlier owner, and every script unit realizing the changed treatment is reread before work resumes.
