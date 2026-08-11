# 이동과 가시성

## 장면 행동을 제약하는 맵 {#map-movement-visibility}

Terrain, water, road, opening, bridge, vegetation, building과 temporary obstacle은 배우·vehicle·camera의 이동과 시야를 판단하는 같은 spatial state에 참여해야 한다.

### 이동 가능한 surface {#map-traversable-surfaces}

Walkable, rideable, navigable와 forbidden surface는 slope, width, depth, clearance, material, direction과 state를 가진 authored 또는 derived fact로 구분해야 한다.

### 이동 주체별 비용과 제약 {#map-traveler-cost-constraints}

Actor, wheelchair, animal, vehicle, vessel, camera rig와 project-defined traveler마다 step, slope, turn, traction, depth, clearance, speed, access와 hazard 조건을 선언할 수 있어야 한다. 한 주체가 통과할 수 있다는 사실을 모든 주체의 traversability로 일반화하지 않아야 한다.

### 연결성과 route {#map-route-connectivity}

출발지와 목적지 사이의 route는 실제 network와 connector를 사용해야 하며 끊긴 bridge, flooded road와 closed gate를 무시하지 않는다.

### 시간과 상태를 따르는 route {#map-temporal-route-state}

Route는 departure time, phase, weather, water, occupancy와 temporary restriction을 기준으로 평가하고 사용한 state를 결과와 함께 보존해야 한다. 맵 변경이나 streaming 순서가 같은 조건의 route를 임의로 바꾸지 않아야 한다.

### 시야와 차폐 {#map-sightline-occlusion}

Terrain, vegetation, structure, fog와 crowd가 관측자·camera·light·sound의 sightline 또는 occlusion에 미치는 영향을 같은 resolved geometry와 environment state에서 평가할 수 있어야 한다.

### Viewshed와 가시 범위 {#map-viewshed-visibility-range}

Observer 또는 camera의 position, height, orientation, field of view, target와 maximum range를 선언하고 visible, partially occluded, hidden, outside extent와 insufficient detail을 구분할 수 있어야 한다. Tile 또는 LOD가 없다는 이유로 대상이 보이지 않는다고 판정하지 않아야 한다.

### 움직이는 경로의 가시성 {#map-route-visibility}

이동 경로를 따라 landmark, threat, signal, exit와 story target이 나타나거나 가려지는 interval을 평가하고 terrain, vegetation, weather와 temporary obstacle의 phase를 결과에 연결할 수 있어야 한다.

### 검증 수준의 구분 {#map-navigation-validation-level}

단순 연결성, clearance 검토, kinematic path와 physics simulation을 구분하여 수행하지 않은 수준의 이동 가능성을 주장하지 않는다.
