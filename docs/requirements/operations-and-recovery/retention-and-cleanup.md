# Retention과 Cleanup

## Lifecycle별 보존 정책 {#operations-retention-cleanup}

Source, checkpoint, cache, partial artifact, candidate, current와 superseded artifact, receipt, diagnostic와 audit record는 각기 보존 기간, 삭제 조건, 복구 가능성과 책임자를 가져야 한다.

### Reference-aware Retention {#operations-reference-aware-retention}

Active job, resume 가능한 checkpoint, current publication, provenance, evidence, audit 또는 legal hold가 참조하는 artifact는 참조 관계와 의무가 끝나기 전에 cleanup하지 않아야 한다.

### Cleanup 대상 Preview {#operations-cleanup-target-preview}

Operator는 cleanup 전에 대상 identity, 분류, 크기, 마지막 사용, 참조 관계, 삭제 근거와 예상 회수량을 확인할 수 있어야 하며 범위가 불명확한 wildcard 삭제를 요구하지 않아야 한다.

Render cleanup preview는 current와 absent, verified stale, integrity failure, unsafe locator 또는 foreign generation, unavailable read와 observation conflict를 구분하고 각 exact target을 retain, remove, quarantine 또는 manual-adjudication 중 하나에 reason과 함께 배치해야 한다. Automatic apply는 captured generation에 대해 증명된 remove 또는 quarantine만 수행해야 한다.

### 동시 실행 보호 {#operations-cleanup-concurrency-safety}

Cleanup은 active writer, reader, transfer와 publication이 사용하는 대상을 건너뛰거나 안전하게 조정하고, liveness를 확인할 수 없으면 삭제보다 보존을 선택해야 한다.

Local process가 소유한 session, chunk, attempt와 temporary tree는 complete host·PID·process generation으로 식별하고, 같은 descriptor를 두 번 관찰하여 모두 absent임을 증명하기 전에는 reclaim하지 않아야 한다. PID가 점유되었거나 재사용되었을 수 있는 상태, 다른 host, malformed owner와 조회 오류는 cleanup 대상이 아니라 retained conflict다.

### 삭제 결과와 Tombstone {#operations-cleanup-deletion-record}

Cleanup 결과는 삭제, 실패, 보류와 이미 없음 상태를 구분하고 대상 identity, 권한, 시각, 정책과 오류를 기록하여 사라진 artifact를 정상 생성되지 않은 것으로 오해하지 않게 해야 한다.

### 민감 정보의 최소 보존 {#operations-sensitive-data-minimization}

Secret과 민감한 source는 필요한 최소 기간만 보존하고, 일반 artifact retention과 별도 정책을 적용하며, 삭제 뒤에도 secret 원문이 diagnostic, checkpoint 또는 backup에 남지 않아야 한다.

### Reclaim 실패의 가시성 {#operations-cleanup-failure-visibility}

Cleanup failure와 예상보다 적은 회수량은 운영 상태와 capacity forecast에 반영하고, 공간 부족을 감추기 위해 검증된 current artifact나 audit record를 자동 희생하지 않아야 한다.
