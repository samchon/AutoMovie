# 분할, LOD, 스트리밍과 접합

## bounded representation 상태 {#world-site-bounded-representation-state}

### LOD 선택과 불변식 {#world-site-lod-selection-invariant}

<!-- @evidence requirements/map/scale-and-populations.md#map-bounded-populations Requires every generated or imported population to have deterministic bounds. -->
<!-- @evidence requirements/map/scale-and-populations.md#map-scale-representation Requires representation to be selected by declared scale and purpose. -->

시스템은 넓은 세계를 spatial partition, representation tier와 bounded population으로 표현하되 모든 tier와 tile이 하나의 canonical spatial state를 투영하게 한다. 개체 수, tile 수, 메모리·geometry 비용과 stream 범위는 선언된 상한 안에 있어야 하며, 시대나 장소별 완성 콘텐츠를 채우는 방법으로 사용하지 않는다.

<!-- @evidence requirements/map/scale-and-populations.md#map-level-of-detail Requires ordered LOD criteria and stable semantic identity. -->
<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-lod-invariants Preserves shared placement, silhouette and openings across building tiers. -->

LOD는 용도, 관찰 거리 또는 화면 오차, feature 중요도와 budget으로 선택되는 순서 있는 tier다. 모든 tier는 같은 stable feature identity, placement, phase, 핵심 extent, route·접촉·차폐 semantics를 유지하며 fidelity가 낮아져도 새로운 상태나 다른 위치를 만들지 않는다. 필요한 불변식을 보존할 수 없는 대체 표현은 해당 tier에 적합하지 않은 것으로 거부한다.

### population 상한과 결정론 {#world-site-population-bound-determinism}

<!-- @evidence requirements/map/scale-and-populations.md#map-population-bound Requires explicit counts, extents, prototypes and cost caps. -->
<!-- @evidence requirements/map/scale-and-populations.md#map-deterministic-density Requires density expansion to be reproducible by seed and slot order. -->

population은 extent, 요청 count 또는 density, prototype 집합, seed, 배치 법칙, variation, 간격과 최대 instance 비용을 가진다. 같은 canonical state, seed와 partition에서 member identity와 transform 순서는 동일하며 tile 로드 순서가 결과를 바꾸지 않는다. 배치 제약이나 상한 때문에 요청을 충족하지 못하면 겹침·임의 생략 대신 accepted·rejected 수와 이유를 출력한다.

### 공간 분할과 tile identity {#world-site-spatial-partition-tile-identity}

<!-- @evidence requirements/map/scale-and-populations.md#map-spatial-partition Requires deterministic tile keys, bounds and ownership rules. -->

partition은 좌표 기준, origin, level, tile key 규칙, 닫힌·열린 경계 convention, core와 overlap 범위를 선언한다. 각 feature는 stable ownership tile 하나를 가지되 접합·질의를 위한 참조 또는 clipped representation이 이웃 tile에 있을 수 있고, 그것을 별도 feature로 세지 않는다. 같은 위치가 두 tile의 정본이 되거나 어느 tile에도 속하지 않는 경계 규칙은 실패다.

### tile 스트리밍 상태 {#world-site-tile-streaming-state}

<!-- @evidence requirements/map/scale-and-populations.md#map-tile-streaming Requires explicit requested, loading, resident, failed and evicted states. -->

tile lifecycle은 absent, requested, loading, resident, failed, stale와 evicted 등 명시적 상태, content digest, canonical revision과 dependency closure를 가진다. resident 전에는 그 tile의 geometry가 route·visibility·검증에 존재한다고 가정하지 않고, 실패와 eviction을 빈 세계로 해석하지 않는다. 동일 요청은 결정론적 tile content와 진단 순서를 내며 부분 다운로드를 current로 승격하지 않는다.

### 경계 접합 불변식 {#world-site-boundary-seam-invariant}

<!-- @evidence requirements/map/scale-and-populations.md#map-boundary-seams Requires geometry, attributes, topology and temporal state to agree across seams. -->

인접 tile과 LOD 경계는 공유 좌표, 높이, surface normal 또는 slope, network connectivity, polygon edge, 물 수위, feature identity와 phase가 허용 공차 안에서 일치해야 한다. overlap이나 skirt는 표시 기법일 뿐 topology 불일치를 정당화하지 않는다. 출력 seam report는 양쪽 tile·tier·revision, 불일치 종류, 측정값과 tolerance를 포함한다.

### 스트리밍 정본과 호환성 {#world-site-streaming-canonical-compatibility}

<!-- @evidence requirements/map/scale-and-populations.md#map-streaming-canonical-state Requires load order and cache state not to alter canonical answers. -->

질의와 파생은 같은 canonical revision의 필요한 tile closure가 모두 resident일 때 수행하고, load order, 캐시 hit, worker 순서와 카메라 이동이 feature identity나 수치 결과를 바꾸지 않는다. 새 partition scheme이나 tier가 추가되어도 기존 canonical feature와 공개된 좌표 의미는 유지되며, migration은 old-to-new tile·feature mapping과 invalidated cache 범위를 출력한다.

### budget 초과와 거부 {#world-site-population-budget-refusal}

<!-- @evidence requirements/map/scale-and-populations.md#map-population-budget-refusal Requires unaffordable detail and population requests to fail before unbounded work. -->

요청 tile, LOD, instance, vertex, texture, fluid cell과 파생 작업량은 실행 전 측정 가능한 예산과 비교한다. 상한을 넘으면 시스템은 조용히 density를 줄이거나 낮은 tier를 current 결과로 바꾸지 않고 예상 비용, 초과량, 가능한 명시적 degradation 선택을 반환한다. 사용자가 저하를 선택하면 선택, 영향받은 관찰 조건과 검증 제외 범위를 기록한다.
