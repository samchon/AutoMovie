# 장면 Coverage와 Acceptance {#narrative-intent-scene-acceptance-document}

## 촬영 가능한 Scene 입력 {#narrative-intent-filmable-scene-input}

### Subject Dependency와 Refusal {#narrative-intent-scene-dependency-refusal}

<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scenes-observable-action scene의 장소, 시간, 참여자, action과 state 변화를 필수 입력으로 정한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-observability 내면 상태를 관찰 가능한 행동, 대사, sound 또는 consequence로 외화한다. -->

Scene은 stable identity, location, time condition, participants와 mode, entry state, present-tense observable action, semantic event, exit state와 포함 beat를 입력으로 받는다. 내부 생각이나 mood만 있고 행동, dialogue, sound, visible condition 또는 consequence가 없으면 core change는 not-observable이다.

<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-subject-dependencies scene이 요구하는 character, prop, location, language와 environment를 식별한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-unfilmable-scene-refusal 불완전하거나 상충하는 scene을 named finding으로 거절한다. -->

각 observable action은 필요한 subject, capability, location, state, language와 environment dependency를 출력한다. 장소, 참여자나 행동 부재, 상충 entry state, 존재하지 않는 subject와 관찰 수단 없는 beat는 unresolved dependency 또는 invalid-scene failure이며 placeholder asset으로 성공시키지 않는다.

## Coverage Graph {#narrative-intent-story-coverage-graph}

### Orphan, Gap과 Empty Scope {#narrative-intent-coverage-gap-status}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-coverage-acceptance logline에서 scene event까지 promise edge를 요구한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-coverage-roles-duplication coverage role과 중복 소유를 구분한다. -->

Coverage edge는 source promise, target unit, setup, development, complication, payoff 또는 resolution 역할, covered condition과 남은 gap을 가진다. 파일 존재나 같은 citation 복사는 coverage가 아니며 한 scene이 모든 약속을 답한다면 역할과 state 차이가 없는 부분을 overcrowded claim으로 출력한다.

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-orphan-gap orphan과 missing, partial, conflicting, excluded 및 unsupported gap을 분류한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-empty-unsupported 빈 대상과 not-run 또는 unsupported 검사를 pass로 만들지 않는다. -->

상위 근거 없는 scene, scene 없는 beat, beat 없는 sequence와 하류가 답하지 않는 promise를 별도 orphan 또는 gap으로 출력한다. Empty scope는 작품이 해당 단위를 요구하지 않는 근거가 있을 때만 valid-empty이고 missing, intentionally-excluded, unsupported와 not-run은 pass와 구분된다.

### Scene, Sequence와 Film Surface {#narrative-intent-story-review-surfaces}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-scene-event-acceptance scene의 participant, state, event와 cue를 판정한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-sequence-acceptance sequence progression과 handoff를 독립 판정한다. -->
<!-- @evidence requirements/story/coverage-and-acceptance.md#story-film-level-review film의 causal chain, arc, pacing, setup과 ending을 별도 검토한다. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-review-surfaces 주체, shot, sequence, film과 delivery verdict를 격리한다. -->

Scene surface는 participant, entry와 exit state, event와 cue를, sequence surface는 beat coverage, progression, causal link, movement와 handoff를, film surface는 전체 promise, causal chain, character arc, pacing, setup과 payoff와 ending을 판정한다. 하위 surface의 pass는 상위 surface 입력일 뿐 자동 집계 pass가 아니다.

## Criterion과 Evidence {#narrative-intent-story-criterion-evidence}

### Story-sync criterion {#narrative-intent-story-sync-criterion}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-scene-event-acceptance Cross-shot event criterion을 exact authored events와 current realizations에 결합하게 한다. -->

Story-sync helper는 authored cross-shot criterion만 선택하고 current realized event times를 declared tolerance로 측정한다. 다른 sequence나 film review surface를 대신하지 않으며 optional failure도 deterministic finding으로 보존한다.

