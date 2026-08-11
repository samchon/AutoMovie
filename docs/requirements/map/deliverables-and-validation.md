# 지도 산출물과 검증

## 동일한 맵에서 나온 산출물 {#map-deliverables-validation}

Topographic map, contour, section, hydrology map, vegetation map, land-use map, road·rail network, infrastructure plan, visibility study, quantity와 3D render는 같은 map identity와 resolved state를 읽어야 한다.

### 납품 Manifest {#map-delivery-manifest}

각 delivery는 project, map version, source digest set, CRS와 vertical datum, extent, time·phase·alternative, detail 또는 tile set, unit, generated time과 producer를 식별하는 manifest를 가져야 한다. 여러 상태의 파일을 같은 current package로 섞지 않아야 한다.

### Source, resolved state와 표현 결과 {#map-source-resolved-output}

사용자는 adopted source, authored override, resolved world와 각 drawing·quantity·render를 구분하고 결과에서 원인을 역추적할 수 있어야 한다. Cartographic symbol, simplified geometry와 visual effect를 실제 world geometry나 measured fact로 오인하지 않게 해야 한다.

### 지도 표현 {#map-cartographic-output}

각 view는 projection, scale, north, elevation datum, extent, layer, legend와 uncertainty를 선언하여 3D world의 의미를 왜곡하지 않아야 한다.

### Tile과 외부 교환 {#map-delivery-tiles-exchange}

Tiled delivery는 tile scheme, level, bounds, seam 또는 overlap policy, compression, missing tile와 dependency closure를 명시해야 한다. 외부 spatial data와 채택한 glTF를 project source로 보존할 때는 지원 범위, coordinate transform, conversion loss와 map identity 대응을 함께 제공하되 resolved scene의 glTF export를 약속하지 않아야 한다.

### 수량과 통계 {#map-quantities-statistics}

Area, length, volume, count, density, elevation range, slope, water volume, flow, cut·fill과 population은 source identity, unit, scope와 exclusions를 가져야 한다.

### 기하와 topology 검증 {#map-geometry-topology-validation}

Gap, overlap, inverted surface, disconnected network, invalid crossing, unsupported structure와 inconsistent coordinate transform을 탐지해야 한다.

### 좌표와 경계 검증 {#map-coordinate-boundary-validation}

Control point residual, unit·axis·datum mismatch, extent escape, tile seam, duplicate 또는 missing feature와 vertical reference conflict를 검토하고 location, severity, affected identity와 correction direction을 가진 finding으로 보고해야 한다.

### 환경 관계 검증 {#map-environment-relation-validation}

Water와 terrain, vegetation과 substrate, building과 site, road와 bridge, utility와 consumer, movement와 obstacle의 관계 모순을 확인해야 한다.

### 시간과 detail 검증 {#map-state-detail-validation}

같은 delivery의 phase, event, weather, water, access와 population state가 일치하는지, LOD와 tile 전환에서 identity, silhouette, quantity, route와 visibility가 허용오차 안에서 보존되는지 검토해야 한다.

### 시각적 검토 {#map-visual-review}

실제 3D 장면에서 scale, silhouette, terrain readability, water extent, vegetation density, settlement organization, weather, distance cue와 film action의 공간 관계를 검토하고 source 수정 뒤 다시 재현할 수 있어야 한다.

### 검증 결과와 재현 {#map-validation-reproduction}

Validation report는 입력 manifest, check version, tolerance, sampled 범위, passed·failed·unknown 결과와 finding identity를 보존해야 한다. 같은 입력과 선택을 다시 실행하면 같은 resolved map, quantity와 deterministic render evidence를 얻을 수 있어야 한다.

### 부분 납품과 거부 {#map-partial-delivery-refusal}

필요한 source, tile, phase, relation 또는 검증이 누락된 경우 usable subset과 unavailable scope를 분리해 납품할 수 있으나 빈 결과, proxy 또는 이전 결과를 current complete delivery로 표시하지 않아야 한다.

### 미검증 범위 {#map-unverified-scope}

Simulation, 생태, 수문, 교통, 구조와 측량 중 검증하지 않은 분야는 authored approximation 또는 unknown으로 표시하고 전문 분석 결과로 주장하지 않는다.
