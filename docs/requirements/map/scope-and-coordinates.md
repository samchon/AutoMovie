# 범위와 좌표

## 영화 세계의 공간 정본 {#map-spatial-source-of-truth}

맵은 자연 지형과 인공 환경을 같은 세계 좌표에서 구성하고, scene의 건물, 인물, 차량, camera, light, sound와 simulation이 참조하는 공간 정본이 되어야 한다.

### 좌표와 단위 {#map-coordinate-unit}

맵은 원점, 축 방향, 길이 단위, 높이 기준과 필요할 때의 지리 기준을 선언해야 하며 서로 다른 source의 좌표를 숨은 scale이나 임의 offset으로 맞추지 않는다.

### 범위와 경계 {#map-extent-boundary}

저작된 범위, simulation 범위, render 가능한 범위와 읽기 전용 주변 context를 구분하고, 범위 밖을 무한하거나 완성된 세계로 가장하지 않는다.

### 축척 계층 {#map-scale-levels}

대륙, 지역, 도시, 동네, 필지와 현장처럼 서로 다른 축척을 연결할 수 있어야 하며, 각 축척에서 보존하거나 단순화한 identity와 정밀도를 설명할 수 있어야 한다.

### Host와 scene의 배치 {#map-host-scene-placement}

건물, 선박, 차량, 야영지와 다른 scene host는 맵의 지형, 수계, 접근, 방위와 주변 관계를 따르는 안정된 placement를 가져야 한다.
