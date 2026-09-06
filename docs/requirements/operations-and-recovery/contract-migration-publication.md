# 생성 프로젝트 계약 Migration Publication

## Successor와 recovery {#operations-contract-migration-publication-boundary}

### 원자적 publication과 recovery {#operations-contract-migration-publication}

Apply는 successor files와 durable receipt를 검증 가능한 candidate로 먼저 만들고, 각 source와 target의 currentness를 다시 확인한 뒤 publish해야 한다. Receipt는 from/to generation, language, 이전 baseline identity, plan digest, action별 결과와 최종 validation을 보존한다.

이전 baseline과 rename source는 successor target과 receipt가 durable하게 확정되기 전까지 유일한 recovery point로 남아야 한다. Baseline pointer는 마지막에 교체하고 crash, competitor 또는 verification failure는 predecessor project bytes와 current baseline을 그대로 남겨야 한다.
