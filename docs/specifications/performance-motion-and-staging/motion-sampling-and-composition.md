# Motion sampling과 composition

## Motion identity, source와 선택 {#performance-motion-identity-source-selection}

### 외부 motion 채택과 비파괴 receipt {#performance-motion-external-adoption-receipt}

Generated project는 exact glTF, GLB 또는 VRM byte path와 명시 profile을 받는 inspector command를 제공한다. Inspector는 source-order node identity, hierarchy, local rest transform, dependency, take와 channel facts만 반환한다. Semantic bone mapping, native use 또는 retarget adoption은 별도 저작 결정이며 inspector가 추론하지 않는다.

<!-- @evidence requirements/motion/scope-and-identity.md#motion-scope-identity motion을 시간에 따른 명시적 state 변화로 정의한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-all-objects-all-motion actor뿐 아니라 모든 object와 열린 동작 vocabulary를 수용한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-source-kinds authored, procedural, captured, imported source kind를 구분한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-variant-selection motion variant와 사용자 선택을 보존한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-meaning-technique 의미 계약과 이를 실현하는 기법을 분리한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-actor-object-scope skeletal actor와 non-skeletal object의 motion 표현 차이를 허용한다. -->
<!-- @evidence requirements/motion/scope-and-identity.md#motion-missing-refusal 필요한 motion이 없을 때 silent substitute를 거부한다. -->

Motion record는 stable motion identity와 revision, 수행 주체 또는 대상 kind, semantic action, source kind와 source identity, local duration, channel set, event set, 시작·종료 state contract를 가진다. 의미는 `걷는다`, `문이 열린다`, `천이 흔들린다` 같은 관찰 가능한 변화이며 clip, procedural rule, solver, captured data는 그 의미를 실현하는 선택 가능한 technique다. 같은 의미에 여러 variant가 있으면 사용자는 style, speed, contact policy, rig compatibility, cost와 provenance를 보고 하나를 선택하고 그 decision을 receipt로 남긴다.

`all objects/all motion`은 모든 가능한 동사를 미리 열거하거나 어떤 입력도 무조건 재생한다는 뜻이 아니다. 모든 시간 변화가 typed channel과 profile·affordance·constraint로 추가될 수 있고, 새 motion source와 driver가 additive하게 등록될 수 있다는 확장성 계약이다. 요구 의미를 지원하는 channel, capability 또는 source가 없으면 `missing-motion`으로 남기고 비슷한 기본 clip, rest state, 무작위 움직임을 자동 적용하지 않는다.

<!-- @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption 사용자가 선택한 외부 motion을 provenance와 함께 채택한다. -->
<!-- @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode source를 그대로, retarget, trim, layer 중 어떤 방식으로 채택했는지 명시한다. -->
<!-- @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis 외부 motion의 skeleton, unit, axis와 time basis를 기록한다. -->
<!-- @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override compatibility finding과 사용자 override를 분리한다. -->
<!-- @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt 원본을 보존하는 변환·선택 receipt를 출력한다. -->
<!-- @evidence requirements/motion/external-motion-inputs.md#motion-external-input-refusal 손상되거나 의미가 불명한 외부 motion을 거부한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest 외부 motion과 그 dependency bytes를 content digest로 고정한다. -->

External intake는 원본 bytes와 dependency digest, format·version, channel inventory, source rig와 rest basis, units·axes·handedness, sample clock, clip range, loop metadata, embedded events, root policy를 검사한다. Adoption mode는 `as-is`, `normalized`, `retargeted`, `trimmed`, `layered`, `reference-only`처럼 결과를 어떻게 사용할지 표현하고, 원본은 수정하지 않는다. 변환 결과는 source digest, normalization·retarget parameters, selected range, event mapping, discarded channel과 loss, target identity, output digest를 가진 receipt로 연결한다.

Compatibility finding은 source와 target의 차이에 대한 시스템 판단이고 override는 그 위험을 감수하겠다는 사용자 결정이므로 하나로 합치지 않는다. Unknown basis, invalid time order, missing target channels, corrupt payload, unresolved semantic mapping, prohibited license 또는 deterministic decoding 불가는 실패다. 사용자가 override해도 수치상 읽을 수 없는 데이터나 권한 없는 source는 채택할 수 없으며, override가 자동 검증 결과를 `passed`로 바꾸지 않는다.

## Channel, control과 driver 평가 {#performance-motion-channel-control-driver-evaluation}

### Clip, key time과 interpolation {#performance-motion-clip-keytime-interpolation}

<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channels-controls-drivers 모든 object motion을 addressable channel 변화로 표현한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-contract channel address, value type, unit와 retention을 정의한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-dependencies driver dependency와 평가 순서를 명시한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-control-ownership 각 channel을 쓰는 control과 layer authority를 구분한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-extensibility 새 channel family를 additive하게 확장한다. -->
<!-- @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-driver-refusal dangling, cyclic, ambiguous driver를 거부한다. -->

