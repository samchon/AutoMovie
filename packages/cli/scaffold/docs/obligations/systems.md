# System obligations

These roles are distributed across lighting, environment, effects, simulation, sound, service, and other system-design H2s. A system owns coupled process behavior, not the model, space, material, instance, or motion fact it consumes. Narrative or brief prose owns audience meaning, and shot source owns its timed realization.

## Ownership and interfaces {#system-ownership-interfaces}

The population names each system's inputs, outputs, dependencies, affected owners, authority, and ordering relative to other systems.

Review question: which state can two systems both write, or which required input has no authoritative owner?

Sources: [NASA Systems Engineering Handbook on interface definition and allocated responsibility](https://www.nasa.gov/reference/systems-engineering-handbook/)

## State, clock, and determinism {#system-state-clock}

The population defines initial state, clock, sampling, seed, update order, checkpoint/seek behavior, and terminal state for every time-varying system.

Review question: can an arbitrary requested time be reproduced without hidden history or an unrecorded random choice?

Sources: [W3C Web Animations on stateless, arbitrary-time timing evaluation](https://www.w3.org/TR/web-animations-1/#timing-model)

## Budget and degradation {#system-budget-degradation}

The population allocates bounded work, admission limits, representation tiers, fallbacks, and explicit refusal when the requested result exceeds the prototype ceiling.

Review question: what exact limit changes fidelity, omits work, or refuses the request, and is that consequence visible?

Sources: [NASA Systems Engineering Handbook on requirements verification and validation](https://www.nasa.gov/reference/systems-engineering-handbook/)

## System review set {#system-review-set}

The population defines finite state, interaction, stress, failure, and observation cases that distinguish correct system behavior from a successful render call.

Review question: which reproducible case falsifies each interface, temporal, and budget promise?

Sources: [NASA on a verification matrix with method, level, and responsible owner](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)
