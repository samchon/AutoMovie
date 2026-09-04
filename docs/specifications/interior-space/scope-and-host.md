# 범위, 호스트와 공유 건물

## Contract units {#spec-scope-and-host-contract-units}

### 건물 interior 시스템 경계 {#interior-space-building-interior-boundary}


<!-- @evidence requirements/interior/scope-and-host-boundary.md#interior-host-bounded-scope Requires interior facts to remain inside a declared host boundary. -->
<!-- @evidence requirements/interior/scope-and-host-boundary.md#interior-current-product-scope Limits the current authoring contract to building interiors. -->
<!-- @evidence requirements/interior/scope-and-host-boundary.md#interior-scope-refusal Requires host escape and unsupported exterior claims to fail explicitly. -->
<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-transport-exclusion Excludes transport exteriors from the building authoring contract. -->

시스템은 입력으로 하나의 interior work identity, 건물 identity, 좌표계, 실제 단위, 포함되는 building unit과 저작 범위를 받아야 한다. Current 저작 범위는 건물의 점유 공간과 그 내부 구성에 한정된다. 선박 cabin, 항공기 cabin, 우주선 habitable compartment와 그 밖의 비건물 host 내부는 일반 공간 원리를 참고할 수 있지만 이 계약으로 생성·검증 가능한 current 제품 지원 대상으로 표시해서는 안 된다. Transport exterior 제외는 건물 외피 계약이 별도로 소유한다. Resolved interior는 모든 공간, 경계, 요소, 개구부와 설비를 정확히 한 building ownership 또는 명시된 work-owned connector에 귀속해야 하며, host 밖 geometry, identity 없는 root, scope 밖 전문 성능 주장은 경로와 영향을 가진 failure가 되어야 한다. 새 건축 종류와 사용자 정의 `kind`는 같은 일반 계약으로 추가할 수 있지만 기존 identity와 범위 의미를 바꾸는 호환성 축소는 명시적 migration 없이는 허용하지 않는다.

### 독립 interior set의 상태 {#interior-space-independent-set-state}

<!-- @evidence requirements/interior/scope-and-host-boundary.md#interior-host-identity Requires a stable host identity and coordinate relationship. -->
<!-- @evidence requirements/interior/scope-and-host-boundary.md#interior-without-exterior Allows a bounded interior set without inventing exterior facts. -->
<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-independent-scope Distinguishes independent scope from a failed linked-building check. -->

Exterior가 없는 촬영용 interior set는 `independent` scope, project-local frame, 실제 scale, virtual boundary, valid camera·collision·clearance extent, intentionally absent와 unknown 사실을 입력으로 가져야 한다. 이 상태에서는 room, finish, prop과 조명을 current로 만들 수 있으나 footprint, terrain contact, exterior envelope, roof, facade, external drainage와 map alignment를 검증한 것으로 출력해서는 안 된다. Virtual boundary 밖 배치나 선언되지 않은 exterior 의미는 failure이고, 이후 exterior와 연결할 때에는 기존 set를 조용히 늘이거나 축소하지 않고 새로운 shared-building reconciliation을 거쳐야 한다.

### 연결된 건물의 공동 사실 {#interior-space-linked-building-shared-facts}

<!-- @evidence requirements/building-exterior/scope-and-building-identity.md#building-exterior-linked-interior Requires linked sides to share building and boundary facts. -->
<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-identity Prevents duplicated walls, slabs, and openings from masquerading as shared construction. -->
<!-- @evidence requirements/building-exterior/coordinates-and-shared-boundaries.md#building-shared-boundary-change Requires bidirectional staleness when a shared fact changes. -->
<!-- @evidence requirements/building-exterior/validation-and-interior-consistency.md#building-exterior-interior-shared-validation Defines the joint constraint set for linked results. -->

`linked` scope는 동일한 building, building unit, level, construction boundary, opening cut와 service port identity를 exterior와 interior가 공유하거나 명시적 대응표로 연결해야 한다. 공통 입력에는 transform chain, footprint, area basis, level datum, floor-to-floor height, slab와 envelope thickness, core·shaft·structure, opening aperture·state, service medium·direction, phase와 selected alternative가 포함된다. 어느 쪽도 기준 사본으로 암묵 승격되지 않으며 공통 사실이 변하면 양쪽 dependent geometry, quantities, routes, analyses와 captures를 stale로 만들고 다시 해석해야 한다. Containment, datum, thickness, opening 또는 service residual이 허용오차를 넘으면 화면상 근접이나 숨은 scale로 보정하지 않고 measured coordination failure를 출력해야 한다.
