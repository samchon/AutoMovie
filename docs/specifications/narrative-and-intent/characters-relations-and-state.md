# 인물, 관계와 상태 {#narrative-intent-characters-state-document}

## Character Identity 경계 {#narrative-intent-character-identity-boundary}

### 목표, Tactic과 Outcome {#narrative-intent-character-goal-state}

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-dramatic-characters 인물의 이름, 역할, 관점, knowledge와 arc를 story identity로 보존한다. -->
<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-actor-binding story character와 actor representation을 분리한다. -->

Character 입력은 stable identity, 이름과 alias, 역할, 관점, knowledge, desire, fear, constraint와 arc이고 actor, model, performer와 visual representation은 별도 binding이다. 외형, disguise, title, 나이대 또는 performer 변경은 identity를 바꾸지 않으며 쌍둥이, double과 imagined figure는 외형 유사성으로 병합되지 않는다.

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-goals-obstacles scene과 beat의 active goal, tactic, obstacle, cost와 outcome을 연결한다. -->

각 참여 단위는 인물이 말한 목표, 실제 목표, 관객이 추정하는 목표와 강요된 행동을 구분하고 active goal, tactic, obstacle, cost와 outcome을 가진다. 목표 변경은 원인 event 또는 새 정보와 연결되지 않으면 unexplained-motivation failure다.

### Agency와 Viewpoint {#narrative-intent-character-agency-viewpoint}

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-agency-viewpoint 선택 주체, 결과를 겪는 주체와 정보 관점을 분리한다. -->
<!-- @evidence requirements/story/beats-and-causality.md#story-action-reaction 같은 사건에 대한 관점별 knowledge 차이를 유지한다. -->

Choice, consequence와 presentation 정보에는 각각 acting subject, affected subject와 viewpoint가 명시된다. 배경 인물이나 집단도 자기 목표와 반응을 가질 수 있고 관객, 세계와 각 인물이 아는 사실은 별도 knowledge state로 유지된다.

## Relation 상태 모델 {#narrative-intent-relation-state-model}

### 등장과 부재 State {#narrative-intent-character-presence-state}

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-relations 방향별 관계, 권한과 믿음을 시간에 따라 보존한다. -->

Relation은 stable identity, source와 target, relation kind, direction, 공개 여부, 유효 시간, 실제 상태와 관점별 믿음을 가진다. 동맹, 대립, 권한, 친밀, 신뢰, 의존, 정보 비대칭, spatial relation과 조직 소속을 하나의 대칭 점수로 축약하지 않는다.

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-presence-absence on-screen, off-screen, heard-only, referenced, imagined와 absent를 구분한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-participant-modes scene 참여 방식과 cast 언급을 분리한다. -->

Scene participation은 on-screen, off-screen-speaker, heard-only, crowd, object, environmental-agent, referenced-only, imagined 또는 absent 중 하나 이상으로 선언된다. 물리적으로 없는 인물의 영향은 전달 정보, 흔적, sound 또는 관찰 가능한 결과와 연결되고 cast 목록만으로 행동 performer가 되지 않는다.

### 집단과 구성원 {#narrative-intent-character-group-membership}

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-groups-members 집단 identity와 식별 가능한 구성원을 분리한다. -->

집단은 하나의 dramatic identity로 행동하거나 식별 가능한 member identity와 membership interval을 가질 수 있다. Group state, prototype-like 공통 특성과 hero member의 예외를 분리하고 scene과 event마다 어느 수준이 acting subject인지 명시한다.

### Arc Milestone {#narrative-intent-character-arc-milestones}

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-arc-milestones arc의 시작, pressure, choice, reversal, climax와 ending을 event에 연결한다. -->

Arc는 작품에 필요한 milestone identity, 이전 state, pressure 또는 choice event와 결과 state를 연결한다. Costume, pose 또는 외관 변화는 그 변화가 belief, goal, relation 또는 knowledge state에 미친 관찰 가능한 결과가 없으면 arc 완료 evidence가 아니다.

## State Ledger와 전이 {#narrative-intent-story-state-ledger}

### Scene Entry와 Exit {#narrative-intent-scene-entry-exit-state}

<!-- @evidence requirements/story/story-clock-and-state.md#story-state-ledger 위치, knowledge, 소유, damage와 unresolved action을 경계마다 인계한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-state-transition-causes state change의 단일, 복합과 미정 원인을 구분한다. -->

Ledger entry는 subject, state key, value, 유효 time 또는 phase, source authority, confidence와 cause를 가진다. 전이는 하나 이상의 cause event, declared initial condition 또는 authored discontinuity를 요구하고 복합 원인과 여러 후보 중 unknown인 원인을 구분한다.

<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-entry-exit-state scene 시작과 종료 상태를 관찰 가능한 변화로 만든다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-place-time 장소와 시간 조건을 안정 location 및 temporal state에 연결한다. -->

Scene 입력에는 story location, INT 또는 EXT 성격, time condition, entry state와 prerequisite가 있고 출력에는 changed state, unresolved action과 exit state가 있다. 필수 위치, 참여자나 초기 상태가 충돌하면 scene은 invalid이고 하류가 편의상 reset하거나 default snapshot을 적용할 수 없다.

### 완결성과 Failure {#narrative-intent-character-state-completeness}

<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-completeness 이름뿐인 인물과 identity 없는 performer를 검출한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-time-contradictions 되돌아간 damage와 설명 없는 state reset을 모순으로 보고한다. -->

핵심 인물은 참여 scene에 필요한 goal, knowledge, relation과 state를 제공해야 한다. 동일 시점의 mutually exclusive 값, 원인 없는 변화, 불가능한 출현, identity 없는 performer와 사건에 영향 없는 named character는 exact scope를 가진 finding이며 유효한 다른 인물 상태는 보존된다.
