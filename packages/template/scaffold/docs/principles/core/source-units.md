# TypeScript source-unit principles

Criteria that every TypeScript owner exposed through a public export and selected by an active source population answers for itself. A top-level exported type, property, or function is one owner; each selected public member of an exported type is another. Judge the selected declaration together with its initializer or body and the source-local behavior it invokes, not the enclosing export, file, or source population on average. Principles permit no exclusion.

Source-family obligations remain ordinary population coverage: they allocate the construction, transition, serialization, shot, or editorial roles the complete selected owner population owes. These principles ask whether each individual selected owner is a truthful and complete source artifact within the scope it claims.

`obligations/core/common.md#proportionate-development` does not apply to a source owner. Line count, declaration count, and implementation size do not establish whether code is complete or whether one source role received enough attention; source scope, executable behavior, types, tests, and evidence relationships do.

## Source-owner scope preservation {#source-scope-preservation}

The current source owner realizes all and only the responsibility its evidence declarations claim. It implements every cited design, settings, screenplay, brief, or source-role decision that belongs to this declaration, preserves the cited boundary and identifiers, and introduces no independent creative decision that its upstream owner never made.

Population coverage and parent cardinality do not answer this question. They can prove that some export cites every required target and that a designated owner cites exactly one parent file, but they cannot make an individual export implement the content it cites.

Review question: which cited upstream or source-role decision does this owner omit, weaken, contradict, or exceed in its actual type, value, or behavior?

When this principle fails, repair the earliest owner of the mismatch. Restore missing source behavior when the upstream decision is sound; return upstream when the source would otherwise have to invent the decision; then reread every affected export and evidence statement.

Sources: [NASA systems engineering handbook on allocation and bidirectional traceability](https://www.nasa.gov/reference/systems-engineering-handbook/); [TypeScript handbook on module exports as explicit public boundaries](https://www.typescriptlang.org/docs/handbook/2/modules.html); [ttsc on independent claim and reference coverage](https://ttsc.dev/docs/evidence/claims/)

## Source-owner substantive completion {#source-substantive-completion}

The current source owner is a complete source-layer artifact at the granularity it declares. A function implements its promised deterministic operation, a value materializes its promised state, and a type defines the usable boundary its consumers need. A deliberate thin delegation may be complete when delegation is the declaration's whole role and the called implementation remains explicit and reachable.

A placeholder, template sentinel, empty wrapper, inert constant standing in for behavior, type with no usable consumer contract, parent restatement, copied generated output, or future-work promise is not completion. Compiling without an error proves only structural admissibility; it does not make the declared source role exist.

Review question: what behavior, value, type boundary, invalid-state response, or deterministic consequence would a consumer still have to invent because this owner is only a placeholder, restatement, or partial implementation?

When this principle fails, implement or replace the source owner instead of adding evidence text. If the missing decision belongs to design, settings, screenplay, or brief authorship, repair that upstream owner first and propagate the result before returning to source.

Sources: [TypeScript handbook on functions as typed implementation boundaries](https://www.typescriptlang.org/docs/handbook/2/functions.html); [NASA systems engineering handbook on verification-ready implementation](https://www.nasa.gov/reference/systems-engineering-handbook/)
