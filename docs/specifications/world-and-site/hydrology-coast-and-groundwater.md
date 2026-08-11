# 수문, 해안과 지하수

## 물 시스템의 경계와 상태 {#world-site-water-system-state}

### 유역, 배수와 물 경계 입력 {#world-site-watershed-water-boundary-input}

<!-- @evidence requirements/map/rivers-and-inland-water.md#map-inland-hydrology Defines inland water as connected, sourced spatial state. -->
<!-- @evidence requirements/map/coasts-and-oceans.md#map-coast-ocean Defines coastal and ocean state without supplying a named sea. -->

시스템은 유역, 배수망, 하천, 호수, 습지, 저수지, 해안선, 조석 수역, 해저와 지하수 경계를 stable identity로 표현한다. 물 geometry, 기준 수위, 유량 또는 변화 상태, 주변 지형·구조물과의 관계는 하나의 revision에 결속되며, 장식용 물 표면은 검증된 수문 상태로 승격되지 않는다.

<!-- @evidence requirements/map/rivers-and-inland-water.md#map-watershed-drainage Requires directed watershed and drainage connectivity. -->
<!-- @evidence requirements/map/rivers-and-inland-water.md#map-water-boundary-volume Requires bank, bed, free surface and water volume to remain distinguishable. -->

입력은 집수구역, 흐름 방향, 합류·분기, 유입·유출, 물 feature의 footprint 또는 체적, 바닥, 제방과 자유수면 기준을 선언한다. 네트워크의 방향과 연결은 geometry에서 임의로 추론하지 않고 명시값 또는 재현 가능한 derivation으로 정한다. 닫히지 않은 체적, 끊긴 도달 관계, 역전된 바닥과 수면, 유역 밖으로 사라지는 흐름은 feature 경로와 함께 실패한다.

### 유량과 계절·사건 상태 {#world-site-water-flow-season-event}

<!-- @evidence requirements/map/rivers-and-inland-water.md#map-water-flow Requires flow quantities, direction and provenance to be explicit. -->
<!-- @evidence requirements/map/rivers-and-inland-water.md#map-water-season-event Requires seasonal and event water states to share canonical geometry. -->

유량, 속도, 수심, 수위와 저장량은 단위, 측정 또는 모델 출처, 유효 시각·기간과 불확실성을 가진다. 평수, 갈수, 우기, 방류와 폭우 상태는 같은 물 feature의 시간 상태이며 별도 복제 geometry가 아니다. 보간은 선언된 연속 상태에서만 허용되고, 홍수나 구조물 파손 같은 불연속 사건을 중간값으로 만들어내지 않는다.

### 홍수와 범람 출력 {#world-site-flood-inundation-output}

<!-- @evidence requirements/map/rivers-and-inland-water.md#map-flood-inundation Requires inundation extent, depth, time and assumptions to travel together. -->
<!-- @evidence requirements/map/rivers-and-inland-water.md#map-water-surroundings Requires water consequences to remain joined to terrain, structures and access. -->

홍수 출력은 사건 또는 시나리오 identity, 시간 표본, 범람 extent, 가능한 경우 수심과 속도, 사용한 지형·수문 revision, 경계 조건과 지원 수준을 포함한다. 범람 상태는 도로·철도·공공 공간·건물 접점·식생과 이동 가능성에 dependency를 생성하며, 관련 소비자는 같은 시간 상태를 읽는다. 단순한 물 polygon 확장은 계산된 홍수 깊이나 안전 판정으로 표기할 수 없다.

### 지표수와 지하수 관계 {#world-site-surface-groundwater-relation}

<!-- @evidence requirements/map/rivers-and-inland-water.md#map-surface-groundwater-boundary Requires declared groundwater surfaces and exchange boundaries. -->
<!-- @evidence requirements/map/geology-and-ground-surfaces.md#map-surface-subsurface-relation Keeps groundwater interpretation tied to supporting ground evidence. -->

