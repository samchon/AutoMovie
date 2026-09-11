# Production evidence staging

Read the complete typed production declaration and graph in `lint.config.ts`, every target and host involved, and the applicable authoring phase document before changing a stage or evidence statement. `@automovie/evidence` owns reusable graph mechanics; the generated project has no second production-evidence declaration.

## States

Every layer is `disabled`, `draft`, `evidence`, or `review`.

- `disabled` means the layer currently has no governed hosts and its shared claims do not run. The selected kind decides whether the layer is forbidden or merely not begun.
- `draft` means the layer is applicable and owns non-empty hosts, but shared evidence coverage is off while the author completes the first version.
- `evidence` enables the layer's shared and production-specific claims without requiring review fingerprints.
- `review` keeps those claims active and requires a current substantive review for every acknowledgement and exclusion. The [rendered-realization policy](#rendered-realization-review) separates the warning owed by an unobserved render from the errors owed by structure and pre-render review.

An applicable layer moves only `disabled -> draft -> evidence -> review`. Leave completed layers in `review` so later target edits reopen affected checks. Do not return incomplete authored hosts to `disabled`, and do not leave a host behind when its layer is disabled.

The one exception is a passed [vertical-slice pilot](../production-lifecycle/pilot.md). Its explicit `complete-production-reset` transition moves the complete pilot-authored film ladder or library design/source slice together from `review` to `draft`, preserves every pilot host as editable source material, and selects the complete production population. No other mode, partial branch, unrepaired pilot, or later ordinary revision may move a stage backwards.

`draft` contains no evidence tags in authored settings, research, design, narrative, brief, or source hosts. Preserve their citation intent in ordinary prose or working notes, then author their complete evidence batch only after the layer passes its first-version audits and moves to `evidence`. This keeps partial production annotations from looking like partial completion.

During `complete-production-reset` only, retained pilot hosts may keep their earlier tags while their reset branches remain in `draft`. The reset state disables those claims, so the tags pay no complete-production obligation and certify no retained content. New or revised body receives no tag in draft, and every retained relationship is reread and renewed only after the rebuilt complete layer returns to evidence and review. Changing the mode to evade an ordinary draft diagnostic is a harness violation.

`docs/contracts` is a different host kind governed by [Production-specific contract](work-specific.md). A layer's discovery claim becomes active in `draft`, so stage enforcement permits that separate contract population to carry its discovery annotations before authored hosts may carry evidence tags. Do not apply the authored-host draft prohibition to the contract population.

The authored-unit topology is closed. Every treatment event file and script or screenplay unit file begins with its required H1 title; every delivery index contains only its required H1 and generated unit links. Other authored hosts may optionally begin with an H1 title. Outside that title, settings, research, map, model, space, material, instance, motion, system, and treatment hosts use only anchored H2 units; script, screenplay, and brief hosts use only anchored H2/H3/H4 units. Any other heading depth fails instead of hiding an ungoverned decision.

## Relationship types

The live binding inventory identifies the exact discovery, principle, and obligation targets selected for each authored role under [Contract targets](contract-targets.md).

- A principle is an item-by-item unit checklist. Every selected authored H2, H3, and H4 answers every applicable principle directly, exclusions are refused, and one strong unit cannot cover a weak sibling or descendant.
- An obligation is ordinary no-exclusion coverage across the selected layer. Relevant authored H2 owners fulfill its targets; a population-wide conclusion may use the family's declared aggregate account under `docs/accounts/<layer>`. Each layer selects its own applicable families. Several owners contribute where the substantive duty requires them.
- Discovery is ordinary coverage by the flat `docs/contracts/*.md` population, never a checklist or testimony carried by authored H2/H3/H4 units. The graph creates one claim for each active settings, research, map, model, space, material, instance, motion, system, treatment, script, screenplay, or brief population and gives it that population's shared discovery references: common plus settings for settings; common only for research; common plus designs plus the own layer for each design branch; common plus films plus the own layer for treatments, scripts, and screenplays; and common plus briefs for a brief. Disabled and shape-forbidden populations keep their discovery claims disabled, and source populations do not become discovery hosts. [Production-specific contract](work-specific.md) owns the result classification and adopted-rule boundary.
- Settings, map, model, space, material, instance, motion, and system references are foundation coverage. A host cites only the units it uses. A target no host in that claim population uses may receive one concrete population-wide exclusion only where the configured reference permits it. Research has one stricter bridge: every reviewed research H2 is interpreted by a settings H2, and later layers cite that settings owner.
- Film relationships split by axis. Every script and screenplay unit file cites in its pre-H1 comment every treatment H2 realized anywhere in that file, and every H2/H3/H4 cites every treatment H2 it actually realizes. The file-host union and the host union at each governed heading depth each cover the complete treatment H2 population without exclusion. Every screenplay file additionally cites exactly one script file, every screenplay H2/H3/H4 cites exactly one same-depth script parent, every script parent has one screenplay child, and only that script-to-screenplay delivery lineage has exact physical order and nesting.
- Design-source ownership is exact per selected export: model branches require a concrete exported class and select every exported type; motion branches select every exported function and property; map, space, material, instance, and system branches select every exported type, function, and property. Each selected export cites exactly one design file. More than one export may implement the same design; source-obligation and design-unit coverage is distributed across the complete branch population. Each shot or acceptance export likewise cites one screenplay scene or brief shot, and the complete source population covers every such parent.

An omission from one host is not an exclusion. `@evidenceExclude` says no host in the complete claim population owes the target. Never cite and exclude the same target in one population, use one host as a catalogue for all targets, or use a generic reason to hide missing authored work.

## Rendered realization review

The generated `evidence/graph` rule stays at `error`. Only source-to-authored rendered realization has a separate native warning reference in `review`: a pending or stale visual review can then reach source compilation and the first capture that makes its observation possible. The same target population always retains an error reference for coverage, positive acknowledgement, and configured cardinality. No complete mixed claim becomes a warning, and no diagnostic text is filtered after native evaluation.

| Source relationship | Structural reference | Review reference in `review` |
| --- | --- | --- |
| Map, model, space, material, instance, and motion sources to their exact design file and design H2 units | Error, without review freshness | Warning, with current review freshness |
| Shot and acceptance exports to their exact screenplay scene or brief shot H3 | Error, without review freshness | Warning, with current review freshness |
| Film sources to screenplay sequence or brief delivery H2 units | Error, without review freshness | Warning, with current review freshness |
| System sources to their design and production sources to settings | Error, with current review freshness | No warning reference |
| Source principle, upstream, and obligation references | Error, with current review freshness | No warning reference |
| Authored principles, discovery, foundations, lineage, and shared or local population accounts | Error, with current review freshness | No warning reference |

Every rendered pair keeps the same roots, files, symbols, exclusion rule, and cardinality. Missing or wrongly owned citations still block, even if a warning reports the same unpaid relationship. Before `review`, only its structural reference is needed. The manifest preserves both native references and exposes their `severity` and `requireReview`; source-owner readers retain one exact lineage identity, not a second executable owner for the warning.

`obligations/design/models.md#model-review-set` defines the finite review plan. Write its views, neutral background, scale, and comparison criteria before rendering. Its obligation reference remains an error, as do model construction, determinism, and fidelity boundaries.

A rendered-review warning authorizes the next source compile, capture, turntable, or inspection step, not acceptance or a final delivery claim. Open every required current output, compare it with the authored target and finite plan, then write the substantive review using the native fingerprint. Source edits require renewed observation even when a target fingerprint did not change: physical review identities also bind source, compile generation, and the applicable observation plan. The builder's `review` and `final` physical evidence gates remain errors. Film and brief owe the models their compiled staging consumes; a library owes the exact active graph-derived design owners and their applicable finite observations. Compilation success, a warning-only graph, a render call, and a stored review sentence do not replace those observations.

## Tags

Place each selected principle answer directly below its authored H2, H3, or H4. Place applicable foundation, lineage, and local claim answers with their actual owner. Technical design foundation answers belong with their consuming H2 units. An obligation answer belongs with the H2 that fulfills it or with an aggregate account that owns the population conclusion. Narrative and brief file parentage answers belong before the first H1 when a configured file claim selects that relationship.

Put a contract file's discovery answer in one HTML comment before its first H1, because discovery selects the contract as a file host. Keep those annotations outside the target H2s the same file defines. Put every discovery exclusion in that position in `docs/contracts/index.md` and nowhere else; the index has no target H2 or positive answer. A contract in a nested directory is refused because `contracts/*.md` cannot select it.

```text
@evidence path/file.md#anchor What exact fact, decision, transition, or observation the host realizes.
@evidenceExclude path/file.md#anchor Why no host in the complete population owes the target.
@evidenceReview path/file.md#anchor #fingerprint What target-host relationship was checked.
@evidenceExcludeReview path/file.md#anchor #fingerprint What population boundary was checked.
```

Use configured evidence roots such as `settings/...`, `models/...`, `motions/...`, `treatments/...`, `scripts/...`, `screenplays/...`, shared `discovery/...`, `principles/...`, and `obligations/...`, or the root declared by a production-specific claim. These `scripts/...` evidence references resolve under `docs/scripts`; the generated project's root `scripts/` directory contains executable tooling and is not an evidence root. Do not prefix a target with `docs/` unless that claim's root requires it. Every Markdown target unit has a stable explicit anchor.

When a physical-input boundary changes, create a disposable generated consumer and replace one governed population input with a hardlink. Verify that both lint and the evidence reader refuse that aliased identity, because a walk reaching one inode through two names would carry two independent owners of the same bytes. The project's `package.json` is admitted by a separate decision and is read once at a fixed path, so verify it differently: replacing it with a symlink is refused, while a second directory entry naming the same manifest is still read. Remove only the exact link after confirming the disposable root and target.

A reason names the host event, decision, limit, transition, implementation, or observable result that would be false without the target. A target-name paraphrase, `uses this setting`, `implements this rule`, and a copied reason are not evidence.

Test a reason by exchange rather than by reading it alone. Take the sentence this host gave and read it against a sibling host that answers the same target, then take the sibling's sentence and read it against this host. If neither becomes false, neither was written about the host it sits on, and both are generic however specific the wording looks. A detail lifted from the host does not by itself survive the exchange: when the sentence around the detail would hold equally with any other detail from any sibling, the frame is the reason and the detail is decoration.

Counting the host is a description of its size, not a statement about what the target required. `four facades and nine rooms`, `nine viewpoints`, `three shots` are true of every host shaped like this one. Write instead what this host does that a sibling does not, in the terms the target names.

When a statement turns on how something is written rather than on what it is (a number, a dimension, an identifier, a title, a quoted line), give the host's own rendering. A host whose source reads `1.6` is not addressed by a reason that says `160cm`, and one whose only mention of a station sits in a heading has not realized that station in its body. The fact may well be present, but a claim recorded in a notation the host never uses cannot be checked by reading the host, which is the only check this graph has.

## Transitions

Move a layer from `disabled` to `draft` only after its initially applicable discovery targets have a complete result under [Production-specific contract](work-specific.md) and the matching discovery host relationship. Add the layer's non-empty authored hosts as the transition begins. A layer forbidden by the selected shape remains disabled with neither authored hosts nor a running discovery claim.

Move a layer from `draft` to `evidence` after the full layer has a complete first version, stable anchored topology and ordered files, a scope and omission audit, and applicable discovery results under [Production-specific contract](work-specific.md). Read each selected principle against its governed units and confirm that relevant H2 owners collectively fulfill every selected obligation. Commit that coherent draft before changing the state.

Move the layer to `review` only after all shared and production-specific claim batches are complete and the production source lint has no errors. Commit that evidence state before review. Review each relationship independently under [Review](../review-verification/review.md) and its [semantic-review procedure](../review-verification/semantic-review.md), copy only builder-issued fingerprints, and compile again. Only the configured rendered-realization warnings may remain while producing their first observations; finish them before claiming the layer is reviewed or the production is complete.

A child may enter `draft` only after every direct parent's declaration is in `review` and its error-level relationships are paid. Research, when present, is an additional reviewed parent of authored documents. Shots wait for reviewed screenplay or brief and for the source declaration corresponding to every active map, model, space, material, instance, motion, and system branch to be in `review`. Only those sources' configured rendered-realization warnings may remain for the resulting compile and capture to pay. Production source waits for settings. Film source waits for production source and shots under the same distinction between a review-stage declaration and a completed rendered observation.

A design layer may enter `review` only after every active design layer it is founded on is also in `review`. Spaces are founded on maps, models on spaces, materials on models and spaces, instances on maps, models, spaces and materials, and motions and systems on each other and on all four. A foundation contributes none of its units until it is itself reviewed, so reviewing a layer ahead of its foundation records a completion that paid nothing for the parent it depends on. A foundation left `disabled` is not demanded: a library that delivers spaces without a map branch owes no map references.

This gate is on entering `review` rather than on entering `draft` because motions and systems are founded on each other. Write both against one another through `draft` and `evidence`, then promote both to `review` in one declaration; that is the only order in which each is reviewed with the other's reviewed units available.

`@automovie/evidence` checks non-empty host populations, required anchors, named source owners, population accounts, production-kind exclusions, the declared settings-and-design provider-consumer topology, flat treatment topology, treatment coverage, and exact script-to-screenplay delivery identities from the declaration before lint. Read `readAutoMovieProductionEvidence(...).manifest.topology` as the provider-consumer-status-reason matrix; every diagnostic is an account or lifecycle defect, while an `inapplicable` row is green only when its provider or consumer is genuinely outside the selected population. Keep every project-specific selector and additive claim in the one typed `lint.config.ts` declaration that also turns that value into the graph lint configuration. Preserve the typed declaration, additive `claims`, layer grouping, host-independent ordering, and mixed-state tests.

## Diagnostics

A diagnostic is routed through the [conformance owner map](conformance.md) before repair. The builder owns mechanically decidable syntax, graph, attachment, and freshness failures. [Independent semantic review](../review-verification/semantic-review.md) owns truth, role, literal support, absence, and exchange judgments.

A builder diagnostic is a question about the artifact, not an instruction to add a tag.

An error follows the halt-and-repair sequence below. A configured rendered-realization warning keeps its observation unpaid while allowing the source compile and capture work described in [Rendered realization review](#rendered-realization-review). It does not waive that work or bypass the independent `review` and `final` physical evidence gates.

1. Stop the current evidence batch and any downstream work behind its gate.
2. Read the full diagnostic, complete host, complete target with selected descendants, config, and necessary upstream and downstream context.
3. State the intended semantic relationship without relying on the existing annotation.
4. Compare plausible defects in target, host, ownership, hierarchy, statement or placement, claim population or cardinality, and builder behavior.
5. Fix the earliest actual owner and every affected dependant.
6. Reread the repaired scopes literally before writing evidence or resuming the batch.

Rewrite false or shallow content. Split, move, rename, merge, or replace a target whose scope is wrong. Correct only the tag when the content relationship already holds. Change config only when its intended population, stage, cardinality, exclusion, or implementation is itself wrong.

Never clear a diagnostic with exaggerated evidence, copied reviews, blanket exclusions, filler, path shuffling, stage reduction, weakened populations, invented fingerprints, or a package exception. Perform the owner map's halt and earliest-owner repair before retaining any acknowledgement.

## Production-specific claims

Classify and place a work rule through [Production-specific contract](work-specific.md) before configuring it. Use [Contract targets](contract-targets.md) for the shared inventory and target forms rather than recreating either in stage instructions.

A production-local principle uses selected authored-unit hosts, H2 targets, `checklist: true`, no exclusion, and the host layer's stage and review requirement. A production-local obligation uses ordinary coverage from the layer's authored H2s and declared aggregate account to its contract H2s. An independent target declares the population and relationship its distinct evidence behavior requires. The typed claim owns those mechanics.

Declare a local authored obligation with `createAutoMovieProductionObligationClaim` from `@automovie/evidence` in `lint.config.ts`. Pass `name`, one `document` under the flat `contracts` inventory, a reserved aggregate `account` address such as `accounts/models/local-obligations.md`, and the owning `layer`, `stage`, and `populationScope`. `documentRoot` defaults to `docs`; `docs/contracts` with a bare contract filename is also supported. Use an account file when it owns a shared conclusion; relevant authored H2s are also eligible contributors.

The helper derives the complete eligible authored file selector from `layer` and `populationScope`. Film pilot script and screenplay declarations select their exact delivery group, treatments remain flat, and complete production or reset selects all groups. The declaration is disabled in `disabled` and `draft`, activates in `evidence`, and requires current reviews in `review`. The obligation reference has error severity. Canonical admission preserves the helper's activation, severity, host population, and reference. `inapplicable: true` represents an explicit first-pilot audit.

The factory checks declared account addresses for ownership, collisions, and disabled-layer residue, and checks that each active contract has H2 targets. The manifest reports eligible owners in `localBindings[].host`, contract `targets`, and authored `population`; `localAudits` retains pilot-only inapplicable declarations. Structured `contract-rule` metadata belongs to the flat contract H2.

Keep helper-returned claims in the tracked `productionEvidence.claims` declaration and pass the whole declaration through `createAutoMovieEvidenceConfig` for the native `evidence/graph` rule. The factory validates ownership before projecting native claims. Do not strip `autoMovieBinding` from the authored declaration or pass the helper's metadata-bearing claim directly to the native evaluator; those are different inputs for different readers.

If the native schema rejects internal metadata, repair the package boundary and refresh the installed harness before continuing, preserving the declared ownership and reference policy.

During migration, reread each obligation at its relevant authored or aggregate owner. Preserve production facts and valid principle and parent relationships. Remove annotations for retired targets and superseded account-to-population edges, then review changed relationships from their actual content. Follow [Activation and revision](work-specific.md#activation-and-revision) for the instruction handoff.

## Verification

Run the scoped generated-project source lint at every transition and final package gate, not at prose checkpoints. After changing a claim, a target, or a stage, delete the citation the change was meant to require and confirm the builder refuses before restoring it. For discovery, separately prove that a retained result with no contract host fails, an exclusion outside `contracts/index.md` fails, and a nested contract is refused instead of ignored. A configured claim that selected no host reports the same green as a satisfied one. A pure deletion that changes no stage, claim, config, source, or schema needs exact target and diff inspection rather than an unrelated build.
