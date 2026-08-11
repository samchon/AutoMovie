# Checkpoint, Resume와 Retry

## 검증 가능한 Recovery Point {#operations-checkpoints-resume-retry}

긴 작업은 어느 지점까지 일관되게 완료되었는지 나타내는 checkpoint와 최대 재작업 범위를 제공하여 process가 사라져도 특정 session의 기억 없이 안전하게 이어갈 수 있어야 한다.

### Checkpoint의 완결성 {#operations-checkpoint-completeness}

Checkpoint는 job과 input identity, 완료된 작업 단위, 아직 완료되지 않은 범위, 필요한 상태, 연결된 artifact와 receipt, compatibility identity 및 무결성 확인을 함께 가져야 한다.

### 인정된 완료 경계 {#operations-acknowledged-completion-boundary}

완료가 영속적으로 확인된 작업 단위까지만 recovery point로 주장하고, 작성 중이거나 완료 여부가 불명확한 단위는 재개 시 다시 수행될 수 있음을 보고해야 한다.

### Resume 적격성 {#operations-resume-eligibility}

Resume 전에 checkpoint와 현재 입력, dependency, 정책, 산출물 및 compatibility를 비교하고, 일치가 입증된 완료 범위만 재사용해야 한다.

### Retry의 계보와 한계 {#operations-retry-lineage-and-limits}

Retry는 같은 job에 속한 새 attempt로 기록하고 원래 실패, retry 사유, 횟수, 지연과 중단 조건을 보존해야 하며 영구 실패를 무한 반복하지 않아야 한다.

### 변경된 입력의 재시작 {#operations-changed-input-restart}

결과에 영향을 주는 입력이나 정책이 바뀌면 기존 checkpoint를 같은 작업의 resume로 취급하지 않고 새 job 또는 명시된 파생 작업으로 시작하며 이전 작업과의 관계를 남겨야 한다.

### Recovery 결과 검증 {#operations-resumed-result-validation}

재개하거나 retry한 결과는 처음부터 수행한 같은 작업과 동일한 acceptance를 통과해야 하며, checkpoint 사용 자체를 결과 정확성의 증거로 간주하지 않아야 한다.
