# 사건, 인과와 시간 {#narrative-intent-events-time-document}

## Beat와 Event 상태 {#narrative-intent-beat-event-state}

<!-- @evidence requirements/story/beats-and-causality.md#story-beats-causality beat가 하나의 검토 가능한 의미 변화를 소유하게 한다. -->
<!-- @evidence requirements/story/beats-and-causality.md#story-beat-state-change 시작 조건과 결과 state를 활동에서 구분한다. -->

Beat 입력은 행위 주체, want, 시도, prerequisite, 시작 state, 변화와 결과 state이고 출력은 성공, 실패, 부분 성공, 비용 또는 질문 갱신 중 명시된 outcome을 가진 변화 단위다. 서로 무관한 변화가 한 beat에 묶이거나 결과 없는 activity와 원인 없는 결과가 있으면 분할 또는 causal-gap 진단을 출력한다.

### Semantic Event Identity와 Occurrence {#narrative-intent-semantic-event-occurrence}

<!-- @evidence requirements/story/beats-and-causality.md#story-semantic-event-identity semantic event를 frame과 shot에서 독립시킨다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-time-ellipsis-compression 실제 사건, 기억, 상상과 replay occurrence를 구분한다. -->

Semantic event는 안정 identity를 가지고 각 실제 발생, 반복 시도, 재연, 기억, 상상과 presentation replay는 별도 occurrence 또는 temporal mode로 표현된다. 여러 shot, sound cue와 관점이 한 occurrence를 실현할 수 있지만 source 재사용만으로 새 story occurrence를 만들 수 없다.

### 행동, 반응과 Knowledge {#narrative-intent-action-reaction-knowledge}

<!-- @evidence requirements/story/beats-and-causality.md#story-action-reaction 행동과 관점별 반응 및 knowledge state를 연결한다. -->
<!-- @evidence requirements/story/beats-and-causality.md#story-choice-cost-reversal 선택의 대안, 제약, 비용과 reversal 대상을 보존한다. -->

행동과 반응은 방향 있는 causal edge로 연결되고 같은 사건을 본 각 인물의 knowledge state는 독립적으로 갱신된다. 선택은 당시 사용 가능했던 대안과 제약, 비용과 결과를 기록하며 reversal은 목표, 관계, 전략 또는 관객 해석 중 실제로 뒤집힌 대상을 출력한다.

## 인과 Graph 불변식 {#narrative-intent-causal-graph-invariants}

<!-- @evidence requirements/story/beats-and-causality.md#story-causal-link-types 인과 종류와 단순 선후 관계를 구분한다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-sequence-causality sequence 사이 인과와 escalation 축을 정한다. -->

인과 edge는 direct-cause, enabling-condition, obstacle, trigger, information-reveal, choice, coincidence 또는 temporal-only 중 하나이며 방향, source event, target state와 confidence를 가진다. Sequence escalation은 규모, 비용, 정보, 관계, 시간 압력 또는 선택 불가능성의 전후 값으로 표현되고 사건 수 증가는 그 자체로 escalation이 아니다.

### Setup, Payoff와 Coverage Role {#narrative-intent-setup-payoff-roles}

<!-- @evidence requirements/story/beats-and-causality.md#story-setup-payoff setup과 payoff의 identity와 유효 범위를 연결한다. -->
<!-- @evidence requirements/story/beats-and-causality.md#story-beat-coverage-duplication sequence promise의 누락과 중복 beat를 검출한다. -->

Setup, foreshadowing, promise, question와 payoff는 stable identity, 유효 범위와 setup, development, complication, payoff 또는 resolution 역할을 가진다. Payoff 없는 setup, setup 없는 해결, 무효화된 약속의 소비, 동일 변화의 무근거 반복과 상위 목적 없는 beat는 각각 독립 finding이다.

### Observation Plan 경계 {#narrative-intent-beat-observation-boundary}

<!-- @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan beat의 관찰 의도를 구체적인 shot 문법에서 분리한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-shot-separation scene identity와 촬영 단위를 동일시하지 않는다. -->

Beat는 보여 주거나 들려줄 필수 변화, 관객에게 전달할 최소 정보와 semantic event만 출력한다. Camera, shot count, motion, sound와 edit 선택은 하류 실현이며 한 scene을 여러 shot으로 만들거나 한 shot에 여러 story moment를 담아도 이야기 identity는 변하지 않는다.

### Causal Failure {#narrative-intent-causal-failure}

