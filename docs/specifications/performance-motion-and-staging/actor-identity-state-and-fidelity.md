# 배우 정체성, 상태와 fidelity

## 공연 주체의 정체성과 선택 {#performance-actor-identity-selection-boundary}

### Story 수행과 시간 상태 {#performance-actor-story-performance-state}

<!-- @evidence requirements/actors/scope-and-identity.md#actor-scope-identity story상의 존재와 실제 공연 표현을 안정된 identity로 연결하는 경계를 정의한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-character-distinction character 사실과 actor 표현의 수명을 분리한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-open-performer-kind human에 고정하지 않는 performer kind 입력을 허용한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-authored-facts 추정하지 않고 authored fact만 actor 상태로 채택한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-identity-representation-lifetime 표현 교체 중에도 논리 identity와 연속성을 보존한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-open-control-vocabulary 새로운 profile과 control vocabulary를 additive하게 수용한다. -->
<!-- @evidence requirements/actors/scope-and-identity.md#actor-missing-binding 필요한 binding이 없을 때 명시적으로 거부한다. -->
<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-inputs-selection-replacement 사용자가 appearance, rig, motion, voice를 독립적으로 선택하는 입력 경계를 정의한다. -->
<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-independent-binding-selection 독립 선택의 조합을 하나의 암묵적 preset으로 합치지 않는다. -->
<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-external-rig-adoption 외부 rig를 선택 가능한 authoritative input으로 받는다. -->
<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-input-compatibility-preview 채택 전에 조합의 호환성과 손실을 preview한다. -->
<!-- @evidence requirements/actors/inputs-selection-and-replacement.md#actor-selection-replacement-receipt 선택과 교체의 provenance를 receipt로 남긴다. -->

시스템은 story character identity, production actor identity, representation identity를 서로 다른 stable identity로 유지한다. 입력은 performer kind, story binding, 선택한 appearance·rig·motion·voice binding, 선택 시점의 revision과 사용자가 승인한 대안이며, 출력은 선택된 binding 집합과 각 source identity, normalization 상태, 적용 범위, 교체 lineage를 가진 actor record다. 같은 character를 다른 actor 또는 representation으로 교체해도 story 사실과 이미 승인된 state history는 자동으로 바뀌지 않으며, 한 actor가 여러 shot에 나타나도 placement나 clip instance가 actor identity를 새로 만들지 않는다.

선택은 구성 요소별로 독립적이어야 하고 시스템은 임의의 통합 preset을 만들지 않는다. 외부 입력은 byte digest, format, unit·axis·rest 기준, 지원 capability, license·provenance, compatibility finding을 제공해야 하며, 사용자는 그대로 채택, 정규화 후 채택, 의미 proxy와 결합, 대안 선택, 보류를 결정할 수 있다. 필수 binding이 없거나 두 binding이 동일 authority를 주장하거나 선택된 표현이 요구 capability를 제공하지 않으면 `missing-binding`, `authority-conflict`, `capability-gap`으로 거부하고 대체를 몰래 선택하지 않는다.

<!-- @evidence requirements/actors/performance-and-story-binding.md#actor-performance-story-binding story goal을 관찰 가능한 actor performance로 연결한다. -->
<!-- @evidence requirements/actors/performance-and-story-binding.md#actor-performance-precedence 겹치는 performance intent의 authority와 우선순위를 명시한다. -->
<!-- @evidence requirements/actors/performance-and-story-binding.md#actor-performance-capability-plan 필요한 capability와 대안 계획을 사전에 계산한다. -->
<!-- @evidence requirements/actors/performance-and-story-binding.md#actor-performance-local-clock 각 performance를 shot-local clock과 start offset에 놓는다. -->
<!-- @evidence requirements/actors/performance-and-story-binding.md#actor-performance-events-contacts performance가 semantic event와 contact를 실현하게 한다. -->
<!-- @evidence requirements/actors/performance-and-story-binding.md#actor-performance-gap 실현할 수 없는 story action을 gap으로 반환한다. -->
<!-- @evidence requirements/story/dramatic-characters-goals-and-relations.md#story-character-actor-binding dramatic character와 actor binding의 명시성을 보존한다. -->
<!-- @evidence requirements/story/beats-and-causality.md#story-semantic-event-identity beat의 상태 변화를 stable semantic event로 이어 준다. -->

