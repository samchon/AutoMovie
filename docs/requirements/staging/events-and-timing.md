# Event와 Timing

## 장면의 의미를 고정하는 Event {#staging-events-timing}

Staging event는 stable identity, time 또는 interval, subject, action, target, observable consequence와 related story beat를 가져야 한다.

### Fixed Film Clock {#staging-fixed-film-clock}

Motion, camera, light, sound, effect와 state change는 같은 film clock을 사용하고 component-local offset과 source time을 명시적으로 변환해야 한다.

### Event Order {#staging-event-order}

Precondition, simultaneous group, dependency와 consequence를 표현하고 단순 배열 순서가 causal order를 대신하지 않아야 한다.

### Frame Grid와 Event {#staging-event-frame-grid}

Event time이 frame 사이에 있을 때 sampling, first observable frame, sound emission와 acceptance tolerance를 명시하여 consumer마다 다른 frame을 선택하지 않아야 한다.

### Event Refusal {#staging-event-refusal}

Shot 밖 required event, duplicate exclusive event, reversed dependency, missing consequence와 관찰 불가능한 event를 거부해야 한다.
