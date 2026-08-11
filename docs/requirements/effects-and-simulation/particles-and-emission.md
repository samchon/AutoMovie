# Particle와 Emission

## Compact Rule에서 파생되는 Particle {#effects-particles-emission}

Dust, sparks, debris proxy, rain, snow, spray, embers, magic-like effect와 project-defined particle을 emitter, rate 또는 count, lifetime, initial distribution, motion rule와 material로 표현할 수 있어야 한다.

### Emitter Geometry {#effects-emitter-geometry}

Point, line, surface, volume, path, event contact와 moving subject를 emitter로 사용할 수 있고 local-to-world transform을 같은 fixed clock에서 sample해야 한다.

### Deterministic Spawn {#effects-deterministic-spawn}

Spawn time, position, velocity, size, rotation와 variation을 emitter identity와 stable seed로 재현하고 frame rate에 따라 population이 달라지지 않아야 한다.

### Spawn Interval Boundary {#effects-spawn-interval-boundary}

Rate와 burst는 각 fixed-step interval에서 어느 boundary를 포함하는지 정의하고 subframe event와 fractional remainder를 보존해야 한다. 같은 emission interval을 여러 chunk로 평가하거나 순서를 바꾸어도 particle identity와 총 count가 같아야 한다.

### Lifetime과 State {#effects-particle-lifetime-state}

Birth, active, collision, decay와 death를 film range와 event에 연결하고 끝난 particle이 seek order에 따라 남지 않아야 한다.

### Contact와 Consequence {#effects-particle-contact-consequence}

Particle collision, stick, bounce, kill과 secondary emission은 지원되는 collider와 interaction budget에만 적용하고 contact event가 sound, mark, damage 또는 light를 만들면 원인 particle과 contact time을 추적해야 한다.

### Particle Refusal {#effects-particle-refusal}

Unbounded rate, negative lifetime, non-finite state, missing material, domain 밖 spawn와 budget 초과를 거부해야 한다.
