# Script principles

Rules the final script answers. The script is the film as it will be shot: one
document per scene, each carrying the heading, the action, the speech and the
timing that the shots realize.

It is the last prose layer. Everything below it is source, geometry and frames.

A production that authors no story owes nothing here.

## Each scene realizes one scenario unit {#realizes-one-scenario}

A script scene answers for exactly one scenario unit and says which. This is the
join that makes an unrealized plan visible: a scenario nothing realizes is one
error naming that file, and a script scene realizing two hides which of them the
film actually shot.

Sources: `EVIDENCE_GRAPH` on citing the nearest unit; this graph's one-parent
lineage from the script to scenarios.

## It cites the storyline as well as the scenario {#triangulation}

A script scene cites the storyline unit its scenario came from, not only the
scenario. The scenario is a refinement and refinements can be wrong; citing the
storyline directly is what stops a misread intention from spreading on the
excuse that the scenario already made the mistake.

Two citations, one for the immediate parent and one for the layer above it, cost
one line and catch a whole class of drift that neither citation alone reports.

Sources: this graph's script claim, which references scenarios and storylines
together.

## The heading, the action and the speech are the shot's contract {#contract-for-shots}

What a shot renders is what this document says. A scene that leaves staging to
the shot has moved a decision out of the layer that can be reviewed as prose and
into one that can only be reviewed as pixels.

Sources: `SHOT_CONTRACT`; `SCREENPLAY_WRITING` on scene headings and their
identity.

## Timing is stated where it matters and stated as time {#stated-timing}

Where a beat depends on duration — a held look, a pause before an answer, a
movement that must finish before a line — the script says how long in seconds
rather than in adverbs. The engine keeps time in seconds and cannot read
"briefly".

Sources: the production contract on keeping time in seconds; `EDITING` on how a
cut reads against duration.

## A scene number survives its own deletion {#numbers-survive}

After the screenplay's soft lock, a removed scene keeps its number as `OMITTED`
and an inserted one takes an alpha id. Renumbering makes every citation, receipt
and review that named the old number wrong at once, silently.

Sources: the production contract on the screenplay index's soft lock;
`SCREENPLAY_WRITING` on insertion ids.
