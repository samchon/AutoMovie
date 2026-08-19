# Shot principles

Rules a shot module answers. A shot is where the script becomes motion: it
names the scene it realizes, asks subjects to render, and declares what the
compiled result must show.

This is the last rung of the ladder and the only one a subject library does not
have. A production with no script has no shots, and these rules go silent with
them.

## A shot names the scene it realizes, in both records {#realizes-a-named-scene}

The prose citation and the contract's `evidence` entry are two spellings of one
fact, and they must name the same scene. The graph checks that the scene
document is cited by something under `src/shots`; the compiler checks that the
scene the contract names is one the index declares. Neither reads the other, so
the agreement is the author's to keep.

Sources: `EVIDENCE_GRAPH` on the script-to-shot join; `SHOT_CONTRACT`.

## What is not in the contract is not checked {#the-contract-is-the-claim}

A shot's promise is its contract: duration, participants, opening and closing
states, and events with windows and predicates. `realizeShotContract` returns
an explicit outcome for every one of them against the compiled artifact, and
for nothing else.

So a quality the shot needs and the contract does not state is a quality nobody
will notice failing. Declare it as a predicate, or accept that it is judged by
somebody looking.

Sources: `SHOT_CONTRACT` on declared frames as a capture obligation.

## A duration the scene states is one the contract carries {#timing-comes-from-the-contract}

Where scene prose gives a time in seconds, that figure must be one the
realizing shot actually holds — its duration, or a bound of one of its event
windows. A number in prose reads as a measurement of the film, so one nothing
implements is a promise the shot never made.

The compiler refuses this as `screenplay-scene-timing-unrealized`: a warning
while authoring, because prose may run ahead of the shot that will realize it,
and an error at review, because a film presented as deliverable is claiming its
script describes it.

Sources: `principles/authoring/script.md#stated-timing`;
`principles/common.md#stated-basis`.

## Subjects render themselves {#subjects-render-themselves}

A shot names subjects and asks them to render. It does not reach inside one to
pose a bone, set a colour, or recompute a measurement the class already owns. A
shot that does has moved a subject's decision into the one place it cannot be
reused, and the next shot will disagree with it.

Sources: `SOURCE_COMPOSITION` on a shot naming subjects;
`principles/source/subjects.md#behaviour-belongs-to-its-subject`.

## A shot is authored with what would falsify it {#acceptance-is-authored-with-the-shot}

The acceptance scenario that judges a shot is written with the shot, not after
it. Written after, it is fitted to what the shot already produces, and a
criterion shaped by its own result tests nothing.

Sources: `ACCEPTANCE`; `principles/common.md#stated-basis`.

## A build function reads nothing it was not given {#no-hidden-inputs}

The same rule the subjects answer, restated where it is most often broken: no
wall clock, no network, no process state, no filesystem, and no unseeded
randomness inside a shot build function. The project-state reader is a
filesystem API and is forbidden here; use it from a standalone script instead.

Sources: `principles/source/subjects.md#build-is-pure`; the production contract
in `AGENTS.md`.
