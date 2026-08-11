# Resource Budget와 Backpressure

## 시작 전부터 보이는 운영 한계 {#operations-resource-budgets-backpressure}

긴 작업은 computation, accelerator, memory, storage, network, wall-clock duration, external quota, 비용과 concurrency의 적용 한계를 시작 전에 알 수 있어야 하며, 실행 중 실제 소비와 남은 허용량을 추적해야 한다.

### Admission과 예상 비용 {#operations-budget-admission-estimate}

작업을 받아들이기 전에 예상 peak와 total consumption, 필요한 여유 공간, 제한을 초과할 가능성과 추정 불확실성을 제시하고 시작, 대기 또는 거부 상태를 구분해야 한다.

### Runtime Budget Enforcement {#operations-runtime-budget-enforcement}

실제 소비가 warning 또는 hard limit에 도달하면 affected resource, 현재 값, limit와 남은 안전 동작을 보고하고, frame drop, 품질 저하, pass 생략 또는 입력 축소로 몰래 통과시키지 않아야 한다.

### Backpressure {#operations-backpressure}

Consumer, storage 또는 외부 dependency가 처리할 수 없는 속도로 밀릴 때 새 작업을 무제한 수락하지 않고 생산 속도, queue와 동시 실행을 제한하여 완료된 결과와 host 안정성을 보호해야 한다.

### Priority와 Fairness {#operations-priority-fairness}

Priority, deadline, 예약 capacity와 operator override가 scheduling에 미치는 영향을 볼 수 있어야 하며, 낮은 priority job이 무기한 굶거나 높은 priority 표시만으로 이미 게시 중인 결과의 안전 경계를 침범하지 않아야 한다.

### Preemption과 Resource 회수 {#operations-preemption-resource-reclamation}

Resource를 회수하기 위해 작업을 pause, cancel 또는 preempt하면 마지막 안전 checkpoint, 손실되는 work, partial artifact와 재개 조건을 보고하고 일반 실패와 구분해야 한다.

### Budget별 결과 Accounting {#operations-budget-result-accounting}

성공, 실패, retry, cache reuse와 cancelled attempt가 소비한 resource와 외부 비용을 job 계보에 귀속하여 같은 work의 중복 비용과 recovery 비용을 구분할 수 있어야 한다.
