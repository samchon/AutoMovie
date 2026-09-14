# Retry, Backoff와 Idempotency

## 같은 Logical Work의 반복 {#execution-retry-idempotency-contract}

### Duplicate Submission {#execution-duplicate-submission}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-retry-lineage-and-limits Retry를 같은 job의 새 attempt로 기록하고 한계 없이 반복하지 않게 한다. -->
<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotency-side-effects 중복 요청과 응답 유실 뒤 반복이 durable state와 외부 side effect를 늘리지 않게 한다. -->

Retry input은 logical job identity, failed or interrupted attempt, failure classification, retry policy와 authority를 포함한다. Retry output은 new attempt identity, eligibility decision, earliest start, remaining limits와 reused completion set이며 job contract와 deterministic output identity를 변경하지 않는다.

<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission 동시 또는 지연된 같은 요청을 하나의 logical job과 연결하거나 명시적으로 거부한다. -->

Submission은 client request identity와 canonical job identity를 모두 확인해야 한다. 같은 request identity는 최초 decision을 그대로 반환하고 같은 job identity의 별도 request는 active job에 attach, completed result reuse 또는 explicit duplicate rejection 중 하나가 되며 별도 success와 비용으로 중복 집계하지 않는다.

### Retry Eligibility와 Limit {#execution-retry-eligibility-limit}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-retry-lineage-and-limits Failure 원인, 횟수, 지연과 stop condition을 attempt lineage에 보존한다. -->
<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-repeated-failure-stop 같은 원인의 반복이 진전 없이 순환하면 자동 retry를 멈춘다. -->

Failure는 transient, dependency-blocked, capacity-blocked, invalid-input, incompatible, cancelled, ambiguous-side-effect 또는 permanent로 분류해야 한다. Automatic retry는 transient와 명시적으로 허용된 dependency or capacity failure에만 적용하고 max attempts, max elapsed duration, repeated-cause threshold와 operator stop을 모두 만족할 때만 새 attempt를 만든다.

### Backoff Schedule {#execution-retry-backoff-schedule}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-retry-lineage-and-limits Retry 지연과 중단 조건을 관찰 가능한 policy로 만든다. -->

Backoff policy는 base delay, growth rule, maximum delay, optional bounded jitter rule와 reset condition을 versioned identity로 가진다. Earliest start는 attempt ordinal과 failure class에서 계산하고 실제 start가 늦어진 사실은 output identity를 바꾸지 않으며, random jitter를 쓰면 recorded seed로 재계산 가능해야 한다.

### Deterministic Result Reuse {#execution-deterministic-result-reuse}

<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results 검증된 input과 output identity가 정확히 일치할 때만 이전 결과를 재사용한다. -->

Reuse decision은 expected job and output identity, stored artifact identity, byte integrity, validation status, compatibility profile와 freshness를 비교한 정규 receipt를 출력해야 한다. Filename, location, timestamp, previous success state와 cache presence는 reuse evidence가 아니며 mismatch가 하나라도 있으면 affected unit을 다시 수행한다.

### Alias-visible Bytes {#execution-alias-visible-bytes}

<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-alias-visible-bytes 갱신을 요청하지 않은 경로의 내용이 남아야 한다는 약속을 허용되는 쓰기 방식의 집합으로 정밀화한다. -->

쓰기는 두 방식 중 하나로만 이 약속을 이행한다. 하나는 대상이 정확히 하나의 directory entry를 가질 때 resident inode를 다시 쓰는 것이고, 다른 하나는 대상의 directory entry를 제거한 뒤 같은 이름에 successor를 배타적으로 만드는 것이다. 두 번째 방식에서 다른 경로는 이전 inode를 계속 가리키므로 그 bytes가 남는다. Entry 수는 첫 번째 방식의 admission 조건이며, 관측만 하는 연산과 entry를 교체하는 연산은 그 수를 묻지 않는다.

어느 방식도 generation pin(identity·size·modification), readback, exclusive create, competitor 보존과 partial state 보고를 약화하지 않는다. Entry를 제거한 뒤 successor 생성이 실패하면 predecessor가 이미 사라졌으므로 그 결과를 부재가 아니라 partial로 보고한다. 첫 번째 방식에는 entry 수 관측과 재작성 사이의 창이 남고 두 번째 방식에는 남지 않는다는 사실을 구현이 밝혀야 한다.

### External Outcome Reconciliation {#execution-external-outcome-reconciliation}

<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-external-side-effect-outcome 외부 upload, generation, billing, notification과 publication의 unknown outcome을 즉시 반복하지 않는다. -->

External request는 provider-neutral operation identity, idempotency key를 지원하는 경우 그 key, request digest, dispatch acknowledgement, response identity, receipt와 billed fact를 기록한다. Response가 유실되면 query or destination inspection으로 confirmed success, confirmed absence, confirmed failure 또는 still unknown을 판정하기 전에는 같은 side effect를 재호출하지 않는다.

### Exactly-once Capability Boundary {#execution-exactly-once-boundary}

<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-exactly-once-claim-boundary 외부 대상이 보장하지 않는 exactly-once 의미를 허위로 주장하지 않는다. -->

Exactly-once는 대상 system이 stable idempotency identity와 outcome lookup을 제공하고 execution record가 그 보장을 검증할 때만 capability로 선언한다. 그렇지 않으면 at-least-once, at-most-once 또는 unknown delivery semantics를 명시하고 possible, confirmed, failed와 compensated 상태를 서로 구분한다.

### Compensation과 Adoption {#execution-compensation-adoption}

<!-- @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation 중복 또는 부분 side effect의 보상과 채택을 원래 작업에 연결한다. -->

Compensation request는 original side-effect identity, observed consequence, desired disposition, authority와 expected remote revision을 포함한다. Compensation, duplicate adoption과 abandonment는 새 audit event와 receipt를 만들고 original failure를 보존하며, compensation 실패는 원래 side effect가 사라졌다고 추정하지 않는다.
