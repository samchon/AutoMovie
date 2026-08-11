# 입력, 결과와 상태 분류

## 입력 사실과 파생 결과의 경계 {#validation-input-derived-boundary}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-derived-separation 입력 결함과 파생 작업 또는 환경 실패의 책임을 분리한다. -->

각 finding은 origin을 input, derived-result, external-dependency, execution-environment 또는 policy로 분류하고 어떤 input revision과 작업 단계에서 관찰되었는지 결속한다. 하나의 원인이 여러 단계에 영향을 주어도 최초 원인과 downstream consequence를 관계로 연결하고 모든 증상을 input error로 복제하지 않는다.

Classification은 severity, lifecycle status와 독립된 축이다. 같은 invalid input도 좁은 optional 범위에서는 warning일 수 있고 required artifact에서는 error일 수 있지만 origin과 원인 identity는 바뀌지 않는다.

### 입력 Finding {#validation-input-finding}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding 사용자가 교정할 source 사실과 그 정확한 revision을 지목한다. -->

Input finding은 누락, 잘못된 type 또는 range, 비유한 값, 모순, 중복 identity, 해석 불가능한 관계, 금지된 선택과 전제조건 위반을 입력의 named root와 경로에 귀속한다. 검사는 값을 읽은 snapshot identity를 기록하고 동시에 바뀐 입력을 같은 finding의 근거로 섞지 않는다.

Input finding의 output은 invalid fact, 영향받는 규칙과 correction이며 파생 artifact가 존재하는지와 별개다. 이전에 유효했던 derived result가 남아 있어도 current input의 유효성을 대신 증명하지 않는다.

### 파생 결과 Finding {#validation-derived-result-finding}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding 계산부터 publication까지 어느 결과 단계가 실패하거나 확인되지 않았는지 구분한다. -->

Derived-result finding은 transformation, compilation, measurement, validation, render, encoding, probing, review 또는 publication stage와 그 stage의 input 및 output identity를 가진다. Input이 유효해도 timeout, dependency failure, budget exhaustion, write failure, corrupt bytes, stale evidence와 unsupported environment가 원인이면 input finding으로 바꾸지 않는다.

Planned, attempted, materialized, validated, current, stale와 published 상태를 분리하며 path 존재는 어떤 상태도 단독으로 증명하지 않는다. 과거 complete result, 현재 partial result와 현재 complete result는 서로 다른 provenance와 admissibility를 가진다.

### Missing 상태 {#validation-missing-state}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-missing-state 계약상 필요한 대상이 실제 search scope에 존재하지 않는 상태를 정의한다. -->

Missing은 required 또는 explicitly referenced input, subject, dependency, evidence나 result를 선언된 search scope에서 찾지 못한 상태다. 레코드는 required identity, search root와 boundary, 찾은 대안이 아닌 부재 사실, 막힌 작업과 제공 또는 relink correction을 가진다.

Search scope를 확인하지 못했거나 읽기 권한이 없으면 missing으로 확정하지 않고 unknown 또는 external failure로 분류한다. Intentionally absent와 optional omission은 missing과 구분하고 그 선택을 소유한 계약을 가리킨다.

### Unknown 상태 {#validation-unknown-state}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-unknown-state 현재 evidence로 참과 거짓을 결정할 수 없는 상태를 보존한다. -->

Unknown은 대상의 존재, 값, 원인 또는 판정을 현재 evidence와 검사 capability로 확정할 수 없는 상태다. 레코드는 질문 identity, 알려진 범위, 상충하거나 부족한 evidence, uncertainty와 결론에 필요한 다음 관찰을 가진다.

Unknown은 null, missing, unsupported, not-run 또는 success의 별칭이 아니다. Default나 추정값을 사용해야 한다면 그 값은 authored override 또는 declared degradation으로 별도 provenance를 얻고 원래 unknown fact를 덮어쓰지 않는다.

### Unsupported 상태 {#validation-unsupported-state}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-unsupported-state 의미를 이해했지만 선언된 capability 밖인 요청을 조용한 대체 없이 보고한다. -->

Unsupported는 요청, input format, feature, analysis 또는 intended use의 의미를 식별했으나 effective compatibility profile이 그 작업을 제공하지 않는 상태다. 레코드는 unsupported axis와 subset, 확인한 version, 영향을 받는 consumer 목적과 가능한 lower tier 또는 explicit degradation을 가진다.

Unsupported는 invalid input이나 transient failure가 아니며 retry만으로 바뀐다고 약속하지 않는다. Capability나 compatibility profile의 변경, 지원되는 변환 또는 사용자가 승인한 degradation이 있을 때만 새 session에서 다시 판정한다.

### Failed와 Not-run 상태 {#validation-failed-not-run-states}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run 수행한 작업의 실패와 수행하지 않은 작업을 분리한다. -->

Failed는 시작된 검사나 작업이 자신의 success invariant를 만족하지 못한 terminal outcome이다. 레코드는 attempt identity, failure stage, 확인된 cause, side effect와 partial output을 포함하고 재시도 가능성을 별도 판단한다.

Not-run은 선행조건, 사용자 선택, unsupported dependency, budget, fail-fast 또는 safety boundary 때문에 검사가 시작되지 않은 상태다. 중단 원인, prerequisite chain과 다시 실행할 조건을 기록하며, not-run check에 관찰값이나 pass 또는 fail을 만들어 넣지 않는다.

### 분류와 Severity의 직교성 {#validation-classification-orthogonality}

<!-- @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-classification-independence 상태 분류와 결과 영향의 심각도를 독립적으로 보존한다. -->

Missing, unknown, unsupported, failed와 not-run은 mutually distinguishable classification이고 severity는 결과 영향이다. Aggregation과 serialization은 두 축을 그대로 보존하며 하나의 status 문자열로 합치지 않는다.

상태 전이는 증거와 행동으로 정당화한다. Missing은 대상 제공이나 relink, unknown은 추가 evidence, unsupported는 capability 또는 explicit degradation, not-run은 실제 실행, failed는 교정된 새 attempt를 통해서만 다른 결과가 되며 과거 레코드는 이력으로 유지한다.
