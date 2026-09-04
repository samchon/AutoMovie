# Concurrent Ownership과 Locking

## Mutation Ownership Contract {#execution-concurrent-ownership-contract}

### Duplicate Job Coordination {#execution-duplicate-job-coordination}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-concurrent-runs-locking 겹치는 production 작업의 workspace, checkpoint, candidate와 current mutation을 소유권으로 분리한다. -->

Mutable scope는 canonical production and action range identity를 가지며 동시에 하나의 owner generation만 write authority를 갖는다. Independent scopes는 병렬 실행할 수 있고 shared immutable input과 artifact는 read-only로 공유하며, current reference나 mutable checkpoint를 바꾸는 작업은 scope overlap을 admission에서 검출해야 한다.

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-duplicate-job-concurrency 같은 job identity의 동시 요청을 하나의 active execution에 연결하거나 거부한다. -->

같은 logical job의 concurrent submissions는 active attempt identity를 반환하거나 explicit duplicate refusal을 반환한다. Intentional redundant execution은 별도 policy와 isolated candidate scope를 요구하고 두 attempt가 같은 mutable artifact, checkpoint와 side effect identity를 독립 갱신하지 못하게 해야 한다.

### Claim Scope와 Owner Identity {#execution-claim-scope-owner}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-lock-scope-owner Exclusive claim의 production, action, owner, acquisition, liveness와 expiry를 조회 가능하게 한다. -->

Claim record는 protected scope, owner actor, job and attempt, generation, acquisition event, lease deadline, heartbeat sequence와 capability set을 가진다. Acquire는 expected prior generation과 conflict set을 입력으로 받고 acquired, busy or ambiguous를 출력하며 필요한 scope보다 넓은 global claim을 자동 요구하지 않는다.

한 host의 process claim은 non-empty host, positive safe-integer PID와 process 시작마다 생성한 UUID generation을 하나의 owner identity로 저장한다. Reader는 exact current generation, local PID absent, local PID occupied-or-reused, elsewhere와 unknown을 구분하며, signal-zero 성공과 permission denial은 occupancy일 뿐 recorded generation의 liveness 증거가 아니다.

### Stale Claim Recovery {#execution-stale-claim-recovery}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-stale-lock-recovery Owner 상실과 current revision을 확인한 뒤에만 stale claim을 인계한다. -->

Stale 판정은 expired lease, repeated independent liveness check, owner generation과 protected state snapshot을 모두 필요로 한다. Takeover는 old generation을 fence하는 newer generation을 먼저 durable하게 만들고 abandoned attempt와 unknown artifacts를 기록하며, elapsed time 하나만으로 기존 claim을 삭제하지 않는다.

Local file claim은 같은 validated owner를 두 번 조회하여 모두 `absent`이고 두 관찰 사이 exact file identity와 owner bytes가 같을 때만 reclaim할 수 있다. `same-owner`, `occupied-or-reused`, `elsewhere`, malformed owner와 query-unavailable은 takeover authority가 아니며 기존 claim 또는 artifact를 그대로 보존한다.

### Fencing과 Late Writer {#execution-fencing-late-writer}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-late-writer-fencing 소유권을 잃거나 이전 revision을 사용한 attempt의 늦은 write를 차단한다. -->

모든 mutable transition, checkpoint, artifact commit과 publication은 owner generation 및 expected target generation을 함께 검증해야 한다. Older generation은 bytes가 valid해도 current mutation을 거부당하고 output을 orphan candidate로 격리하며 successor의 state를 삭제, replace 또는 roll back할 수 없다.

Project revision domain은 non-negative safe integer이며 physical absence만 legacy revision 0으로 해석한다. Writer는 expected revision equality와 exact safe-integer successor를 payload staging 또는 output callback 전에 확정하고, malformed record나 최대 revision에서는 audit pathname을 포함한 어떤 mutable byte도 쓰지 않는다.

### Deadlock과 Starvation {#execution-deadlock-starvation}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-deadlock-queue-stall 서로 기다리는 claim, 장기 점유와 queue starvation을 진단하고 안전한 operator 선택을 제공한다. -->

Wait relation은 waiter job, held claim, requested claim, since sequence와 deadline을 graph로 관측할 수 있어야 한다. Cycle, maximum hold와 starvation bound 위반은 blocked diagnostic을 만들고 victim cancellation, priority change 또는 scoped takeover 중 authority가 허용한 선택을 제시하며 자동 lock removal을 completion으로 기록하지 않는다.

### Shared Immutable Result {#execution-shared-immutable-result}

<!-- @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-concurrent-shared-result-reuse 공유 결과의 identity와 integrity를 확인하고 한 job의 cleanup이 다른 active consumer를 손상시키지 않게 한다. -->

Shared result는 immutable content identity, validation and compatibility identity와 active reference set을 가진다. Consumer admission은 exact match를 증명하고 reference generation을 등록하며, cancellation, failure와 cleanup은 자기 reference만 해제하고 remaining active or retained references가 있는 payload를 제거하지 않는다.

### Publication Ownership Conflict {#execution-publication-ownership-conflict}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-publication-conflict-rollback 다른 작업의 current publication을 조용히 덮지 않고 conflict와 rollback history를 보존한다. -->

Publication owner는 candidate preparation owner와 current reference commit authority를 구분할 수 있다. Commit은 expected current and owner generation을 compare-and-set하고 conflict 시 candidate를 보존한 채 최신 current를 반환하며, 재시도는 최신 generation에서 preconditions를 다시 평가해야 한다.
