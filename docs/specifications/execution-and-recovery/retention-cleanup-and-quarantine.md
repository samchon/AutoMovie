# Retention, Cleanup과 Quarantine

## Lifecycle Retention Contract {#execution-retention-contract}

### Retention Classes {#execution-retention-classes}


Retention policy는 artifact class, scope, minimum and maximum duration, expiry basis, required references, legal or audit hold, responsible role, deletion authority와 recoverability class를 가진다. Record와 payload는 자신에게 적용된 policy version과 evaluated expiry를 보존하고 다른 class의 짧은 policy를 상속하지 않는다.

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-retention-cleanup 서로 다른 lifecycle 대상의 보존 기간, 삭제 조건, 복구 가능성과 책임자를 구분한다. -->

Authoritative source, current artifact, publication reference, resumable checkpoint, cache, partial artifact, candidate artifact, superseded artifact, side-effect receipt, diagnostic, audit와 backup은 별도 class다. 각 class는 reproducible, recoverable from backup 또는 irreversible 중 하나를 선언하고 irreversible deletion 대상은 preview와 explicit authority 없이 cleanup set에 들어갈 수 없다.

### Reference-aware Retention {#execution-reference-aware-retention}

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-reference-aware-retention Active job, checkpoint, current publication, provenance, evidence, audit와 hold가 참조하는 artifact를 보호한다. -->

Reference graph는 referrer identity, target generation, relation kind, created event와 release condition을 가진다. Cleanup eligibility는 graph의 transitive protected closure를 계산하고 unknown or unreadable reference를 삭제 허가로 해석하지 않으며, stale reference도 owner policy가 확정하기 전에는 보존한다.

### Cleanup Plan과 Preview {#execution-cleanup-plan-preview}

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-target-preview 삭제 전에 identity, class, 크기, 사용, 참조, 근거와 예상 회수량을 확인하게 한다. -->

Cleanup은 inventory snapshot과 policy identity를 입력으로 받아 remove, retain, quarantine와 manual-adjudication sets를 가진 immutable plan을 출력해야 한다. 각 candidate는 exact generation, bytes, last verified use, expiry, reference decision, deletion reversibility와 reason을 포함하고 unresolved path pattern이나 wildcard만으로 target을 표현하지 않는다.

Render artifact 판정은 readable known-obsolete generation만 exact remove에 넣는다. Current와 absent는 retain하고, integrity-failed generation은 exact captured quarantine authority가 있을 때만 quarantine하며, unsafe locator, foreign generation, unavailable read, changed-during-read와 conflicting reference는 manual-adjudication에 남긴다. Aggregate manifest가 참조하는 invalid proxy와 current 이름을 가진 invalid bundle은 pathname만으로 current 또는 stale가 되지 않는다.

### Concurrent Cleanup Safety {#execution-cleanup-concurrency-safety}

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-concurrency-safety Active writer, reader, transfer와 publication이 쓰는 대상을 cleanup하지 않는다. -->

Apply는 cleanup plan의 inventory generation, active ownership, reference graph와 target identity를 다시 확인해야 한다. Active or ambiguous use가 있거나 target이 successor generation으로 바뀌면 해당 candidate를 skipped-conflict로 남기고 sibling candidate에 대한 판단을 재사용하지 않는다.

Render session, GC guard, chunk claim, running attempt와 worker temporary tree는 versioned record에 complete host·PID·process generation을 저장한다. Reclaim은 같은 validated owner에 대한 두 independent `absent` observations와 그 사이 exact target recapture가 모두 일치할 때만 가능하며, occupied-or-reused, same-owner, elsewhere, malformed 또는 query-unavailable state는 candidate를 보존하고 apply를 fail closed한다.

### Deletion Outcome과 Tombstone {#execution-deletion-outcome-tombstone}

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-deletion-record 삭제, 실패, 보류와 already-absent를 구분하고 대상과 권한을 기록한다. -->

Deletion outcome은 deleted, quarantined, retained, skipped-conflict, already-absent 또는 failed와 exact target generation, bytes reclaimed, actor, authority, policy, event time와 error identity를 가진다. Tombstone은 former identity와 deletion outcome을 보존하되 payload를 재구성할 민감 data를 포함하지 않는다.

### Sensitive Data Minimization {#execution-sensitive-retention-minimization}

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-sensitive-data-minimization Secret과 민감 source를 필요한 최소 기간만 보존하고 일반 artifact와 별도 정책을 적용한다. -->

Sensitive class는 collection purpose, allowed locations, encryption identity, access scope, maximum retention과 purge coverage를 명시해야 한다. Purge는 primary payload, cache, checkpoint, diagnostic와 backup retention relation을 평가하고 secret 원문이 tombstone, audit 또는 aggregate에 복사되지 않았음을 확인해야 한다.

### Cleanup Failure와 Capacity {#execution-cleanup-failure-capacity}

<!-- @evidence requirements/operations-and-recovery/retention-and-cleanup.md#operations-cleanup-failure-visibility Cleanup 실패와 예상보다 적은 회수량을 capacity forecast에 반영한다. -->

Apply result는 planned and actual reclaimed bytes, failure set, retained conflicts와 post-cleanup capacity를 출력해야 한다. Reclaim shortfall이 admission safety margin을 침범하면 새 job을 blocked로 만들고 current artifact, active checkpoint와 audit record를 emergency cleanup 대상으로 자동 승격하지 않는다.

### Quarantine Boundary {#execution-cleanup-quarantine-boundary}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-retention 부분 산출물을 복구 증거로 보존하거나 정책에 따라 격리 및 폐기한 결과를 추적한다. -->

Quarantine은 untrusted or ambiguous generation을 current consumer와 automatic reuse에서 분리하는 state이며 original identity, captured generation, reason, preserved evidence와 adjudication authority를 가진다. Quarantine move or marker가 실패하면 original target을 deleted로 보고하지 않고 manual-adjudication set에 남긴다.
