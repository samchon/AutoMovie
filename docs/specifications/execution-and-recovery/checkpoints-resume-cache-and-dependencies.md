# Checkpoint, Resume, Cache와 Dependency

## Durable Recovery Contract {#execution-durable-recovery-contract}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-checkpoints-resume-retry Session 기억 없이 긴 작업을 안전하게 이어갈 recovery point를 시스템 record로 정의한다. -->

Checkpoint publication의 입력은 current attempt와 owner generation, job identity, completed work set, resumable state, artifact references와 compatibility profile이다. 출력은 immutable checkpoint identity, durable acknowledgement와 maximum redo range이며 acknowledgement되지 않은 in-memory state는 checkpoint로 보고하지 않는다.

### Checkpoint Closure {#execution-checkpoint-closure}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-checkpoint-completeness Job, input, 완료 및 미완료 범위, state, artifact, receipt, compatibility와 integrity를 하나의 closure로 묶는다. -->

Checkpoint record는 schema version, job과 attempt identity, plan identity, completed and remaining unit identities, deterministic state snapshot, dependency closure, complete artifact receipt, side-effect disposition, compatibility identity와 record digest를 가진다. Referenced item이 없거나 integrity를 확인할 수 없으면 checkpoint 전체 또는 정확한 dependent subset을 unusable로 판정해야 한다.

### Durable Completion Boundary {#execution-durable-completion-boundary}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-acknowledged-completion-boundary 영속 확인된 work unit까지만 완료로 인정하고 불명확한 단위의 재작업 범위를 보고한다. -->

Work unit은 output bytes, integrity, required validation과 checkpoint inclusion이 같은 durable commit에 도달해야 completed가 된다. Crash가 commit 전후 어느 지점에서 나도 consumer는 이전 checkpoint 또는 새 checkpoint 중 하나만 인정하고, writing이나 outcome-unknown unit은 redo set에 포함해야 한다.

### Resume Eligibility {#execution-resume-eligibility}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-resume-eligibility Checkpoint와 현재 input, dependency, policy, artifact 및 compatibility가 일치한 범위만 재사용한다. -->

Resume evaluator는 current job contract와 checkpoint의 identity, plan, dependency, policy, compatibility, artifact integrity와 owner fencing을 비교하여 reusable, redo, quarantined와 incompatible sets를 출력한다. Resume attempt는 새 owner generation을 얻고 reusable set을 read-only로 소비하며 이전 attempt의 mutable state를 이어받지 않는다.

### Changed Input Restart {#execution-changed-input-restart}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-changed-input-restart 결과에 영향을 주는 입력이나 정책 변화가 기존 checkpoint를 같은 job의 resume로 가장하지 못하게 한다. -->

Current effective contract의 canonical identity가 checkpoint job identity와 다르면 resume을 거부한다. Dependency graph가 unaffected subset을 증명하면 새 derived job이 그 subset을 provenance와 함께 재사용할 수 있지만 parent checkpoint를 수정하거나 changed unit을 complete로 승격하지 않는다.

### Resumed Result Validation {#execution-resumed-result-validation}

<!-- @evidence requirements/operations-and-recovery/checkpoints-resume-and-retry.md#operations-resumed-result-validation Resume과 retry 결과에 clean execution과 같은 acceptance를 적용한다. -->

Resumed job은 final closure, deterministic comparison, domain validation와 publication precondition을 clean execution과 동일하게 통과해야 한다. Validation evidence는 reused and recomputed unit을 식별하고 checkpoint selection, unit ordering과 남은 temporary state가 최종 result나 diagnostic verdict를 바꾸지 않았음을 확인해야 한다.

### Cache Authority Boundary {#execution-cache-authority-boundary}

<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-cache-integrity-dependency-loss Cache를 authoritative truth가 아닌 재생성 가능한 acceleration으로 제한한다. -->
<!-- @evidence requirements/external-inputs/refresh-version-pinning-and-offline.md#external-cache-identity-trust External input cache도 source revision, closure, interpretation과 result digest로 검증하게 한다. -->

Cache lookup은 authoritative expected identity를 입력으로 받고 miss, valid hit, stale, corrupt, unavailable 또는 incompatible를 출력한다. Cache record 자체가 source, checkpoint, provenance나 validation을 대신하지 않으며 cache가 없거나 거부되어도 authoritative state는 바뀌지 않는다.

### Cache Identity와 Invalidation {#execution-cache-identity-invalidation}

<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-cache-identity-integrity Cache entry를 정확한 input, dependency, compatibility와 content integrity에 결속한다. -->
<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-stale-cache-invalidation Semantic policy와 dependency 변화가 관련 cache를 stale로 만든다. -->

Cache key는 canonical input, dependency closure, producer semantics와 compatibility profile을 포함하고 record는 output digest, complete marker와 validation facts를 가진다. Invalidation은 dependency relation으로 affected entries를 stale 처리하며 access time, path, filename과 prior hit는 validity를 연장하지 않는다.

### Corrupt Cache Quarantine {#execution-corrupt-cache-quarantine}

<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-corrupt-cache-isolation 손상 entry의 영향 범위와 consumer를 식별하고 동시 job에서 재사용되지 않게 한다. -->

Digest mismatch, incomplete closure, parser inconsistency 또는 same identity with different bytes를 발견하면 entry를 corrupt로 전이하고 active consumers와 derived artifacts를 추적해야 한다. Quarantine은 exact entry generation을 대상으로 하고 같은 key의 successor를 삭제하지 않으며 valid alternative entry와 authoritative input은 보존한다.

### Dependency Availability와 Loss {#execution-dependency-availability-loss}

<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-dependency-identity-availability Asset, tool, model, service와 policy의 identity 및 availability를 job에 결속한다. -->
<!-- @evidence requirements/operations-and-recovery/cache-integrity-and-dependency-loss.md#operations-dependency-loss-options Dependency 복구 불가 시 verified substitute, 제한적 채택 또는 중단을 명시적 선택으로 만든다. -->
<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-runtime-dependency-failure Dependency 장애, 철회, 권한과 quota 상실의 영향 범위를 blocked 또는 failed로 전달한다. -->

Dependency status는 pinned identity, required or optional role, availability, authorization, freshness, last verified time와 failure classification을 가진다. Required dependency loss는 dependent units를 blocked or failed로 만들고 independent completed units는 보존한다. Recovery decision은 verified substitute를 쓰는 새 job, 이미 complete인 artifact의 범위 제한 adoption 또는 작업 중단 가운데 가능한 선택과 compatibility impact를 출력하며 substitute를 기존 identity에 조용히 넣지 않는다.
