# Temporal State와 Continuity {#temporal-state-continuity-specification}

## Unified Temporal State {#clv-unified-temporal-state}

<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-temporal-state-continuity Sun, practical, event와 environment를 film·story time의 상태로 정규화한다. -->
<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-state-time-sampling Story, shot-local과 rational frame clock의 mapping을 고정한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-fixed-film-clock Camera, light, motion과 event가 같은 film clock을 사용하게 한다. -->

Temporal context는 rational film clock, optional story clock, shot-local origin과 rate, interval endpoint rule, simultaneous-event rule와 exact conversion identity를 가진다. Camera, source light, practical, environment, material, geometry opening, effect와 visibility state는 같은 film sample을 읽고 각 component의 local clock은 명시적 mapping을 거친다.

State evaluation은 requested time을 직접 resolve하며 playback delta를 누적하거나 previous-frame result를 초기값으로 사용하지 않는다. 별도 presentation exposure가 같은 clock에서 변해도 scene light state와 합치지 않는다.

### Cue, Event와 Observable Transition {#clv-light-cue-observation}

<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-cues-events Switch, ignition, flash와 daylight transition을 semantic event에 연결한다. -->
<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-cue-observation Cue의 source transition과 first·peak·last observable sample을 연결한다. -->
<!-- @evidence requirements/staging/events-and-timing.md#staging-event-observation State transition과 관찰 가능한 camera evidence를 함께 요구한다. -->

Cue는 stable event identity, source precondition, affected sources·practicals·surfaces, transition interval, first·peak·last observable sample, camera delivery와 related sound·effect event를 가진다. 같은 timestamp의 cue는 simultaneous group 또는 declared priority와 conflict rule을 사용한다.

Trigger receipt는 event가 평가됐음을 증명할 뿐 관객 전달을 증명하지 않는다. Cue acceptance는 state transition observation과 해당 camera sample의 image-space 또는 audible consequence를 함께 요구한다.

## Cross-shot Lighting Continuity {#clv-cross-shot-lighting-continuity}

<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-story-continuity Sun, practical, shadow, reflection과 exposure intent의 shot 간 관계를 추적한다. -->
<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-state-lineage Effective light state가 phase, revision, event, time과 take를 가리키게 한다. -->
<!-- @evidence requirements/staging/state-handoff-and-continuity.md#staging-cross-domain-continuity Camera, opening, practical, shadow와 weather를 같은 boundary에서 비교한다. -->

각 shot sample의 effective lighting state는 production-design phase, location·environment revision, inherited base, source event, story-time sample, shot-local override와 take identity를 가리킨다. Connected shot boundary는 source identity, sun direction, practical control, shadow orientation, reflective·wet material state, environment와 exposure intent를 같은 story state에서 비교한다.

### Edit Transition과 World State {#clv-edit-presentation-light-boundary}

<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-edit-transition Edit overlap과 world lighting state를 분리한다. -->
<!-- @evidence requirements/camera/continuity-and-intentional-violations.md#camera-continuity-intentional-violations Camera와 lighting relation을 sequence에서 함께 추적한다. -->

Cut, dissolve, fade와 time jump는 presentation transition state와 source world-light state를 별도 channel로 가진다. Edit overlap이 두 shot의 pixels를 혼합해도 world state를 보간하거나 source light를 변경하지 않으며, time jump의 전후 state는 story-time mapping 또는 declared discontinuity를 가진다.

### Alternative State와 Refusal {#clv-temporal-alternative-refusal}

<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-state-alternatives Daylight, practical, relight와 failure take의 state lineage를 분리한다. -->
<!-- @evidence requirements/lighting/temporal-state-and-continuity.md#lighting-state-refusal Missing cue, unexplained reset와 film-range 밖 event를 거부한다. -->

같은 scene의 daylight, practical, dramatic relight와 failure take는 independent branch identity, inherited state, local changes, valid interval와 continuity consequence를 가진다. 한 branch의 시작과 다른 branch의 종료 또는 evidence를 결합하지 않는다.

Required cue 누락, shot boundary의 설명 없는 reset, mutually exclusive state, source off·emission on 모순, ambiguous simultaneous transition와 film range 밖 critical event는 `failed`다. 지원되지 않은 temporal appearance는 source-state evaluation과 분리해 `unsupported`로 보고한다.
