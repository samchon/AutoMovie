# Compilation

The production compiler is an atomic fence with an ordered scope ladder, and each scope checks everything the scope before it checks. Invoke it through the scaffold compile command or `compileAutoMovieProduction`.

- `design`: validate manifest, design shape, ranges, identity, and references without reading source or materializing derived files.
- `source`: additionally materialize primitive models and compact formation runtimes; bind each `defineShot` registration to its design contract; execute its thin stage/block/performance program through the host engine pipeline; validate actor/object/formation motion, bounded fixed-step effects, scenes, and shots; derive contract realizations; and enforce generated ownership.
- `review`: additionally require every review in the derived queue to be complete and fresh.
- `final`: additionally require a current aggregate render manifest and matching byte/media receipt. The ledger is mandatory even when every listed deliverable is optional; `required` controls which declared ids must be present, not whether final delivery needs provenance.

What a review owes is derived from the current graph, never authored. At `review` and `final` scope the compiler asks whether the evidence exists: a shot must hold every frame-and-pass pair its own contract's `reviewFrames` declare, and every model the compile actually consumed must hold the turntable set an asset review is judged from. Both are read at the target's current render-target fingerprint, so a frame drawn before that target last moved is on disk and does not count. What is missing comes back as `review-evidence-missing`, naming the target and the exact views it still owes.

The compiler stops there on purpose. Whether the frames are any good is settled by opening them and written into the evidence citation on the source that claims the unit is realized; no diagnostic decides that and no ledger records it.

The review scopes also add a check with no `source` form at all. An active screenplay scene that no required acceptance scenario cites is refused at `review` and `final` as `screenplay-scene-unobserved`, and is not reported at `source` in any category, because a compiled realization proves the film covers the scene while only a required acceptance scenario proves somebody looked at it. Read [Contract targets](../contract-targets.md) for the citation that discharges it.

Any error returns `success:false` and materializes nothing. Warnings are explicit but do not block. Diagnostics name a stable code, phase, target, owning path, and exact correction.

Severity belongs to the invocation, not to the code. A diagnostic warns where the current gate cannot yet require the fact and errors where it can, so the same code changes category as you climb. `screenplay-scene-unrealized` and `film-runtime-mismatch` warn at `source`, where an unfinished film is the expected state, and block at `review` and `final`, where it is not. The `generated-*` ownership codes warn during a compile that is about to rewrite the tree anyway and block during a read-only lint, which reports the same disagreement and is deliberately unable to repair it. Read the category on the diagnostic you were actually returned; a severity remembered from another scope is not a fact about this one.

Source output never self-certifies the contract. The compiler measures named-state predicates at the opening and closing times, event predicates at source-selected samples inside authoritative windows, camera subjects at review frames, compact formation count/chunk/bounds/hero invariants, and the exact one-to-one binding between bounded effect cues and compiler-owned streams. Passing realizations are written under `generated/<production>/realizations`; failure blocks every generated write.

Every scope above `design` opens the derived-artifact ledger first, in the `project` phase, before a single source module is linked. A ledger the project manifest selects must sit at its canonical path, read as intact JSON, and still be current: each record's generator and declared inputs must hash to the recorded basis, the resident output bytes must match their recorded digest and decode under the declared encoding, and the derived namespace must not also be claimed by the external asset ledger. Each of those failures is an error under its own `derived-artifact-*` code, and each stops the compile before source runs, because compilation never invokes a generator and never repairs a stale result. Read this document for the ledger and the explicit generation command.

The input fingerprint includes compiler identity and protocol, ordered design, normalized source bytes, declared assets, and the derived-artifact ledger with each record's generator source, declared inputs, and output bytes. A derived path it could not read joins the fingerprint as absent-or-unsafe rather than being skipped, so deleting a file the gate refused does not make the compile current. The fingerprint excludes generated, review, and render bytes. Unchanged input produces the same fingerprint and generated bytes; an unchanged compile must not churn file mtimes.

The final scope trusts neither manifest labels nor old hashes. The renderer-owned aggregate receipt must match the current render manifest and every current file byte. AutoMovie decodes PNG and WebVTT output and parses MP4 tracks again to verify raster, frame count, frame rate, runtime, codec, channels, and sample rate as applicable. Caption readability produces a verdict only when the production selected a versioned profile; without one, compilation preserves measurements and a `not-run` reason instead of applying hidden default thresholds. Read `AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION` from the package API before selecting the installed algorithm and Unicode/ICU revision. A different requested segmentation stays `not-run` as unsupported and is never evaluated through a fallback.

Use the narrowest scope that answers the current question. Exploration should not fake review completion, and final delivery should not bypass it.

## A clean compile is not a look

Compilation proves that the records agree with each other. It proves nothing about what the production looks like, and every defect that survived a full production survived a clean compile first.

A clean source compile is the precondition for evidence, not a substitute for it: `npm run turntable` and `npm run preview` refuse against a stale compile, and the evidence citation reports evidence as missing until the frames exist. Compile, then look, then record the verdict.
