# Disaster Recovery

## 제작 진실의 재해 복구 {#operations-disaster-recovery}

Production은 host, storage location, availability zone, service account 또는 provider 전체를 잃는 사고에 대해 허용 가능한 최대 데이터 손실과 복구 시간을 artifact class별로 선언하고 실제 복구 가능성을 검증해야 한다.

### 보호할 Authoritative State {#operations-disaster-authoritative-state}

Job state와 lineage, checkpoint, source identity, dependency record, receipt, current publication, provenance, authority와 audit record 가운데 재생성할 수 없는 정보를 복구 대상으로 식별하고 cache와 재생성 가능한 intermediate를 구분해야 한다.

### Backup의 독립성과 무결성 {#operations-backup-independence-integrity}

Backup은 보호 대상과 같은 단일 장애에 함께 소실되지 않아야 하며, 대상 version, 생성 시점, 암호화와 integrity, retention 및 복구에 필요한 권한의 availability를 확인할 수 있어야 한다.

### Restore 검증 {#operations-restore-validation}

Restore는 record 수나 directory 존재만이 아니라 참조 관계, content integrity, compatibility, current pointer와 representative resume 또는 publication 가능성을 확인해야 한다.

### Failover와 Split Brain {#operations-failover-split-brain}

Primary 상태를 확인할 수 없는 동안 failover가 writer authority를 획득하면 이전 writer의 뒤늦은 변경을 차단하고, 두 current history가 생겼을 때 자동으로 하나를 정상으로 숨기지 않아야 한다.

### Degraded Operation {#operations-disaster-degraded-operation}

일부 dependency나 복구 대상이 준비되지 않은 상태에서는 허용되는 read, resume, new work와 publication 범위를 명시하고, 안전 조건을 충족하지 못하는 mutation을 거부해야 한다.

### Recovery Exercise와 Gap {#operations-recovery-exercise-gap}

정기적인 recovery exercise는 사용한 backup, 실제 데이터 손실과 복구 시간, 검증 결과와 발견된 gap을 기록해야 하며 시험하지 않은 절차를 복구 가능성의 증거로 제시하지 않아야 한다.
