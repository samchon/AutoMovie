# 생성 프로젝트 계약 Migration Plan

## Deterministic planning {#execution-contract-migration-plan-boundary}

### Planning and conflict classification {#execution-contract-migration-plan}

<!-- @evidence requirements/operations-and-recovery/contract-migration-plan.md#operations-contract-migration-plan dry-run과 apply가 공유하는 deterministic plan과 conflict taxonomy를 정밀화한다. -->

Planner 입력은 immutable from/to baseline과 current file map이다. 출력은 canonical-ordered add, write와 rename actions 및 missing-source, local-modification, removed-contract, removed-anchor, rename-ambiguity와 target-collision conflicts다. 모든 relative path는 project root 안의 normalized portable identity여야 하며 두 lexical form이 같은 target을 가리키면 입력 단계에서 실패한다.

Plan은 세 입력 population의 digest를 포함한다. Apply 직전 observed population이 하나라도 다르면 action을 실행하지 않고 currentness failure를 반환한다. Public action union에는 planner가 만들지 않거나 recovery contract가 정의하지 않은 remove variant를 두지 않는다.

Successor map의 `after: null` 항목은 관측한 current file이 있을 때에만 retirement change가 된다. 관측값, descriptor와 source가 모두 absent이고 successor도 absent이면 planner는 그 항목을 change population에서 제외한다. 이 absent-to-absent no-op은 missing-source conflict가 아니며 transaction prepare 단계에 전달되지 않는다.
