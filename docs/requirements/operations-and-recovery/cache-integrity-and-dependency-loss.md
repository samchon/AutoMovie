# Cache 무결성과 Dependency 상실

## Cache는 진실이 아닌 가속 수단 {#operations-cache-integrity-dependency-loss}

Cache가 비어 있거나 손상되거나 호환되지 않아도 authoritative state의 진실이 바뀌지 않아야 하며, 사용 가능한 authoritative input에서 다시 만들거나 정확한 blocking dependency를 보고해야 한다. Cache hit 자체를 결과의 provenance 또는 validation으로 사용하지 않아야 한다.

### Cache Identity와 Integrity {#operations-cache-identity-integrity}

Cache entry는 자신을 만든 정확한 input, dependency와 compatibility identity 및 content integrity에 결부되어야 하며, 하나라도 확인할 수 없으면 재사용하지 않아야 한다.

### Corrupt Cache의 격리 {#operations-corrupt-cache-isolation}

손상이 발견된 cache는 영향 범위와 consumer를 식별할 수 있게 격리하고, 같은 job과 다른 동시 job이 손상된 entry를 계속 성공 결과로 사용하지 않게 해야 한다.

### Stale Cache와 Invalidation {#operations-stale-cache-invalidation}

입력, semantic policy 또는 결과에 영향을 주는 dependency가 바뀌면 관련 cache를 stale로 판정하며, 단순히 최근에 사용되었거나 이름이 같다는 이유로 유효 상태를 연장하지 않아야 한다.

### Dependency Identity와 Availability {#operations-dependency-identity-availability}

Job은 결과에 필요한 asset, tool, model, service와 policy의 정확한 identity와 availability를 보고하여, 사라진 dependency와 달라진 dependency를 구분할 수 있어야 한다.

### Dependency 상실 뒤의 선택 {#operations-dependency-loss-options}

필수 dependency를 복구할 수 없으면 검증된 대체 dependency를 사용하는 새 job, 이미 완전한 artifact의 제한적 채택 또는 작업 중단 가운데 가능한 선택과 compatibility 영향을 명시해야 하며 조용한 대체를 하지 않아야 한다.
