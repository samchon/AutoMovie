# Idempotency와 외부 Side Effect

## 반복 요청의 안정된 결과 {#operations-idempotency-side-effects}

같은 identity의 작업 요청이 중복 제출되거나 응답 유실 뒤 반복되어도 완료 상태, 현재 artifact와 외부 side effect가 의도한 횟수를 넘어 늘어나지 않아야 한다.

### 중복 제출 {#operations-duplicate-submission}

동시에 또는 시간 차를 두고 들어온 같은 작업을 기존 실행과 연결하거나 명시적으로 거부하고, 별개의 성공처럼 중복 집계하지 않아야 한다.

### 결정적 결과의 재사용 {#operations-idempotent-deterministic-results}

검증된 input identity와 output identity가 정확히 일치할 때만 이전 결과를 재사용하고, 파일명, 위치, 수정 시각이나 성공 표지만으로 동일성을 추정하지 않아야 한다.

### 외부 요청의 Outcome {#operations-external-side-effect-outcome}

업로드, 원격 생성, 과금, notification과 publication 같은 외부 side effect는 요청 identity, provider outcome과 receipt를 추적하여 성공 여부가 불명확한 상태에서 곧바로 반복하지 않아야 한다.

### Exactly-once 주장 경계 {#operations-exactly-once-claim-boundary}

외부 대상이 중복 방지를 보장하지 않는 경우 exactly-once라고 주장하지 않고 possible, confirmed, failed, compensated와 unknown outcome을 구분해야 한다.

### 보상과 Reconciliation {#operations-compensation-reconciliation}

중복 또는 부분 완료된 side effect를 되돌리거나 채택할 때는 원래 작업과 연결된 보상 또는 reconciliation 기록을 남기고, 실패 기록을 삭제하여 정상 실행처럼 보이게 하지 않아야 한다.
