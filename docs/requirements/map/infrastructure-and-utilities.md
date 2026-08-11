# 기반시설과 공급망

## 광역 service network {#map-infrastructure-utilities}

Water supply, drainage, sewer, power, fuel, communication, irrigation, defense line와 다른 linear infrastructure를 source, sink, node, segment, branch와 state가 있는 network로 표현할 수 있어야 한다.

### Service identity와 종류 독립성 {#map-service-identity-kind}

Project는 역사적, 현대, speculative 또는 fictional service의 carrier, commodity, control과 consumer를 일반 network identity와 relation으로 정의할 수 있어야 한다. 저장소가 특정 시대의 pole, pipe, cable, channel 또는 device catalogue를 전제하지 않아야 한다.

### 지상과 지하 {#map-infrastructure-above-below}

Pole, tower, pipe, canal, trench, culvert와 buried route를 terrain, road, water, building과 같은 좌표에서 배치하고 crossing·clearance·cover depth를 검토할 수 있어야 한다.

### Corridor와 접근 {#map-infrastructure-corridor-access}

Easement, right-of-way, maintenance strip, chamber, access point와 protected zone을 parcel, road, building, vegetation와 관계 맺고 필요한 작업 clearance와 출입 상태를 표현할 수 있어야 한다.

### 용량과 흐름 {#map-infrastructure-capacity-flow}

Film이나 analysis가 요구하는 경우 direction, capacity, demand, pressure 또는 load의 bounded facts를 선언하고 연결되지 않은 service를 찾을 수 있어야 한다.

### 시대와 기술 {#map-infrastructure-era}

수로, 우물, 봉수, 전신, 현대 grid와 fictional network를 일반 graph와 physical route 능력으로 구성하며 특정 기술 catalogue에 제한하지 않는다.

### 장애와 복구 {#map-infrastructure-failure-recovery}

Cut, leak, outage, overload, repair와 reroute state가 연결된 consumer와 scene consequence에 미치는 영향을 추적할 수 있어야 한다.

### Service dependency와 cascading state {#map-infrastructure-dependencies}

Pump가 power에, signal이 communication에, settlement가 water source에 의존하는 것처럼 network 사이 dependency를 선언하고 source failure, isolation, backup와 restoration order의 bounded consequence를 추적할 수 있어야 한다.

### Network 검증 범위 {#map-infrastructure-analysis-bound}

Connectivity와 authored capacity는 film staging과 bounded analysis를 지원하지만 calibrated hydraulic, electrical, communication 또는 defense performance로 주장하지 않아야 한다. 검증하지 않은 flow, pressure, load와 redundancy는 unknown으로 남겨야 한다.
