# Mix Hierarchy와 Loudness

## 의미와 Delivery를 보존하는 Mix {#sound-mix-hierarchy-loudness}

Dialogue, foley, effects, ambience, music, narration와 accessibility layer를 source, bus, group, gain, pan·spatial state, processing와 output channel로 구성할 수 있어야 한다.

### Bus와 Priority {#sound-bus-priority}

Bus hierarchy, mute, solo-like review state, ducking, sidechain-like control와 story priority를 명시하고 channel order에 의존하지 않아야 한다.

### Processing Chain {#sound-processing-chain}

Gain, delay, attenuation, EQ-like filter, dynamics, limiter, room response와 supported processing의 order, parameters와 version을 고정해야 한다.

### Deterministic Summation {#sound-deterministic-summation}

Source ordering, channel mapping, automation sampling, accumulation, rounding와 dither-like processing을 고정하여 같은 input과 sample clock이 worker count, chunk boundary와 platform scheduling에 관계없이 같은 mix identity를 만들어야 한다.

### Automation Clock {#sound-mix-automation-clock}

Gain, pan, mute, ducking, filter와 spatial parameter의 key와 interpolation은 rational film time에서 fixed audio sample clock으로 mapping되고 arbitrary seek가 sequential mix와 같은 automation state를 선택해야 한다.

### Loudness와 Peak {#sound-loudness-peak}

Integrated loudness, range, sample peak, true-peak-like supported measure와 clipping count를 구분하고 target 값은 delivery profile이 소유해야 한다.

### Stem과 Master Relation {#sound-stem-master-relation}

요구된 dialogue, effects, ambience, music와 accessibility stem은 master와 같은 source revision, alignment, channel convention와 processing split을 가져야 하며 stem 합이 master와 다른 경우 차이를 만드는 master-only processing을 명시해야 한다.

### Mix Refusal {#sound-mix-refusal}

Non-finite sample, invalid channel, clipping beyond policy, missing dialogue, contradictory mute와 processing budget 초과를 거부해야 한다.
