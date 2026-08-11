# Interior Acoustics

## Room Geometry에 답하는 Sound {#sound-interior-acoustics}

Room volume, surface area, material absorption, opening, furnishing, occupancy, emitter와 listener를 direct sound와 supported room response에 연결할 수 있어야 한다.

### Room Binding {#sound-room-binding}

Emitter와 listener가 어느 interior space에 있는지, door·window·opening state와 adjacent space relation을 같은 resolved spatial graph에서 판단해야 한다.

### Bounded Response {#sound-bounded-room-response}

Scalar reverberation estimate, authored impulse response, early reflection proxy와 external acoustic result를 구분하고 source, unit, assumptions와 frequency scope를 기록해야 한다.

### Mix Consumption {#sound-acoustic-mix-consumption}

Acoustic analysis가 성공했다면 mix plan이 어떤 bus와 source에 어떤 result를 적용했는지 추적하고 분석을 계산만 한 채 output에서 무시하지 않아야 한다.

### Acoustic Claim 경계 {#sound-acoustic-claim-boundary}

Simple room estimate를 full wave simulation, speech intelligibility와 building compliance로 확대하지 않고 unsupported와 not-run을 구분해야 한다.
