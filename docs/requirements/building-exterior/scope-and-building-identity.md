# 범위와 건물 Identity

## 건물과 Exterior Set 단위의 외관 책임 {#building-exterior-scope}

건물 외관은 하나 이상의 건물 동이나 선언된 exterior set의 전체 외형, 외피, 외부 개구부, 건물에 직접 결합된 외부 공간과 시설을 interior와 독립적으로 저작·검증·렌더할 수 있어야 한다.

### 건물 Identity {#building-exterior-identity}

각 building work, 건물 동, mass, storey, facade region, roof, opening, exterior space, service interface와 attachment는 map, interior, camera, phase, representation과 evidence가 공유할 안정된 identity를 가져야 한다.

### Exterior-only 건물 {#building-exterior-only}

Interior가 필요하지 않은 완결된 외부 건물, 배경 건물, 원경 skyline, exterior stage, facade set와 거리 세트는 exterior-only scope로 명시할 수 있어야 한다. 이 scope는 저작된 면, backside·edge 처리, support·collision 범위, 유효한 camera region과 거리, map 또는 project-local placement, representation tier와 intentionally absent·unknown 부분을 선언해야 하며 존재하지 않는 room, structure와 service를 추정하거나 검증했다고 주장하지 않는다.

### Interior와 연결된 건물 {#building-exterior-linked-interior}

Interior와 연결된 외관은 같은 building과 shared-boundary identity, coordinate frame, footprint, named area definition의 공통 입력, storey datum, floor-to-floor height, structure, envelope thickness, opening, service port, phase와 current state를 사용해야 한다. 어느 쪽의 변경도 상대편을 조용히 자르거나 늘리지 않으며 shared fact를 함께 갱신하거나 명시적 coordination failure를 만들어야 한다.

### 외부 세계 경계 {#building-exterior-map-boundary}

공원, 하천, 도로, 광역 지형, parcel과 utility network는 [맵 요구사항](../map/README.md)이 소유하고, 건물 외관은 대지 접점, foundation interface, entrance connector, building service port와 건물에 직접 결합된 외부 요소를 소유한다. 두 범위가 만나는 경계는 같은 identity, 좌표, 표고, 방향과 current state를 공유해야 한다.

### 운송체 Exterior 제외 {#building-exterior-transport-exclusion}

선박 hull, 열차 body, 자동차 body, 항공기 fuselage와 우주선 pressure shell을 포함한 운송체 exterior의 저작과 전문 검증은 이 주제의 지원 계약이 아니다. 운송체가 map이나 shot에 놓이는 것은 해당 asset과 staging 책임이며, 그 존재가 building exterior 능력을 운송체까지 확장하지 않는다.