<!-- @evidence requirements/story/beats-and-causality.md#story-causality-gap-reporting prerequisite 부재와 인과 오류를 named gap으로 보고한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-time-contradictions 시간과 state 모순을 자동 보정하지 않는다. -->

Missing prerequisite, 설명되지 않은 도약, 모순 원인, cycle, 의도되지 않은 coincidence, 원인보다 앞선 결과, 불가능한 travel, 동시 출현 충돌과 설명 없는 state reset은 영향 event와 state를 가진 결정적 failure로 출력한다. 시스템은 중간 사건을 임의 작성하거나 순서를 바꾸어 통과시키지 않는다.

## Story Clock 계약 {#narrative-intent-story-clock-contract}

<!-- @evidence requirements/story/story-clock-and-state.md#story-clock-state story clock과 film clock을 분리하고 생략 가능성을 보존한다. -->
<!-- @evidence requirements/editorial/scope-and-identity.md#editorial-story-film-order story order와 presentation order의 독립성을 편집 경계까지 유지한다. -->

Story clock 입력은 선택적인 원점, 단위, 방향과 적용 범위이며 film clock은 관객에게 제시되는 duration과 placement를 소유한다. Story clock이 생략된 작품에는 zero, scene 순서 또는 film time을 암묵 적용하지 않고 동기화 claim을 만들지 않으며 clock을 요구하는 criterion은 invalid 또는 unsupported로 남긴다.

### 시간 표현과 Range {#narrative-intent-temporal-representation}

<!-- @evidence requirements/story/story-clock-and-state.md#story-absolute-relative-time 절대, 상대, 범위, 순서와 unknown time을 구분한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-duration-deadline-recurrence 사건과 상태의 duration, deadline과 반복을 bounded 규칙으로 표현한다. -->
<!-- @evidence requirements/editorial/rational-time-and-ranges.md#editorial-rational-time-ranges film time의 정확한 유리수 표현과 기준 식별을 요구한다. -->

시간 값은 absolute, relative, named phase, exact, bounded-range, order-only 또는 unknown을 명시하고 적용 clock을 가리킨다. Event와 state의 시작, 종료, duration, deadline, recurrence와 중단 조건은 필요한 항목만 가지며 반복 규칙을 무한 occurrence 목록으로 전개하지 않는다.

### Chronology와 Presentation {#narrative-intent-chronology-presentation}

<!-- @evidence requirements/story/story-clock-and-state.md#story-presentation-chronology chronology, screenplay 배열과 final presentation을 독립시킨다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-parallel-intercut-lines 병렬 서사선의 시간, 관점과 미해결 질문을 보존한다. -->

각 scene과 event는 story chronology, screenplay order와 선택된 presentation placement를 별도 관계로 가진다. Flashback, flash-forward, montage, dream, intercut와 관점 전환은 temporal mode를 명시하고 편집상 인접이나 순서 변경이 인과, 실제 occurrence 또는 knowledge state를 다시 쓰지 않는다.

### 동시성과 Synchronization {#narrative-intent-story-synchronization}

<!-- @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events 서로 다른 장소와 관점의 동시 사건을 공통 clock으로 연결한다. -->
<!-- @evidence requirements/acceptance/tolerances-and-boundaries.md#acceptance-spatiotemporal-tolerance 시간 허용오차가 사용하는 clock과 방향을 명시하게 한다. -->

동시성 claim은 두 개 이상의 event occurrence, 공통 clock 또는 명시적 상대 관계와 tolerance를 입력으로 받아 realized story-time 범위를 출력한다. 가장 먼 두 시점의 차이가 tolerance 밖이면 fail이고 필수 clock 결속이 없으면 indeterminate 또는 invalid이며 cut adjacency는 동시성 evidence가 아니다.

### Scene와 Sequence Handoff {#narrative-intent-temporal-state-handoff}

<!-- @evidence requirements/story/treatment-and-sequences.md#story-sequence-state-handoff sequence 경계의 위치, 지식, 관계와 세계 상태를 인계한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-boundary-continuity scene 경계의 장소, 시간, 관점과 state 단절 이유를 보존한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope scene, sequence와 film 검토 범위를 분리한다. -->

연속 경계는 outgoing과 incoming의 같은 state fact를 비교하고 시간 도약, 장소 이동, 관점 변경 또는 authored reset이면 단절 원인과 적용 범위를 기록한다. 국소적으로 유효한 handoff가 전체 chronology와 충돌할 수 있으므로 scene, sequence와 film 결과는 독립 surface로 출력된다.
