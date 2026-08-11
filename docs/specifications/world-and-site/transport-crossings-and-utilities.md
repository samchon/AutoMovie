# 교통, 횡단부와 설비

## 네트워크와 시설의 공통 상태 {#world-site-network-facility-state}

<!-- @evidence requirements/map/roads-and-paths.md#map-roads-paths Defines roads and paths as attributed networks rather than visual strips. -->
<!-- @evidence requirements/map/rail-and-transport.md#map-rail-transport Defines rail and transport facilities as connected operational state. -->
<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-utilities Defines utility systems as typed networks with dependencies. -->

시스템은 도로·보행로·철도·수상·사용자 정의 교통망, 교량·터널과 공공 설비망을 stable node, edge, corridor, facility와 교차 관계로 표현한다. 시대별 형식과 외관은 열린 속성이며 시스템은 차량, 궤도, 교량 형식이나 설비 catalog를 공급하지 않는다. 모든 network geometry와 운영 상태는 지형, 토지, 시간과 하나의 좌표 정본을 참조한다.

### 도로 reference와 선형 입력 {#world-site-road-reference-alignment-input}

<!-- @evidence requirements/map/roads-and-paths.md#map-road-route-reference Requires stable route identity, direction and linear referencing. -->
<!-- @evidence requirements/map/roads-and-paths.md#map-road-alignment-section Requires horizontal, vertical and cross-section facts to travel together. -->

도로와 path 입력은 route identity, 방향 또는 양방향성, 순서가 있는 centerline, stationing 기준, 수평·수직 선형과 구간별 단면을 선언한다. 폭, 차로·보행·어깨·배수 등 section 구성은 사용자 정의 role과 치수를 가지며, geometry만 보고 기능을 임의 분류하지 않는다. stationing 역전, 퇴화 edge, 서로 맞지 않는 선형과 단면은 해당 구간을 거부한다.

### 교차로, 사용자와 규칙 {#world-site-road-junction-user-rule}

<!-- @evidence requirements/map/roads-and-paths.md#map-road-junction Requires explicit junction topology, movements and priority. -->
<!-- @evidence requirements/map/roads-and-paths.md#map-road-users-rules Requires traveler classes, access and direction rules to be stateful. -->

교차로는 접속 edge, 높이 level, 허용 movement, 회전 또는 전이 비용, 통행 우선과 제어 상태를 가진다. 보행자, 자전거, 차량, 동물, 작업자와 사용자 정의 traveler class는 폭·높이·하중 envelope, 허용 surface와 시간별 접근 규칙을 참조한다. 선이 만나는 것만으로 접속을 만들거나 서로 다른 level의 교차를 평면 교차로 취급하지 않는다.

### 도로 시대, 용도와 상태 {#world-site-road-era-use-state}

<!-- @evidence requirements/map/roads-and-paths.md#map-road-era-use Requires era and intended use to remain authored open vocabulary. -->
<!-- @evidence requirements/map/roads-and-paths.md#map-road-state Requires closure, damage, construction and weather state to affect traversal. -->

건설 시기, 시대, 공식·비공식 용도, 포장과 관리 상태는 network identity와 분리된 시간 속성이다. 폐쇄, 공사, 손상, 침수, 적설과 행사 통제는 적용 구간·방향·traveler·기간을 가진 상태이며 route 질의와 산출물에 동일하게 적용된다. 외관이 낡아 보인다는 이유로 통행 불가나 역사적 시기를 추론하지 않는다.

### 도로와 지형 접합 {#world-site-road-terrain-seam}

<!-- @evidence requirements/map/roads-and-paths.md#map-road-terrain-seams Requires road edges, drainage and grade to meet terrain within tolerance. -->

도로 표면, 절·성토, 옹벽, 측구와 주변 지형의 경계는 위치·높이·경사·중첩 공차로 검증한다. 부유, 관입, 뒤집힌 배수 경사, 열린 edge와 tile 경계 단절은 seam 진단으로 출력한다. 시각적 skirt나 중첩은 사용자가 선택한 표시 저하일 수 있지만 정본 접합이 통과한 것으로 기록하지 않는다.

### 철도 envelope와 궤도 구성 {#world-site-rail-envelope-track-input}

<!-- @evidence requirements/map/rail-and-transport.md#map-transport-vehicle-envelope Requires vehicle and consist envelopes for clearance checks. -->
<!-- @evidence requirements/map/rail-and-transport.md#map-track-composition Requires track gauge, rails, alignment and directionality as one contract. -->

