# 공간 입력과 배치

## 공간 원본 채택 경계 {#world-site-spatial-source-adoption-boundary}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-asset-placement Defines external adoption as an explicit identity-preserving decision. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-mode-choice Keeps direct placement, conversion and composition under user authority. -->

시스템은 외부 공간 자료와 자산을 원본 그대로 보존하면서 직접 배치, 정규화된 공간 자료로의 변환, native 재해석 또는 group composition 중 사용자가 선택한 방식으로 채택한다. 채택 결과는 원본 identity, content digest, license, 선택한 mode, 변환 receipt와 배치 관계를 가지며, 원본을 조용히 정본 geometry로 흡수하지 않는다.

### 공간 자료 입력 종류 {#world-site-spatial-data-input}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-spatial-data Requires survey, GIS, raster, point, mesh and tabular spatial inputs to retain their semantics. -->
<!-- @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-spatial-data Recognizes spatial media without inferring unsupported meaning. -->

입력은 vector feature, raster, elevation grid, point cloud, 측량점, tabular 좌표, 3차원 mesh와 장면 자산 등 열린 media 종류를 수용하고 원본의 layer·band·field·node 구조를 보존한다. 형식 인식은 bytes와 명시 metadata에서 결정하며 파일명이나 시각적 인상으로 CRS, 단위, feature 종류 또는 의미를 추측하지 않는다. 지원되지 않는 형식은 digest와 provenance를 유지한 미채택 원본으로 반환한다.

### provenance, 품질과 composition {#world-site-spatial-source-provenance-composition}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-spatial-source-provenance-quality Requires custody, coverage, resolution, accuracy and license facts. -->
<!-- @evidence requirements/map/external-assets-and-placement.md#map-spatial-source-composition Requires overlap, priority, clipping and conflict rules across sources. -->
<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-source-record Preserves the source record independently of adopted design. -->

각 원본은 제공자, 취득 시각, 발행 revision, digest, license, 공간·시간 coverage, 해상도, 정확도, nodata와 알려진 결손을 가진다. 여러 원본을 합칠 때는 layer별 우선순위, clip 범위, seam 공차, 중복·충돌 처리와 결과 provenance를 선언하며, 단순히 최신 파일 또는 가장 촘촘한 표본이 자동 승자가 되지 않는다. 충돌이 해결되지 않으면 양쪽 원본과 겹치는 범위를 보존한 채 정본 승격을 보류한다.

### 채택 identity와 좌표 해석 {#world-site-adoption-identity-coordinate}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-adoption-identity Requires source objects and adopted features to have traceable distinct identities. -->
<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-coordinate-units Requires axis, units, CRS and datum to be resolved before placement. -->
<!-- @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Keeps coordinate interpretation explicit across the external-input boundary. -->

원본 object와 채택된 spatial feature는 서로 다른 stable identity를 가지며 receipt가 source-to-result 관계와 제외된 object를 기록한다. 좌표축, handedness, 단위, CRS, 수평·수직 datum과 epoch가 해결되기 전에는 정본 배치를 수행하지 않는다. 사용자가 로컬 배치를 선택하면 그 선택과 정확도 제한을 기록하고 지리적 정합이 확인된 것처럼 출력하지 않는다.

### glTF와 장면 자산 semantics {#world-site-gltf-scene-semantics}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-gltf-semantics Requires glTF nodes, transforms, bounds and semantic mapping to survive adoption. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-direct-placement Preserves exact source appearance under direct placement. -->

glTF 또는 동등한 장면 자산 채택은 node hierarchy, local transform, mesh·material 참조, instance, animation 또는 extension 보존 여부, source bounds와 semantic mapping을 receipt에 남긴다. 직접 배치는 원본 appearance를 host-owned wrapper 아래 보존하고 세계 placement가 원본 내부 transform을 덮어쓰지 않게 한다. 읽지 못한 extension, 누락 dependency, 비유한 transform과 불명확한 단위는 지원 수준 저하 또는 채택 실패로 출력한다.

### 지형·네트워크 제약과 집단 {#world-site-import-terrain-network-population}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-terrain-network-constraints Requires adopted objects to satisfy support, clearance and corridor constraints. -->
<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-population-groups Requires large adopted populations to retain grouping and deterministic identity. -->
<!-- @evidence requirements/external-inputs/adoption-modes-and-composition.md#external-adoption-group-composition Preserves authored grouping without flattening member identities. -->

채택 자산은 anchor, 지지 surface, ground contact, orientation, 점유·clearance volume과 network 또는 zone 관계를 명시하며, 지형 관입·부유·route 차단과 경계 이탈을 검증한다. 대규모 식생·건물·시설 집단은 source group, prototype, member identity 또는 재현 가능한 slot mapping과 budget을 보존한다. group을 하나의 불투명 blob으로 만들거나 개별 member를 근거 없이 새 feature로 분해하지 않는다.

### 원본 상태와 대체 영향 {#world-site-source-state-replacement}

<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-source-state Requires availability, license, conversion and verification state to remain explicit. -->
<!-- @evidence requirements/map/external-assets-and-placement.md#map-external-source-replacement Requires source replacement to propagate impact and staleness. -->
<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-refresh-impact-staleness Keeps refresh effects visible across every consumer. -->

원본은 available, missing, unlicensed, unsupported, converted, adopted, degraded와 verified 같은 닫힌 처리 상태와 진단을 가진다. digest, coordinate 해석, dependency 또는 채택 mode가 바뀌면 receipt, 배치, 접합, quantity, route, visibility와 render consumer가 영향 graph를 따라 stale로 전이한다. 대체 후에도 이전 원본과 결과 lineage를 보존하며 새 파일이 같은 이름이라는 이유로 검증을 승계하지 않는다.
