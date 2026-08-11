# Rigid Motion, Ballistics와 Collision

## Object의 Bounded 물리 관계 {#effects-rigid-ballistics-collision}

Projectile, thrown object, falling prop, vehicle proxy, impact와 rigid contact를 initial transform, velocity, gravity-like input, collider, material response, time range와 budget으로 표현할 수 있어야 한다.

### Linear와 Angular State {#effects-rigid-linear-angular-state}

Position, orientation, linear·angular velocity, mass-like parameter, damping, friction과 restitution 중 수행 tier가 소비하는 값을 실제 단위와 valid range로 선언하고 누락값을 보이지 않는 scene-dependent default로 채우지 않아야 한다.

### Authored와 Simulated Trajectory {#effects-authored-simulated-trajectory}

직접 저작 path, analytic ballistic path와 bounded rigid solve를 구분하고 story event가 요구하는 end state에 맞는 방식을 사용자가 선택해야 한다.

### Collision Proxy {#effects-collision-proxies}

Body, object, terrain, building과 prop의 supported proxy, layer, mask, contact tolerance와 order를 명시하고 visible mesh 전체가 자동 collider라고 가정하지 않아야 한다.

### Impact와 Consequence {#effects-impact-consequence}

Contact time, point, normal, relative speed와 semantic impact event를 sound, particle, damage state와 reaction motion에 연결할 수 있어야 한다.

### Contact Order와 Seek {#effects-rigid-contact-order-seek}

동시에 발생하는 contact와 constraint를 stable identity와 declared tie-break로 해결하고 sequential playback, chunked evaluation와 arbitrary seek가 같은 transform, collision event와 consequence를 만들어야 한다.

### Collision Refusal {#effects-collision-refusal}

Invalid collider, tunneling bound 초과, impossible initial overlap, non-finite state와 unresolved contact order를 거부하거나 unsupported로 표시해야 한다.
