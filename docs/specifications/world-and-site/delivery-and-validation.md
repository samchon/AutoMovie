# 산출물과 검증

## delivery와 acceptance 경계 {#world-site-delivery-validation-boundary}

### delivery manifest {#world-site-delivery-manifest}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-deliverables-validation Defines delivery as a closed, validated projection of canonical site state. -->

시스템은 사용자가 요청한 범위, 시각·phase·alternative, 좌표 기준, representation tier와 지원 수준에 맞는 source-resolved data, 시각 표현, tile·교환 자료, quantity와 검증 report를 하나의 delivery로 묶는다. delivery는 canonical state를 대체하지 않고 그 revision의 재현 가능한 투영이며, 특정 파일 형식이나 renderer 구현을 시스템 계약으로 고정하지 않는다.

<!-- @evidence requirements/map/deliverables-and-validation.md#map-delivery-manifest Requires every artifact, scope, digest, dependency and status to be enumerated. -->

manifest는 delivery identity, 생성 시각, canonical revision, 공간·시간 범위, 좌표·단위 해석, artifact별 역할·media kind·digest·크기, dependency, validation verdict와 known gap을 열거한다. 선언되지 않은 sidecar나 외부 dependency가 없어야 하며, 누락·중복 artifact identity와 digest 불일치는 delivery closure 실패다.

### source-resolved 공간 출력 {#world-site-source-resolved-output}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-source-resolved-output Requires resolved geometry and attributes to retain source lineage and uncertainty. -->

source-resolved 출력은 stable feature identity, canonical geometry·속성·관계, source-to-result lineage, 좌표 기준, 단위, 유효 시각, accuracy와 unresolved 범위를 보존한다. 시각 편의를 위한 단순화, skirt, proxy와 채움은 정본 layer와 구분하고 provenance 없는 측정값으로 제공하지 않는다. 같은 revision의 반복 생성은 동일한 정렬과 수치 규칙을 따른다.

### cartographic와 시각 출력 {#world-site-cartographic-visual-output}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-cartographic-output Requires maps and views to state extent, scale, legend, time and omissions. -->

평면 지도, section, elevation, 3차원 검토 view와 overlay는 extent, scale 또는 관찰 조건, 좌표 grid·북쪽, legend, layer, 시각·phase, source revision과 생략·저하를 표시한다. 화면상 보기 좋음은 topology·좌표·수문·접촉 검증을 대신하지 않으며, label이나 색만으로 미검증 feature를 확정 상태처럼 표현하지 않는다.

### tile과 교환 출력 {#world-site-tile-exchange-output}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-delivery-tiles-exchange Requires tile schemes, levels, transforms, seams and dependency closure. -->

tile 또는 교환 자료는 schema·version, 좌표 기준, origin, level과 key 규칙, bounds, tile-local transform, feature identity mapping, LOD, seam tolerance와 dependency closure를 포함한다. 지원되지 않는 semantic이나 extension은 누락 목록과 degradation receipt로 출력하고, 읽을 수 없는 소비자에게 조용히 flattened geometry만 건네지 않는다.

### quantity와 통계 {#world-site-quantity-statistics-output}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-quantities-statistics Requires every measure to name its population, method, unit and confidence. -->

면적, 길이, 체적, count, density, 고도·경사·수심·가시 면적과 network 통계는 대상 feature 집합, 포함 규칙, 계산 geometry, 단위, 시각, 방법, tolerance, 오차·confidence와 revision을 가진다. null 또는 unsupported는 0과 구분하며, 단순화 tier에서 계산한 값을 정본 정밀량으로 표시하지 않는다.

### geometry와 topology 검증 {#world-site-geometry-topology-validation}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-geometry-topology-validation Requires finite geometry, valid rings, manifolds and connected graphs as applicable. -->

검증은 비유한 좌표, 퇴화 edge·face, self-intersection, ring 방향과 closure, hole 포함, 중복 identity, surface·volume closure, network 연결·방향·level과 참조 무결성을 representation 종류에 맞게 확인한다. 각 violation은 stable code, severity, feature와 field 경로, 관측값, 기대 조건과 가능한 correction scope를 가지며 자동 수선으로 원본 오류를 숨기지 않는다.

