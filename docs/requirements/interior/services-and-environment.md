# 설비와 실내 환경

## 공간을 사용하는 Service Network {#interior-services-environment}

Power, lighting circuit, data, communication, water supply, drainage, waste, gas, fuel, ventilation, heating, cooling, fire protection와 project-defined service를 source, sink, port, route, branch와 state가 있는 network로 표현할 수 있어야 한다.

### 공간과 설비 Route {#interior-service-routing}

Duct, pipe, conduit, cable tray와 service void는 shaft, riser, plenum, floor, wall과 equipment를 실제 route, size, slope 또는 bend와 clearance로 연결해야 한다.

### Terminal과 Control {#interior-service-terminals-controls}

Outlet, diffuser, grille, drain, sprinkler, detector, switch, valve, panel와 sensor를 serving space, equipment, control zone와 state에 연결할 수 있어야 한다.

### Capacity와 환경 상태 {#interior-service-capacity-environment}

Film이나 analysis가 요구하는 범위에서 airflow, temperature, humidity, pressure, flow, load, demand와 capacity를 unit와 시간 state로 선언하고 계산하지 않은 성능을 추정하지 않아야 한다.

### Network 검증 {#interior-service-network-validation}

Disconnected consumer, open end, invalid flow direction, missing source, impossible slope, route collision, insufficient declared capacity와 conflicting state를 탐지해야 한다.

### 외부 Interface {#interior-service-exterior-interface}

Building exterior와 map utility가 제공하는 service connection, shaft, intake, exhaust와 discharge를 같은 port identity로 연결하고 양쪽 범위 밖의 network를 완성된 것으로 가장하지 않아야 한다.
