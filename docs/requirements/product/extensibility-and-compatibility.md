# 확장과 호환성

## 추가 가능한 표현 {#product-additive-expression}

새로운 주체, 공간, 형상, 재료, rig, 동작, simulation, 분석과 렌더 능력은 기존 선언을 재해석하거나 숨은 정보를 복원하지 않고 명시적인 계약을 추가하여 확장할 수 있어야 한다.

### 독립된 확장 축 {#product-independent-extension-axes}

기하, 재료, 의미, 상태, 시간, 소유권과 표현 품질은 필요할 때 독립적으로 확장할 수 있어야 하며 한 축의 확장이 다른 축의 전체 재작성을 요구해서는 안 된다.

### 생략 호환성 {#product-omission-compatibility}

새 계약을 사용하지 않는 기존 입력은 기존 의미와 정규 산출을 유지해야 한다. 새 선택 필드의 생략은 문서화된 기본값 또는 기능 부재로 해석하며 환경에 따라 다른 숨은 값으로 채우지 않는다.

### 명시적 protocol 변화 {#product-explicit-protocol-change}

정규 산출이나 외부 교환 형식의 의미가 달라질 때에는 version과 migration 책임을 명시하고, 이전 결과를 새 결과인 것처럼 조용히 읽지 않는다.

### capability gap 보존 {#product-capability-gap}

요구사항이 현재 구현보다 앞설 수 있다. 구현되지 않은 요구사항은 삭제하거나 약화하지 않고 영향받는 사용자 작업, 지원되지 않는 경계와 검증 상태를 가진 추적 가능한 gap으로 남겨야 한다.
