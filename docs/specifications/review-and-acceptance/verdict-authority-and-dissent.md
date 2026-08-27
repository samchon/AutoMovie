# Verdict, Authority와 이견

## Criterion Verdict 상태 기계 {#acceptance-system-verdict-state-machine}

### 자동 검사 경계 {#review-system-automated-check-boundary}

<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-criterion-verdicts Defines pass, fail, indeterminate, not-run, unsupported and stale as distinct states. -->

Criterion verdict는 pass, fail, indeterminate, not-run, unsupported 또는 stale 중 하나이며 criterion version, target scope, evidence set, context, actor 또는 deterministic evaluator와 reason을 가진다. Invalid criterion은 target verdict가 아니라 criterion definition error다.

<!-- @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-automated-finding-boundary Separates automated results from their explanation and human judgment. -->

자동 검사는 선언된 수치와 구조 rule에서 observation과 candidate finding을 만들고 같은 입력에 결정적인 verdict를 낼 수 있다. 시스템은 자동 결과를 작품의 미학, 서사 적합성, 승인, 반려 또는 waiver decision으로 변환하지 않는다.

## Authority 역할 분리 {#acceptance-system-authority-roles}

### Criterion Owner 권한 {#acceptance-system-criterion-owner}

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-authority-separation Separates requester, evidence producer, evaluator, risk owner and final approver. -->

Authority model은 criterion requester, criterion owner, evidence producer, observer 또는 evaluator, reviewer, deviation risk owner, approver와 publication authority의 role과 scope를 분리한다. 한 사람이 여러 role을 맡더라도 각 decision에는 사용한 role이 기록된다.

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-criterion-owner-authority Gives the criterion owner control of expectations, comparison, tolerance, evidence and severity. -->

Criterion owner만 해당 version의 expected state, comparison rule, tolerance 또는 exact 선언, required evidence, severity와 profile membership을 확정한다. Reviewer와 approver는 판정 중 기준을 완화하거나 숨은 기준을 추가하지 않는다.

### Reviewer와 Approver 권한 {#acceptance-system-review-approval-roles}

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-review-approval-authority Separates observed verdict ownership from adoption as an approval state. -->

Reviewer는 observation과 criterion verdict를 소유하고 approver는 그 결과를 approval state로 채택한다. Role이 다르면 reviewer pass만으로 approval을 만들지 않고 approver decision만으로 missing evidence를 채우지 않는다.

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-authority-conflict Defines indeterminate and pending-authority states for conflict or absence. -->
<!-- @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-perceptual-uncertainty Prevents observer disagreement from being hidden by averaging. -->

상충하는 observation, finding과 judgment는 모두 보존하고 authority priority, consensus, majority 또는 final-authority rule이 profile에 있을 때만 그 규칙으로 해결한다. 해결 규칙이 없으면 criterion은 indeterminate이고 필수 approver가 없으면 approval은 pending-authority다.

### Publication Authority {#acceptance-system-publication-authority}

<!-- @evidence requirements/acceptance/scope-targets-and-authority.md#acceptance-publication-authority Separates publication choice from technical and review verdicts. -->

Publication authority는 하위 approval, deviation, profile, stale state, partial scope와 actual delivery identity를 보고 current version의 publication을 선택한다. Publication choice는 criterion verdict와 별도 decision identity를 가진다.
