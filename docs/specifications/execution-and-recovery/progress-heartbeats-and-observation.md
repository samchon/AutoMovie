# Progress, Heartbeat와 관측

## Identity-bound Observation Stream {#execution-observation-stream}

### Progress Snapshot {#execution-progress-snapshot}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-observability-secret-protection 결과를 바꾸지 않으면서 job 상태, 진행, 자원, 실패와 publication을 관측하게 한다. -->

Observation은 job, attempt, state sequence, event type, observed scope와 record version에 결속된 read-only output이다. Observation의 활성화, sampling 빈도와 consumer 수는 deterministic state, scheduling decision의 정규 기준이나 output identity에 참여하지 않아야 한다.

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-progress-remaining-work 검증된 완료량, 전체 planned work와 추정의 불확실성을 분리한다. -->

Progress snapshot은 planned units, durably completed units, active units, failed units, not-run units, last checkpoint와 observation sequence를 포함한다. Fraction은 정의된 unit weight의 완료 합으로 계산하고 total plan이 바뀌면 새 plan identity를 표시하며, throughput, ETA와 completion time은 estimate method, confidence와 observed-at time을 함께 가진다.

### Heartbeat와 Liveness {#execution-heartbeat-liveness}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Owner와 liveness를 조회 가능한 exclusive claim의 일부로 만든다. -->
<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-stale-lock-recovery 시간 경과만으로 살아 있는 owner를 빼앗지 않는 stale 판정 근거를 제공한다. -->

Heartbeat는 attempt identity, owner generation, monotonic heartbeat sequence, observed-at time와 lease deadline을 가진다. Heartbeat는 owner가 lease를 갱신했다는 evidence일 뿐 work completion이나 artifact validity를 증명하지 않으며, deadline 경과 뒤에도 fencing과 independent liveness confirmation이 끝나기 전에는 새 writer를 current owner로 인정하지 않는다.

### Event Ordering과 Correlation {#execution-event-ordering-correlation}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-event-correlation 상태 전이, attempt, checkpoint, retry, lock, budget와 publication을 하나의 lineage로 재구성한다. -->

각 event는 globally unique event identity, job identity, optional attempt와 work-unit identity, per-job monotonic sequence, cause event와 correlation identity를 가진다. 여러 producer의 wall-clock order가 충돌하면 sequence와 causal relation을 정본으로 사용하고, 동일 event identity의 재전달은 중복 event를 만들지 않는다.

### Failure Observation {#execution-failure-observation}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-failure-diagnostic Failure 원인, 영향 범위, retry 가능성, 안전 상태와 다음 동작을 구분한다. -->
<!-- @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-traceable-record 표시 문구가 달라도 같은 실패를 비교할 stable diagnostic identity를 제공한다. -->

Failure observation은 stable diagnostic identity, classification, severity, affected scope, confirmed cause와 unknown facts, observed and expected values, retry eligibility, last safe checkpoint와 permitted next actions를 포함한다. Message만 있는 failure나 stack text에서 state를 추론하게 하는 결과는 정규 observation으로 인정하지 않는다.

### Secret-safe Observation {#execution-secret-safe-observation}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-secret-redaction Credential과 protected source가 log, metric, progress, error, receipt와 audit에 평문으로 남지 않게 한다. -->
<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-redaction 조치 가능한 context와 민감값 가림을 함께 유지한다. -->

Observation schema는 credential, token, private key, signed locator, private environment value와 protected payload를 허용하지 않는다. 필요한 dependency나 account는 재구성할 수 없는 stable reference와 scope만 기록하고, redaction은 field kind와 적용 여부를 표시하되 original value를 hash lookup 대상으로 노출하지 않는다.

### Observation Access Control {#execution-observation-access-control}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-observability-access-control 역할에 필요한 production과 세부 정보만 관측하게 한다. -->

Read request는 actor, production scope, requested detail class와 purpose를 포함하고 authorization decision을 거쳐야 한다. Aggregate metrics, job metadata, diagnostics, artifact identity와 protected provenance는 별도 disclosure class이며, 권한이 부족한 field를 empty value로 가장하지 않고 redacted 또는 forbidden 상태로 표시한다.

### Observation Retention {#execution-observation-retention}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-observability-retention 상세 diagnostic과 aggregate metric의 보존 및 삭제 조건을 분리한다. -->

Observation record는 class별 retention policy, expiry, legal or audit hold와 deletion status를 가진다. Aggregate를 만들 때 source detail과 secret을 복사하지 않고, detail 삭제 뒤 aggregate가 개인 또는 protected source를 역추론할 수 있으면 같은 민감도와 retention 경계를 적용해야 한다.
