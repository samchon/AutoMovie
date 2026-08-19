# Subject principles

Rules a subject module answers. A subject is a thing the film contains — a
figure, a prop, a place, a group of any of those — written as a class under
`src/units`, `src/objects`, `src/world` or `src/formations`.

These bind under both kinds of production. A subject library with no story owes
every item here, because a building authored on its own is still a subject
implemented against canon.

## One class answers for one settings document {#one-specification}

A class is a subject, and a subject has one specification. Cite it, and cite
only it: a class citing two has hidden which document the reader should correct,
and a class citing none is a thing somebody modelled before anybody said what it
was.

The graph refuses both at the moment the class is written, which is the one
thing a reference-side obligation cannot do.

Sources: `EVIDENCE_GRAPH` on the source population and its two claims.

## A stated figure lives as a field, not as a literal {#measured-values-are-fields}

A number canon states is a field on the class the document specifies, named for
what it measures. Writing it inline where it is used spends the decision at the
call site: the next author changes the settings document and the film keeps the
old value, because nothing connected them.

A value derived from another is derived in one place too, so a change to the
scale it comes from reaches it.

Sources: `SOURCE_COMPOSITION` on subjects as classes; `principles/settings.md#capability-stated`.

## Behaviour belongs to the subject that performs it {#behaviour-belongs-to-its-subject}

An action is a method on the class that performs it, not a block inside whatever
shot happens to stage it. A group's advance belongs to the group; a gate's swing
belongs to the gate. A choreography that spans subjects and belongs to none of
them is a shot, and cites its scene instead.

There is no population for actions, and that is why.

Sources: `MOTION` on defining an action; `SOURCE_COMPOSITION` on a group of
subjects being a subject.

## Implement nothing canon does not state {#no-unstated-capability}

The settings document is the whole of what the subject can do. A behaviour the
source adds that no document names is a decision nobody wrote down, and it is
discovered by whoever is surprised by it in a frame.

Where the work needs a capability canon lacks, the settings document changes
first.

Sources: `principles/settings.md#capability-stated`; `principles/common.md#change-upstream-first`.

## A build path reads nothing it was not given {#build-is-pure}

No wall clock, no network, no process state, no filesystem, and no unseeded
randomness on any path a shot builds through. Variation the production wants is
a seed the design states.

The reason is not purity. Every check this production has compares two runs, and
a value that moves on its own makes each of those comparisons unable to fail —
which reads exactly like passing.

Sources: `principles/common.md#determinism`; the production contract's timing
and randomness rules in `AGENTS.md`.

## Refuse rather than degrade {#refuse-rather-than-degrade}

When the compile context cannot supply what the subject needs — a rig, a model,
a landmark — refuse and name the missing fact. A subject that quietly renders a
lesser version of itself produces a frame that looks like a decision.

Sources: `principles/common.md#refuse-rather-than-approximate`.
