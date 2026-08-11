# 보존, 무효화와 폐기

## 수명주기가 명시된 기록 {#retention-explicit-lifecycle}

Source, intermediate artifact, evidence, review와 publication record는 종류별 보존 기간, 보존 이유, archive 조건, 접근 범위와 폐기 조건을 가져야 하며, 사용자는 현재 정책과 각 기록에 적용된 정책 version을 확인할 수 있어야 한다.

### 무효화와 삭제의 분리 {#retention-invalidation-versus-deletion}

Stale, superseded, revoked 또는 invalid 상태는 record가 더 이상 current 판정에 쓰이지 않는다는 뜻으로 보존 여부와 구분해야 하며, 상태 변경만으로 원기록을 삭제하거나 삭제된 record를 current evidence처럼 표시해서는 안 된다.

### Freshness 만료와 재검토 {#retention-freshness-expiry-and-review}

시간, source revision, dependency, policy, tool 또는 판단 기준 변화로 evidence의 freshness가 만료되면 영향받은 claim과 approval을 식별하고, 재검토 전에는 이전 결과의 범위와 상태를 명시해야 한다.

### 보존 hold와 예외 {#retention-hold-and-exception}

분쟁, 안전 조사, 계약 또는 법적 의무로 disposal을 중지하는 hold는 권한 있는 주체, 범위, 시작 시점, 근거와 해제 조건을 가져야 하며, hold가 적용되지 않은 data까지 무기한 보존하는 일반 허가로 쓰여서는 안 된다.

### 검증 가능한 폐기 {#retention-verifiable-disposal}

폐기는 승인 주체, 대상 identity와 copy 범위, 시점, 방법, 결과와 실패를 기록하고 cache, replica, archive, temporary upload와 외부 provider copy를 포함해야 하며, 사용자는 남은 사본이나 확인할 수 없는 remote disposal을 구분할 수 있어야 한다.

### Archive 회수와 복원 {#retention-archive-retrieval-and-restoration}

Archive에서 회수한 artifact와 record는 보관 전 identity와 무결성을 다시 확인하고 회수 또는 migration 활동을 새 이력으로 남겨야 하며, 손상되거나 dependency가 빠진 archive를 원래의 verified 상태로 자동 복원해서는 안 된다.
