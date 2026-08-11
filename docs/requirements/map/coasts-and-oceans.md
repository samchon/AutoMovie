# 해안과 해양

## 해안과 해수면 {#map-coast-ocean}

바다, 만, 해협, 하구, 갯벌, 해변, 암석 해안, 절벽 해안과 항만을 지형·수심·shoreline·조석과 연결된 공간으로 표현할 수 있어야 한다.

### 수심과 해저 {#map-bathymetry-seabed}

연안과 필요한 해역은 bathymetry, seabed material, reef, shoal, channel과 obstacle을 선언하여 선박, wave와 camera result가 같은 수중 지형을 읽게 해야 한다.

### 해수면 기준 {#map-sea-level-datum}

Bathymetry, chart depth, tide, storm surge, structure clearance와 육상 elevation은 각각의 vertical datum과 epoch를 선언하고 서로 변환된 관계를 가져야 한다. Zero level이 다름을 숨긴 채 shoreline과 수심을 맞추지 않아야 한다.

### 조석과 파랑 {#map-tide-wave}

Tide level, current, wave direction, height, period와 shoreline 변화는 bounded state로 표현할 수 있어야 하며 고정된 평면을 모든 시간의 바다로 사용하지 않는다.

### 폭풍 해일과 해안 변화 {#map-coastal-hazard-change}

Storm surge, overtopping, coastal flooding, erosion, deposition와 barrier breach를 named scenario 또는 phase로 표현하고 road, building, harbor, vegetation와 ground state에 미치는 bounded consequence를 추적할 수 있어야 한다.

### 육해 경계 {#map-land-water-transition}

Beach, quay, seawall, pier, breakwater, estuary와 flood zone은 육지 지형, 구조물과 물 상태가 만나는 실제 경계를 가져야 한다.

### 수상 이동과 노출 {#map-marine-navigation-exposure}

Vessel route, harbor access, ford, amphibious movement와 camera placement에 필요한 depth, under-keel 또는 body clearance, current, wave exposure와 obstacle을 같은 state에서 판단할 수 있어야 한다. 수행하지 않은 항해 또는 해양 공학 검증을 통과한 것으로 보고하지 않아야 한다.

### 해양 범위 {#map-ocean-bounds}

광역 바다를 무한 simulation하지 않고 film이 요구하는 visible, interaction과 evidence 범위를 선언하고 바깥은 명시적 context로 처리해야 한다.
