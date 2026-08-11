# 공간 용도와 점유

## 용도에 맞게 저작되는 공간 {#interior-space-use-occupancy}

Living, sleeping, cooking, bathing, working, storage, circulation, assembly, performance, industrial와 project-defined use를 열린 vocabulary로 선언하고 공간의 필요한 행위와 물체를 연결할 수 있어야 한다.

같은 room type이나 repeated storey라도 actual host boundary, floor·ceiling datum, wall assembly, finish, tile field, furnishing, service와 occupancy state는 같거나 다를 수 있어야 한다. Shared rule과 storey·room override를 함께 보존하여 한 층의 예외가 다른 층을 암묵적으로 바꾸지 않아야 한다.

### 점유와 수용 범위 {#interior-occupancy-capacity}

공간은 film에 필요한 actor, crowd, furniture, equipment와 camera population의 예상 범위와 점유 state를 가지며 법적 정원을 보편 상수로 추정하지 않는다.

### 활동 영역 {#interior-activity-zones}

앉기, 조리, 작업, 대기, 관람, 공연, 이동과 maintenance 영역을 실제 geometry와 clearance에 연결하여 같은 바닥 면적을 여러 활동에 무제한으로 중복 배정하지 않아야 한다.

Activity, lighting, acoustic, wet, hazard, filming, security와 service zone은 room containment와 독립적으로 겹칠 수 있고 적용 대상, extent, priority, state와 conflict rule을 가져야 한다. Overlap은 허용되더라도 같은 physical area와 capacity를 중복 집계하지 않아야 한다.

### 가시성과 Culling {#interior-space-visibility-culling}

Room, opening, portal와 camera 위치를 사용해 보이는 공간과 숨겨진 공간을 결정할 수 있으나 story-relevant 대상과 반사·그림자·소리 consumer를 단순 화면 밖이라는 이유로 제거하지 않아야 한다.

### 사용 State {#interior-space-use-state}

Occupied, vacant, closed, under construction, damaged, contaminated와 temporary use를 named phase 또는 film time에 연결하고 geometry, access와 dressing이 같은 state를 읽어야 한다.

Area, volume, perimeter와 clear height는 사용한 physical boundary, opening treatment, finish face, tolerance와 state를 밝혀 explicit input과 derived value를 구분해야 한다. 연결된 exterior의 gross floor area와 interior net usable area를 하나의 면적 숫자로 바꾸어 쓰지 않아야 한다.
