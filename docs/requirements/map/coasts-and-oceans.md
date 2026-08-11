# 해안과 해양

## 해안과 해수면 {#map-coast-ocean}

바다, 만, 해협, 하구, 갯벌, 해변, 암안, 절벽 해안과 항만을 지형·수심·shoreline·조석과 연결된 공간으로 표현할 수 있어야 한다.

### 수심과 해저 {#map-bathymetry-seabed}

연안과 필요한 해역은 bathymetry, seabed material, reef, shoal, channel과 obstacle을 선언하여 선박, wave와 camera result가 같은 수중 지형을 읽게 해야 한다.

### 조석과 파랑 {#map-tide-wave}

Tide level, current, wave direction, height, period와 shoreline 변화는 bounded state로 표현할 수 있어야 하며 고정된 평면을 모든 시간의 바다로 사용하지 않는다.

### 육해 경계 {#map-land-water-transition}

Beach, quay, seawall, pier, breakwater, estuary와 flood zone은 육지 지형, 구조물과 물 상태가 만나는 실제 경계를 가져야 한다.

### 해양 범위 {#map-ocean-bounds}

광역 바다를 무한 simulation하지 않고 film이 요구하는 visible, interaction과 evidence 범위를 선언하고 바깥은 명시적 context로 처리해야 한다.