Performance plan은 story beat와 시작 상태, 수행 주체, 대상, 동사 의미, 요구 capability, shot-local interval, semantic event, 종료 상태를 함께 받는다. 동일 actor의 여러 action이 겹치면 명시된 channel 또는 body-region ownership, authored layer order, causal event dependency가 우선하며, 어느 것도 없으면 입력 순서로 승자를 추정하지 않고 conflict를 반환한다. 출력은 선택된 action variant, local clock placement, 실현 event와 contact, 미실현 gap, 다음 shot에 넘길 종료 상태를 포함한다.

Story가 요구한 동작을 현재 rig나 motion source가 수행할 수 없으면 시스템은 가장 비슷해 보이는 다른 동작을 성공으로 기록하지 않는다. 사용자는 capability 추가, external motion 채택, staging 변경, story 수정, gap 보류 중 하나를 선택하며, 선택 전에는 해당 beat와 그에 의존하는 shot contract가 미충족 상태로 남는다.

### 상태 ledger와 연속성 {#performance-actor-state-continuity-ledger}

<!-- @evidence requirements/actors/state-and-continuity.md#actor-state-continuity actor의 장면 간 상태를 ledger로 보존한다. -->
<!-- @evidence requirements/actors/state-and-continuity.md#actor-state-authority-provenance 상태 값마다 source authority와 provenance를 유지한다. -->
<!-- @evidence requirements/actors/state-and-continuity.md#actor-scene-state-handoff scene 경계의 명시적 상태 전달을 요구한다. -->
<!-- @evidence requirements/actors/state-and-continuity.md#actor-shot-continuity 편집 경계에서 actor 상태의 양쪽 측정을 비교한다. -->
<!-- @evidence requirements/actors/state-and-continuity.md#actor-state-alternatives mutually exclusive state alternative를 분리한다. -->
<!-- @evidence requirements/actors/state-and-continuity.md#actor-state-unknown-not-applicable unknown과 not-applicable을 값 없음과 구분한다. -->
<!-- @evidence requirements/actors/state-and-continuity.md#actor-state-reset-refusal 근거 없는 default reset을 거부한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-state-ledger actor 상태가 상위 story state ledger와 모순되지 않게 한다. -->
<!-- @evidence requirements/story/scenes-and-observable-action.md#story-scene-boundary-continuity scene 출입 상태의 연속성 근거를 요구한다. -->

Actor state ledger는 identity를 키로 하여 pose·root transform·facing·gait phase·expression·gaze target·costume variant·attachment·held object·voice casting·injury 또는 story-specific state를 시간 구간별로 보존한다. 각 값은 `known`, `unknown`, `not-applicable` 상태와 authority, source revision, observation 또는 authored cause를 가지며, 값이 없다는 이유로 rest pose, neutral expression, 기본 의상, 빈 손으로 초기화하지 않는다.

연속 편집의 outgoing end와 incoming start는 동일한 측정 기준과 tolerance로 비교하며, match-on-action은 clip 이름이 아니라 root direction, joint·gait phase, attachment와 unresolved momentum이 호환되는지로 판단한다. 시간·장소가 바뀐 scene break는 carry contract를 생략할 수 있고, 의도적 불연속은 별도 authored cause를 요구한다. 동시에 존재할 수 없는 alternative는 같은 active ledger에 병합하지 않으며, 선택 변경은 이전 branch의 downstream evidence를 stale로 만든다.

### 외형, 의상과 부착물 {#performance-actor-appearance-costume-attachment}

<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-appearance-costume-attachments actor에 귀속되는 시각 상태의 ownership을 정의한다. -->
<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-costume-layers-variants costume layer와 variant의 조합 규칙을 정의한다. -->
<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-attachment-contact attachment와 실제 contact 상태를 구분한다. -->
<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-rigid-soft-binding rigid와 soft binding의 평가 차이를 보존한다. -->
<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-external-appearance-assets 외부 appearance asset을 provenance와 함께 채택한다. -->
<!-- @evidence requirements/actors/appearance-costume-and-attachments.md#actor-costume-intersection-refusal costume 관통과 분리 실패를 숨기지 않는다. -->
<!-- @evidence requirements/asset-authoring/identity-and-instances.md#asset-variant-inheritance costume과 attachment variant의 상속과 override를 추적한다. -->

