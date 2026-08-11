# Acceptance Case Matrix와 반례

## Positive, negative와 boundary case {#acceptance-case-triad}

각 필수 criterion은 성공을 보여 주는 positive case, 실패를 보여 주는 negative case와 판정 경계를 확인하는 boundary case를 가져야 한다.

세 case는 같은 criterion identity와 비교 규칙을 사용해야 하며, positive에는 느슨한 기준을 적용하고 negative에는 더 엄격한 기준을 적용하지 않아야 한다.

### Positive case {#acceptance-positive-case}

Positive case는 모든 필수 전제와 evidence를 갖춘 가장 단순한 대표 성공 사례를 보여야 한다. 화려하거나 과도하게 완성된 사례만 사용하여 기본 성공 조건을 감추지 않아야 한다.

### Negative case {#acceptance-negative-case}

Negative case는 잘못된 대상, 누락, 초과, 순서 반전, stale evidence, 불충분한 coverage와 profile 불일치처럼 실제로 거절되어야 할 반례를 포함해야 한다.

### Boundary case {#acceptance-boundary-case}

Boundary case는 허용되는 마지막 값, 거절되는 첫 값과 exact boundary를 구분해야 한다. 연속량은 경계의 양쪽을, 이산량은 인접한 유효 표본을 확인하고, exact criterion은 일치값과 가장 가까운 표현 가능한 불일치를 구분하며, 지각 criterion은 같은 관찰 조건에서 허용되는 한계 사례와 거절되는 인접 사례를 비교할 수 있어야 한다.

## 무효와 실패의 구분 {#acceptance-invalid-versus-fail}

Criterion이 불완전하거나 전제 조건이 성립하지 않는 경우를 대상의 fail 사례로 사용하지 않아야 한다. Invalid criterion, not-run, unsupported와 실제 관찰된 fail은 서로 다른 원인으로 보고되어야 한다.

## 상호작용 반례 {#acceptance-interaction-counterexample}

개별 criterion이 각각 통과해도 함께 적용할 때 충돌할 수 있는 조건은 상호작용 case로 검토할 수 있어야 한다. Camera 가독성과 actor contact, 조명과 mask, 음향과 dialogue intelligibility, caption과 화면 가림처럼 공유 결과를 소비하는 기준은 결합된 반례를 가져야 한다.

## 회귀 반례 {#acceptance-regression-counterexample}

이미 해결한 실패는 대상과 profile에 적용되는 반례로 보존할 수 있어야 한다. 변경 뒤 같은 반례가 다시 나타나면 새 결과가 다른 장점을 가져도 해당 criterion은 fail이어야 한다.
