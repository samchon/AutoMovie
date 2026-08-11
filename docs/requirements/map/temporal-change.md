# 시간 변화와 상태

## 같은 장소의 여러 시점 {#map-temporal-change}

맵은 계절, 공사, 성장, 침식, 전투, 재난, 복구와 역사적 단계에 따라 같은 identity의 상태가 달라지는 것을 film clock 또는 named phase에 연결할 수 있어야 한다.

### 유효 시간과 단계 순서 {#map-state-validity-phase-order}

각 state는 valid instant 또는 interval, phase order와 필요한 predecessor를 가져야 하며 timestamp를 모르는 역사적·fictional 단계도 named phase로 정렬할 수 있어야 한다. 겹치거나 비어 있는 state가 허용되는지 identity별로 판정하고 모순을 finding으로 남겨야 한다.

### 기존·변경·철거 상태 {#map-existing-change-demolition}

기존에 유지되는 요소, 제거되는 요소, 임시 요소와 새 요소를 구분하고 각 단계에서 visible, collidable, measurable와 traversable 여부를 추적해야 한다.

### 사건 consequence {#map-event-consequence}

Flood, fire, explosion, collapse, traffic, battle와 construction이 terrain, vegetation, water, infrastructure와 settlement에 남기는 변경을 bounded authored consequence로 표현할 수 있어야 한다.

### 연속 변화와 불연속 사건 {#map-continuous-discrete-change}

Water level, weather, growth와 이동처럼 sample 가능한 연속 변화와 demolition, breach, collapse, opening처럼 시점에서 바뀌는 불연속 사건을 구분해야 한다. 선언되지 않은 두 state 사이를 자동 보간하여 존재하지 않는 지형, 구조 또는 network 연결을 만들지 않아야 한다.

### 대안과 정본 {#map-alternative-canonical}

여러 map 대안을 공통 base와 차이로 비교하고 선택 전까지 보존할 수 있어야 하며 한 대안의 결과를 다른 대안의 정본으로 섞지 않는다.

### 변경 provenance {#map-change-provenance}

최종 상태는 base, phase, event와 override 중 어떤 사실에서 왔는지 추적할 수 있어야 한다.

### 변경 영향과 stale 결과 {#map-change-impact-staleness}

Terrain, shoreline, road, utility, parcel, vegetation 또는 placed asset의 변경이 영향을 주는 tile, route, quantity, visibility, render와 delivery를 식별하고 이전 resolved output을 stale로 처리할 수 있어야 한다.

### 시점 간 비교 {#map-temporal-comparison}

사용자는 같은 extent와 identity를 기준으로 추가, 제거, 이동, material·state 변화와 quantity delta를 비교하고, source 부재와 실제 변화와 detail 차이를 구분할 수 있어야 한다.
