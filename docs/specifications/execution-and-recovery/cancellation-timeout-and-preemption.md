# Cancellation, Timeout과 Preemption

## 중단 Control Protocol {#execution-interruption-control-protocol}

### Pause와 Cancel Semantics {#execution-pause-cancel-semantics}

<!-- @evidence requirements/operations-and-recovery/cancellation-and-interruption.md#operations-cancellation-interruption Pause와 cancel 요청 접수와 실제 중단 완료를 구분하는 control 경계를 정의한다. -->

Control request는 request identity, target job과 optional attempt, expected owner generation, mode, reason, authority, requested-at time와 optional deadline을 가진다. Control response는 accepted, already-satisfied, rejected 또는 conflict와 resulting state를 반환하며, accepted는 요청 접수이지 중단 완료가 아니다.

<!-- @evidence requirements/operations-and-recovery/cancellation-and-interruption.md#operations-pause-cancel-distinction 재개 가능한 pause와 남은 work를 포기하는 cancel의 후속 상태를 분리한다. -->

Pause가 accepted되면 running attempt는 pausing으로 전이하고 resume-compatible checkpoint가 durable해진 뒤 paused가 된다. Cancel은 queued attempt를 바로 cancelled로 닫고 running, pausing 또는 paused attempt를 cancelling으로 전이한 뒤 남은 unit을 not-run으로 확정하여 cancelled가 되며, cancelled job의 재실행은 resume이 아니라 policy가 허용한 새 attempt다.

### Safe Point Acknowledgement {#execution-safe-point-acknowledgement}

<!-- @evidence requirements/operations-and-recovery/cancellation-and-interruption.md#operations-safe-interruption-point 일관된 work와 artifact 경계에서만 중단 완료를 인정한다. -->

각 work unit은 interruptible boundary와 non-interruptible interval의 최대 길이를 plan에 선언해야 한다. Pausing 또는 cancelling 중에는 현재 unit, 다음 safe point, expected additional work와 control deadline을 관측할 수 있어야 하며 safe point에서 state, checkpoint와 resource release가 함께 acknowledged되기 전에는 paused 또는 cancelled를 출력하지 않는다.

### Cancelled Partial Result {#execution-cancelled-partial-result}

<!-- @evidence requirements/operations-and-recovery/cancellation-and-interruption.md#operations-cancelled-partial-results 중단 전 complete, resume 가능, partial과 미완료 범위를 분류한다. -->

Cancellation outcome은 verified complete set, checkpointed set, quarantined partial set, discarded set와 not-run set을 반환해야 한다. Independent complete artifact는 보존할 수 있지만 job completeness와 publication eligibility를 false로 유지하고, cancelled attempt의 unacknowledged side effect는 reconciliation queue에 남겨야 한다.

### Timeout Classification {#execution-timeout-classification}

<!-- @evidence requirements/operations-and-recovery/cancellation-and-interruption.md#operations-timeout-interruption Timeout과 policy 중단을 사용자 cancel과 다른 원인으로 기록한다. -->

Timeout과 automatic interruption은 queue deadline, execution duration, no-progress interval, dependency response, control acknowledgement, quota reclamation과 operational policy를 서로 다른 classification으로 가진다. Event는 configured limit 또는 policy, measured duration이나 last-progress age, affected scope, last durable checkpoint, partial artifact disposition과 resume or retry eligibility를 포함하고 wall-clock 변화가 deterministic output content에 참여하지 않게 해야 한다.

### Force Termination {#execution-force-termination}

<!-- @evidence requirements/operations-and-recovery/cancellation-and-interruption.md#operations-forced-termination 안전한 중단이 불가능할 때 별도 권한과 격리 경계를 요구한다. -->

Force termination은 safe control이 deadline을 넘었고 별도 authority가 확인된 경우에만 실행하며 target owner generation과 impact scope를 다시 확인해야 한다. 결과는 attempt를 failed 또는 abandoned로 만들고 마지막 durable checkpoint 이후의 artifact, lock과 external outcome을 unknown으로 분류하여 새 owner가 reconciliation하기 전까지 current 사용을 금지한다.

### Preemption과 Control Priority {#execution-preemption-control-priority}

<!-- @evidence requirements/operations-and-recovery/resource-budgets-and-backpressure.md#operations-preemption-resource-reclamation Resource 회수에 따른 중단을 일반 failure와 구분하고 checkpoint 및 손실 work를 보고한다. -->

사용자 cancel, safety shutdown, hard budget와 scheduling preemption이 동시에 오면 safety, explicit cancel, hard limit, pause 순으로 이유를 보존하되 하나의 terminal transition만 commit해야 한다. 먼저 도착한 request를 삭제하지 않고 superseded control event로 연결하여 어떤 authority와 condition이 실제 outcome을 결정했는지 남겨야 한다.
