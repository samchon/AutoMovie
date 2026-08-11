# Mix Hierarchy와 Loudness

## 의미와 Delivery를 보존하는 Mix {#sound-mix-hierarchy-loudness}

Dialogue, foley, effects, ambience, music, narration와 accessibility layer를 source, bus, group, gain, pan·spatial state, processing와 output channel로 구성할 수 있어야 한다.

### Bus와 Priority {#sound-bus-priority}

Bus hierarchy, mute, solo-like review state, ducking, sidechain-like control와 story priority를 명시하고 channel order에 의존하지 않아야 한다.

### Processing Chain {#sound-processing-chain}

Gain, delay, attenuation, EQ-like filter, dynamics, limiter, room response와 supported processing의 order, parameters와 version을 고정해야 한다.

### Loudness와 Peak {#sound-loudness-peak}

Integrated loudness, range, sample peak, true-peak-like supported measure와 clipping count를 구분하고 target 값은 delivery profile이 소유해야 한다.

### Mix Refusal {#sound-mix-refusal}

Non-finite sample, invalid channel, clipping beyond policy, missing dialogue, contradictory mute와 processing budget 초과를 거부해야 한다.
