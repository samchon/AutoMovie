# 생성 프로젝트 계약 Migration

## Baseline에서 successor로의 전이 {#execution-contract-migration}

### Baseline record {#execution-contract-baseline-identity}

<!-- @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity exact generation과 governed target identity를 portable record로 보존한다. -->

Baseline record는 protocol, exact template contract generation, selected production language와 정렬된 `{ path, digest, H2 identities }` 집합을 가진다. JSON reader는 duplicate member, unknown required field, invalid path, noncanonical ordering과 declared inventory 밖 entry를 거부한다. Governed text의 newline identity는 checkout policy 또는 명시적인 canonicalization으로 고정하고 원래 authored bytes와 혼동하지 않는다.

### Planning and conflict classification {#execution-contract-migration-plan}

<!-- @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan dry-run과 apply가 공유하는 deterministic plan과 conflict taxonomy를 정밀화한다. -->

Planner 입력은 immutable from/to baseline과 current file map이다. 출력은 canonical-ordered add, write와 rename actions 및 missing-source, local-modification, removed-contract, removed-anchor, rename-ambiguity와 target-collision conflicts다. 모든 relative path는 project root 안의 normalized portable identity여야 하며 두 lexical form이 같은 target을 가리키면 입력 단계에서 실패한다.

Plan은 세 입력 population의 digest를 포함한다. Apply 직전 observed population이 하나라도 다르면 action을 실행하지 않고 currentness failure를 반환한다. Public action union에는 planner가 만들지 않거나 recovery contract가 정의하지 않은 remove variant를 두지 않는다.

### Publication and receipt {#execution-contract-migration-publication}

<!-- @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-publication successor validation, receipt와 predecessor 보존 순서를 정밀화한다. -->

Publisher는 parent identity를 고정한 candidate tree에 successor bytes와 append-only receipt를 작성하고 모든 digest와 target-form validation이 성공한 뒤 current target을 교체한다. Rename source는 published target의 byte identity를 재개방한 뒤에만 retire하고 predecessor baseline은 receipt와 successor baseline이 durable해질 때까지 보존한다.

Receipt는 protocol, from/to baseline identity, selected language, plan digest, observed input digest, action별 before/after identity, validation 결과와 publication generation을 기록한다. Successor baseline은 마지막 atomic pointer이며 실패한 attempt는 current pointer를 바꾸지 않고 재시도나 수동 adjudication에 필요한 predecessor와 diagnostic을 남긴다.
