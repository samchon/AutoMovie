# 하천과 내륙 수계

## 연결된 내륙 수계 {#map-inland-hydrology}

강, 하천, 개울, 운하, 호수, 저수지, 습지, 연못, 수로와 배수망을 서로 연결된 유역과 수체 identity로 표현할 수 있어야 한다.

### 유역과 배수 {#map-watershed-drainage}

Catchment, drainage divide, flow path, depression, inlet, outlet와 receiving water를 지형과 연결하여 비와 방류가 어느 수체로 이동하는지 추적할 수 있어야 한다. 자연 수로, 인공 배수와 범위 밖 boundary condition을 구분해야 한다.

### 경계와 수량 {#map-water-boundary-volume}

각 수체는 bed, bank, shoreline, width, depth, water level, storage volume과 저작 범위를 가져야 하며 화면용 평면만으로 수량을 대신하지 않는다.

### 흐름과 방향 {#map-water-flow}

유입, 유출, 유량, 속도, 방향, 합류, 분기, 낙차, 보와 수문을 표현하고 mass balance가 필요한 범위에서 수량 변화를 검토할 수 있어야 한다.

### 계절과 사건 {#map-water-season-event}

가뭄, 우기, 홍수, 결빙, 해빙, 댐 방류와 전투·공사에 따른 막힘을 시간 상태로 비교할 수 있어야 한다.

### 홍수와 범람 {#map-flood-inundation}

Flood source, scenario 또는 named event마다 범람 extent, depth, flow direction 또는 velocity가 필요한 영역, arrival·peak·recession time과 uncertainty를 표현할 수 있어야 한다. 범람은 road closure, bridge clearance, building access, ground saturation, vegetation와 evacuation route가 읽는 같은 water state가 되어야 한다.

### 지표수와 지하수 경계 {#map-surface-groundwater-boundary}

Spring, seepage, water table, infiltration와 subsurface drainage가 필요한 project는 지표수와의 교환과 유효 범위를 선언할 수 있어야 한다. 지하수를 모델링하지 않은 영역에서는 지표의 wetness만으로 지하 수량을 추정한 것처럼 주장하지 않아야 한다.

### 물과 주변 요소 {#map-water-surroundings}

교량, 제방, 취수, 배수, 건물, 도로, 식생, 선박과 배우가 같은 수면·수심·유속·경계 정보를 참조해야 한다.

### 수계 refusal {#map-water-refusal}

거꾸로 흐르는 경사, 끊긴 channel, 음수 수심, 겹친 bank, 수량 보존 위반과 범위 밖 유출은 named finding으로 남겨야 한다.

### 수문 정확성 범위 {#map-hydrology-analysis-bound}

Authored level과 bounded flow는 film continuity와 공간 관계를 검토할 수 있지만 calibration되지 않은 강우, 유량 또는 flood state를 실제 수문 예측으로 주장하지 않아야 한다. 사용한 source, scenario, boundary condition과 검증 수준을 함께 보고해야 한다.
