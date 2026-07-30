# Issue 1425: deterministic film grammar

The engine owns mechanical edit diagnostics over ordered shot observations.
The EDL work in issue 1429 will supply the edited order; this issue deliberately
does not invent another timeline representation.

The analyzer measures seven families: action-axis crossing, jump cut, eyeline,
screen direction, shot size, re-establishment, and pacing. Subject collections
are sorted by stable id before analysis. Geometry, durations, and explicit
observations are the only inputs, so seed and collection order cannot affect the
result.

`styleIntent` is a narrow exception record on the shot contract. Its mapping is
one-to-one: `jump-cut` suppresses only `grammar-jump-cut`, for example. Every
remaining diagnostic states the measured fact, why it can harm the visual read,
and a concrete recovery such as keeping the prior camera half-plane or inserting
a neutral shot.

`grammarDiagnosticsToReviewNotes` connects the result to the current visual
review-note socket. Human and VLM judgments remain a later review layer rather
than being disguised as deterministic engine facts.
