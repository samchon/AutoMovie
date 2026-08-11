# 공간 위계와 Zone

## Addressable한 실내 공간 Graph {#interior-spatial-hierarchy}

Building, storey, unit, department, suite, room, alcove, corridor, shaft, void와 named zone은 containment, adjacency와 boundary를 가진 안정된 identity로 표현될 수 있어야 한다.

Identity는 display name, document order와 geometry regeneration에 독립적이어야 한다. 각 space와 element는 quantity와 change tracking을 위한 하나의 primary owner를 가지되 여러 storey, room와 zone을 관통하거나 경계할 때 secondary relationship으로 참조할 수 있어야 한다.

### 물리 공간과 논리 Zone {#interior-physical-logical-zones}

벽으로 닫힌 room과 circulation, 작업, 촬영, 보안, 음향, 조명, 습식, 위험 zone처럼 겹칠 수 있는 논리 영역을 구분해야 한다.

Zone을 만들기 위해 space 또는 element를 복제하지 않아야 하며 extent, membership rule, priority, effective phase·alternative·time와 overlap policy를 명시해야 한다. 같은 geometry를 읽는 ceiling, finish, service와 occupancy zone의 충돌을 주소 가능한 관계로 보고해야 한다.

### 복수 층과 복합 공간 {#interior-multilevel-spaces}

Mezzanine, split level, double-height room, atrium, stair void, tiered seating와 복층 unit를 단일 storey에 억지로 평탄화하지 않아야 한다.

### 공간 Boundary {#interior-space-boundaries}

각 공간은 floor, ceiling, wall, opening, railing, virtual boundary 또는 open side 중 무엇이 경계를 이루는지 식별하고, 같은 물리 요소가 여러 공간을 서로 다른 면으로 경계할 수 있어야 한다.

### 공간 Graph 검증 {#interior-space-graph-validation}

중복 공간, 닫히지 않은 필수 boundary, 고아 공간, 모순된 containment, 끊긴 adjacency와 같은 위치를 차지하는 비의도적 room을 탐지해야 한다.

의도한 open boundary, double-height volume, void와 overlapping logical zone은 오류에서 구분해야 한다. Finding은 space와 boundary identity, world extent, orientation, closure 또는 overlap measure와 적용 tolerance를 제공해야 한다.
