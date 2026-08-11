# 시간 State와 Continuity

## Film Clock에서 변하는 Light {#lighting-temporal-state-continuity}

Sun, sky, practical, event light와 environment state를 film time, story time 또는 named phase에 연결하고 deterministic curve로 sample할 수 있어야 한다. 별도 presentation exposure가 변하면 같은 clock에 연결하되 scene light state로 합치지 않아야 한다.

### Time Mapping와 Sampling {#lighting-state-time-sampling}

Story time, shot-local time와 rational frame clock의 mapping, curve interpolation, interval endpoint와 simultaneous cue rule을 선언하고 임의 playback step이나 이전 frame state로 light를 적분하지 않아야 한다.

### Cue와 Event {#lighting-cues-events}

Switch, ignition, flash, explosion, vehicle pass, screen change와 daylight transition을 semantic event, duration와 affected sources에 연결해야 한다.

### Cue Observation {#lighting-cue-observation}

각 required cue는 source state transition, first·peak·last observable sample, affected practical·surface·camera와 sound·effect event를 연결하고 trigger가 기록되었다는 사실만으로 frame 전달을 통과시키지 않아야 한다.

### Story Continuity {#lighting-story-continuity}

같은 장소와 시간의 shot 사이 sun, practical state, shadow direction, wet reflection와 exposure intent가 이어지거나 authored change를 가져야 한다.

### State Lineage {#lighting-state-lineage}

각 shot의 effective light state는 production design phase, location·environment revision, 발생 event, story-time sample와 take identity를 가리키고 어느 inherited state와 shot-local change가 결합되었는지 추적할 수 있어야 한다.

### Edit Transition {#lighting-edit-transition}

Cut, dissolve, fade와 time jump에서 source lighting state와 presentation transition을 구분하고 edit overlap이 world light를 바꾸지 않아야 한다.

### Alternative State {#lighting-state-alternatives}

같은 scene의 daylight, practical, dramatic relight와 failure take는 독립 state branch와 continuity consequence를 가지며 한 branch의 시작과 다른 branch의 종료 또는 evidence를 조합하지 않아야 한다.

### State Refusal {#lighting-state-refusal}

Required cue 누락, shot 경계의 unexplained reset, source off·emission on 모순과 film range 밖 critical event를 거부해야 한다.
