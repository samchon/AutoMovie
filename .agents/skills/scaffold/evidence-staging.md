# Production evidence staging

Read the complete production declaration in `lint.config.ts`, every target and host involved, and the applicable authoring phase document before changing a stage or evidence statement. `@automovie/evidence` owns reusable graph mechanics; the generated project has no second local configuration source.

## States

Every layer is `disabled`, `draft`, `evidence`, or `review`.

- `disabled` means the layer currently has no governed hosts and its shared claims do not run. The selected kind decides whether the layer is forbidden or merely not begun.
- `draft` means the layer is applicable and owns non-empty hosts, but shared evidence coverage is off while the author completes the first version.
- `evidence` enables the layer's shared and production-specific claims without requiring review fingerprints.
- `review` keeps those claims active and requires a current substantive review for every acknowledgement and exclusion.

An applicable layer moves only `disabled -> draft -> evidence -> review`. Leave completed layers in `review` so later target edits reopen affected checks. Do not return incomplete authored hosts to `disabled`, and do not leave a host behind when its layer is disabled.

`draft` contains no evidence tags. Preserve citation intent in ordinary prose or working notes, then author the complete evidence batch only after the layer passes its first-version audits and moves to `evidence`. This keeps partial annotations from looking like partial completion.

The authored-unit topology is closed. Outside an optional H1 title, settings, research, model, space, material, instance, motion, and system hosts use only anchored H2 units; storyline, scenario, script, and brief hosts use only anchored H2/H3/H4 units. Any other heading depth fails instead of hiding an ungoverned decision.

## Relationship types

- A principle is an item-by-item file checklist. Every selected Markdown file answers every applicable H2, exclusions are refused, and one strong unit cannot cover a weak unit elsewhere in the file.
- `obligations/common.md` is an item-by-item unit checklist. Every governed settings, research, model, space, material, instance, motion, and system H2 and every film or brief H2/H3/H4 answers every item directly; exclusions are refused.
- Discovery is ordinary coverage over one complete authored H2 population, never a per-H2 checklist. Every authored H2 population answers `discovery/common.md`; settings adds `settings.md`, film storylines add `films.md` and `storylines.md`, scenarios add `films.md` and `scenarios.md`, script adds `films.md` and `scripts.md`, and briefs add `briefs.md`. Research and design branches answer common discovery only, and H3/H4 do not repeat it. A retained result identifies its earliest owner and current realization. A true no-result receives one population-wide exclusion naming the concrete inputs, risks, and sufficient existing owners; deferral and an audit assertion are invalid exclusions.
- A layer obligation is distributed coverage. Every H2 that materially realizes a role may cite it, and the complete population accounts for every role. Settings, model, space, material, instance, system, and storyline roles permit no exclusion. Motion roles permit one population-wide exclusion only where the target's own condition is absent from the complete production.
- Settings, model, space, material, instance, motion, and system references are foundation coverage. A host cites only the units it uses. A target no host in that claim population uses may receive one concrete population-wide exclusion only where the configured reference permits it. Research has one stricter bridge: every reviewed research H2 is interpreted by a settings H2, and later layers cite that settings owner.
- Film lineage is exact. Every scenario and screenplay H2/H3/H4 cites one matching same-level parent, every parent has one matching child, and exclusions are refused. `lint.config.ts` also compares physical anchor order and nesting.
- Design-source ownership is exact per selected export: model branches require a concrete exported class and select every exported type; motion branches select every exported function and property; space, material, instance, and system branches select every exported type, function, and property. Each selected export cites exactly one design file. More than one export may implement the same design; source-principle and design-unit coverage is distributed across the complete branch population. Each shot or acceptance export likewise cites one screenplay scene or brief shot, and the complete source population covers every such parent.

An omission from one host is not an exclusion. `@evidenceExclude` says no host in the complete claim population owes the target. Never cite and exclude the same target in one population, use one host as a catalogue for all targets, or use a generic reason to hide missing authored work.

## Tags

Put file-level principle answers in one HTML comment before the first H1. Put common obligations, distributed roles, foundations, lineage, and package-claim evidence directly under the exact H2, H3, or H4 that realizes them unless that claim deliberately selects a file host.