Channel contract는 stable address, owner identity, property path 또는 semantic control, scalar·vector·quaternion·variable-width value type, unit, coordinate frame, neutral·default, legal range, sparse retention과 interpolation semantics를 선언한다. Node transform, joint angle, morph weight, material·light·camera·domain property는 모두 같은 addressable 원칙을 사용할 수 있지만, 실제 applier가 지원하는 target만 허용한다. Validation이 받아들였지만 playback이 쓰지 않는 channel은 허용하지 않는다.

Track sampling, authored controls, driver computation, constraints, solver correction, layer composition의 평가 단계를 고정하고 각 channel에 단계별 writer를 기록한다. Driver graph는 dependency order가 유일하게 결정되어야 하며, 여러 writer가 있으면 mask·weight·blend mode·precedence 또는 explicit conflict policy가 필요하다. Unknown channel, width·unit 불일치, quaternion 규칙 위반, cycle, dangling input, non-finite output, unbounded iterative state는 실패로 반환한다.

새 profile이나 property는 channel shape, applier, validator, deterministic sampler와 omission compatibility를 함께 제공할 때 추가할 수 있다. 새 optional channel을 쓰지 않는 기존 clip은 byte-equivalent한 resolved state를 유지하며, default나 retention 의미를 바꾸는 변경은 versioned migration이다.

<!-- @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clips-keyframes 재현 가능한 clip을 ordered key와 duration으로 정의한다. -->
<!-- @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times key time의 범위와 strict ordering을 규정한다. -->
<!-- @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation channel type에 맞는 보간을 선택한다. -->
<!-- @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-sparse-channel-default sparse key에서 누락 channel의 상태를 명시한다. -->
<!-- @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-loop-trim loop seam과 trim boundary를 검증한다. -->
<!-- @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-clip-refusal 시간, 값 또는 target이 잘못된 clip을 거부한다. -->

Clip은 stable identity, local duration, loop·trim policy, 하나 이상의 channel track, semantic events와 source lineage를 가진 시간 함수다. 각 track의 key time은 유한하고 0 이상 duration 이하이며 엄격히 증가하고, 같은 channel과 time의 중복 key는 conflict다. Segment는 step, linear, quaternion shortest-path, cubic 또는 명시된 curve 중 value type에 맞는 보간을 사용하고, curve control과 tangent가 legal range에 있어야 한다.

Sparse state는 channel별로 rest, prior key hold, prior layer state, explicit neutral 중 하나의 선언된 기본을 사용한다. Clip 첫 key 이전과 마지막 key 이후, 빈 gap, exact boundary의 sample 규칙은 모든 consumer에서 동일해야 한다. Loop는 last-to-first value, derivative 또는 선언된 discontinuity와 event duplication을 검사하고, trim은 boundary state와 포함·제외 event를 새 clip receipt에 기록한다.

Key 부족, target rig·object 불일치, duration 밖 key, unsupported interpolation, variable-width 변화, loop seam 위반, source digest 불명은 실패다. 실패 clip을 재생하지 않고 마지막 valid pose나 rest로 숨기지 않으며, 사용자가 수정, 다른 variant, partial channel adoption, 보류를 선택하게 한다.

### Layer, mask와 transition composition {#performance-motion-layer-mask-transition-composition}

<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-layers-blends-transitions 여러 motion을 명시적 composition으로 결합한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership layer별 channel ownership과 conflict를 판정한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-mask-weight mask, weight와 blend mode의 의미를 정의한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-transition-window source와 target 사이 transition window를 고정한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-phase-alignment gait와 cyclic layer의 phase를 정렬한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-event-composition event와 종료 state도 layer composition에 포함한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-blend-refusal 불명확하거나 물리 의미를 깨는 blend를 거부한다. -->

Composition 입력은 ordered layer identity, clip 또는 procedural source, active interval, channel mask, normalized weight curve, override·additive·multiply 같은 blend mode, reference state, phase와 event policy다. Disjoint channel은 동시에 합성할 수 있고 같은 channel은 선언된 precedence 또는 수학적 blend만 허용한다. Body-region 이름은 최종 channel set을 결정하는 편의이고, 실제 conflict 판정은 root, joint, expression과 object property를 포함한 살아남은 channel로 수행한다.

Transition은 source와 target state, window, easing, interruptibility, phase alignment와 contact preservation policy를 가진다. Locomotion 전환은 발 지지 phase와 root speed를 정렬하고, 같은 event를 양쪽 layer가 갖는 경우 stable event identity와 merge·select·suppress 규칙을 적용한다. Layer가 끝나면 output retention이 다음 layer와 shot handoff에 무엇을 넘기는지 명시한다.

