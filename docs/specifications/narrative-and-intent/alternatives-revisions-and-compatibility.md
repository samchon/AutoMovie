# 대안, Revision과 Compatibility {#narrative-intent-revision-compatibility-document}

## Alternative 격리 {#narrative-intent-alternative-isolation}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-alternatives 대안별 story state와 downstream graph를 독립시킨다. -->
<!-- @evidence requirements/story/treatment-and-sequences.md#story-sequence-alternatives-order sequence 경로와 presentation order 대안을 격리한다. -->
<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-variants-selection design variant의 공통 base, 차이와 선택 이유를 보존한다. -->

Alternative는 stable identity, purpose, parent 또는 common base, exact difference, own story와 design state, downstream dependency closure, selection과 approval status를 가진다. 한 alternative의 beat, asset, timing, render, review와 acceptance는 다른 alternative에 섞이지 않고 shared input 변경 시 영향받는 모든 descendant를 식별한다.

### 선택과 승인 분리 {#narrative-intent-alternative-selection-approval}

<!-- @evidence requirements/story/logline-and-premise.md#story-logline-alternatives logline 후보의 범위, 비용과 consequence를 비교한다. -->
<!-- @evidence requirements/production-design/scope-and-source-of-truth.md#production-design-status-approval 선택되지 않거나 미승인 variant의 current 사용을 막는다. -->
<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-approval-selection-separation 후보 선택과 profile 통과를 분리한다. -->

Selection은 어떤 목적과 audience에 current 후보를 택했는지 나타내고 approval은 criterion과 evidence에 대한 별도 결정이다. 최선 후보나 유일 후보라는 사실은 기준 미달을 accepted로 바꾸지 않으며 같은 purpose에 복수 selected identity가 있으면 conflict다.

## Revision Identity와 계보 {#narrative-intent-revision-lineage}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-lineage revision identity, parent와 변경 집합을 추적한다. -->
<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-stable-identity wording 변경과 의미 변경의 identity 영향을 구분한다. -->

Revision은 stable identity, parent 또는 common ancestor, source closure, author, reason, timestamp, semantic change set과 status를 가진다. Wording과 표시명 변경은 단위 identity를 유지할 수 있지만 meaning, causal role, entry 또는 exit state와 acceptance 변경은 새 revision이며 같은 revision이 다른 내용을 가리킬 수 없다.

### 변경 이유와 Approval 상태 {#narrative-intent-revision-reason-status}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-reason 사용자 요청, evidence correction과 production constraint를 변경 근거로 기록한다. -->
<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-approval-status 승인, 거부, 보류와 superseded 상태를 분리한다. -->

Change reason은 user request, story improvement, source correction, production constraint, evidence finding 또는 project-defined cause와 observed consequence를 가진다. Proposed, under-review, approved, rejected, deferred와 superseded 상태를 유지하고 미승인 revision을 current source로 추정하지 않는다.

### 삭제, Tombstone과 Soft Lock {#narrative-intent-revision-deletion-soft-lock}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-deletion-invalidation 삭제된 단위의 tombstone과 dependent invalidation을 보존한다. -->
<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-soft-lock production 이후 삽입과 번호 보존 규칙을 정한다. -->

삭제는 identity, 삭제 revision, reason, replacement 또는 omission, affected dependents와 tombstone을 남기고 identity를 재사용하지 않는다. Soft lock 이후 삽입과 reorder는 기존 identity와 사람이 읽는 번호를 보존하며 renumber가 citation, shot, edit와 review 연결을 자동 이동시키지 않는다.

### Conflict, Merge와 Rollback {#narrative-intent-revision-conflict-rollback}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-conflict-authority 충돌한 변경을 timestamp 승자로 자동 해결하지 않는다. -->
<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-rollback-reproduction 과거 승인 상태를 exact source closure로 재현한다. -->
<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-version-merge-conflict edit 결정 결합에도 common ancestor와 explicit choice를 요구한다. -->

Merge는 common ancestor, 양쪽 semantic changes, overlap과 authority를 출력하고 story, sequence order, state, dialogue 또는 design 충돌은 사용자 선택 없이 해결하지 않는다. Rollback은 과거 source closure와 dependency versions를 새 current revision으로 선택하며 현재 파일을 덮어써 계보를 지우지 않는다.

## Change Impact와 Freshness {#narrative-intent-revision-impact-freshness}

<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-change-impact premise부터 delivery까지 consequence surface를 추적한다. -->
<!-- @evidence requirements/story/revision-and-change-impact.md#story-revision-freshness 변경 뒤 affected source, artifact와 review를 stale로 만든다. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-revalidation-scope shared dependency를 포함한 재판정 범위를 요구한다. -->

Semantic change는 premise, logline, sequence, beat, scene, character, relation, dialogue, theme, design, subject, shot, sound, edit, render, deliverable와 review까지 transitive impact graph를 출력한다. 영향받은 artifact와 verdict는 stale이고 확인된 비영향 범위만 근거와 함께 current로 유지한다.

### Compatibility 불변식 {#narrative-intent-compatibility-invariants}

<!-- @evidence requirements/story/story-clock-and-state.md#story-clock-state 선택적 story clock의 생략을 암묵값으로 해석하지 않는다. -->
<!-- @evidence requirements/story/scope-and-source-of-truth.md#story-open-form 형식별 선택 요소의 부재를 legacy 오류로 만들지 않는다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-tier-transition representation 변경 시 보존 사실과 deliberate difference를 명시한다. -->

새 선택 필드, temporal mode, story form, variant kind와 representation tier는 생략한 기존 source의 의미를 바꾸지 않는 additive extension이어야 한다. Stable identity, edge direction, time semantics, state authority와 verdict vocabulary는 revision 사이에 보존되고 새 kind를 이해하지 못하는 consumer는 silent downgrade 대신 unsupported를 출력한다.

### Canonical Comparison과 Revalidation {#narrative-intent-canonical-comparison-revalidation}

<!-- @evidence requirements/editorial/versions-and-alternative-cuts.md#editorial-difference-report 의미가 같은 시간과 경로 표현에서 가짜 차이를 만들지 않는다. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-change-impact 변경이 영향을 주는 acceptance 범위를 식별한다. -->
<!-- @evidence requirements/acceptance/change-regression-and-revalidation.md#acceptance-revalidation-completion current evidence와 authority가 모두 돌아와야 승인을 회복한다. -->

Comparison은 identity와 의미가 같은 시간, unit, path와 unordered metadata를 canonicalize하고 added, removed, replaced와 semantic change만 출력한다. Revalidation은 직접 criterion뿐 아니라 공유 state, time, asset, artifact와 approval dependency를 포함하며 모든 affected required criterion이 current evidence로 판정되고 authority가 채택할 때만 승인 freshness를 회복한다.
