# Event Cue와 Timing

## 의미 사건에서 파생되는 Sound Cue {#sound-event-cues-timing}

Cue는 semantic event, source, emitter, emission time, duration 또는 lifecycle, gain, bus와 optional listener relation을 가져야 한다.

### Cue Identity와 Deduplication {#sound-cue-identity-deduplication}

같은 semantic event에서 파생된 cue는 event identity, layer role와 source choice로 안정된 identity를 가져야 하며 compile 순서, repeated seek 또는 chunk overlap이 같은 exclusive cue를 중복 생성하지 않아야 한다.

### One-shot와 Sustained {#sound-one-shot-sustained}

Impact와 footstep 같은 one-shot, 시작·유지·종료되는 sustained source, loop와 evolving bed를 구분하여 duration을 audio bytes에서만 추정하지 않아야 한다.

### Event-derived Timing {#sound-event-derived-timing}

Foot plant, grasp, door state, explosion, speech와 vehicle movement의 resolved event time에서 cue를 만들고 hand-copied timestamp가 motion과 drift하지 않아야 한다.

### Sample Boundary Mapping {#sound-cue-sample-boundary}

Emission start, source trim, lifecycle end와 fade boundary를 fixed audio sample clock에 mapping하는 rounding rule을 선언하고 같은 rational film time이 platform이나 frame rate에 따라 다른 sample을 선택하지 않아야 한다.

### Arrival Time {#sound-arrival-time}

Propagation을 사용하는 경우 emission, path, sound speed, arrival와 film range를 구분하여 visual event와 listener cue의 timing을 정확히 설명해야 한다.

### Cue Refusal {#sound-cue-refusal}

Missing event, reversed span, empty source, duplicate exclusive cue, film 밖 required arrival와 source state 모순을 거부해야 한다.
