# Motion obligations

These roles must be covered across the motion-design H2 population. They define shared transition policy whose distinct contributions may be divided among motion files, rather than forcing every motion to repeat every role.

## Time base {#time-base}

The motion designs consume the settings time unit and define the production-wide mapping, clamping, and sampling convention used by normalized progress functions.

Review question: how does any render time map to one deterministic motion phase?

Sources: [Web Animations time values and timing model](https://www.w3.org/TR/web-animations-1/#timing-model)

## Contact policy {#contact-policy}

The motion designs establish how contact targets, penetration, separation, and tolerance are measured for motions that touch or remain planted on another reviewed design target.

Review question: which numeric condition distinguishes maintained contact from visible drift or penetration?

Sources: [NIST Technical Note 1297](https://www.nist.gov/pml/nist-technical-note-1297)

## Composition and interruption {#composition-interruption}

The motion designs state whether concurrent motions may compose, which property wins on conflict, and what state is used when a motion is interrupted or followed by another.

Review question: what exact state crosses a boundary between two motions that address the same model property?

Sources: [Web Animations composite operations](https://www.w3.org/TR/web-animations-1/#effect-composition)

## Motion review set {#motion-review-set}

The motion designs define the instants, spatial views, state samples, and tolerances used to review paths and contacts independently of screenplay interpretation.

Review question: which finite observations falsify the transition rather than merely show that it ran?

Sources: [Web Animations timing model](https://www.w3.org/TR/web-animations-1/#timing-model); [NASA systems engineering handbook on verification](https://www.nasa.gov/reference/systems-engineering-handbook/)
