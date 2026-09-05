# 저작 가능성 기준

## 에이전트가 운전할 수 있는 능력 {#product-authorability-threshold}

제품 능력은 저자 에이전트가 공개된 계약과 예시를 통해 필요한 사실을 선언하고, 그 사실의 효과와 실패를 증거로 확인할 수 있을 때에만 성립한다.

### 명시적 제어 {#product-explicit-control}

형상, 관계, 상태, 시간, 변형, 품질 한도와 선택 결과를 바꾸는 중요한 입력은 저자가 이름으로 지정하거나 재현 가능한 규칙으로 통제할 수 있어야 한다.

### 의미 있는 선택 공간 {#product-authoring-choice-space}

하나의 유효한 결과만 허용하는 고정 template가 아니라 서로 다른 작품 의도를 표현하는 기법, 구성, 정밀도와 비용의 선택 공간을 제공해야 한다. 저자는 공개된 한계 안에서 각 선택을 독립적으로 바꾸고 그 결과를 비교할 수 있어야 한다.

### 발견 가능한 제어 {#product-discoverable-control}

각 production kind의 공개 capability는 owner, serializer 또는 emitter, compiler/runtime consumer와 저작 route를 하나의 조회 가능한 matrix로 제공해야 한다. 적용되지 않는 capability는 빈 경로가 아니라 구체적인 inapplicable reason을 가져야 한다.

공개 능력은 저자 에이전트가 현재 project에서 찾을 수 있는 문서, 계약, 사용 예와 진단을 가져야 한다. 구현에 존재하지만 저자가 발견하거나 검증할 수 없는 경로는 제품 능력으로 주장하지 않는다.

### 숨은 추정의 거부 {#product-hidden-inference-refusal}

저자가 선언하지 않은 중요한 구조나 의도를 그럴듯하게 채우는 숨은 heuristic은 허용하지 않는다. 필요한 정보가 없으면 명시된 기본값을 적용하거나 범위를 줄이고, 어느 쪽도 가능하지 않으면 선택이 필요하다는 진단을 남겨야 한다.