### Positive, Negative와 Boundary {#narrative-intent-story-criterion-cases}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance story criterion에 대상, 시간, observable state와 실패 조건을 요구한다. -->
<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-semantic-observable 서사 전달과 audience inference의 관찰 범위를 정한다. -->

Criterion은 stable identity와 version, story target와 revision, 전제 조건, event 또는 time scope, observable state, 비교 규칙, 실패 조건, tolerance 또는 qualitative boundary, required evidence, profile, severity와 authority를 가진다. 필수 요소가 없으면 대상 fail이 아니라 invalid-criterion이다.

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-negative-twin 누락, 순서, 인물, 장소, 정보와 continuity 반례를 요구한다. -->
<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-case-triad 같은 criterion의 positive, negative와 boundary case를 유지한다. -->

각 required criterion은 대표 성공, 누락 또는 잘못된 관계의 실패와 exact boundary를 같은 comparison rule로 정의한다. 한 frame의 정적 cue가 맞아도 전체 event, timing, reaction 또는 state consequence가 실패하면 pass가 아니며 허용 가능한 대체 표현은 명시된 equivalence로만 인정한다.

### 사람 판단과 측정 {#narrative-intent-story-human-machine-verdict}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-judgment-measurement 구조 측정과 사람의 서사 판단을 분리한다. -->
<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-subjective-verdict-boundary 주관적 판정을 가짜 수치 결정성으로 가장하지 않는다. -->

Event 존재, 순서, timing, state와 coverage는 정의된 구조 또는 수치 측정으로 판정하고 clarity, emotional effect, theme와 audience inference는 지정 authority의 실제 관찰문으로 판정한다. 사람의 선호는 필수 event 누락을 덮지 않고 자동 metric은 미학적 승인을 대신하지 않는다.

### Verdict Provenance와 Freshness {#narrative-intent-story-verdict-provenance}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-result-provenance criterion, revision, current evidence와 판정 주체를 결속한다. -->
<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-evidence-freshness evidence를 target, version, profile과 실제 산출물에 결속한다. -->

Verdict는 criterion version, exact target와 story revision, observed evidence identity와 scope, 판정 주체, timestamp, 결과, correction과 fingerprint를 출력한다. 다른 alternative, historical render, 일부 frame 또는 변경 전 evidence는 current verdict가 아니며 비교용 historical evidence로만 유지된다.

### 최종 Acceptance 상태 {#narrative-intent-final-story-acceptance}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-final-acceptance 선택된 같은 revision에서 전체 story surface를 판정한다. -->
<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-criterion-verdicts pass, fail, indeterminate, not-run, unsupported와 stale을 보존한다. -->

Final story acceptance는 current logline, 선택된 treatment와 alternative, scene coverage, chronology, causal chain, character와 relation state, dialogue variant, theme promise와 ending을 같은 revision closure로 판정한다. 필수 gap, conflict, stale evidence, indeterminate, not-run 또는 unsupported criterion이 있으면 결과는 partial 또는 해당 미완료 상태이고 complete로 승격되지 않는다.

### 저작 계약의 분리된 판정 {#narrative-intent-authoring-contract-discriminators}

<!-- @evidence requirements/story/coverage-and-acceptance.md#story-authoring-contract-discriminators 단위·population 적용 시점과 screenplay·design의 서로 다른 완료·표현·identity 책임을 독립적으로 판정하게 한다. -->

Composition-safe target은 현재 저작 단위 하나의 literal body만으로 판정하고 recurrent-frame과 cadence target은 완성 population의 실제 membership을 비교한 뒤에만 판정한다. Narrative account는 기여, 연결, continuity, 시간, speech, voice와 pacing의 실패 집합을 각각 유지한다. Screenplay account는 parse 가능한 heading/block과 의미상 완성된 scene, master-scene 내용과 shooting 선택, current locked revision과 downstream mapping을 독립 판정하며, design account는 관찰 가능한 style 결정, scale·layer completion과 prop·set-dressing·space owner를 실제 사용 책임으로 구분한다.
