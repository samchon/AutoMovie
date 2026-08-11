# Simulation, Effects, and Sound Specifications

<!-- @evidence requirements/effects-and-simulation/README.md#effect와-simulation-요구사항 effect와 simulation의 상태, clock, budget과 검증 약속을 시스템 계약으로 정밀화한다. -->
<!-- @evidence requirements/sound/README.md#음향-요구사항 sound source, 공간 전달, mix와 audiovisual 결합 약속을 시스템 계약으로 정밀화한다. -->

## 계약 지도 {#simulation-effects-and-sound-contract-map}

이 디렉터리는 반복 가능한 blocking prototype을 위한 simulation, effects, sound의 패키지 독립 시스템 계약이다. [Scope, Tier, Identity](./scope-tiers-and-identities.md), [Clock, Ordering, Seek, Checkpoint](./clocks-ordering-seek-and-checkpoints.md), [Budget Admission](./budget-admission.md), [Particle, Fire, Atmosphere](./particles-fire-and-atmosphere.md), [Rigid, Collision, Damage](./rigid-collision-and-damage.md), [Soft Body](./soft-bodies-and-deformation.md), [Fluid와 World Coupling](./fluids-water-and-world-coupling.md), [Sound Source, Event, Dialogue, Foley](./sound-sources-events-dialogue-and-foley.md), [Ambience, Music, Spatial, Acoustics](./ambience-music-spatial-and-acoustics.md), [Mix, Stem, Loudness, A/V Join](./mix-stems-loudness-and-av-join.md), [Validation, Evidence, Compatibility](./validation-evidence-and-compatibility.md) 순으로 읽는다.

### 해석 경계 {#simulation-effects-and-sound-reading-boundary}

각 문서는 상태와 시간 정합성, 상한, 입출력, 실패와 호환성을 규정한다. 이 계약의 성공은 같은 입력이 같은 저작ㆍ해석 상태와 동기 결과를 내고 증거가 그 사실을 확인한다는 뜻이며, photoreal volumetrics, engineering-grade physics, perceptually exact room acoustics, release-master 음질을 뜻하지 않는다.
