# 지식·증거 도구 경계

## 지식과 증거 host 경계 {#spec-authoring-knowledge-evidence-boundary}

### 지식 요청과 출력 {#spec-authoring-knowledge-request-output}

<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-knowledge-boundary 이 계약이 저작 host를 안내와 실제 evidence 전달 경계로 제한한다. -->

Knowledge-and-evidence host는 coding agent가 올바른 contract와 기법을 찾게 하고 current target에서 실제 evidence를 생산·전달한다. 이 host는 project source 밖의 authoring state, 작품별 asset catalogue 또는 별도 scene database를 소유하지 않는다.

<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance 이 출력이 requirement, contract, 단위, 범위, refusal과 보편 기법을 current project 맥락에서 제공한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-discovery 이 출력이 자연어 의도에서 관련 contract, 예시와 검증 경로까지 연결한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery 이 출력이 package명이 아니라 저작 주제로 안내한다. -->

지식 요청은 topic, current target과 질문을 입력으로 받고 관련 requirement, system contract, guide, 지원 상태와 다음 validation 경로를 반환해야 한다. 출력은 특정 implementation owner를 튜토리얼하는 대신 사용자가 찾는 제품 책임과 관찰 가능한 correction을 설명해야 한다.

### 선택 surface 발견 {#spec-authoring-tool-choice-discovery}

Production-kind route query는 각 capability의 canonical owner, serializer, consumer와 생성 project skill path를 typed row로 반환한다. 지원되는 row의 필드가 비어 있거나 한 kind/capability가 중복되면 진단하며, 적용 불가 row는 route와 reason을 동시에 주장하지 않는다.

<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-choice-surface-discovery 이 절이 지원되는 저작 경로의 선행 조건, 차이와 failure를 비교 가능하게 한다. -->
<!-- @evidence requirements/product/authorability.md#product-discoverable-control 이 절이 구현됐지만 찾거나 검증할 수 없는 경로를 capability로 주장하지 못하게 한다. -->

Host는 지원되는 기법, local 또는 external execution, 품질 tier와 partial boundary를 각각 발견 가능하게 해야 한다. 설치된 provider나 하나의 예시는 유일한 경로로 승격할 수 없고, unavailable과 unverified 상태를 available 선택지와 구분해야 한다.

### Evidence 요청과 출력 {#spec-authoring-host-evidence-output}

<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-host-evidence 이 출력이 actual project와 target 실행에서 나온 digest-bound receipt를 요구한다. -->
<!-- @evidence requirements/agent-authoring/roles-and-authorities.md#agent-evidence-producer-authority 이 출력이 요청자의 주장이나 오래된 파일을 current evidence로 승격하지 못하게 한다. -->

Evidence 요청은 exact target, source 또는 compile identity와 observation parameter를 입력으로 받는다. 성공 출력은 observed target, snapped parameter, host runtime identity, input fingerprint, output digest와 receipt를 포함하며 refusal은 evidence payload를 제공하지 않는다.

### 저작 상태 불변식 {#spec-authoring-tool-authoring-invariant}

<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-authoring-api-refusal 이 불변식이 tool call로 source 밖 장면 상태를 누적 편집하지 못하게 한다. -->
<!-- @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring 이 불변식이 실제 교정을 일반 project source에서 수행하게 한다. -->

지식 조회와 evidence 생산은 project source를 수정하지 않아야 한다. 제안된 correction은 코딩 에이전트가 reviewable source 또는 project-owned bytes에 명시 반영한 뒤 새 validation을 통과해야 작품 사실이 된다.

### 콘텐츠와 외부 side effect 불변식 {#spec-authoring-tool-content-side-effect-invariant}

<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-content-supply-refusal 이 불변식이 host가 시대별 완성 콘텐츠를 대신 선택해 주지 못하게 한다. -->
<!-- @evidence requirements/agent-authoring/knowledge-boundary.md#agent-no-surprise-external-effects 이 불변식이 knowledge와 evidence 요청만으로 외부 upload나 generation을 시작하지 못하게 한다. -->

Host는 보편 저작 기법과 validation path를 제공하고 작품별 완성 자산은 제공하지 않는다. 외부 execution은 지식 또는 deterministic evidence 요청과 분리된 explicit authorization을 가져야 한다.

### 진단과 failure {#spec-authoring-tool-diagnostic-failure}

<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-diagnostic-discovery 이 failure가 invariant, target, path와 correction을 통해 관련 계약으로 안내한다. -->
<!-- @evidence requirements/agent-authoring/capability-discovery.md#agent-capability-gap-discovery 이 failure가 unavailable capability를 available surface로 표현하지 않게 한다. -->

Missing guide, unknown target, stale input, unsupported capability와 host refusal은 stable reason, owning boundary, exact target과 next action을 반환해야 한다. 실패 요청은 hypothetical output, 이전 evidence 또는 빈 placeholder를 current success로 반환할 수 없다.

### Tool 교체 호환성 {#spec-authoring-tool-boundary-compatibility}

<!-- @evidenceObligation portable-tool-boundary 표준 파일과 공개 타입 계약만으로 교체 가능한 저작·검증 경계. -->

<!-- @evidence requirements/agent-authoring/project-ownership.md#agent-authoring-tool-replaceability 이 호환성이 source와 공개 contract를 유지한 client와 agent 교체를 보장한다. -->
<!-- @evidence requirements/agent-authoring/partial-work.md#agent-resumable-authoring 이 호환성이 hidden host session 없이 저작을 재개하게 한다. -->

Session-local state는 도구 사용 gate일 수 있지만 작품 source나 미완성 작업의 유일한 저장소가 될 수 없다. 다른 compliant host나 client가 source snapshot, public contract와 receipts를 사용해 같은 target을 열 수 있어야 한다.
