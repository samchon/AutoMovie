# Acceptance Case Matrix

## Criterion별 Case Matrix {#acceptance-system-case-matrix}

### Positive Case {#acceptance-system-positive-case}

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-case-triad Requires positive, negative and boundary cases for every required criterion. -->

각 required criterion version은 positive, negative와 boundary case identity를 가지며 세 case는 같은 target model, observable, comparison rule과 tolerance를 사용한다. Matrix의 case는 실행 결과와 독립된 계약 fixture이며 실제 판정 때 적용한 criterion version을 명시한다.

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-positive-case Defines the simplest representative success with all prerequisites and evidence. -->

Positive case는 모든 precondition과 required evidence를 갖춘 가장 단순한 대표 성공 입력, 기대 observable과 pass verdict를 가진다. 추가 완성도나 우연한 부가 상태가 없으면 통과하지 못하는 사례를 기본 positive로 사용하지 않는다.

### Negative Case {#acceptance-system-negative-case}

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-negative-case Defines representative omissions, mismatches, stale evidence and coverage failures. -->

Negative case는 실제로 criterion을 위반하는 wrong target, missing value, excess, reversed order, stale evidence, insufficient coverage와 profile mismatch를 포함하고 기대 fail reason을 가진다. Case가 다른 precondition failure로 먼저 중단되면 해당 negative claim을 증명하지 못한다.

### Boundary Case {#acceptance-system-boundary-case}

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-boundary-case Defines adjacent accepted and rejected values around exact criterion boundaries. -->

Boundary case는 허용되는 마지막 값, 거절되는 첫 값과 exact boundary를 같은 precision과 관찰 조건으로 제공한다. 연속량은 양쪽 값을, 이산량은 인접 유효 표본을, 지각 기준은 허용 한계와 거절 인접 사례를 연결한다.

### Invalid와 Fail Case 분리 {#acceptance-system-invalid-fail-separation}

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-invalid-versus-fail Separates invalid criteria and unmet prerequisites from observed target failure. -->

Invalid criterion, unmet precondition, not-run과 unsupported case는 target fail case와 별도 분류를 가진다. Matrix는 실행하지 못한 검사나 정의되지 않은 기준을 negative success로 계산하지 않는다.

### 상호작용 Case {#acceptance-system-interaction-case}

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-interaction-counterexample Requires combined cases where individually passing criteria can conflict. -->

같은 결과, state, 시간 또는 presentation을 공유하는 criteria는 개별 pass가 결합 실패를 숨길 수 있을 때 interaction case를 가진다. Interaction case는 관련 criterion verdict와 결합 constraint를 모두 보존한다.

### 회귀 Case {#acceptance-system-regression-case}

<!-- @evidence requirements/acceptance/case-matrix-and-counterexamples.md#acceptance-regression-counterexample Preserves resolved failures as repeatable regression counterexamples. -->

해결된 negative case는 적용 target family, profile과 criterion version에 연결된 regression case로 보존한다. 같은 반례가 current 결과에서 다시 나타나면 다른 개선점과 무관하게 해당 criterion은 fail이다.
