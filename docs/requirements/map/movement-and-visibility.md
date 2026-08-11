# 이동과 가시성

## 장면 행동을 제약하는 맵 {#map-movement-visibility}

Terrain, water, road, opening, bridge, vegetation, building과 temporary obstacle은 배우·vehicle·camera의 이동과 시야를 판단하는 같은 spatial state에 참여해야 한다.

### 이동 가능한 surface {#map-traversable-surfaces}

Walkable, rideable, navigable와 forbidden surface는 slope, width, depth, clearance, material, direction과 state를 가진 authored 또는 derived fact로 구분해야 한다.

### 연결성과 route {#map-route-connectivity}

출발지와 목적지 사이의 route는 실제 network와 connector를 사용해야 하며 끊긴 bridge, flooded road와 closed gate를 무시하지 않는다.

### 시야와 차폐 {#map-sightline-occlusion}

Terrain, vegetation, structure, fog와 crowd가 관측자·camera·light·sound의 sightline 또는 occlusion에 미치는 영향을 같은 resolved geometry와 environment state에서 평가할 수 있어야 한다.

### 검증 수준의 구분 {#map-navigation-validation-level}

단순 연결성, clearance 검토, kinematic path와 physics simulation을 구분하여 수행하지 않은 수준의 이동 가능성을 주장하지 않는다.