지하수 상태는 기준면, 수두 또는 포화 경계, 유효 시각, 지질·토양 feature와의 관계, 지표수와의 교환 경계를 가진다. 자료가 수위 관측점만 제공하면 시스템은 관측을 보존하고 지원된 보간 범위만 출력하며, 임의의 대수층 체적이나 유동장을 만들지 않는다. 지하수와 굴착·터널·지하 설비의 교차는 검증 가능한 geometry가 있을 때만 판정한다.

### 수문 보류와 분석 한계 {#world-site-hydrology-refusal-limit}

<!-- @evidence requirements/map/rivers-and-inland-water.md#map-water-refusal Requires unsupported water claims to be refused rather than decorated. -->
<!-- @evidence requirements/map/rivers-and-inland-water.md#map-hydrology-analysis-bound Separates representational water state from professional hydrologic analysis. -->

필수 경계, datum, 시간, 유입·유출 또는 해상도가 빠졌거나 질량 보존과 모순되는 경우에는 해당 계산을 거부하고 누락된 근거를 반환한다. 시스템이 지원하지 않는 강우 유출, 하천 수리, 댐 안전, 지하수 유동과 오염 확산은 전문 분석 결과로 주장하지 않으며, 사용자가 가져온 결과는 그 provenance와 가정이 보존된 외부 분석으로만 채택한다.

### 해저, 수위 datum과 해안 접합 {#world-site-seabed-level-coast-seam}

<!-- @evidence requirements/map/coasts-and-oceans.md#map-bathymetry-seabed Requires bathymetry resolution, datum and seabed gaps to be explicit. -->
<!-- @evidence requirements/map/coasts-and-oceans.md#map-sea-level-datum Requires mean level, chart datum and vertical reference to remain distinct. -->
<!-- @evidence requirements/map/coasts-and-oceans.md#map-land-water-transition Requires a watertight or explicitly gapped land-water transition. -->

수심과 해저 표면은 표본 해상도, nodata, 수직 datum과 양의 방향을 보존한다. 평균 해수면, 조위 기준면, chart datum과 제작 수직 datum은 이름과 변환 관계가 없으면 합치지 않는다. 육지 지형, 해안선, 해저와 자유수면의 접합은 허용 공차 안에서 일치하거나 의도된 절벽·방벽·빈틈으로 분류되어야 하며, 단순 중첩으로 seam을 숨기지 않는다.

### 조석, 파랑과 연안 위험 {#world-site-tide-wave-coastal-hazard}

<!-- @evidence requirements/map/coasts-and-oceans.md#map-tide-wave Requires time-scoped tide and wave state with stated support. -->
<!-- @evidence requirements/map/coasts-and-oceans.md#map-coastal-hazard-change Requires erosion, surge and shoreline change to be phased consequences. -->

조위, 파랑 방향·높이·주기와 해일 상태는 위치, 시각, 기준면, 출처와 지원된 샘플링 수준을 가진다. 침식, 퇴적, 폭풍 해일, 월파와 해안선 이동은 canonical 해안 feature에 적용되는 사건·phase 상태이고 지형, 접근, 구조물과 생태 dependency를 stale로 전이한다. 장식 파랑은 해양 항행이나 연안 위험 판정의 입력이 될 수 없다.

### 해양 항행과 범위 한계 {#world-site-marine-navigation-bound}

<!-- @evidence requirements/map/coasts-and-oceans.md#map-marine-navigation-exposure Requires declared depth, clearance and exposure for marine routes. -->
<!-- @evidence requirements/map/coasts-and-oceans.md#map-ocean-bounds Requires bounded domains and refusal outside supported ocean scope. -->

항로와 수상 접근은 선박 envelope, 요구 수심, 상부·측면 clearance, 조위 상태와 노출 조건을 함께 참조하고 지원된 geometry 범위에서만 통과 여부를 출력한다. 해양 domain은 계산·표현 extent, 경계 조건, 해상도와 시간 범위를 명시하며, 그 밖의 무한 바다나 전 지구 물리 상태를 자동 생성하지 않는다. 범위를 벗어난 질의는 가장자리 값을 연장하지 않고 범위 밖으로 응답한다.
