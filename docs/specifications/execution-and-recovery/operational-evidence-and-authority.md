# Operational Evidence와 Authority

## Attributable Operation Contract {#execution-operational-authority-contract}

### Action-specific Authority {#execution-action-specific-authority}

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-audit-operator-authority Submit부터 restore와 override까지 모든 mutation을 인증된 actor와 당시 authority에 귀속한다. -->

Mutation request는 authenticated actor, delegated actor가 있으면 그 chain, requested action, production and target scope, reason, authority grant identity, grant version과 expiration을 가진다. Decision은 allowed or denied, effective scope, applied policy와 decision event를 출력하고 authority가 확인되지 않으면 mutation을 실행하지 않는다.

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-action-specific-authority 조회, 실행, 중단, current 변경, 삭제, 복구와 권한 위임을 별도 capability로 제한한다. -->

Authority model은 observe, submit, pause, resume, retry, cancel, force-terminate, publish, rollback, adopt, compensate, cleanup-preview, cleanup-apply, migrate, backup, restore, failover, override와 delegate capability를 분리한다. Grant는 production, job, artifact class와 action scope의 intersection에만 유효하고 한 action의 permission을 다른 action이나 sibling production에 확장하지 않는다.

### Audit Event Envelope {#execution-audit-event-envelope}

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-audit-event-completeness Actor, action, target, 전후 상태, 시각, 권한, 사유, correlation과 outcome을 완전한 event로 남긴다. -->

Audit event는 event identity, monotonic audit sequence, actor and delegation, action, exact target identity, expected and observed generation, previous and resulting state, authority decision, reason, correlation, event time, outcome와 failure identity를 가진다. Denied, failed, conflict와 unknown high-risk operations도 successful actions와 같은 envelope로 기록한다.

### Audit History Preservation {#execution-audit-history-preservation}

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-audit-history-preservation Cleanup, rollback, migration과 권한 철회가 과거 event와 당시 authority를 다시 쓰지 못하게 한다. -->

Audit history는 append-only generation chain과 integrity root를 가지며 correction은 original event를 참조하는 새 event다. Retention, migration와 disaster restore는 audit sequence gaps and forks를 검출하고, current authority change는 과거 decision의 grant snapshot을 수정하거나 삭제하지 않는다.

### Override와 Emergency Access {#execution-override-emergency-access}

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-override-emergency-access Budget, lock, retention, compatibility와 validation override에 별도 권한, 사유, scope와 expiration을 요구한다. -->

Override input은 exact policy and target, current blocking facts, bounded exception, justification, approving authority, start and expiration과 review obligation을 포함한다. Override는 integrity, security와 required publication closure처럼 non-overridable invariants를 낮출 수 없으며 expiration 뒤 새 operation에 재사용되지 않는다.

### High-risk Confirmation {#execution-high-risk-confirmation}

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-high-risk-action-confirmation Current 교체, 강제 claim 인계, irreversible cleanup, incompatible migration과 failover의 손실 가능성을 확인한다. -->

High-risk action은 impact preview identity, affected productions and artifacts, reversible and irreversible consequences, expected generation과 explicit confirmation identity를 요구한다. Confirmation 이후 target이나 preview가 바뀌면 stale confirmation으로 거부하고 high-risk action을 automatic retry or unattended fallback으로 실행하지 않는다.

### Secret-free Audit {#execution-secret-free-audit}

<!-- @evidence requirements/operations-and-recovery/audit-and-operator-authority.md#operations-secret-free-audit Credential과 protected resource 사용을 추적하면서 secret 원문을 저장하지 않는다. -->

Audit은 credential reference, account role, protected resource identity와 authorization outcome만 기록하고 credential bytes, token, signed locator와 protected payload를 허용하지 않는다. Redacted field는 kind와 disclosure class를 남기며 audit integrity digest가 secret의 guess verification oracle이 되지 않게 해야 한다.

### Operational Evidence Bundle {#execution-operational-evidence-bundle}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-event-correlation 상태, attempt, checkpoint, retry, lock, budget, artifact와 publication을 하나의 계보로 재구성한다. -->
<!-- @evidence requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism 운영 evidence의 complete 또는 incomplete 범위와 결정성 조건을 선언한다. -->

Operational evidence bundle은 job contract, attempt lineage, state transitions, admission and budget decisions, checkpoint and artifact receipts, control requests, failure and recovery decisions, ownership events, resource accounting, publication, retention outcomes와 audit integrity root를 immutable index로 연결한다. Bundle은 included, missing, unavailable and redacted sets, source record identities와 freshness를 제공하고 bundle 존재 자체를 job success 또는 domain acceptance로 간주하지 않는다.

### Operator Query와 Export {#execution-operator-query-export}

<!-- @evidence requirements/operations-and-recovery/observability-and-secret-protection.md#operations-observability-access-control 역할에 필요한 범위만 공개하고 제한된 reference로 운영 사실을 전달한다. -->

Query는 production, job, attempt, time range, event types와 disclosure class를 입력으로 받고 stable ordering의 records, completeness, next cursor and authorization summary를 반환해야 한다. Export는 같은 redaction과 retention policy를 적용하고 locale presentation이 identity, severity, state와 numeric values를 바꾸지 않는다.
