# 능력 발견과 예시

## 저자가 찾을 수 있는 능력 {#agent-capability-discovery}

저자 에이전트는 자연어 의도에서 관련 요구사항, specification, 공개 계약, 기법 예시와 검증 경로까지 탐색할 수 있어야 한다.

### 주제별 문서 탐색 {#agent-topic-document-discovery}

문서는 package 이름만으로 나열하지 않고 map, building, interior, actors, motion, camera와 sound처럼 저자가 찾는 제품 주제를 통해 필요한 책임으로 안내해야 한다.

### 선택지와 한계의 발견 {#agent-choice-surface-discovery}

서로 다른 저작 기법, local 또는 external 실행 경로, 품질 tier와 부분 작업 경계를 지원한다면 각각의 선행 조건, 관찰 가능한 차이와 실패를 찾을 수 있어야 한다. 한 예시나 설치된 provider를 유일한 정답으로 제시해서는 안 된다.

### 하나의 기법을 가르치는 예시 {#agent-technique-example}

예시는 하나의 보편 기법, 적용 이유, 조절점과 검증 결과를 설명해야 한다. 완성 콘텐츠의 외형만 보여 주거나 복사할 거대한 장면을 제공하는 것으로 끝내지 않는다.

### 실패에서의 발견 {#agent-diagnostic-discovery}

진단은 실패한 invariant, 대상, 경로와 correction을 통해 저자가 관련 계약과 올바른 저작 기법을 찾을 수 있게 해야 한다.

### 현재 능력과 gap의 구분 {#agent-capability-gap-discovery}

문서화된 요구사항, 구현된 능력, 아직 구현되지 않은 gap을 구분하여 저자가 존재하지 않는 surface를 있다고 믿거나 현재 가능한 조합을 놓치지 않게 해야 한다.

### 제작 언어 계약 선택 {#agent-production-language-contract}

Project 생성은 지원하는 제작 언어 하나를 명시적으로 선택하고 그 언어의 탐색 질문, 단위 원칙과 완성 population 의무만 project 안에 설치해야 한다. 선택 누락, 지원하지 않는 언어와 다른 언어 module의 잔존을 거부하고, 선택한 언어 identity를 같은 typed 설정과 저작 router에서 확인할 수 있어야 한다.
