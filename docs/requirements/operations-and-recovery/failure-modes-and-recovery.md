# 실패 분류와 복구

## 실패 뒤에도 보존되는 작업 진실 {#operations-failure-modes-recovery}

장애는 영향받은 job, attempt, 작업 단위, artifact와 side effect의 상태를 남겨야 하며, 원인을 알 수 없다는 사실을 성공이나 단순 미실행으로 바꾸지 않아야 한다.

### Process Crash와 Power Loss {#operations-process-crash-power-loss}

Process crash, host loss와 power failure 뒤에는 마지막으로 영속 확인된 recovery point까지 완료로 인정하고, 당시 실행 중이던 작업 단위는 결과를 검증하기 전까지 outcome unknown으로 취급해야 한다.

### Network와 Storage Failure {#operations-network-storage-failure}

Network 단절, timeout, 짧은 write와 storage acknowledgement 유실은 durable completion으로 보고하지 않아야 하며, 이미 전송되었을 수 있는 결과를 확인한 뒤 안전한 재전송 또는 재수행 여부를 결정할 수 있어야 한다.

### Dependency Failure {#operations-runtime-dependency-failure}

필수 dependency의 장애, 철회, 권한 상실과 quota 고갈은 정확한 dependency와 영향 범위를 가진 blocked 또는 failed 상태로 나타내고, 무관하게 완료된 작업을 보존해야 한다.

### 실패 격리 {#operations-failure-isolation}

한 작업 단위나 선택적 product의 실패가 독립된 성공 결과를 훼손하지 않아야 하며, 전체 job의 성공 조건을 충족하지 못했다면 남은 결과가 존재하더라도 job을 성공으로 표시하지 않아야 한다.

### Recovery 선택의 근거 {#operations-recovery-decision-basis}

Resume, retry, restart, rollback, adopt와 abandon 가운데 선택한 복구 동작은 실패 분류, 확인된 상태, 재작업 범위와 예상되는 side effect를 근거로 기록되어야 한다.

### 반복 실패의 정지 {#operations-repeated-failure-stop}

같은 원인이 반복되거나 recovery가 진전 없이 순환하면 자동 retry를 멈추고 operator가 확인할 수 있는 terminal 또는 blocked state, 누적 attempt와 다음 가능한 조치를 제시해야 한다.