Appearance state는 base representation, ordered costume layers, variant 선택, material·visibility state, rigid sockets, soft-deformation domain, contact anchors를 입력으로 받는다. 출력은 각 layer가 actor body 또는 다른 layer에 어떻게 결합되는지, 어떤 shot·time interval에 활성인지, 외부 asset digest와 proxy lineage가 무엇인지 포함하는 composition이다. 같은 부위를 배타적으로 점유하는 variant, 순환 attachment, 없는 socket, 서로 다른 skeleton을 암묵적으로 공유하는 layer는 조합 단계에서 거부한다.

Rigid binding은 parent frame과 offset을 결정론적으로 따라야 하고, soft binding은 rest state, attachment boundary, solver parameters, fixed-step 또는 baked cache identity를 가져야 한다. Attachment declaration은 결합 관계일 뿐 실제 접촉 성공의 증명이 아니므로, grip·seat·support와 필요한 clearance는 현재 pose와 geometry proxy로 별도 측정한다. 외부 appearance가 고해상도여도 contact와 collision 판단은 선언된 deterministic proxy를 사용하며, 관통·떠 있음·분리는 tolerance와 시간 위치를 가진 finding으로 반환한다.

### 음성, utterance와 표정 동기 {#performance-actor-voice-utterance-expression}

<!-- @evidence requirements/actors/voice-and-utterance-identity.md#actor-voice-utterance-identity voice와 utterance를 actor identity에 귀속한다. -->
<!-- @evidence requirements/actors/voice-and-utterance-identity.md#actor-voice-casting-selection voice casting을 사용자가 선택 가능한 binding으로 만든다. -->
<!-- @evidence requirements/actors/voice-and-utterance-identity.md#actor-voice-continuity shot과 scene 사이 voice identity 연속성을 검사한다. -->
<!-- @evidence requirements/actors/voice-and-utterance-identity.md#actor-utterance-performance utterance timing을 actor performance와 연결한다. -->
<!-- @evidence requirements/actors/voice-and-utterance-identity.md#actor-voice-source-choice local, external, recorded source 선택을 보존한다. -->
<!-- @evidence requirements/actors/voice-and-utterance-identity.md#actor-voice-refusal 승인되지 않은 voice 대체와 잘못된 lip sync를 거부한다. -->
<!-- @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-voice-text-separation 대사 텍스트와 voice 표현을 별도 authority로 유지한다. -->

Voice binding은 actor identity, language·locale, source kind, voice 또는 recording identity, consent·license provenance, synthesis model과 immutable revision, inference arguments를 가진다. Utterance는 screenplay text identity와 film-global interval, actor, performance intent를 참조하고, 출력 receipt는 source audio digest, sample clock, phoneme 또는 alignment 구간, viseme target, 적용 expression capability를 기록한다. 같은 텍스트라도 voice 또는 모델, 설정이 바뀌면 다른 receipt가 된다.

Voice continuity는 승인된 change event가 없는 동안 casting identity와 핵심 delivery 특성이 유지되는지 검사한다. 실제 alignment가 없으면 caption 구간에 문자를 균등 배치해 lip sync를 증명하지 않으며, mouth channel이 없는 representation에는 음성만 재생하고 표정 동기를 `unsupported`로 남긴다. source unavailable, language unsupported, consent·license 불명, speaker mismatch, utterance interval 초과는 실패이며 다른 목소리나 silence로 자동 대체하지 않는다.

### Pose, gaze와 expression 상태 {#performance-actor-pose-gaze-expression-state}

<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-expression-gaze 관찰 가능한 body, gaze, face state를 함께 정의한다. -->
<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-motion-distinction 정적 pose와 시간 motion을 구분한다. -->
<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-space-authority pose의 local·parent·world space와 authority를 명시한다. -->
<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention gaze target과 attention 의미를 연결한다. -->
<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels 지원되는 expression channel만 사용한다. -->
<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-pose-validation pose의 ROM, balance, contact와 readability를 검증한다. -->

