# 운영과 복구 요구사항

운영과 복구는 긴 제작 작업이 중단, 재시도, 동시 실행과 기반 시설 장애를 겪어도 완료된 작업의 진실과 현재 산출물을 보존하게 한다. 작업의 진행과 권한 행사는 관찰 가능해야 하며, 불완전하거나 출처가 불명확한 결과를 성공 또는 현재 결과로 승격하지 않아야 한다.

- [범위, Job Identity와 상태](./scope-job-identity-and-state.md)
- [Checkpoint, Resume와 Retry](./checkpoints-resume-and-retry.md)
- [취소와 중단](./cancellation-and-interruption.md)
- [Idempotency와 외부 Side Effect](./idempotency-and-side-effects.md)
- [부분 Artifact와 원자적 Publication](./partial-artifacts-and-publication.md)
- [실패 분류와 복구](./failure-modes-and-recovery.md)
- [Cache 무결성과 Dependency 상실](./cache-integrity-and-dependency-loss.md)
- [Resource Budget와 Backpressure](./resource-budgets-and-backpressure.md)
- [동시 실행과 Locking](./concurrent-runs-and-locking.md)
- [관측 가능성과 비밀 보호](./observability-and-secret-protection.md)
- [Retention과 Cleanup](./retention-and-cleanup.md)
- [Migration과 Compatibility](./migration-and-compatibility.md)
- [Disaster Recovery](./disaster-recovery.md)
- [Audit와 Operator Authority](./audit-and-operator-authority.md)
