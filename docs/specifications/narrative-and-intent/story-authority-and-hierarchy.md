# 이야기 권위와 계층 {#narrative-intent-story-authority-document}

## 이야기 정본 경계 {#narrative-intent-story-authority-boundary}

### 사실 Authority와 Provenance {#narrative-intent-story-fact-authority}

<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-source-of-truth 승인된 screenplay source만 이야기 사실의 정본으로 채택한다. -->
<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-source-authority source 종류별 사실 소유권과 충돌 규칙을 정밀화한다. -->

입력은 source identity, revision, author 또는 approver, 적용 범위, 상태와 source 종류이고 출력은 fact마다 owning source와 authority를 가진 이야기 snapshot이다. Chat 기억, filename, 생성 응답, render 또는 더 하류의 실현 결과는 명시적 승격 결정 없이 이야기 사실을 만들 수 없다.

<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-fact-fiction-provenance 사실, 인용, 해석과 창작을 분리하는 입력 계약을 정한다. -->
<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-information-provenance 인물 자료의 출처와 각색 경계를 같은 권위 모델에 포함한다. -->

외부 사실과 사용자 제공 자료는 source 위치, 판본, 관찰 범위, confidence, 허용 범위와 해석을 기록하고 창작 사실과 구분한다. 출처가 없거나 서로 충돌하는 주장은 unknown 또는 conflict로 출력하며 그럴듯한 보완문으로 승인 상태를 만들지 않는다.

### 안정된 이야기 Identity {#narrative-intent-story-unit-identity}

<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-stable-unit-identity 모든 이야기 단위의 안정 identity와 alias 충돌 검출을 정한다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-sequence-identity sequence의 title과 정렬을 identity에서 분리한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-number-soft-lock scene 번호와 identity의 다른 수명 주기를 보존한다. -->

Premise, logline, sequence, beat, scene, character, relation, utterance와 semantic event는 표시명, 순서와 파일 위치와 독립된 identity를 가진다. 같은 identity의 동시 중복, alias 충돌, tombstone identity 재사용과 내용 교체는 거절되고 rename과 reorder는 identity를 보존한다.

## 이야기 사다리 불변식 {#narrative-intent-story-ladder-invariants}

### Logline과 Premise 입력 {#narrative-intent-logline-premise-input}

<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-progressive-refinement 각 단계가 바로 위 약속을 더 구체화하는 관계를 정한다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-treatment-sequences treatment가 작품의 상태 변화를 전개하는 수준임을 보존한다. -->

사다리는 premise와 logline에서 treatment와 sequence, beat, scene으로 내려가며 각 하류 단위는 바로 위 단위, 구체화한 약속과 남겨 둔 미정을 가리킨다. 하류는 상위의 문장 복제나 camera 지시가 아니고 상위 약속을 바꾸려면 새 상위 revision이 먼저 필요하다.

<!-- @evidence requirements/story/logline-and-premise.md#story-logline-premise 작품의 압축된 약속이 보존해야 할 핵심 요소를 정한다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-premise-question premise의 가정, 질문과 금지된 해결을 구분한다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-observable-core 추상적 약속을 관찰 가능한 시작과 종료 변화에 연결한다. -->

Logline 입력은 작품에 필요한 주체, 중심 상황 또는 목표, 대립 힘, stakes와 변화 방향을 명시하고 의도적으로 쓰지 않는 요소와 미정 요소를 구분한다. Premise는 world assumption, dramatic question, 금지된 해결과 답변 범위를 분리하며 출력은 하류 coverage가 반증할 수 있는 promise identity 집합이다.

### Promise Scope와 Closure {#narrative-intent-logline-promise-closure}

<!-- @evidence requirements/story/logline-and-premise.md#story-logline-scope-bound 초기 약속의 인물, 장소, 시간과 사건 규모 상한을 보존한다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-logline-overclaim-refusal 하류가 실현할 수 없는 과잉 약속을 named failure로 만든다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-logline-promises-exclusions 필수 약속과 명시적 제외를 분리한다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-logline-opening-ending-relation opening과 ending의 대응을 판정 가능하게 만든다. -->

각 promise는 포함 범위, 제외 범위, 시작 상태, 종료 또는 의도된 미해결 상태와 성공 및 파기 조건을 가진다. 선언 상한을 넘거나 관찰 수단과 제작 경계가 없는 promise는 자동 축소하지 않고 overclaim으로 출력하며 ending은 opening의 질문과 state를 어떻게 답하는지 연결한다.

### Sequence Refinement와 Coverage {#narrative-intent-sequence-refinement}

<!-- @evidence requirements/story/treatment-and-sequences.md#story-treatment-coverage 각 logline 약속을 sequence 역할과 연결한다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-sequence-scale-weight story duration과 예상 screen-time 비중을 실제 edit 길이에서 분리한다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-treatment-completeness 작품이 선언한 구조의 closure를 검증한다. -->

Sequence는 목적, 시작과 종료 조건, 포함 beat, 앞뒤 관계, coverage role, 예상 story duration과 상대적 screen-time 비중을 출력한다. Opening, development, decisive turn, climax와 ending 중 작품이 선언한 구조만 필수이며 빈 구조 구간, 상위 근거 없는 sequence와 하류가 답하지 않는 promise는 서로 다른 gap이다.

### Scene Prose와 Index {#narrative-intent-scene-prose-index}

<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scenes-observable-action scene을 관찰 가능한 이야기 계약으로 정한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose index를 두 번째 축약 screenplay로 만들지 않는다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc scene의 국소 변화 목적을 보존한다. -->

Authoritative prose는 heading, 행동과 dialogue를 소유하고 index는 stable scene identity를 prose, sequence와 beat에 연결한다. Index가 prose를 다시 요약하여 서로 다른 사실 owner가 되어서는 안 되며 heading, 장소, 시간, 참여자 또는 포함 beat 충돌은 source-authority failure로 출력한다.

각 script와 screenplay group index의 managed block은 canonical filename order의 unit link와 unit H1 label만 포함한다. Generation과 check는 동일한 pure rendering result를 사용하고, 반복 generation은 byte-identical하며, managed delimiter 밖의 authored content는 보존한다.

## 형식과 Content 경계 {#narrative-intent-story-form-content-boundary}

### Unknown과 Review 상태 {#narrative-intent-story-unknown-review-state}

<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-open-form 하나의 장르 구조를 모든 작품에 강제하지 않는다. -->
<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-capability-content-boundary 저작 capability를 완성 content 제공 약속과 분리한다. -->

시스템은 극영화, 다큐멘터리형, 광고, 뮤직 비디오, 교육, 실험, 무성 또는 project-defined 형식의 단위와 관계를 보존하지만 protagonist, dialogue, 3막, plot, character 또는 ending을 기본 content로 생성하지 않는다. 예시는 identity, citation과 observable refinement 기법만 가르치며 새 작품의 정본이 아니다.

<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-unknown-preservation 미정 의도에 owner와 영향 범위를 부여한다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-premise-review-status premise의 draft와 승인 상태를 구분한다. -->
<!-- @evidence requirements/story/logline-and-premise.md#story-logline-alternatives logline 대안을 독립된 후보로 보존한다. -->

Unknown은 owner, 영향 단위, 필요한 결정 입력과 blocking 여부를 가지고 빈 문자열이나 임시 content와 구분된다. Draft, under-review, approved, rejected와 superseded 상태가 명시되지 않으면 current authority를 추정하지 않으며 복수 승인 후보와 선택되지 않은 alternative는 conflict 또는 pending-selection으로 출력한다.
