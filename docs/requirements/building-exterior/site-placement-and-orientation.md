# 대지, 배치와 방위

## 맵에 놓인 건물 {#building-site-placement}

건물은 map의 coordinate reference, parcel, terrain, street, water, utility와 주변 건물에 대해 실제 단위의 placement transform, 방위, footprint와 수평·수직 datum을 가져야 한다. Map이 없는 exterior-only set는 project-local placement와 reference ground를 사용하되 이를 geographic placement로 가장하지 않아야 한다.

### 대지 경계와 Setback {#building-site-boundary-setback}

Map이 제공하는 parcel boundary, 건축선, setback, easement와 restricted zone의 identity, source state와 uncertainty를 읽고 건물 mass, below-grade extent와 attachment가 어느 범위에 놓이는지 확인할 수 있어야 한다. Jurisdiction rule을 저작하지 않았다면 법규 적합성으로 확대해 주장하지 않아야 한다.

### 지면 접촉 {#building-ground-contact}

Foundation, basement, entrance threshold, retaining wall, areaway, ramp와 exterior stair는 실제 terrain elevation, slope, surface, cut·fill와 phase에 연결되어야 한다. Gap, floating support, terrain penetration, buried opening와 map·building 간 중복 retaining geometry를 탐지할 수 있어야 한다.

### 접근과 출입 {#building-site-access}

주요 출입구, accessible entrance, service entrance, loading, parking connection와 emergency access는 map road·path network의 named node와 connector로 이어져야 한다. Linked interior route는 같은 entrance opening과 threshold에서 계속되어야 하며 exterior-only set는 끊긴 set edge를 실제 network connection으로 표시하지 않아야 한다.

### 주변 Context {#building-surrounding-context}

인접 mass, vegetation, water, infrastructure와 terrain이 view, daylight, shadow, reflection, drainage, service와 접근에 미치는 영향을 동일한 map time, phase, alternative와 representation state에서 검토할 수 있어야 한다.

### Map 접합 Interface {#building-site-map-seams}

Terrain·foundation, road·entrance, path·stair, parcel·footprint, shoreline·building water, utility·service port와 drainage·discharge의 접합은 양쪽 identity, coordinate, elevation, orientation, extent와 state를 보존해야 한다. Gap, overlap, double feature, disconnected network, contradictory ownership와 LOD seam을 named finding으로 남겨야 한다.

### Placement 변경 영향 {#building-site-placement-change-impact}

Building root나 map control point의 translation, rotation, scale, datum와 origin 변경은 child exterior, linked interior, entrance, utility, shadow, camera, quantity와 evidence에 전파되어야 한다. 한 consumer만 local offset으로 보정하여 이전 배치를 current로 남기지 않아야 한다.