같은 channel을 두 override layer가 동등 authority로 쓰거나 additive reference가 없거나 weight가 범위를 벗어나거나 phase를 구할 수 없거나 transition이 필수 contact·semantic event를 없애면 `blend-conflict`다. 자동 normalize나 마지막 입력 우선으로 문제를 숨기지 않는다.

### Motion clock와 semantic event {#performance-motion-clock-semantic-event}

<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-timing-semantic-events motion과 story 사건을 같은 명시적 clock 관계에 둔다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-event-markers clip 내부 event marker를 addressable하게 만든다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-event-identity-payload event identity, kind, subjects와 payload를 보존한다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-story-film-time story, shot-local, film time의 mapping을 명시한다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-boundary-sampling exact start, end와 frame-grid sample 규칙을 정의한다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-retime-event-preservation retime과 trim 뒤에도 event 순서와 identity를 보존한다. -->
<!-- @evidence requirements/motion/timing-and-semantic-events.md#motion-timing-refusal clock이나 event mapping이 모순되면 거부한다. -->
<!-- @evidence requirements/story/story-clock-and-state.md#story-presentation-chronology story clock과 편집 순서를 구분한다. -->

모든 motion은 local seconds에 정의되고 production frame clock에 정확히 sample된다. Shot-local time, film edit time, 선택적 story time 사이의 mapping은 origin, positive rate, trim과 transition으로 명시하며 어느 clock도 다른 clock을 암묵적으로 대신하지 않는다. Event는 stable occurrence identity, semantic kind, involved subjects, source marker 또는 computed producer, local time이나 window, optional payload와 measurement target을 가진다.

Exact start는 시작 state를 포함하고 exact end의 포함 여부는 clip·cue contract가 고정하며, 인접 interval에서 event가 중복 또는 유실되지 않게 half-open 또는 명시된 boundary law를 사용한다. Retime은 state sampling뿐 아니라 marker time, contact window, gait phase와 downstream sound·reaction binding을 함께 변환한다. 역전되거나 비단조인 mapping, frame grid 밖 required event, duration 밖 marker, duplicate occurrence identity, event order의 causal 역전은 실패다.

### 결정론적 sampling과 검증 receipt {#performance-motion-deterministic-sampling-validation}

<!-- @evidence requirements/motion/validation-and-determinism.md#motion-validation-determinism 같은 input identity에서 모든 sample 결과를 재현한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-evaluation-receipt evaluator와 source identity를 receipt로 고정한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-scrambled-seek 순차 재생과 임의 seek가 같은 state를 내는지 확인한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-fixed-step-baked-state 상태적 solver를 fixed-step 또는 baked state로 재현한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-interior-sample-validation endpoint뿐 아니라 내부 sample을 검증한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-numeric-stability 장시간, 큰 좌표와 반복 평가의 수치 안정성을 검사한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-visual-review 자동 수치 검증과 current visual review를 함께 요구한다. -->
<!-- @evidence requirements/motion/validation-and-determinism.md#motion-validation-status passed, failed, unsupported, not-run과 stale을 구분한다. -->

Evaluation identity는 normalized motion·rig·object·world input digest, evaluator contract version, frame clock, explicit seed, fixed-step 설정, chosen adoption·layer·retarget decisions를 포함한다. Pure channel은 임의 time에서 직접 평가하고, spring·secondary simulation 같은 stateful channel은 고정 step과 초기 state, checkpoint 또는 immutable baked cache로 평가해 순차 재생과 scrambled seek가 tolerance 안에서 같은 결과를 내야 한다.

검증은 시작·끝뿐 아니라 key 사이, event 주변, contact window, transition interior, loop seam과 extrema 후보를 production frame grid와 필요한 보조 sample에서 검사한다. 결과 receipt는 sample set, resolved state digest, ROM·speed·acceleration·contact·ground·intersection·numeric finding, deterministic replay 비교, current visual evidence identity를 가진다. 같은 입력의 반복 실행이 다른 결과를 내거나 non-finite·폭주·seek divergence가 나타나면 실패하고 성공 frame만 골라 보고하지 않는다.

Visual review는 speed, half-speed, frame-step에서 foot slide, penetration, float, joint flip, contact drift, eye pop, frozen hold, settle과 semantic intent를 판단한다. 수치 gate가 통과해도 잘못된 dramatic verb는 review 실패일 수 있고, review가 좋아 보여도 malformed clock이나 ROM error는 통과할 수 없다. `unsupported`, `not-run`, `stale`은 `passed`가 아니며 자동 교정이 원래 motion과 event를 바꿨다면 새 decision과 receipt를 요구한다.
