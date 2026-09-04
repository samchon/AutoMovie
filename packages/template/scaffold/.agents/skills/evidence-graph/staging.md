# Production evidence staging

Read the complete typed production declaration and graph in `lint.config.ts`, every target and host involved, and the applicable authoring phase document before changing a stage or evidence statement. `@automovie/evidence` owns reusable graph mechanics; the generated project has no second production-evidence declaration.

## States

Every layer is `disabled`, `draft`, `evidence`, or `review`.

- `disabled` means the layer currently has no governed hosts and its shared claims do not run. The selected kind decides whether the layer is forbidden or merely not begun.
- `draft` means the layer is applicable and owns non-empty hosts, but shared evidence coverage is off while the author completes the first version.
- `evidence` enables the layer's shared and production-specific claims without requiring review fingerprints.
- `review` keeps those claims active and requires a current substantive review for every acknowledgement and exclusion.

An applicable layer moves only `disabled -> draft -> evidence -> review`. Leave completed layers in `review` so later target edits reopen affected checks. Do not return incomplete authored hosts to `disabled`, and do not leave a host behind when its layer is disabled.

The one exception is a passed [vertical-slice pilot](../production-lifecycle/pilot.md). Its explicit `complete-production-reset` transition moves the complete pilot-authored film ladder or library design/source slice together from `review` to `draft`, preserves every pilot host as editable source material, and selects the complete production population. No other mode, partial branch, unrepaired pilot, or later ordinary revision may move a stage backwards.

`draft` contains no evidence tags in authored settings, research, design, narrative, brief, or source hosts. Preserve their citation intent in ordinary prose or working notes, then author their complete evidence batch only after the layer passes its first-version audits and moves to `evidence`. This keeps partial production annotations from looking like partial completion.

During `complete-production-reset` only, retained pilot hosts may keep their earlier tags while their reset branches remain in `draft`. The reset state disables those claims, so the tags pay no complete-production obligation and certify no retained content. New or revised body receives no tag in draft, and every retained relationship is reread and renewed only after the rebuilt complete layer returns to evidence and review. Changing the mode to evade an ordinary draft diagnostic is a harness violation.

`docs/contracts` is a different host kind. It records the production-contract audit completed before a layer enters `draft`, not evidence that the authored layer is complete. A layer's discovery claim therefore becomes active in `draft`, and the flat contract files may carry positive discovery answers or `index.md` exclusions before any authored host carries an evidence tag. Do not apply the authored-host draft prohibition to this contract population.

The authored-unit topology is closed. Every treatment event file and script or screenplay unit file begins with its required H1 title; every delivery index contains only its required H1 and generated unit links. Other authored hosts may optionally begin with an H1 title. Outside that title, settings, research, map, model, space, material, instance, motion, system, and treatment hosts use only anchored H2 units; script, screenplay, and brief hosts use only anchored H2/H3/H4 units. Any other heading depth fails instead of hiding an ungoverned decision.

## Relationship types

- A principle is an item-by-item unit checklist. Every selected authored H2, H3, and H4 answers every applicable principle directly, exclusions are refused, and one strong unit cannot cover a weak sibling or descendant.
- An obligation is ordinary no-exclusion coverage owned by one dedicated H2 under `docs/accounts/<layer>`. That account H2 cites exactly one obligation H2 and every H2 in the authored layer population it compares. Common obligations bind every authored layer, narrative obligations bind treatment, script, and screenplay, and each layer's own obligations bind that layer. The same selected item is accounted for again in each layer because each layer owes an independent whole-population comparison, while authored units do not repeat the invariant question.
- Discovery is ordinary coverage by the flat `docs/contracts/*.md` population, never a checklist or testimony carried by authored H2/H3/H4 units. The graph creates one claim for each active settings, research, map, model, space, material, instance, motion, system, treatment, script, screenplay, or brief population and gives it that population's shared discovery references: common plus settings for settings; common only for research; common plus designs plus the own layer for each design branch; common plus films plus the own layer for treatments, scripts, and screenplays; and common plus briefs for a brief. A retained result is answered by the contract file that states the adopted rule once and is enforced through an additive claim. A true no-result receives one population-wide exclusion only on `docs/contracts/index.md`, naming the concrete inputs, risks, and sufficient shared owners; deferral and an audit assertion are invalid exclusions. Disabled and shape-forbidden populations keep their discovery claims disabled, and source populations do not become discovery hosts.
- Settings, map, model, space, material, instance, motion, and system references are foundation coverage. A host cites only the units it uses. A target no host in that claim population uses may receive one concrete population-wide exclusion only where the configured reference permits it. Research has one stricter bridge: every reviewed research H2 is interpreted by a settings H2, and later layers cite that settings owner.
- Film relationships split by axis. Every script and screenplay unit file cites in its pre-H1 comment every treatment H2 realized anywhere in that file, and every H2/H3/H4 cites every treatment H2 it actually realizes. The file-host union and the host union at each governed heading depth each cover the complete treatment H2 population without exclusion. Every screenplay file additionally cites exactly one script file, every screenplay H2/H3/H4 cites exactly one same-depth script parent, every script parent has one screenplay child, and only that script-to-screenplay delivery lineage has exact physical order and nesting.
- Design-source ownership is exact per selected export: model branches require a concrete exported class and select every exported type; motion branches select every exported function and property; map, space, material, instance, and system branches select every exported type, function, and property. Each selected export cites exactly one design file. More than one export may implement the same design; source-obligation and design-unit coverage is distributed across the complete branch population. Each shot or acceptance export likewise cites one screenplay scene or brief shot, and the complete source population covers every such parent.