철도와 guideway 입력은 vehicle 또는 consist의 폭·높이·길이·곡선 여유 envelope, 궤간, track identity, 선형, 방향, 전철·신호 등 선언된 시스템 속성을 가진다. clearance는 선택된 envelope와 시간 상태를 사용해 검증하고, 궤도 외관이나 일반적인 규격을 근거로 치수를 채우지 않는다. 서로 맞지 않는 궤간, 급격한 geometry 단절과 미지 vehicle envelope는 운행 가능 판정을 보류한다.

### 역, 환승과 교차 {#world-site-station-interchange-crossing}

<!-- @evidence requirements/map/rail-and-transport.md#map-station-terminal Requires platforms, stops, access and terminal functions to be addressable. -->
<!-- @evidence requirements/map/rail-and-transport.md#map-transport-interchange-crossing Requires explicit transfers and grade-separated crossings. -->

역, 정류장, 승강장, terminal과 depot는 serving route, 접근 node, 정차 위치, platform edge, traveler class와 기능 zone을 참조한다. 노선 간 환승, 보행 연결, 도로·철도·수상망 교차는 연결 방향, level, 이동 비용과 접근 상태를 가진다. 공간적 근접성만으로 환승을 만들지 않으며 끊긴 접근이나 envelope 충돌은 facility별 실패로 출력한다.

### 교통 운영 상태와 경계 {#world-site-transport-operation-bound}

<!-- @evidence requirements/map/rail-and-transport.md#map-transport-operating-state Requires service, closure, direction and schedule state to be time-scoped. -->
<!-- @evidence requirements/map/rail-and-transport.md#map-transport-service-dependency Requires transport facilities to cite power, control and access dependencies. -->
<!-- @evidence requirements/map/rail-and-transport.md#map-transport-bound Limits operational claims to the declared model and evidence. -->

운행, 정차, 폐쇄, 방향 전환과 schedule은 노선과 facility에 적용되는 시간 상태이며, 전력·신호·연료·접근·교량 등 필요한 dependency를 명시한다. 시스템이 단순 연결성만 지원하면 상세 용량, 배차, 충돌 회피나 성능을 계산했다고 주장하지 않는다. 미선언 schedule 또는 전문 운영 model이 필요한 질의는 연결 geometry의 존재로 대신 답하지 않고 지원 수준을 반환한다.

### 횡단부 identity와 level {#world-site-crossing-identity-level}

<!-- @evidence requirements/map/bridges-and-tunnels.md#map-bridges-tunnels Defines bridges and tunnels as network relations with owned volumes. -->
<!-- @evidence requirements/map/bridges-and-tunnels.md#map-crossing-identity-level Requires each crossing to declare the networks and levels it joins or separates. -->

교량, culvert, 지하도와 터널은 자체 stable identity, 교차하는 network·물·지형 feature, 진입·이탈 node, 상하 level과 소유 범위를 가진다. 횡단부 geometry와 network 연결은 같은 관계를 참조하며, bridge mesh가 보인다는 이유로 경로가 연결되거나 두 선이 겹친다는 이유로 터널이 생성되지 않는다.

### 교량 span·support와 터널 volume {#world-site-bridge-support-tunnel-volume}

<!-- @evidence requirements/map/bridges-and-tunnels.md#map-bridge-span-support Requires deck, spans, supports and bearing ground relations. -->
<!-- @evidence requirements/map/bridges-and-tunnels.md#map-tunnel-volume Requires portal, bore, lining and void extent to be explicit. -->

교량은 deck envelope, span 구간, pier·abutment support와 지반·수중 접촉을 참조하고, 터널은 portal, 중심 경로, bore 또는 clearance volume, lining과 굴착 범위를 참조한다. support가 지표·지반과 닿지 않거나 bore가 주변 solid와 모순되거나 portal이 route와 이어지지 않으면 횡단부는 배치 실패다. 구조 형식이나 세부 부재는 사용자가 제공하지 않으면 생성하지 않는다.

### 횡단부 배수, 상태와 clearance {#world-site-crossing-drainage-state-clearance}

<!-- @evidence requirements/map/bridges-and-tunnels.md#map-tunnel-drainage-state Requires tunnel water, drainage and ventilation conditions to be stateful. -->
<!-- @evidence requirements/map/bridges-and-tunnels.md#map-crossing-state Requires opening, closure, damage and works to propagate into routing. -->
<!-- @evidence requirements/map/bridges-and-tunnels.md#map-crossing-clearance Requires horizontal, vertical, water and traveler clearance checks. -->

