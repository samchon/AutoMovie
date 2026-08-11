# 예산과 Truncation

## Budget 입력과 Accounting {#validation-budget-contract}

### Budget-exceeded 결과 {#validation-budget-exceeded-result}

<!-- @evidence requirements/diagnostics/budgets-and-limits.md#diagnostics-explicit-budgets 진단 수집의 적용 한계와 default 및 실제 사용 범위를 결과에 남긴다. -->

Validation budget은 time, work unit, occurrence count, serialized bytes, memory, external request, quota와 monetary cost 중 적용되는 dimension마다 warning limit, hard limit, scope와 accounting rule을 가진다. Request가 생략한 default도 effective budget에 materialize하여 session identity와 result가 같은 값을 공유한다.

Accounting은 planned, consumed, reserved와 remaining amount를 구분하고 unit과 measurement precision을 명시한다. 여러 scope가 budget을 공유하면 charge owner와 allocation을 기록하고, wall-clock과 deterministic work unit을 같은 dimension으로 섞지 않는다.

<!-- @evidence requirements/diagnostics/budgets-and-limits.md#diagnostics-budget-exceeded 입력 오류나 unsupported와 다른 예산 초과 상태 및 중단 범위를 정의한다. -->

Hard limit 도달은 budget-exceeded diagnostic과 incomplete 또는 refused result를 만든다. Diagnostic은 dimension, limit, 측정 가능할 때 consumed amount, last completed check, interrupted 또는 not-run scope와 남은 안전 행동을 포함한다.

Budget-exceeded는 input validity나 capability support를 바꾸지 않는다. Limit 전에 확정된 occurrence와 verified partial result는 보존할 수 있지만 required coverage가 남으면 전체 success로 승격하지 않는다.

### Truncation과 생략 {#validation-truncation-result}

<!-- @evidence requirements/diagnostics/budgets-and-limits.md#diagnostics-truncation-and-omission 제한된 목록이 완전한 결과로 오인되지 않도록 생략 수와 범위를 표현한다. -->

Diagnostic count나 byte budget 때문에 result projection을 줄이면 truncated flag, 적용 limit, selection rule, returned count, known total 또는 lower bound, omitted severity summary와 affected scope summary를 제공한다. 검사 자체를 중단한 경우에는 projection truncation과 execution incompleteness를 별도로 표시한다.

대표 항목은 canonical order에서 선택하고 fatal, security와 widest-scope blocking occurrence를 숨기지 않는다. Serialization limit은 underlying overall verdict와 occurrence count를 바꾸지 않으며 total을 알 수 없으면 exact count를 만들지 않는다.

### 조정과 Retry {#validation-budget-retry-contract}

<!-- @evidence requirements/diagnostics/budgets-and-limits.md#diagnostics-budget-remediation 범위 축소, budget 변경과 분할 실행의 비용 및 계보를 보존한다. -->

Correction은 scope narrowing, explicit budget increase, partitioned validation 또는 costly optional check 제거 중 정책상 허용되는 선택과 예상 resource, latency, external cost 및 coverage 변화를 제시한다. Quality tier, pass, frame 또는 subject를 몰래 drop하는 행동은 correction이 아니다.

Retry는 원래 session과 budget-exceeded diagnostic을 가리키는 새 attempt이고 effective budget, input identity와 reused result 범위를 기록한다. Budget이나 scope 변경이 overall validation identity를 바꾸면 이전 result를 덮어쓰지 않고 비교 가능한 별도 result로 보존한다.
