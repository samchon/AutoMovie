# Failure Reconciliation과 Disaster Recovery

## Failure Envelope {#execution-failure-envelope}

<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-failure-modes-recovery 장애 뒤에도 job, attempt, work unit, artifact와 side effect의 상태를 보존한다. -->

Failure envelope는 failure identity와 class, detecting boundary, job and attempt, affected units, confirmed facts, unknown facts, last durable state, partial artifacts, external outcomes, retry eligibility와 permitted recovery actions를 가진다. Root cause가 확인되지 않으면 unknown을 보존하고 input error, not-run 또는 success로 재분류하지 않는다.

### Process Crash와 Power Loss {#execution-process-crash-power-loss}

<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-process-crash-power-loss Process, host와 power failure 뒤 마지막 영속 recovery point까지만 완료로 인정한다. -->

Recovery scanner는 durable job state, current owner claim, checkpoints, candidates와 publications를 exact generation으로 읽어야 한다. Last acknowledged checkpoint 이후 running units와 uncommitted transitions는 outcome unknown이며, stale owner를 fence한 뒤 verified complete, redo와 quarantine sets를 계산하기 전에는 attempt를 resume하지 않는다.

### Network와 Storage Ambiguity {#execution-network-storage-ambiguity}

<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-network-storage-failure Network 단절, short write와 acknowledgement 유실을 durable completion으로 오인하지 않는다. -->

Network or storage operation은 requested bytes or effect identity, destination generation, sent or written range, acknowledgement와 verified readback을 분리한다. Timeout, partial write와 lost acknowledgement는 unknown outcome이며 destination inspection 또는 provider reconciliation이 success, absence or corruption을 증명할 때까지 repeat, publish와 cleanup을 금지한다.

### Failure Isolation {#execution-failure-isolation}

<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-failure-isolation 한 work unit이나 optional product 실패가 독립된 성공 결과를 손상시키지 않게 한다. -->

Plan dependency graph는 failure가 invalidates, blocks 또는 leaves-independent로 분류하는 downstream set을 계산해야 한다. Independent completed artifacts와 checkpoints는 immutable하게 보존하고 failed required unit이 있으면 job completeness를 false로 유지하며, optional failure도 expected set과 not-produced reason에서 삭제하지 않는다.

### Recovery Decision {#execution-recovery-decision}

<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-recovery-decision-basis Resume, retry, restart, rollback, adopt와 abandon의 선택 근거를 기록한다. -->

Recovery decision input은 failure envelope, current authoritative state, dependency and compatibility status, side-effect disposition, estimated redo cost와 authority다. Output은 selected action, reusable and discarded scopes, expected new identity, risk and approval requirements를 포함하고, action을 실행한 결과는 original failure를 지우지 않는 causal event가 된다.

### Repeated Failure Circuit {#execution-repeated-failure-circuit}

<!-- @evidence requirements/operations-and-recovery/failure-modes-and-recovery.md#operations-repeated-failure-stop 같은 원인의 진전 없는 반복에서 자동 retry를 멈추고 operator 선택을 요구한다. -->

Circuit state는 normalized cause identity, consecutive count, rolling count, last progress checkpoint와 policy thresholds를 가진다. Threshold를 넘거나 attempt 사이에 durable progress가 없으면 retry를 blocked로 전환하고 cumulative history, remaining safe options와 필요한 operator authority를 출력해야 한다.

### Disaster Recovery Scope {#execution-disaster-recovery-scope}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-disaster-recovery Host, storage, zone, account 또는 provider 상실의 허용 데이터 손실과 복구 시간을 artifact class별로 계약한다. -->

Disaster profile은 protected production scope, failure domains, artifact classes, maximum data loss objective, recovery time objective, acceptable degraded capabilities와 responsible authority를 가진다. Objective는 backup 존재가 아니라 마지막 successful recovery exercise의 measured loss and time과 함께 보고해야 한다.

### Authoritative Recovery Set {#execution-authoritative-recovery-set}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-disaster-authoritative-state 재생성할 수 없는 job, checkpoint, receipt, publication, provenance, authority와 audit state를 복구 대상으로 식별한다. -->

Recovery inventory는 authoritative source and job state, lineage, checkpoints, immutable artifacts, current references, dependency records, receipts, provenance, authority policy와 audit events를 class별로 열거해야 한다. Reproducible cache와 intermediate는 optional rebuild set으로 구분하고 authoritative item을 cache availability에 의존시키지 않는다.

### Backup Independence와 Integrity {#execution-backup-independence-integrity}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-backup-independence-integrity Backup이 보호 대상과 같은 장애로 소실되지 않고 version, 암호화, integrity와 권한을 검증하게 한다. -->

Backup record는 protected snapshot identity, included classes and generations, creation and completion time, failure domain, encryption identity, integrity root, retention와 restore authority reference를 가진다. Incomplete backup, unverified key access와 same-domain replica는 recovery objective를 충족한 backup으로 집계하지 않는다.

### Restore Validation {#execution-restore-validation}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-restore-validation Directory 존재뿐 아니라 reference, integrity, compatibility와 representative resume 또는 publication을 검증한다. -->

Restore output은 restored inventory, missing or corrupt items, reference closure, compatibility result, current generation, authority re-establishment와 measured recovery time을 포함한다. Representative job resume와 publication readback이 성공하기 전에는 writable primary로 승격하지 않고 partial restore를 complete로 보고하지 않는다.

### Failover Fencing {#execution-failover-fencing}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-failover-split-brain Failover가 이전 writer를 차단하고 두 current history를 자동으로 숨기지 않게 한다. -->

Failover는 monotonically newer authority generation과 explicit writer quorum or operator decision을 획득해야 한다. Previous generation의 transition, heartbeat와 publication은 모두 reject하며 divergent histories를 발견하면 conflict set과 common ancestor를 보존하고 automatic winner selection 없이 reconciliation을 요구한다.

### Degraded Operation {#execution-disaster-degraded-operation}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-disaster-degraded-operation 일부 dependency가 복구되지 않은 상태의 read, resume, new work와 publication 범위를 명시한다. -->

Degraded profile은 available authoritative classes, permitted reads, allowed non-mutating verification, prohibited writes와 exit condition을 선언해야 한다. Required dependency, authority, audit sink 또는 current consistency가 없으면 new mutation과 publication을 거부하고 fallback 결과를 normal current로 표시하지 않는다.

### Recovery Exercise Evidence {#execution-recovery-exercise-evidence}

<!-- @evidence requirements/operations-and-recovery/disaster-recovery.md#operations-recovery-exercise-gap 실제 recovery exercise의 backup, 데이터 손실, 시간, 검증과 gap을 보존한다. -->

Exercise record는 isolated scenario, selected backup, injected failure, restored scope, measured loss, measured time, validation results, unresolved gaps와 exercise authority를 가진다. Simulation되지 않은 dependency와 skipped validation을 not-run으로 표시하고 문서화된 절차나 backup count를 successful recovery evidence로 대체하지 않는다.