터널 침수, 배수, 환기와 조명 조건 및 횡단부의 개통, 폐쇄, 손상, 공사 상태는 시간별 operating state다. clearance 출력은 대상 traveler 또는 vehicle envelope, 물 수위, deck·bore geometry, 적용 공차와 revision을 포함한다. 필요한 geometry나 환경 상태가 없으면 안전함을 추정하지 않고 판정을 미확인으로 남긴다.

### 횡단부 구조 분석 한계 {#world-site-crossing-structural-limit}

<!-- @evidence requirements/map/bridges-and-tunnels.md#map-crossing-structural-bound Prevents spatial proxies from claiming structural adequacy. -->

시스템은 연결, 지지 위치, envelope와 간섭을 검증할 수 있지만, 별도 출처 또는 지원된 solver 없이 교량·터널의 구조 안전, 내진, 내화, 지반 안정이나 수압 성능을 승인하지 않는다. 외부 전문 결과는 분석 identity, 입력 revision, 유효 범위와 verdict를 보존해 연결하고, geometry 변경 시 stale로 전이한다.

### 설비 identity, 종류와 위치 {#world-site-utility-identity-location}

<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-service-identity-kind Requires each utility system, medium, component and connection to be typed. -->
<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-above-below Requires above-ground, buried, submerged and suspended placement to remain explicit. -->

설비망은 system, medium, 단위, root, node, port, segment와 facility identity를 가지며, 지상·지중·수중·가공 위치와 깊이 또는 높이 기준을 선언한다. 열린 medium과 facility 어휘는 시대·지역에 중립적이며 시각 자산 종류로 기능을 추론하지 않는다. 연결된 port의 medium·단위·방향이 다르거나 segment가 존재하지 않는 node를 참조하면 네트워크를 거부한다.

### corridor, 접근과 용량 {#world-site-utility-corridor-capacity}

<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-corridor-access Requires right-of-way, easement, maintenance and crossing access. -->
<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-capacity-flow Requires declared capacities, demands, directions and supported analysis. -->

설비 segment는 route, 점유 envelope, 보호·easement corridor, 접근점, 교차 sleeve와 유지보수 clearance를 가진다. 용량, 수요, 흐름 방향과 operating state는 단위와 출처를 포함하며, 지원된 검증은 연결성, medium 일치, 선언 capacity 초과와 공간 충돌을 출력한다. 전문 유압·전기·통신·열 해석이 없으면 단순 합계나 연결을 성능 보증으로 표시하지 않는다.

### 설비 시대, 고장과 복구 {#world-site-utility-era-failure-recovery}

<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-era Requires installation era and technology to remain authored attributes. -->
<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-failure-recovery Requires outage, isolation, repair and restored state to preserve causality. -->

설치 시기, 기술 방식, 재료와 관리 주체는 사용자 정의 속성이며 설비 catalog를 선택하는 키가 아니다. 고장, 누수, 단선, 폐쇄, 격리, 우회, 수리와 복구는 원인, 영향 network subset, 시작·종료, phase와 successor 관계를 가진다. 복구 상태는 이전 고장을 삭제하지 않고, 같은 조건과 시각에서 같은 reachable·served 결과를 낸다.

### dependency와 분석 경계 {#world-site-utility-dependency-analysis-bound}

<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-dependencies Requires cross-system and building interface dependencies to be explicit. -->
<!-- @evidence requirements/map/infrastructure-and-utilities.md#map-infrastructure-analysis-bound Limits claims to supported connectivity, capacity and spatial checks. -->
<!-- @evidence requirements/building-exterior/services-and-envelope-interfaces.md#building-service-map-interface Preserves the stable seam between site utilities and building services. -->

전력에 의존하는 펌프, 통신에 의존하는 제어, 배수에 의존하는 도로, 관수에 의존하는 식생과 건물 service 접점은 방향 있는 dependency로 기록된다. 원본 변경이나 고장은 downstream 상태와 산출물을 stale 또는 unavailable로 전이한다. dependency graph, 위치와 선언 capacity가 답할 수 없는 서비스 수준, 복원 시간, 안전성이나 규정 적합성은 지원되지 않은 분석으로 반환한다.
