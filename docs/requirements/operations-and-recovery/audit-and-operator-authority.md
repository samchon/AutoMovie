# Audit와 Operator Authority

## 귀속 가능한 운영 권한 {#operations-audit-operator-authority}

Job submit, pause, resume, retry, cancel, force termination, publication, rollback, cleanup, migration, restore와 policy override는 인증된 actor, 허용 범위와 당시 유효한 authority에 귀속되어야 한다.

### Action별 최소 권한 {#operations-action-specific-authority}

조회, 실행, 중단, current 변경, 삭제, 복구와 권한 위임을 서로 다른 권한으로 구분하고, 한 production 또는 job의 권한을 다른 범위에 암묵적으로 확대하지 않아야 한다.

### Audit Event의 완결성 {#operations-audit-event-completeness}

Audit event는 actor, action, target identity, 이전과 이후 상태, 시각, 권한 근거, 사유, correlation과 outcome을 가져야 하며 실패하거나 거부된 고위험 action도 기록해야 한다.

### Audit History의 보전 {#operations-audit-history-preservation}

Audit history는 일반 job log와 분리된 보존 및 접근 정책을 적용하고, cleanup, rollback, migration 또는 권한 철회가 과거 event를 수정하거나 행위 당시 authority를 다시 쓰지 않아야 한다.

### Override와 Emergency Access {#operations-override-emergency-access}

Budget, lock, retention, compatibility와 validation 정책의 override 및 emergency access는 별도 권한, 명시된 사유, 제한된 scope와 expiration을 요구하고 사용 즉시 검토 가능한 event를 남겨야 한다.

### 고위험 Action의 확인 {#operations-high-risk-action-confirmation}

Current publication 교체, 강제 lock 인계, irreversible cleanup, incompatible migration과 disaster failover는 영향받는 production과 손실 가능성을 확인한 뒤 실행되어야 하며 자동 retry 대상이 아니어야 한다.

### Secret 없는 Audit {#operations-secret-free-audit}

Audit은 어떤 credential과 protected resource가 어떤 권한으로 사용되었는지 추적하되 secret 원문과 불필요한 protected content를 저장하지 않아야 한다.
