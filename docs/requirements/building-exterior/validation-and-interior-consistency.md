# 외관 검증과 Interior 일관성

## 외관 자체와 연결된 Interior의 검증 {#building-exterior-validation}

Exterior는 interior 존재 여부와 무관하게 scope, coordinate, geometry, support, envelope, opening, material, service, map contact, representation와 state를 검증해야 한다. 같은 building identity의 interior가 있을 때에는 shared boundary를 양쪽 결과에 대해 검증하고 한쪽의 성공으로 다른 쪽을 대신하지 않아야 한다.

### 외관 형상과 관계 {#building-exterior-geometry-validation}

Gap, overlap, inverted surface, degenerate solid, unsupported attachment, invalid opening, impossible panel cut, broken pattern, terrain penetration, disconnected access, unsealed service penetration와 drainage discontinuity를 stable identity를 가진 finding으로 탐지해야 한다.

### 면적과 높이 {#building-exterior-area-height-validation}

Footprint, area boundary와 deduction, storey elevation, slab·ceiling depth, floor-to-floor height, roof와 total height의 계산, unit, datum, phase와 representation이 일관되는지 확인해야 한다. Exact geometry가 없는 수량이나 서로 다른 area definition을 하나의 일치값으로 만들지 않아야 한다.

### 내외부 공동 제약 {#building-exterior-interior-shared-validation}

연결된 exterior와 interior는 어느 한쪽을 기준 사본으로 두지 않고 아래 공동 제약을 같은 current design에서 만족해야 한다. 한쪽 변경이 shared fact를 깨뜨리면 상대 geometry를 자동 절단·이동·scale하지 말고 affected dependency와 measured conflict를 보고해야 한다.

| 공동 제약 | 양쪽이 공유할 사실 | 거부해야 할 모순 |
| --- | --- | --- |
| Massing과 extent | Building·mass identity, footprint, usable containment와 void | Exterior 밖 room, interior가 차지한 exterior void, 숨은 scale |
| Area | Boundary, deduction, unit, phase와 exact·approximate basis | Gross·net 혼용, stale area, 누락된 wall·shaft·opening deduction |
| Storey와 height | Level identity, datum, floor·slab·ceiling·roof elevation와 floor-to-floor height | Level mismatch, impossible clear height, 겹친 slab |
| Envelope | Shared construction, inside·outside face, layer order와 total thickness | 중복 wall, 음수 usable depth, 같은 side의 이중 ownership |
| Opening | Opening cut identity, host, transform, clear aperture, depth와 state | 한쪽만 있는 cut, 다른 state, 막힌 route·light·view |
| Structure | Column·beam·slab·core·shaft·roof support identity, position와 penetration | 겹친 구조, unsupported exterior, room·route와 충돌하는 structure |
| Service | System·port·penetration identity, medium, direction, route section와 state | Open end, reversed flow, 다른 elevation, unsealed penetration |
| Coordinate | Unit, axes, building root, datum, transform chain와 control point | 중복 transform, 허용오차 밖 residual, map·interior drift |

### Map 공동 제약 {#building-exterior-map-shared-validation}

Map과 연결된 building은 parcel·footprint, terrain·foundation, road·entrance, water·drainage, utility·service port와 surrounding context 접합을 같은 coordinate, elevation, identity, phase와 LOD에서 검증해야 한다. Building이나 map 중 한쪽만 이동·교체된 상태를 current placement로 통과시키지 않아야 한다.

### 독립 Scope {#building-exterior-independent-scope}

Exterior-only와 interior-only는 누락으로 취급하지 않되 scope, virtual boundary, unknown, intentionally absent와 valid representation 범위가 명시되어야 한다. 양쪽이 같은 building과 boundary identity로 연결되지 않았다면 내외부 일관성을 검증했다고 주장하지 않으며, facade set의 view 밖 geometry를 complete building으로 평가하지 않아야 한다.

### Representation과 Budget 검증 {#building-exterior-representation-validation}

각 검증은 사용한 representation, camera·distance range, expanded element·instance count와 budget을 기록해야 한다. LOD, culling, instancing와 external asset replacement 뒤에도 검증 대상 identity가 남아야 하며 story-relevant, measurement, contact와 shared-boundary target을 budget 때문에 조용히 제거하지 않아야 한다.

### 시각적 검토 {#building-exterior-visual-review}

실제 3D 장면의 front, side, three-quarter, roof와 declared camera에서 원거리·중거리·근거리 scale, mass proportion, skyline, silhouette, facade composition, opening depth, material scale, pattern, weathering, drainage, support, shadow, map seam와 set completeness를 검토하고 source 수정 뒤 같은 조건으로 다시 생성할 수 있어야 한다.

### Positive, Negative와 상태 {#building-exterior-validation-outcomes}

주요 capability와 shared constraint는 성립하는 사례, 한 조건만 깨뜨린 negative twin과 최대 허용 경계 사례로 검증할 수 있어야 한다. Passed, failed, unsupported, not-run, unknown와 out-of-scope를 구분하고 실행하지 않은 analysis, 보이지 않는 geometry와 stale capture를 성공으로 표시하지 않아야 한다.
