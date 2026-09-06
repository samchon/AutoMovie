# 생성 프로젝트 계약 Migration Plan

## Baseline 사이의 판정 {#operations-contract-migration-plan-boundary}

### Deterministic plan과 conflict {#operations-contract-migration-plan}

Migration plan은 기록된 이전 baseline, 설치된 목표 baseline과 현재 project bytes의 exact identity에서 결정되어야 한다. 이전 bytes와 일치하는 target만 자동 add, write 또는 unambiguous rename할 수 있고, local modification, 제거된 anchor, rename ambiguity, target collision, missing source와 plan 뒤의 byte 변경은 stable conflict로 남겨야 한다.

Dry-run과 apply는 같은 canonical plan을 소비하고 check 결과가 실행 사이에 달라지면 새 plan 없이 계속하지 않아야 한다. 사용자가 쓴 prose를 덮어쓰거나 contract를 삭제하는 일반 remove 권한을 제공해서는 안 된다.
