# Staging events, coverage와 validation

## Fixed-clock semantic event {#performance-staging-fixed-clock-semantic-event}

<!-- @evidence requirements/staging/events-and-timing.md#staging-events-timing 장면 의미를 고정하는 event를 addressable contract로 둔다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-fixed-film-clock 모든 delivery와 event가 같은 production frame clock을 사용한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-timebase-interval shot-local, film, story timebase와 interval을 명시한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-order causal event order를 검증한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-simultaneous-events 동시 사건의 tolerance와 story-clock mapping을 정의한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-frame-grid required event가 exact delivery frame에서 관찰 가능하게 한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-observation event declaration과 compiler·review observation을 분리한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-refusal window, order와 observation이 모순된 event를 거부한다. -->
<!-- @evidence requirements/story/beats-and-causality.md#story-action-reaction action과 reaction event의 causal relation을 보존한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events 여러 shot의 사건을 story clock에서 비교한다. -->

Staging event contract는 stable event identity, semantic kind, owning scene·beat·shot, participant identities와 역할, declared timebase, inclusive window 또는 exact frame, predecessor·successor relation, required spatial·state predicates와 observation policy를 가진다. Shot-local clock은 motion·camera·effect를, film clock은 edit placement를, optional story clock은 실제 사건 시간을 나타내며 origin·rate·trim mapping 없이 서로 대신하지 않는다.

동시 event는 같은 film frame이라는 추정이 아니라 공통 timebase와 tolerance를 가진 set으로 선언한다. 여러 shot에서 같은 story instant를 보여 주려면 각 shot의 story pin과 realized local event time을 story seconds로 변환해 최대 spread를 측정한다. Presentation order는 simultaneity를 만들지 않고, retime과 trim은 event identity, order, reaction·sound binding을 함께 보존한다.

Observation은 contract 자체가 아니라 current compiled state의 predicate result, computed interaction event, exact review frame과 pass를 참조한다. Window 밖 sample, frame grid 밖 required time, duplicate occurrence identity, causal order 역전, unresolved participant, impossible simultaneous tolerance, 선언만 있고 관찰이 없는 event는 실패다.

### Boundary sampling과 event output {#performance-staging-event-boundary-sampling-output}

<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling motion과 staging이 같은 interval boundary law를 사용하게 한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-observation event output에 실제 측정과 provenance를 포함한다. -->

Interval은 start 포함과 end 제외를 기본으로 하거나 event kind별 명시된 boundary law를 사용하며, 인접 cue·shot 사이에서 같은 event가 두 번 발생하거나 사라지지 않아야 한다. Shot exact end와 film transition은 source frame mapping을 먼저 계산한 뒤 event inclusion을 판단하고, floating-point epsilon 대신 frame-derived rational identity와 declared tolerance를 사용한다.

Realized event output은 occurrence identity, source contract, producer kind, local·film·story time, involved identities, measured predicates와 pass status, contact point 또는 payload, downstream sound·reaction·acceptance references를 포함한다. Event source bytes나 mapping이 바뀌면 observation은 stale이고, 다른 take 또는 다른 shot의 같은 문자열 id를 현재 event로 오인하지 않는다.

## Shot contract와 delivery evidence {#performance-staging-shot-contract-delivery-evidence}

<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-contracts 촬영 단위의 measurable promise를 code-bound contract로 정의한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-subject-deliveries subject, action, framing과 state delivery를 명시한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-delivery-acceptance 각 delivery를 falsifiable acceptance와 연결한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-source-binding shot identity와 deterministic source binding을 함께 보존한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-review-times contact, reveal와 boundary에 exact review time을 둔다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-contract-freshness source, design과 evidence freshness를 확인한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-shot-contract-refusal prose만 있거나 측정 불가능한 contract를 거부한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-scene-event-acceptance shot delivery가 scene event acceptance를 실현하게 한다. -->

Shot contract는 stable shot identity, source binding, scene·beat evidence, duration과 time mapping, required actor·formation·object participants, opening·closing state predicates, semantic events, camera readability, review frames와 acceptance references를 가진다. Dense keyframes나 전체 action list가 아니라 무엇이 current compiled output에서 측정되어야 하는지를 소유한다. Source binding은 canonical source identity와 exported artifact identity, source digest를 고정하고 source가 반환한 자기 증언으로 통과하지 않는다.

Subject delivery는 identity, required interval, action·state·event, current extent를 사용하는 framing·visibility, contact 또는 expression·gaze 같은 specific feature와 tolerance를 가진다. Opening은 time zero, closing은 declared duration, event는 authoritative sample, camera는 required review time에서 independently measure한다. 각 required visual criterion은 exact frame와 beauty·mask·depth·pose·outline 등 필요한 pass를 지정하고, prose expectation만으로 realization을 증명하지 않는다.

