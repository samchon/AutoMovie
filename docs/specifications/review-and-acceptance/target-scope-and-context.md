# 대상, 범위와 재현 Context

## 검토 대상 레코드 {#review-system-target-record}

### 범위 선택 {#review-system-scope-selection}

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-target-identity Defines a stable target identity across versions, variants and profiles. -->
<!-- @evidence requirements/review/reproducible-context.md#review-reproducible-context Defines the complete context required to reopen the same review basis. -->

검토 대상 레코드는 대상 종류, 안정된 identity, revision 또는 content identity, variant, 적용 profile과 판정 시점을 가진다. 같은 표시 이름을 가진 서로 다른 내용은 별도 대상이며, 대상 레코드는 그것을 설명하는 review record와 독립된 identity를 유지한다.

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-scope-inclusion-exclusion Makes included and excluded ranges explicit rather than treating silence as success. -->
<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-requestable-unit Supports independently requestable criteria, targets, intervals, profiles and change sets. -->
<!-- @evidence requirements/review/scope-and-authority.md#review-verdict-scope-boundary Prevents a narrow verdict from becoming a wider guarantee. -->

범위 선택은 포함되는 대상, 시간, frame, view, language, channel, pass, rendition과 delivery를 열거하거나 결정적인 선택 규칙으로 정의하고 제외 범위와 이유를 함께 가진다. 좁은 선택의 verdict는 선택 결과를 포함하는 더 넓은 범위로 자동 전파되지 않는다.

### Criterion dependency scope {#review-system-criterion-dependency-scope}

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-scope-inclusion-exclusion Criterion이 직접 target하거나 읽는 shot dependency를 중복 없이 계산하게 한다. -->

Criterion dependency scope는 explicit target과 criterion이 읽는 shot을 별도 inclusion route로 계산한다. Cross-shot criterion의 모든 referenced shot은 invalidation dependency이며, helper가 verdict authority나 requestable review unit을 새로 정하지 않는다.

### Source와 Artifact 결속 {#review-system-source-artifact-binding}

<!-- @evidence requirements/review/reproducible-context.md#review-context-source-artifact-identity Binds review to exact source, asset, take, edit, render and delivery identities. -->

검토 대상은 판정에 기여한 source, asset, take, edit, render, repaint와 delivery artifact의 정확한 identity와 derivation relation을 보존한다. Mutable reference나 경로만 알고 실제 content identity를 확정할 수 없으면 current target으로 사용할 수 없다.

### 시간과 재생 Context {#review-system-time-playback-context}

<!-- @evidence requirements/review/reproducible-context.md#review-context-time-playback Defines the frame clock, interval and playback facts needed to revisit the same moment. -->

시간 context는 exact timebase, frame rate, 시작과 끝의 포함 규칙, frame 또는 sample 위치, 재생 속도, 반복과 audio synchronization 조건을 가진다. 시간 표현의 변환은 같은 film instant를 가리켜야 하며 반올림된 표시값을 정본으로 쓰지 않는다.

### 표시와 청취 Context {#review-system-presentation-context}

<!-- @evidence requirements/review/reproducible-context.md#review-context-presentation Preserves image, color, audio, language and accessibility presentation conditions. -->
<!-- @evidence requirements/acceptance/review-surfaces-and-sampling.md#acceptance-presentation-conditions Prevents diagnostic presentation from being generalized to a target presentation. -->

Presentation context는 raster, crop, display transform과 color identity, playback speed, audio channel과 loudness, language, caption과 accessibility selection을 기록한다. Proxy, thumbnail, muted playback 또는 대체 channel은 원래 presentation과 다른 context identity를 가져야 한다.

### Criterion과 Reference 결속 {#review-system-criterion-reference-binding}

<!-- @evidence requirements/review/reproducible-context.md#review-context-criteria-reference Binds the applied criteria and references by identity and version. -->

검토 context는 적용한 criterion과 tolerance, baseline, reference와 comparison candidate의 identity와 version을 포함한다. 이 중 하나가 바뀌면 과거 verdict가 어떤 기준에 대한 판단이었는지 보존한 채 새 context를 만든다.

### Context 부재 상태 {#review-system-context-unavailable}

<!-- @evidence requirements/review/reproducible-context.md#review-context-unavailable Refuses reproducibility when required context cannot be reopened. -->
<!-- @evidence requirements/review/records-and-completeness.md#review-incomplete-review Reports missing targets, references, authority and playback as incomplete review. -->
<!-- @evidence requirements/acceptance/criteria-and-observables.md#acceptance-preconditions-consumers Separates unmet preconditions from a target failure. -->

필수 대상이나 context를 확인할 수 없으면 검토 상태는 unavailable, unsupported, not-run 또는 indeterminate 가운데 실제 원인을 나타내고 누락 범위와 하류 판정 영향을 제공한다. Context 부재를 대상의 fail이나 pass로 변환하지 않는다.

### Compiler-owned 산출물 판독 거부 {#review-system-compiler-artifact-read-refusal}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run Separates a missing artifact, unreadable or malformed bytes, and a schema-contract contradiction instead of turning all three into one absent outcome. -->
<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Reports the exact artifact identity, failed validation path and recovery owner while preserving the last trustworthy review scope. -->

Current compile identity가 확인된 뒤 compiler-owned review artifact를 판독하지 못하면 review system은 파일 부재, byte 판독 또는 UTF-8·JSON·digest 손상, exact schema나 current identity 불일치를 별도 상태로 보고한다. 파일 부재와 손상은 compiler-owned publication의 재생성이 복구 행동이지만 schema 또는 identity 불일치는 writer와 reader의 같은 revision 계약이 모순된 제품 결함이므로 unchanged compile을 사용자 복구로 제시하지 않는다. Schema 거부는 validator가 제공한 실패 path를 보존하고, 어느 판독 실패도 acceptance outcome의 부재나 target fail로 바꾸지 않으며 독립적으로 읽을 수 있는 다른 scenario evidence를 폐기하지 않는다.

### Context 변경과 무효화 {#review-system-context-invalidation}

<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-target-change Invalidates evidence and verdicts affected by target changes. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-environment-profile-change Invalidates the affected scope when presentation or profile conditions change. -->
<!-- @evidence requirements/review/approval-rejection-and-waivers.md#review-verdict-freshness Makes verdict freshness dependent on target, criterion and context identity. -->

대상 content, criterion, profile 또는 판정에 필요한 presentation context가 바뀌면 dependency relation으로 영향받는 evidence와 verdict를 stale로 전환한다. 영향이 없다고 판정한 범위는 그 근거와 결속을 새 기록으로 남겨야 한다.
