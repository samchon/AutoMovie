# Deterministic runtime

## Deterministic execution {#deterministic-execution}

<!-- @evidence requirements/03-determinism.md#same-inputs-same-artifact Owns fixed-clock sampling, ordered math, validation, and lowering from declared inputs to canonical artifacts. -->

`@automovie/engine` implements pure TypeScript geometry, motion, physics, analysis, staging, and film lowering. Consumers pass clocks and declared state explicitly, and validation rejects inputs whose result would depend on an undefined order or frame.

## Bounded ensemble execution {#bounded-ensemble-execution}

<!-- @evidence requirements/08-ensemble-and-scale.md#explicit-bounded-multiplicity Keeps ensemble layouts compact and makes expensive populations visible to budget gates. -->

Formations and instance sets retain compact layout records, stable seeds, bounds, representative models, and explicit hero subsets. Algorithms report or refuse work beyond their declared subject, sample, or memory budgets.
