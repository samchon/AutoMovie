# 위임과 결정 권한

## 역할별 결정 경계 {#spec-authoring-role-decision-boundary}

### 결정 권한 상태 {#spec-authoring-decision-authority-state}

<!-- @evidence requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision 이 상태가 직접 선택, 위임과 보류를 구분한다. -->
<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-separated-authorities 이 계약이 사용자, 코딩 에이전트, host와 결정론적 실행기의 권한을 분리한다. -->
<!-- @evidence requirements/product/choice-and-external-services.md#product-user-controlled-choice 이 경계가 작품별 선택의 최종 통제권을 사용자에게 둔다. -->

사용자는 작품 의도, source와 결과 채택의 최종 권한을 가진다. 코딩 에이전트는 명시적으로 위임된 저작 결정을 수행하고, host는 공개 지식과 실제 evidence를 전달하며, 결정론적 실행기는 구조적 유효성만 판단한다.

<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-user-delegation-authority 이 상태가 사용자가 정한 위임 범위와 회수 가능한 권한을 표현한다. -->

각 미해결 선택은 `reserved`, `delegated`, `decided`, `deferred` 중 하나의 상태를 가진다. 상태에는 target, 허용 선택지, 제약, acceptance 조건, 결정 주체와 기준 source revision이 포함되어야 하며, `delegated`는 사용자 소유권 이전을 뜻하지 않는다. 사용자는 위임을 회수하거나 범위를 바꿀 수 있고 위임된 결정의 origin은 이후 검토에서 수정하거나 거부할 수 있게 남아야 한다.

### 사용자와 감독 입력 {#spec-authoring-user-director-input}

<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-director-authority 이 입력이 사용자가 직접 수행하거나 사람 감독에게 맡긴 창작 판단을 보존한다. -->

사용자 또는 위임받은 사람 감독은 목표, 금지 사항, 미술·연출 의도, 비용과 품질 한도, 검토 기준과 직접 결정할 항목을 입력한다. 입력하지 않은 취향은 validation 규칙이나 먼저 성공한 결과로 대체할 수 없다.

### 코딩 에이전트 입력과 출력 {#spec-authoring-agent-input-output}

<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority 이 계약이 코딩 에이전트의 기법과 source 변경 권한을 위임 범위 안에 둔다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-reviewable-source-change 이 출력이 사용자가 유지, 수정 또는 폐기할 수 있는 source diff로 남게 한다. -->

코딩 에이전트 입력은 현재 source snapshot, 공개 contract와 유효한 위임 상태다. 출력은 검토 가능한 source 변경, 선택한 기법과 parameter, 영향받는 target, 외부 의존성, 아직 `reserved` 또는 `deferred`인 선택이며, 실행 결과를 직접 성공으로 선언할 권한은 포함하지 않는다.

### 실행과 evidence 권한 불변식 {#spec-authoring-runtime-evidence-authority-invariant}

<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-runtime-authority 이 불변식이 구조와 실행 가능성의 판정을 결정론적 실행기에 둔다. -->
<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority 이 불변식이 capture와 validation evidence를 실제 host 실행에서만 생성하게 한다. -->

저작 주체는 validation 실패를 성공으로 바꿀 수 없고, 결과 표시 surface는 구조적 진실을 재해석할 수 없다. Evidence 주장은 실제 target과 입력을 실행한 host output에만 근거해야 하며 요청자의 설명이나 이전 실행 파일은 현재 evidence가 아니다.

### 권한 위반 실패 {#spec-authoring-authority-violation-failure}

<!-- @evidence requirements/product/choice-and-external-services.md#product-delegation-not-proxy-decision 이 실패가 설치 상태나 default가 사용자 결정을 대신하는 것을 막는다. -->
<!-- @evidence requirements/product/authorability.md#product-hidden-inference-refusal 이 실패가 선언되지 않은 의도를 숨은 추정으로 채우는 것을 거부한다. -->

요청이 위임 범위를 넘거나 결정 주체가 불명확하면 `decision-required`로 거부하고 영향받는 target과 필요한 권한을 반환해야 한다. 설치된 credential, 사용 가능한 service, cached 선택 또는 성공 순서는 위임 증거로 인정하지 않는다.

### 권한 호환성과 교체 {#spec-authoring-authority-compatibility}

<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability 이 호환성이 source와 공개 contract를 유지한 채 저작 도구를 교체하게 한다. -->

권한 상태는 특정 agent, client, session 또는 vendor의 내부 identity에 종속되지 않아야 한다. 도구를 교체해도 사용자 소유권, 결정 상태, source revision과 미해결 선택이 보존되어 다음 주체가 같은 범위에서 작업을 이어 갈 수 있어야 한다.
