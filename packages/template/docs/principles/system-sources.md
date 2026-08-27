# System source principles

System source evaluates a reviewed coupled process without acquiring authority over the owners it consumes.

## Design-owned process {#system-source-design-ownership}

Every exported owner realizes one reviewed system document and introduces no unreviewed input, output, authority, effect, clock, or fallback.

Review question: can every emitted system fact be traced to exactly one reviewed H2?

Sources: [NASA on bidirectional requirement traceability](https://www.nasa.gov/reference/system-engineering-handbook-appendix/)

## Pure explicit evaluation {#system-source-explicit-evaluation}

Evaluation depends only on declared state, time, seed, dependencies, and parameters and publishes deterministic outputs without hidden globals or update order.

Review question: do equal inputs and an arbitrary requested time produce equal output without prior samples?

Sources: [W3C Web Animations on stateless timing and constant-time seeking](https://www.w3.org/TR/web-animations-1/#timing-model)

## Failure and budget are observable {#system-source-failure-budget}

Invalid inputs, unavailable dependencies, non-convergence, budget overflow, and unsupported fidelity return bounded diagnostics or declared degradation rather than partial silent output.

Review question: does every failure or degradation identify its owner, limit, and affected output?

Sources: [NASA Systems Engineering Handbook on verification and validation results](https://www.nasa.gov/reference/systems-engineering-handbook/)
