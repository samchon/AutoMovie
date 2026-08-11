# 지도 산출물과 검증

## 동일한 맵에서 나온 산출물 {#map-deliverables-validation}

Topographic map, contour, section, hydrology map, vegetation map, land-use map, road·rail network, infrastructure plan, visibility study, quantity와 3D render는 같은 map identity와 resolved state를 읽어야 한다.

### 지도 표현 {#map-cartographic-output}

각 view는 projection, scale, north, elevation datum, extent, layer, legend와 uncertainty를 선언하여 3D world의 의미를 왜곡하지 않아야 한다.

### 수량과 통계 {#map-quantities-statistics}

Area, length, volume, count, density, elevation range, slope, water volume, flow, cut·fill과 population은 source identity, unit, scope와 exclusions를 가져야 한다.

### 기하와 topology 검증 {#map-geometry-topology-validation}

Gap, overlap, inverted surface, disconnected network, invalid crossing, unsupported structure와 inconsistent coordinate transform을 탐지해야 한다.

### 환경 관계 검증 {#map-environment-relation-validation}

Water와 terrain, vegetation과 substrate, building과 site, road와 bridge, utility와 consumer, movement와 obstacle의 관계 모순을 확인해야 한다.

### 시각적 검토 {#map-visual-review}

실제 3D 장면에서 scale, silhouette, terrain readability, water extent, vegetation density, settlement organization, weather, distance cue와 film action의 공간 관계를 검토하고 source 수정 뒤 다시 재현할 수 있어야 한다.

### 미검증 범위 {#map-unverified-scope}

Simulation, 생태, 수문, 교통, 구조와 측량 중 검증하지 않은 분야는 authored approximation 또는 unknown으로 표시하고 전문 분석 결과로 주장하지 않는다.
