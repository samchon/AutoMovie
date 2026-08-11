# Facade, 지붕과 개구부 {#building-envelope-facade-roof-opening-specification}

## Facade Resolution {#building-envelope-facade-resolution}

<!-- @evidence requirements/building-exterior/facades-and-walls.md#building-facades-walls facade placement, depth, corner, interior boundary와 외피 전용 완결성을 하나의 resolution 계약으로 묶는다. -->

Facade는 building mass의 named exterior face 또는 curved·faceted region에 결속되고 base line, local frame, height extent, depth direction, assembly, opening과 corner relation을 가진다. Curtain wall, masonry, panel, screen과 freeform facade는 열린 kind이며 동일한 좌표·경계 규칙을 따른다.

### Facade 입력과 배치 {#building-envelope-facade-placement-input}

<!-- @evidence requirements/building-exterior/facades-and-walls.md#building-facade-placement-basis facade가 mass face, grid, curve 또는 명시된 surface 중 어느 근거에 배치됐는지 보존한다. -->

입력은 host mass region, facade frame, extent, offset, thickness 또는 build-up, panel·bay rule과 opening exclusion을 제공한다. 출력은 world-space exterior face, inside face, return, top·bottom edge와 source-to-resolved 대응이며 화면에 맞춘 임의 이동은 허용하지 않는다.

### Corner와 외피 전용 완결성 {#building-envelope-facade-corner-set-completeness}

<!-- @evidence requirements/building-exterior/facades-and-walls.md#building-facade-set-completeness exterior-only set의 모든 관찰 가능 edge, return와 내부 노출을 닫는다. -->

Corner는 두 facade assembly의 우선순위, layer return, joint와 pattern transition을 하나의 shared edge에서 해결한다. Exterior-only set은 declared view range에서 보이는 뒤·옆·상부·개구부 안쪽을 포함해야 하며 누락 면을 background나 검은 재료로 우연히 가린 상태는 완결이 아니다.

### Facade 실패와 Interior 호환성 {#building-envelope-facade-interior-failures}

<!-- @evidence requirements/building-exterior/facades-and-walls.md#building-facade-interior-boundary linked interior의 room-side boundary와 facade outer face가 동일 assembly 두께에 답하게 한다. -->

Host를 벗어난 facade, 뒤집힌 depth, 열린 corner, 이중 face, mass와의 gap, opening 뒤의 막힌 공간 및 interior boundary가 다른 thickness나 datum을 사용하는 경우를 실패로 보고한다. Interior가 없으면 room-side 관계는 적용하지 않지만 exterior closure와 backing은 계속 검증한다.

## 지붕과 Rooftop State {#building-envelope-roof-rooftop-state}

<!-- @evidence requirements/building-exterior/roofs-and-rooftops.md#building-roofs-rooftops 평지붕, 경사지붕, dome, canopy와 rooftop 공간·배수·표현을 일반 지붕 계약으로 정의한다. -->

Roof는 building mass의 상부 boundary를 이루는 surface set이며 ridge, valley, hip, eave, parapet, overhang, opening, roof deck와 mounted equipment를 stable identity로 가진다. 곡면이 faceted representation이면 실제 곡면 정밀량으로 표시하지 않는다.

### Roof 입력과 경계 {#building-envelope-roof-input-boundary}

<!-- @evidence requirements/building-exterior/roofs-and-rooftops.md#building-roof-elements 지붕 구성 요소와 서로 만나는 edge 및 opening 관계를 보존한다. -->

입력은 host mass, surface frame 또는 bounded geometry, slope, assembly, edge relation, drainage divide, opening과 access connector를 제공한다. 출력은 resolved roof surface, enclosed 또는 exterior rooftop space, eave·ridge·valley graph, fall direction과 quantity basis이다.

### Roof, Ceiling과 배수 불변식 {#building-envelope-roof-ceiling-drainage-invariant}

<!-- @evidence requirements/building-exterior/roofs-and-rooftops.md#building-roof-ceiling-relation roof underside, structure와 interior ceiling을 서로 다른 identity로 유지하면서 높이 제약을 함께 만족시킨다. -->

