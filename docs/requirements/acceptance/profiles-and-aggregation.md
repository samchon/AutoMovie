# Acceptance Profile과 집계 판정

## Profile 정체성 {#acceptance-profile-identity}

Acceptance profile은 적용 목적, version, 대상 종류, 필수 criterion, 선택 criterion, threshold, evidence tier, 승인 authority와 집계 규칙을 하나의 안정된 identity로 묶어야 한다.

사용자는 blocking pass, review evidence, 특정 delivery 또는 project-defined 목적에 맞는 profile을 요청할 수 있어야 한다. Profile 이름이 같아도 version이나 규칙이 다르면 같은 판정으로 합치지 않아야 한다.

### Blocking profile {#acceptance-blocking-profile}

Blocking profile은 readable geometry, staging, motion, timing과 frame-to-frame continuity를 판정하며 photorealism이나 detailed likeness를 필수 성공 조건으로 요구하지 않아야 한다.

### Evidence profile {#acceptance-evidence-profile}

Evidence profile은 판단 대상의 current 상태, 충분한 view와 시간 coverage, 수치·구조·시각 근거와 freshness를 요구해야 한다. 낮은 비용의 preview가 evidence 요건을 충족하지 않으면 해당 profile의 pass가 될 수 없어야 한다.

### Delivery profile {#acceptance-delivery-profile}

Delivery profile은 실제 게시 대상의 media, 언어, 접근성, 무결성, 재생 조건과 승인 의무를 소유해야 한다. Source 또는 계획 상태의 통과를 실제 delivery bytes의 통과로 대체하지 않아야 한다.

### Project-defined profile {#acceptance-project-defined-profile}

사용자는 작품 목적에 맞는 profile을 정의할 수 있어야 하지만 product exclusion을 뒤집거나 관찰 불가능한 promise를 통과 조건으로 만들지 않아야 한다.

## Profile 간 판정 격리 {#acceptance-profile-isolation-group}

### Profile 간 판정 격리 {#acceptance-profile-isolation}

한 profile의 pass는 criterion 집합과 threshold가 같거나 더 엄격하다는 관계가 명시되지 않은 한 다른 profile의 pass를 의미하지 않아야 한다.

Proxy, preview, evidence와 delivery 결과는 각각 선택한 profile로 표시해야 하며 낮은 profile을 높은 profile로 silent upgrade하지 않아야 한다.

## Criterion 집계 {#acceptance-criterion-aggregation}

집계 verdict는 각 criterion의 severity, 필수 여부, scope와 실제 verdict를 보존해야 한다. 전체 status만 보여 주고 하위 fail, indeterminate, unsupported 또는 stale을 숨기지 않아야 한다.

### 필수 여부와 Severity {#acceptance-required-severity}

Profile은 각 criterion을 required 또는 optional, blocking 또는 advisory로 분류해야 하며 blocking criterion은 required여야 한다. Required criterion은 current한 pass 또는 fail 판정을 가져야 하고, blocking fail은 승인을 막으며, advisory fail은 승인을 막지 않더라도 표시되어야 하고, optional criterion의 미실행은 집계를 미완료로 만들지 않아야 한다.

Required criterion이 invalid이면 대상 결과를 fail로 만들지 않고 profile 집계를 invalid로 중단해야 한다. 기준이 완성되기 전에는 authority도 acceptance verdict를 만들 수 없어야 한다.

### 완전 승인 {#acceptance-aggregate-pass}

완전 승인은 선택한 profile의 모든 required criterion이 current하고 결론적으로 판정되며, 모든 blocking criterion이 pass이고, 필수 authority의 승인이 있을 때만 가능해야 한다.

### 거절 {#acceptance-aggregate-fail}

하나 이상의 blocking criterion이 fail이면 집계는 rejected이어야 한다. Profile이 해당 criterion의 deviation을 명시적으로 허용하고 권한 있는 위험 인수가 있으면 accepted-with-deviation으로만 구분할 수 있으며, 다른 criterion의 높은 점수나 주관적 선호로 blocking fail을 상쇄하지 않아야 한다.

### 미완료 집계 {#acceptance-aggregate-incomplete}

Blocking fail은 없지만 필수 criterion에 indeterminate, not-run, unsupported 또는 stale이 남으면 완전 승인할 수 없어야 한다. 일부 선언 범위 또는 criterion이 pass이면 partial로 집계하고, 통과가 확인된 범위가 없으면 해당 미완료 상태를 그대로 보존해야 한다.

### 가중치와 점수 {#acceptance-weighted-score}

Profile은 선택 criterion의 비교를 위해 가중치나 점수를 사용할 수 있지만 blocking criterion의 참과 거짓을 평균으로 바꾸지 않아야 한다. 점수의 척도, 방향, missing 값 처리와 동점 규칙을 사용자가 확인할 수 있어야 한다.
