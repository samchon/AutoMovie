# Budget, Continuity와 산출물 {#narrative-intent-budget-deliverable-document}

## Budget 상태 계약 {#narrative-intent-budget-state-contract}

<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budgets-feasibility 대상 tier, unit, limit, basis, margin과 owner를 정한다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-resource-schedule-budget runtime cost와 제작 자원 및 일정 cost를 함께 표현한다. -->

Budget entry는 stable identity와 revision, target deliverable 또는 tier, subject 또는 scope, metric, unit, inclusive limit, measurement basis, safety margin, owner와 status를 가진다. Runtime population과 memory뿐 아니라 unique asset, license, authoring, conversion, review, capture, render, storage와 revision effort를 표현하고 unknown cost를 zero로 만들지 않는다.

### Story Consequence와 Representation 선택 {#narrative-intent-budget-story-representation}

<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-story-budget budget 변경을 scene, event, hero와 acceptance consequence에 연결한다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-representation proxy, LOD, reuse와 culling의 보존 및 손실을 비교한다. -->

Budget adjustment candidate는 affected scene, event, hero, camera distance, identity, silhouette, interaction, acceptance와 delivery를 출력한다. Instance, LOD, proxy, culling, reuse와 bounded variation은 before와 after cost, preserved capability, lost detail, transition condition과 review를 가지며 시스템이 중요도를 추측해 content를 누락하지 않는다.

### Measurement 상태와 Worst Case {#narrative-intent-budget-measurement-worst-case}

<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-worst-case-budget worst-case frame과 interval의 포함 범위를 명시한다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-measurement-status exact, measured, estimated, upper-bound, unsupported와 not-run을 구분한다. -->

Budget observation은 exact, measured, estimated, upper-bound, unsupported 또는 not-run status, value 또는 absence reason, source, target fingerprint와 freshness를 가진다. Worst case는 scene, frame 또는 interval, camera, active state, tier, included 및 excluded populations를 식별하고 upper bound를 실제 shipped frame 측정값으로 표시하지 않는다.

### Aggregate, Variant와 Freshness {#narrative-intent-budget-aggregate-variant}

<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-shared-cost shared one-time cost와 simultaneous active cost를 다른 축으로 집계한다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-variant-comparison 같은 measurement basis에서 variant를 비교한다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-freshness target 변경 뒤 report를 stale로 만든다. -->

Shared asset, cache, model, texture와 one-time authoring cost는 identity로 중복 제거하지만 peak memory와 simultaneous active cost는 각 scope에 유지한다. Variant comparison은 같은 metric, basis, tier와 coverage만 비교하고 design, asset, setting, population, simulation 또는 delivery fingerprint 변경은 관련 report를 stale로 만든다.

### Budget Refusal와 Feasibility {#narrative-intent-budget-feasibility-verdict}

<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-refusal 초과 plan을 무작위 누락이나 runtime degradation으로 진행하지 않는다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-feasibility-approval 필수 scope와 cost의 closure가 있을 때만 feasible로 판정한다. -->

Inclusive limit 초과는 metric, owner, exact scope와 candidate choices를 가진 deterministic refusal이다. Required scope가 budget 안에 있고 필수 cost에 unsupported와 not-run이 없거나 권한 있는 risk acceptance가 있을 때만 feasible이며 우연한 한 번의 실행 성공은 feasibility evidence가 아니다.

## Design Continuity Ledger {#narrative-intent-design-continuity-ledger}

<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-continuity-ledger subject와 location state를 story time에 따라 추적한다. -->
<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-continuity-deliverables 모든 derivation이 같은 design revision을 참조하게 한다. -->

Continuity entry는 subject 또는 location, state key, value, story time 또는 phase interval, cause event, previous와 next state, source authority와 evidence를 가진다. Costume, prop, damage, dirt, opening, furniture, weather, light와 crowd state는 edit order가 아니라 story state로 이어지고 mutually exclusive current 값은 conflict다.

### 변경 영향과 비교 {#narrative-intent-design-change-impact-comparison}

<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-change-impact direct와 shared dependency의 consequence surface를 계산한다. -->
<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-change-set-comparison revision, variant와 phase의 semantic difference를 보고한다. -->

Art direction, scale, location, subject, material, tier와 budget 변경은 scene, asset, shot, sound, edit, render, evidence, shared prototype, instance, palette role, schedule, route, reflection, shadow, sound context와 quantity까지 영향 edge를 출력한다. Comparison은 added, removed, replaced, changed와 unchanged identity 및 semantic consequence를 보존하고 byte diff만으로 의미를 판단하지 않는다.

## Deliverable Inventory {#narrative-intent-design-deliverable-inventory}

<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-breakdown-deliverables breakdown, schedule, board와 budget 산출물의 consumer를 정한다. -->
<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-bible-decisions owning source로 연결되는 navigable inventory를 요구한다. -->

Deliverable item은 stable identity, purpose, consumer, required 또는 optional status, format 또는 human-readable view, source revision과 variant, completeness rule, acceptance와 current artifact를 가진다. Location, subject, asset, palette, material, state, budget, reference와 unresolved decision inventory는 owning source로 연결되고 별도 prose copy가 정본이 되지 않는다.

### Authority, Gap과 Freshness {#narrative-intent-deliverable-authority-gaps}

<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-source-authority hand-edited derived artifact의 역승격을 막는다. -->
<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-gaps missing과 partial output의 exact gap을 보고한다. -->
<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-freshness source 변경 뒤 current claim을 금지한다. -->

Tracked design과 validated current derivation이 drawing, schedule, quantity, bundle, capture 또는 render와 충돌하면 source authority를 유지한다. Missing subject, sheet, state, reference, metric 또는 review는 exact gap과 impact를 출력하고 source 변경 뒤 artifact는 regenerated가 아니라면 stale 또는 not-run이다.

### Provenance, Receipt와 Final Handoff {#narrative-intent-deliverable-provenance-handoff}

<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance distributable의 source, activity, tool, digest와 publication state를 추적한다. -->
<!-- @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-final-handoff 승인 revision, inventory, risk, rights와 review를 함께 제공한다. -->

Artifact receipt는 source revision, input asset identities, generation activity, tool 또는 renderer identity, parameters, output digest, media 또는 document facts와 publication state를 가진다. Final handoff는 selected design revision과 variant, required inventory, current artifacts, open risk, exclusion, rights와 attribution, criterion verdict와 reviewer decision을 같은 closure로 출력하며 path나 label은 completion proof가 아니다.
