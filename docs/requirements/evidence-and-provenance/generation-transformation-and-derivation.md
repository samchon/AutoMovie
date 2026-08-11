# 생성, 변환과 파생 이력

## 결과를 만든 활동의 이력 {#provenance-generation-transformation-history}

새로운 자산이나 산출물을 생성, 변환, 선택, 결합 또는 게시하는 각 단계는 고유한 activity와 output identity를 가지며, 사용자는 어느 입력과 선택이 현재 결과에 기여했는지 역추적할 수 있어야 한다.

### 생성 결과의 기록 {#provenance-generated-output-record}

규칙 기반 또는 생성형 과정은 generator나 provider, 정확한 model 또는 tool version, 입력과 reference, prompt 또는 선언, controls, seed가 적용되는 경우 그 seed, 실행 경계, terms, 원시 output과 채택 output의 digest를 기록해야 한다.

### 비결정적 생성의 한계 {#provenance-nondeterministic-generation}

같은 prompt, seed와 표시된 설정이 같은 output을 보장하지 않는 과정은 그 한계를 명시하고 각 retry와 variant를 별도 output으로 식별해야 하며, 선택된 결과만 남기고 실패하거나 버린 후보의 존재를 숨겨 재현 가능성을 과장해서는 안 된다.

### 변환과 정규화의 기록 {#provenance-transformation-record}

형식 변환, 좌표와 단위 정규화, resampling, retargeting, 합성, 압축, encode와 metadata 수정은 사용한 source revision, 규칙과 설정, tool version, element 대응, 근사와 손실, 지원하지 않은 내용, 생성된 output을 기록해야 한다.

### 선택과 결합의 기록 {#provenance-selection-and-composition}

여러 후보 중 채택, 제외, crop, edit, layer 또는 assembly 결합이 결과를 바꾸면 선택 기준, 선택 주체, 사용한 부분과 순서, 제외된 부분의 상태를 기록하고 사람의 창작 선택을 자동 생성 사실로 표시해서는 안 된다.

### 파생 영향의 추적 {#provenance-derivation-impact}

Input, activity, rule 또는 output이 바뀌면 사용자는 이를 소비한 자산, 장면, render, review와 delivery를 식별할 수 있어야 하며, 변화가 없는 형제 산출물까지 새 identity로 만들거나 영향을 받은 산출물을 current로 남겨서는 안 된다.
