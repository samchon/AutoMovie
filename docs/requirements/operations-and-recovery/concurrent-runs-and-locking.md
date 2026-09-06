# 동시 실행과 Locking

## 병렬 작업 사이의 소유권 {#operations-concurrent-runs-locking}

같거나 겹치는 production 범위를 다루는 여러 job은 자신의 작업 공간, checkpoint와 candidate artifact를 분리하고 공유되는 current state를 명시된 소유권 조건 아래에서만 변경해야 한다.

### 동일 Job의 중복 실행 {#operations-duplicate-job-concurrency}

같은 job identity가 동시에 요청되면 하나의 active execution에 연결하거나 중복임을 명시적으로 거부하며, 서로 다른 attempt가 같은 mutable artifact를 독립적으로 갱신하지 않아야 한다.

### Lock Scope와 Owner {#operations-lock-scope-owner}

Lock 또는 동등한 exclusive claim은 보호하는 production, 범위와 action, owner, 획득 시점, liveness와 만료 조건을 조회할 수 있어야 하며 필요한 범위보다 넓게 다른 독립 작업을 막지 않아야 한다.

Local process owner는 host, 양의 safe-integer PID와 process 시작마다 달라지는 generation을 함께 기록해야 한다. 같은 PID가 점유되었다는 사실은 같은 process generation의 증거가 아니며, malformed owner나 조회 불가능한 process 상태를 active 또는 dead로 임의 정규화하지 않아야 한다.

### Stale Lock Recovery {#operations-stale-lock-recovery}

Owner가 사라졌다는 근거와 보호 대상의 현재 revision을 확인한 뒤에만 stale claim을 해제하거나 인계하고, 시간 경과만으로 아직 살아 있는 작업의 소유권을 빼앗지 않아야 한다.

PID 기반 local recovery는 같은 owner descriptor에 대한 독립된 두 관찰이 모두 process 부재를 증명하고 그 사이 claim의 exact physical generation과 bytes가 유지된 경우에만 허용해야 한다. PID가 점유되었거나 재사용되었을 수 있는 경우, 다른 host의 owner, malformed record와 process 조회 오류는 모두 보존 또는 명시적 거절이어야 한다.

### 뒤늦은 Writer 차단 {#operations-late-writer-fencing}

소유권을 잃거나 이전 current revision을 기준으로 실행한 attempt는 나중에 완료되더라도 새로운 owner의 checkpoint, current artifact와 publication을 덮어쓰지 못해야 한다.

Production revision은 0 이상의 safe integer 하나여야 한다. Mutable transition은 현재 revision의 exact successor를 쓰기 전에 계산할 수 있을 때만 시작하고, malformed·negative·fractional·unsafe 또는 successor가 없는 최대 revision에서는 payload, audit, manifest와 revision을 하나도 쓰지 않아야 한다.

### 교착과 Queue 정체 {#operations-deadlock-queue-stall}

서로 기다리는 claim, 장기 점유와 queue starvation을 감지하여 관련 owner, 대기 관계와 안전한 operator 선택을 보여야 하며 자동 해제를 정상 완료로 기록하지 않아야 한다.

### 공유 결과의 안전한 재사용 {#operations-concurrent-shared-result-reuse}

서로 다른 job이 공유 결과를 재사용할 때 immutable identity와 integrity가 일치해야 하며, 한 job의 cancel, cleanup 또는 failure가 다른 active job이 참조하는 결과를 제거하지 않아야 한다.
