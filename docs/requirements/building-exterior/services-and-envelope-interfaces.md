# 외부 설비와 경계 Interface

## 건물 외부에 드러나는 Service {#building-exterior-services-interfaces}

Intake, exhaust, vent, flue, drain, downpipe, overflow, meter, valve, cable, conduit, facade·roof equipment, plant enclosure와 project-defined building service를 exterior element, route, port, penetration, support와 named state로 표현할 수 있어야 한다.

### Interior Service 접속 {#building-service-interior-interface}

Interior가 연결되면 shaft, riser, pipe, duct, conduit와 cable이 envelope를 통과하는 지점에서 양쪽은 같은 port·penetration identity, medium, direction, section, elevation, capacity 또는 demand, connection와 state를 사용해야 한다. Interior route나 equipment 변경도 exterior termination과 clearance를 다시 검토하게 해야 한다.

### Map Utility 접속 {#building-service-map-interface}

Map utility가 공급하거나 받는 water, drainage, sewer, power, fuel, communication와 project-defined service는 building connection point에서 같은 network·port identity, 좌표, datum, flow direction와 phase를 공유해야 한다. Map 범위의 network를 exterior가 임의로 완성하거나 building 내부 network를 map이 소유한다고 간주하지 않아야 한다.

### 외피 관통과 Weather Boundary {#building-service-envelope-penetration}

Service penetration은 host layer의 실제 cut, sleeve, curb, flashing, seal, fire·weather boundary 중 supported condition, condensate·runoff path와 maintenance clearance를 가져야 한다. Opening 없는 mesh overlap이나 texture mark를 관통으로 취급하지 않아야 한다.

### Equipment 배치와 상태 {#building-exterior-service-equipment}

Rooftop plant, condenser, antenna, tank, solar device, facade unit와 exposed route는 actual bounds, orientation, support, access, movement 또는 service volume, noise·heat·light 같은 declared consequence와 operating·outage·maintenance state를 가져야 한다.

### Exterior-only Service 범위 {#building-exterior-only-service-scope}

Exterior-only building이나 set는 visible equipment와 connection stub를 저작할 수 있으나 존재하지 않는 내부 또는 map network를 connected로 추정하지 않아야 한다. Stub는 served system, direction과 open, capped, unknown 또는 out-of-scope 상태를 명시해야 한다.

### Service 검증 {#building-exterior-service-validation}

Disconnected required port, incompatible medium, reversed flow, unsealed penetration, impossible drain slope, unsupported equipment, blocked maintenance zone, facade·opening collision와 interior·map state mismatch를 탐지해야 한다. Network performance를 계산하지 않았다면 배치·연결 검증과 capacity compliance를 구분해야 한다.
