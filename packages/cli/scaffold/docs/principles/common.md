# Common principles

Rules every authored document of this production answers — a settings fact, a
storyline, a scenario, or the script. Each item binds wherever its condition
applies; citing it asserts that this document honours it where it applies, and
naming the scope fact is the honest answer when the condition never triggers
here.

These are not style. Each one is a failure this product has already paid for,
written down so the next production does not pay it again.

## Determinism is authored, not hoped for {#determinism}

The same inputs produce the same bytes. A build function reads no wall clock,
no network, no process state, no filesystem, and no unseeded randomness; a
variation the production wants is a seed the design states.

The reason is not purity. It is that every other check here compares two runs,
and a value that moves on its own makes each of those comparisons unable to
fail — which reads exactly like passing.

Sources: the production contract's timing and randomness rules in `AGENTS.md`;
`COMPILATION` on what a compile scope may read.

## A number states what it was measured from {#stated-basis}

Where a document gives a figure, it says how the figure was obtained: read from
a compiled artifact, measured from geometry, counted from a frame, or chosen by
the author. Those four have different authority and a reader cannot recover
which one applies from the number alone.

A description is not a measurement. "The wall stands clear of the floor" and
"the wall's base sits at Y = 0.000 against a slab top of Y = 0.000" are not the
same claim, and only the second can be wrong in a way anybody notices.

Sources: `BUILDING_STUDIES` on reading a schedule rather than describing one;
`SUBJECT_INSPECTION` on what an inspection publishes beside each observation.

## Refuse rather than approximate {#refuse-rather-than-approximate}

Where a derivation cannot answer, the document says so and says what would make
it answer. It never prints a plausible number in place of one it does not have.

An absent value that announces itself costs a reader one sentence. A made-up
one costs whatever is built on it, and it is indistinguishable from a real
measurement at the moment it is read.

Sources: `IAutoMovieDrawingGap`'s distinction between a derivation that does
not exist and one that had no input; the drawing schedule's refusal to bound a
chamfered cell rather than approximate it.

## A citation names one unit and why {#evidence-discipline}

`@evidence <target> <reason>` with no reason satisfies the compiler and teaches
nothing. The sentence is where this document says what it does about that unit,
in terms a reader of the target would recognise.

Never leave an untrue tag standing to clear a diagnostic. It removes the error,
not the problem, and the next reader has no way to tell the difference.

Sources: `EVIDENCE_GRAPH` on writing a citation; the graph plugin's own repair
text, which says the same thing at the point of failure.

## Change the earliest owning layer first {#change-upstream-first}

When work at one layer reveals that a layer above it decided wrongly, the fix
starts at the earliest layer that owns the decision and moves down: settings,
then storylines, then scenarios, then the script, then source.

Never preserve a false upstream decision to keep the build green. Use the graph
to find the dependants, reread each affected unit in full rather than patching
the citation, and repair downstream in the same pass.

Sources: `EVIDENCE_GRAPH` on the ladder's direction; `PRODUCTION_DESIGN` on
replacing a production as one pass.
