# Production source principles

Production source serializes production-wide settings into the engine-facing design record. It is neither a second settings document nor a place to author subject construction, motion, scene action, or editorial timing.

## Settings-only serialization {#settings-only-serialization}

Every production-source value implements an authored settings decision or derives mechanically from one. A source value that changes the intended subject, action, story, or edit belongs upstream or in its own downstream source layer instead.

Review question: which exact settings unit owns each creative value, and is every remaining transformation purely mechanical?

## Delivery identity {#delivery-identity}

Production identity, logline, target runtime, frame format, delivery mode, and required deliverables remain mutually consistent and match the authored delivery contract. Template or integration fixtures are identified as such and may not masquerade as audience content. Palette, silhouette, and scale consistency belong exclusively to the shared-visual-grammar rule.

Review question: could the engine recover the complete non-visual delivery envelope without guessing, and does no emitted field promise an unauthored result?

## Shared visual grammar {#shared-visual-grammar}

Production-wide color, silhouette, and scale values establish only the common visual grammar. Subject-specific geometry and materials remain in model source, while viewer surfaces consume the same production background rather than maintaining an independent look.

Review question: is each shared visual value defined once at production scope and reused everywhere it governs?
