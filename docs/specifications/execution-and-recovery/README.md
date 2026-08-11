# 실행과 복구 시스템 계약

<!-- @evidence requirements/operations-and-recovery/README.md#운영과-복구-요구사항 장기 실행의 상태, 재시도, 복구와 운영 관찰 약속을 시스템 계약으로 정밀화한다. -->

## 계약 범위 {#execution-recovery-contract-scope}


이 디렉터리는 오래 실행되는 제작 작업의 논리적 job, 개별 attempt, admission, 상태 전이, resource 제한, 중단, 재시도, checkpoint, publication, 장애 복구, 동시 소유권, 보존, 호환성과 운영 증거를 package와 독립된 시스템 경계로 정의한다. Frame, asset, diagnostic와 delivery의 도메인 의미는 각 주제 계약이 소유하고 이 계약은 그 결과를 안전하게 수행하고 보존하는 공통 lifecycle만 소유한다.

## 문서 지도 {#execution-recovery-document-map}


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
