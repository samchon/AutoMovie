# Phase, 산출물과 검증 {#building-envelope-phase-delivery-validation-specification}

## Existing, Phase와 Alternative {#building-envelope-phase-alternative-state}

### Phase 입력과 Snapshot 출력 {#building-envelope-phase-input-output}

<!-- @evidence requirements/building-exterior/existing-phases-and-alternatives.md#building-exterior-existing-phases existing·retained·demolished·new·temporary 요소, phase graph와 alternative를 stable identity 위에 정의한다. -->

Phase와 alternative는 building을 복제하지 않고 기존 identity에 lifecycle 및 차이 state를 적용한다. Existing survey fact, authored assumption, proposed work와 as-built confirmation은 source·confidence를 구분하며 retained, demolished, new와 temporary 역할은 전체 work의 분류이고 특정 phase의 존재 여부는 별도 snapshot이다.

<!-- @evidence requirements/building-exterior/existing-phases-and-alternatives.md#building-exterior-construction-phases phase prerequisite, 설치·제거 event와 요소 존재 상태를 결정론적으로 해결한다. -->

입력은 base revision, phase graph, element·space·opening·layer·port·instance identity, lifecycle role, install·remove event, alternative override와 selected view state를 제공한다. 출력은 identity별 pending·present·removed 상태, resolved geometry·material·service·water state, dependency digest와 ambiguous ordering finding이다.

### Alternative와 정본 불변식 {#building-envelope-alternative-canonical-invariant}

<!-- @evidence requirements/building-exterior/existing-phases-and-alternatives.md#building-exterior-canonical-state base와 선택 alternative, phase 및 time을 하나의 current view로 결속하고 서로 다른 상태를 섞지 않는다. -->

Alternative는 공통 base, explicit difference, cost·consequence와 decision state를 가지며 선택 전 variant의 geometry, asset, quantity와 capture가 서로 섞이지 않는다. 모든 derived result는 building revision, alternative 또는 base, phase 또는 phase-independent, time과 lowering configuration identity를 기록한다.

### Phase 변경과 실패 {#building-envelope-phase-change-failures}

<!-- @evidence requirements/building-exterior/existing-phases-and-alternatives.md#building-exterior-phase-coordination phase별 exterior, linked interior, service, water, site와 산출물의 상태를 함께 맞춘다. -->

존재하지 않는 host를 참조하는 opening·attachment·service, 제거된 support에 남은 element, mutually exclusive variant 혼합, prerequisite cycle, unknown survey를 confirmed로 승격한 상태와 phase가 다른 산출물은 실패다. Phase 또는 alternative 변경은 affected coordination, quantities, drawings, render와 review를 stale로 만든다.

## 건물 산출물 {#building-envelope-deliverable-contract}

### 산출물 입력과 Manifest {#building-envelope-deliverable-input-manifest}

<!-- @evidence requirements/building-exterior/deliverables.md#building-exterior-deliverables drawing, schedule, quantity, render와 evidence를 같은 resolved building에서 파생한다. -->

건물 산출물은 정본의 편집 가능한 복제가 아니라 resolved state에 대한 projection이다. Plan, elevation, section, roof·facade view, opening·element schedule, quantity, validation report와 capture는 source building identity 및 exact revision을 공유한다.

<!-- @evidence requirements/building-exterior/deliverables.md#building-exterior-drawing-views view의 plane, direction, extent, scale, filter와 annotation basis를 재현 가능하게 한다. -->

입력은 building revision, phase·alternative·time, representation, view or schedule subject, unit, tolerance, filter와 generation activity를 제공한다. 출력 manifest는 source digest set, coordinate frame, producer, settings, generated time, dependency digest, output digest, completeness와 freshness 상태를 포함한다.

### Dimension, Schedule과 Quantity 불변식 {#building-envelope-deliverable-quantity-invariant}

<!-- @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities 치수, schedule과 quantity가 같은 identity와 geometry basis를 사용하게 한다. -->

Dimension은 측정 target과 anchor, direction, actual value, unit, precision, rounding과 tolerance를 가진다. Schedule count는 stable identity의 resolved occurrence와 맞아야 하고 quantity는 area, length, volume, count, module, cut와 waste를 source, basis, scope, exclusion 및 exact·approximate 상태와 함께 제공한다.

### Exterior-only Evidence와 Freshness 실패 {#building-envelope-deliverable-freshness-failures}

<!-- @evidence requirements/building-exterior/deliverables.md#building-exterior-only-evidence exterior-only set의 view range, backing과 미검증 interior 범위를 evidence에 표시한다. -->

Exterior-only capture는 camera와 declared fidelity range, visible backing, omitted interior와 unavailable 분석을 manifest에 기록한다. Source, asset, coordinate, phase, representation, rule 또는 renderer input이 바뀌면 이전 artifact는 stale이며 빈 값, proxy와 과거 결과를 current complete delivery로 표시하지 않는다.

## 통합 검증과 결과 {#building-envelope-integrated-validation}

### Finding 출력 {#building-envelope-validation-finding-output}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-validation geometry, 치수, interior·map 공유 경계, representation과 시각 evidence를 같은 검증 결과로 집계한다. -->

검증 실행은 building identity, exact input manifest, selected scope, phase·alternative·time, rule set revision, tolerance, representation와 sample 또는 camera set을 가진다. Geometry, mass·area·height, shared interior, site seam, instance, service·water, quantity와 visual review는 서로 다른 check로 남고 전체 상태는 required check의 결과에서 파생된다.

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-geometry-validation geometry와 topology 결함을 addressable identity, 위치, 값과 tolerance로 보고한다. -->

Finding은 stable code, severity, check identity, affected building·storey·space·element·boundary·opening·port·instance·location·time, observed value, expected condition, unit, tolerance, source revision과 correction direction을 가진다. Suppression은 author, reason, exact scope와 expiry를 요구하며 finding을 삭제하지 않는다.

### 검증 State와 Compatibility {#building-envelope-validation-state-compatibility}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-validation-outcomes solved·passed·failed·unsupported·not-run·unknown과 stale 결과를 정직하게 구분한다. -->

실행 결과는 `passed`, `failed`, `unsupported`, `not-run`, `unknown` 또는 `stale`을 구분하고 partial run은 excluded surface를 명시한다. 이전 schema revision에 새 optional capability가 없으면 기존 범위에서 계속 해석하지만 required fact가 사라지거나 지원 의미가 축소되면 pinned interpretation, migration, explicit degradation 또는 unsupported 상태를 제시하고 사용자 결정 없이 current result를 바꾸지 않는다.

### Fresh Self-Review와 시각 Evidence {#building-envelope-fresh-review-evidence}

<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-visual-review 실제 3D view에서 scale, silhouette, material, opening, contact, weather와 near·far fidelity를 재현해 검토한다. -->

시각 검토는 plan, eye-level, roof·facade detail, declared far view와 story-relevant camera에서 current source를 재현하고 beauty, depth, normal, identity와 필요 overlay의 역할을 구분한다. 수정 뒤에는 같은 조건으로 다시 capture하고 다른 규칙의 regression이 없음을 새 실행으로 확인하며 확대된 frame이나 prose 선언만으로 acceptance를 통과시키지 않는다.
