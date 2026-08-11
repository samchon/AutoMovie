# 필지와 토지 이용

## 소유와 사용의 공간 경계 {#map-parcels-land-use}

Parcel, district, zone, field, forest, military area, industrial site와 restricted area를 지형과 겹칠 수 있는 stable boundary와 identity로 표현할 수 있어야 한다.

### 경계 출처 {#map-parcel-boundary-provenance}

Surveyed, referenced, fictional와 approximate boundary를 구분하고 source, uncertainty와 film usage를 추적해야 한다.

### Boundary topology와 monument {#map-parcel-boundary-topology}

Shared edge, enclosure, hole, island, adjacent parcel, boundary marker와 control point를 표현하고 같은 경계를 이웃이 서로 다른 geometry로 중복 소유하지 않아야 한다. Open boundary와 approximate visual zone은 closed legal parcel과 구분해야 한다.

### 토지 이용 state {#map-land-use-state}

Residential, agricultural, commercial, military, abandoned, damaged와 temporary use를 시간 또는 대안에 따라 바꿀 수 있어야 한다.

### 물리 요소와의 관계 {#map-land-use-physical-relation}

Building, road, vegetation, water, fence와 activity는 parcel·zone과 관계를 가질 수 있지만 논리 경계를 반드시 물리 wall로 바꾸지 않는다.

### 권리와 중첩 사용 {#map-land-rights-overlays}

Ownership, tenure, access, easement, right-of-way, lease, restriction와 project-defined authority는 같은 토지 위에 별도 boundary와 valid phase로 중첩될 수 있어야 한다. 법적 정확성을 검증하지 않은 authored 관계는 실제 권리로 주장하지 않아야 한다.

### 토지 이용과 수용력 {#map-land-use-capacity}

Land use는 activity, occupant 또는 population, service, access와 environmental constraint에 대한 authored capacity를 가질 수 있어야 한다. 현재 이용, 허용 이용, 계획 이용과 화면에 보이는 외관을 서로 같은 사실로 간주하지 않아야 한다.

### 경계 conflict {#map-parcel-conflict}

겹치는 권한, 닫히지 않은 필수 polygon, unknown ownership과 contradictory use는 명시적 finding으로 남겨야 한다.
