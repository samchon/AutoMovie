# 경계, 프록시와 상세도

## 공간 파생 사실의 경계 {#asset-spec-bounds-boundary}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds 선언한 bounds와 실제 geometry에서 측정한 bounds를 비교할 수 있어야 한다. -->

시스템은 bounds, proxy와 상세도 표현을 원본 자산의 대체 identity가 아니라 특정 revision과 목적에서 계산하거나 저작한 파생 사실로 취급한다. 파생 기록은 기준 모델·geometry·rig·state와 계산 규칙을 가리키며, 기준이 바뀌면 이전 결과가 계속 유효하다고 추정하지 않는다.

### bounds 입력과 좌표 {#asset-spec-bounds-inputs}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-declared-measured-bounds bounds의 좌표계, 단위, 표현, 상태와 측정 근거를 명시해야 한다. -->

bounds 입력은 자산·모델·representation revision, 계산할 element 집합, 좌표계와 단위, pivot, 상태, pose 또는 시간 구간, 포함할 attachment와 허용 오차를 포함한다. 선언 bounds와 측정 bounds는 별도 값과 provenance를 가지며, 둘 사이의 차이는 축별·방향별 오차와 초과 원인으로 보고한다.

### 정적·동적 bounds 불변식 {#asset-spec-dynamic-bounds-invariants}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-bounds-state-motion 열린 문, 변형 표면과 동작 범위를 포함하는 bounds를 구할 수 있어야 한다. -->

neutral bounds는 지정한 기준 상태만 포함하고, state bounds는 이름 있는 상태를, motion bounds는 시간 구간에서 도달 가능한 표면을 포함한다. 동적 bounds의 보수성, 표본화 간격과 해석 오차를 기록하며, contact·camera·collision 목적에 필요한 돌출부를 누락한 축소 bounds를 유효한 근사로 표시하지 않는다.

### proxy 목적과 계보 {#asset-spec-proxy-purpose-lineage}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-proxy-lineage proxy와 LOD가 원본 및 생성 규칙을 추적해야 한다. -->

proxy는 collision, selection, blocking, shadow, distant display와 같이 선언된 목적 하나 이상을 가지며 원본 revision, 생성 규칙, 오차 지표와 검증 결과를 참조한다. 한 목적에 승인된 proxy를 다른 목적에 자동 재사용하지 않고, proxy의 외형 단순화가 원본의 의미·능력·접촉 계약까지 단순화한다고 간주하지 않는다.

### 상세도 graph와 선택 정책 {#asset-spec-lod-selection-policy}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-selection 거리, 화면 오차, 목적과 예산을 포함한 선택 기준을 사용자가 통제해야 한다. -->
<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-budget-representation 예산 초과 시 사용자가 대체 representation과 tradeoff를 선택할 수 있어야 한다. -->

상세도 graph는 각 representation revision, 적용 가능한 목적과 능력, 비용 측정, 오차 지표, 유효 거리·화면 크기 범위와 대체 관계를 기록한다. 선택 정책은 사용자가 선언한 우선순위와 threshold를 입력으로 받으며, 시스템은 특정 거리, polygon 수, proxy 종류 또는 품질 단계 하나를 보편 기본값으로 고정하지 않는다.

### 전환 불변식 {#asset-spec-lod-transition-invariants}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-lod-transition-stability 표현 전환에서 popping, scale jump, contact drift와 silhouette 붕괴를 검토해야 한다. -->

전환 전후 표현은 자산·instance identity, world scale, pivot, anchor, contact, 필요한 animation phase와 material role을 보존한다. 전환 정책은 경계, 적용 방향, 선택적 hysteresis 또는 blend 구간과 허용 오차를 명시하고, 같은 입력에서 같은 표현과 전환 시점을 선택한다.

### 선택 출력과 비용 보고 {#asset-spec-lod-output-costs}

<!-- @evidence requirements/production-design/budgets-and-feasibility.md#production-design-worst-case-budget 평균뿐 아니라 최악 조건에서 자산과 표현 비용을 제시해야 한다. -->

선택 출력은 시간 구간별 representation revision, 선택 근거, bounds와 예상 화면 오차, 개별·공유·최악 비용, 전환 시점, 저하된 사실과 검증 상태를 포함한다. 측정값, 추정값과 아직 측정하지 않은 값은 구분하며, 공유 자원 비용을 모든 instance에 중복하거나 누락하지 않는다.

### 무효화와 실패 {#asset-spec-bounds-lod-failures}

<!-- @evidence requirements/asset-authoring/representations-bounds-and-lod.md#asset-representation-stale-refusal 원본 변경 뒤 stale bounds, proxy와 LOD 사용을 거부해야 한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-representation-bounds-validation 표현 간 scale, bounds, pivot, contact와 전환을 검증해야 한다. -->

기준 geometry·rig·state·attachment·선택 정책 또는 생성 규칙이 달라지면 영향받은 bounds, proxy와 상세도 결과는 stale이다. 유한하지 않은 bounds, 역전된 범위, 좌표계 누락, 목적 밖 proxy, threshold 공백·중첩의 미해결, 의미 불호환 또는 stale 파생물을 current 결과에 사용하려는 요청은 실패하며 대체 후보와 재계산 범위를 함께 반환한다.
