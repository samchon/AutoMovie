# 축척, LOD, Tile과 반복 Population

## 광역 규모의 bounded multiplicity {#map-bounded-populations}

숲, 농경지, 군대, 건물군, 차량, 가로등, 포장과 잔해처럼 많은 요소는 compact rule, representative model, spatial partition과 budget으로 저작할 수 있어야 한다.

### 규모별 표현 {#map-scale-representation}

멀리서는 mass나 population으로, 가까이서는 group과 instance로 표현할 수 있으나 story-relevant identity, 위치와 상태가 level change에서 사라지지 않아야 한다.

### Detail level과 대체 표현 {#map-level-of-detail}

Terrain, water, vegetation, settlement, network와 placed asset은 목적, 거리, projected size와 interaction에 맞는 detail level 또는 proxy를 가질 수 있어야 한다. Detail 전환은 위치, extent, silhouette, 높이, state, material role과 semantic identity를 보존하고 hero, contact, measurement와 acceptance target을 낮은 detail로 몰래 대체하지 않아야 한다.

### Population bound {#map-population-bound}

Generated count, visible count, simulation count, collision count와 evidence sample count를 구분하여 모든 비싼 연산의 최대 population을 선언하고 보고해야 한다.

### 공간 partition {#map-spatial-partition}

Region, tile, cell, corridor와 view range로 작업 범위를 나누되 경계에서 geometry, path, water, pattern와 identity가 불연속이 되지 않아야 한다.

### Tile과 streaming {#map-tile-streaming}

사용자는 저작, 검증, simulation, render와 delivery 목적별 tile scheme, level, extent, padding, load·unload 범위와 resource budget을 선언할 수 있어야 한다. 필요한 tile이 아직 없거나 읽기에 실패한 상태를 빈 terrain이나 열린 route로 가장하지 않고 pending, unavailable 또는 out-of-scope로 구분해야 한다.

### 경계 접합 {#map-boundary-seams}

서로 다른 tile, source, detail level, phase와 책임 영역이 만나는 곳에서 terrain 높이와 법선, shoreline, 수량 흐름, road·rail·utility 연결, parcel boundary, vegetation pattern과 placed identity를 접합할 수 있어야 한다. Gap, overlap, double feature, 끊긴 topology와 눈에 띄는 transition은 named finding으로 남겨야 한다.

### Streaming 중 정본 유지 {#map-streaming-canonical-state}

같은 time, phase와 alternative를 보는 한 tile의 load 순서, camera 이동, 캐시 유무와 병렬 작업이 resolved state, stable seed, placement와 산출 수량을 바꾸지 않아야 한다. 화면 밖으로 내린 요소도 source identity와 change provenance를 잃지 않아야 한다.

### 결정론적 density {#map-deterministic-density}

Density, exclusion, clustering과 variation은 stable seed와 local coordinate를 사용하여 관련 없는 map 변경이 기존 population을 임의로 다시 섞지 않게 해야 한다.

### Budget 초과 처리 {#map-population-budget-refusal}

Detail, tile 또는 population budget을 넘으면 사용자는 축소, 분할, proxy, 지연 또는 거부 중 어떤 결과가 적용되었는지 확인할 수 있어야 한다. Story-relevant identity나 검증 대상을 조용히 제거하여 예산 안의 결과로 가장하지 않아야 한다.
