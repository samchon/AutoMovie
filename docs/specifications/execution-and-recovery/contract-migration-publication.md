# 생성 프로젝트 계약 Migration Publication

## Durable successor {#execution-contract-migration-publication-boundary}

### Publication and receipt {#execution-contract-migration-publication}

<!-- @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication successor validation, receipt와 predecessor 보존 순서를 정밀화한다. -->

Publisher는 parent identity를 고정한 candidate tree에 successor bytes와 append-only receipt를 작성하고 모든 digest와 target-form validation이 성공한 뒤 current target을 교체한다. Rename source는 published target의 byte identity를 재개방한 뒤에만 retire하고 predecessor baseline은 receipt와 successor baseline이 durable해질 때까지 보존한다.

Receipt는 protocol, from/to baseline identity, selected language, plan digest, observed input digest, action별 before/after identity, validation 결과와 publication generation을 기록한다. Successor baseline은 마지막 atomic pointer이며 실패한 attempt는 current pointer를 바꾸지 않고 재시도나 수동 adjudication에 필요한 predecessor와 diagnostic을 남긴다.
