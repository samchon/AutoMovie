# Production configuration

`automovie.config.ts` is the third authored project surface beside `docs/` and `src/`. Read it before source authorship and whenever delivery, appearance, dialogue, or simulation decisions change. The evidence graph does not select this TypeScript file as an authored-document host: the decision remains in its settings, research, or design H2 owner, and this file serializes that reviewed decision into the runtime.

Read the shipped [`automovie.config.ts`](../../../automovie.config.ts) and its executable schema in [`scripts/productionConfiguration.ts`](../../../scripts/productionConfiguration.ts) together. TypeScript catches ordinary shape drift, while the runtime parser rejects untyped, stale, or injected values before it can choose a provider, actor, render tier, or live solver.

## Wiring and authored choices

Do not turn fixed harness wiring into production prose. Do not hide a production choice among wiring values.

| Field | Kind | Owner and consequence |
| --- | --- | --- |
| `productionId` | Wiring | Project scripts use the stable production namespace already selected by the repository. |
| `capture.browser` | Wiring | Local capture launch wiring. It does not decide what the production delivers. |
| `viewer.host`, `viewer.basePath` | Wiring | Local viewer-server addresses. They are not audience access, camera, or delivery choices. |
| `render.proxy`, `render.final` | Authored serialization | [Settings](settings.md) owns the delivery and `obligations/core/settings.md#delivery-review-condition` owns the reproducible condition. The config records the corresponding scale and temporal decimation. A later visual-delivery or fidelity owner refines that same decision; do not create a second owner here. |
| `visual.repaint.generator.runtimeIdentity` | Authored serialization | The settings `production-fidelity-tier` owner selects the provider, model, immutable version, and execution boundary for the promised delivery. [Research](research.md) supplies current capability and availability facts. The adapter must report this exact identity; it cannot select or substitute it. |
| `visual.repaint.generator.generatorProvenance` | Authored serialization | Research owns the source, license or terms location, and review date. The settings fidelity owner owns the accepted cost basis and reason this production needs an appearance rendition. The config carries the joined adoption without a credential. |
| `visual.repaint.executionPolicy` | Authored serialization | The settings fidelity and external-execution owners bound attempt count, per-attempt timeout, elapsed time, cost, deterministic backoff, and retryable failure classes. The adapter reports outcomes but never widens this policy. |
| `visual.repaint.requests` | Authored serialization | The settings `production-visual-grammar` owner constrains the shared look and prompt language, `production-fidelity-tier` constrains preservation strength and the derived-output ceiling, and `subject-breakdown-production-scope` owns the admitted subjects and build/adopt/reuse/defer scope. The applicable design H2 owns each exact shot prompt, negative prompt, seed, strength, scalar controls, and registered structure, character-identity, costume, style, material, color, or environment references under those settings decisions. Every request retains stable addresses for its prompt, settings, design, screenplay or brief, shot, and applicable versioned continuity owner. Its selection review stays `null` until an actual candidate exists, then names that candidate's exact attempt id and output digest beside the post-playback observation used only to select or reverse to it. |
| `sound.dialogueSynthesis` | Authored serialization | Settings owns the audible delivery and [research](research.md) owns external support and uncertainty. The config selects the exact implemented generator, model revision, voice, inference controls, source, license, terms review date, cost basis, and reasoned consumer. |
| `sound.speakerBindings` | Authored serialization | Settings owns every audible identity and operative subject. The screenplay carries the speaker id, and the config joins a visually speaking identity to the exact compiled actor id. |
| `simulation.liveWearableSoftBodies` | Authored serialization | The owning system H2 chooses live deterministic moving-boundary simulation. The config records the production-wide admitted domain order and therefore its subject budget order. |

If the configuration exposes another value that can change delivered pixels, sound, runtime cost, external rights, or the meaning of a review, classify and route it before using it. A JSDoc sentence in the config is not an authored owner.

## Dialogue generator adoption

Leave `dialogueSynthesis` as `null` only when the production has no synthesized dialogue. A selected value names the exact provider, model, immutable revision, dtype, device, voice, and positive speed supported by the shipped adapter. The runtime does not substitute another provider or revision.

The same selection also contains `generatorProvenance`: a stable source address, license identifier or terms location, `YYYY-MM-DD` terms review date, cost basis, and a typed `dialogue-synthesis` consumer with the authored reason this production needs it. Keep credentials out of this record. The selection participates in the synthesis cache identity, and the provenance record is retained in each generated dialogue receipt, so a changed license, terms review, cost basis, consumer reason, or source is a changed adoption rather than invisible metadata.

The terms date must be no later than the UTC day on which synthesis begins. Configuration preflight refuses a future date before external execution, and receipt v6 retains that exact generation instant so a resumed cache is checked by the same rule. Calendar canonicalization remains independent of the wall clock; do not invent a freshness duration here.

Repaint uses the same adoption discipline through its independent `visual.repaint` field: exact provider and model revision, source, license and reviewed terms, cost, reasoned consumer, no credential, and receipt-bound output identity. Dialogue and repaint remain separate consumers, but neither may invent an ephemeral provider choice outside this configuration.

Register every distributable input byte in [`automovie/assets.json`](../../../automovie/assets.json) with its source, license, original and current digest, processing, and reasoned consumer. The dialogue generator record does not replace that asset ledger, and the ledger does not replace generator provenance. Compiler-owned deterministic outputs belong in `automovie/derived-artifacts.json`; external or nondeterministically generated inputs and renditions do not.

## Speaker identity join

