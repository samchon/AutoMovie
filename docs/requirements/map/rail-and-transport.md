# 철도와 교통망

## 운행 가능한 교통 관계 {#map-rail-transport}

Rail, tram, cable, runway, taxiway, canal route, shipping lane과 다른 transport corridor를 path, gauge 또는 clearance, station, junction, direction과 operating state로 표현할 수 있어야 한다.

### 선로 구성 {#map-track-composition}

Track, sleeper, switch, crossing, platform, signal, catenary와 support를 반복 가능한 prototype과 개별 exception으로 구성할 수 있어야 한다.

### 정거장과 terminal {#map-station-terminal}

Station, stop, harbor, gate, depot와 terminal은 network node, host 시설, passenger 또는 cargo zone과 연결되어야 한다.

### 운행 state {#map-transport-operating-state}

Open, closed, occupied, damaged, under construction과 scheduled movement를 film clock과 scene state에서 구분할 수 있어야 한다.

### Transport bound {#map-transport-bound}

Film에 필요한 route와 traffic population의 범위를 선언하고 광역 운행 전체를 자동 simulation한 것처럼 주장하지 않는다.