Duration이 frame clock에 놓이지 않거나 source가 다른 scene·shot을 만들거나 participant가 staged되지 않거나 state·event predicate가 비어 있거나 review frame이 없거나 required subject가 측정 불가하면 contract failure다. Upstream story, design, source, asset, compiler·renderer identity가 바뀌면 realization과 review를 stale로 만들고 현재 shot을 다시 compile·capture·review한다.

### Contract realization과 acceptance status {#performance-staging-contract-realization-acceptance-status}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-result-provenance acceptance 결과가 current compiler와 frame evidence provenance를 가지게 한다. -->
<!-- @evidence requirements/staging/shot-contracts-and-deliveries.md#staging-delivery-acceptance delivery와 acceptance 결과를 직접 연결한다. -->

Realization output은 shot input fingerprint와 opening·closing·event predicate별 expected, actual, tolerance와 pass, camera·formation summary, review target inventory를 가진다. Acceptance는 compiler-derived event·metric outcome 또는 exact current frame·pass review를 인용하고, required criteria가 모두 current인 경우에만 shot delivery를 완료한다.

Automatic measurement가 지원하지 않는 pixel occlusion, dramatic readability와 appearance 판단은 `needs-review`로 남겨 current evidence를 요구한다. `unsupported`, `not-run`, `stale`, reviewer `revise`를 pass로 접지 않고, negative twin과 boundary case가 실패해야 positive result를 신뢰한다.

## Coverage matrix와 alternative take {#performance-staging-coverage-matrix-alternative-take}

<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-coverage-alternative-takes story event를 편집할 수 있는 source coverage를 제공한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-coverage-matrix scene·beat·event와 take delivery의 matrix를 유지한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-coverage-kinds hero, alternate, insert, reaction과 safety coverage를 구분한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-coverage-overlap edit handle과 event overlap을 충분히 확보한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-take-comparability 같은 action state와 clock에서 take를 비교한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-take-identity alternative take에 독립 stable identity와 evidence를 부여한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-take-selection selected take와 rationale, edit consequence를 기록한다. -->
<!-- @evidence requirements/staging/coverage-and-alternative-takes.md#staging-coverage-gap 필요한 사건을 보여 줄 take가 없으면 gap을 반환한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-orphan-gap orphan scene·event와 coverage gap을 닫는다. -->

Coverage matrix는 scene·beat·semantic event와 required subject delivery를 행으로, hero take·alternate angle·insert·reaction·safety take를 열로 두고 각 cell에 shot or take identity, interval, review and acceptance status를 연결한다. Coverage kind는 camera·framing purpose와 편집 사용 가능성을 설명할 뿐 story event를 복제하지 않는다. 같은 beat의 alternate take는 동일 opening state와 choreography source를 공유하거나 차이를 명시해 비교 가능성을 보존한다.

각 take는 stable identity, staged camera와 compiled camera motion, directorial intent, duration, handles, captured review frames와 independent evidence를 가진다. Hero shot의 alternate coverage는 canonical edit에 자동 삽입되지 않고 selection 전까지 branch로 남는다. Insert나 reaction처럼 다른 timing을 가진 source shot은 별도 contract와 state handoff를 가진다.

Coverage overlap은 semantic event 전후에 required edit handle, motion phase와 continuous state를 확보하고 transition이 사용할 실제 source frame 범위를 검증한다. Selection은 chosen take, 이유, rejected alternatives, state·audio·caption·acceptance consequence와 downstream stale set을 기록한다. Required event, readable duration, handle 또는 comparable state를 제공하는 take가 없으면 coverage gap이며, 비슷한 기존 shot을 자동 재사용하지 않는다.

### Take continuity와 edit compatibility {#performance-staging-take-continuity-edit-compatibility}

<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-state-alternatives alternate take의 state branch와 canonical handoff를 분리한다. -->
<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-alternatives 대안 선택과 폐기 lineage를 downstream edit에 전달한다. -->

Take 비교와 교체는 participant identity, opening state, event realization, camera axis·eyeline·screen direction, sound·caption timing과 available handles를 함께 본다. 다른 take가 같은 event id를 갖더라도 realized time과 source frame은 별도이며, 선택된 edit가 해당 take의 current evidence를 참조해야 한다. Take replacement는 canonical film state와 acceptance를 다시 계산하고 이전 take review를 새 take에 전이하지 않는다.

새 coverage kind나 camera intent는 기존 single-take shot에 optional additive data로 추가할 수 있다. Take identity, time mapping, selection semantics 또는 edit handle law를 바꾸면 migration이 필요하고, legacy absence는 alternate가 성공했다는 뜻이 아니라 single-source 상태다.

