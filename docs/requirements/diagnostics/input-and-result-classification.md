# 입력과 결과의 분류

## 입력 사실과 파생 결과의 분리 {#diagnostics-input-derived-separation}

진단은 사용자가 제공한 입력의 결함과 그 입력에서 파생 결과를 만들거나 확인하는 과정의 실패를 구분해야 한다. 파생 실패를 입력 오류로 돌리거나 입력 오류를 실행 환경의 일시적 실패로 표현하지 않아야 한다.

### 입력 진단 {#diagnostics-input-finding}

입력 진단은 누락, 모순, 범위 위반, 잘못된 관계, 해석 불가능한 값과 허용되지 않은 선택처럼 교정할 source 사실을 지목해야 한다. 진단 시점에 사용한 입력 revision과 외부 bytes의 identity를 함께 추적할 수 있어야 한다.

### 파생 결과 진단 {#diagnostics-derived-result-finding}

파생 결과 진단은 계산, 변환, 검증, 렌더, encode, probe, publication 또는 review 중 어느 결과가 만들어지지 않았거나 불완전하거나 확인되지 않았는지 밝혀야 한다. 입력이 유효하더라도 환경 실패, 한계 초과 또는 결과 손상이 원인이면 이를 별도 상태로 보고해야 한다.

이전 입력에서 만든 결과, 현재 입력의 부분 결과와 현재 입력의 완전한 결과를 구분해야 한다. 존재하는 path나 오래된 산출물을 이번 요청의 성공 증거로 사용하지 않아야 한다.

### Missing {#diagnostics-missing-state}

Missing은 계약상 필요하거나 명시적으로 참조된 입력, 대상, 의존성 또는 결과가 존재하지 않는 상태다. 무엇이 필요했고 어느 범위에서 찾았으며 부재가 어떤 작업을 막는지 밝혀야 한다.

### Unknown {#diagnostics-unknown-state}

Unknown은 대상이 없다고 확정한 상태가 아니라 현재 증거와 실행 범위로 사실을 결정할 수 없는 상태다. 알 수 없는 사실, 확인에 사용하지 못한 자료와 다음 확인 방법을 밝혀야 하며 임의의 기본값으로 확정하지 않아야 한다.

### Unsupported {#diagnostics-unsupported-state}

Unsupported는 요청이나 입력의 의미를 식별했지만 선언된 지원 범위 밖에 있는 상태다. 지원되지 않는 대상과 경계, 가능한 더 낮은 표현 단계 또는 대체 저작 범위를 제시하되 비슷한 기능으로 조용히 대체하지 않아야 한다.

### Failed와 Not-run {#diagnostics-failed-not-run}

Failed는 수행한 작업이 계약을 만족하지 못한 상태이고 not-run은 선행 실패, 사용자 선택, 예산 또는 환경 때문에 작업을 수행하지 않은 상태다. 실행하지 않은 검사를 실패나 성공으로 기록하지 않고, 중단 원인과 다시 실행할 조건을 밝혀야 한다.

### 상태의 독립성 {#diagnostics-classification-independence}

Missing, unknown, unsupported, failed와 not-run은 심각도와 별개의 분류다. 같은 분류도 영향 범위와 사용자 정책에 따라 다른 심각도를 가질 수 있으며, 분류와 심각도를 섞어 원인이나 결과를 잃지 않아야 한다.