Pose snapshot은 skeleton identity, root state, sparse articulated channels, gaze target과 attention weight, expression preset 또는 세부 channel, source authority를 가진다. 누락 joint는 해당 rig의 rest state를 뜻하지만, 누락 gaze·expression이 이전 시간의 값을 해제하는지는 layer retention rule이 정하며 암묵적 neutralization을 금지한다. Gaze는 눈만의 회전이 아니라 asset이 제공하는 eye·head·torso chain과 각 기여 한계를 사용하고, target이 사라지거나 unreachable이면 마지막 성공 상태, authored fallback, failure 중 선언된 정책을 따른다.

정적 pose는 하나의 시간 상태이고 motion은 여러 pose와 event를 연결하는 시간 함수다. Pose 입력 space와 변환 기준이 없거나 같은 channel을 두 source가 같은 authority로 쓰거나 asset에 없는 expression capability를 요구하면 거부한다. 출력은 resolved pose, constraint finding, contact·balance observation, target relation, 적용하지 못한 channel 목록이며, 얼굴 likeness나 미세 근육 fidelity를 성공 조건으로 확장하지 않는다.

### 표현 단계와 prototype fidelity 경계 {#performance-actor-representation-fidelity-boundary}

<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-representation-tiers shot 목적에 맞는 actor representation tier를 선택한다. -->
<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-direct-authoring-ceiling 직접 저작 actor의 crude proxy ceiling을 유지한다. -->
<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-fidelity-capability-separation appearance fidelity와 performance capability를 분리한다. -->
<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-external-representation 외부 actor representation을 additive path로 채택한다. -->
<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-shot-tier-selection shot별 tier 선택과 근거를 출력한다. -->
<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-tier-compatibility tier 전환 시 identity와 의미 상태를 보존한다. -->
<!-- @evidence requirements/actors/representation-tiers-and-fidelity-boundary.md#actor-quality-claim-boundary 검증한 품질 이상을 주장하지 않는다. -->
<!-- @evidence requirements/actors/body-scale-and-landmarks.md#actor-body-scale-landmarks 실제 단위 body scale과 landmark를 representation 공통 기준으로 둔다. -->
<!-- @evidence requirements/actors/body-scale-and-landmarks.md#actor-proportion-neutral neutral proportion과 rest measurement를 구분한다. -->
<!-- @evidence requirements/actors/body-scale-and-landmarks.md#actor-left-right-asymmetry 좌우 identity와 의도적 asymmetry를 보존한다. -->
<!-- @evidence requirements/actors/body-scale-and-landmarks.md#actor-bounds-shot-scale 현재 pose bounds를 shot scale 판단에 사용한다. -->
<!-- @evidence requirements/actors/body-scale-and-landmarks.md#actor-scale-validation scale과 landmark 모순을 검증한다. -->
<!-- @evidence requirements/product/prototype-quality.md#product-prototype-geometry 단순 geometry에서도 배치와 contact 의미를 검증 가능하게 유지한다. -->
<!-- @evidence requirements/product/scope-and-exclusions.md#product-detailed-likeness-exclusion 상세 인물 likeness를 직접 생성 범위에서 제외한다. -->

Representation tier는 한 actor identity를 표현하는 서로 다른 appearance·geometry·deformation 비용 상태다. 각 tier는 실제 단위 scale, 좌우와 front/up frame, neutral bounds와 움직이는 bounds 정책, landmark·socket·humanoid mapping 또는 capability map, supported performance channels, source/proxy lineage를 선언한다. Shot 선택 입력은 예상 화면 기여도, 요구 silhouette·contact·expression evidence, performance capability, cost budget이며, 출력은 선택 tier와 측정 근거, fallback 순서다.

직접 저작의 기본 ceiling은 stickman, primitive 또는 동등한 crude proxy다. 이 제한은 motion·contact·state 의미를 빈약하게 만들지 않으며, 단순 형상 위에서도 skeleton, affordance, bounds, gait, attachment, event를 상세하게 유지한다. 더 높은 appearance fidelity는 사용자가 선택한 외부 asset이나 별도 authorized rendition으로만 추가하며, 고해상도 외형이 rig capability, contact correctness, likeness approval을 자동으로 증명하지 않는다.

Tier 교체는 actor identity, scale, handedness, root basis, required bone·socket·expression mapping, costume·attachment state, current pose와 event timing을 보존해야 한다. 보존할 수 없는 항목은 loss report와 preview를 요구하고 승인 전에는 교체하지 않는다. 직접 측정하지 않은 likeness, 피부·머리카락·cloth realism 또는 speech performance를 `passed`로 주장하지 않으며 `unsupported`, `not-run`, `needs-review`를 성공과 구분한다.

