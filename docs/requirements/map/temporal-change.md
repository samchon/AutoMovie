# 시간 변화와 상태

## 같은 장소의 여러 시점 {#map-temporal-change}

맵은 계절, 공사, 성장, 침식, 전투, 재난, 복구와 역사적 단계에 따라 같은 identity의 상태가 달라지는 것을 film clock 또는 named phase에 연결할 수 있어야 한다.

### 기존·변경·철거 상태 {#map-existing-change-demolition}

기존에 유지되는 요소, 제거되는 요소, 임시 요소와 새 요소를 구분하고 각 단계에서 visible, collidable, measurable와 traversable 여부를 추적해야 한다.

### 사건 consequence {#map-event-consequence}

Flood, fire, explosion, collapse, traffic, battle와 construction이 terrain, vegetation, water, infrastructure와 settlement에 남기는 변경을 bounded authored consequence로 표현할 수 있어야 한다.

### 대안과 정본 {#map-alternative-canonical}

여러 map 대안을 공통 base와 차이로 비교하고 선택 전까지 보존할 수 있어야 하며 한 대안의 결과를 다른 대안의 정본으로 섞지 않는다.

### 변경 provenance {#map-change-provenance}

최종 상태는 base, phase, event와 override 중 어떤 사실에서 왔는지 추적할 수 있어야 한다.
