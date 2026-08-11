# Particles, Fire, and Atmosphere

## Emitter와 spawn 입력 {#particle-emitter-and-spawn-input}

### 결정적 spawn과 interval {#deterministic-particle-spawn-interval}

<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particles-emission 이 절은 compact rule에서 유한 particle population을 파생한다. -->
<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-emitter-geometry 이 절은 emitter의 frame과 geometry를 명시한다. -->

Emitter 입력은 stable identity, world 또는 moving-local frame, pointㆍsurfaceㆍvolume shape, 활성 구간, rate 또는 명시 spawn schedule, seed, initial-state distribution과 최대 population이다. 출력 spawn은 emitter identity, spawn ordinal, birth tick, position, velocity, traits를 가진다. Shape 밖 sample, 해결되지 않은 frame, 비유한 parameter는 첫 spawn 전에 거절한다.

<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-deterministic-spawn 이 절은 spawn을 seed와 ordinal의 순수 함수로 고정한다. -->
<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-spawn-interval-boundary 이 절은 chunk와 seek가 같은 birth를 소유하도록 구간 규칙을 고정한다. -->

Spawn `n`의 모든 난수는 instance seed, parameter revision, `n`, named draw channel의 함수이고 이전 draw count에 의존하지 않는다. Tick은 반열림 활성 구간에서 birth를 소유하고 정확한 경계 birth는 한 tick에만 속한다. Chunk는 자신이 소유한 interval의 ordinal 범위를 직접 계산하며 인접 chunk가 중복 또는 누락을 만들 수 없다.

### Particle lifecycle와 consequence {#particle-lifecycle-contact-consequence}
<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-lifetime-state 이 절은 birth부터 death까지 필요한 상태를 seek 가능하게 보존한다. -->
<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-contact-consequence 이 절은 contact 결과를 명시적 consequence로 제한한다. -->

Particle state는 birth tick, age tick, position, velocity, trait, active/dead status와 선택적 contact history를 포함한다. Death는 lifetime end, domain exit, declared kill surface 또는 budget failure 중 하나의 reason을 가진다. Contact는 ordered contact identity, surface, point, normal, relative velocity와 tick을 출력하고 bounce, stick, decal request, sound emission 같은 선언된 consequence만 만든다.

### Fire source와 fuel state {#fire-source-fuel-and-lifecycle-state}
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-fire-smoke-atmosphere 이 절은 fire와 smoke를 사건과 공간에 놓인 state로 다룬다. -->
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-fire-source-state 이 절은 source, fuel, ignition과 extinction을 분리한다. -->
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-fire-lifecycle-seek 이 절은 fire lifecycle을 임의 seek에서 재구성하게 한다. -->

Fire instance 입력은 source frame, ignition event, authored heatㆍfuelㆍemission envelopes, extinguish condition와 tier다. 상태는 `unlit`, `igniting`, `sustained`, `decaying`, `extinguished`와 각 transition tick을 가진다. Bounded prototype tier는 chemical combustion을 추론하지 않고 저작 envelope 또는 bounded solver만 평가하며 seek는 lifecycle state와 smoke accumulator를 같은 checkpoint에서 재구성한다.

### Smoke, wind, boundary {#smoke-wind-and-domain-boundary}
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-smoke-wind-boundary 이 절은 smoke가 snapshot wind와 유한 domain을 읽게 한다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-wind-gravity-input 이 절은 wind와 gravity-like 입력의 units와 revision을 요구한다. -->

Smoke 입력은 fixed world snapshot의 wind vector field 또는 bounded uniform approximation, gravity-like direction, source rate와 closed/open boundary다. 출력은 coarse densityㆍageㆍvelocity state 또는 authored volume state다. Domain 밖 물질의 처리와 open-boundary loss를 accounting하며, wind revision이 바뀌면 checkpoint와 cache를 무효화한다.

### Atmosphere composition과 visibility output {#atmosphere-composition-light-visibility-output}
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-atmosphere-composition 이 절은 여러 atmospheric layer의 안정된 합성 순서를 요구한다. -->
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-fire-light-visibility 이 절은 light와 visibility consequence를 별도 출력으로 제한한다. -->

Atmosphere layer는 identity, bounds, density 또는 opacity proxy, color/temperature proxy, priority와 blend rule을 가진다. 합성은 priority와 identity의 총순서로 수행하고 출력은 renderer가 소비할 coarse visibility field, light modulation request와 source provenance다. 이는 radiative transfer나 노출 안전성을 증명하지 않는다.

### Particle와 fire 거절 경계 {#particle-fire-refusal-and-claim-boundary}
<!-- @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-refusal 이 절은 무상한 particle 생성과 미지원 contact를 거절한다. -->
<!-- @evidence requirements/effects-and-simulation/fire-smoke-and-atmosphere.md#effects-fire-claim-boundary 이 절은 fire 결과가 safety 또는 engineering claim이 되지 못하게 한다. -->

Population 상한 없음, 불완전 frame, 음수 lifetime, 미지원 collider, unbounded atmosphere, fuelㆍsafetyㆍair-quality 해석 요구는 진단과 함께 거절 또는 unsupported다. 저해상도 particle과 volume proxy의 성공은 staging, timing, continuity의 성공일 뿐 화재 거동, 연기 독성, 피난 안전, photoreal volume의 증거가 아니다.
