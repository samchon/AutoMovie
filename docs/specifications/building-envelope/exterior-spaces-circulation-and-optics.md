# 외부 공간, 동선과 광학 상태 {#building-envelope-exterior-space-circulation-optics-specification}

## Balcony, Terrace와 Courtyard {#building-envelope-exterior-space-state}

### 외부 공간 입력과 출력 {#building-envelope-exterior-space-input-output}

<!-- @evidence requirements/building-exterior/balconies-terraces-and-courtyards.md#building-balconies-terraces-courtyards 건물에 속한 외부 공간의 identity, boundary, drainage, mass 관계와 phase·quantity를 규정한다. -->

Balcony, terrace, loggia, roof deck와 courtyard는 stable exterior-space identity, usable extent, base elevation, enclosing·open boundary, support, access connector와 weather exposure를 가진다. Courtyard는 building mass의 void인지 별도 open region인지 명시하며 둘을 이중 계산하지 않는다.

<!-- @evidence requirements/building-exterior/balconies-terraces-and-courtyards.md#building-exterior-space-identity 외부 공간을 보이는 slab나 rail의 이름이 아니라 공간 identity와 관계로 제공한다. -->

입력은 host building, footprint 또는 surface, level, support element, guard·parapet boundary, opening·connector, slope, drain, phase와 alternative를 제공한다. 출력은 resolved usable area, edge와 opening relation, access state, drainage destination, quantities와 source revision이다.

### Boundary, Guard와 배수 불변식 {#building-envelope-exterior-space-boundary-drainage-invariant}

<!-- @evidence requirements/building-exterior/balconies-terraces-and-courtyards.md#building-exterior-space-boundary 열린 edge, guard, threshold, facade junction과 배수 경계를 한 공간 상태에서 검증한다. -->

추락 가능 edge는 guard, wall 또는 의도된 open condition으로 구분하고 threshold와 facade junction은 usable surface 및 water path를 끊지 않아야 한다. Drainage는 low point에서 outlet 또는 declared free edge까지 이어져야 하며 interior로 역류하는 sill·threshold 관계를 허용하지 않는다.

### Phase와 Quantity 실패 {#building-envelope-exterior-space-phase-quantity-failures}

<!-- @evidence requirements/building-exterior/balconies-terraces-and-courtyards.md#building-exterior-space-quantity-phase phase별 존재 상태와 usable·gross·drainage 면적의 basis를 보존한다. -->

Phase에 존재하지 않는 slab, guard나 access를 current 공간이 참조하거나, courtyard void와 floor area를 함께 더하거나, overlap·detached support·non-positive area가 있으면 실패한다. 수량은 gross surface, usable area, edge length, guard length와 drainage area를 basis별로 구분한다.

## 외부 동선과 부착 요소 {#building-envelope-exterior-circulation-attachment-state}

### 동선 입력과 Traversal 출력 {#building-envelope-exterior-circulation-input-output}

<!-- @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation-attachments 외부 stair, ramp, ladder, bridge, platform와 부착물의 경로·지지·작동 상태를 규정한다. -->

Exterior circulation은 building-owned space 또는 exterior node 사이를 잇는 stable connector이며 route, endpoint, landing, width, clear height, slope, step 또는 smooth surface, direction과 visible support를 가진다. Canopy, sign, screen, pipe, fire escape와 project-defined attachment는 host element, attachment point, load role와 clearance를 가진다.

<!-- @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-circulation route, section, landing과 접근 상태를 실제 3D 좌표에서 해결한다. -->

입력은 from·to space, intermediate landing, world route와 orientation, usable section, movement state, guard, opening과 site access port를 제공한다. 출력은 연속된 traversal relation, route length, rise, slope, clearance envelope, served spaces와 phase별 availability이다.

### Attachment와 작동 불변식 {#building-envelope-external-attachment-operation-invariant}

<!-- @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-attachment-support attachment의 host, support, removal 또는 motion range와 다른 요소의 clearance를 결속한다. -->

Attachment는 해결 가능한 host 및 실제 접촉 또는 고정 frame을 가져야 하고 parent 변환과 함께 이동해야 한다. Folding stair, gate, shutter, ladder와 movable canopy는 named state 및 sweep를 가지며 현재 상태와 travel 전체가 facade, route, opening과 site 경계를 침범하지 않아야 한다.

### 다중 건물 연결과 실패 {#building-envelope-multibuilding-connector-failures}

<!-- @evidence requirements/building-exterior/external-circulation-and-attached-elements.md#building-external-multi-building-connection skybridge와 다른 다중 건물 connector가 양쪽 unit의 좌표·level·상태에 답하게 한다. -->

두 building unit을 잇는 connector는 별도 building unit이 아니라 work-owned relation이며 양쪽 endpoint와 transform revision에 의존한다. Unresolved endpoint, 반대 방향의 one-way state, route discontinuity, section 누락, step와 route rise 불일치, unsupported attachment와 collision은 named finding이 된다.

## 외피 Lighting과 Optical State {#building-envelope-lighting-optical-state}

### 광학 입력과 관찰 조건 {#building-envelope-optical-input-review-condition}

<!-- @evidence requirements/building-exterior/lighting-and-optics.md#building-exterior-lighting-optics 자연광 context, 건물 부착 조명과 광학 외피의 상태 및 검토를 분리한다. -->

Sun, sky와 weather illumination은 building이 수정하지 않는 read-only site context이며, facade·roof에 고정된 luminaire, emissive sign과 project-defined light source는 building-owned attachment다. Glazing, translucent panel, mirror, wet surface와 emissive layer는 material 및 opening identity에 결속된 optical state를 가진다.

<!-- @evidence requirements/building-exterior/lighting-and-optics.md#building-exterior-lighting-review 자연광·인공광 시나리오와 view 조건을 고정하여 외피 가독성을 재현한다. -->

입력은 time 또는 named lighting scenario, source revision, camera set, material optical facts, opening state와 mounted-light state를 제공한다. 출력은 capture provenance와 scale, silhouette, opening, reflection·transmission, light spill 및 attachment contact에 대한 review finding이며 beauty frame 하나를 성능 분석으로 확대하지 않는다.

### Lighting 실패와 호환성 {#building-envelope-lighting-failure-compatibility}

<!-- @evidence requirements/building-exterior/lighting-and-optics.md#building-exterior-optical-envelope 외피의 불투명·투명·반사·발광 역할이 representation과 state 사이에서 보존되게 한다. -->

Missing optical fact는 물성을 추정하지 않고 `unknown`으로 남기며 unsupported renderer feature는 `unsupported`로 보고한다. LOD나 외부 자산 교체가 opening visibility, 주요 반사·발광 role 또는 야간 silhouette를 바꾸면 재검토 전 delivery를 stale로 처리한다.
