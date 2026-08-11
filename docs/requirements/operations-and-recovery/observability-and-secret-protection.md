# 관측 가능성과 비밀 보호

## 결과를 바꾸지 않는 운영 관측 {#operations-observability-secret-protection}

Operator는 job identity, 상태, progress, resource consumption, failure, recovery point와 publication 상태를 조회할 수 있어야 하며, 관측의 활성화 여부가 결정적 결과를 바꾸지 않아야 한다.

### Progress와 Remaining Work {#operations-progress-remaining-work}

Progress는 완료가 검증된 작업 단위와 전체 planned work를 기준으로 표시하고, 처리량, 남은 시간과 completion estimate가 추정일 때 그 불확실성과 마지막 갱신 시점을 보여야 한다.

### Event와 Correlation {#operations-event-correlation}

상태 전이, attempt, checkpoint, retry, cancel, lock, budget event, artifact와 publication을 job lineage로 연결하여 한 장애의 원인과 결과를 시간 순서대로 재구성할 수 있어야 한다.

### Failure Diagnostic {#operations-failure-diagnostic}

실패 보고는 사용자나 operator가 구분할 수 있는 원인, affected scope, retry 가능성, 마지막 안전 상태와 다음 허용 동작을 포함하고, 단일 일반 오류로 서로 다른 복구 조건을 숨기지 않아야 한다.

### Secret Redaction {#operations-secret-redaction}

Credential, token, private key, signed location, private environment value와 보호된 source content를 log, metric, progress, error, receipt와 audit record에 평문으로 남기지 않아야 한다.

### 최소 공개와 접근 통제 {#operations-observability-access-control}

관측 정보는 역할에 필요한 production과 세부 정보만 공개하고, secret의 존재나 identifier가 필요한 경우에도 원문 대신 제한된 참조와 사용 결과만 보여야 한다.

### 관측 정보의 Retention {#operations-observability-retention}

상세 diagnostic과 aggregate metric의 보존 기간, 접근 범위와 삭제 조건을 구분하고, 운영 편의를 이유로 source 또는 credential을 영구 보존하지 않아야 한다.
