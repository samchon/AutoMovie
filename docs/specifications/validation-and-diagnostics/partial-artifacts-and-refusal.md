# 부분 Artifact, 복구와 거부

## 공통 Artifact 축과 Validation Verdict {#validation-artifact-state-completeness}

### Refusal과 Success 경계 {#validation-artifact-refusal-boundary}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-artifact-completeness absent부터 quarantined까지 산출물 상태와 신뢰 범위를 구분한다. -->
<!-- @evidence requirements/operations-and-recovery/partial-artifacts-and-publication.md#operations-artifact-state-ownership Artifact completeness, integrity와 validation을 같은 identity에 결속하되 서로 합치지 않는다. -->

Validation은 [독립 Artifact 상태 축 계약](../execution-and-recovery/artifacts-and-atomic-publication.md#execution-artifact-lifecycle-contract)의 다섯 축 snapshot을 그대로 소비하고 local artifact lifecycle enum을 만들지 않는다. Artifact-scoped check status와 receipt는 공통 validation field에 기록하고, validation session은 result completeness, overall validation verdict, blocking diagnostics와 checked 및 not-run scope만 별도 결과로 추가하며 render phase, freshness, publication selection 또는 availability를 verdict에서 합성하지 않는다.

Requirement의 absent, partial과 complete는 materialization 및 completeness 축에, stale은 freshness에, corrupt는 integrity에, quarantined는 quarantine에 기록한다. 같은 artifact가 complete이고 과거 integrity와 validation을 통과했으면서 현재 stale, incompatible, superseded, unavailable 또는 quarantined일 수 있고 publication이 current인 채 freshness가 stale로 바뀔 수도 있으므로 어느 조합도 다른 관측을 지우거나 path와 filename에서 추론하지 않는다.

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-success-boundary 부분 또는 임시 결과를 완전한 success와 publication에 사용하지 못하게 한다. -->

Validation refusal은 result completeness가 refused 또는 incomplete이고 blocking diagnostic이 남으며 publication selection과 generation이 바뀌지 않은 terminal verdict다. Result는 refusal diagnostic, 보존된 prior publication snapshot, 생성된 candidate 또는 partial artifact와 모든 not-run scope를 결속하고 materialization과 completeness, integrity와 artifact-scoped validation, freshness와 compatibility, publication selection과 generation, availability와 quarantine의 확인된 관측을 그대로 반환한다.

완전성과 validation이 required인 consumer와 publication은 completeness complete, integrity verified, required validation passed, freshness current, compatibility exact 또는 policy가 허용한 compatible, availability available와 quarantine clear predicate를 각각 확인해야 한다. Limited diagnostic use를 허용하는 partial artifact는 admissible purpose, trustworthy coverage, prohibited consumer와 expiry를 명시하고 사용자 선택도 missing coverage를 complete로 바꾸거나 다른 축을 통과시키지 않는다.

### 이전 Complete 결과 보존 {#validation-preserve-previous-complete}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-preserve-prior-success 새 실패가 이전 정상 결과와 섞이거나 이를 current success로 가장하지 않게 한다. -->

새 attempt는 candidate namespace에서 결과를 만들고 required validation이 끝나기 전 publication selection과 generation을 바꾸지 않는다. Failure와 cancellation은 이전 complete artifact, 성공 receipt와 publication history를 손상시키지 않으며 새 partial bytes를 이전 세대와 혼합하지 않는다.

이전 성공 result는 materialization complete, integrity verified와 당시 validation passed evidence를 immutable history로 유지하면서 새 expected input에 대한 freshness가 stale, runtime에 대한 compatibility가 incompatible, publication selection이 current 또는 superseded, availability가 unavailable, quarantine이 quarantined로 각각 바뀔 수 있다. 이전 결과를 fallback으로 선택하려면 명시적 selection record와 intended use가 필요하고 prior success나 current publication을 새 request의 성공 또는 현재 소비 적격성으로 보고하지 않는다.

### Resume와 검증된 재사용 {#validation-resume-verified-artifacts}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-resume-verified-reuse 입력과 정책이 일치하고 무결성이 확인된 범위만 재사용한다. -->

Resume admission은 artifact와 checkpoint의 input, policy 및 다섯 축 snapshot을 current request와 비교한다. Reusable 범위는 completeness complete, integrity verified, required validation passed, freshness current, compatibility exact 또는 검증된 compatible, availability available와 quarantine clear를 각각 증명해야 하며, publication selection은 policy가 current를 요구하는 경우가 아니면 재사용 truth를 대신하지 않는다. Predicate를 충족하지 못하거나 unknown인 exact 범위만 다시 검사하거나 materialize한다.

Resume result는 reused, rebuilt와 discarded scope를 기록하고 처음부터 수행한 같은 deterministic session의 final result와 동일한 acceptance를 만족해야 한다. Retry order, leftover temporary path와 cache enumeration은 final bytes, diagnostic set와 order를 바꾸지 않는다.

### Artifact 실패 중 Diagnostic 전달 {#validation-diagnostic-failure-channel}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-delivery-during-failure 주 산출물 실패와 진단 전달 실패를 구분하고 남은 신뢰 범위를 알린다. -->

Primary artifact channel이 materialize, validate 또는 publish하지 못해도 independent result channel은 failure diagnostic, last safe state, artifact별 다섯 축 snapshot, partial inventory와 recovery action을 반환한다. Primary path에 error text를 쓰거나 artifact presence를 diagnostic 전달로 간주하지 않는다.

Result channel도 실패하면 outer failure record는 diagnostic-delivery-failed identity, 실패한 channel, 전달이 확인된 최소 정보와 유실 가능 범위를 제공한다. 확인하지 못한 diagnostic count와 artifact 축의 unknown 값을 complete로 추정하지 않는다.

### Retention, 폐기와 격리 {#validation-partial-artifact-retention}

<!-- @evidence requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-retention 부분 결과의 보존과 폐기 선택 및 보안 우선순위를 추적한다. -->

Partial artifact retention decision은 artifact identity, 다섯 축 snapshot, size, recovery value, sensitive classification, owner, retention deadline와 permitted action을 입력으로 삼는다. Preserve, quarantine, delete와 already-absent 결과를 구분하고 수행 authority, time와 outcome을 기록하며 availability와 quarantine 변경이 과거 completeness, integrity와 validation evidence를 삭제하지 않게 한다.

사용자 선택은 policy가 허용하는 범위에서 보존 또는 폐기를 결정한다. Security, privacy, rights 또는 external quarantine policy가 mandatory deletion이나 isolation을 요구하면 우선 적용하고 이유와 affected scope를 남기되 protected source를 diagnostic에 포함하지 않는다.