## Staging budget, safety와 validation {#performance-staging-budget-safety-validation}

<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-budgets-safety-validation 실행 가능한 staging을 공간·시간·비용 bound 안에 둔다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-validation-context exact story, design, source, clock와 policy context를 묶는다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-spatial-validation placement, support, clearance, visibility와 route를 검증한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-temporal-validation motion, event, transition과 handoff를 시간 전체에서 검증한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay 동일 input에서 resolved staging과 evidence target을 재현한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-validation-twins positive, negative와 boundary case를 함께 검증한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-authored-safety-state 위험과 intentional exception을 authored state로 기록한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-viewer-review current viewer frame에서 자동 판단 밖의 품질을 검토한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-failure-status failure, unsupported, not-run과 stale을 pass와 구분한다. -->

Validation context는 production·story·scene·plan·shot·source·asset·world·actor·formation digest, frame clock, selected spatial·temporal·cost·safety policy, explicit seed와 evaluator version을 하나의 fingerprint로 묶는다. Budget은 participants, active motions and solvers, formations, props, marks·zones, choreography cues, coverage takes, review frames, sample count와 runtime cost의 inclusive limits를 선언하고 현재 결과에서 역산하지 않는다.

Spatial pass는 identity resolution, frame·unit, placement, surface support, clearance·overlap, route·zone, current bounds와 camera readability를 검사한다. Temporal pass는 action interval, motion transitions, contact·semantic event, group reform, reveal duration, take handles와 edit handoff의 endpoints와 interior를 검사한다. Positive example이 통과하고 corresponding negative가 실패하며 exact limit boundary가 contract대로 판정되는지 확인한다.

Safety state는 위험 kind, affected participants and zone, active interval, clearance·speed·force limit, mitigation, responsible authority와 intentional exception을 가진다. Prototype proxy가 실제 현장 안전이나 stunt approval을 대신하지 않으며, safety validation은 현재 구조 계획 안의 measurable constraint만 판단한다. 위험을 발견하면 motion을 조용히 약화하거나 participant를 삭제하지 않고 alternate choreography, staging, capability 또는 explicit approval path를 반환한다.

### Deterministic replay와 failure result {#performance-staging-deterministic-replay-failure-result}

<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-deterministic-replay worker와 seek 순서에 무관한 동일 staging 결과를 요구한다. -->
<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-failure-status 검증하지 못한 상태를 명시적인 status와 diagnostic으로 반환한다. -->

같은 validation identity는 worker count, traversal order, incremental compile와 scrambled frame seek에 관계없이 같은 transforms, memberships, events, coverage inventory, findings와 evidence targets를 만든다. Stateful simulation은 fixed-step 또는 authenticated bake를 사용하고, derived event를 여러 consumer가 재계산해 갈라놓지 않는다. Determinism 비교는 canonical ordering과 tolerance, digest를 receipt에 기록한다.

Failure result는 `passed`, `failed`, `unsupported`, `not-run`, `unbudgeted`, `needs-review`, `stale` status와 domain, target identity, time·frame, expected·actual·tolerance, source trace, consequence와 actionable alternatives를 가진다. Error가 하나라도 있으면 compilation·delivery를 막고 warning 또는 authored exception은 원 proposal과 selected response를 함께 보존한다.

### Viewer evidence와 prototype ceiling {#performance-staging-viewer-evidence-prototype-ceiling}

<!-- @evidence requirements/staging/budgets-safety-and-validation.md#staging-viewer-review exact production raster와 guide pass에서 staging을 확인한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-blocking-pass viewer evidence가 finished shot이 아니라 blocking pass를 판정하게 한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-prototype-readability subject, action과 event order의 가독성을 prototype 성공 조건으로 둔다. -->

Viewer review는 exact production raster, camera·take identity, frame clock, current compiled fingerprint와 requested beauty·mask·depth·pose·outline pass를 가진 immutable evidence를 사용한다. Contact, reveal, reform, visibility extremum과 continuity boundary를 review point로 고르고 speed, half-speed와 frame-step를 함께 판단한다. 다른 shot, stale bundle, 임의 screenshot과 proxy tier의 승인을 final tier에 재사용하지 않는다.

성공 claim은 staging, motion, timing, camera, contact, group state와 event가 readable하고 재현된다는 범위다. Primitive actor·object와 compact formation으로도 이 구조를 충분히 증명할 수 있지만 photoreal appearance, detailed likeness, production cloth·hair, pixel-perfect occlusion 또는 안전 인증을 자동으로 포함하지 않는다. 더 높은 fidelity는 별도 authorized representation과 review lane의 current evidence를 요구한다.