### 반복 actor, doubles와 population budget {#performance-actor-population-double-variation}

<!-- @evidence requirements/actors/populations-and-doubles.md#actor-populations-doubles 개별 hero와 반복 population의 identity 비용을 구분한다. -->
<!-- @evidence requirements/actors/populations-and-doubles.md#actor-prototype-variation prototype 공유와 seed 기반 variation을 결합한다. -->
<!-- @evidence requirements/actors/populations-and-doubles.md#actor-doubles-replacement double과 hero representation 교체의 연속성을 보존한다. -->
<!-- @evidence requirements/actors/populations-and-doubles.md#actor-population-budget population을 명시적 비용 한계 안에서 유지한다. -->
<!-- @evidence requirements/actors/populations-and-doubles.md#actor-population-refusal 무제한 개별 actor 확장과 비결정적 다양화를 거부한다. -->

Population은 shared prototype identity와 deterministic member identity, count, seed, bounded variation profile, hero 또는 double override로 구성한다. 익명 구성원은 집단 문맥에서 재생성 가능한 identity를 가지되 개별 story state를 자동으로 부여받지 않고, 이름 있는 인물이나 close performance가 필요한 slot만 명시적으로 승격한다. Variation은 허용 property와 분포·범위, domain-separated seed, 상관 규칙을 선언하며 unseeded randomness와 per-frame resampling을 금지한다.

Double은 원 actor를 대체하는 별도 representation binding이며, 얼굴이 닮았다는 추정이 아니라 허용 shot range, scale·silhouette·costume·motion compatibility와 교체 receipt로 승인된다. Count, hero 수, variation cardinality, active channels, memory·draw cost가 budget을 넘으면 quality를 임의로 낮추거나 구성원을 조용히 삭제하지 않고 사용자가 count, tier, shot, budget 중 무엇을 바꿀지 선택하게 한다.

### Actor 검증 결과와 호환성 {#performance-actor-validation-output-compatibility}

<!-- @evidence requirements/actors/validation.md#actor-validation actor 전체 계약을 같은 identity와 revision에서 검증한다. -->
<!-- @evidence requirements/actors/validation.md#actor-numeric-geometry-validation 수치, 좌표, bounds와 geometry proxy의 유효성을 검사한다. -->
<!-- @evidence requirements/actors/validation.md#actor-purpose-validation shot 목적과 요구 capability에 맞춘 검증을 수행한다. -->
<!-- @evidence requirements/actors/validation.md#actor-input-binding-validation 외부 입력과 binding 조합의 완전성을 검사한다. -->
<!-- @evidence requirements/actors/validation.md#actor-multi-angle-review silhouette와 articulation을 여러 각도에서 검토한다. -->
<!-- @evidence requirements/actors/validation.md#actor-current-evidence current input과 A/B evidence를 묶는다. -->
<!-- @evidence requirements/actors/validation.md#actor-validation-ceiling 자동 검증과 사람 판단의 ceiling을 분리한다. -->

Actor validation 입력은 actor record, 모든 선택 binding의 immutable identity, 요구 shot·event·review context, frame clock과 tolerance다. 결과는 `passed`, `failed`, `unsupported`, `not-run`, `stale`을 항목별로 반환하고, 각 finding에 대상 identity, time 또는 pose sample, 기대값, 실제값, tolerance, source revision과 권장 사용자 선택을 포함한다. Numeric·unit·axis·scale·bounds·mapping·capability·ROM·attachment·continuity 검증은 자동 판단하고, silhouette·표정 전달·의상 읽힘·likeness는 current multi-angle frame evidence에 대한 별도 review로 남긴다.

기존 actor input에 새 optional binding이나 capability vocabulary를 추가해도 이를 쓰지 않는 기록의 의미와 결과는 바뀌지 않아야 한다. 반대로 normalized basis, mapping, state retention, authority precedence처럼 기존 결과를 재해석하는 변경은 contract version과 migration receipt를 요구한다. Evidence fingerprint와 actor 또는 source digest가 달라지면 이전 pass는 stale이며, 오래된 frame이나 다른 tier의 결과를 현재 actor의 성공으로 재사용하지 않는다.