Linked interior의 ceiling 또는 overhead zone은 roof underside와 structural depth 아래에 있어야 하며 같은 surface를 별도 datum으로 복제하지 않는다. Flat 또는 low-slope roof는 drain, scupper, gutter나 declared free edge까지 연속된 fall을 가져야 하고 고립 depression과 역경사는 finding이다.

### 적설과 배수 State {#building-envelope-roof-snow-drainage-state}

<!-- @evidence requirements/building-exterior/roofs-and-rooftops.md#building-roof-drainage-snow 비, 눈, 결빙과 해빙 상태가 지붕의 catchment, outlet, overflow와 낙하 경계에 미치는 영향을 추적한다. -->

Named weather state는 지붕 region별 snow·ice extent, 축적 또는 미측정 상태, 막힌 inlet, meltwater path, overflow와 edge에서의 낙하·미끄럼 범위를 가질 수 있다. 구조 하중이나 실제 적설 성능을 별도 분석하지 않았으면 surface state와 water path만 보고하고 안전 성능은 `unknown`으로 남긴다.

### Roof 표현 실패 {#building-envelope-roof-representation-failures}

<!-- @evidence requirements/building-exterior/roofs-and-rooftops.md#building-roof-representation roof의 proxy와 상세 표현이 높이, silhouette, edge 및 drainage 의미를 보존하게 한다. -->

Representation 교체가 peak, ridge, eave, parapet, opening, water path 또는 rooftop access identity를 허용오차 밖으로 바꾸면 실패한다. 눈에 보이는 roof mesh만 있고 boundary, slope 또는 drainage를 계산할 수 없으면 외형은 사용할 수 있어도 관련 분석과 수량은 `unsupported`이다.

## 개구부와 작동 State {#building-envelope-opening-operation-state}

<!-- @evidence requirements/building-exterior/openings-and-fenestration.md#building-openings-fenestration 창, 문, skylight, vent와 자유형 aperture의 cut, 구성 요소, 작동 상태와 interior 일관성을 규정한다. -->

Opening은 하나의 host boundary identity, 그 boundary-local frame의 closed profile, depth, fill 또는 open-cut 상태와 stable opening identity를 가진다. Frame, jamb, head, sill, glazing, mullion, leaf, sash, shutter, seal, flashing와 hardware는 필요한 fidelity에서 별도 구성 identity를 가질 수 있다.

### Opening 입력과 Cut 출력 {#building-envelope-opening-cut-input-output}

<!-- @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-form-layout 직선과 곡선 profile, 반복 layout 및 host cut의 실제 형상을 같은 입력에서 해결한다. -->

입력은 host boundary, profile, local placement, fill, component hierarchy, opening pattern과 exception을 제공한다. 출력은 실제 제거 volume, remaining host, exterior·interior reveal, clear profile, component placement와 겹침 검사 결과이며 표면 위의 별도 mesh를 관통 개구부로 취급하지 않는다.

### 작동과 Sweep 불변식 {#building-envelope-opening-operable-sweep-invariant}

<!-- @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-operable-state hinged, sliding, folding, rolling과 removable 상태의 motion path 및 clearance를 검증한다. -->

각 movable component는 rest transform, degree of freedom, travel limit와 named state를 가지며 current state는 모든 component의 값을 완전하게 지정한다. Sweep는 host, facade attachment, exterior route와 linked interior clearance를 침범하지 않아야 하며 상태가 바뀌어도 opening identity와 cut은 유지된다.

### Opening 실패와 Exterior-only 호환성 {#building-envelope-opening-failure-compatibility}

<!-- @evidence requirements/building-exterior/openings-and-fenestration.md#building-opening-exterior-only interior 없는 세트에서 개구부의 backing, glazing과 보이는 depth를 정직하게 처리한다. -->

Host face 없음, profile의 self-intersection·비양수 면적·face escape, 다른 cut과 overlap, fill reference 누락, frame depth 불일치, sweep collision과 linked interior의 다른 opening profile은 실패다. Exterior-only set은 투명·개방 개구부가 선언된 view에서 보여 주는 내부 범위를 모델링하거나 명시적 backing으로 닫아야 하며 존재하지 않는 완성 interior로 표시하지 않는다.
