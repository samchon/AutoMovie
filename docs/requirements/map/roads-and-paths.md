# 도로와 보행망

## 연속된 surface network {#map-roads-paths}

Road, street, alley, trail, sidewalk, plaza route, battlefield track와 service road를 width, grade, cross section, surface, direction과 junction을 가진 network로 표현할 수 있어야 한다.

### 노선과 기준 위치 {#map-road-route-reference}

Route, segment, named place, distance along alignment와 side를 사용하여 gate, sign, damage, event와 access point의 위치를 안정적으로 식별할 수 있어야 한다. Centerline 수정 뒤에도 story-relevant 위치와 연결의 이동 또는 재배치 여부를 추적해야 한다.

### 선형과 단면 {#map-road-alignment-section}

Centerline, curve, slope, superelevation, lane, shoulder, curb, ditch와 retaining condition을 terrain과 독립적으로 선언하면서 실제 surface에 연결할 수 있어야 한다.

### 교차와 연결 {#map-road-junction}

Intersection, roundabout, crossing, gate, ford와 entrance는 연결 가능한 branch, priority, level과 state를 가져야 한다.

### 이용자와 통행 규칙 {#map-road-users-rules}

Pedestrian, animal, wheeled vehicle, tracked vehicle와 project-defined traveler마다 허용 방향, width, clearance, surface, speed 또는 access constraint를 선언할 수 있어야 한다. 특정 현대 도로법이나 차종을 기본 사실로 강제하지 않아야 한다.

### 시대와 용도 {#map-road-era-use}

고대 길, 비포장 군로, 현대 도로와 fictional transport lane을 같은 일반 network 능력으로 구성하되 pavement, rule와 vehicle assumption을 project가 소유해야 한다.

### 도로 상태 {#map-road-state}

폐쇄, 파손, 침수, 적설, 진흙, barricade와 temporary diversion을 시간 상태로 표현하고 이동·staging·render가 같은 state를 읽어야 한다.

### 도로와 지형 접합 {#map-road-terrain-seams}

Road surface, shoulder, ditch, embankment, cut, retaining condition, bridge deck와 tunnel portal이 terrain과 만나는 경계에서 gap, overlap, 급격한 grade 변화와 drainage 단절을 찾을 수 있어야 한다.
