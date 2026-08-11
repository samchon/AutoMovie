# Fluids, Water, and World Coupling

## Fluid domain과 보존 state {#fluid-domain-and-conservation-state}
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluids-water 이 절은 액체를 유한 domain의 상태로 정의한다. -->
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-volume-boundary 이 절은 units, bounds, source, drain과 open boundary를 명시하게 한다. -->
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-conservation-account 이 절은 물질량 변화의 원인을 accounting하게 한다. -->
<!-- @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record 이 절은 interior water가 같은 초기ㆍ경계 기록을 사용하게 한다. -->

Fluid input은 stable domain identity, world basis와 units, bounded grid 또는 authored surface, initial depth/velocity, fixed step, source, drain, wall/open edge와 budget이다. State는 [clock boundary identity](./clocks-ordering-seek-and-checkpoints.md#effect-and-audio-time-domains), ordered cell depthㆍvelocity, source added, drain removed, open-boundary loss, clamp correction과 digest를 포함한다. Boundary identity의 absolute effect tick은 이 state의 유일한 step 위치이고 film frame이나 근사 second를 별도 위치로 저장하지 않는다. 각 step의 volume delta는 이 accounting 항목의 합과 선언 tolerance 안에서 일치해야 한다.

### Surface와 flow tier {#fluid-surface-and-flow-tier}
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier 이 절은 static, authored, solved water의 서로 다른 fidelity를 기록한다. -->

Water presentation tier는 `static-surface`, `authored-flow`, `bounded-shallow-solve`, `adopted-result` 중 하나다. Static은 변형 없는 surface, authored는 명시된 loop와 events, bounded solve는 유한 grid의 coarse height/flow, adopted result는 immutable samples를 출력한다. Tier가 보장하지 않는 splash, turbulence, viscosity, volume truth를 추론하지 않는다.

### Moving object interaction {#fluid-moving-object-interaction}
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-object-interaction 이 절은 moving object와 fluid의 consequence를 명시적 coupling으로 만든다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-surface-consequence 이 절은 wetness, decal, sound 같은 surface consequence를 추적한다. -->

Object interaction 입력은 같은 clock boundary identity에 결속된 world proxy sweep, displacement 또는 authored disturbance와 interaction mode다. 전이의 proxy와 disturbance는 clock 계약의 destination endpoint law에 따라 같은 정확한 film instant를 읽는다. 기본은 object가 fluid에 disturbance를 주고 fluid는 동일 boundary identity를 인용하는 splash request, wetness state, drag proxy 또는 sound emission을 출력하는 단방향 coupling이다. 양방향 force feedback은 별도 coupled model, iteration order와 combined budget이 있을 때만 허용한다.

### Fluid seek와 checkpoint {#fluid-seek-and-checkpoint-state}
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state 이 절은 fluid의 완전 state를 checkpoint로 복원하게 한다. -->
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-cache-identity 이 절은 fluid checkpoint를 완전한 clock과 world dependency identity에 결속한다. -->

Checkpoint는 domain revision, grid order, solver revision, initial field, source/drain schedule, coupled world snapshot digest와 clock boundary identity를 key로 하고 모든 보존 state를 담는다. Seek는 같은 time-domain identity, origin, step, endpoint law와 dependency revisions를 가진 호환 checkpoint 또는 initial field에서 정방향으로만 계산한다. Surface mesh나 spray particle만으로 solver state를 역구성할 수 없고, 같은 absolute effect tick이라도 다른 time-domain identity에 속한 checkpoint는 호환되지 않는다.

### Coupled world snapshot {#coupled-world-snapshot-contract}
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-environment-coupling 이 절은 effect가 하나의 world state를 읽게 한다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-coupled-snapshot 이 절은 pose, collider, surface, opening과 environment revision을 원자적으로 묶는다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-coupling-level 이 절은 one-way와 iterative coupling을 구분한다. -->
<!-- @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-step-boundary 이 절은 모든 moving world component를 하나의 exact endpoint에서 sample하게 한다. -->
<!-- @evidence requirements/interior/doors-windows-and-openings.md#interior-opening-operable-state 이 절은 가동 opening state를 snapshot revision에 포함한다. -->
<!-- @evidence requirements/interior/materials-and-physical-properties.md#interior-material-units-sources 이 절은 surface trait의 단위와 측정 근거를 coupling 입력에 보존한다. -->

World snapshot은 clock mapping이 출력한 boundary identity를 변경 없이 입력으로 소비하며, 그 identity의 정확한 유리수 film instant에서 resolve된 coordinate basis, subject와 object transform sample revision, collider proxy sample revision, surfaceㆍmaterialㆍspaceㆍopening revision과 environment sample revision을 하나의 immutable snapshot identity로 묶는다. 각 component는 source revision, sample film instant와 digest를 보존하고 transform, collider와 windㆍgravity-like environment가 모두 같은 boundary identity의 destination endpoint를 읽었음을 증명한다. 24 fps frame과 120 Hz solver처럼 여러 clock 경계가 같은 film instant에서 만날 때도 snapshot은 effect time-domain identity, origin, step과 absolute effect tick을 그대로 보존하므로 같은 숫자의 frameㆍtick이나 가까운 interpolation sample로 대체할 수 없다. One-way consumer는 snapshot을 바꾸지 않고 같은 boundary identity를 인용하는 consequence event를 다음 위상에 출력한다. Iterative coupling은 한 boundary identity 안에서 참여 domain, convergence criterion, maximum iterations, stable order와 failure state를 별도로 선언한다.

### Dependency invalidation과 refusal {#world-coupling-invalidation-and-refusal}
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-coupling-dependency-invalidation 이 절은 snapshot 구성 요소 변경을 cache identity에 전파한다. -->
<!-- @evidence requirements/effects-and-simulation/environment-coupling.md#effects-coupling-refusal 이 절은 불완전하거나 순환적인 coupling을 거절한다. -->
<!-- @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-refusal 이 절은 unbounded 또는 모순된 fluid domain을 실패시킨다. -->

Snapshot 구성 요소나 interaction mode가 바뀌면 dependent solve, checkpoint와 presentation consequence가 stale이다. Consumer가 제출한 boundary identity와 snapshot identity의 time-domain identity, exact film instant, origin, step, absolute effect tick 또는 endpoint sampling law 중 하나라도 다르거나 transformㆍcolliderㆍenvironment component의 source revision이 snapshot 작성 뒤 갱신되면 evaluation 전에 mismatch 또는 stale로 거절한다. Missing basis/unit, 서로 다른 sample instant의 혼합, open edge와 wall의 중복, 음수 depth, source/drain의 미해결 identity, feedback cycle, 수렴 상한 없음과 budget 초과는 domain과 전체 boundary identity를 지목한 실패다. 실패 뒤의 state나 wetnessㆍsound consequence는 complete로 게시하지 않는다.
