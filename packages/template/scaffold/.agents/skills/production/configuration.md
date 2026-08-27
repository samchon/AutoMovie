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
| `render.proxy`, `render.final` | Authored serialization | [Settings](settings.md) owns the delivery and `obligations/settings.md#delivery-review-condition` owns the reproducible condition. The config records the corresponding scale and temporal decimation. A later visual-delivery or fidelity owner refines that same decision; do not create a second owner here. |
| `visual.repaint.generator.runtimeIdentity` | Authored serialization | The settings `production-fidelity-tier` owner selects the provider, model, immutable version, and execution boundary for the promised delivery. [Research](research.md) supplies current capability and availability facts. The adapter must report this exact identity; it cannot select or substitute it. |
| `visual.repaint.generator.generatorProvenance` | Authored serialization | Research owns the source, license or terms location, and review date. The settings fidelity owner owns the accepted cost basis and reason this production needs an appearance rendition. The config carries the joined adoption without a credential. |
| `visual.repaint.requests` | Authored serialization | The settings `production-visual-grammar` owner constrains the shared look and prompt language, `production-fidelity-tier` constrains preservation strength and the derived-output ceiling, and `subject-breakdown-production-scope` owns the admitted subjects and build/adopt/reuse/defer scope. The applicable design H2 owns each exact shot prompt, negative prompt, seed, strength, scalar controls, and registered structure, character-identity, costume, style, material, color, or environment references under those settings decisions. |
| `sound.dialogueSynthesis` | Authored serialization | Settings owns the audible delivery and [research](research.md) owns external support and uncertainty. The config selects the exact implemented generator, model revision, voice, inference controls, source, license, terms review date, cost basis, and reasoned consumer. |
| `sound.speakerBindings` | Authored serialization | Settings owns every audible identity and operative subject. The screenplay carries the speaker id, and the config joins a visually speaking identity to the exact compiled actor id. |
| `simulation.liveWearableSoftBodies` | Authored serialization | The owning system H2 chooses live deterministic moving-boundary simulation. The config records the production-wide admitted domain order and therefore its subject budget order. |

If the configuration exposes another value that can change delivered pixels, sound, runtime cost, external rights, or the meaning of a review, classify and route it before using it. A JSDoc sentence in the config is not an authored owner.

## Dialogue generator adoption

Leave `dialogueSynthesis` as `null` only when the production has no synthesized dialogue. A selected value names the exact provider, model, immutable revision, dtype, device, voice, and positive speed supported by the shipped adapter. The runtime does not substitute another provider or revision.

The same selection also contains `generatorProvenance`: a stable source address, license identifier or terms location, `YYYY-MM-DD` terms review date, cost basis, and a typed `dialogue-synthesis` consumer with the authored reason this production needs it. Keep credentials out of this record. The selection participates in the synthesis cache identity, and the provenance record is retained in each generated dialogue receipt, so a changed license, terms review, cost basis, consumer reason, or source is a changed adoption rather than invisible metadata.

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

Invoke `npm run repaint -- --shot <authored-shot-id>`; the command chooses only that reviewed request. It accepts no prompt, seed, strength, control, provider, model, or reference override. To reroll or change appearance, revise the upstream owner, propagate the exact config value, compile when source ownership changed, and repaint again.

The adapter returns bytes and its actual runtime identity. It does not choose the generator. Before external execution the service validates the complete reviewed adoption; after execution it rejects any provider, model, version, or execution-boundary mismatch. Accepted receipt v3 retains the source, license, terms review, cost, consumer reason, complete per-shot request, structural controls and references, adapter identity, output digest, and `structuralAuthority: "deterministic-source-only"`. Generator provenance participates in the rendition path identity, so a rights, terms, cost, source, or consumer change cannot reuse an older output as current.

A repaint is derived appearance even when it is the audience-visible final delivery. It cannot become evidence for geometry, articulation, motion, contact, camera, timing, clearance, building topology, or a fidelity claim above the deterministic prototype. Correct those facts in settings, design, or source and recapture deterministic evidence; never back-derive them from the rendition.

## Verification

Run `npm run lint:source` after every configuration edit. Run `npm run compile` after changing a decision serialized into source, then exercise the affected `npm run render`, `npm run preview`, `npm run turntable`, or `npm run repaint -- --shot <id>` path. A final repainted render additionally requires one current receipt per compiled shot under the current adoption and exact request. Treat a configuration refusal as an inconsistency among the authored owner, config serialization, compiled result, and receipt. Correct the earliest owner and propagate the change instead of weakening the parser or deleting the selected value.
