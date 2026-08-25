# 생성 프로젝트 증거 그래프 명세

## 그래프 구성과 검증 {#spec-authoring-production-evidence-construction}

<!-- @evidenceObligation section-index 아래의 독립된 그래프 구성·검증 단위를 묶는 문서 구조. -->

### 고정 공통 계약 해석 {#spec-authoring-production-evidence-shared-contract}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract 모든 프로젝트가 같은 공통 대상 집합을 해석하게 한다. -->

팩터리는 `docs/principles`, `docs/obligations`와 `docs/discovery`의 정규화된 상대 경로와 명시적 H2 anchor 목록을 하나의 고정 inventory로 읽는다. 그래프를 구성하기 전에 inventory의 파일·anchor identity와 실제 문서 트리가 서로 정확히 일치하는지 검사한다.

<!-- @evidenceObligation shared-contract 고정된 공통 문서·H2 inventory와 실제 트리 사이의 양방향 일치 검사. -->

### 저작 H2 모집단의 작품별 발견 coverage {#spec-authoring-production-evidence-discovery}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-discovery 실제 작품 조사를 수행한 상태와 생략한 상태를 저작 모집단 관계로 구분한다. -->

팩터리는 모든 활성 저작 H2 모집단에 `discovery/common.md`를 연결한다. 설정 H2에는 `common + settings`, research와 model·space·material·instance·motion·system H2에는 `common`, film storyline H2에는 `common + films + storylines`, scenario H2에는 `common + films + scenarios`, screenplay H2에는 `common + films + scripts`, brief H2에는 `common + briefs`를 연결한다. H3와 H4에는 이 모집단 발견 관계를 반복하지 않는다.

각 발견 reference는 해당 host layer가 `evidence`에 들어갈 때 활성화되고 `review`에서 현재 fingerprint를 요구한다. 일반 coverage이므로 독립 결과는 그 결과를 소유하거나 실현하는 H2가 증명하고, 완전한 모집단 조사에서 독립 결과가 없을 때만 하나의 모집단 단위 제외를 허용한다. 제외 사유는 검사한 구체적 입력·위험과 충분한 기존 소유자를 밝혀야 하며, 구현 유예나 빈 결과 선언으로 대신할 수 없다. 팩터리와 lint는 관계·제외·fingerprint의 구조를 검사하고, 구체성과 진실성은 해당 target과 전체 모집단을 다시 읽는 evidence review가 판정한다. 설정은 이 산문을 자동 해석하지 않는다.

설정 의무 모집단은 발견된 후보 중 action, choice, state, information, resource, control 또는 audience observation을 독립적으로 바꿀 수 있는 person, collective, object, environmental agent, institution, subsystem과 affected population을 빠짐없이 분류한다. 설정 저작과 review 절차는 필요한 미해결 주체가 남으면 그 소비자의 저작 시작을 보류하며, 팩터리는 그 의미 판단을 stage 값만으로 추론하지 않는다.

<!-- @evidenceObligation discovery-coverage 저작 H2별 정확한 발견 대상 배치, 단계 정렬, 결과 또는 구체적 무결과 제외와 설정의 operative-subject accounting. -->

### 제작 종류와 단계 상태기계 {#spec-authoring-production-evidence-shape-stage}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage 제작 종류별 허용 분기와 단계 선행 조건을 하나의 상태기계로 만든다. -->

`film`은 설정에서 스토리라인·시나리오·영상 대본·shot·film source로 이어지는 사다리를, `brief`는 설정에서 brief·shot·film source로 이어지는 짧은 사다리를 허용한다. 둘은 완성 film source 전에 production source의 독립된 검토를 요구한다. `library`는 설정, 선택한 디자인 문서·source 분기와 필요할 때 설정만 직렬화하는 production source를 허용하고 서사·shot·편집 분기를 금지한다. 모든 자식 분기의 `draft`는 필요한 부모가 `review`에 도달한 뒤에만 허용하며, 아직 종류를 선택하지 않은 `null`은 모든 단계를 `disabled`로 유지한다.

<!-- @evidenceObligation shape-stage-machine 세 제작 종류의 허용 분기, 단계 순서와 부모 검토 선행 조건. -->

### 파일 트리 기반 대상 검증 {#spec-authoring-production-evidence-physical-integrity}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity 선택이 실제 대상을 하나만 지배하고 비활성 잔여물을 함께 막게 한다. -->

팩터리는 glob으로 Markdown과 TypeScript host를 열거하고 활성 분기의 최소 host 수, 비활성 분기의 잔여물, 명시적 H2 anchor, 중복 target identity, 각 source 파일의 구체적인 named export owner와 스토리라인·시나리오·영상 대본의 물리적 순서 identity를 그래프 생성 전에 검사한다. 반환된 claim은 lint가 실제 export와 annotation을 선택하여 디자인 owner마다 정확히 한 디자인 파일, shot·acceptance owner마다 한 영상 대본 scene 또는 brief shot, 완전한 target coverage와 단계별 review cardinality를 검사하게 한다.

<!-- @evidenceObligation physical-population-integrity 실제 파일 모집단에서 검증하는 host 수, 잔여물, identity, 소유 cardinality와 계보. -->

### 공통 그래프 뒤의 로컬 합성 {#spec-authoring-production-evidence-additive-extension}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-additive-extension 작품 전용 관계를 허용하면서 공통 그래프의 무력화를 차단한다. -->

팩터리는 공통 작품별 발견·원칙·의무·저작 단계·source 단계 claim과 실행 canary를 먼저 완성하고, 입력의 `claims`를 그 배열 뒤에 이어 붙인다. 호출자는 공통 배열이나 reference를 입력으로 받지 않으므로 기존 계약을 대체하는 확장 경로를 갖지 않는다.

<!-- @evidenceObligation additive-local-claims 공통 claim을 먼저 완성하고 작품 전용 claim만 뒤에 추가하는 단방향 합성. -->

### 결정론적 출력과 사전 실패 {#spec-authoring-production-evidence-deterministic-result}

<!-- @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result 같은 입력의 동일 출력과 모순 입력의 명시적 실패를 규정한다. -->

파일·anchor·claim은 고정 inventory와 코드 단위 정렬 순서를 사용한다. 검증 실패는 잘못된 종류·단계·분기 또는 파일 경로와 충돌한 identity를 이름 붙인 예외로 반환하며, 모든 검증이 끝나기 전에는 부분 그래프를 공개하지 않는다.

<!-- @evidenceObligation deterministic-failure 고정 순서의 그래프 구성과 구체적인 원인을 가진 원자적 사전 실패. -->
