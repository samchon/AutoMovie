# Migration과 Compatibility

## 장기 작업 상태의 진화 {#operations-migration-compatibility}

Job, checkpoint, artifact, receipt, policy와 audit record는 자신을 해석하는 contract version과 semantic identity를 가져야 하며 제작 환경이 바뀐 뒤에도 읽기 가능 여부와 안전한 사용 범위를 판단할 수 있어야 한다.

### Resume Compatibility 분류 {#operations-resume-compatibility-classification}

이전 checkpoint는 exact compatible, 검증된 migration 필요 또는 incompatible로 분류하고, unknown version이나 의미가 달라진 상태를 같은 job의 resume로 추정하지 않아야 한다.

### 비파괴 Migration {#operations-nondestructive-migration}

Migration은 원래 durable record와 provenance를 보존하고 새 record가 어느 version과 변환 판단에서 파생되었는지 남겨야 하며, 성공 검증 전에 유일한 recovery point를 덮어쓰지 않아야 한다.

생성 프로젝트의 scaffold contract를 갱신할 때에는 기록된 이전 baseline, 설치된 목표 baseline과 현재 project bytes로 하나의 deterministic plan을 만들고 dry-run과 apply가 같은 plan을 소비해야 한다. Baseline과 일치하는 byte만 자동 교체하며 authored edit, 제거된 anchor, 모호한 rename과 이미 점유된 target은 충돌로 남겨야 한다.

### 결과 의미의 변화 {#operations-semantic-change-new-identity}

같은 입력이라도 결과를 바꾸는 default, validation, dependency 또는 deterministic semantics의 변화는 새 job identity와 compatibility boundary를 만들고 이전 결과와 byte-equivalent라고 주장하지 않아야 한다.

### Mixed-version 동시 실행 {#operations-mixed-version-concurrency}

서로 다른 version의 active job이 같은 production을 다룰 때 각자의 읽기와 쓰기 compatibility를 확인하고, 오래된 writer가 새 version의 current state나 record를 축소 또는 손상시키지 못해야 한다.

### Downgrade와 Rollback {#operations-downgrade-rollback-compatibility}

이전 환경으로 돌아갈 때 읽지 못하는 state, 잃게 되는 field, 재개 불가능한 job과 다시 만들어야 하는 artifact를 사전에 보고하고 silent downgrade를 하지 않아야 한다.

### Migration 검증 {#operations-migration-validation}

Migration 뒤에는 job lineage, 완료 범위, integrity, publication pointer와 audit continuity가 보존되었는지 확인하고, 일부 record만 변환된 상태를 전체 migration 성공으로 표시하지 않아야 한다.
