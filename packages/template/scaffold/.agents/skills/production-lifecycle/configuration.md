# Production delivery decisions

Run `npx --no-install automovie routes <film|brief|library>` before selecting a design field. Its typed matrix names the canonical owner, typed input, public consumer, and authoring route for each supported capability, or the exact reason that capability is inapplicable to the selected shape. A field absent from that matrix is not made available by mentioning it in prose.

Delivery tiers, repaint adoption and requests, the dialogue generator and its speaker joins, and live soft-body admission are typed production values. Author each in governed source under its reviewed document owner and pass it directly to the runtime consumer. [Ownership](../../../README.md#ownership) owns the source and file boundary.

Read the consuming package's input types and validators before the runtime chooses a provider, actor, raster, or live solver. Validate actual input values rather than assuming a TypeScript declaration proves data received at a runtime boundary.

## Wiring and authored choices

Author a fractional production rate only as a reduced positive `frameFormat.frameRate = { numerator, denominator }` beside the exactly equal `fps` display value. Never reconstruct that identity from a decimal `fps`; the current pinned integer-only encoder must refuse an unsupported rational rate before render rather than round or substitute it.

Keep host wiring separate from production choices. A local server address, browser executable, and process environment do not decide delivered pixels, sound, timing, or reviewed creative intent. Inspect the public API before authoring the host boundary that consumes each explicit value.

Do not move a production choice out to that boundary, and do not bring a host fact onto the design record.

The namespace is identity rather than delivery. Declare a stable production identity in source when it must survive a package rename. The project's location on disk is a host fact rather than a creative or delivery decision.


| Design field | Owner and consequence |
| --- | --- |
| `renderTiers.proxy`, `renderTiers.final` | [Settings](settings.md) owns the delivery and `obligations/core/settings.md#delivery-review-condition` owns the reproducible condition. The record carries the corresponding raster scale and temporal decimation. A later visual-delivery or fidelity owner refines that same decision; do not create a second owner. A production that declares neither tier renders at the host's shipped review and delivery pair, which is a fallback rather than a declaration. |
| `repaint.generator.runtimeIdentity` | The settings `production-fidelity-tier` owner selects the provider, model, immutable version, and execution boundary for the promised delivery. [Research](research.md) supplies current capability and availability facts. The adapter must report this exact identity; it cannot select or substitute it. |
| `repaint.generator.generatorProvenance` | Settings owns the accepted cost basis and the reason this production needs an appearance rendition. |
| `repaint.executionPolicy` | The settings fidelity and external-execution owners bound attempt count, per-attempt timeout, elapsed time, cost, deterministic backoff, and retryable failure classes. The adapter reports outcomes but never widens this policy. |
| `repaint.requests` | The settings `production-visual-grammar` owner constrains the shared look and prompt language, `production-fidelity-tier` constrains preservation strength and the derived-output ceiling, and `subject-breakdown-production-scope` owns the admitted subjects and build/adopt/reuse/defer scope. The applicable design H2 owns each exact shot prompt, negative prompt, seed, strength, scalar controls, and registered structure, character-identity, costume, style, material, color, or environment references under those settings decisions. Every request retains stable addresses for its prompt, settings, design, screenplay or brief, shot, and applicable versioned continuity owner. The per-candidate selection review is not part of the request: record it against the exact observed candidate at its authored review owner. |
| `visualDeliveryLanes`, `mixedVisualDeliveryPolicy` | Use the global `visualDelivery` value only as the explicit all-deterministic or all-repainted shorthand. A mixed film declares every current timeline occurrence exactly once, including repeated shot occurrences, and reviews every actual adjacent lane crossing against the current aggregate observation. Never infer a lane from whether a repaint receipt happens to exist. |
| `sound.dialogueSynthesis` | Settings owns the audible delivery and [research](research.md) owns external support and uncertainty. The record selects the exact implemented generator, model revision, voice, inference controls, cost basis, and reasoned consumer. |
| `sound.speakerBindings` | Settings owns every audible identity and operative subject. The screenplay carries the speaker id, and the record joins a visually speaking identity to the exact compiled actor id. |
| `simulation.liveWearableSoftBodies` | The owning system H2 chooses live deterministic moving-boundary simulation. The record carries the production-wide admitted domain order and therefore its subject budget order. |

If the design record grows another value that can change delivered pixels, sound, runtime cost, or the meaning of a review, classify and route it before using it. A JSDoc sentence beside the field is not an authored owner.

## Dialogue generator adoption

Omit `sound.dialogueSynthesis` only when the production has no synthesized dialogue. A selected value names the exact provider, model, immutable revision, dtype, device, voice, and positive speed supported by the shipped adapter. The runtime does not substitute another provider or revision.

The same selection also contains `generatorProvenance`: the cost basis and a typed `dialogue-synthesis` consumer with the authored reason this production needs it. Keep credentials out of this record. The selection participates in the synthesis cache identity, and the provenance record is retained in each generated dialogue receipt, so the retained record describes the selected generation.

Repaint uses the same adoption discipline through its independent `repaint` field: exact provider and model revision, cost, reasoned consumer, no credential, and receipt-bound output identity. Dialogue and repaint remain separate consumers, but neither may invent an ephemeral provider choice outside the design record.

Declare adopted input assets with their project-relative paths and typed consumer bindings in the source owner that uses them. Record their provenance in the corresponding reviewed document. Derive deterministic geometry through source functions rather than a second asset ledger.

## Speaker identity join

Give every speaker an addressable settings owner before the screenplay uses that identity. A `sound.speakerBindings` entry maps the screenplay's exact speaker id to the exact actor id serialized by source from that settings subject. The runtime rejects blank, duplicate, unused, missing-shot, and absent-actor joins before synthesis. It never infers an actor from cast order or a similar name.

Use a binding only when the actor owns a mouth performance in the applicable compiled shots. An off-screen narrator, machine voice, or other audible identity still needs settings canon and a screenplay source, but it has no actor-mouth binding merely because it is audible.

## Live soft-body admission

Select every soft-body domain that declares an actor-bone or node-bound moving anchor or a body capsule, and select no static-only domain. The list is production-wide, so a domain may be absent from a shot that does not use it. Across all compiled shots, however, the selected id set must exactly equal the moving-boundary domain set. List order is the stable budget order shared by every shot.

The viewer refuses an unselected moving domain and a selected static domain at the first affected shot. Render preparation additionally compares the complete compiled-shot union and refuses a selected id that no shot carries. The runtime never drops a moving domain, renders it through the static path, or silently turns a stale selected id into no work.

## Repaint adoption and request population

Omit `repaint` for deterministic visual delivery. A repainted delivery selects one complete generator adoption and a non-empty `requests` population. The final-render gate requires the declared shot ids and compiled timeline shot ids to be exactly equal in both directions. A missing request cannot inherit another shot's prompt, and an extra request cannot remain as dead, apparently reviewed declaration.

Each request records the exact prompt, optional negative prompt, safe-integer seed, preservation strength in `[0, 1]`, optional scalar controls, and at least one manifest-registered role-specific reference. Reference roles are `structure`, `character`, `costume`, `style`, `material`, `color`, and `environment`; `character` means identity, so costume and material never collapse into it. One asset may serve distinct reviewed roles, but it must never stand as canonical guidance for every role, and the same role-path pair is duplicate.

`structure` is reference guidance for the derived appearance, not an authority transfer. Deterministic source controls remain the only truth for geometry, articulation, motion, contact, camera, timing, clearance, and building topology, and the receipt continues to state `structuralAuthority: "deterministic-source-only"`.

The scaffold has no repaint command or stored candidate service. If the production requests repaint, author its supported provider call and consumer in source after reviewing the package API and external-execution authority. A successful generation produces a candidate rather than an accepted delivery; selection requires its actual observation.

Do not pre-author passing candidate observations. After inspecting a candidate and playing its applicable complete sequence, record its exact identity, source basis, structural observation, and continuity observation at the reviewed owner. Changing a candidate or its source invalidates that judgment.

Declare the current sequence baseline separately from its observed result. Record the ordered occurrence set, current compile and timeline fingerprints, exact baseline address/version/scope/intended deltas, playback artifact/runtime/context, terminal status, and all five independent verdicts. Preserve failed, unsupported, and not-run truth; only a current completed five-pass observation whose baseline exactly equals the separate current declaration authorizes a film containing any repaint lane. Selection, reversal, or any baseline-field change stales the old observation. A one-shot repaint film still records one member. Finalization records the exact member and observation digests and never substitutes deterministic pixels for a missing repaint source.

A runtime consumer must not override authored prompt, seed, strength, control, provider, model, reference, budget, or review values. Change those values only at their upstream owner and exact config serialization. Every attempt remains immutable, valid output remains a candidate until explicit selection, and a selection refuses a candidate whose source, generator adoption, request, policy, or evidence addresses no longer match current configuration.

A repainted film request must carry a non-null versioned continuity address and the matching full-sequence playback review. A non-narrative library or bounded brief instead declares the film-only continuity population inapplicable with `null` in both places. Final film publication refuses the first form when it is missing; non-narrative verification refuses invented film-continuity evidence while preserving the same candidate and selection checks.

The adapter returns bytes, metered cost, and its actual runtime identity. It does not choose the generator or retry policy. Attempt timeout and each deterministic backoff must fit the host timer's `2,147,483,647` millisecond maximum; larger authored delays are refused rather than silently clamped. Only `timeout`, `rate-limit`, `transport`, `provider-refusal`, and `internal` may appear in `retryableFailures`; invalid output, cancellation, stale input, and exhausted budget are terminal hard stops rather than retry grants. Before external execution the service validates the complete reviewed adoption ; after execution it rejects any provider, model, version, or execution-boundary mismatch. Accepted receipt v4 retains request and attempt identity, execution instants and policy, cost, consumer reason, stable evidence addresses, complete per-shot request, structural controls and references, adapter identity, output digest, and `structuralAuthority: "deterministic-source-only"`. Generator provenance participates in the rendition path identity, so a generation input change cannot reuse an older output as current.

A repaint is derived appearance even when it is the audience-visible final delivery. It cannot become evidence for geometry, articulation, motion, contact, camera, timing, clearance, building topology, or a fidelity claim above the deterministic prototype. Correct those facts in settings, design, or source and recapture deterministic evidence; never back-derive them from the rendition.

## Verification

Run the configured source lint after editing a governed owner, execute the affected source consumer, and inspect the resulting output under [Review verification](../review-verification/SKILL.md). Treat a runtime refusal as a disagreement among the authored owner, typed input, and actual result. Correct the earliest owner and propagate the change instead of weakening a validator or deleting the selected value.
