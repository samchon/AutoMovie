# 이야기 Coverage와 Acceptance

## 상위 약속의 완전한 하향 Coverage {#story-coverage-acceptance}

각 logline 약속은 treatment와 sequence로, 각 sequence는 beat로, 각 beat는 하나 이상의 scene에서 관찰 가능한 event와 state change로 이어져야 한다.

Coverage는 파일이나 단위의 존재가 아니라 해당 하류 단위가 상위 약속의 어느 부분을 어떻게 답하는지 나타내야 한다. 같은 citation을 여러 번 복사한 것만으로 서로 다른 약속을 모두 충족했다고 계산하지 않아야 한다.

### Orphan과 Gap {#story-orphan-gap}

상위 근거가 없는 scene, scene이 없는 beat, beat가 없는 sequence와 어떤 하류 사건도 답하지 않는 핵심 약속을 구분해 보고해야 한다.

Gap은 missing, partial, conflicting, intentionally excluded, unsupported와 not yet reviewed를 구분할 수 있어야 한다. 의도적 제외와 미작성 항목을 같은 통과 상태로 표시하지 않아야 한다.

### Falsifiable Acceptance {#story-falsifiable-acceptance}

이야기 성공 조건은 대상, 시간 또는 event, 관찰 가능한 상태와 실패 조건을 가져야 하며 “감동적이어야 한다” 같은 단독 평가어로 끝나지 않아야 한다.

Acceptance는 어떤 story revision과 단위를 판정하는지, 필요한 evidence 종류, 평가 주체와 허용 오차 또는 질적 판단 기준을 식별할 수 있어야 한다. Criteria 자체가 production 결과를 만들거나 성공을 자가 선언하지 않아야 한다.

### Negative Twin {#story-acceptance-negative-twin}

필수 사건의 누락, 순서 반전, 잘못된 인물, 틀린 장소, 전달되지 않은 정보와 state continuity 파손을 각각 실패로 판정할 수 있어야 한다.

필요한 경우 false positive를 막는 금지 조건과 false negative를 막는 허용 가능한 대체 표현을 함께 둘 수 있어야 한다. 특정 frame 한 장만 맞고 전체 event가 실패하는 결과를 통과시키지 않아야 한다.

### Film-level 검토 {#story-film-level-review}

개별 scene이 통과해도 전체 작품의 causal chain, character arc, pacing, setup과 payoff와 ending이 logline에 답하는지 별도로 검토해야 한다.

### Coverage 역할과 중복 {#story-coverage-roles-duplication}

하나의 promise에 대한 setup, development, complication, payoff와 resolution을 서로 다른 coverage role로 표시할 수 있어야 한다. 동일 event를 이유 없이 여러 단위가 소유하거나 하나의 scene이 설명 없이 모든 약속을 충족한다고 주장하면 중복 또는 과밀 finding으로 남겨야 한다.

### Scene과 Event Acceptance {#story-scene-event-acceptance}

Scene acceptance는 필수 participant, 시작과 종료 state, semantic event와 관찰 가능한 cue를 판정할 수 있어야 한다. Shot size, frame number와 renderer 설정은 실현 evidence가 될 수 있지만 story criterion의 identity를 대신하지 않아야 한다.

### Sequence Acceptance {#story-sequence-acceptance}

Sequence acceptance는 포함 beat의 coverage, state progression, causal connection, escalation 또는 project-defined movement와 다음 sequence로의 handoff를 판정할 수 있어야 한다. 모든 scene의 개별 통과를 sequence의 자동 통과로 합산하지 않아야 한다.

### 사람 판단과 측정의 구분 {#story-acceptance-judgment-measurement}

Event 존재, timing, state와 coverage처럼 구조적으로 판정 가능한 항목과 clarity, emotional effect, theme realization처럼 사람의 검토가 필요한 항목을 구분해야 한다. 측정할 수 없는 판단을 가짜 metric으로 만들거나 사람 판단만으로 필수 event 누락을 덮지 않아야 한다.

### Acceptance 결과의 Provenance {#story-acceptance-result-provenance}

각 판정은 criterion identity, story revision, 관찰한 current evidence, 판정자 또는 검증 주체, 결과와 correction을 연결해야 한다. 오래된 render, 다른 alternative와 부분 frame을 현재 이야기 acceptance의 근거로 제시하지 않아야 한다.

### 빈 범위와 미지원 분석 {#story-acceptance-empty-unsupported}

Acceptance 대상이나 required criteria가 비어 있는 경우 자동 성공하지 않고 왜 빈 범위가 유효한지 명시적으로 확인해야 한다. 지원되지 않거나 실행하지 않은 검사는 `unsupported` 또는 `not-run`으로 드러나야 하며 통과와 구분되어야 한다.

### 최종 이야기 Acceptance {#story-final-acceptance}

최종 story acceptance는 current logline, 선택된 treatment와 승인된 alternative 조합, 전체 scene coverage, chronology, causal chain, character와 relation state, dialogue version, theme promises와 ending을 같은 revision에서 판정해야 한다. 미해결 필수 gap이나 stale evidence가 있으면 완료로 제시하지 않아야 한다.
