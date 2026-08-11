# 실행과 복구 시스템 계약

## 계약 범위 {#execution-recovery-contract-scope}

<!-- @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-scope-job-identity 긴 제작 작업을 하나의 추적 가능한 실행 경계로 만드는 시스템 계약을 정의한다. -->
<!-- @evidence requirements/product/charter.md#product-reproducible-judgment 같은 선언과 실행 조건이 같은 정규 결과를 만든다는 상위 결정성 약속을 실행 계층에 적용한다. -->

이 디렉터리는 오래 실행되는 제작 작업의 논리적 job, 개별 attempt, admission, 상태 전이, resource 제한, 중단, 재시도, checkpoint, publication, 장애 복구, 동시 소유권, 보존, 호환성과 운영 증거를 package와 독립된 시스템 경계로 정의한다. Frame, asset, diagnostic와 delivery의 도메인 의미는 각 주제 계약이 소유하고 이 계약은 그 결과를 안전하게 수행하고 보존하는 공통 lifecycle만 소유한다.

## 문서 지도 {#execution-recovery-document-map}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-event-correlation 분리된 실행 계약을 하나의 job lineage로 다시 연결할 수 있게 문서 경계를 제시한다. -->

- [Scope와 실행 Identity](./scope-and-execution-identities.md)
- [상태 기계와 Admission](./state-machine-and-admission.md)
- [Resource Budget와 Backpressure](./resource-budgets-and-backpressure.md)
- [Progress, Heartbeat와 관측](./progress-heartbeats-and-observation.md)
- [Cancellation, Timeout과 Preemption](./cancellation-timeout-and-preemption.md)
- [Retry, Backoff와 Idempotency](./retry-backoff-and-idempotency.md)
- [Checkpoint, Resume, Cache와 Dependency](./checkpoints-resume-cache-and-dependencies.md)
- [Artifact와 원자적 Publication](./artifacts-and-atomic-publication.md)
- [Failure Reconciliation과 Disaster Recovery](./failure-reconciliation-and-disaster-recovery.md)
- [Concurrent Ownership과 Locking](./concurrent-ownership-and-locking.md)
- [Retention, Cleanup과 Quarantine](./retention-cleanup-and-quarantine.md)
- [Portability, Migration과 Compatibility](./portability-migration-and-compatibility.md)
- [Operational Evidence와 Authority](./operational-evidence-and-authority.md)
