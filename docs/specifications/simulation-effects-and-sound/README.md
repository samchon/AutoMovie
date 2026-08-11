# Simulation, Effects, and Sound Specifications

## 계약 지도 {#simulation-effects-and-sound-contract-map}
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-scope-simulation-tiers 이 색인은 bounded effect 계약을 독립된 시스템 책임으로 연결한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-scope-identity 이 색인은 추적 가능한 sound 계약을 source에서 delivery까지 연결한다. -->

이 디렉터리는 반복 가능한 blocking prototype을 위한 simulation, effects, sound의 패키지 독립 시스템 계약이다. [Scope, Tier, Identity](./scope-tiers-and-identities.md), [Clock, Ordering, Seek, Checkpoint](./clocks-ordering-seek-and-checkpoints.md), [Budget Admission](./budget-admission.md), [Particle, Fire, Atmosphere](./particles-fire-and-atmosphere.md), [Rigid, Collision, Damage](./rigid-collision-and-damage.md), [Soft Body](./soft-bodies-and-deformation.md), [Fluid와 World Coupling](./fluids-water-and-world-coupling.md), [Sound Source, Event, Dialogue, Foley](./sound-sources-events-dialogue-and-foley.md), [Ambience, Music, Spatial, Acoustics](./ambience-music-spatial-and-acoustics.md), [Mix, Stem, Loudness, A/V Join](./mix-stems-loudness-and-av-join.md), [Validation, Evidence, Compatibility](./validation-evidence-and-compatibility.md) 순으로 읽는다.

### 해석 경계 {#simulation-effects-and-sound-reading-boundary}
<!-- @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-prototype-fidelity-boundary 이 절은 effect 계약의 fidelity ceiling을 blocking prototype으로 제한한다. -->
<!-- @evidence requirements/sound/scope-and-identity.md#sound-prototype-fidelity-boundary 이 절은 sound 계약이 final perceptual parity를 주장하지 못하게 한다. -->

각 문서는 상태와 시간 정합성, 상한, 입출력, 실패와 호환성을 규정한다. 이 계약의 성공은 같은 입력이 같은 저작ㆍ해석 상태와 동기 결과를 내고 증거가 그 사실을 확인한다는 뜻이며, photoreal volumetrics, engineering-grade physics, perceptually exact room acoustics, release-master 음질을 뜻하지 않는다.