An omission from one host is not an exclusion. `@evidenceExclude` says no host in the complete claim population owes the target. Never cite and exclude the same target in one population, use one host as a catalogue for all targets, or use a generic reason to hide missing authored work.

## Tags

Directly below every selected authored H2, H3, and H4, answer every item of `principles/core/common.md`, the layer's own principle file, and, for treatment, script, and screenplay, `principles/story/narratives.md`, one line each. Place there too the foundation, lineage, or package-claim answers this unit justifies. Put whole-population obligation answers only below their dedicated `docs/accounts/<layer>` H2; that H2 names the obligation's actual owners and cites the complete authored H2 population it compared. Put an authored file's own setting and parentage answers in one HTML comment before its first H1 only where a configured file claim selects that relationship. File comments never carry principle answers.

Put a contract file's discovery answer in one HTML comment before its first H1, because discovery selects the contract as a file host. Keep those annotations outside the target H2s the same file defines. Put every discovery exclusion in that position in `docs/contracts/index.md` and nowhere else; the index has no target H2 or positive answer. A contract in a nested directory is refused because `contracts/*.md` cannot select it.

```text
@evidence path/file.md#anchor What exact fact, decision, transition, or observation the host realizes.
@evidenceExclude path/file.md#anchor Why no host in the complete population owes the target.
@evidenceReview path/file.md#anchor #fingerprint What target-host relationship was checked.
@evidenceExcludeReview path/file.md#anchor #fingerprint What population boundary was checked.
```

Use configured evidence roots such as `settings/...`, `models/...`, `motions/...`, `treatments/...`, `scripts/...`, `screenplays/...`, shared `discovery/...`, `principles/...`, and `obligations/...`, or the root declared by a production-specific claim. These `scripts/...` evidence references resolve under `docs/scripts`; the generated project's root `scripts/` directory contains executable tooling and is not an evidence root. Do not prefix a target with `docs/` unless that claim's root requires it. Every Markdown target unit has a stable explicit anchor.

A reason names the host event, decision, limit, transition, implementation, or observable result that would be false without the target. A target-name paraphrase, `uses this setting`, `implements this rule`, and a copied reason are not evidence.

Test a reason by exchange rather than by reading it alone. Take the sentence this host gave and read it against a sibling host that answers the same target, then take the sibling's sentence and read it against this host. If neither becomes false, neither was written about the host it sits on, and both are generic however specific the wording looks. A detail lifted from the host does not by itself survive the exchange: when the sentence around the detail would hold equally with any other detail from any sibling, the frame is the reason and the detail is decoration.

Counting the host is a description of its size, not a statement about what the target required. `four facades and nine rooms`, `nine viewpoints`, `three shots` are true of every host shaped like this one. Write instead what this host does that a sibling does not, in the terms the target names.

When a statement turns on how something is written rather than on what it is -- a number, a dimension, an identifier, a title, a quoted line -- give the host's own rendering. A host whose source reads `1.6` is not addressed by a reason that says `160cm`, and one whose only mention of a station sits in a heading has not realized that station in its body. The fact may well be present, but a claim recorded in a notation the host never uses cannot be checked by reading the host, which is the only check this graph has.

## Transitions

Move a layer from `disabled` to `draft` only after its initially applicable discovery targets have been searched against the declared production and answered in `docs/contracts`: a retained rule file with its enforcing additive claim, or a concrete truthful negative on `index.md`. Add the layer's non-empty authored hosts as the transition begins. A layer forbidden by the selected shape remains disabled with neither authored hosts nor a running discovery claim.

Move a layer from `draft` to `evidence` only after the full layer has a complete first version, stable anchored topology and ordered files, no placeholders, a manual scope and omission audit, and its applicable discovery searches and result classification in `docs/contracts`. Every retained rule must already have its target and additive claim, and every true no-result must already have its concrete exclusion on `index.md`. Read every selected principle against each H2, H3, and H4 in turn. Then create each required `docs/accounts/<layer>` H2, compare the obligation against the complete authored H2 population, name every actual owner, and confirm the account cites both the obligation and every compared unit. Settings additionally completes planned-delivery backcast and operative-subject accounting. Commit that coherent draft before changing the state.