Give every speaker an addressable settings owner before the screenplay uses that identity. A `speakerBindings` entry maps the screenplay's exact speaker id to the exact actor id serialized by source from that settings subject. The runtime rejects blank, duplicate, unused, missing-shot, and absent-actor joins before synthesis. It never infers an actor from cast order or a similar name.

Use a binding only when the actor owns a mouth performance in the applicable compiled shots. An off-screen narrator, machine voice, or other audible identity still needs settings canon and a screenplay source, but it has no actor-mouth binding merely because it is audible.

## Live soft-body admission

Select every soft-body domain that declares an actor-bone or node-bound moving anchor or a body capsule, and select no static-only domain. The list is production-wide, so a domain may be absent from a shot that does not use it. Across all compiled shots, however, the selected id set must exactly equal the moving-boundary domain set. List order is the stable budget order shared by every shot.

The viewer refuses an unselected moving domain and a selected static domain at the first affected shot. Render preparation additionally compares the complete compiled-shot union and refuses a selected id that no shot carries. The runtime never drops a moving domain, renders it through the static path, or silently turns a stale selected id into no work.

## Repaint adoption and request population

Leave `visual.repaint` as `null` for deterministic visual delivery. A repainted delivery selects one complete generator adoption and a non-empty `requests` population. The final-render gate requires the configured shot ids and compiled timeline shot ids to be exactly equal in both directions. A missing request cannot inherit another shot's prompt, and an extra request cannot remain as dead, apparently reviewed configuration.

Each request records the exact prompt, optional negative prompt, safe-integer seed, preservation strength in `[0, 1]`, optional scalar controls, and at least one manifest-registered role-specific reference. Reference roles are `structure`, `character`, `costume`, `style`, `material`, `color`, and `environment`; `character` means identity, so costume and material never collapse into it. One asset may serve distinct reviewed roles, but it must never stand as canonical guidance for every role, and the same role-path pair is duplicate.

`structure` is reference guidance for the derived appearance, not an authority transfer. Deterministic source controls remain the only truth for geometry, articulation, motion, contact, camera, timing, clearance, and building topology, and the receipt continues to state `structuralAuthority: "deterministic-source-only"`.

Invoke `npm run repaint -- reroll --shot <authored-shot-id>` to create a new request identity. A successful execution stores a candidate but does not make it current. Retry the unchanged request with `npm run repaint -- retry --shot <id> --request <request-uuid>`, select a reviewed candidate with `npm run repaint -- select --shot <id> --attempt <attempt-uuid>`, and reverse to an earlier reviewed candidate with the corresponding `reverse` operation. Retry is legal only when the latest terminal attempt failed in a class that the unchanged policy still marks retryable; a successful or non-retryable terminal attempt closes that request, so use reroll for another candidate. Retry never changes prompt, seed, controls, references, generator, policy, or evidence owners; reroll is the operation that creates a new request identity. Selection and reversal use the configured review reason and structural or continuity observations and invoke no generator.

Keep `selectionReview` as `null` during reroll and retry. After inspecting the resulting candidate and playing the applicable complete sequence, set `candidateAttemptId` and `candidateOutputDigest` to the receipt's exact values and author the reason, structural observation, and applicable continuity observation. The selection command refuses a review written for any other attempt or output, and final publication rechecks the same bindings against the active receipt. Never copy one candidate's review onto another candidate or pre-author passing observations before bytes exist.

The command accepts no prompt, seed, strength, control, provider, model, reference, budget, or review override. Change those values only at their upstream owner and exact config serialization. Every attempt remains immutable, valid output remains a candidate until explicit selection, and a selection refuses a candidate whose source, generator adoption, request, policy, or evidence addresses no longer match current configuration.

A repainted film request must carry a non-null versioned continuity address and the matching full-sequence playback review. A non-narrative library or bounded brief instead declares the film-only continuity population inapplicable with `null` in both places. Final film publication refuses the first form when it is missing; non-narrative verification refuses invented film-continuity evidence while preserving the same candidate and selection checks.

The adapter returns bytes, metered cost, and its actual runtime identity. It does not choose the generator or retry policy. Attempt timeout and each deterministic backoff must fit the host timer's `2,147,483,647` millisecond maximum; larger authored delays are refused rather than silently clamped. Only `timeout`, `rate-limit`, `transport`, `provider-refusal`, and `internal` may appear in `retryableFailures`; invalid output, cancellation, stale input, and exhausted budget are terminal hard stops rather than retry grants. Before external execution the service validates the complete reviewed adoption and future-date boundary; after execution it rejects any provider, model, version, or execution-boundary mismatch. Accepted receipt v4 retains request and attempt identity, execution instants and policy, source, license, terms review, cost, consumer reason, stable evidence addresses, complete per-shot request, structural controls and references, adapter identity, output digest, and `structuralAuthority: "deterministic-source-only"`. Generator provenance participates in the rendition path identity, so a rights, terms, cost, source, or consumer change cannot reuse an older output as current.

A repaint is derived appearance even when it is the audience-visible final delivery. It cannot become evidence for geometry, articulation, motion, contact, camera, timing, clearance, building topology, or a fidelity claim above the deterministic prototype. Correct those facts in settings, design, or source and recapture deterministic evidence; never back-derive them from the rendition.

## Verification

Run `npm run lint:source` after every configuration edit. Run `npm run compile` after changing a decision serialized into source, then exercise the affected `npm run render`, `npm run preview`, `npm run turntable`, or explicit `npm run repaint -- reroll|retry|select|reverse ...` path. A final repainted render additionally requires one current receipt per compiled shot under the current adoption and exact request. Treat a configuration refusal as an inconsistency among the authored owner, config serialization, compiled result, and receipt. Correct the earliest owner and propagate the change instead of weakening the parser or deleting the selected value.
