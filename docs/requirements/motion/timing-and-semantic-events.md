# Timing과 Semantic Event

## Motion과 이야기 사건의 같은 Clock {#motion-timing-semantic-events}

Motion cue, pose sample, contact, sound, camera response와 story semantic event는 fixed film clock의 명시적 time 또는 interval에 연결되어야 한다.

### Event Marker {#motion-event-markers}

Plant, grasp, release, impact, apex, turn, look와 utterance cue를 motion source의 marker로 지정하고 trim, loop와 time scale 뒤의 resolved time을 계산할 수 있어야 한다.

### Event Identity와 Payload {#motion-event-identity-payload}

Event는 stable identity, source marker, subject와 target, semantic kind, payload, interval 또는 instant, ordering relation과 observable consequence를 가져야 하며 같은 이름의 marker를 같은 사건으로 합치지 않아야 한다.

### Story Time과 Film Time {#motion-story-film-time}

Story duration, performance local time, shot start offset와 film time을 구분하여 edit 순서나 frame index를 world time으로 오인하지 않아야 한다.

### Boundary Sampling {#motion-boundary-sampling}

Start, end, exact key, loop seam, zero-duration hold와 frame-grid 사이 event의 sampling rule을 고정하여 consumer마다 한 frame씩 어긋나지 않아야 한다.

### Retime과 Event 보존 {#motion-retime-event-preservation}

Trim, loop, reverse, time scale, phase alignment와 transition이 event를 복제, 삭제 또는 순서 변경하는 규칙을 선언하고 required semantic event의 resolved film time을 추적해야 한다.

### Timing Refusal {#motion-timing-refusal}

Negative duration, reversed interval, duplicate exclusive event, film 밖 required event와 motion state가 없는 marker를 거부해야 한다.
