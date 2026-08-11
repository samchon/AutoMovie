# Interior Acoustics

## Room Geometry에 답하는 Sound {#sound-interior-acoustics}

Room volume, surface area, material absorption, opening, furnishing, occupancy, emitter와 listener를 direct sound와 supported room response에 연결할 수 있어야 한다.

### Room Binding {#sound-room-binding}

Emitter와 listener가 어느 interior space에 있는지, door·window·opening state와 adjacent space relation을 같은 resolved spatial graph에서 판단해야 한다.

### Acoustic Input Revision {#sound-acoustic-input-revision}

Room geometry, surface material, opening, furnishing, occupancy, emitter, listener와 frequency scope의 exact revision을 acoustic result identity에 포함하고 어느 input이 바뀌면 response와 이를 소비한 mix evidence를 stale로 표시해야 한다.

### Bounded Response {#sound-bounded-room-response}

Scalar reverberation estimate, authored impulse response, early reflection proxy와 external acoustic result를 구분하고 source, unit, assumptions와 frequency scope를 기록해야 한다.

### External Acoustic Provider Neutrality {#sound-acoustic-provider-neutrality}

사용자는 자신이 선택한 measurement 또는 simulation provider의 result와 impulse response를 채택할 수 있어야 하며 특정 solver를 필수로 정하지 않아야 한다. External result는 고정된 bytes, geometry mapping, units, sample rate, solver metadata, digest와 validation scope로 소비해야 한다.

### Mix Consumption {#sound-acoustic-mix-consumption}

Acoustic analysis가 성공했다면 mix plan이 어떤 bus와 source에 어떤 result를 적용했는지 추적하고 분석을 계산만 한 채 output에서 무시하지 않아야 한다.

### Acoustic Claim 경계 {#sound-acoustic-claim-boundary}

Simple room estimate를 full wave simulation, speech intelligibility와 building compliance로 확대하지 않고 unsupported와 not-run을 구분해야 한다.
