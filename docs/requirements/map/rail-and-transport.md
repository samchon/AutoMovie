# 철도와 교통망

## 운행 가능한 교통 관계 {#map-rail-transport}

Rail, tram, cable, runway, taxiway, canal route, shipping lane과 다른 transport corridor를 path, gauge 또는 clearance, station, junction, direction과 operating state로 표현할 수 있어야 한다.

### Vehicle envelope와 경로 제약 {#map-transport-vehicle-envelope}

Project-defined vehicle 또는 conveyance는 gauge, turning radius, grade, platform relation, swept envelope, overhead·side·underbody clearance와 medium depth 중 필요한 제약을 가질 수 있어야 한다. Route 검토는 이름이 아니라 실제 corridor geometry와 current state를 사용해야 한다.

### 선로 구성 {#map-track-composition}

Track, sleeper, switch, crossing, platform, signal, catenary와 support를 반복 가능한 prototype과 개별 exception으로 구성할 수 있어야 한다.

### 정거장과 terminal {#map-station-terminal}

Station, stop, harbor, gate, depot와 terminal은 network node, host 시설, passenger 또는 cargo zone과 연결되어야 한다.

### Network 간 환승과 교차 {#map-transport-interchange-crossing}

Rail-road crossing, interchange, ferry landing, port-rail transfer, cable terminal과 project-defined transfer를 서로 다른 network의 node와 level 관계로 표현할 수 있어야 한다. Transfer가 시각적으로 가까워도 access, capacity 또는 operating state가 연결되지 않으면 usable route로 취급하지 않아야 한다.

### 운행 state {#map-transport-operating-state}

Open, closed, occupied, damaged, under construction과 scheduled movement를 film clock과 scene state에서 구분할 수 있어야 한다.

### 운행과 infrastructure 의존성 {#map-transport-service-dependency}

Signal, power, fuel, water depth, bridge, tunnel, gate와 terminal service가 필요한 운행은 해당 dependency의 current state를 참조해야 한다. Dependency failure와 temporary operating rule이 route, capacity와 scheduled movement에 미치는 영향을 추적할 수 있어야 한다.

### Transport bound {#map-transport-bound}

Film에 필요한 route와 traffic population의 범위를 선언하고 광역 운행 전체를 자동 simulation한 것처럼 주장하지 않는다.
