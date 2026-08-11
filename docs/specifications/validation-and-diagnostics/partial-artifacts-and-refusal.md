# 부분 Artifact, 복구와 거부

## Artifact 상태와 완전성 {#validation-artifact-state-completeness}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-artifact-completeness absent부터 quarantined까지 산출물 상태와 신뢰 범위를 구분한다. -->

Artifact state는 absent, partial, complete, stale, corrupt와 quarantined를 구분한다. 각 record는 artifact identity와 intended role, producing session과 attempt, input identity, materialized coverage, missing coverage, integrity status, validation status와 current eligibility를 가진다.

Complete는 declared inventory와 integrity가 모두 확인된 상태이고 current는 별도의 input 및 compatibility freshness 판정이다. Partial, stale, corrupt와 quarantined는 bytes 존재 여부와 무관하게 complete current artifact가 아니며 상태를 path나 filename에서 추론하지 않는다.

### Refusal과 Success 경계 {#validation-artifact-refusal-boundary}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-success-boundary 부분 또는 임시 결과를 완전한 success와 publication에 사용하지 못하게 한다. -->

Validation refusal은 result completeness가 refused 또는 incomplete이고 blocking diagnostic이 남으며 current artifact 전환이 일어나지 않은 terminal outcome이다. Result는 refusal diagnostic, 보존된 prior current, 생성된 candidate 또는 partial artifact와 모든 not-run scope를 결속한다.

Complete와 validated가 required인 consumer와 publication은 partial, zero-byte, temporary, stale, corrupt 또는 quarantined artifact를 받지 않는다. Limited diagnostic use를 허용하는 partial artifact는 admissible purpose, trustworthy coverage, prohibited consumer와 expiry를 명시하고 사용자 선택도 missing coverage를 complete로 바꾸지 않는다.

### 이전 Complete 결과 보존 {#validation-preserve-previous-complete}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-preserve-prior-success 새 실패가 이전 정상 결과와 섞이거나 이를 current success로 가장하지 않게 한다. -->

새 attempt는 candidate namespace에서 결과를 만들고 required validation이 끝나기 전 current pointer를 바꾸지 않는다. Failure와 cancellation은 이전 complete artifact와 publication을 손상시키지 않으며 새 partial bytes를 이전 세대와 혼합하지 않는다.

이전 complete result는 자신의 input과 compatibility identity, current 또는 stale status를 유지한다. 이전 결과를 fallback으로 선택하려면 명시적 selection record와 intended use가 필요하고 새 request가 성공했다는 뜻으로 보고하지 않는다.

### Resume와 검증된 재사용 {#validation-resume-verified-artifacts}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-resume-verified-reuse 입력과 정책이 일치하고 무결성이 확인된 범위만 재사용한다. -->

Resume admission은 artifact와 checkpoint의 input, policy, compatibility, completeness, inventory와 digest를 current request와 비교한다. Exact 또는 검증된 compatible 범위만 reusable로 표시하고 partial, corrupt, stale, quarantined와 unknown identity fragment는 다시 검사하거나 materialize한다.

Resume result는 reused, rebuilt와 discarded scope를 기록하고 처음부터 수행한 같은 deterministic session의 final result와 동일한 acceptance를 만족해야 한다. Retry order, leftover temporary path와 cache enumeration은 final bytes, diagnostic set와 order를 바꾸지 않는다.

### Artifact 실패 중 Diagnostic 전달 {#validation-diagnostic-failure-channel}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-delivery-during-failure 주 산출물 실패와 진단 전달 실패를 구분하고 남은 신뢰 범위를 알린다. -->

Primary artifact channel이 materialize, validate 또는 publish하지 못해도 independent result channel은 failure diagnostic, last safe state, partial artifact inventory와 recovery action을 반환한다. Primary path에 error text를 쓰거나 artifact presence를 diagnostic 전달로 간주하지 않는다.

Result channel도 실패하면 outer failure record는 diagnostic-delivery-failed identity, 실패한 channel, 전달이 확인된 최소 정보와 유실 가능 범위를 제공한다. 확인하지 못한 diagnostic count와 artifact state를 complete로 추정하지 않는다.

### Retention, 폐기와 격리 {#validation-partial-artifact-retention}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-retention 부분 결과의 보존과 폐기 선택 및 보안 우선순위를 추적한다. -->

Partial artifact retention decision은 artifact identity, state, size, recovery value, sensitive classification, owner, retention deadline와 permitted action을 입력으로 삼는다. Preserve, quarantine, delete와 already-absent 결과를 구분하고 수행 authority, time와 outcome을 기록한다.

사용자 선택은 policy가 허용하는 범위에서 보존 또는 폐기를 결정한다. Security, privacy, rights 또는 external quarantine policy가 mandatory deletion이나 isolation을 요구하면 우선 적용하고 이유와 affected scope를 남기되 protected source를 diagnostic에 포함하지 않는다.
