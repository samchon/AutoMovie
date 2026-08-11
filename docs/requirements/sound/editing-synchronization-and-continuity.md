# 편집, Synchronization과 Continuity

## Picture Edit와 함께 이어지는 Sound {#sound-editing-sync-continuity}

Audio source range, film range, trim, fade, transition, J-cut, L-cut, prelap, tail와 room tone을 edit timeline에서 picture와 독립적으로 표현할 수 있어야 한다.

### Event Sync {#sound-event-synchronization}

Dialogue onset, foot plant, impact, door, music marker와 visual semantic event의 emission·arrival·presentation time을 구분하여 허용 tolerance 안에서 검증해야 한다.

### Boundary Continuity {#sound-boundary-continuity}

Shot cut 전후 ambience, room tone, sustained source, propagation tail와 dialogue continuity를 추적하여 picture cut이 모든 sound state를 reset하지 않아야 한다.

### Time Transform {#sound-time-transform}

Source rate, trim, time stretch, reverse 또는 supported effect와 film time의 관계를 rational basis로 표현하고 audio sample index를 frame index와 동일시하지 않아야 한다.

### Sync Refusal {#sound-sync-refusal}

Missing handle, truncated utterance, stale event time, duplicate cue, discontinuous ambience와 film 밖 required tail을 거부해야 한다.
