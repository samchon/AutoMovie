# 승인, 반려, Waiver와 게시

## Approval Decision 레코드 {#acceptance-system-approval-decision}

### 승인 {#acceptance-system-approval}

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-approval-decision Defines approval over target, version, profile, criterion verdicts, evidence, exceptions and authority. -->
<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-approval-status Defines accepted, rejected, partial, accepted-with-deviation and pending-authority states. -->

Approval decision은 target과 version, scope, profile, criterion verdict set, evidence identities, unresolved finding, deviation, approver authority, time와 status를 가진다. Criterion verdict와 approval status는 독립 기록이며 approval은 원래 verdict를 변경하지 않는다.

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-aggregate-pass Defines the conditions for complete aggregate acceptance. -->
<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-approval-selection-separation Separates choosing a candidate from proving that it passes a profile. -->

Accepted는 모든 required criterion이 current하고 결론적으로 판정되며 모든 blocking criterion이 pass이고 필수 approver가 명시적으로 채택한 경우에만 성립한다. 여러 후보 중 선택되었다는 사실은 acceptance를 생성하지 않는다.

### 반려 {#acceptance-system-rejection}

<!-- @evidence requirements/acceptance/profiles-and-aggregation.md#acceptance-aggregate-fail Makes any non-deviated blocking failure reject the aggregate. -->

Rejected는 하나 이상의 비면제 blocking criterion이 fail일 때 성립하고 unmet criterion, finding, affected scope와 다시 판정할 조건을 가진다. 다른 criterion의 점수나 선호로 blocking fail을 상쇄하지 않는다.

### 조건부 승인과 제한 사용 {#acceptance-system-conditional-approval}

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-conditional-use Defines allowed and prohibited uses before complete approval. -->

조건부 승인은 남은 condition, 확인 owner, 허용 목적과 금지 목적, deadline 또는 event trigger와 만료 상태를 가진다. Condition이 충족되기 전에는 unconditional accepted와 구분하고 partial 또는 accepted-with-deviation 관계를 명시한다.

## Waiver 레코드 {#acceptance-system-waiver-record}

### 비면제 Criterion {#acceptance-system-nonwaivable-criterion}

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-deviation-contract Defines the complete scope, rationale, risk and publication impact of a deviation. -->

Waiver는 criterion fail을 유지한 채 deviation identity, observed violation, rationale, considered alternative, accepted impact와 risk, authority, scope, publication effect, expiry와 re-review trigger를 기록한다. Waiver는 pass가 아니며 aggregate status는 accepted-with-deviation이다.

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-nonwaivable-criteria Prevents authority from waiving declared integrity, safety, rights, credential or accessibility blockers. -->

Profile은 무결성, 안전, 권리, credential disclosure, required accessibility와 다른 nonwaivable criterion을 선언할 수 있다. 해당 criterion의 fail에는 waiver transition이 없고 같은 profile의 approval과 publication을 거절한다.

### Waiver와 판정 만료 {#acceptance-system-waiver-expiry}

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-deviation-expiry Invalidates deviations when their bound target, version, profile, time or risk changes. -->
Target, version, scope, profile, time 또는 risk condition이 waiver 결속을 벗어나면 waiver와 이를 소비한 approval은 stale이 된다. 이전 waiver를 새 결과나 sibling scope에 자동 상속하지 않는다.

## Publication Decision {#acceptance-system-publication-decision}

### 게시 원자성과 세대 {#acceptance-system-publication-atomicity}

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-publication-decision Binds publication to profile approval, actual delivery evidence, deviations and authority. -->
<!-- @evidence requirements/delivery-and-accessibility/publication-and-retention.md#delivery-publication-preconditions Requires exact current approval and artifact identities immediately before publication. -->

Publication decision은 exact delivery artifact와 profile, current validation, required approval, known deviation, partial 또는 unsupported scope, destination과 publication authority를 결속한다. Missing 또는 stale precondition은 publication을 거절하고 이전 published version을 변경하지 않는다.

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-publication-atomicity Prevents packages from mixing artifacts from different approved generations. -->

한 publication은 승인된 한 version과 dependency closure의 완전한 구성만 visible하게 만든다. 서로 다른 approval generation의 picture, audio, caption, manifest 또는 provenance를 조합한 결과는 partial이며 published current가 될 수 없다.

### 게시 후 상태 {#acceptance-system-post-publication-state}

<!-- @evidence requirements/acceptance/approval-exceptions-and-publication.md#acceptance-post-publication-status Distinguishes the prior published verdict from a changed current candidate. -->

Published bytes, manifest, profile 또는 approval binding이 바뀌면 새 candidate identity와 verdict를 만들고 이전 publication record를 historical로 보존한다. 과거 version의 유효한 approval은 변경된 candidate에 상속되지 않는다.
