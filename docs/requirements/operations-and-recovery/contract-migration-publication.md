# 생성 프로젝트 계약 Migration Publication

## Successor와 recovery {#operations-contract-migration-publication-boundary}

### 세대에 결속된 publication과 recovery {#operations-contract-migration-publication}

Apply는 successor files와 durable receipt를 검증 가능한 candidate로 먼저 만들고, 각 source와 target의 currentness를 다시 확인한 뒤 publish해야 한다. Receipt는 from/to generation, language, 이전 baseline identity, plan digest, action별 결과와 최종 validation을 보존한다.

이전 baseline과 rename source의 정확한 bytes와 identity는 successor target과 receipt가 durable하게 확정되기 전까지 복구 근거로 보존해야 한다. Baseline은 마지막에 활성화하고 crash, competitor 또는 verification failure에서도 원래 project bytes와 baseline을 잃거나 경쟁 generation을 덮어써서는 안 된다. 개별 current pathname이 보존 slot으로 이동한 중간 상태는 명시적 pending으로 식별하여 완료로 소비하지 않아야 하며, 복구는 보존된 정확한 predecessor에 결속되어야 한다. 여러 flat file의 변경을 전체 트리의 atomic 교체나 모든 pathname의 연속 존재로 주장해서는 안 된다.