### 좌표와 경계 검증 {#world-site-coordinate-boundary-validation}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-coordinate-boundary-validation Requires transforms, control residuals, extents and seams to be measured. -->

좌표 검증은 단위·축·CRS·datum·epoch 완전성, 변환 가역성, 제어점 잔차, extent 포함과 host placement를 확인하고, 경계 검증은 tile·LOD·지형·물·도로·건물·설비 seam의 위치·높이·topology 차이를 측정한다. tolerance는 요구 축척과 출처 정확도에 결속되며 검증기가 임의로 완화하지 않는다.

### 환경과 관계 검증 {#world-site-environment-relation-validation}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-environment-relation-validation Requires terrain, water, ecology, networks, buildings and land relations to agree. -->

관계 검증은 지지·접촉·관입·clearance, 물과 지형·배수, 식생과 토양·물, route와 횡단부, 설비 dependency, 토지와 물리 feature, 세계와 건물 접점을 같은 canonical 시각에서 확인한다. 전문 solver가 필요한 관계는 spatial precheck와 전문 verdict를 구분하고, 후자가 없으면 전체 적합으로 판정하지 않는다.

### 상태와 detail 검증 {#world-site-state-detail-validation}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-state-detail-validation Requires phase, alternative, LOD, streaming and temporal consistency. -->

상태 검증은 유효 구간, phase 순서, canonical alternative, event consequence, source freshness와 dependency revision을 확인하고, detail 검증은 LOD 불변식, tile closure, population 상한과 stream 상태를 확인한다. 서로 다른 시각·alternative·revision의 조각을 한 delivery에 혼합하거나 stale cache를 resident current content로 취급하면 실패한다.

### visual review {#world-site-visual-review}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-visual-review Requires declared viewpoints and overlays to inspect seams, scale and continuity. -->

visual review 입력은 검토 목적, viewpoint 또는 camera path, 관찰 거리·시간, 필요한 layer·overlay와 acceptance 조건을 선언한다. 출력은 이미지 또는 interactive view identity, 사용한 state·LOD·tile, 보이는 gap과 reviewer finding을 연결한다. visual review는 수치 검증의 보완이며 아름다움이나 사실성을 자동 승인하는 단계가 아니다.

### 검증 재현 {#world-site-validation-reproduction}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-validation-reproduction Requires fixed inputs, versions, ordering and digests for reproducible verdicts. -->

validation run은 입력 artifact digest, canonical revision, 규칙 집합 version, 파라미터·tolerance, seed, 실행 순서와 결과 digest를 기록한다. 같은 지원 환경과 입력에서 violation과 산출물 정렬이 동일해야 하며, 병렬 처리나 tile load 순서가 verdict를 바꾸지 않는다. 규칙 version이 달라진 결과는 이전 verdict를 덮어쓰지 않고 별도 run으로 남긴다.

### 부분 delivery 거부 {#world-site-partial-delivery-refusal}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-partial-delivery-refusal Requires incomplete closure and failed required artifacts to block current delivery. -->

필수 artifact, dependency, tile, source, 좌표 해석 또는 validation이 빠지거나 실패하면 delivery 전체를 current·accepted로 표시하지 않는다. 안전하게 생성된 부분 artifact는 진단용 partial 상태와 제외 범위로 보존할 수 있지만 완전한 묶음과 다른 identity를 가지며 downstream 기본 입력이 되지 않는다. 재시도는 같은 원인과 scope를 추적한다.

### 미검증 범위와 호환성 {#world-site-unverified-scope-compatibility}

<!-- @evidence requirements/map/deliverables-and-validation.md#map-unverified-scope Requires unsupported, unobserved and waived scope to remain explicit. -->

manifest와 report는 unsupported, unobserved, out-of-extent, degraded, stale, failed와 명시적으로 waived된 범위를 구분하고 authority와 근거를 보존한다. 새 schema나 더 높은 fidelity가 추가되어도 기존 delivery의 좌표·identity·상태 의미를 바꾸지 않으며, 소비자가 새 의미를 읽지 못하면 명시적 compatibility failure 또는 승인된 degradation을 반환한다.
