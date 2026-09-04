# 생성 프로젝트 계약 Migration

## 기록된 계약 세대의 전이 {#operations-contract-migration}

### Baseline identity와 compatibility {#operations-contract-baseline-identity}

생성 프로젝트는 설치된 template contract의 exact generation, 선택한 제작 언어와 각 governed target의 canonical path, anchor 및 byte digest를 tracked baseline으로 보존해야 한다. Version range, 현재 package의 추정값 또는 무시되는 cache 파일은 세대 identity가 될 수 없다.

Reader는 baseline의 protocol, language, path와 digest를 strict하게 검증하고 unknown generation, project 밖 경로, duplicate path와 현재 선택 언어의 inventory 불일치를 compatible로 추정하지 않아야 한다.

### Deterministic plan과 conflict {#operations-contract-migration-plan}

Migration plan은 기록된 이전 baseline, 설치된 목표 baseline과 현재 project bytes의 exact identity에서 결정되어야 한다. 이전 bytes와 일치하는 target만 자동 add, write 또는 unambiguous rename할 수 있고, local modification, 제거된 anchor, rename ambiguity, target collision, missing source와 plan 뒤의 byte 변경은 stable conflict로 남겨야 한다.

Dry-run과 apply는 같은 canonical plan을 소비하고 check 결과가 실행 사이에 달라지면 새 plan 없이 계속하지 않아야 한다. 사용자가 쓴 prose를 덮어쓰거나 contract를 삭제하는 일반 remove 권한을 제공해서는 안 된다.

### 원자적 publication과 recovery {#operations-contract-migration-publication}

Apply는 successor files와 durable receipt를 검증 가능한 candidate로 먼저 만들고, 각 source와 target의 currentness를 다시 확인한 뒤 publish해야 한다. Receipt는 from/to generation, language, 이전 baseline identity, plan digest, action별 결과와 최종 validation을 보존한다.

이전 baseline과 rename source는 successor target과 receipt가 durable하게 확정되기 전까지 유일한 recovery point로 남아야 한다. Baseline pointer는 마지막에 교체하고 crash, competitor 또는 verification failure는 predecessor project bytes와 current baseline을 그대로 남겨야 한다.
