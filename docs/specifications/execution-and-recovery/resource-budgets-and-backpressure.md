# Resource Budget와 Backpressure

## 다차원 Resource Contract {#execution-resource-contract}

### Admission Estimate {#execution-budget-admission-estimate}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-resource-budgets-backpressure 긴 작업의 computation, memory, storage, network, 시간, quota, 비용과 concurrency 한계를 하나의 계약으로 닫는다. -->
<!-- @evidence requirements/rendering/budgets.md#rendering-budgets Render domain의 worst-case cost를 공통 실행 admission이 소비할 수 있게 한다. -->

Budget contract는 computation, accelerator, memory, storage, network, wall-clock duration, external quota, 비용과 concurrency의 resource dimension별 scope, unit, warning limit, hard limit, measurement source와 enforcement policy를 가진다. Peak와 cumulative usage, reserved와 measured usage, exact, conservative와 unknown estimate를 분리하고 여러 dimension을 하나의 평균 점수로 축약하지 않아야 한다.

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-budget-admission-estimate Peak, total, 여유와 불확실성을 시작 전에 평가하는 admission 출력을 구체화한다. -->

Admission estimate는 job 전체와 independently schedulable unit별 predicted peak, total, confidence, dominant contributors와 required headroom을 출력해야 한다. Hard limit을 넘거나 required dimension이 unbounded이면 reject하고, capacity가 일시적으로 없으면 blocked 또는 queued로 분류하며 request를 축소한 것처럼 success plan을 만들지 않는다.

### Runtime Enforcement {#execution-runtime-budget-enforcement}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-runtime-budget-enforcement 실행 중 warning과 hard limit을 보고하고 숨은 품질 저하 없이 안전하게 중단하게 한다. -->

Runtime measurement는 attempt와 work unit에 귀속되고 monotonic usage sequence를 가져야 한다. Warning limit은 observation event를 만들고 hard limit은 새 unit admission을 멈춘 뒤 현재 unit의 declared safe point에서 pause 또는 fail하며, domain output을 drop, downscale, skip 또는 재해석하지 않는다.

### Backpressure Signal {#execution-backpressure-signal}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-backpressure 느린 consumer와 제한된 dependency가 무제한 queue 및 host 불안정으로 번지지 않게 한다. -->

Producer는 downstream capacity, in-flight count, queue depth와 storage headroom으로부터 bounded credit을 받아야 하며 credit이 없으면 새 unit을 시작하지 않는다. Backpressure state는 blocked dimension, current depth, resume condition과 affected jobs를 출력하고 deterministic work ordering이나 output identity를 변경해서는 안 된다.

### Priority와 Fairness {#execution-priority-fairness}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-priority-fairness Priority와 deadline이 보이면서 낮은 priority의 무기한 starvation을 막는 scheduling 계약을 정의한다. -->

Queue ordering은 declared priority class, deadline, submission sequence와 reserved capacity를 정규 기준으로 사용하고 실제 선택 이유를 event로 남겨야 한다. 동일 class 안에서는 stable ordering을 사용하며 starvation bound를 선언하고, override는 authority, scope와 expiration 없이 priority를 바꿀 수 없다.

### Preemption과 Resource 회수 {#execution-budget-preemption}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-preemption-resource-reclamation Resource 회수를 일반 failure가 아닌 명시적 pause, cancel 또는 preemption으로 기록한다. -->

Preemption input은 대상 attempt, requested resource release, deadline와 authority를 포함한다. Output은 acknowledged state, last safe checkpoint, lost uncheckpointed work, released resources, partial artifacts와 resume condition을 포함하고, deadline 전 안전 중단이 불가능하면 force termination의 별도 권한 경계로 넘겨야 한다.

### Resource Accounting {#execution-resource-accounting}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-budget-result-accounting Success, failure, retry, cache reuse와 cancellation 비용을 job lineage에 귀속한다. -->

Accounting record는 job, attempt, work unit, resource dimension, reserved, consumed, externally billed, reused와 discarded amounts를 구분한다. Retry와 recovery는 이전 attempt 비용에 합산하되 중복 work를 별도 표시하고, cache hit는 회피한 추정 비용과 실제 lookup cost를 혼동하지 않는다.

### Domain Budget Refusal의 전달 {#execution-domain-budget-refusal}

<!-- @evidence requirements/rendering/budgets.md#rendering-budget-refusal Domain budget 초과를 공통 실행기가 임의 degradation 없이 그대로 거절하게 한다. -->

Domain planner가 반환한 exact 또는 conservative refusal은 affected product, measured or estimated value, limit와 safer request options를 보존한 admission rejection이 된다. Execution layer는 다른 quality profile을 자동 선택하지 않고 사용자가 승인한 새 request를 새 job identity로 처리해야 한다.
