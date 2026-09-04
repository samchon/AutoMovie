# 생성 프로젝트 증거 그래프

## 재사용 계약 {#agent-production-evidence-graph}

### 고정된 공통 계약 목록 {#agent-production-evidence-shared-contract}

모든 생성 프로젝트는 같은 공통 원칙·의무·상위 수정·작품별 발견 문서 목록과 각 문서의 명시적 H2 대상을 사용해야 한다. 목록과 실제 문서가 어긋나거나 대상이 누락·중복·충돌하면 그래프를 만들 수 없어야 한다.

원칙은 선택된 모든 저술 H2/H3/H4 단위가 각 항목을 자기 자신에 대해 답하는 무배제 checklist여야 한다. 저술 계층의 의무는 전용 account H2가 한 의무 항목과 그 계층의 완전한 H2 모집단을 함께 열거하거나 의미 있는 그룹으로 비교하는 무배제 coverage여야 하며, 한 단위가 다른 단위의 원칙 답변을 대신하거나 H2/H3/H4 단위마다 같은 모집단 질문을 반복하도록 배선해서는 안 된다. 같은 의무를 여러 계층이 선택하면 각 계층 account는 자기 모집단에 대해 독립적으로 답해야 한다. TypeScript source 계약은 account H2 대신 그 source family가 선택한 public export 모집단이 같은 coverage를 진다.

설정과 디자인 foundation은 provider, consumer, 적용 상태와 구체적 사유를 한 topology account 행렬로 보여야 한다. 선택된 edge의 누락, 실제 foundation이 아닌 provider, 비활성 분기에 남은 positive edge, 선행 순서를 어긴 edge를 거부하고, provider 또는 consumer가 실제 선택 밖일 때만 구체적인 `inapplicable` 행을 허용해야 한다. Unit-local foundation evidence는 각 단위가 실제 사용한 부모를 계속 설명하며 topology account를 대신하지 않는다.

상위 수정은 실제 저술 부모를 상속하는 각 design·brief·서사 H2/H3/H4와 source export가 자기 부모를 시험한 결과를 직접 답하는 checklist여야 한다. 하위 작업이 드러낸 결함은 가장 이른 부모에서 고치고 양의 답에 그 발견과 수리를 기록해야 한다. 부모가 충분했다면 구체적으로 시험한 부모 결정과 결과를 밝힌 제외를 허용해야 하며, 부모 없는 단위·조용한 통과·반복된 일반 문장으로 대신할 수 없어야 한다. 설정과 조사는 저술 부모를 상속하지 않으므로 이 family를 선택해서는 안 된다.

Review 문장은 acknowledgement를 독립적으로 다시 읽은 결과를 기록해야 한다. 인접 acknowledgement를 정규화한 문장으로 되풀이하거나 한 host의 서로 다른 target에 같은 관찰을 재사용하는 기계적으로 판정 가능한 두 형태는 그래프를 만들기 전에 거부해야 한다. 이 검사는 review 상태나 판정을 저장하지 않고 review 품질을 추론하지 않아야 한다.

서로 다른 host에서 인용·경로·수치만 바뀐 review frame이 반복되거나 review 이유가 target의 Review question을 그대로 포함하면 그 위치와 반복 수를 결정적인 Self-Review alarm으로 보여야 한다. 이 alarm은 새로운 검토를 지시하되 corpus에 맞춘 자동 거부나 의미 판정이 되어서는 안 되며, target 모집단을 실제로 읽었는지도 결과에 밝혀야 한다.

### 작품별 발견의 증명 {#agent-production-evidence-discovery}

그래프는 모든 활성 저작 계층이 실제 작품의 지시, 약속, 주제, 자료, 자산, 의존성과 위험을 열린 방식으로 조사하게 해야 한다. 저작 단위 자체가 이 감사를 증언하게 하지 않고, 계층별 `docs/contracts` 감사면이 발견 결과와 현재 실현을 함께 소유해야 한다. 독립 결과가 있으면 별도 계약 파일이 가장 이른 의미 소유자와 현재 실현을 증명하고, 결과가 정말 없으면 조사한 구체적 입력과 위험 및 충분한 기존 소유자를 밝힌 계층별 중앙 제외 장부만 허용해야 한다. 조사를 생략한 상태와 조사 결과가 없는 상태가 같은 그래프로 통과해서는 안 된다.

계약 파일은 평면 inventory여야 한다. 중첩 폴더나 미리 심은 보편 규칙으로 작품 고유 발견을 대신할 수 없고, 양의 계약과 무결과 제외를 한 문서에 섞어서는 안 된다. 저작 H2/H3/H4는 작품 내용을 기술할 뿐 자신을 감사했다는 증거를 겸하지 않는다.

설정은 실제 film, brief 또는 library 계획을 역산하여 하류가 발명할 제작 전반의 사실과 제약을 먼저 소유해야 하고, 전달 결과에 독립적으로 영향을 주는 주체를 소유자·상속 기본값·범위 밖·미해결 중 하나로 분류해야 한다. 이 역산은 하류의 서사, 디자인, shot 또는 편집 내용을 설정에 미리 쓰는 권한이 아니다.

### 제작 종류와 단계 {#agent-production-evidence-shape-stage}

그래프는 `film`, `brief`, `library`를 상호 배타적인 제작 종류로 다루고, 각 저작 분기를 `disabled -> draft -> evidence -> review` 순서와 부모 단계 선행 조건에 따라 전진시켜야 한다. 같은 선언에서 settings와 design foundation topology를 투영하여 stage 선택과 account 행렬이 모순되지 않게 해야 한다. 간단한 영상에는 장편 서사 단계를 강요하지 않고, 재사용 자산에는 촬영·편집 단계를 강요하지 않아야 한다.

### 실제 대상과 계보의 무결성 {#agent-production-evidence-physical-integrity}

활성 분기는 목적에 맞는 실제 문서 또는 source host를 하나 이상 가져야 하고, 비활성 분기는 지배 대상을 남겨서는 안 된다. 파일·제목·export identity, 단일 소유자, 관계 cardinality, 각 상속 단위의 실제 부모와 단계 간 계보는 추정한 목록이 아니라 현재 파일 트리에서 검증되어야 한다.

### 추가만 가능한 확장 {#agent-production-evidence-additive-extension}

작품 전용 claim은 공통 그래프 뒤에 추가할 수 있어야 한다. 그 확장점으로 공통 claim이나 reference를 교체하고 cardinality, 잔여물 검사, 실패 조건을 약화하거나 끌 수 있어서는 안 된다.

### 결정론적 결과 또는 명시적 실패 {#agent-production-evidence-deterministic-result}

같은 설정과 같은 파일 트리는 실행 순서와 무관하게 같은 그래프를 만들고 같은 topology와 semantic-review alarm을 내놓아야 한다. 모순된 제작 종류·단계·대상·계보·topology 또는 기계적으로 복제된 review 이유는 일부 그래프를 내놓지 말고 구체적인 원인과 대상을 밝히며 실패해야 한다.
