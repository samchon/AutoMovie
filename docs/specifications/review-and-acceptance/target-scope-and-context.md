# Acceptance 대상과 요청 범위

## Requestable 대상 레코드 {#review-system-target-record}

### 범위 선택 {#review-system-scope-selection}


<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-target-identity Defines a stable target identity across versions, variants and profiles. -->

Requestable 대상 레코드는 대상 종류, 안정된 identity, revision 또는 content identity, variant와 적용 profile을 가진다. 같은 표시 이름을 가진 서로 다른 내용은 별도 대상이며, context query와 acceptance criterion은 대상 identity를 추측하지 않는다.

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-scope-inclusion-exclusion Makes included and excluded ranges explicit rather than treating silence as success. -->
<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-requestable-unit Supports independently requestable criteria, targets, intervals, profiles and change sets. -->

범위 선택은 query kind와 explicit id, 또는 포함되는 대상, 시간, frame, view, language, channel, pass, rendition과 delivery를 열거하는 결정적 선택 규칙으로 정의한다. Stored-context query는 slate에 저장된 exact unit만 반환하고, 없는 unit은 이웃 대상을 추측하지 않은 채 `null`을 반환한다. Query는 review target, criterion 또는 verdict를 새로 만들지 않는다.

### Criterion dependency scope {#review-system-criterion-dependency-scope}

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-scope-inclusion-exclusion Criterion이 직접 target하거나 읽는 shot dependency를 중복 없이 계산하게 한다. -->

Criterion dependency scope는 explicit target과 criterion이 읽는 shot을 별도 inclusion route로 계산한다. Cross-shot criterion의 모든 referenced shot은 invalidation dependency이며, helper가 verdict authority나 requestable review unit을 새로 정하지 않는다.

### 표시와 청취 Context {#review-system-presentation-context}


<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-presentation-conditions Prevents diagnostic presentation from being generalized to a target presentation. -->

Acceptance presentation context는 raster, crop, display transform과 color identity, playback speed, audio channel과 loudness, language, caption과 accessibility selection을 기록한다. Portable subject-observation record는 subject, viewpoint, pose, artifact 종류, runtime identity와 terminal status만 보존하며, 완전한 delivery raster, crop, display·color, playback·audio, language, caption과 accessibility identity는 현재 review-record surface가 아니다. Proxy, thumbnail, muted playback 또는 대체 channel은 원래 presentation과 다른 context identity를 가져야 한다.

### Context 부재 상태 {#review-system-context-unavailable}


<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-preconditions-consumers Separates unmet preconditions from a target failure. -->

필수 대상이나 context를 확인할 수 없으면 acceptance 결과는 unavailable, unsupported, not-run 또는 indeterminate 가운데 실제 원인을 나타내고 누락 범위와 하류 판정 영향을 제공한다. Portable subject coverage는 indeterminate, not-run, partial, stale 상태와 missing, stale, unplanned, foreign observation만 기록한다. Unsupported 원인과 하류 판정 영향까지 함께 기록하는 일반 acceptance-result surface는 현재 제공하지 않는다. Context 부재를 대상의 fail이나 pass로 변환하지 않는다.

### Compiler-owned 산출물 판독 거부 {#review-system-compiler-artifact-read-refusal}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run Separates a missing artifact, unreadable or malformed bytes, and a schema-contract contradiction instead of turning all three into one absent outcome. -->
<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Reports the exact artifact identity, failed validation path and recovery owner while preserving the last trustworthy review scope. -->

Current compile identity가 확인된 뒤 compiler-owned review artifact를 판독하지 못하면 review system은 파일 부재, byte 판독 또는 UTF-8·JSON·digest 손상, exact schema나 current identity 불일치를 별도 상태로 보고한다. 파일 부재와 손상은 compiler-owned publication의 재생성이 복구 행동이지만 schema 또는 identity 불일치는 writer와 reader의 같은 revision 계약이 모순된 제품 결함이므로 unchanged compile을 사용자 복구로 제시하지 않는다. Schema 거부는 validator가 제공한 실패 path를 보존하고, 어느 판독 실패도 acceptance outcome의 부재나 target fail로 바꾸지 않으며 독립적으로 읽을 수 있는 다른 evidence를 폐기하지 않는다.

### Context 변경과 무효화 {#review-system-context-invalidation}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-target-change Invalidates evidence and verdicts affected by target changes. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-environment-profile-change Invalidates the affected scope when presentation or profile conditions change. -->

대상 content, criterion, profile 또는 판정에 필요한 presentation context가 바뀌면 dependency relation으로 영향받는 evidence와 verdict를 stale로 전환한다. 영향이 없다고 판정한 범위는 그 근거와 결속을 새 기록으로 남겨야 한다.
