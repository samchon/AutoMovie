# 시간 상태, 대안과 staleness

## canonical 시간 상태 {#world-site-canonical-temporal-state}

<!-- @evidence requirements/map/temporal-change.md#map-temporal-change Defines change as lineage over one canonical spatial identity. -->
<!-- @evidence requirements/map/temporal-change.md#map-state-validity-phase-order Requires non-overlapping validity and ordered phases. -->

시스템은 spatial feature identity와 geometry를 무조건 복제하지 않고, valid time, transaction revision, phase, event와 alternative가 적용된 canonical site state를 해석한다. phase 순서와 유효 구간은 명시적이고 cycle이나 모순된 canonical 상태가 없어야 하며, 모든 질의와 산출물은 사용한 상태 identity와 시각을 기록한다.

### 기존, 변경과 철거 {#world-site-existing-change-demolition}

<!-- @evidence requirements/map/temporal-change.md#map-existing-change-demolition Requires existing, retained, modified, removed and new states to preserve lineage. -->

기존, 유지, 변경, 이전, 철거, 폐쇄, 복구와 신규 상태는 feature의 phase relation과 predecessor·successor lineage를 가진다. 철거는 이전 상태를 삭제하는 작업이 아니라 적용 시각 이후 존재하지 않는 상태이며, history 조회와 비교에서는 원래 근거를 유지한다. 서로 다른 source가 existing 상태에 합의하지 않으면 하나를 임의로 current로 선택하지 않는다.

### 사건과 consequence {#world-site-event-consequence}

<!-- @evidence requirements/map/temporal-change.md#map-event-consequence Requires events to name causes, affected features and resulting state transitions. -->

폭우, 홍수, 산사태, 화재, 공사, 행사, 설비 고장과 사용자 정의 사건은 identity, 발생·종료 시각, 원인 또는 trigger, 영향 extent와 대상 feature, 이전·이후 상태를 가진다. consequence는 dependency graph에 따라 route, 가시성, 물, 식생, 토지, 설비와 산출물을 전이시키며, 인과 규칙이 없는 시각적 변화에서 물리·운영 결과를 발명하지 않는다.

### 연속·불연속 변화 {#world-site-continuous-discrete-change}

<!-- @evidence requirements/map/temporal-change.md#map-continuous-discrete-change Requires interpolation only for declared continuous quantities. -->

수위, 생장 stage, 온도처럼 연속으로 선언된 값은 단위, 보간 법칙과 유효 구간 안에서만 sample하고, 개통·철거·붕괴·용도 변경처럼 불연속인 상태는 정해진 transition에서만 바뀐다. 구간 밖 extrapolation과 서로 다른 datum·revision 사이의 보간은 거부한다. 같은 절대 시각과 입력에서 파생 순서와 무관하게 같은 상태를 출력한다.

### 대안과 canonical 선택 {#world-site-alternative-canonical-selection}

<!-- @evidence requirements/map/temporal-change.md#map-alternative-canonical Requires alternatives to share a base while one explicit choice drives canonical output. -->

설계안, 복구안, 행사 배치와 시나리오는 공통 base revision을 참조하는 alternative이며 stable identity, 적용 범위와 차이를 가진다. 하나의 production state에는 해당 decision scope마다 명시적으로 선택된 canonical alternative만 파생과 delivery를 구동하고, 선택되지 않은 대안은 비교 가능한 상태로 남는다. 선택이 없거나 서로 배타적인 선택이 둘이면 canonical 출력은 실패한다.

### 변화 provenance와 staleness {#world-site-change-provenance-staleness}

<!-- @evidence requirements/map/temporal-change.md#map-change-provenance Requires every change to identify authority, source, time and prior revision. -->
<!-- @evidence requirements/map/temporal-change.md#map-change-impact-staleness Requires downstream consumers to become stale when dependencies change. -->
<!-- @evidence requirements/interior/validation-and-iteration.md#interior-validation-scope-freshness Keeps shared site-dependent interior evidence fresh. -->

각 변경은 제안·승인 authority, source evidence, 기록 시각, base revision, 변경 집합과 새 revision을 가진다. 좌표, 지형, 수문, network, 시간 또는 외부 source 변경은 직접·간접 consumer를 추적해 route, viewshed, building 접점, quantity, tile, render와 validation을 stale로 표시한다. 재계산 전 stale 산출물을 current로 배포하거나 이전 verdict를 새 revision에 승계하지 않는다.

### 시간 비교 출력 {#world-site-temporal-comparison-output}

<!-- @evidence requirements/map/temporal-change.md#map-temporal-comparison Requires comparable added, removed, changed and unchanged results with common framing. -->

두 상태의 비교는 공통 좌표 기준과 extent, feature lineage, 시각·phase·alternative identity를 사용해 added, removed, changed, unchanged와 unresolved를 구분한다. geometry, 속성, topology, 운영과 provenance 차이를 별도 항목으로 출력하고 tolerance와 비교 방법을 기록한다. 공통 기준으로 변환할 수 없는 상태는 시각 overlay만 제공할 수 있으며 정량 차이로 주장하지 않는다.
