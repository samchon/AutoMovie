# Public contracts

## Additive contract surface {#additive-contract-surface}

<!-- @evidence requirements/05-extensibility.md#additive-typed-growth Defines discriminated public records that consumers can extend without reverse-engineering generated output. -->

`@automovie/interface` owns serializable subjects, motions, worlds, production records, diagnostics, and render contracts. New behavior enters through a named union arm or optional versioned record whose consumers are exhaustively checked.

## Audible-world records {#audible-world-records}

<!-- @evidence requirements/09-audible-world.md#declared-sound-performance Gives emitted sound, dialogue, and derived performance a typed production identity and film-clock placement. -->

Production sound records name cues, dialogue, emitters, listeners, frames, and deterministic derived facts. A model the engine does not support remains absent or explicitly diagnosed rather than encoded as an undocumented number.

## Incremental film records {#incremental-film-records}

<!-- @evidence requirements/10-incremental-film.md#honest-partial-editing Represents every film interval as a shot or a declared timed omission and carries caption intervals explicitly. -->

The canonical film timeline preserves ordered shot entries and declared omissions with exact durations. Review and final delivery can distinguish unfinished work from an unaccounted hole without rewriting source order.

## Stable diagnostic identity {#stable-diagnostic-identity}

<!-- @evidence requirements/11-diagnostics-and-knowledge.md#named-behavioral-refusals Gives every refusal a stable typed envelope that downstream clients can preserve and present. -->

Diagnostics expose code, category, phase, target, path, and a corrective message in one shared record. Producers may add behavior only through the closed diagnostic identity owned by the interface contract.
