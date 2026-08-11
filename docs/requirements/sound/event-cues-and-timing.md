# Event Cue와 Timing

## 의미 사건에서 파생되는 Sound Cue {#sound-event-cues-timing}

Cue는 semantic event, source, emitter, emission time, duration 또는 lifecycle, gain, bus와 optional listener relation을 가져야 한다.

### One-shot와 Sustained {#sound-one-shot-sustained}

Impact와 footstep 같은 one-shot, 시작·유지·종료되는 sustained source, loop와 evolving bed를 구분하여 duration을 audio bytes에서만 추정하지 않아야 한다.

### Event-derived Timing {#sound-event-derived-timing}

Foot plant, grasp, door state, explosion, speech와 vehicle movement의 resolved event time에서 cue를 만들고 hand-copied timestamp가 motion과 drift하지 않아야 한다.

### Arrival Time {#sound-arrival-time}

Propagation을 사용하는 경우 emission, path, sound speed, arrival와 film range를 구분하여 visual event와 listener cue의 timing을 정확히 설명해야 한다.

### Cue Refusal {#sound-cue-refusal}

Missing event, reversed span, empty source, duplicate exclusive cue, film 밖 required arrival와 source state 모순을 거부해야 한다.
