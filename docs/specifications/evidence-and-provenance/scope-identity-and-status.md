# 기록 Envelope와 상태 기계

## Evidence record envelope {#evp-record-envelope}

<!-- @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-record-identity 안정된 record identity와 판정 대상을 versioned envelope로 결속한다. -->

Record 생성 입력은 schema version, record kind, subject identity와 revision, issuer identity, issued time, scope와 payload다. 출력 envelope는 입력의 canonical identity, immutable record id와 초기 status를 포함하며, 같은 logical record를 다시 직렬화해도 record id가 달라지지 않아야 한다.

Record kind와 schema version을 해석할 수 없거나 필수 subject, issuer, time 또는 scope가 없으면 시스템은 record를 current로 등록하지 않고 invalid 또는 incomplete 결과와 누락 field를 반환해야 한다. 새 field를 아는 writer와 모르는 reader가 교환할 때 모르는 field를 보존할 수는 있지만 pass, approval 또는 공개 허가로 해석해서는 안 된다.

### Subject와 record identity 분리 {#evp-subject-record-identity-separation}

<!-- @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-subject-record-separation 대상과 그 대상을 설명하는 record의 identity 전이를 서로 독립된 규칙으로 만든다. -->

모든 record는 `{subjectId, subjectRevision}` reference를 가지며 record 자신의 identity와 다른 namespace에서 검증되어야 한다. Export format, display locale, locator와 storage path 변경은 subject revision을 만들지 않고, subject bytes나 의미 변경은 새 subject revision을 만들며 기존 record의 subject reference를 바꾸지 않아야 한다.

Record payload를 정정할 때는 기존 record를 수정하지 않고 replacement record와 `supersedes` relation을 출력해야 한다. 같은 subject에 여러 record가 있어도 record id, kind와 issued time으로 전부 구분되어야 한다.

### Status transition {#evp-record-status-transition}

<!-- @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-explicit-status current, stale, superseded, revoked, incomplete, invalid와 unavailable의 판정 조건과 전이를 정의한다. -->

Record status는 `current`, `stale`, `superseded`, `revoked`, `incomplete`, `invalid`, `unavailable` 중 하나여야 한다. Status 변경은 prior status, next status, actor 또는 rule identity, event time, reason과 triggering dependency를 가진 별도 event이며 원 record payload를 덮어쓰지 않아야 한다.

`current`는 schema와 payload가 유효하고 필수 dependency와 authority가 현재 revision에 결속되었을 때만 허용한다. Dependency 변경은 `stale`, 명시적 replacement는 `superseded`, 권한 철회는 `revoked`, 필수 정보 누락은 `incomplete`, 모순 또는 무결성 실패는 `invalid`, 필요한 bytes나 service에 접근할 수 없음은 `unavailable`로 판정하며 원인을 알 수 없으면 임의의 다른 상태로 축약하지 않아야 한다.

### Scope와 exclusion model {#evp-record-scope-model}

<!-- @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-scope-and-exclusions 검사한 범위와 제외 범위를 machine-readable coverage로 고정한다. -->

Scope 입력은 subject set, revision set, time 또는 frame range, view나 channel, artifact role, criterion set과 intended use를 포함할 수 있어야 한다. Exclusion은 제외한 범위, reason, authority와 consequence를 별도 항목으로 출력하고 포함 범위와 겹치거나 상위 범위를 묵시적으로 통과시키지 않아야 한다.

집계기는 하위 record가 공통으로 검사한 범위만 상위 coverage로 승격할 수 있다. 빈 scope, 모순된 range, 해석할 수 없는 criterion과 제외 뒤 남는 범위가 없는 success claim은 invalid로 거부해야 한다.

### Portable inspection view {#evp-portable-inspection-view}

<!-- @evidence requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-portable-inspection 활성 session이나 특정 service 없이도 record 관계와 무결성을 검토할 수 있는 출력 계약을 만든다. -->

Portable view는 record identity와 version, subject reference, kind, status와 status history, scope, relation, digest와 필요한 locator의 공개 가능한 표현을 포함해야 한다. Restricted 원본이 없어도 누락 또는 접근 제한을 명시해 graph를 읽을 수 있어야 하며 locator가 해소되지 않는 사실을 record 부재나 검증 성공으로 바꾸지 않아야 한다.

다른 runtime이 같은 schema version을 읽을 때 relation 방향, status 의미, canonical identity와 unknown-field 보존이 같아야 한다. 지원하지 않는 새 record kind를 받으면 raw envelope를 보존할 수 있지만 의미를 추정하지 않고 unsupported 판정을 출력해야 한다.
