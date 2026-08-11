# Retention, Invalidation과 Disposal

## Versioned retention policy {#evp-versioned-retention-policy}

<!-- @evidence requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-explicit-lifecycle source, artifact, evidence, review와 publication record의 종류별 수명주기를 versioned policy로 정의한다. -->

Retention policy 입력은 policy identity와 version, record 또는 artifact class, purpose, retention start event, duration 또는 condition, archive rule, access class, owner와 disposal rule이다. 평가 출력은 logical validity나 physical availability와 구분된 retention disposition으로 retain, archive, eligible-for-disposal, held, expired 또는 unresolved와 next review time을 포함해야 한다.

Policy 변경은 기존 item에 적용한 policy revision을 보존하고 새 평가 activity를 만든다. 적용 policy를 찾을 수 없거나 여러 policy가 충돌하면 disposal과 indefinite retention을 모두 자동 선택하지 않고 unresolved로 반환해야 한다.

### Invalidation과 deletion state {#evp-invalidation-deletion-state}

<!-- @evidence requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-invalidation-versus-deletion stale, superseded, revoked와 invalid 상태를 bytes 보존 또는 삭제와 분리한다. -->
<!-- @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-explicit-status logical validity와 physical unavailable 상태를 동시에 잃지 않고 표현한다. -->

Logical validity와 copy scope별 physical availability는 독립 field여야 한다. Logical validity는 `current`, `stale`, `superseded`, `revoked`, `incomplete`, `invalid` 또는 `indeterminate`이고 physical availability는 `available`, `archived`, `unavailable` 또는 `deleted`다. Invalidation event는 logical validity 축, prior와 next value, reason, trigger와 effective time을 기록하고 bytes deletion 없이 완료되며, deletion과 retrieval event는 physical availability 축만 바꾸고 logical value와 그 transition history를 그대로 보존해야 한다.

Deletion event는 stable event identity, record 또는 artifact identity, exact copy scope와 storage generation, prior와 next availability, authority, effective time, reason, disposal receipt와 remaining copy identities를 가져야 한다. `deleted`는 해당 copy의 부재가 검증된 뒤에만 허용하며 remote 확인 불가나 일부 replica 실패는 `unavailable` 또는 aggregate incomplete로 남겨야 한다. Retrieval event도 archive와 destination copy identity, prior와 next availability, recovered digest와 retrieval activity를 기록하고 logical validity를 current로 승격하지 않아야 한다.

Deleted entity를 참조하는 lineage는 tombstone 또는 unavailable relation과 원 provenance를 유지해야 한다. Storage에 bytes가 없다는 이유로 logical history를 제거하거나 invalidated record가 보존되어 있다는 이유로 current 판정에 포함해서는 안 된다. Available, archived, unavailable과 deleted 사이의 전이는 content identity, subject revision, derivation과 custody relation을 새 identity로 교체하지 않아야 한다.

### Freshness expiry evaluation {#evp-freshness-expiry-evaluation}

<!-- @evidence requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-freshness-expiry-and-review 시간, source, dependency, policy와 criterion 변화가 evidence와 approval에 미치는 영향을 계산한다. -->

Freshness evaluator는 record dependency set, observation time rule, current source와 policy revisions, tool 또는 method version과 rubric revision을 입력받아 logical validity의 current, stale 또는 indeterminate와 triggering differences를 출력해야 한다. 이 평가는 physical availability를 바꾸지 않으며 단순 file timestamp나 latest locator만으로 freshness를 결정해서는 안 된다.

Stale result는 dependent claim, approval와 publication으로 전파하되 영향 없는 scope는 유지해야 한다. 영향 relation을 해석할 수 없으면 unchanged로 추정하지 않고 incomplete impact를 반환해야 한다.

### Retention hold {#evp-retention-hold}

<!-- @evidence requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-hold-and-exception 분쟁, 안전, 계약과 법적 의무에 따른 disposal hold를 범위와 해제 조건이 있는 상태로 만든다. -->

Hold 입력은 authority, basis, exact subject 또는 class scope, start time, review time와 release condition이다. Active hold는 matching item의 disposal을 거부하고 어떤 hold가 어떤 target을 막았는지 출력해야 한다.

Hold scope 밖 item, expiry 뒤 item과 authority 없는 request까지 무기한 보존해서는 안 된다. Conflicting hold와 erasure duty는 unresolved policy conflict로 보고하고 사람의 authorized resolution을 요구해야 한다.

### Disposal execution receipt {#evp-disposal-execution-receipt}

<!-- @evidence requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-verifiable-disposal cache, replica, archive, upload와 provider copy를 포함한 폐기 결과를 검증 가능한 receipt로 만든다. -->

Disposal plan은 exact identities, resolved storage objects, known replicas와 remote providers, policy decision, method와 authority를 포함해야 한다. Execution 상태는 planned, running, partial, complete, failed 또는 unverified-remote이며 per-target result, time와 remaining reference를 출력해야 한다.

Path나 label이 아니라 삭제 직전 captured identity와 deletion 뒤 absence 또는 provider attestation을 대조해야 한다. Verified target만 physical availability를 `deleted`로 전이하고 일부 target 실패, unknown replica와 remote 확인 불가는 complete와 aggregate `deleted`를 거부하며 safe retry 또는 manual action을 반환해야 한다. Disposal outcome은 logical validity, provenance와 lineage를 바꾸지 않아야 한다.

### Archive retrieval activity {#evp-archive-retrieval-activity}

<!-- @evidence requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-archive-retrieval-and-restoration archive 회수와 migration을 원 identity 검증 뒤의 새 activity로 기록한다. -->

Retrieval 입력은 archive identity, expected artifact closure, storage generation, retrieval tool과 destination이다. 출력은 recovered bytes와 digest, missing 또는 corrupt member, migration mapping과 copy scope별 new physical availability이며 original identity와 retrieval activity를 모두 참조해야 한다. Exact recovery는 archived 또는 unavailable copy를 available로 바꿀 수 있지만 original logical validity와 provenance를 그대로 유지해야 한다.

Integrity가 일치하는 exact recovery만 original content identity를 재사용할 수 있다. Format migration, repair와 partial recovery는 새 entity revision이며 원 entity의 logical validity나 과거 verified 판정을 자동 상속하지 않고 명시된 derivation과 새 판정을 요구해야 한다.
