# Artifact와 원자적 Publication

## 독립 Artifact 상태 축 계약 {#execution-artifact-lifecycle-contract}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-partial-artifacts-publication 작성 중 bytes, candidate와 current를 구분하여 기존 정상 결과를 보호한다. -->
<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-artifact-state-ownership 완전성, 무결성과 validation을 서로 덮어쓰지 않는 artifact 출력으로 분리한다. -->
<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-artifact-completeness Absent, partial, complete, stale, corrupt와 quarantined를 손실 없는 독립 관측값으로 표현한다. -->
<!-- @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification 과거 결과의 compatibility를 materialization과 별개로 판정하게 한다. -->
<!-- @evidence requirements/diagnostics/external-input-and-security.md#diagnostics-quarantine-and-adoption Quarantine이 bytes 존재, 완전성 또는 과거 validation evidence를 덮어쓰지 않게 한다. -->

Artifact snapshot은 artifact identity, exact physical or remote generation, producer job and attempt, intended role과 expected closure에 결속된 다음 다섯 축을 모두 출력한다. 축 이름의 slash 양쪽 값도 별도 field이며 어느 축도 다른 축에서 추론하거나 하나의 lifecycle enum으로 압축하지 않는다.

| 축 | 필수 무손실 출력 |
| --- | --- |
| Materialization과 completeness | Materialization observation의 not-observed, in-progress, finished 또는 unknown, completeness의 absent, partial, complete 또는 unknown, expected, materialized, missing과 extra coverage |
| Integrity와 validation | Integrity의 unchecked, verified, mismatch 또는 unknown과 digest 및 readback evidence, validation의 not-run, in-progress, passed, failed 또는 unknown과 policy, checked scope 및 receipt |
| Freshness와 compatibility | Freshness의 not-evaluated, current, stale 또는 unknown과 비교한 expected input identity, compatibility의 not-evaluated, exact, compatible, incompatible 또는 unknown과 profile 및 판정 근거 |
| Publication selection과 generation | Unselected, candidate, current, superseded 또는 unknown selection, exact publication generation, expected current generation과 append-only selection history |
| Availability와 quarantine | Availability의 unknown, available, unavailable, missing 또는 deleted와 확인한 location generation, quarantine의 unknown, clear, quarantined 또는 released와 reason, policy, authority 및 event evidence |

모든 snapshot은 contract version과 observation identity를 가지며 모르는 값은 unknown으로 보존한다. 한 축의 새 관측은 다른 축의 값을 초기화하지 않고, 과거 materialization, integrity와 validation 성공 receipt는 이후 stale, incompatible, superseded, unavailable 또는 quarantined 관측과 함께 남는다. Domain validation verdict와 execution phase는 공통 artifact 축 밖의 별도 결과이며 current selection, path 존재와 prior success는 어느 축의 통과도 대신하지 않는다.

### Artifact Ownership과 Completeness {#execution-artifact-ownership-completeness}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-artifact-state-ownership Artifact의 producer, input, role, complete 또는 partial, integrity와 validation 상태를 추적한다. -->

Producer는 artifact를 만들기 전에 expected members, order or set semantics, media facts와 completion predicate를 선언해야 한다. Completeness는 inventory와 bytes coverage만으로 판정하고 integrity와 validation은 자기 evidence로 따로 판정하며, current publication은 모든 required 축의 predicate가 충족된 뒤에만 선택한다. 다른 attempt가 같은 identity를 주장하면 byte equality와 provenance가 확인되기 전까지 collision이다.

### Partial Artifact Isolation {#execution-partial-artifact-isolation}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-partial-artifact-isolation 작성이나 전송이 끝나지 않은 artifact를 current consumer로부터 격리한다. -->

In-progress materialization이나 partial completeness를 가진 artifact는 private candidate scope에서만 보이며 trusted member set, missing set, producer liveness와 resume or discard eligibility를 기록해야 한다. Consumer request가 partial use를 허용해도 그 scope와 forbidden downstream uses를 반환하고 publication selection을 current로 바꾸거나 complete manifest 또는 success evidence로 제공하지 않는다.

### Publication Preconditions {#execution-publication-preconditions}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-publication-preconditions Component closure, integrity, validation, expected revision과 authority를 current 전환 전에 확인한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-assembly Render product의 모든 chunk, frame, pass와 view closure를 publication 입력에서 확인한다. -->

Publication input은 candidate identity, exact artifact inventory, expected current generation, authoritative input revision, compatibility profile와 operator authority를 포함한다. Commit 직전에 completeness complete, integrity verified, required validation passed, freshness current, compatibility exact 또는 허용된 compatible, availability available, quarantine clear와 candidate selection을 같은 snapshot에서 재검증하고 하나라도 충족되지 않으면 publication selection과 generation을 변경하지 않는다.

### Atomic Current Commit {#execution-atomic-current-commit}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-atomic-current-transition Consumer가 old complete 또는 new complete만 관찰하는 원자적 current 전환을 요구한다. -->
<!-- @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-atomic-publication Half-written frame과 incomplete sequence가 current로 보이지 않는 render publication 경계를 일반화한다. -->

Multi-artifact publication은 immutable payload closure를 먼저 완성하고 하나의 versioned current reference를 compare-and-set으로 commit해야 한다. 성공한 commit은 publication selection과 generation만 새 관측으로 추가하고 materialization, integrity, validation, freshness, compatibility, availability와 quarantine evidence를 다시 쓰지 않는다. Reader는 current reference가 가리키는 exact closure를 검증하여 old generation 또는 new generation 중 하나만 소비하고, reference commit acknowledgement가 없으면 payload가 존재해도 candidate로 남긴다.

### Conflict와 Rollback {#execution-publication-conflict-rollback}

<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-publication-conflict-rollback Concurrent current 변경을 덮어쓰지 않고 rollback도 새 선택으로 기록한다. -->

Expected current generation mismatch는 publication conflict이며 winning generation, rejected candidate와 re-evaluation condition을 반환해야 한다. Rollback은 이전 immutable closure를 가리키는 새 publication generation과 selection event이고 intervening history나 대상 artifact의 과거 성공 evidence를 삭제하지 않으며, rollback 대상의 현재 completeness, integrity, validation, freshness, compatibility, availability, quarantine와 authority를 새 publication과 동일하게 검증한다.

### Publication Failure Outcome {#execution-publication-failure-outcome}

<!-- @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-atomic-output Process, probe와 digest를 통과하지 못한 encode bytes가 이전 성공 file로 오인되지 않게 한다. -->

Payload write, durable flush, integrity readback, validation, current commit 또는 acknowledgement 중 어느 단계가 실패했는지 구분하고 확인된 축만 갱신해야 한다. Current reference가 commit되었는지 알 수 없으면 publication selection과 acknowledgement outcome을 각각 unknown으로 기록하고 current generation을 다시 읽어 reconcile하며, automatic cleanup이나 retry로 다른 축의 evidence 또는 ambiguous candidate를 제거하지 않는다.
