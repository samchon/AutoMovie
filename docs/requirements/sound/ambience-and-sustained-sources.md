# Ambience와 Sustained Source

## 장소와 상태가 계속 내는 Sound {#sound-ambience-sustained}

Weather, crowd, room tone, water, machinery, traffic, wildlife-like proxy와 project-defined ambience를 location, region, start, hold, transition, end와 state로 표현할 수 있어야 한다.

### Bed와 Emitter Population {#sound-ambience-bed-population}

한 ambience bed, 여러 spatial emitter, procedural population와 recorded multichannel source를 구분하고 필요한 spatial detail과 budget을 선언해야 한다.

### Loop와 Seam {#sound-ambience-loop-seam}

Loop range, crossfade, phase, random event insertion와 tail을 fixed clock과 stable seed에 연결하여 edit와 seek에서 seam이 달라지지 않아야 한다.

### Arbitrary Seek State {#sound-ambience-seek-state}

임의 film time의 loop phase, procedural population, crossfade, environment-driven density와 tail은 declared start state에서 직접 계산하거나 검증된 state로 재구성되어야 하며 처음부터 순차 재생한 mix와 같아야 한다.

### Environment State {#sound-ambience-environment-state}

Wind, rain, water level, crowd count, room occupancy와 machine state가 ambience layer와 event density에 미치는 authored relation을 표현할 수 있어야 한다.

### Shared Environment Revision {#sound-ambience-environment-revision}

Ambience는 visual weather, effect, water, crowd와 machinery가 읽는 같은 world revision과 fixed clock을 소비해야 하며 upstream state가 바뀌면 cached population, mix와 audible evidence를 stale로 표시해야 한다.

### Ambience Refusal {#sound-ambience-refusal}

Unbounded generator, missing end condition, invalid loop, location 밖 source와 silent decoded bytes를 valid ambience로 취급하지 않아야 한다.
