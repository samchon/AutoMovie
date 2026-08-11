# 부분 Artifact와 원자적 Publication

## Current 결과를 보호하는 Publication {#operations-partial-artifacts-publication}

작성 중인 bytes, 검증 전 candidate와 current artifact를 구분하고, 작업 실패나 중단이 이미 게시된 정상 결과를 손상시키지 않아야 한다.

### Artifact 상태와 소유권 {#operations-artifact-state-ownership}

각 artifact는 생성한 job과 attempt, input identity, intended role, complete 또는 partial 상태, integrity와 validation 상태를 가져야 하며 출처를 알 수 없는 결과를 채택하지 않아야 한다.

### Partial Artifact의 격리 {#operations-partial-artifact-isolation}

작성 중이거나 전송이 끝나지 않은 artifact는 current consumer에게 노출되지 않아야 하며, 재개 가능 여부와 폐기 가능 여부를 명시해야 한다.

### Publication 전제조건 {#operations-publication-preconditions}

요구된 모든 구성 요소, integrity, validation, expected current revision과 operator authority가 확인될 때만 candidate를 current로 publish해야 한다.

### 원자적 Current 전환 {#operations-atomic-current-transition}

Publication은 consumer가 이전의 완전한 version 또는 새로운 완전한 version 중 하나만 관찰하게 하고, 혼합 version이나 half-written result를 current로 노출하지 않아야 한다.

### 충돌과 Rollback {#operations-publication-conflict-rollback}

다른 작업이 current를 변경한 publication conflict는 조용히 덮어쓰지 않고 별도 결과로 남겨야 하며, rollback은 이전 artifact를 새 current 선택으로 기록하여 이력을 보존해야 한다.
