# 범위와 좌표

## 영화 세계의 공간 정본 {#map-spatial-source-of-truth}

맵은 자연 지형과 인공 환경을 같은 세계 좌표에서 구성하고, scene의 건물, 인물, 차량, camera, light, sound와 simulation이 참조하는 공간 정본이 되어야 한다.

### 공간 요소 Identity와 관계 {#map-spatial-feature-identity}

Terrain region, water body, route segment, parcel, settlement, vegetation population, utility, boundary와 placed asset은 stable identity, project-defined kind, 필요한 명칭과 alias, geometry 또는 extent, valid state와 다른 요소의 관계를 가질 수 있어야 한다. Source 교체, geometry 단순화, split와 merge 뒤에도 유지·파생·종료된 identity의 lineage를 추적해야 한다.

### 좌표와 단위 {#map-coordinate-unit}

맵은 원점, 축 방향, 길이 단위, 높이 기준과 필요할 때의 지리 기준을 선언해야 하며 서로 다른 source의 좌표를 숨은 scale이나 임의 offset으로 맞추지 않는다.

### 좌표 참조 체계 {#map-coordinate-reference-system}

현실 공간자료는 geographic 또는 projected CRS와 그 version을, 측량·세트·가상 세계는 project-local 또는 fictional reference frame과 기준점을 선언할 수 있어야 한다. CRS가 없는 자료를 임의로 추정하거나 서로 다른 datum의 숫자가 같다는 이유로 같은 위치로 취급하지 않아야 한다.

### 수평·수직·시간 기준 {#map-horizontal-vertical-temporal-reference}

수평 datum, geoid 또는 ellipsoid와 연결된 수직 datum, 평균 해수면·조위·project zero 같은 높이 기준, 좌표가 유효한 epoch를 서로 구분해야 한다. 지반고, 수심, 구조물 높이와 수면고가 어떤 기준에 대한 값인지 사용자가 확인할 수 있어야 한다.

### 좌표 변환과 정밀도 {#map-coordinate-transform-precision}

Source에서 world까지의 reprojection, axis·unit 변환, translation, rotation과 scale의 순서, 사용한 control point, residual과 허용오차를 추적할 수 있어야 한다. 광역 좌표에서도 가까운 배우와 구조물의 접촉이 흔들리지 않도록 표현 정밀도와 local working origin의 범위를 선언하고, origin 변경이 identity나 실제 위치를 바꾸지 않아야 한다.

### 범위와 경계 {#map-extent-boundary}

저작된 범위, simulation 범위, render 가능한 범위와 읽기 전용 주변 context를 구분하고, 범위 밖을 무한하거나 완성된 세계로 가장하지 않는다.

### 축척 계층 {#map-scale-levels}

대륙, 지역, 도시, 동네, 필지와 현장처럼 서로 다른 축척을 연결할 수 있어야 하며, 각 축척에서 보존하거나 단순화한 identity와 정밀도를 설명할 수 있어야 한다.

### 공간 기준점 {#map-coordinate-control-points}

사용자는 알려진 위치, 표고, 거리와 방향을 control point 또는 checkpoint로 지정하고 source, resolved map과 납품 결과에서 같은 점을 비교할 수 있어야 한다. 기준점이 부족하거나 오차가 허용범위를 넘으면 배치를 성공으로 보고하지 않아야 한다.

### Host와 scene의 배치 {#map-host-scene-placement}

건물, 선박, 차량, 야영지와 다른 scene host는 맵의 지형, 수계, 접근, 방위와 주변 관계를 따르는 안정된 placement를 가져야 한다.
