# Artifact와 원자적 Publication

## Artifact Lifecycle Contract {#execution-artifact-lifecycle-contract}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-partial-artifacts-publication 작성 중 bytes, candidate와 current를 구분하여 기존 정상 결과를 보호한다. -->

Artifact record는 planned, writing, partial, complete, validated, candidate, current, superseded, quarantined 또는 deleted state를 가진다. State는 artifact identity와 exact physical or remote generation, producer job and attempt, role, expected closure, content digest, validation receipt와 publication generation에 결속되고 path 존재만으로 승격되지 않는다.

### Artifact Ownership과 Completeness {#execution-artifact-ownership-completeness}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-artifact-state-ownership Artifact의 producer, input, role, complete 또는 partial, integrity와 validation 상태를 추적한다. -->

Producer는 artifact를 만들기 전에 expected members, order or set semantics, media facts와 completion predicate를 선언해야 한다. Complete transition은 inventory와 bytes가 closure를 정확히 만족하고 integrity를 통과할 때만 허용하며, 다른 attempt가 같은 identity를 주장하면 byte equality와 provenance가 확인되기 전까지 collision이다.

### Partial Artifact Isolation {#execution-partial-artifact-isolation}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-partial-artifact-isolation 작성이나 전송이 끝나지 않은 artifact를 current consumer로부터 격리한다. -->

Writing과 partial artifact는 private candidate scope에서만 보이며 trusted member set, missing set, producer liveness와 resume or discard eligibility를 기록해야 한다. Consumer request가 partial use를 허용해도 그 scope와 forbidden downstream uses를 반환하고 current alias, complete manifest 또는 success evidence로 제공하지 않는다.

### Publication Preconditions {#execution-publication-preconditions}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-publication-preconditions Component closure, integrity, validation, expected revision과 authority를 current 전환 전에 확인한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-assembly Render product의 모든 chunk, frame, pass와 view closure를 publication 입력에서 확인한다. -->

Publication input은 candidate identity, exact artifact inventory, validation receipts, expected current generation, authoritative input revision, compatibility profile와 operator authority를 포함한다. Commit 직전에 모든 precondition을 같은 snapshot에서 재검증하고 하나라도 stale, missing, unknown 또는 conflicting이면 current state를 변경하지 않는다.

### Atomic Current Commit {#execution-atomic-current-commit}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-atomic-current-transition Consumer가 old complete 또는 new complete만 관찰하는 원자적 current 전환을 요구한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-atomic-publication Half-written frame과 incomplete sequence가 current로 보이지 않는 render publication 경계를 일반화한다. -->

Multi-artifact publication은 immutable payload closure를 먼저 완성하고 하나의 versioned current reference를 compare-and-set으로 commit해야 한다. Reader는 current reference가 가리키는 exact closure를 검증하여 old generation 또는 new generation 중 하나만 소비하고, reference commit acknowledgement가 없으면 payload가 존재해도 candidate로 남긴다.

### Conflict와 Rollback {#execution-publication-conflict-rollback}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-publication-conflict-rollback Concurrent current 변경을 덮어쓰지 않고 rollback도 새 선택으로 기록한다. -->

Expected current generation mismatch는 publication conflict이며 winning generation, rejected candidate와 re-evaluation condition을 반환해야 한다. Rollback은 이전 immutable closure를 가리키는 새 publication generation이고 intervening history를 삭제하지 않으며, rollback 대상의 integrity, compatibility와 authority를 새 publication과 동일하게 검증한다.

### Publication Failure Outcome {#execution-publication-failure-outcome}

<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-atomic-output Process, probe와 digest를 통과하지 못한 encode bytes가 이전 성공 file로 오인되지 않게 한다. -->

Payload write, durable flush, integrity readback, validation, current commit 또는 acknowledgement 중 어느 단계가 실패했는지 구분해야 한다. Current reference가 commit되었는지 알 수 없으면 outcome unknown으로 기록하고 current generation을 다시 읽어 reconcile하며, automatic cleanup이나 retry로 ambiguous candidate를 제거하지 않는다.