```text
@evidence path/file.md#anchor What exact fact, decision, transition, or observation the host realizes.
@evidenceExclude path/file.md#anchor Why no host in the complete population owes the target.
@evidenceReview path/file.md#anchor #fingerprint What target-host relationship was checked.
@evidenceExcludeReview path/file.md#anchor #fingerprint What population boundary was checked.
```

Use configured roots such as `settings/...`, `models/...`, `motions/...`, `storylines/...`, `scenarios/...`, `script/...`, shared `discovery/...`, `principles/...`, and `obligations/...`, or the root declared by a production-specific claim. Do not prefix a target with `docs/` unless that claim's root requires it. Every Markdown target unit has a stable explicit anchor.

A reason names the host event, decision, limit, transition, implementation, or observable result that would be false without the target. A target-name paraphrase, `uses this setting`, `implements this rule`, and a copied reason are not evidence.

## Transitions

Move a layer from `draft` to `evidence` only after the full layer has a complete first version, stable anchored topology and ordered files, no placeholders, a manual scope and omission audit, its applicable discovery searches and result classification, and truthful unit-by-unit answers to every common obligation. Settings additionally completes planned-delivery backcast and operative-subject accounting. Commit that coherent draft before changing the state.

Move the layer to `review` only after all shared and production-specific claim batches are complete and the production source lint is clean. Commit that evidence state before review. Review each relationship independently under [Review](review.md), copy only compiler-issued fingerprints, and compile again.

A child may enter `draft` only after every direct parent is in `review`. Research, when present, is an additional reviewed parent of authored documents. Shots wait for reviewed screenplay or brief and for the reviewed source corresponding to every active model, space, material, instance, motion, and system branch. Production source waits for settings. Film source waits for production source and shots.

`@automovie/evidence` checks non-empty host populations, required anchors, named source owners, production-kind exclusions, and exact narrative identities from the declaration before lint. Keep every project-specific selector and additive claim in `lint.config.ts` rather than another local configuration file. Preserve the typed declaration, additive `claims`, layer grouping, host-independent ordering, and mixed-state tests.

## Diagnostics

A compiler diagnostic is a question about the artifact, not an instruction to add a tag.

1. Stop the current evidence batch and any downstream work behind its gate.
2. Read the full diagnostic, complete host, complete target with selected descendants, config, and necessary upstream and downstream context.
3. State the intended semantic relationship without relying on the existing annotation.
4. Compare plausible defects in target, host, ownership, hierarchy, statement or placement, claim population or cardinality, and compiler behavior.
5. Fix the earliest actual owner and every affected dependant.
6. Reread the repaired scopes literally before writing evidence or resuming the batch.

Rewrite false or shallow content. Split, move, rename, merge, or replace a target whose scope is wrong. Correct only the tag when the content relationship already holds. Change config only when its intended population, stage, cardinality, exclusion, or implementation is itself wrong.

Never clear a diagnostic with exaggerated evidence, copied reviews, blanket exclusions, filler, path shuffling, stage reduction, weakened populations, invented fingerprints, or a package exception. When `obligations/common.md#evidence-content-conformance` fails, perform its halt and repair before retaining any acknowledgement.

## Production-specific claims

Classify a work rule through [Production-specific contract](work-specific.md) before configuring it. The exact shared inventory reserves `docs/discovery`, `docs/principles`, and `docs/obligations`. Put production-only selected-file conditions under `docs/production-principles`, production-only distributed roles under `docs/production-obligations`, existing relationships against their current authored targets, and other independent evidence behavior under a descriptive plural or collective family.

A production-local principle uses file hosts, H2 targets, `checklist: true`, no exclusion, and the host layer's stage and review requirement. A distributed role uses the owning layer's H2 hosts, ordinary H2 coverage, and only the exclusion behavior the target justifies. Declare these mechanics in the added typed claim, not in target prose. Create no empty target or family.

## Verification

Run the scoped generated-project source lint at every transition and final package gate, not at prose checkpoints. After graph changes, run the scaffold gate and negative probes required by the scaffold skill. A pure deletion that changes no stage, claim, config, source, or schema needs exact target and diff inspection rather than an unrelated build.