Move the layer to `review` only after all shared and production-specific claim batches are complete and the production source lint is clean. Commit that evidence state before review. Review each relationship independently under [Review](../review-verification/review.md), copy only compiler-issued fingerprints, and compile again.

A child may enter `draft` only after every direct parent is in `review`. Research, when present, is an additional reviewed parent of authored documents. Shots wait for reviewed screenplay or brief and for the reviewed source corresponding to every active map, model, space, material, instance, motion, and system branch. Production source waits for settings. Film source waits for production source and shots.

A design layer may enter `review` only after every active design layer it is founded on is also in `review`. Spaces are founded on maps, models on spaces, materials on models and spaces, instances on maps, models, spaces and materials, and motions and systems on each other and on all four. A foundation contributes none of its units until it is itself reviewed, so reviewing a layer ahead of its foundation records a completion that paid nothing for the parent it depends on. A foundation left `disabled` is not demanded: a library that delivers spaces without a map branch owes no map references.

This gate is on entering `review` rather than on entering `draft` because motions and systems are founded on each other. Write both against one another through `draft` and `evidence`, then promote both to `review` in one declaration; that is the only order in which each is reviewed with the other's reviewed units available.

`@automovie/evidence` checks non-empty host populations, required anchors, named source owners, population accounts, production-kind exclusions, the declared settings-and-design provider-consumer topology, flat treatment topology, treatment coverage, and exact script-to-screenplay delivery identities from the declaration before lint. Read `readAutoMovieProductionEvidence(...).manifest.topology` as the provider-consumer-status-reason matrix; every diagnostic is an account or lifecycle defect, while an `inapplicable` row is green only when its provider or consumer is genuinely outside the selected population. Keep every project-specific selector and additive claim in the one typed `lint.config.ts` declaration that also turns that value into the graph lint configuration. Preserve the typed declaration, additive `claims`, layer grouping, host-independent ordering, and mixed-state tests.

## Diagnostics

A compiler diagnostic is a question about the artifact, not an instruction to add a tag.

1. Stop the current evidence batch and any downstream work behind its gate.
2. Read the full diagnostic, complete host, complete target with selected descendants, config, and necessary upstream and downstream context.
3. State the intended semantic relationship without relying on the existing annotation.
4. Compare plausible defects in target, host, ownership, hierarchy, statement or placement, claim population or cardinality, and compiler behavior.
5. Fix the earliest actual owner and every affected dependant.
6. Reread the repaired scopes literally before writing evidence or resuming the batch.

Rewrite false or shallow content. Split, move, rename, merge, or replace a target whose scope is wrong. Correct only the tag when the content relationship already holds. Change config only when its intended population, stage, cardinality, exclusion, or implementation is itself wrong.

Never clear a diagnostic with exaggerated evidence, copied reviews, blanket exclusions, filler, path shuffling, stage reduction, weakened populations, invented fingerprints, or a package exception. When `principles/core/common.md#evidence-content-conformance` fails, perform its halt and repair before retaining any acknowledgement.

## Production-specific claims

Classify a work rule through [Production-specific contract](work-specific.md) before configuring it. The exact shared inventory remains `docs/discovery`, domain-partitioned `docs/upstream/{design,story,delivery}`, `docs/principles`, and `docs/obligations`; every production-specific target instead lives as one flat file under `docs/contracts`. Prefix local principle files with `principles-`, local obligation files with `obligations-`, and name another independent relationship descriptively. Never create a nested family directory.

A production-local principle uses the selected authored-unit hosts, H2 targets, `checklist: true`, no exclusion, and the host layer's stage and review requirement. A production-local obligation uses the owning layer's H2 hosts, ordinary H2 coverage, and no exclusion. An independent target declares the population and relationship its distinct evidence behavior requires. Declare these mechanics in the added typed claim, not in target prose. Create no empty target or family, and never treat the automatic discovery-host claim as the claim that enforces the adopted rule.

## Verification

Run the scoped generated-project source lint at every transition and final package gate, not at prose checkpoints. After changing a claim, a target, or a stage, delete the citation the change was meant to require and confirm the compiler refuses before restoring it. For discovery, separately prove that a retained result with no contract host fails, an exclusion outside `contracts/index.md` fails, and a nested contract is refused instead of ignored. A configured claim that selected no host reports the same green as a satisfied one. A pure deletion that changes no stage, claim, config, source, or schema needs exact target and diff inspection rather than an unrelated build.
