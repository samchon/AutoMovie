# Particle와 Emission

## Compact Rule에서 파생되는 Particle {#effects-particles-emission}

Dust, sparks, debris proxy, rain, snow, spray, embers, magic-like effect와 project-defined particle을 emitter, rate 또는 count, lifetime, initial distribution, motion rule와 material로 표현할 수 있어야 한다.

### Emitter Geometry {#effects-emitter-geometry}

Point, line, surface, volume, path, event contact와 moving subject를 emitter로 사용할 수 있고 local-to-world transform을 같은 fixed clock에서 sample해야 한다.

### Deterministic Spawn {#effects-deterministic-spawn}

Spawn time, position, velocity, size, rotation와 variation을 emitter identity와 stable seed로 재현하고 frame rate에 따라 population이 달라지지 않아야 한다.

### Lifetime과 State {#effects-particle-lifetime-state}

Birth, active, collision, decay와 death를 film range와 event에 연결하고 끝난 particle이 seek order에 따라 남지 않아야 한다.

### Particle Refusal {#effects-particle-refusal}

Unbounded rate, negative lifetime, non-finite state, missing material, domain 밖 spawn와 budget 초과를 거부해야 한다.
