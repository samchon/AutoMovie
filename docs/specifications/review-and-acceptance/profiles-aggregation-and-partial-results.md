# Profile, 집계와 부분 결과

## Acceptance Profile 레코드 {#acceptance-system-profile-record}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-profile-identity Defines purpose, version, target types, criteria, thresholds, evidence, authority and aggregation as one identity. -->

Profile은 목적, version, applicable target kinds, required와 optional criteria, threshold, evidence tier, authority roles, aggregation rule과 nonwaivable policy를 하나의 immutable identity로 묶는다. 이름이 같아도 이 계약 중 하나가 다르면 별도 profile version이다.

### Blocking Profile {#acceptance-system-blocking-profile}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-blocking-profile Keeps blocking-pass acceptance focused on readable structure, staging, motion, timing and continuity. -->

Blocking profile은 readable geometry, staging, motion, timing과 frame-to-frame continuity를 required criteria로 삼고 photorealism과 detailed likeness를 필수 조건으로 추가하지 않는다.

### Evidence Profile {#acceptance-system-evidence-profile}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-evidence-profile Requires current target identity, sufficient views, temporal coverage and fresh evidence. -->

Evidence profile은 current target, required view와 temporal coverage, 수치, 구조, 지각 evidence와 freshness를 요구한다. 낮은 raster나 불완전한 preview는 evidence obligation을 충족할 때만 해당 profile에 사용할 수 있다.

### Delivery Profile {#acceptance-system-delivery-profile}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-delivery-profile Applies acceptance to actual media, language, accessibility, integrity and playback conditions. -->

Delivery profile은 실제 artifact의 media, language, accessibility, integrity, playback와 approval requirements를 소유한다. Source 계획이나 intermediate pass를 actual delivery bytes verdict로 승격하지 않는다.

### Project-defined Profile {#acceptance-system-project-profile}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-project-defined-profile Allows project-specific purposes without reversing exclusions or inventing unobservable promises. -->

Project-defined profile은 제품이 표현하고 관찰할 수 있는 범위에서 작품별 criteria와 authority를 추가할 수 있다. Product exclusion을 뒤집거나 관찰할 수 없는 promise를 pass condition으로 만들면 invalid다.

### Profile 격리 {#acceptance-system-profile-isolation}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-profile-isolation Prevents pass promotion across profiles without an explicit subsumption relation. -->

한 profile verdict는 criterion set, threshold, evidence와 authority가 같거나 더 엄격하다는 subsumption relation이 명시된 경우에만 다른 profile에 재사용할 수 있다. Proxy, preview, evidence와 delivery profile 사이의 silent upgrade를 금지한다.

## Criterion 집계 {#acceptance-system-criterion-aggregation}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-criterion-aggregation Preserves every child criterion's requirement, severity, scope and verdict in aggregate output. -->

Aggregate result는 child criterion identity, required 여부, severity, scope, verdict와 rationale을 보존하고 profile의 deterministic aggregation rule로 계산된다. Summary status는 fail, indeterminate, unsupported와 stale child를 숨기지 않는다.

### Required와 Severity {#acceptance-system-required-severity}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-required-severity Defines required, optional, blocking and advisory behavior including invalid-profile refusal. -->

Blocking criterion은 required여야 하고 blocking fail은 approval을 막는다. Advisory fail은 표시하되 approval을 자동 차단하지 않고 optional not-run은 집계를 미완료로 만들지 않는다. Required criterion이 invalid면 target fail이 아니라 profile aggregation error다.

### 완전 승인 집계 {#acceptance-system-aggregate-pass}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-aggregate-pass Requires current conclusive required verdicts, no blocking failure and authority approval. -->

Aggregate accepted는 모든 required criterion이 current한 pass 또는 fail로 결론 나고 blocking criterion이 모두 pass이며 required authority decision이 있을 때만 성립한다.

### 거절과 미완료 집계 {#acceptance-system-aggregate-fail-incomplete}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-aggregate-fail Rejects aggregates with non-deviated blocking failure. -->
<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-aggregate-incomplete Prevents complete approval while required criteria remain indeterminate, not-run, unsupported or stale. -->

하나 이상의 비면제 blocking fail은 rejected를 만든다. Blocking fail은 없지만 required criterion에 indeterminate, not-run, unsupported 또는 stale이 남으면 aggregate는 partial 또는 해당 미완료 상태이며 accepted가 될 수 없다.

### Score와 가중치 {#acceptance-system-weighted-score}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-weighted-score Limits scoring to comparison without averaging away blocking truth. -->

점수와 가중치는 선택 criteria의 comparison에만 사용하고 blocking predicate를 평균으로 바꾸지 않는다. Scale, direction, missing handling과 tie rule은 profile에 포함된다.

## 불확실성과 부분 성공 {#acceptance-system-uncertainty-partial}

<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-uncertainty-expression Requires the cause, magnitude or range and verdict impact of uncertainty. -->
<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-partial-success Defines partial as explicitly scoped success with remaining incomplete work. -->

Uncertainty record는 measurement, alignment, transform, observer, external source 또는 sampling 원인과 크기 또는 가능한 범위, affected observable과 verdict impact를 가진다. Partial aggregate는 pass한 scope와 criterion, 남은 scope, risk, allowed use와 prohibited use를 함께 제공한다.

### 수치 불확실성 {#acceptance-system-numeric-uncertainty}

<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-numeric-uncertainty Defines pass, fail and indeterminate from an uncertainty interval around the boundary. -->

수치 uncertainty interval 전체가 pass 영역이면 pass, 전체가 fail 영역이면 fail이며 boundary를 걸치면 추가 decision rule이 없는 한 indeterminate다.

### 부분 Artifact와 Evidence {#acceptance-system-partial-artifact-evidence}

<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-partial-artifact Restricts verdict scope when only some frames, streams, languages, passes or packages exist. -->
<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-partial-evidence Restricts verdict scope when required visual, temporal or view evidence is missing. -->

일부 artifact나 evidence만 존재하면 확인된 부분을 좁게 판정하고 missing scope와 required evidence를 표시한다. 한 evidence kind의 pass를 다른 kind나 criterion 전체로 확대하지 않는다.

### 상태 승격 금지 {#acceptance-system-no-status-promotion}

<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-status-no-promotion Prevents incomplete states from becoming warning-bearing passes. -->

Indeterminate, not-run, unsupported, stale와 partial은 경고가 있는 pass로 자동 변환되지 않는다. Missing precondition이 충족되고 current evidence로 재판정한 새 record만 상위 상태로 전이할 수 있다.
