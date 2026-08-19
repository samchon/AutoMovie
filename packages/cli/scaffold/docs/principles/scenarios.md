# Scenario principles

Rules a scenario answers. A scenario refines one storyline unit into something
that can actually be staged: where it happens, who is where, what moves, and
what state the unit is left in.

It is the first layer held to physical truth. A storyline may say a figure
crosses the hall; a scenario says the hall is nine metres and the crossing takes
the time nine metres takes.

A production that authors no story owes nothing here.

## It can be staged from what it says {#stageability}

Every element the scenario asks for exists in settings, stands somewhere the
geometry admits, and moves in a way the engine can resolve. A scenario that
requires a subject nobody specified is refused by the graph; a scenario that
requires a movement the space does not allow is refused by the engine, later and
more expensively.

Sources: `EVIDENCE_GRAPH` on the settings library; `BUILT_ENVIRONMENT` on asking
the model what a space contains and what reaches it.

## Entry and exit state are both stated {#entry-and-exit}

The scenario says what is true when the unit begins and what is true when it
ends. Without both, the next unit inherits an assumption instead of a state, and
the first thing that contradicts it will be a frame.

Sources: `SHOT_CONTRACT` on what a shot declares about its own state.

## Physical progression is continuous {#physical-progression}

Positions, distances and timings follow from one another. A figure does not
arrive somewhere it had no time to reach, and a thing does not appear where
nothing put it.

Sources: `BUILT_ENVIRONMENT` on connectors, adjacency and reachability;
`MOTION` on resolving movement deterministically.

## It refines exactly one storyline unit {#one-parent}

A scenario answers for one unit above it and says which. Refining two at once
hides which of them is unrealized, and refining none makes the scenario a plan
for a story nobody wrote.

Sources: `EVIDENCE_GRAPH` on citing the nearest unit; this graph's one-parent
lineage from scenarios to storylines.

## It rechecks the settings it uses rather than inheriting them {#settings-rechecked}

A scenario cites the settings it stands on, even where the storyline above it
already did. That second look is the point: it is what stops a storyline's
misreading of canon from flowing into the staging unchallenged.

Sources: this graph's scenario claim against settings, which exists beside the
storyline lineage rather than instead of it.
