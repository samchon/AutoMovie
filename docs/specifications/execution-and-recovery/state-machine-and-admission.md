# 상태 기계와 Admission

## Versioned 상태 기계 {#execution-versioned-state-machine}

### Job State와 Attempt State {#execution-job-attempt-state}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-state-vocabulary 긴 작업의 planned부터 terminal까지 구분 가능한 상태 vocabulary를 시스템 전이로 구체화한다. -->

상태 기계 version은 state 의미와 allowed transitions를 함께 식별해야 한다. Current attempt는 한 시점에 하나의 상태만 가지며 job state는 current attempt, retry eligibility와 remaining work에서 파생되고, 알 수 없는 version이나 state는 blocked 상태로 격리하여 mutation을 거부해야 한다.

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-attempt-separation 실패한 attempt와 계속 유효한 logical job의 상태를 분리한다. -->

Attempt는 queued, running, pausing, paused, cancelling, cancelled, succeeded, failed 또는 abandoned 중 하나이며 planned와 blocked는 아직 실행 가능한 attempt를 갖지 않은 job 상태다. Failed attempt 뒤 retry가 허용되면 job은 terminal이 아니라 blocked 또는 queued가 되고, retry policy가 끝났거나 operator가 abandon하면 job 전체가 terminal이 된다.

### Allowed Transition {#execution-allowed-state-transitions}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-state-transition-history 이전과 새 상태 및 원인을 보존하고 늦은 전이가 새 상태를 덮지 못하게 한다. -->

Job admission은 planned에서 blocked, queued 또는 cancelled로 전이하고 blocked에서 조건이 충족되면 queued로 전이하거나 cancelled 또는 abandoned로 닫는다. Attempt는 queued에서 running, cancelling 또는 cancelled로, running에서 pausing, cancelling, succeeded 또는 failed로, pausing에서 paused, cancelling 또는 failed로, paused에서 queued, cancelling 또는 cancelled로, cancelling에서 cancelled 또는 failed로 전이한다. Owner acknowledgement가 불가능하다고 확인한 recovery authority만 fenced non-terminal attempt를 abandoned로 전이할 수 있으며, terminal attempt에는 후속 transition을 허용하지 않고 retry는 새 attempt와 job-level queued transition을 만든다.

### Transition Compare-and-set {#execution-transition-compare-set}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-state-transition-history 뒤늦거나 허용되지 않은 transition이 current truth를 바꾸지 못하는 경쟁 조건을 닫는다. -->

Transition input은 job과 attempt identity, expected previous state, expected owner generation, requested next state, reason, authority와 event identity를 포함한다. 현재 state나 owner generation이 expected value와 다르면 conflict를 반환하고 아무 상태도 쓰지 않으며, 성공한 transition은 증가하는 sequence와 durable acknowledgement를 출력해야 한다.

### Terminal Outcome {#execution-terminal-outcome}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-terminal-state-truth Terminal attempt가 더 이상 결과를 변경하지 않으며 success와 publication을 구분하게 한다. -->

Attempt terminal outcome은 succeeded, failed, cancelled 또는 abandoned와 종료 원인, final checkpoint 및 artifact completeness를 가진다. Succeeded는 required work와 validation closure가 충족된 경우에만 허용하고 publication과 retention은 별도 transition이며, terminal acknowledgement 뒤 도착한 output은 orphan candidate로 격리해야 한다.

### Admission Input {#execution-admission-input}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-budget-admission-estimate 시작 전에 예상 비용과 수용 여부를 구분하는 admission 입력을 정의한다. -->
<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-dependency-identity-availability 필요한 dependency의 정확한 identity와 availability를 admission에서 확인한다. -->

Admission은 canonical job contract, current authoritative revision, dependency availability, compatibility support, security and validation gates, resource estimate, configured limits, concurrency conflicts와 authority를 한 snapshot에서 평가해야 한다. Snapshot을 완성할 수 없거나 계산이 unknown인 필수 축은 승인으로 추정하지 않는다.

### Admission Decision {#execution-admission-decision}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-state-vocabulary 시작, 대기, 차단과 종료 상태를 모호하지 않은 결과로 반환한다. -->
<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work 전체 명령 요청을 실행 전에 확정하거나 거부한다. -->

Admission output은 admitted, queued, blocked 또는 rejected와 applied policy, limiting facts, queue class, retry condition 및 decision identity를 가진다. Admitted만 execution owner를 획득할 수 있고 blocked는 충족 가능한 dependency나 capacity condition을, rejected는 입력 또는 policy를 바꾸지 않고는 진행할 수 없는 reason을 제공해야 한다.

Command admission은 argv 전체를 정확히 하나의 discriminated command plan으로 바꾸거나 rejected 결과를 반환한다. Plan은 command별 허용 option 집합, 단일 공급 여부, positional slot, default와 typed value를 모두 확정해야 하며 unknown, duplicate, inapplicable, extra, missing, blank와 같은 거부 이유 및 문제 token class를 보존해야 한다. Dispatcher와 생성된 project command는 성공한 plan만 실행 입력으로 받아야 하고, parsing 실패 뒤에는 target path resolution, project 또는 production state 조회, migration이나 scaffold write, child process spawn, browser 설치·실행·capture, compile 또는 derivation을 호출해서는 안 된다.
